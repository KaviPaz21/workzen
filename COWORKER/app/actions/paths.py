import re
from pathlib import Path

from app.actions.errors import ActionError
from app.config import Settings

INVALID_NAME = re.compile(r'[\\/:*?"<>|\x00-\x1f]')
MAX_NAME_LENGTH = 120


def workspace_folder(settings: Settings) -> Path:
    folder = settings.workspace
    folder.mkdir(parents=True, exist_ok=True)
    return folder


def clean_filename(filename: str) -> str:
    name = filename.strip()
    if not name or name in (".", "..") or INVALID_NAME.search(name):
        raise ActionError("The file name is not allowed. Use a plain name without folders.")
    if len(name) > MAX_NAME_LENGTH:
        raise ActionError("The file name is too long.")
    return name


def resolve_in_workspace(settings: Settings, filename: str) -> Path:
    folder = workspace_folder(settings).resolve()
    target = (folder / clean_filename(filename)).resolve()
    if target.parent != folder:
        raise ActionError("Files can only be used inside the Co-worker workspace folder.")
    return target


def free_path(target: Path) -> Path:
    if not target.exists():
        return target
    for number in range(2, 1000):
        candidate = target.with_name(f"{target.stem} ({number}){target.suffix}")
        if not candidate.exists():
            return candidate
    raise ActionError("Too many files with that name already exist.")
