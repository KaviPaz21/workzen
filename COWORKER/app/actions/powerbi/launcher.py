import os
import subprocess
from pathlib import Path

from pydantic import BaseModel

from app.actions.errors import ActionError
from app.actions.powerbi.project import project_folder, stored_spec
from app.config import Settings
from app.installer import NO_WINDOW

DESKTOP_PATHS = (
    "{ProgramFiles}\\Microsoft Power BI Desktop\\bin\\PBIDesktop.exe",
    "{ProgramFiles(x86)}\\Microsoft Power BI Desktop\\bin\\PBIDesktop.exe",
)
START_APP_SCRIPT = "(Get-StartApps -Name 'Power BI Desktop' | Select-Object -First 1).AppID"


class OpenArgs(BaseModel):
    project: str = ""


def installed_desktop() -> Path | None:
    for pattern in DESKTOP_PATHS:
        candidate = Path(pattern.format_map({"ProgramFiles": os.environ.get("ProgramFiles", ""), "ProgramFiles(x86)": os.environ.get("ProgramFiles(x86)", "")}))
        if candidate.is_file():
            return candidate
    return None


def store_app_id() -> str | None:
    result = subprocess.run(["powershell", "-NoProfile", "-Command", START_APP_SCRIPT], capture_output=True, text=True, timeout=30, creationflags=NO_WINDOW, check=False)
    app_id = result.stdout.strip()
    return app_id or None


def start_desktop(target: Path | None) -> str:
    exe = installed_desktop()
    if exe is not None:
        subprocess.Popen([str(exe), *([str(target)] if target else [])], creationflags=NO_WINDOW, close_fds=True)
        return "Power BI Desktop (installed program)"
    app_id = store_app_id()
    if app_id is None:
        raise ActionError("Power BI Desktop is not installed on this computer. Install it from the Microsoft Store or from the Power BI website, then try again.")
    if target is not None:
        os.startfile(str(target))
    else:
        subprocess.Popen(["explorer.exe", f"shell:AppsFolder\\{app_id}"], creationflags=NO_WINDOW, close_fds=True)
    return "Power BI Desktop (Microsoft Store app)"


async def open_powerbi(settings: Settings, args: dict) -> dict:
    parsed = OpenArgs(**args)
    if not settings.coworker_launch_apps:
        raise ActionError("Opening apps is switched off on this computer.")
    target = None
    if parsed.project:
        folder = project_folder(settings, parsed.project)
        target = folder / f"{stored_spec(folder).name}.pbip"
    how = start_desktop(target)
    return {"opened": True, "how": how, "path": str(target) if target else ""}