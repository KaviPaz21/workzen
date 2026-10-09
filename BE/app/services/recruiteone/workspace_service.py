import re
from dataclasses import dataclass

from app.core.errors import InvalidRequestError, NotFoundError
from app.repositories.record_repository import RecordRepository

COLLECTIONS = ("jds", "vacancies", "candidates", "batches", "interviews", "scorecards", "interview_scores")
ID_PATTERN = re.compile(r"^[A-Za-z0-9_-]{1,64}$")


def check_collection(collection: str) -> None:
    if collection not in COLLECTIONS:
        raise InvalidRequestError(f"Unknown collection {collection}")


def check_id(item_id: str) -> None:
    if not ID_PATTERN.match(item_id):
        raise InvalidRequestError("The record id is not valid")


def without_collection(item: dict) -> dict:
    return {key: value for key, value in item.items() if key != "collection"}


@dataclass
class WorkspaceService:
    repository: RecordRepository

    async def snapshot(self) -> dict[str, list[dict]]:
        grouped: dict[str, list[dict]] = {name: [] for name in COLLECTIONS}
        for item in await self.repository.list_all():
            name = item.get("collection")
            if name in grouped:
                grouped[name].append(without_collection(item))
        return grouped

    async def get(self, collection: str, item_id: str) -> dict:
        check_collection(collection)
        check_id(item_id)
        item = await self.repository.get(collection, item_id)
        if item is None:
            raise NotFoundError(f"{collection} record {item_id} was not found")
        return without_collection(item)

    async def save(self, collection: str, item_id: str, data: dict) -> dict:
        check_collection(collection)
        check_id(item_id)
        if data.get("id", item_id) != item_id:
            raise InvalidRequestError("The record id does not match the address")
        saved = await self.repository.upsert({**data, "id": item_id, "collection": collection})
        return without_collection(saved)

    async def remove(self, collection: str, item_id: str) -> None:
        check_collection(collection)
        check_id(item_id)
        await self.repository.delete(collection, item_id)
