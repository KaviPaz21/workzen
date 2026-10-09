from dataclasses import dataclass

from app.repositories.cosmos_repository import CosmosRepository

RECOMMENDATIONS = ("strong_match", "potential_match", "not_a_match")


@dataclass
class DashboardService:
    jds: CosmosRepository
    vacancies: CosmosRepository
    candidates: CosmosRepository
    evaluations: CosmosRepository

    async def summary(self) -> dict:
        recent = await self.evaluations.list_all(limit=50)
        completed = [item for item in recent if item.get("status") == "completed" and item.get("result")]
        scores = [item["result"]["overall_score"] for item in completed]
        breakdown = {name: 0 for name in RECOMMENDATIONS}
        for item in completed:
            breakdown[item["result"]["recommendation"]] += 1
        return {
            "open_vacancies": await self.vacancies.count("open"),
            "active_jds": await self.jds.count("active"),
            "candidates_in_pool": await self.candidates.count(),
            "evaluations_completed": await self.evaluations.count("completed"),
            "average_match_score": round(sum(scores) / len(scores), 1) if scores else None,
            "recommendation_breakdown": breakdown,
            "recent_evaluations": recent[:5],
        }
