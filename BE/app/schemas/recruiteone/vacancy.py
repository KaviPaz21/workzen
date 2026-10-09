from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field

EmploymentType = Literal["full_time", "part_time", "contract", "internship"]
VacancyStatus = Literal["draft", "open", "on_hold", "closed"]


class PipelineStage(BaseModel):
    id: str
    name: str = Field(min_length=1)
    max_candidates: int = Field(default=10, ge=1)
    interviewer_ids: list[str] = Field(default_factory=list)
    scheduled_date: date | None = None


class Pipeline(BaseModel):
    name: str = Field(min_length=1)
    description: str = ""
    stages: list[PipelineStage] = Field(min_length=1)


class VacancyCreate(BaseModel):
    title: str
    jd_id: str
    department: str = ""
    location: str = ""
    employment_type: EmploymentType = "full_time"
    openings: int = Field(default=1, ge=1)
    closing_date: date | None = None
    status: VacancyStatus = "open"
    shareable: bool = False
    pipeline: Pipeline | None = None


class VacancyUpdate(BaseModel):
    title: str | None = None
    jd_id: str | None = None
    department: str | None = None
    location: str | None = None
    employment_type: EmploymentType | None = None
    openings: int | None = Field(default=None, ge=1)
    closing_date: date | None = None
    status: VacancyStatus | None = None
    pipeline: Pipeline | None = None


class VacancyRead(BaseModel):
    id: str
    title: str
    jd_id: str
    department: str = ""
    location: str = ""
    employment_type: EmploymentType = "full_time"
    openings: int = 1
    closing_date: date | None = None
    status: VacancyStatus = "open"
    share_token: str | None = None
    pipeline: Pipeline | None = None
    collection_closed_at: date | None = None
    created_at: datetime
    updated_at: datetime
