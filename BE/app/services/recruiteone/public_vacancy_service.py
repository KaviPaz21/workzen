import time
from dataclasses import dataclass
from uuid import uuid4

from app.core.errors import InvalidRequestError, NotFoundError
from app.repositories.record_repository import RecordRepository
from app.services.recruiteone.cv_file_service import CvFileService
from app.services.recruiteone.workspace_service import WorkspaceService, without_collection
from app.utils.time import today_iso


def is_accepting(vacancy: dict) -> bool:
    if vacancy.get("status") == "closed" or vacancy.get("collection_closed_at"):
        return False
    closing_date = vacancy.get("closing_date")
    return not (closing_date and closing_date < today_iso())


@dataclass
class PublicVacancyService:
    repository: RecordRepository
    workspace: WorkspaceService
    files: CvFileService

    async def find(self, token: str) -> tuple[dict, dict]:
        vacancy = await self.repository.find_vacancy_by_token(token)
        if vacancy is None:
            raise NotFoundError("This application link is not valid")
        jd = await self.workspace.get("jds", vacancy["jd_id"])
        return without_collection(vacancy), jd

    async def describe(self, token: str) -> dict:
        vacancy, jd = await self.find(token)
        return {
            "title": vacancy["title"],
            "closing_date": vacancy.get("closing_date"),
            "accepting": is_accepting(vacancy),
            "jd": {"role": jd["role"], "sector": jd["sector"], "level": jd["level"], "buckets": jd["buckets"]},
        }

    async def apply(
        self,
        token: str,
        file_name: str,
        content_type: str,
        data: bytes,
        full_name: str,
        email: str,
        phone: str,
        current_title: str,
        application: dict,
    ) -> dict:
        vacancy, _ = await self.find(token)
        if not is_accepting(vacancy):
            raise InvalidRequestError("This vacancy is no longer accepting applications")
        candidate_id = f"cand-{int(time.time() * 1000):x}{uuid4().hex[:4]}"
        await self.files.store(candidate_id, file_name, data, content_type)
        record = {
            "full_name": full_name,
            "email": email,
            "phone": phone,
            "current_title": current_title,
            "skills": [],
            "file_name": file_name,
            "status": "new",
            "created_at": today_iso(),
            "vacancy_ids": [vacancy["id"]],
            "source": "application",
            "batch_id": None,
            "selected": False,
            "has_file": True,
            "score_status": "pending",
            "score": None,
            "application": application,
        }
        return await self.workspace.save("candidates", candidate_id, record)
