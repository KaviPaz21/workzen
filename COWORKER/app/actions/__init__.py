from collections.abc import Awaitable, Callable

from app.actions.browser import BrowserController
from app.actions.documents import create_word_document
from app.actions.files import list_files, read_text_file, write_text_file
from app.actions.system import open_file, open_in_default_browser
from app.config import Settings

ActionHandler = Callable[[dict], Awaitable[dict]]


def build_actions(settings: Settings, browser: BrowserController) -> dict[str, ActionHandler]:
    async def default_browser(args: dict) -> dict:
        return await open_in_default_browser(settings, args)

    async def open_workspace_file(args: dict) -> dict:
        return await open_file(settings, args)

    async def word_document(args: dict) -> dict:
        return await create_word_document(settings, args)

    async def write_text(args: dict) -> dict:
        return await write_text_file(settings, args)

    async def read_text(args: dict) -> dict:
        return await read_text_file(settings, args)

    async def list_workspace(args: dict) -> dict:
        return await list_files(settings, args)

    return {
        "open_in_default_browser": default_browser,
        "open_file": open_workspace_file,
        "create_word_document": word_document,
        "write_text_file": write_text,
        "read_text_file": read_text,
        "list_files": list_workspace,
        "browser_open": browser.open_page,
        "browser_read": browser.read_page,
        "browser_click": browser.click,
        "browser_type": browser.type_text,
        "browser_press": browser.press_key,
        "browser_close": browser.close_browser,
    }
