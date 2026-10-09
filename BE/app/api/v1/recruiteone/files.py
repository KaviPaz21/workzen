from fastapi import APIRouter, Depends, File, Response, UploadFile, status

from app.api.deps import get_cv_file_service
from app.services.recruiteone.cv_file_service import CvFileService

router = APIRouter(prefix="/files", tags=["recruiteone: cv files"])


@router.put("/{candidate_id}", status_code=status.HTTP_204_NO_CONTENT)
async def upload_cv_file(candidate_id: str, file: UploadFile = File(...), service: CvFileService = Depends(get_cv_file_service)):
    data = await file.read()
    await service.store(candidate_id, file.filename or "cv", data, file.content_type or "application/octet-stream")


@router.get("/{candidate_id}")
async def download_cv_file(candidate_id: str, service: CvFileService = Depends(get_cv_file_service)):
    data, content_type = await service.fetch(candidate_id)
    return Response(content=data, media_type=content_type)
