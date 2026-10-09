from dataclasses import dataclass
from uuid import uuid4

from app.core.errors import NotFoundError
from app.repositories.cosmos_repository import CosmosRepository
from app.utils.time import utc_now


@dataclass
class ResourceService:
    repository: CosmosRepository
    resource_name: str

    async def list_all(self, limit: int = 100) -> list[dict]:
        return await self.repository.list_all(limit)

    async def get(self, item_id: str) -> dict:
        item = await self.repository.get(item_id)
        if item is None:
            raise NotFoundError(f"{self.resource_name} {item_id} was not found")
        return item

    async def create(self, data: dict) -> dict:
        now = utc_now()
        item = {"id": str(uuid4()), **data, "created_at": now, "updated_at": now}
        return await self.repository.create(item)

    async def update(self, item_id: str, changes: dict) -> dict:
        item = await self.get(item_id)
        merged = {**item, **changes, "updated_at": utc_now()}
        return await self.repository.replace(item_id, merged)

    async def delete(self, item_id: str) -> None:
        deleted = await self.repository.delete(item_id)
        if not deleted:
            raise NotFoundError(f"{self.resource_name} {item_id} was not found")
