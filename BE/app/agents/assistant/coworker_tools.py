from collections.abc import Callable
from dataclasses import dataclass
from typing import Literal

from langchain_core.tools import StructuredTool
from pydantic import BaseModel, Field


class UrlArgs(BaseModel):
    url: str = Field(description="A full http or https web address")


class EmptyArgs(BaseModel):
    pass


class ClickArgs(BaseModel):
    target: str = Field(description="The visible text of a button or link to click, or a CSS selector")


class TypeArgs(BaseModel):
    target: str = Field(description="The label, placeholder or name of the input, or a CSS selector")
    text: str = Field(description="The text to type")
    submit: bool = Field(default=False, description="Press Enter after typing")


class KeyArgs(BaseModel):
    key: str = Field(description="A key name such as Enter, Tab, Escape, PageDown or ArrowDown")


class FilenameArgs(BaseModel):
    filename: str = Field(description="A plain file name inside the workspace folder, without folders")


class WordBlock(BaseModel):
    type: Literal["heading", "paragraph", "bullet", "numbered"] = "paragraph"
    text: str


class WordArgs(BaseModel):
    filename: str = Field(description="The document name, for example Thank you letter.docx")
    title: str = Field(default="", description="An optional title shown at the top")
    blocks: list[WordBlock] = Field(description="The document content in order, one block per paragraph, heading or list item")
    open_after: bool = Field(default=True, description="Open the finished document in Word for the user")


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


def shorten(value: object, limit: int = 60) -> str:
    text = " ".join(str(value).split())
    return text if len(text) <= limit else f"{text[: limit - 1]}…"


TOOLS: list[ToolSpec] = [
    ToolSpec(
        "open_in_default_browser",
        "Open a web page in the user's normal browser so they can look at it. Use this when the user just wants a page opened for themselves.",
        UrlArgs,
        lambda args: f"Open {shorten(args.get('url'), 80)} in your default browser",
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
        "browser_click",
        "Click a button or link on the page in the controlled browser, then read the resulting page.",
        ClickArgs,
        lambda args: f"Click '{shorten(args.get('target'))}' on the page",
        True,
    ),
    ToolSpec(
        "browser_type",
        "Type text into an input on the page in the controlled browser, optionally pressing Enter, then read the resulting page. Never type passwords or payment details.",
        TypeArgs,
        lambda args: f"Type '{shorten(args.get('text'))}' into '{shorten(args.get('target'))}'" + (" and press Enter" if args.get("submit") else ""),
        True,
    ),
    ToolSpec(
        "browser_press",
        "Press a keyboard key in the controlled browser, for example PageDown to scroll, then read the page.",
        KeyArgs,
        lambda args: f"Press the {shorten(args.get('key'), 20)} key in the controlled browser",
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
    ),
    ToolSpec(
        "write_text_file",
        "Save a plain text, Markdown, CSV, JSON or HTML file in the Co-worker workspace folder.",
        TextFileArgs,
        lambda args: f"Save the file '{shorten(args.get('filename'))}' in your workspace folder",
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
    ),
]

TOOL_INDEX = {spec.name: spec for spec in TOOLS}


def langchain_tools() -> list[StructuredTool]:
    return [StructuredTool.from_function(name=spec.name, description=spec.description, args_schema=spec.schema, func=lambda **_: "") for spec in TOOLS]


def describe_action(name: str, args: dict) -> str:
    spec = TOOL_INDEX.get(name)
    return spec.summarize(args) if spec else f"Run {name}"
