from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

Level = Literal["entry", "junior", "mid", "senior", "executive"]
JdStatus = Literal["active", "deleted"]


class Buckets(BaseModel):
    technical_skills: list[str] = Field(default_factory=list)
    soft_skills: list[str] = Field(default_factory=list)
    experience: list[str] = Field(default_factory=list)
    responsibilities: list[str] = Field(default_factory=list)
    education: list[str] = Field(default_factory=list)
    certifications: list[str] = Field(default_factory=list)
    job_requirements: list[str] = Field(default_factory=list)
    extra_curricular: list[str] = Field(default_factory=list)


class Weights(BaseModel):
    technical_skills: int = Field(default=50, ge=0, le=100)
    soft_skills: int = Field(default=50, ge=0, le=100)
    experience: int = Field(default=50, ge=0, le=100)
    responsibilities: int = Field(default=50, ge=0, le=100)
    education: int = Field(default=50, ge=0, le=100)
    certifications: int = Field(default=50, ge=0, le=100)
    job_requirements: int = Field(default=50, ge=0, le=100)
    extra_curricular: int = Field(default=50, ge=0, le=100)


class JdDecomposeRequest(BaseModel):
    name: str
    text: str = Field(min_length=1)


class JdDecomposition(BaseModel):
    role: str
    sector: str
    level: Level
    buckets: Buckets


class JdCreate(BaseModel):
    name: str
    role: str
    sector: str
    level: Level
    raw_text: str = ""
    buckets: Buckets = Field(default_factory=Buckets)
    weights: Weights = Field(default_factory=Weights)
    status: JdStatus = "active"


class JdUpdate(BaseModel):
    name: str | None = None
    role: str | None = None
    sector: str | None = None
    level: Level | None = None
    raw_text: str | None = None
    buckets: Buckets | None = None
    weights: Weights | None = None
    status: JdStatus | None = None


class JdRead(JdCreate):
    id: str
    created_at: datetime
    updated_at: datetime
