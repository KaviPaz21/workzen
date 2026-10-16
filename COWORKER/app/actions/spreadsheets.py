import re

from openpyxl import Workbook, load_workbook
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.utils import get_column_letter
from pydantic import BaseModel, Field

from app.actions.errors import ActionError
from app.actions.paths import free_path, resolve_in_workspace
from app.actions.system import launch
from app.config import Settings

MAX_SHEETS = 5
MAX_ROWS = 500
MAX_COLUMNS = 20
MAX_CELL_CHARACTERS = 5000
MIN_COLUMN_WIDTH = 10
MAX_COLUMN_WIDTH = 60
SHEET_NAME_FORBIDDEN = str.maketrans("", "", "[]:*?/\\")
BLOCKED_FORMULA_PATTERN = re.compile(r"(\[|\]|!|https?:|file:|\\\\|hyperlink|webservice|filterxml|call\s*\(|register\.id|exec|dde|importdata|rtd\s*\(|cmd|powershell|@)", re.IGNORECASE)


class Sheet(BaseModel):
    name: str = Field(default="Sheet", max_length=31)
    columns: list[str] = Field(min_length=1, max_length=MAX_COLUMNS)
    rows: list[list[str | int | float | bool | None]] = Field(max_length=MAX_ROWS)
    allow_formulas: bool = False
    number_formats: dict[str, str] = Field(default_factory=dict)


class ExcelArgs(BaseModel):
    filename: str
    sheets: list[Sheet] = Field(min_length=1, max_length=MAX_SHEETS)
    open_after: bool = False


def sheet_title(name: str, taken: set[str]) -> str:
    base = name.translate(SHEET_NAME_FORBIDDEN).strip()[:31] or "Sheet"
    title = base
    number = 2
    while title.lower() in taken:
        suffix = f" ({number})"
        title = f"{base[: 31 - len(suffix)]}{suffix}"
        number += 1
    taken.add(title.lower())
    return title


def check_formula(text: str) -> str:
    if BLOCKED_FORMULA_PATTERN.search(text):
        raise ActionError(f"The formula {text[:60]!r} is not allowed. Formulas may only use plain functions and cell references on the same workbook (no links, other files or commands).")
    return text


def write_cell(sheet, row: int, column: int, value, allow_formulas: bool = False) -> None:
    cell = sheet.cell(row=row, column=column)
    if isinstance(value, str):
        text = value[:MAX_CELL_CHARACTERS]
        if allow_formulas and text.startswith("="):
            cell.value = check_formula(text)
        else:
            cell.value = text
            cell.data_type = "s"
    else:
        cell.value = value
    cell.alignment = Alignment(wrap_text=True, vertical="top")


def fill_sheet(sheet, definition: Sheet) -> None:
    header_font = Font(bold=True, color="FFFFFF")
    header_fill = PatternFill("solid", start_color="333333")
    for number, heading in enumerate(definition.columns, start=1):
        write_cell(sheet, 1, number, heading)
        sheet.cell(row=1, column=number).font = header_font
        sheet.cell(row=1, column=number).fill = header_fill
    for row_number, values in enumerate(definition.rows, start=2):
        if len(values) > len(definition.columns):
            raise ActionError(f"Row {row_number - 1} in '{definition.name}' has more values than columns.")
        for number, value in enumerate(values, start=1):
            write_cell(sheet, row_number, number, value, definition.allow_formulas)
            if value is not None and definition.columns[number - 1] in definition.number_formats:
                sheet.cell(row=row_number, column=number).number_format = definition.number_formats[definition.columns[number - 1]]
    for number in range(1, len(definition.columns) + 1):
        longest = max([len(str(definition.columns[number - 1]))] + [len(str(row[number - 1])) for row in definition.rows if len(row) >= number and row[number - 1] is not None and not str(row[number - 1]).startswith("=")])
        sheet.column_dimensions[get_column_letter(number)].width = min(max(longest + 2, MIN_COLUMN_WIDTH), MAX_COLUMN_WIDTH)
    sheet.freeze_panes = "A2"
    sheet.auto_filter.ref = f"A1:{get_column_letter(len(definition.columns))}{max(len(definition.rows) + 1, 1)}"


