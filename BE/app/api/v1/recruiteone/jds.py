from fastapi import APIRouter, Depends, status

from app.api.deps import get_jd_decomposer, get_jd_service
from app.schemas.recruiteone.jd import JdCreate, JdDecomposeRequest, JdDecomposition, JdRead, JdUpdate
from app.services.recruiteone.jd_service import JdDecomposerService, JdService

router = APIRouter(prefix="/jds", tags=["recruiteone: job descriptions"])


@router.post("/decompose", response_model=JdDecomposition)
async def decompose_jd(payload: JdDecomposeRequest, service: JdDecomposerService = Depends(get_jd_decomposer)):
    return await service.decompose(payload.name, payload.text)


@router.get("", response_model=list[JdRead])
async def list_jds(limit: int = 100, service: JdService = Depends(get_jd_service)):
    return await service.list_all(limit)


@router.post("", response_model=JdRead, status_code=status.HTTP_201_CREATED)
async def create_jd(payload: JdCreate, service: JdService = Depends(get_jd_service)):
    return await service.create(payload.model_dump(mode="json"))


@router.get("/{jd_id}", response_model=JdRead)
async def get_jd(jd_id: str, service: JdService = Depends(get_jd_service)):
    return await service.get(jd_id)


@router.patch("/{jd_id}", response_model=JdRead)
async def update_jd(jd_id: str, payload: JdUpdate, service: JdService = Depends(get_jd_service)):
    return await service.update(jd_id, payload.model_dump(mode="json", exclude_unset=True))


@router.delete("/{jd_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_jd(jd_id: str, service: JdService = Depends(get_jd_service)):
    await service.delete(jd_id)
