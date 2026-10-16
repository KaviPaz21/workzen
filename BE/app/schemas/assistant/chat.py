from typing import Literal

from pydantic import BaseModel, Field

ChatMode = Literal["gpt", "kb"]
Effort = Literal["low", "medium", "high"]
Role = Literal["user", "assistant"]

EFFORTS: list[str] = ["low", "medium", "high"]
DEFAULT_EFFORT: Effort = "medium"


class Source(BaseModel):
    name: str
    excerpt: str


class ActionRecord(BaseModel):
    id: str
    tool: str
    summary: str
    status: Literal["done", "failed", "denied"]
    detail: str = ""


class ChatMessage(BaseModel):
    id: str
    role: Role
    content: str
    created_at: str
    sources: list[Source] = Field(default_factory=list)
    actions: list[ActionRecord] = Field(default_factory=list)
    mode: ChatMode | None = None
    model: str | None = None
    effort: Effort | None = None


class ChatSession(BaseModel):
    id: str
    title: str
    messages: list[ChatMessage]
    created_at: str
    updated_at: str


class SessionSummary(BaseModel):
    id: str
    title: str
    updated_at: str
    message_count: int


class ChatRequest(BaseModel):
    session_id: str | None = None
    message: str = Field(min_length=1, max_length=8000)
    mode: ChatMode = "gpt"
    model: str = Field(min_length=1, max_length=120)
    effort: Effort = DEFAULT_EFFORT
    coworker: bool = False
    skill: Literal["testing", "drafting", "bi"] | None = None


class ActionResult(BaseModel):
    ok: bool
    result: dict | None = None
    error: str | None = None
    denied: bool = False


class SkillOption(BaseModel):
    id: str
    label: str
    hint: str = ""


class SkillInfo(BaseModel):
    id: str
    label: str
    summary: str
    detail: str = ""
    examples: list[str] = Field(default_factory=list)
    options: list[SkillOption] = Field(default_factory=list)


class ModeStatus(BaseModel):
    id: ChatMode
    label: str
    ready: bool
    detail: str


class AssistantOptions(BaseModel):
    models: list[str]
    default_model: str | None
    efforts: list[str]
    default_effort: Effort
    modes: list[ModeStatus]
    coworker_download_url: str | None = None
    coworker_actions: list[str] = Field(default_factory=list)
    coworker_skills: list[SkillInfo] = Field(default_factory=list)
