from collections.abc import Callable
from dataclasses import dataclass
from typing import Literal

from langchain_core.tools import StructuredTool
from pydantic import BaseModel, Field

from app.agents.assistant.coworker_models import Cell, PowerBiSpec
from app.agents.assistant.coworker_safety import wants_create, wants_delete

Effect = Literal["none", "creates", "deletes"]
EFFECT_HELP = "What this step will do to the data in the page: none for looking, searching, navigating, filtering or opening; creates if it adds, saves, sends, submits or uploads something; deletes if it removes something (deleting is never allowed)"


class UrlArgs(BaseModel):
    url: str = Field(description="A full http or https web address")


class EmptyArgs(BaseModel):
    pass


class ClickArgs(BaseModel):
    target: str = Field(description="What to click: an element reference such as e12 from browser_inspect, the visible text or accessible name of a button, link, checkbox or tab, or a CSS selector")
    effect: Effect = Field(default="none", description=EFFECT_HELP)
    label: str = Field(default="", description="A few plain words naming the element for the user, for example Save contact button or Email field. Always give this when the target is a reference such as e12")


class HoverArgs(BaseModel):
    target: str = Field(description="An element reference such as e12 from browser_inspect, visible text, or a CSS selector")
    label: str = Field(default="", description="A few plain words naming the element for the user, for example Save contact button or Email field. Always give this when the target is a reference such as e12")


class TypeArgs(BaseModel):
    target: str = Field(description="An element reference such as e12 from browser_inspect, the label, placeholder or name of the input, or a CSS selector")
    text: str = Field(description="The text to type")
    submit: bool = Field(default=False, description="Press Enter after typing")
    effect: Effect = Field(default="none", description=EFFECT_HELP)
    label: str = Field(default="", description="A few plain words naming the element for the user, for example Save contact button or Email field. Always give this when the target is a reference such as e12")


class SelectArgs(BaseModel):
    target: str = Field(description="An element reference such as e12 from browser_inspect, or the label or name of the dropdown")
    option: str = Field(description="The visible text (or value) of the option to choose")
    label: str = Field(default="", description="A few plain words naming the element for the user, for example Save contact button or Email field. Always give this when the target is a reference such as e12")


class KeyArgs(BaseModel):
    key: str = Field(description="A key name such as Enter, Tab, Escape, PageDown or ArrowDown")
    effect: Effect = Field(default="none", description=EFFECT_HELP)


class InspectArgs(BaseModel):
    filter: Literal["all", "inputs", "buttons", "links"] = Field(default="all", description="Which elements to list")


class ScrollArgs(BaseModel):
    direction: Literal["down", "up", "top", "bottom"] = "down"
    amount: int = Field(default=600, description="Pixels to scroll for down or up")


class WaitArgs(BaseModel):
    text: str = Field(default="", description="Wait until this text is visible on the page. Leave empty to just pause or to settle")
    seconds: float = Field(default=2, description="How long to wait at most, up to 30 seconds")
    settle: bool = Field(default=False, description="Wait until the page stops changing, for example while a chatbot is still writing its answer. Use this after sending a chat message, then read the page")


class Check(BaseModel):
    kind: Literal["text_visible", "text_absent", "url_contains", "title_contains", "element_visible", "element_absent", "value_equals"]
    value: str = Field(default="", description="The text, URL part, title part or expected input value")
    target: str = Field(default="", description="The element to look at, for element_visible, element_absent and value_equals")


class ExpectArgs(BaseModel):
    checks: list[Check] = Field(description="The things that should be true on the page right now")


class FilenameArgs(BaseModel):
    filename: str = Field(description="A plain file name inside the workspace folder, without folders")


class WordBlock(BaseModel):
    type: Literal["heading", "paragraph", "bullet", "numbered", "table"] = "paragraph"
    text: str = Field(default="", description="The text of a heading, paragraph or list item")
    rows: list[list[str]] = Field(default_factory=list, description="For a table block: rows of cells, the first row is the header, every row has the same number of cells")


