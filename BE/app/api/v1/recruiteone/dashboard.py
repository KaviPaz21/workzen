from fastapi import APIRouter, Depends

from app.api.deps import get_dashboard_service
from app.schemas.recruiteone.dashboard import DashboardSummary
from app.services.recruiteone.dashboard_service import DashboardService

router = APIRouter(prefix="/dashboard", tags=["recruiteone: dashboard"])


@router.get("/summary", response_model=DashboardSummary)
async def get_summary(service: DashboardService = Depends(get_dashboard_service)):
    return await service.summary()
