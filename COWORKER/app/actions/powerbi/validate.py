import re

from app.actions.database import ensure_read_only
from app.actions.errors import ActionError
from app.actions.powerbi.dax import KNOWN_FUNCTIONS, TEXT_AGGREGATES, balanced, function_names, references, strip_dax
from app.actions.powerbi.spec import ProjectSpec, Table
from app.actions.powerbi.tmdl import parse_datetime

NUMERIC_TYPES = {"int64", "double", "decimal"}
CHART_TYPES = {"column_chart", "bar_chart", "line_chart", "area_chart", "pie_chart", "donut_chart"}
AGGREGATE_PATTERN = r"\b({names})\s*\(\s*(?:'((?:[^']|'')+)'|([A-Za-z_][A-Za-z0-9_]*))\[([^\]]+)\]\s*\)"


def lower_map(values) -> dict[str, object]:
    return {value.name.lower(): value for value in values}


def check_inline_rows(table: Table, errors: list[str]) -> None:
    if table.source.kind != "inline":
        return
    width = len(table.columns)
    for number, row in enumerate(table.source.rows, start=1):
        if len(row) != width:
            errors.append(f"Table '{table.name}': inline row {number} has {len(row)} values but there are {width} columns.")
            return
        for column, value in zip(table.columns, row):
            if value is None:
                continue
            if column.type in NUMERIC_TYPES and (isinstance(value, bool) or not isinstance(value, (int, float))):
                errors.append(f"Table '{table.name}': inline row {number}, column '{column.name}' is {column.type} but the value is {value!r}.")
                return
            if column.type == "int64" and isinstance(value, float) and not value.is_integer():
                errors.append(f"Table '{table.name}': inline row {number}, column '{column.name}' is int64 but the value is {value!r}.")
                return
            if column.type == "dateTime" and parse_datetime(value) is None:
                errors.append(f"Table '{table.name}': inline row {number}, column '{column.name}' is dateTime but the value {value!r} is not an ISO date such as 2025-01-31 or 2025-01-31T14:30:00.")
                return
            if column.type == "boolean" and not isinstance(value, bool):
                errors.append(f"Table '{table.name}': inline row {number}, column '{column.name}' is boolean but the value is {value!r}.")
                return


def check_sources(spec: ProjectSpec, errors: list[str]) -> None:
    for table in spec.tables:
        check_inline_rows(table, errors)
        if table.source.kind == "sql_server" and table.source.query:
            try:
                ensure_read_only(table.source.query)
            except ActionError as error:
                errors.append(f"Table '{table.name}': the SQL query is not allowed. {error}")


def check_names(spec: ProjectSpec, errors: list[str]) -> dict[str, Table]:
    tables = {}
    measure_owner: dict[str, str] = {}
    for table in spec.tables:
        key = table.name.lower()
        if key in tables:
            errors.append(f"Table name '{table.name}' is used twice.")
        tables[key] = table
        columns = [column.name.lower() for column in table.columns]
        for name in {name for name in columns if columns.count(name) > 1}:
            errors.append(f"Table '{table.name}': column '{name}' is listed twice.")
        for measure in table.measures:
            key_name = measure.name.lower()
            if key_name in columns:
                errors.append(f"Table '{table.name}': measure '{measure.name}' has the same name as a column.")
            if key_name in measure_owner:
                errors.append(f"Measure '{measure.name}' exists in both '{measure_owner[key_name]}' and '{table.name}'. Measure names must be unique in the model.")
            measure_owner[key_name] = table.name
    return tables


def check_relationships(spec: ProjectSpec, tables: dict[str, Table], errors: list[str]) -> None:
    seen = set()
    for relationship in spec.relationships:
        label = f"Relationship {relationship.from_table}[{relationship.from_column}] -> {relationship.to_table}[{relationship.to_column}]"
        source = tables.get(relationship.from_table.lower())
        target = tables.get(relationship.to_table.lower())
        if source is None or target is None:
            errors.append(f"{label}: the table '{relationship.from_table if source is None else relationship.to_table}' does not exist.")
            continue
        if source is target:
            errors.append(f"{label}: a table cannot be related to itself.")
        left = lower_map(source.columns).get(relationship.from_column.lower())
        right = lower_map(target.columns).get(relationship.to_column.lower())
        if left is None or right is None:
            errors.append(f"{label}: the column '{relationship.from_column if left is None else relationship.to_column}' does not exist.")
            continue
        if left.type != right.type:
            errors.append(f"{label}: the column types differ ({left.type} and {right.type}).")
        pair = (source.name.lower(), left.name.lower(), target.name.lower(), right.name.lower())
        if pair in seen:
            errors.append(f"{label}: this relationship is listed twice.")
        seen.add(pair)


