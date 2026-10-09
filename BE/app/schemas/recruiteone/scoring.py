from typing import Literal

from pydantic import BaseModel, Field, field_validator

from app.schemas.recruiteone.evaluation import Recommendation
from app.schemas.recruiteone.jd import Buckets, Level, Weights

BenchmarkKey = Literal[
    "technical_skills",
    "soft_skills",
    "experience",
    "responsibilities",
    "education",
    "certifications",
    "job_requirements",
    "extra_curricular",
]

BENCHMARK_LABELS: dict[str, str] = {
    "technical_skills": "Technical skills",
    "soft_skills": "Soft skills",
    "experience": "Experience",
    "responsibilities": "Responsibilities",
    "education": "Education",
    "certifications": "Certifications",
    "job_requirements": "Job requirements",
    "extra_curricular": "Extra-curricular",
}


class JdForScoring(BaseModel):
    name: str
    role: str
    sector: str
    level: Level
    buckets: Buckets
    weights: Weights = Field(default_factory=Weights)


class BenchmarkLlmResult(BaseModel):
    key: BenchmarkKey
    score: int
    reasoning: str

    @field_validator("score")
    @classmethod
    def clamp_score(cls, value: int) -> int:
        return max(0, min(100, value))


class CvScoringLlmOutput(BaseModel):
    benchmarks: list[BenchmarkLlmResult]
    summary: str


class BenchmarkScore(BaseModel):
    key: BenchmarkKey
    label: str
    score: int
    weight: int
    applicable: bool
    reasoning: str


class CvScore(BaseModel):
    overall_score: int
    recommendation: Recommendation
    summary: str
    benchmarks: list[BenchmarkScore]
