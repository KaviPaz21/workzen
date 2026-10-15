from dataclasses import dataclass

from azure.cosmos.aio import ContainerProxy
from azure.cosmos.exceptions import CosmosResourceNotFoundError

from app.repositories.record_repository import strip_metadata

COLLECTION = "assistant_sessions"


@dataclass
class ChatSessionRepository:
    container: ContainerProxy

    async def list_for_user(self, user_id: str) -> list[dict]:
        query = (
            "SELECT c.id, c.title, c.updated_at, ARRAY_LENGTH(c.messages) AS message_count "
            "FROM c WHERE c.collection = @collection AND c.user_id = @user ORDER BY c.updated_at DESC"
        )
        parameters = [{"name": "@collection", "value": COLLECTION}, {"name": "@user", "value": user_id}]
        items = self.container.query_items(query=query, parameters=parameters, partition_key=COLLECTION)
        return [strip_metadata(item) async for item in items]

    async def get(self, session_id: str) -> dict | None:
        try:
            item = await self.container.read_item(item=session_id, partition_key=COLLECTION)
        except CosmosResourceNotFoundError:
            return None
        return strip_metadata(item)

    async def save(self, session: dict) -> dict:
        saved = await self.container.upsert_item(body={**session, "collection": COLLECTION})
        return strip_metadata(saved)

    async def delete(self, session_id: str) -> bool:
        try:
            await self.container.delete_item(item=session_id, partition_key=COLLECTION)
        except CosmosResourceNotFoundError:
            return False
        return True
