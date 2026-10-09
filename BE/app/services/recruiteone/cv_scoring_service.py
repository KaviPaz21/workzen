import logging
from dataclasses import dataclass
from typing import Any

from app.core.errors import AiServiceError, InvalidRequestError
from app.schemas.recruiteone.scoring import CvScore, JdForScoring
from app.utils.documents import extract_text

logger = logging.getLogger(__name__)


@dataclass
class CvScoringService:
    graph: Any
    max_upload_bytes: int

    async def score(self, file_name: str, data: bytes, jd: JdForScoring) -> CvScore:
        if not data:
            raise InvalidRequestError("The uploaded file is empty")
        if len(data) > self.max_upload_bytes:
            raise InvalidRequestError("The uploaded file exceeds the maximum allowed size")
        cv_text = extract_text(file_name, data)
        if not cv_text:
            raise InvalidRequestError("No readable text was found in the uploaded file")
        try:
            state = await self.graph.ainvoke({"jd": jd, "cv_text": cv_text})
        except Exception as error:
            logger.exception("CV scoring failed")
            raise AiServiceError("The AI scoring failed. Please try again.") from error
        return state["result"]
