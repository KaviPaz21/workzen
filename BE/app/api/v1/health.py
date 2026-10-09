from fastapi import APIRouter, Depends

from app.core.config import Settings, get_settings

router = APIRouter(tags=["health"])


@router.get("/health")
async def health(settings: Settings = Depends(get_settings)) -> dict:
    return {
        "status": "ok",
        "environment": settings.app_env,
        "services": {
            "cosmos_db": settings.cosmos_configured,
            "blob_storage": settings.blob_configured,
            "ai_foundry": settings.foundry_configured,
        },
    }
