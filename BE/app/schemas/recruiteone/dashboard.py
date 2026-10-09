from pydantic import BaseModel

from app.schemas.recruiteone.evaluation import EvaluationRead


class RecommendationBreakdown(BaseModel):
    strong_match: int = 0
    potential_match: int = 0
    not_a_match: int = 0


class DashboardSummary(BaseModel):
    open_vacancies: int
    active_jds: int
    candidates_in_pool: int
    evaluations_completed: int
    average_match_score: float | None
    recommendation_breakdown: RecommendationBreakdown
    recent_evaluations: list[EvaluationRead]
