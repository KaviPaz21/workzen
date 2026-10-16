import os
import shutil
import subprocess
import sys
import time
from dataclasses import dataclass
from pathlib import Path

APP_FOLDER = "WorkZen Co-worker"
EXE_NAME = "WorkZenCoworker.exe"
STARTUP_NAME = "WorkZenCoworker"
RUN_KEY = r"Software\Microsoft\Windows\CurrentVersion\Run"
NO_WINDOW = 0x08000000
COPY_ATTEMPTS = 8
COPY_WAIT_SECONDS = 0.5


class WindowsStartup:
    def enable(self, command: str) -> None:
        import winreg

        with winreg.CreateKey(winreg.HKEY_CURRENT_USER, RUN_KEY) as key:
            winreg.SetValueEx(key, STARTUP_NAME, 0, winreg.REG_SZ, command)

    def disable(self) -> None:
        import winreg

        try:
            with winreg.OpenKey(winreg.HKEY_CURRENT_USER, RUN_KEY, 0, winreg.KEY_SET_VALUE) as key:
                winreg.DeleteValue(key, STARTUP_NAME)
        except FileNotFoundError:
            return

    def enabled(self) -> bool:
        import winreg

        try:
            with winreg.OpenKey(winreg.HKEY_CURRENT_USER, RUN_KEY) as key:
                winreg.QueryValueEx(key, STARTUP_NAME)
            return True
        except FileNotFoundError:
            return False


def default_install_dir() -> Path:
    base = os.environ.get("LOCALAPPDATA")
    return (Path(base) if base else Path.home() / "AppData" / "Local") / APP_FOLDER


def start_menu_shortcut() -> Path:
    base = os.environ.get("APPDATA")
    root = Path(base) if base else Path.home() / "AppData" / "Roaming"
    return root / "Microsoft" / "Windows" / "Start Menu" / "Programs" / f"{APP_FOLDER}.lnk"


def create_shortcut(target: Path) -> None:
    link = start_menu_shortcut()
    link.parent.mkdir(parents=True, exist_ok=True)
    script = (
        "$shell = New-Object -ComObject WScript.Shell; "
        f"$shortcut = $shell.CreateShortcut('{link}'); "
        f"$shortcut.TargetPath = '{target}'; "
        f"$shortcut.WorkingDirectory = '{target.parent}'; "
        "$shortcut.Save()"
    )
    subprocess.run(["powershell", "-NoProfile", "-WindowStyle", "Hidden", "-Command", script], creationflags=NO_WINDOW, check=False, timeout=30)


@dataclass
class Installer:
    install_dir: Path
    startup: object
    shortcuts: bool = True

    @property
    def installed_exe(self) -> Path:
        return self.install_dir / EXE_NAME

    def running_from_install(self, current: Path) -> bool:
        return current.resolve().parent == self.install_dir.resolve()

    def install(self, source: Path) -> Path:
        self.install_dir.mkdir(parents=True, exist_ok=True)
        target = self.installed_exe
        if source.resolve() != target.resolve():
            copy_with_retries(source, target)
        self.startup.enable(f'"{target}"')
        if self.shortcuts:
            create_shortcut(target)
        return target

    def uninstall(self) -> None:
        self.startup.disable()
        if self.shortcuts:
            start_menu_shortcut().unlink(missing_ok=True)

    def schedule_folder_removal(self, extra_folders: list[Path]) -> None:
        folders = [self.install_dir, *extra_folders]
        removals = " & ".join(f'rmdir /s /q "{folder}"' for folder in folders)
        subprocess.Popen(
            ["cmd", "/c", f"ping 127.0.0.1 -n 4 >nul & {removals}"],
            creationflags=NO_WINDOW,
            close_fds=True,
        )


def copy_with_retries(source: Path, target: Path) -> None:
    for attempt in range(COPY_ATTEMPTS):
        try:
            shutil.copy2(source, target)
            return
        except PermissionError:
            if attempt == COPY_ATTEMPTS - 1:
                raise
            time.sleep(COPY_WAIT_SECONDS)


def stop_server_on_port(port: int) -> None:
    script = (
        f"Get-NetTCPConnection -LocalPort {port} -State Listen -ErrorAction SilentlyContinue | "
        "ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }"
    )
    subprocess.run(["powershell", "-NoProfile", "-WindowStyle", "Hidden", "-Command", script], creationflags=NO_WINDOW, check=False, timeout=30)


def version_parts(version: str) -> tuple[int, ...]:
    try:
        return tuple(int(part) for part in version.split("."))
    except ValueError:
        return (0,)


def is_older(running: str, mine: str) -> bool:
    return version_parts(running) < version_parts(mine)


def current_executable() -> Path:
    return Path(sys.executable)
