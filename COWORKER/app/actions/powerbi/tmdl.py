import re
import textwrap
import uuid
from datetime import datetime

from app.actions.powerbi.spec import Column, ProjectSpec, Table

NAMESPACE = uuid.UUID("6f1c2b7e-3f55-4c0e-9d0e-2f0f5a9c7a10")
SIMPLE_NAME = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")
M_TYPES = {"string": "text", "int64": "Int64.Type", "double": "number", "decimal": "number", "boolean": "logical", "dateTime": "datetime"}
M_TYPE_KEYWORDS = {"string": "type text", "int64": "Int64.Type", "double": "type number", "decimal": "type number", "boolean": "type logical", "dateTime": "type datetime"}
DEFAULT_FORMATS = {"dateTime": "General Date"}
TAB = "\t"


def stable_guid(*parts: str) -> str:
    return str(uuid.uuid5(NAMESPACE, "|".join(parts)))


def quoted(name: str) -> str:
    return name if SIMPLE_NAME.match(name) else "'" + name.replace("'", "''") + "'"


def one_line(text: str) -> str:
    return " ".join(text.split())


def parse_datetime(value) -> datetime | None:
    if not isinstance(value, str):
        return None
    try:
        return datetime.fromisoformat(value.strip().replace("Z", ""))
    except ValueError:
        return None


def m_text(value: str) -> str:
    escaped = value.replace('"', '""').replace("\r", "#(cr)").replace("\n", "#(lf)").replace("\t", "#(tab)")
    return f'"{escaped}"'


def m_identifier(name: str) -> str:
    return name if SIMPLE_NAME.match(name) else '#"' + name.replace('"', '""') + '"'


def m_literal(value, column: Column) -> str:
    if value is None:
        return "null"
    if isinstance(value, bool):
        return "true" if value else "false"
    if column.type == "dateTime":
        moment = parse_datetime(value)
        if moment is not None:
            return f"#datetime({moment.year}, {moment.month}, {moment.day}, {moment.hour}, {moment.minute}, {moment.second})"
    if isinstance(value, (int, float)):
        return repr(value)
    return m_text(str(value))


def indent_lines(text: str, level: int) -> str:
    return "\n".join(f"{TAB * level}{line}" if line.strip() else "" for line in textwrap.dedent(text).strip().splitlines())


def typed_columns(table: Table) -> str:
    pairs = ", ".join(f"{{{m_text(column.name)}, {M_TYPE_KEYWORDS[column.type]}}}" for column in table.columns)
    return f"{{{pairs}}}"


def partition_expression(table: Table) -> str:
    source = table.source
    if source.kind == "inline":
        header = ", ".join(f"{m_identifier(column.name)} = {M_TYPES[column.type]}" for column in table.columns)
        rows = ", ".join("{" + ", ".join(m_literal(value, column) for value, column in zip(row, table.columns)) + "}" for row in source.rows)
        return f"let\n    Source = #table(type table [{header}], {{{rows}}})\nin\n    Source"
    if source.kind == "sql_server":
        if source.query:
            return f"let\n    Source = Sql.Database({m_text(source.server)}, {m_text(source.database)}, [Query = {m_text(source.query)}])\nin\n    Source"
        return (
            f"let\n    Source = Sql.Database({m_text(source.server)}, {m_text(source.database)}),\n"
            f"    Data = Source{{[Schema = {m_text(source.schema_name)}, Item = {m_text(source.table)}]}}[Data]\nin\n    Data"
        )
    if source.kind == "csv":
        return (
            f"let\n    Source = Csv.Document(File.Contents({m_text(source.path)}), [Delimiter = {m_text(source.delimiter)}, Encoding = 65001, QuoteStyle = QuoteStyle.Csv]),\n"
            f"    Promoted = Table.PromoteHeaders(Source, [PromoteAllScalars = true]),\n"
            f"    Typed = Table.TransformColumnTypes(Promoted, {typed_columns(table)})\nin\n    Typed"
        )
    if source.kind == "excel":
        return (
            f"let\n    Source = Excel.Workbook(File.Contents({m_text(source.path)}), null, true),\n"
            f"    Sheet = Source{{[Item = {m_text(source.sheet)}, Kind = \"Sheet\"]}}[Data],\n"
            f"    Promoted = Table.PromoteHeaders(Sheet, [PromoteAllScalars = true]),\n"
            f"    Typed = Table.TransformColumnTypes(Promoted, {typed_columns(table)})\nin\n    Typed"
        )
    return source.expression.strip()


