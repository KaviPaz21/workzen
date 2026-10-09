from typing import Any

from fastapi import APIRouter, Body, Depends, status

from app.api.deps import get_workspace_service
from app.services.recruiteone.workspace_service import WorkspaceService

router = APIRouter(prefix="/records", tags=["recruiteone: records"])


@router.get("")
async def list_records(service: WorkspaceService = Depends(get_workspace_service)):
    return await service.snapshot()


@router.put("/{collection}/{item_id}")
async def save_record(
    collection: str,
    item_id: str,
    payload: dict[str, Any] = Body(...),
    service: WorkspaceService = Depends(get_workspace_service),
):
    return await service.save(collection, item_id, payload)


@router.delete("/{collection}/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_record(collection: str, item_id: str, service: WorkspaceService = Depends(get_workspace_service)):
    await service.remove(collection, item_id)
