import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.v1.router import api_router
from app.core.config import Settings, get_settings
from app.core.errors import AiServiceError, InvalidRequestError, NotFoundError
from app.integrations.blob import connect_blob_storage, open_knowledge_storage
from app.integrations.cosmos import connect_cosmos
from app.services.assistant.coworker_service import CoworkerRuns
from app.services.assistant.knowledge_service import KnowledgeIndex

logger = logging.getLogger(__name__)


def create_lifespan(settings: Settings):
    @asynccontextmanager
    async def lifespan(app: FastAPI):
        if settings.cosmos_configured:
            app.state.cosmos_client, app.state.database = await connect_cosmos(settings)
        if settings.blob_configured:
            app.state.blob_service, app.state.blob_storage = await connect_blob_storage(settings)
            try:
                app.state.knowledge_storage = await open_knowledge_storage(app.state.blob_service, settings)
            except Exception:
                logger.exception("The knowledge base container could not be opened")
        yield
        if app.state.cosmos_client:
            await app.state.cosmos_client.close()
        if app.state.blob_service:
            await app.state.blob_service.close()

    return lifespan


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()
    app = FastAPI(title=settings.app_name, lifespan=create_lifespan(settings))
    app.state.cosmos_client = None
    app.state.database = None
    app.state.blob_service = None
    app.state.blob_storage = None
    app.state.knowledge_storage = None
    app.state.knowledge_index = KnowledgeIndex()
    app.state.coworker_runs = CoworkerRuns()

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.exception_handler(NotFoundError)
    async def handle_not_found(request: Request, error: NotFoundError):
        return JSONResponse(status_code=404, content={"detail": str(error)})

    @app.exception_handler(InvalidRequestError)
    async def handle_invalid_request(request: Request, error: InvalidRequestError):
        return JSONResponse(status_code=400, content={"detail": str(error)})

    @app.exception_handler(AiServiceError)
    async def handle_ai_service_error(request: Request, error: AiServiceError):
        return JSONResponse(status_code=502, content={"detail": str(error)})

    app.include_router(api_router, prefix=settings.api_prefix)
    return app


app = create_app()