def column_block(column: Column, table_name: str) -> list[str]:
    lines = []
    if column.description:
        lines.append(f"{TAB}/// {one_line(column.description)}")
    lines.append(f"{TAB}column {quoted(column.name)}")
    lines.append(f"{TAB * 2}dataType: {column.type}")
    format_string = column.format_string or DEFAULT_FORMATS.get(column.type, "")
    if format_string:
        lines.append(f"{TAB * 2}formatString: {one_line(format_string)}")
    if column.hidden:
        lines.append(f"{TAB * 2}isHidden")
    lines.append(f"{TAB * 2}lineageTag: {stable_guid(table_name, column.name)}")
    lines.append(f"{TAB * 2}summarizeBy: {column.summarize_by}")
    lines.append(f"{TAB * 2}sourceColumn: {one_line(column.name)}")
    return lines


def measure_block(measure, table_name: str) -> list[str]:
    lines = []
    if measure.description:
        lines.append(f"{TAB}/// {one_line(measure.description)}")
    expression = textwrap.dedent(measure.expression).strip()
    if "\n" in expression:
        lines.append(f"{TAB}measure {quoted(measure.name)} =")
        lines.append(indent_lines(expression, 3))
    else:
        lines.append(f"{TAB}measure {quoted(measure.name)} = {expression}")
    if measure.format_string:
        lines.append(f"{TAB * 2}formatString: {one_line(measure.format_string)}")
    if measure.display_folder:
        lines.append(f"{TAB * 2}displayFolder: {one_line(measure.display_folder)}")
    lines.append(f"{TAB * 2}lineageTag: {stable_guid(table_name, 'measure', measure.name)}")
    return lines


def table_file(table: Table) -> str:
    lines = []
    if table.description:
        lines.append(f"/// {one_line(table.description)}")
    lines.append(f"table {quoted(table.name)}")
    if table.hidden:
        lines.append(f"{TAB}isHidden")
    lines.append(f"{TAB}lineageTag: {stable_guid(table.name)}")
    lines.append("")
    for measure in table.measures:
        lines.extend(measure_block(measure, table.name))
        lines.append("")
    for column in table.columns:
        lines.extend(column_block(column, table.name))
        lines.append("")
    lines.append(f"{TAB}partition {quoted(table.name)} = m")
    lines.append(f"{TAB * 2}mode: import")
    lines.append(f"{TAB * 2}source =")
    lines.append(indent_lines(partition_expression(table), 4))
    lines.append("")
    return "\n".join(lines)


def model_file(spec: ProjectSpec) -> str:
    lines = ["model Model", f"{TAB}culture: en-US", f"{TAB}defaultPowerBIDataSourceVersion: powerBI_V3", f"{TAB}discourageImplicitMeasures", f"{TAB}sourceQueryCulture: en-US", ""]
    lines.extend(f"ref table {quoted(table.name)}" for table in spec.tables)
    lines.append("")
    return "\n".join(lines)


def database_file() -> str:
    return "database\n\tcompatibilityLevel: 1600\n"


def relationships_file(spec: ProjectSpec) -> str:
    lines = []
    for relationship in spec.relationships:
        identity = stable_guid(relationship.from_table, relationship.from_column, relationship.to_table, relationship.to_column)
        lines.append(f"relationship {identity}")
        if not relationship.active:
            lines.append(f"{TAB}isActive: false")
        if relationship.cross_filter == "both":
            lines.append(f"{TAB}crossFilteringBehavior: bothDirections")
        lines.append(f"{TAB}fromColumn: {quoted(relationship.from_table)}.{quoted(relationship.from_column)}")
        lines.append(f"{TAB}toColumn: {quoted(relationship.to_table)}.{quoted(relationship.to_column)}")
        lines.append("")
    return "\n".join(lines)