class WordArgs(BaseModel):
    filename: str = Field(description="The document name, for example Thank you letter.docx")
    title: str = Field(default="", description="An optional title shown at the top")
    blocks: list[WordBlock] = Field(description="The document content in order, one block per paragraph, heading or list item")
    open_after: bool = Field(default=True, description="Open the finished document in Word for the user")


class SheetArgs(BaseModel):
    name: str = Field(default="Test cases", description="The sheet name, up to 31 characters")
    columns: list[str] = Field(description="The column headings")
    rows: list[list[Cell]] = Field(description="One list of cell values per row, in the same order as the columns")
    allow_formulas: bool = Field(default=False, description="Treat text starting with = as an Excel formula (SUM, AVERAGE, IF and so on, same-sheet references only). Otherwise it stays plain text")
    number_formats: dict[str, str] = Field(default_factory=dict, description="Optional Excel number format per column heading, for example {\"Cost\": \"#,##0.00\", \"Date\": \"yyyy-mm-dd\"}")


class ExcelArgs(BaseModel):
    filename: str = Field(description="The workbook name, for example Chatbot test cases.xlsx")
    sheets: list[SheetArgs] = Field(description="One or more sheets")
    open_after: bool = Field(default=False, description="Open the finished workbook in Excel for the user")


class UpdateItem(BaseModel):
    sheet: str
    match_column: str = Field(description="The heading of the column that identifies the row, for example Test ID")
    match_value: str | int | float
    set: dict[str, Cell] = Field(description="Column heading to new value")


class AppendItem(BaseModel):
    sheet: str
    rows: list[list[Cell]]


class UpdateExcelArgs(BaseModel):
    filename: str = Field(description="A workbook that already exists in the workspace folder, for example the one you created earlier")
    updates: list[UpdateItem] = Field(default_factory=list, description="Change cells in rows found by a key column")
    append_rows: list[AppendItem] = Field(default_factory=list)
    add_sheets: list[SheetArgs] = Field(default_factory=list, description="New sheets to add inside the same workbook, for example a Summary")
    allow_formulas: bool = False


class MailArgs(BaseModel):
    to: list[str] = Field(default_factory=list, description="Recipient email addresses, leave empty if unknown")
    cc: list[str] = Field(default_factory=list)
    subject: str
    body: str = Field(description="The complete email text with greeting and closing, plain text with line breaks")


class ConnectArgs(BaseModel):
    name: str = Field(description="A short name for this connection, letters digits dashes underscores")
    kind: Literal["sqlite", "sql_server"] = Field(description="sqlite for a local database file; sql_server for SQL Server or Azure SQL")
    path: str = Field(default="", description="For sqlite: the full path of the database file")
    server: str = Field(default="", description="For sql_server: the server name, for example sql01.contoso.com or myserver.database.windows.net")
    database: str = Field(default="", description="For sql_server: the database name")
    auth: Literal["windows", "sql", "entra_interactive"] = Field(default="windows", description="windows = the signed-in Windows user; sql = SQL login (a secure window opens on the user's computer for the password, never ask for it in chat); entra_interactive = Microsoft Entra sign-in in a browser window")
    trust_server_certificate: bool = Field(default=False, description="Only set to true if the user says the server uses a self-signed certificate")


class SchemaArgs(BaseModel):
    connection: str
    schema_name: str = Field(default="", description="Only this SQL schema, for example dbo")
    table: str = Field(default="", description="Only tables whose name contains this text")


class QueryArgs(BaseModel):
    connection: str
    sql: str = Field(description="One read-only SELECT (or WITH ... SELECT) statement. Anything that changes data is refused")
    max_rows: int = Field(default=20, description="How many rows to return, at most 50")


class ConnectionNameArgs(BaseModel):
    connection: str


class ModelSpecArgs(BaseModel):
    spec: PowerBiSpec


class UpdateModelArgs(BaseModel):
    project: str = Field(description="The project name returned by powerbi_create_project")
    spec: PowerBiSpec = Field(description="The complete new description. You can change and add things but not remove tables, pages or visuals: set hidden to true instead")


class ProjectNameArgs(BaseModel):
    project: str


class OpenPowerBiArgs(BaseModel):
    project: str = Field(default="", description="A project created by powerbi_create_project. Leave empty to just start Power BI Desktop")


