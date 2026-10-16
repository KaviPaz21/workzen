from typing import Literal

from pydantic import BaseModel, Field

Cell = str | int | float | bool | None


class ColumnSpec(BaseModel):
    name: str = Field(description="The column name exactly as it appears in the source")
    type: Literal["string", "int64", "double", "decimal", "boolean", "dateTime"] = "string"
    format_string: str = Field(default="", description="Optional display format such as #,0.00 or yyyy-mm-dd")
    summarize_by: Literal["none", "sum", "average", "min", "max", "count"] = "none"
    hidden: bool = False
    description: str = ""


class MeasureSpec(BaseModel):
    name: str = Field(description="Measure name, unique in the whole model")
    expression: str = Field(description="DAX without the leading equals sign, columns written as Table[Column], for example SUM(Sales[Amount])")
    format_string: str = Field(default="", description="Optional format such as #,0.00 or 0.0%")
    description: str = ""
    display_folder: str = ""


class SourceSpec(BaseModel):
    kind: Literal["inline", "sql_server", "csv", "excel", "m"] = Field(
        description="inline = a few rows written into the model (rows); sql_server = SQL Server or Azure SQL (server, database, and table or query); csv or excel = a file path; m = your own Power Query expression"
    )
    rows: list[list[Cell]] = Field(default_factory=list, description="For inline: one list per row in the column order, dates as ISO text, at most 500 rows")
    server: str = ""
    database: str = ""
    schema_name: str = Field(default="dbo", description="SQL schema for sql_server with table")
    table: str = ""
    query: str = Field(default="", description="A read-only SELECT query for sql_server (use instead of table)")
    path: str = Field(default="", description="Full file path for csv or excel")
    sheet: str = Field(default="", description="Sheet name for excel")
    delimiter: str = ","
    expression: str = Field(default="", description="Power Query M code for kind m")


class TableSpec(BaseModel):
    name: str
    source: SourceSpec
    columns: list[ColumnSpec] = Field(description="Every column the table has, in source order")
    measures: list[MeasureSpec] = Field(default_factory=list)
    hidden: bool = False
    description: str = ""


class RelationshipSpec(BaseModel):
    from_table: str = Field(description="The many side, usually the fact table")
    from_column: str
    to_table: str = Field(description="The one side, usually a dimension table with unique keys")
    to_column: str
    cross_filter: Literal["single", "both"] = "single"
    active: bool = True


class FieldRefSpec(BaseModel):
    table: str
    name: str
    kind: Literal["column", "measure"] = "column"
    aggregation: Literal["sum", "average", "count", "distinct_count", "min", "max"] | None = Field(default=None, description="Only for a column used as a value in a card or chart")


class VisualSpec(BaseModel):
    id: str = Field(description="A short unique id on its page, letters digits dashes underscores, never changed later")
    type: Literal["card", "column_chart", "bar_chart", "line_chart", "area_chart", "pie_chart", "donut_chart", "table", "slicer"] = Field(
        description="card: one value; charts: a category plus values; table: columns in values; slicer: a column as category"
    )
    title: str = ""
    category: FieldRefSpec | None = None
    values: list[FieldRefSpec] = Field(default_factory=list)
    x: float | None = Field(default=None, description="Optional position; leave out to let the layout place it")
    y: float | None = None
    width: float | None = None
    height: float | None = None
    hidden: bool = False


class PageSpec(BaseModel):
    id: str = Field(description="A short unique page id, never changed later")
    title: str
    visuals: list[VisualSpec] = Field(default_factory=list)
    hidden: bool = False


class PowerBiSpec(BaseModel):
    name: str = Field(description="The project name, letters digits spaces dashes underscores")
    tables: list[TableSpec]
    relationships: list[RelationshipSpec] = Field(default_factory=list)
    pages: list[PageSpec] = Field(default_factory=list)
