from dataclasses import dataclass

from azure.cosmos.aio import ContainerProxy
from azure.cosmos.exceptions import CosmosResourceNotFoundError

METADATA_KEYS = ("_rid", "_self", "_etag", "_attachments", "_ts")


def strip_metadata(item: dict) -> dict:
    return {key: value for key, value in item.items() if key not in METADATA_KEYS}


@dataclass
class RecordRepository:
    container: ContainerProxy

    async def list_all(self) -> list[dict]:
        items = self.container.query_items(query="SELECT * FROM c")
        return [strip_metadata(item) async for item in items]

    async def get(self, collection: str, item_id: str) -> dict | None:
        try:
            item = await self.container.read_item(item=item_id, partition_key=collection)
        except CosmosResourceNotFoundError:
            return None
        return strip_metadata(item)

    async def upsert(self, item: dict) -> dict:
        saved = await self.container.upsert_item(body=item)
        return strip_metadata(saved)

    async def delete(self, collection: str, item_id: str) -> bool:
        try:
            await self.container.delete_item(item=item_id, partition_key=collection)
        except CosmosResourceNotFoundError:
            return False
        return True

    async def find_vacancy_by_token(self, token: str) -> dict | None:
        query = "SELECT * FROM c WHERE c.collection = 'vacancies' AND c.share_token = @token"
        items = self.container.query_items(query=query, parameters=[{"name": "@token", "value": token}], partition_key="vacancies")
        async for item in items:
            return strip_metadata(item)
        return None
