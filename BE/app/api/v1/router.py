from fastapi import APIRouter

from app.api.v1 import health
from app.api.v1.recruiteone.router import router as recruiteone_router

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(recruiteone_router)
