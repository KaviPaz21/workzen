import asyncio
import logging
from dataclasses import dataclass
from typing import Any
from uuid import uuid4

from app.core.errors import NotFoundError
from app.repositories.cosmos_repository import CosmosRepository
from app.utils.time import utc_now

logger = logging.getLogger(__name__)


BUCKET_LABELS = {
    "technical_skills": "Technical skills",
    "soft_skills": "Soft skills",
    "experience": "Experience",
    "responsibilities": "Responsibilities",
    "education": "Education",
    "certifications": "Certifications",
    "job_requirements": "Job requirements",
    "extra_curricular": "Extra-curricular",
}


def build_jd_text(jd: dict) -> str:
    sections = [
        f"Job description: {jd['name']}",
        f"Role: {jd['role']}",
        f"Sector: {jd['sector']}",
        f"Level: {jd['level']}",
    ]
    for key, label in BUCKET_LABELS.items():
        items = jd["buckets"].get(key, [])
        weight = jd["weights"].get(key, 50)
        lines = "\n".join(f"- {item}" for item in items) if items else "- none stated"
        sections.append(f"{label} (weight {weight} out of 100):\n{lines}")
    return "\n\n".join(sections)


@dataclass
class EvaluationService:
    evaluations: CosmosRepository
    vacancies: CosmosRepository
    jds: CosmosRepository
    candidates: CosmosRepository
    graph: Any

    async def list_all(self, limit: int = 100) -> list[dict]:
        return await self.evaluations.list_all(limit)

    async def get(self, evaluation_id: str) -> dict:
        evaluation = await self.evaluations.get(evaluation_id)
        if evaluation is None:
            raise NotFoundError(f"Evaluation {evaluation_id} was not found")
        return evaluation

    async def evaluate(self, vacancy_id: str, candidate_ids: list[str]) -> list[dict]:
        vacancy = await self.vacancies.get(vacancy_id)
        if vacancy is None:
            raise NotFoundError(f"Vacancy {vacancy_id} was not found")
        jd = await self.jds.get(vacancy["jd_id"])
        if jd is None:
            raise NotFoundError(f"Job description {vacancy['jd_id']} was not found")
        candidates = []
        for candidate_id in candidate_ids:
            candidate = await self.candidates.get(candidate_id)
            if candidate is None:
                raise NotFoundError(f"Candidate {candidate_id} was not found")
            candidates.append(candidate)
        jd_text = build_jd_text(jd)
        return await asyncio.gather(*[self.evaluate_candidate(vacancy, jd_text, candidate) for candidate in candidates])

    async def evaluate_candidate(self, vacancy: dict, jd_text: str, candidate: dict) -> dict:
        record = {
            "id": str(uuid4()),
            "vacancy_id": vacancy["id"],
            "vacancy_title": vacancy["title"],
            "candidate_id": candidate["id"],
            "candidate_name": candidate["full_name"],
            "created_at": utc_now(),
        }
        try:
            state = await self.graph.ainvoke({"jd_text": jd_text, "cv_text": candidate["cv_text"]})
            record["status"] = "completed"
            record["result"] = state["match"].model_dump()
            record["quality"] = state["quality"].model_dump()
        except Exception as error:
            logger.exception("Evaluation failed for candidate %s", candidate["id"])
            record["status"] = "failed"
            record["error"] = str(error)
        return await self.evaluations.create(record)
