import os
import subprocess
import sys
import webbrowser
from urllib.parse import urlparse

from pydantic import BaseModel

from app.actions.errors import ActionError
from app.actions.paths import resolve_in_workspace
from app.config import Settings


class UrlArgs(BaseModel):
    url: str


class FileArgs(BaseModel):
    filename: str


def checked_web_address(url: str) -> str:
    parsed = urlparse(url.strip())
    if parsed.scheme not in ("http", "https") or not parsed.netloc:
        raise ActionError("Only http and https web addresses can be opened.")
    return parsed.geturl()


def launch(path: str) -> None:
    if sys.platform.startswith("win"):
        os.startfile(path)
    elif sys.platform == "darwin":
        subprocess.Popen(["open", path])
    else:
        subprocess.Popen(["xdg-open", path])


async def open_in_default_browser(settings: Settings, args: dict) -> dict:
    parsed = UrlArgs(**args)
    url = checked_web_address(parsed.url)
    if not settings.coworker_launch_apps:
        return {"url": url, "opened": False, "note": "Opening apps is switched off on this computer."}
    webbrowser.open(url)
    return {"url": url, "opened": True}


async def open_file(settings: Settings, args: dict) -> dict:
    parsed = FileArgs(**args)
    target = resolve_in_workspace(settings, parsed.filename)
    if not target.exists():
        raise ActionError(f"{target.name} does not exist in the workspace folder.")
    if not settings.coworker_launch_apps:
        return {"path": str(target), "opened": False, "note": "Opening apps is switched off on this computer."}
    launch(str(target))
    return {"path": str(target), "opened": True}
