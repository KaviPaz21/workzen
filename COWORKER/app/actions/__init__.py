from collections.abc import Awaitable, Callable

from app.actions.browser import BrowserController
from app.actions.database import DatabaseManager
from app.actions.documents import create_word_document
from app.actions.files import list_files, read_text_file, write_text_file
from app.actions.powerbi.launcher import open_powerbi
from app.actions.powerbi.project import create_project, read_spec, update_project, validate_model
from app.actions.mail import draft_email
from app.actions.spreadsheets import create_excel_document, update_excel_document
from app.actions.system import open_file, open_in_default_browser
from app.config import Settings

ActionHandler = Callable[[dict], Awaitable[dict]]


def build_actions(settings: Settings, browser: BrowserController, databases: DatabaseManager) -> dict[str, ActionHandler]:
    async def default_browser(args: dict) -> dict:
        return await open_in_default_browser(settings, args)

    async def open_workspace_file(args: dict) -> dict:
        return await open_file(settings, args)

    async def word_document(args: dict) -> dict:
        return await create_word_document(settings, args)

    async def excel_document(args: dict) -> dict:
        return await create_excel_document(settings, args)

    async def excel_update(args: dict) -> dict:
        return await update_excel_document(settings, args)

    async def email_draft(args: dict) -> dict:
        return await draft_email(settings, args)

    async def write_text(args: dict) -> dict:
        return await write_text_file(settings, args)

    async def read_text(args: dict) -> dict:
        return await read_text_file(settings, args)

    async def list_workspace(args: dict) -> dict:
        return await list_files(settings, args)

    async def validate_powerbi(args: dict) -> dict:
        return await validate_model(settings, args)

    async def create_powerbi(args: dict) -> dict:
        return await create_project(settings, args)

    async def update_powerbi(args: dict) -> dict:
        return await update_project(settings, args)

    async def read_powerbi(args: dict) -> dict:
        return await read_spec(settings, args)

    async def open_in_powerbi(args: dict) -> dict:
        return await open_powerbi(settings, args)

    return {
        "open_in_default_browser": default_browser,
        "open_file": open_workspace_file,
        "create_word_document": word_document,
        "create_excel_document": excel_document,
        "update_excel_document": excel_update,
        "draft_email": email_draft,
        "write_text_file": write_text,
        "read_text_file": read_text,
        "list_files": list_workspace,
        "db_connect": databases.connect,
        "db_schema": databases.schema,
        "db_query": databases.query,
        "db_disconnect": databases.disconnect,
        "powerbi_validate_model": validate_powerbi,
        "powerbi_create_project": create_powerbi,
        "powerbi_update_project": update_powerbi,
        "powerbi_read_spec": read_powerbi,
        "powerbi_open": open_in_powerbi,
        "browser_open": browser.open_page,
        "browser_read": browser.read_page,
        "browser_inspect": browser.inspect,
        "browser_click": browser.click,
        "browser_hover": browser.hover,
        "browser_type": browser.type_text,
        "browser_select": browser.select_option,
        "browser_press": browser.press_key,
        "browser_scroll": browser.scroll,
        "browser_wait": browser.wait,
        "browser_expect": browser.expect,
        "browser_issues": browser.read_issues,
        "browser_close": browser.close_browser,
    }
