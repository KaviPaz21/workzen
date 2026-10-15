from typing import Literal

from pydantic import BaseModel, Field

from app.actions.errors import ActionError
from app.actions.paths import free_path, resolve_in_workspace, workspace_folder
from app.config import Settings

TEXT_EXTENSIONS = (".txt", ".md", ".csv", ".json", ".html")
MAX_WRITE_CHARACTERS = 200_000
MAX_READ_CHARACTERS = 20_000


class WriteArgs(BaseModel):
    filename: str
    content: str = Field(max_length=MAX_WRITE_CHARACTERS)


class ReadArgs(BaseModel):
    filename: str


class ListArgs(BaseModel):
    kind: Literal["all"] = "all"


def require_text_name(filename: str) -> None:
    if not filename.lower().endswith(TEXT_EXTENSIONS):
        raise ActionError(f"Only {', '.join(TEXT_EXTENSIONS)} files can be handled as text.")


async def write_text_file(settings: Settings, args: dict) -> dict:
    parsed = WriteArgs(**args)
    require_text_name(parsed.filename)
    target = free_path(resolve_in_workspace(settings, parsed.filename))
    target.write_text(parsed.content, encoding="utf-8")
    return {"path": str(target), "filename": target.name, "characters": len(parsed.content)}


async def read_text_file(settings: Settings, args: dict) -> dict:
    parsed = ReadArgs(**args)
    require_text_name(parsed.filename)
    target = resolve_in_workspace(settings, parsed.filename)
    if not target.exists():
        raise ActionError(f"{target.name} does not exist in the workspace folder.")
    text = target.read_text(encoding="utf-8", errors="replace")
    return {"filename": target.name, "text": text[:MAX_READ_CHARACTERS], "truncated": len(text) > MAX_READ_CHARACTERS}


async def list_files(settings: Settings, args: dict) -> dict:
    ListArgs(**args)
    folder = workspace_folder(settings)
    files = sorted((item for item in folder.iterdir() if item.is_file()), key=lambda item: item.stat().st_mtime, reverse=True)
    return {"folder": str(folder), "files": [{"name": item.name, "bytes": item.stat().st_size} for item in files[:100]]}
