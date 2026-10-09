import logging
from dataclasses import dataclass
from typing import Any

from app.core.errors import AiServiceError
from app.schemas.recruiteone.jd import JdDecomposition
from app.services.base import ResourceService

logger = logging.getLogger(__name__)


@dataclass
class JdService(ResourceService):
    async def delete(self, item_id: str) -> None:
        await self.update(item_id, {"status": "deleted"})


@dataclass
class JdDecomposerService:
    graph: Any

    async def decompose(self, name: str, text: str) -> JdDecomposition:
        try:
            state = await self.graph.ainvoke({"name": name, "text": text})
        except Exception as error:
            logger.exception("JD decomposition failed")
            raise AiServiceError("The AI analysis failed. Please try again.") from error
        return state["decomposition"]
