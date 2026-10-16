import asyncio
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, ValidationError

from app.actions import build_actions
from app.actions.browser import BrowserController
from app.actions.database import DatabaseManager
from app.actions.errors import ActionError, ApprovalNeeded
from app.config import Settings, get_settings
from app.security import confirm_pairing, load_or_create_token, replace_token, require_allowed_origin, require_token

APP_NAME = "workzen-coworker"
APP_VERSION = "0.4.0"
ACTION_TIMEOUT_SECONDS = 90


class ActionRequest(BaseModel):
    args: dict = Field(default_factory=dict)


async def reset_pairing(app: FastAPI) -> None:
    app.state.token = replace_token(app.state.settings)
    await app.state.browser.shutdown()
    await app.state.databases.shutdown()


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()
    browser = BrowserController(settings)
    databases = DatabaseManager()

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        app.state.loop = asyncio.get_running_loop()
        yield
        await browser.shutdown()
        await databases.shutdown()

    app = FastAPI(title="WorkZen Co-worker", lifespan=lifespan)
    app.state.token = load_or_create_token(settings)
    app.state.settings = settings
    app.state.browser = browser
    app.state.databases = databases
    app.state.confirm_pairing = confirm_pairing
    app.state.pairing_lock = asyncio.Lock()
    app.state.actions = build_actions(settings, browser, databases)
    app.dependency_overrides[get_settings] = lambda: settings

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.coworker_allowed_origins,
        allow_credentials=False,
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type"],
    )

    @app.middleware("http")
    async def allow_private_network(request: Request, call_next):
        response = await call_next(request)
        if request.headers.get("access-control-request-private-network") == "true":
            response.headers["Access-Control-Allow-Private-Network"] = "true"
        return response

    @app.get("/ping")
    async def ping():
        return {"name": APP_NAME, "version": APP_VERSION}

    @app.post("/pair")
    async def pair(request: Request):
        origin = require_allowed_origin(request, settings)
        lock = request.app.state.pairing_lock
        if lock.locked():
            raise HTTPException(status_code=409, detail="A question is already waiting on this computer. Answer it first.")
        async with lock:
            approved = await request.app.state.confirm_pairing(settings, origin)
        if not approved:
            raise HTTPException(status_code=403, detail="The connection was not allowed on this computer")
        return {"token": request.app.state.token}

    @app.post("/unpair", dependencies=[Depends(require_token)])
    async def unpair(request: Request):
        await reset_pairing(request.app)
        return {"ok": True}

    @app.get("/status", dependencies=[Depends(require_token)])
    async def status(request: Request):
        return {
            "name": APP_NAME,
            "version": APP_VERSION,
            "workspace": str(settings.workspace),
            "launch_apps": settings.coworker_launch_apps,
            "actions": sorted(request.app.state.actions),
        }

    @app.post("/actions/{name}", dependencies=[Depends(require_token)])
    async def run_action(name: str, body: ActionRequest, request: Request):
        handler = request.app.state.actions.get(name)
        if handler is None:
            raise HTTPException(status_code=404, detail="Unknown action")
        try:
            result = await asyncio.wait_for(handler(body.args), timeout=ACTION_TIMEOUT_SECONDS)
        except ApprovalNeeded as error:
            return {"ok": False, "error": str(error), "needs_approval": {"label": error.label, "effect": error.effect}}
        except ActionError as error:
            return {"ok": False, "error": str(error)}
        except ValidationError as error:
            return {"ok": False, "error": f"The action arguments are not valid: {error.errors()[0]['msg']}"}
        except TimeoutError:
            return {"ok": False, "error": "The action took too long and was stopped."}
        return {"ok": True, "result": result}

    return app
