from fastapi import APIRouter, Depends, File, Form, UploadFile
from pydantic import ValidationError

from app.api.deps import get_cv_scorer, get_stored_scoring_service
from app.core.errors import InvalidRequestError
from app.schemas.recruiteone.scoring import CvScore, JdForScoring
from app.services.recruiteone.cv_scoring_service import CvScoringService
from app.services.recruiteone.stored_scoring_service import StoredScoringService

router = APIRouter(prefix="/scoring", tags=["recruiteone: scoring"])


@router.post("/cv", response_model=CvScore)
async def score_cv(
    file: UploadFile = File(...),
    jd: str = Form(...),
    service: CvScoringService = Depends(get_cv_scorer),
):
    try:
        jd_model = JdForScoring.model_validate_json(jd)
    except ValidationError as error:
        raise InvalidRequestError("The job description payload is not valid") from error
    data = await file.read()
    return await service.score(file.filename or "cv", data, jd_model)


@router.post("/candidates/{candidate_id}", response_model=CvScore)
async def score_stored_cv(candidate_id: str, jd: JdForScoring, service: StoredScoringService = Depends(get_stored_scoring_service)):
    return await service.score(candidate_id, jd)