class TextFileArgs(BaseModel):
    filename: str = Field(description="A file name ending in .txt, .md, .csv, .json or .html")
    content: str


@dataclass(frozen=True)
class ToolSpec:
    name: str
    description: str
    schema: type[BaseModel]
    summarize: Callable[[dict], str]
    web: bool = False
    risk: Literal["low", "medium", "high"] = "low"


def shorten(value: object, limit: int = 60) -> str:
    text = " ".join(str(value).split())
    return text if len(text) <= limit else f"{text[: limit - 1]}…"


TOOLS: list[ToolSpec] = [
    ToolSpec(
        "open_in_default_browser",
        "Open a web page in the user's normal browser so they can look at it. Use this when the user just wants a page opened for themselves.",
        UrlArgs,
        lambda args: f"Open {shorten(args.get('url'), 80)} in your default browser",
        risk="medium",
    ),
    ToolSpec(
        "browser_open",
        "Open a web page in a browser window that you can control, and read what is on it. Use this when you need to see or use the page yourself.",
        UrlArgs,
        lambda args: f"Open {shorten(args.get('url'), 80)} in a browser window controlled by the Co-worker",
        True,
    ),
    ToolSpec(
        "browser_read",
        "Read the page that is currently open in the controlled browser: its title, text, links and input fields.",
        EmptyArgs,
        lambda args: "Read the page that is open in the controlled browser",
        True,
    ),
    ToolSpec(
        "browser_inspect",
        "List the interactive elements on the current page (inputs, textareas, dropdowns, buttons, links, checkboxes, tabs) with their tag, type, label, id, name, placeholder, current value and a reference such as e12 that the other browser tools accept. Use this to identify what is on a page before using it or testing it.",
        InspectArgs,
        lambda args: "Look for the buttons, inputs and links on the page" if args.get("filter", "all") == "all" else f"Look for the {args.get('filter')} on the page",
        True,
    ),
    ToolSpec(
        "browser_click",
        "Move the Co-worker mouse pointer to an element in the controlled browser and click it, then briefly read the page. Works on buttons, links, checkboxes, radio buttons and tabs.",
        ClickArgs,
        lambda args: f"Click '{shorten(args.get('label') or args.get('target'))}' on the page",
        True,
    ),
    ToolSpec(
        "browser_hover",
        "Move the Co-worker mouse pointer over an element without clicking, for example to open a menu or a tooltip.",
        HoverArgs,
        lambda args: f"Point at '{shorten(args.get('label') or args.get('target'))}' on the page",
        True,
    ),
    ToolSpec(
        "browser_type",
        "Click an input in the controlled browser and type text into it, optionally pressing Enter, then briefly read the page. Never type passwords or payment details.",
        TypeArgs,
        lambda args: f"Type '{shorten(args.get('text'))}' into '{shorten(args.get('label') or args.get('target'))}'" + (" and press Enter" if args.get("submit") else ""),
        True,
    ),
    ToolSpec(
        "browser_select",
        "Choose an option in a dropdown (select) on the page.",
        SelectArgs,
        lambda args: f"Choose '{shorten(args.get('option'))}' in '{shorten(args.get('label') or args.get('target'))}'",
        True,
    ),
    ToolSpec(
        "browser_press",
        "Press a keyboard key in the controlled browser, for example Tab, Escape or PageDown, then briefly read the page.",
        KeyArgs,
        lambda args: f"Press the {shorten(args.get('key'), 20)} key in the controlled browser",
        True,
    ),
    ToolSpec(
        "browser_scroll",
        "Scroll the page in the controlled browser down, up, to the top or to the bottom.",
        ScrollArgs,
        lambda args: f"Scroll {args.get('direction', 'down')} on the page",
        True,
    ),
    ToolSpec(
        "browser_wait",
        "Wait for some text to appear, for the page to stop changing (a chatbot finishing its answer), or just pause for a moment, for example while a page loads.",
        WaitArgs,
        lambda args: f"Wait for '{shorten(args.get('text'))}' to appear" if args.get("text") else "Wait for the page to stop changing" if args.get("settle") else f"Wait {args.get('seconds', 2):g} seconds",
        True,
    ),
    ToolSpec(
        "browser_expect",
        "Check what should be true on the page right now: text visible or absent, the URL or title, whether an element is visible, or what an input contains. Returns a pass or fail for each check. Use it to test an app and to report results.",
        ExpectArgs,
        lambda args: f"Check {len(args.get('checks') or [])} thing{'' if len(args.get('checks') or []) == 1 else 's'} on the page",
        True,
    ),
    ToolSpec(
        "browser_issues",
        "List the errors the page produced since the last time you asked: console errors, script errors, failed requests and HTTP errors. Use it while testing an app.",
        EmptyArgs,
        lambda args: "Look for errors the page produced",
        True,
    ),
    ToolSpec(
        "browser_close",
        "Close the controlled browser window when the task is finished.",
        EmptyArgs,
        lambda args: "Close the controlled browser window",
    ),
    ToolSpec(
        "create_word_document",
        "Create a Word (.docx) document in the user's Co-worker workspace folder, optionally opening it in Word. Write the complete, well-formed content.",
        WordArgs,
        lambda args: f"Create the Word document '{shorten(args.get('filename'))}' ({len(args.get('blocks') or [])} blocks)" + (" and open it in Word" if args.get("open_after", True) else ""),
        risk="high",
    ),
    ToolSpec(
        "create_excel_document",
        "Create an Excel (.xlsx) workbook in the user's Co-worker workspace folder and return its file path. Use it for test case documents, results tables and other lists. For testing tasks use one sheet with the columns Test ID, Category, Title, Steps, Test input, Expected result, Actual result, Status (Pass or Fail) and Notes, with one row per test you actually ran, and optionally a Summary sheet.",
        ExcelArgs,
        lambda args: f"Create the Excel workbook '{shorten(args.get('filename'))}' ({sum(len(sheet.get('rows') or []) for sheet in args.get('sheets') or [])} rows)",
        risk="high",
    ),
    ToolSpec(
        "update_excel_document",
        "Change an Excel workbook you created earlier in the workspace folder: fill cells in rows found by a key column (for example write Actual result and Status for each Test ID), append rows, or add sheets such as a Summary. It never creates a separate file.",
        UpdateExcelArgs,
        lambda args: f"Update the Excel workbook '{shorten(args.get('filename'))}'",
        risk="medium",
    ),
    ToolSpec(
        "draft_email",
        "Open a prepared email in the user's mail app so they can read, change and send it themselves. You cannot send email. Write the complete text.",
        MailArgs,
        lambda args: f"Open an email draft '{shorten(args.get('subject'))}' in your mail app (it is not sent)",
        risk="medium",
    ),
    ToolSpec(
        "db_connect",
        "Open a read-only connection to a database (SQL Server, Azure SQL or a SQLite file) so you can explore its tables and run SELECT queries. Nothing can be changed through it.",
        ConnectArgs,
        lambda args: f"Connect to the database {shorten(args.get('database') or args.get('path'), 50)}" + (f" on {shorten(args.get('server'), 40)}" if args.get("server") else "") + " (read-only)",
        True,
        "medium",
    ),
    ToolSpec(
        "db_schema",
        "List the tables and columns (names and types) of a connected database.",
        SchemaArgs,
        lambda args: f"Look at the tables and columns of the database '{shorten(args.get('connection'), 30)}'",
        True,
    ),
    ToolSpec(
        "db_query",
        "Run one read-only SELECT query on a connected database and return up to 50 rows. If the database reports an error, read it, fix the query and run it again.",
        QueryArgs,
        lambda args: f"Run a query: {shorten(args.get('sql'), 90)}",
        True,
    ),
    ToolSpec(
        "db_disconnect",
        "Close a database connection when you are finished with it.",
        ConnectionNameArgs,
        lambda args: f"Close the database connection '{shorten(args.get('connection'), 30)}'",
    ),
    ToolSpec(
        "powerbi_validate_model",
        "Check a Power BI model and report description without writing anything: unknown tables or columns, DAX mistakes, broken relationships, bad visuals. Returns errors to fix and warnings. Always do this before powerbi_create_project.",
        ModelSpecArgs,
        lambda args: "Check the Power BI model for mistakes",
    ),
    ToolSpec(
        "powerbi_create_project",
        "Create a Power BI Project (semantic model with tables, relationships and DAX measures, plus a report with pages and visuals) in the workspace folder. Power BI Desktop opens it with powerbi_open. It refuses a model that has errors.",
        ModelSpecArgs,
        lambda args: f"Create the Power BI project '{shorten((args.get('spec') or {}).get('name'), 40)}' ({len((args.get('spec') or {}).get('tables') or [])} tables, {sum(len(page.get('visuals') or []) for page in (args.get('spec') or {}).get('pages') or [])} visuals)",
        risk="high",
    ),
    ToolSpec(
        "powerbi_update_project",
        "Change a Power BI project you created: send the complete new description. You can change and add tables, columns, measures, relationships, pages and visuals, but not remove tables, pages or visuals (set hidden to true instead).",
        UpdateModelArgs,
        lambda args: f"Update the Power BI project '{shorten(args.get('project'), 40)}'",
        risk="medium",
    ),
    ToolSpec(
        "powerbi_read_spec",
        "Read the model and report description of a Power BI project you created earlier, so you can change it.",
        ProjectNameArgs,
        lambda args: f"Read the Power BI project '{shorten(args.get('project'), 40)}'",
    ),
    ToolSpec(
        "powerbi_open",
        "Open a Power BI project in Power BI Desktop on the user's computer (or just start Power BI Desktop). The user presses Refresh there and signs in to the data source if asked.",
        OpenPowerBiArgs,
        lambda args: f"Open the Power BI project '{shorten(args.get('project'), 40)}' in Power BI Desktop" if args.get("project") else "Start Power BI Desktop",
        risk="medium",
    ),
    ToolSpec(
        "write_text_file",
        "Save a plain text, Markdown, CSV, JSON or HTML file in the Co-worker workspace folder.",
        TextFileArgs,
        lambda args: f"Save the file '{shorten(args.get('filename'))}' in your workspace folder",
        risk="high",
    ),
    ToolSpec(
        "read_text_file",
        "Read a text file from the Co-worker workspace folder.",
        FilenameArgs,
        lambda args: f"Read the file '{shorten(args.get('filename'))}' from your workspace folder",
    ),
    ToolSpec(
        "list_files",
        "List the files in the Co-worker workspace folder.",
        EmptyArgs,
        lambda args: "List the files in your Co-worker workspace folder",
    ),
    ToolSpec(
        "open_file",
        "Open a file from the Co-worker workspace folder with its default app, for example a Word document.",
        FilenameArgs,
        lambda args: f"Open '{shorten(args.get('filename'))}' from your workspace folder",
        risk="medium",
    ),
]

TOOL_INDEX = {spec.name: spec for spec in TOOLS}


def langchain_tools() -> list[StructuredTool]:
    return [StructuredTool.from_function(name=spec.name, description=spec.description, args_schema=spec.schema, func=lambda **_: "") for spec in TOOLS]


def own_file(name: str, args: dict, created: set[str]) -> bool:
    if name == "update_excel_document":
        filename = str(args.get("filename") or "").lower()
        return (filename if filename.endswith(".xlsx") else f"{filename}.xlsx") in created
    if name == "powerbi_update_project":
        return str(args.get("project") or "").lower() in created
    return False


def risk_of(name: str, args: dict, created: set[str] | None = None) -> str:
    spec = TOOL_INDEX.get(name)
    if spec is None:
        return "high"
    if own_file(name, args, created or set()):
        return "low"
    if name.startswith("browser_") and wants_delete(args):
        return "delete"
    if name in ("browser_type", "browser_select", "browser_press"):
        return "high" if args.get("effect") == "creates" else spec.risk
    if name.startswith("browser_") and wants_create(args):
        return "high"
    return spec.risk


def describe_action(name: str, args: dict) -> str:
    spec = TOOL_INDEX.get(name)
    return spec.summarize(args) if spec else f"Run {name}"
