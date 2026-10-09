from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

CandidateStatus = Literal["new", "shortlisted", "rejected"]


class CandidateUpdate(BaseModel):
    full_name: str | None = None
    email: str | None = None
    phone: str | None = None
    current_title: str | None = None
    skills: list[str] | None = None
    status: CandidateStatus | None = None


class CandidateRead(BaseModel):
    id: str
    full_name: str
    email: str = ""
    phone: str = ""
    current_title: str = ""
    skills: list[str] = Field(default_factory=list)
    file_name: str
    blob_name: str
    status: CandidateStatus = "new"
    created_at: datetime
    updated_at: datetime
