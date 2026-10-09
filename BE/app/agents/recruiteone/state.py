from typing import TypedDict

from pydantic import BaseModel

from app.schemas.recruiteone.evaluation import MatchResult, QualityScores


class JobRequirements(BaseModel):
    must_have_skills: list[str]
    nice_to_have_skills: list[str]
    minimum_years_experience: int
    education_level: str


class CandidateProfile(BaseModel):
    skills: list[str]
    years_experience: int
    highest_education: str
    key_achievements: list[str]


class EvaluationState(TypedDict, total=False):
    jd_text: str
    cv_text: str
    requirements: JobRequirements
    profile: CandidateProfile
    match: MatchResult
    quality: QualityScores
