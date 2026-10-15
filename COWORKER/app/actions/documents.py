from typing import Literal

from docx import Document
from pydantic import BaseModel, Field

from app.actions.errors import ActionError
from app.actions.paths import free_path, resolve_in_workspace
from app.actions.system import launch
from app.config import Settings

MAX_BLOCKS = 400
MAX_TEXT_CHARACTERS = 20_000


class Block(BaseModel):
    type: Literal["heading", "paragraph", "bullet", "numbered"] = "paragraph"
    text: str = Field(max_length=MAX_TEXT_CHARACTERS)


class WordArgs(BaseModel):
    filename: str
    title: str = ""
    blocks: list[Block] = Field(max_length=MAX_BLOCKS)
    open_after: bool = True


STYLES = {"bullet": "List Bullet", "numbered": "List Number"}


async def create_word_document(settings: Settings, args: dict) -> dict:
    parsed = WordArgs(**args)
    if not parsed.blocks and not parsed.title:
        raise ActionError("The document has no content.")
    name = parsed.filename if parsed.filename.lower().endswith(".docx") else f"{parsed.filename}.docx"
    target = free_path(resolve_in_workspace(settings, name))
    document = Document()
    if parsed.title:
        document.add_heading(parsed.title, level=0)
    for block in parsed.blocks:
        if block.type == "heading":
            document.add_heading(block.text, level=1)
        elif block.type in STYLES:
            document.add_paragraph(block.text, style=STYLES[block.type])
        else:
            document.add_paragraph(block.text)
    document.save(target)
    opened = False
    if parsed.open_after and settings.coworker_launch_apps:
        launch(str(target))
        opened = True
    return {"path": str(target), "filename": target.name, "blocks": len(parsed.blocks), "opened": opened}
