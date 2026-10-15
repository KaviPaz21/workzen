import asyncio
from contextlib import asynccontextmanager

import uvicorn
from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, ValidationError

from app.actions import build_actions
from app.actions.browser import BrowserController
from app.actions.errors import ActionError
from app.config import Settings, get_settings
from app.security import load_or_create_token, require_token

APP_NAME = "workzen-coworker"
APP_VERSION = "0.1.0"
ACTION_TIMEOUT_SECONDS = 90


class ActionRequest(BaseModel):
    args: dict = Field(default_factory=dict)


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()
    browser = BrowserController(settings)

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        yield
        await browser.shutdown()

    app = FastAPI(title="WorkZen Co-worker", lifespan=lifespan)
    app.state.token = load_or_create_token(settings)
    app.state.actions = build_actions(settings, browser)
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
        except ActionError as error:
            return {"ok": False, "error": str(error)}
        except ValidationError as error:
            return {"ok": False, "error": f"The action arguments are not valid: {error.errors()[0]['msg']}"}
        except TimeoutError:
            return {"ok": False, "error": "The action took too long and was stopped."}
        return {"ok": True, "result": result}

    return app


def run() -> None:
    settings = get_settings()
    app = create_app(settings)
    print("")
    print("WorkZen Co-worker is running")
    print(f"  Address:      http://{settings.coworker_host}:{settings.coworker_port}")
    print(f"  Workspace:    {settings.workspace}")
    print(f"  Pairing code: {app.state.token}")
    print("Paste the pairing code into WorkZen > AI Assistant > Co-worker. Press Ctrl+C to stop.")
    print("")
    uvicorn.run(app, host=settings.coworker_host, port=settings.coworker_port, log_level="warning")


if __name__ == "__main__":
    run()
