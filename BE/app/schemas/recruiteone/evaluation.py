from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator

Recommendation = Literal["strong_match", "potential_match", "not_a_match"]
EvaluationStatus = Literal["completed", "failed"]


class MatchResult(BaseModel):
    overall_score: int
    skills_score: int
    experience_score: int
    education_score: int
    strengths: list[str]
    gaps: list[str]
    summary: str
    recommendation: Recommendation

    @field_validator("overall_score", "skills_score", "experience_score", "education_score")
    @classmethod
    def clamp_score(cls, value: int) -> int:
        return max(0, min(100, value))


class QualityScores(BaseModel):
    relevance: float | None = None
    coherence: float | None = None
    groundedness: float | None = None


class EvaluationRequest(BaseModel):
    vacancy_id: str
    candidate_ids: list[str] = Field(min_length=1)


class EvaluationRead(BaseModel):
    id: str
    vacancy_id: str
    vacancy_title: str
    candidate_id: str
    candidate_name: str
    status: EvaluationStatus
    result: MatchResult | None = None
    quality: QualityScores | None = None
    error: str | None = None
    created_at: datetime
