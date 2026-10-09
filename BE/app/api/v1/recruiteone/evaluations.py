from fastapi import APIRouter, Depends

from app.api.deps import get_evaluation_service
from app.schemas.recruiteone.evaluation import EvaluationRead, EvaluationRequest
from app.services.recruiteone.evaluation_service import EvaluationService

router = APIRouter(prefix="/evaluations", tags=["recruiteone: evaluations"])


@router.post("", response_model=list[EvaluationRead])
async def run_evaluations(payload: EvaluationRequest, service: EvaluationService = Depends(get_evaluation_service)):
    return await service.evaluate(payload.vacancy_id, payload.candidate_ids)


@router.get("", response_model=list[EvaluationRead])
async def list_evaluations(limit: int = 100, service: EvaluationService = Depends(get_evaluation_service)):
    return await service.list_all(limit)


@router.get("/{evaluation_id}", response_model=EvaluationRead)
async def get_evaluation(evaluation_id: str, service: EvaluationService = Depends(get_evaluation_service)):
    return await service.get(evaluation_id)
