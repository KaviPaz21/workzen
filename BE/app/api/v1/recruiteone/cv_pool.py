from fastapi import APIRouter, Depends, File, Form, UploadFile, status

from app.api.deps import get_candidate_service, get_cv_pool_service
from app.schemas.recruiteone.candidate import CandidateRead, CandidateUpdate
from app.services.base import ResourceService
from app.services.recruiteone.cv_pool_service import CvPoolService

router = APIRouter(prefix="/cv-pool", tags=["recruiteone: cv pool"])


@router.get("", response_model=list[CandidateRead])
async def list_candidates(limit: int = 100, service: ResourceService = Depends(get_candidate_service)):
    return await service.list_all(limit)


@router.post("", response_model=CandidateRead, status_code=status.HTTP_201_CREATED)
async def upload_cv(
    file: UploadFile = File(...),
    full_name: str = Form(""),
    email: str = Form(""),
    current_title: str = Form(""),
    service: CvPoolService = Depends(get_cv_pool_service),
):
    data = await file.read()
    return await service.upload(
        file_name=file.filename or "cv",
        content_type=file.content_type or "application/octet-stream",
        data=data,
        full_name=full_name,
        email=email,
        current_title=current_title,
    )


@router.get("/{candidate_id}", response_model=CandidateRead)
async def get_candidate(candidate_id: str, service: ResourceService = Depends(get_candidate_service)):
    return await service.get(candidate_id)


@router.patch("/{candidate_id}", response_model=CandidateRead)
async def update_candidate(
    candidate_id: str, payload: CandidateUpdate, service: ResourceService = Depends(get_candidate_service)
):
    return await service.update(candidate_id, payload.model_dump(exclude_unset=True))


@router.delete("/{candidate_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_candidate(candidate_id: str, service: CvPoolService = Depends(get_cv_pool_service)):
    await service.delete(candidate_id)