async def create_excel_document(settings: Settings, args: dict) -> dict:
    parsed = ExcelArgs(**args)
    name = parsed.filename if parsed.filename.lower().endswith(".xlsx") else f"{parsed.filename}.xlsx"
    target = free_path(resolve_in_workspace(settings, name))
    workbook = Workbook()
    workbook.remove(workbook.active)
    taken: set[str] = set()
    for definition in parsed.sheets:
        fill_sheet(workbook.create_sheet(sheet_title(definition.name, taken)), definition)
    workbook.save(target)
    opened = False
    if parsed.open_after and settings.coworker_launch_apps:
        launch(str(target))
        opened = True
    return {"path": str(target), "filename": target.name, "sheets": len(parsed.sheets), "rows": sum(len(sheet.rows) for sheet in parsed.sheets), "opened": opened}

class UpdateItem(BaseModel):
    sheet: str
    match_column: str
    match_value: str | int | float
    set: dict[str, str | int | float | bool | None] = Field(min_length=1)


class AppendItem(BaseModel):
    sheet: str
    rows: list[list[str | int | float | bool | None]] = Field(max_length=MAX_ROWS)


class UpdateExcelArgs(BaseModel):
    filename: str
    updates: list[UpdateItem] = Field(default_factory=list, max_length=MAX_ROWS)
    append_rows: list[AppendItem] = Field(default_factory=list, max_length=MAX_SHEETS)
    add_sheets: list[Sheet] = Field(default_factory=list, max_length=MAX_SHEETS)
    allow_formulas: bool = False


def header_map(sheet) -> dict[str, int]:
    return {str(cell.value): cell.column for cell in sheet[1] if cell.value is not None}


def apply_updates(workbook, items: list[UpdateItem], allow_formulas: bool) -> int:
    changed = 0
    for item in items:
        if item.sheet not in workbook.sheetnames:
            raise ActionError(f"There is no sheet called '{item.sheet}'. Sheets: {', '.join(workbook.sheetnames)}.")
        sheet = workbook[item.sheet]
        columns = header_map(sheet)
        if item.match_column not in columns:
            raise ActionError(f"Sheet '{item.sheet}' has no column called '{item.match_column}'. Columns: {', '.join(columns)}.")
        found = [row for row in range(2, sheet.max_row + 1) if str(sheet.cell(row=row, column=columns[item.match_column]).value) == str(item.match_value)]
        if not found:
            raise ActionError(f"No row in '{item.sheet}' has {item.match_column} = {item.match_value}.")
        for row in found:
            for name, value in item.set.items():
                if name not in columns:
                    raise ActionError(f"Sheet '{item.sheet}' has no column called '{name}'. Columns: {', '.join(columns)}.")
                write_cell(sheet, row, columns[name], value, allow_formulas)
                changed += 1
    return changed


def apply_appends(workbook, items: list[AppendItem], allow_formulas: bool) -> int:
    added = 0
    for item in items:
        if item.sheet not in workbook.sheetnames:
            raise ActionError(f"There is no sheet called '{item.sheet}'. Sheets: {', '.join(workbook.sheetnames)}.")
        sheet = workbook[item.sheet]
        width = len(header_map(sheet))
        for values in item.rows:
            if len(values) > width:
                raise ActionError(f"A new row for '{item.sheet}' has more values than the sheet has columns ({width}).")
            row = sheet.max_row + 1
            for number, value in enumerate(values, start=1):
                write_cell(sheet, row, number, value, allow_formulas)
            added += 1
    return added


async def update_excel_document(settings: Settings, args: dict) -> dict:
    parsed = UpdateExcelArgs(**args)
    name = parsed.filename if parsed.filename.lower().endswith(".xlsx") else f"{parsed.filename}.xlsx"
    target = resolve_in_workspace(settings, name)
    if not target.is_file():
        raise ActionError(f"'{name}' is not in the workspace folder.")
    workbook = load_workbook(target)
    changed = apply_updates(workbook, parsed.updates, parsed.allow_formulas)
    added = apply_appends(workbook, parsed.append_rows, parsed.allow_formulas)
    taken = {title.lower() for title in workbook.sheetnames}
    for definition in parsed.add_sheets:
        fill_sheet(workbook.create_sheet(sheet_title(definition.name, taken)), definition)
    workbook.save(target)
    return {"path": str(target), "filename": target.name, "cells_changed": changed, "rows_added": added, "sheets_added": len(parsed.add_sheets)}