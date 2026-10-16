import argparse
import sys
import traceback

import uvicorn

from app import dialogs
from app.config import Settings, frozen_app, get_settings
from app.installer import default_install_dir
from app.main import create_app

ERROR_MESSAGE = "WorkZen Co-worker could not start.\n\nThe details were saved in:\n{path}\n\nPlease send that file to your WorkZen administrator."


def write_error_log() -> str:
    folder = default_install_dir()
    folder.mkdir(parents=True, exist_ok=True)
    path = folder / "last-error.log"
    path.write_text(traceback.format_exc(), encoding="utf-8")
    return str(path)


def serve_in_terminal(settings: Settings) -> None:
    app = create_app(settings)
    print("")
    print("WorkZen Co-worker is running (terminal mode)")
    print(f"  Address:    http://{settings.coworker_host}:{settings.coworker_port}")
    print(f"  Workspace:  {settings.workspace}")
    print("In WorkZen, press Connect and allow the question that appears on this computer. Press Ctrl+C to stop.")
    print("")
    quiet = sys.stdout is None
    uvicorn.run(app, host=settings.coworker_host, port=settings.coworker_port, log_level="warning", log_config=None if quiet else uvicorn.config.LOGGING_CONFIG)


def run(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(prog="WorkZen Co-worker")
    parser.add_argument("--serve", action="store_true", help="run in a terminal without the installer or tray icon")
    parser.add_argument("--tray", action="store_true", help="run with the tray icon when not packaged")
    parser.add_argument("--install", action="store_true", help="install for the signed-in user without any questions, then start (for IT deployment)")
    parser.add_argument("--uninstall", action="store_true", help="remove the installed copy without any questions (for IT deployment)")
    args = parser.parse_args(argv)
    settings = get_settings()
    if args.install or args.uninstall:
        from app.desktop import install_silently, uninstall_silently

        if args.install:
            install_silently(settings)
        else:
            uninstall_silently(settings)
        return
    if args.serve or (not frozen_app() and not args.tray):
        serve_in_terminal(settings)
        return
    from app.desktop import run_desktop

    run_desktop(settings)


def main(argv: list[str] | None = None) -> None:
    try:
        run(argv)
    except SystemExit:
        raise
    except Exception:
        path = write_error_log()
        dialogs.tell(ERROR_MESSAGE.format(path=path))