def check_measure(table: Table, measure_name: str, expression: str, tables: dict[str, Table], measures: set[str], errors: list[str], warnings: list[str]) -> None:
    label = f"Measure '{measure_name}'"
    cleaned = strip_dax(expression)
    if not cleaned.strip():
        errors.append(f"{label}: the expression is empty.")
        return
    if cleaned.lstrip().startswith("="):
        errors.append(f"{label}: do not start the expression with '='. Write only the DAX after the equals sign.")
    if not balanced(cleaned):
        errors.append(f"{label}: the brackets ( ) are not balanced.")
    for owner, member in references(cleaned):
        if owner is None:
            columns = lower_map(table.columns)
            if member.lower() not in measures and member.lower() not in columns:
                errors.append(f"{label}: [{member}] is not a measure in the model or a column of '{table.name}'. Qualify columns as Table[Column].")
            continue
        target = tables.get(owner.lower())
        if target is None:
            errors.append(f"{label}: the table '{owner}' does not exist.")
        elif member.lower() not in lower_map(target.columns) and member.lower() not in {item.name.lower() for item in target.measures}:
            errors.append(f"{label}: '{target.name}' has no column or measure called '{member}'.")
    names = "|".join(TEXT_AGGREGATES)
    for match in re.finditer(AGGREGATE_PATTERN.format(names=names), cleaned, re.IGNORECASE):
        owner = (match.group(2) or match.group(3) or "").replace("''", "'")
        target = tables.get(owner.lower())
        column = lower_map(target.columns).get(match.group(4).lower()) if target else None
        if column is not None and column.type not in NUMERIC_TYPES:
            errors.append(f"{label}: {match.group(1).upper()} needs a number column but '{target.name}'[{column.name}] is {column.type}.")
    unknown = sorted(name for name in function_names(cleaned) if name not in KNOWN_FUNCTIONS)
    if unknown:
        warnings.append(f"{label}: the function(s) {', '.join(unknown)} are not in the list of known DAX functions. Check the spelling.")


def check_measures(spec: ProjectSpec, tables: dict[str, Table], errors: list[str], warnings: list[str]) -> None:
    measures = {measure.name.lower() for table in spec.tables for measure in table.measures}
    for table in spec.tables:
        for measure in table.measures:
            check_measure(table, measure.name, measure.expression, tables, measures, errors, warnings)


def check_field(field, tables: dict[str, Table], where: str, errors: list[str]) -> str | None:
    table = tables.get(field.table.lower())
    if table is None:
        errors.append(f"{where}: the table '{field.table}' does not exist.")
        return None
    if field.kind == "measure":
        if field.aggregation:
            errors.append(f"{where}: a measure cannot have an aggregation ('{field.name}').")
        if field.name.lower() not in {measure.name.lower() for measure in table.measures}:
            errors.append(f"{where}: '{table.name}' has no measure called '{field.name}'.")
        return None
    column = lower_map(table.columns).get(field.name.lower())
    if column is None:
        errors.append(f"{where}: '{table.name}' has no column called '{field.name}'.")
        return None
    if field.aggregation in ("sum", "average") and column.type not in NUMERIC_TYPES:
        errors.append(f"{where}: {field.aggregation} needs a number column but '{table.name}'[{column.name}] is {column.type}.")
    return column.type


def check_visual_shape(visual, where: str, errors: list[str]) -> None:
    kind = visual.type
    if kind == "card" and (visual.category or len(visual.values) != 1):
        errors.append(f"{where}: a card shows exactly one value and no category.")
    if kind in CHART_TYPES and (visual.category is None or not visual.values):
        errors.append(f"{where}: a chart needs a category and at least one value.")
    if kind in ("pie_chart", "donut_chart") and len(visual.values) != 1:
        errors.append(f"{where}: a pie or donut chart needs exactly one value.")
    if kind == "table" and (visual.category or not visual.values):
        errors.append(f"{where}: a table lists its columns in values (at least one) and has no category.")
    if kind == "slicer" and (visual.category is None or visual.values or visual.category.kind != "column"):
        errors.append(f"{where}: a slicer needs one column as its category and no values.")
    if kind in CHART_TYPES or kind == "card":
        for field in visual.values:
            if field.kind == "column" and not field.aggregation:
                errors.append(f"{where}: the column '{field.table}'[{field.name}] is used as a value without an aggregation. Use a measure or set aggregation.")


def check_pages(spec: ProjectSpec, tables: dict[str, Table], errors: list[str]) -> None:
    page_ids = [page.id.lower() for page in spec.pages]
    for page_id in {item for item in page_ids if page_ids.count(item) > 1}:
        errors.append(f"Page id '{page_id}' is used twice.")
    for page in spec.pages:
        visual_ids = [visual.id.lower() for visual in page.visuals]
        for visual_id in {item for item in visual_ids if visual_ids.count(item) > 1}:
            errors.append(f"Page '{page.id}': visual id '{visual_id}' is used twice.")
        for visual in page.visuals:
            where = f"Page '{page.id}', visual '{visual.id}'"
            check_visual_shape(visual, where, errors)
            for field in ([visual.category] if visual.category else []) + visual.values:
                check_field(field, tables, where, errors)


def check_model(spec: ProjectSpec) -> tuple[list[str], list[str]]:
    errors: list[str] = []
    warnings: list[str] = []
    tables = check_names(spec, errors)
    check_sources(spec, errors)
    check_relationships(spec, tables, errors)
    check_measures(spec, tables, errors, warnings)
    check_pages(spec, tables, errors)
    if not spec.pages:
        warnings.append("The report has no pages yet, so there is no dashboard.")
    return errors, warnings