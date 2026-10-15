from fastapi import APIRouter

from app.api.v1 import health
from app.api.v1.assistant.router import router as assistant_router
from app.api.v1.recruiteone.router import router as recruiteone_router

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(recruiteone_router)
api_router.include_router(assistant_router)
