import asyncio
import json
import os
import subprocess
import threading
import time
import urllib.request

import uvicorn
from PIL import Image, ImageDraw

from pathlib import Path

from app import dialogs
from app.actions.paths import workspace_folder
from app.config import Settings, frozen_app
from app.installer import NO_WINDOW, Installer, WindowsStartup, current_executable, default_install_dir, is_older, stop_server_on_port
from app.main import APP_NAME, APP_VERSION, create_app, reset_pairing

DETACHED = 0x00000008
STOP_WAIT_ATTEMPTS = 20
RESET_TIMEOUT_SECONDS = 15

INSTALL_QUESTION = (
    "Install WorkZen Co-worker on this computer?\n\n"
    "It lets the WorkZen AI Assistant do small tasks for you, such as opening web pages and creating Word documents. "
    "It always asks before doing anything, and it only talks to WorkZen on this computer.\n\n"
    "It will start automatically when you sign in, with a small icon near the clock."
)
INSTALLED_MESSAGE = "WorkZen Co-worker is installed and running.\n\nGo back to WorkZen and press Connect."
UPDATE_QUESTION = (
    "A newer version of WorkZen Co-worker is available.\n\n"
    "Update now? The old version will close and the new one will start by itself. Your documents are kept."
)
UPDATED_MESSAGE = "WorkZen Co-worker is updated and running.\n\nGo back to WorkZen and press Connect if it asks."
RUNNING_MESSAGE = "WorkZen Co-worker is already running. Look for its icon near the clock, then go back to WorkZen."
UNINSTALL_QUESTION = "Remove WorkZen Co-worker from this computer?\n\nYour documents in the Co-worker folder are kept."


def running_version(settings: Settings) -> str | None:
    try:
        with urllib.request.urlopen(f"http://{settings.coworker_host}:{settings.coworker_port}/ping", timeout=1.5) as response:
            data = json.load(response)
    except Exception:
        return None
    if data.get("name") != APP_NAME:
        return None
    return str(data.get("version") or "0")


def stop_running_copy(settings: Settings) -> None:
    if running_version(settings) is None:
        return
    stop_server_on_port(settings.coworker_port)
    for attempt in range(STOP_WAIT_ATTEMPTS):
        if running_version(settings) is None:
            return
        time.sleep(0.5)


def replace_running_copy(settings: Settings, installer: Installer, source: Path) -> None:
    stop_running_copy(settings)
    target = installer.install(source)
    subprocess.Popen([str(target)], creationflags=DETACHED | NO_WINDOW, close_fds=True)


def draw_icon() -> Image.Image:
    image = Image.new("RGBA", (64, 64), (0, 0, 0, 0))
    canvas = ImageDraw.Draw(image)
    canvas.rounded_rectangle((4, 4, 60, 60), radius=16, fill=(12, 12, 18, 255))
    canvas.ellipse((20, 18, 44, 42), outline=(255, 255, 255, 255), width=4)
    canvas.rectangle((28, 40, 36, 50), fill=(255, 255, 255, 255))
    return image


def serve_in_background(settings: Settings):
    app = create_app(settings)
    config = uvicorn.Config(app, host=settings.coworker_host, port=settings.coworker_port, log_config=None)
    server = uvicorn.Server(config)
    threading.Thread(target=server.run, daemon=True).start()
    return app, server


def run_tray(settings: Settings, installer: Installer) -> None:
    import pystray

    app, server = serve_in_background(settings)

    def open_folder(icon, item) -> None:
        os.startfile(workspace_folder(settings))

    def toggle_startup(icon, item) -> None:
        if installer.startup.enabled():
            installer.startup.disable()
        else:
            installer.startup.enable(f'"{current_executable()}"')

    def disconnect(icon, item) -> None:
        loop = getattr(app.state, "loop", None)
        if loop is not None:
            asyncio.run_coroutine_threadsafe(reset_pairing(app), loop).result(RESET_TIMEOUT_SECONDS)
        dialogs.tell("WorkZen is disconnected. Press Connect in WorkZen to allow it again.")

    def quit_app(icon, item) -> None:
        server.should_exit = True
        icon.stop()

    def uninstall(icon, item) -> None:
        if not dialogs.ask(UNINSTALL_QUESTION):
            return
        installer.uninstall()
        installer.schedule_folder_removal([settings.token_file.parent])
        quit_app(icon, item)

    menu = pystray.Menu(
        pystray.MenuItem("WorkZen Co-worker is running", None, enabled=False),
        pystray.MenuItem("Open the Co-worker folder", open_folder),
        pystray.MenuItem("Start when I sign in", toggle_startup, checked=lambda item: installer.startup.enabled()),
        pystray.MenuItem("Disconnect WorkZen", disconnect),
        pystray.Menu.SEPARATOR,
        pystray.MenuItem("Uninstall", uninstall),
        pystray.MenuItem("Quit", quit_app),
    )
    pystray.Icon("WorkZenCoworker", draw_icon(), "WorkZen Co-worker", menu).run()


def run_desktop(settings: Settings) -> None:
    installer = Installer(default_install_dir(), WindowsStartup())
    current = current_executable()
    running = running_version(settings)
    if running is not None:
        if frozen_app() and is_older(running, APP_VERSION):
            if dialogs.ask(UPDATE_QUESTION, default_no=False):
                replace_running_copy(settings, installer, current)
                dialogs.tell(UPDATED_MESSAGE)
            return
        dialogs.tell(RUNNING_MESSAGE)
        return
    if frozen_app() and not installer.running_from_install(current):
        if dialogs.ask(INSTALL_QUESTION, default_no=False):
            target = installer.install(current)
            subprocess.Popen([str(target)], creationflags=DETACHED | NO_WINDOW, close_fds=True)
            dialogs.tell(INSTALLED_MESSAGE)
        return
    run_tray(settings, installer)


def install_silently(settings: Settings) -> None:
    installer = Installer(default_install_dir(), WindowsStartup())
    replace_running_copy(settings, installer, current_executable())


def uninstall_silently(settings: Settings) -> None:
    installer = Installer(default_install_dir(), WindowsStartup())
    installer.uninstall()
    installer.schedule_folder_removal([settings.token_file.parent])