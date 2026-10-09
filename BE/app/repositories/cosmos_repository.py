from dataclasses import dataclass

from azure.cosmos.aio import ContainerProxy
from azure.cosmos.exceptions import CosmosResourceNotFoundError


@dataclass
class CosmosRepository:
    container: ContainerProxy

    async def create(self, item: dict) -> dict:
        return await self.container.create_item(body=item)

    async def get(self, item_id: str) -> dict | None:
        try:
            return await self.container.read_item(item=item_id, partition_key=item_id)
        except CosmosResourceNotFoundError:
            return None

    async def list_all(self, limit: int = 100) -> list[dict]:
        query = "SELECT * FROM c ORDER BY c.created_at DESC OFFSET 0 LIMIT @limit"
        items = self.container.query_items(query=query, parameters=[{"name": "@limit", "value": limit}])
        return [item async for item in items]

    async def count(self, status: str | None = None) -> int:
        if status is None:
            query, parameters = "SELECT VALUE COUNT(1) FROM c", []
        else:
            query = "SELECT VALUE COUNT(1) FROM c WHERE c.status = @status"
            parameters = [{"name": "@status", "value": status}]
        values = [value async for value in self.container.query_items(query=query, parameters=parameters)]
        return values[0] if values else 0

    async def replace(self, item_id: str, item: dict) -> dict:
        return await self.container.replace_item(item=item_id, body=item)

    async def delete(self, item_id: str) -> bool:
        try:
            await self.container.delete_item(item=item_id, partition_key=item_id)
        except CosmosResourceNotFoundError:
            return False
        return True
