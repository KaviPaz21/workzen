import secrets
from dataclasses import dataclass

from app.core.errors import InvalidRequestError
from app.repositories.cosmos_repository import CosmosRepository
from app.services.base import ResourceService


@dataclass
class VacancyService(ResourceService):
    jd_repository: CosmosRepository

    async def ensure_jd_exists(self, jd_id: str) -> None:
        jd = await self.jd_repository.get(jd_id)
        if jd is None:
            raise InvalidRequestError(f"Job description {jd_id} does not exist")

    async def create(self, data: dict) -> dict:
        await self.ensure_jd_exists(data["jd_id"])
        shareable = data.pop("shareable", False)
        if shareable and not data.get("closing_date"):
            raise InvalidRequestError("A closing date is required for a shareable vacancy")
        data["share_token"] = secrets.token_urlsafe(9) if shareable else None
        return await super().create(data)

    async def update(self, item_id: str, changes: dict) -> dict:
        if "jd_id" in changes:
            await self.ensure_jd_exists(changes["jd_id"])
        return await super().update(item_id, changes)
