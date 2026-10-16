import re
from typing import Literal

from pydantic import BaseModel, Field, field_validator, model_validator

NAME_PATTERN = re.compile(r"^[^\x00-\x1f\[\]'\"]{1,80}$")
ID_PATTERN = re.compile(r"^[A-Za-z0-9_-]{1,40}$")
PROJECT_PATTERN = re.compile(r"^[A-Za-z0-9][A-Za-z0-9 _-]{0,59}$")
MAX_INLINE_ROWS = 500
MAX_TABLES = 30
MAX_COLUMNS = 80
MAX_MEASURES = 80
MAX_PAGES = 10
MAX_VISUALS = 30
MAX_DAX_CHARACTERS = 4000

ColumnType = Literal["string", "int64", "double", "decimal", "boolean", "dateTime"]
Aggregation = Literal["sum", "average", "count", "distinct_count", "min", "max"]
VisualType = Literal["card", "column_chart", "bar_chart", "line_chart", "area_chart", "pie_chart", "donut_chart", "table", "slicer"]


def checked_name(value: str) -> str:
    if value != value.strip() or not NAME_PATTERN.match(value):
        raise ValueError("must be 1-80 characters, without leading or trailing spaces, quotes, square brackets or control characters")
    return value


class Column(BaseModel):
    name: str
    type: ColumnType = "string"
    format_string: str = Field(default="", max_length=60)
    summarize_by: Literal["none", "sum", "average", "min", "max", "count"] = "none"
    hidden: bool = False
    description: str = Field(default="", max_length=300)

    @field_validator("name")
    @classmethod
    def valid_name(cls, value: str) -> str:
        return checked_name(value)


class Measure(BaseModel):
    name: str
    expression: str = Field(min_length=1, max_length=MAX_DAX_CHARACTERS)
    format_string: str = Field(default="", max_length=60)
    description: str = Field(default="", max_length=300)
    display_folder: str = Field(default="", max_length=60)

    @field_validator("name")
    @classmethod
    def valid_name(cls, value: str) -> str:
        return checked_name(value)


class Source(BaseModel):
    kind: Literal["inline", "sql_server", "csv", "excel", "m"]
    rows: list[list[str | int | float | bool | None]] = Field(default_factory=list, max_length=MAX_INLINE_ROWS)
    server: str = Field(default="", max_length=200)
    database: str = Field(default="", max_length=128)
    schema_name: str = Field(default="dbo", max_length=128)
    table: str = Field(default="", max_length=128)
    query: str = Field(default="", max_length=MAX_DAX_CHARACTERS)
    path: str = Field(default="", max_length=400)
    sheet: str = Field(default="", max_length=100)
    delimiter: str = Field(default=",", max_length=1)
    expression: str = Field(default="", max_length=MAX_DAX_CHARACTERS)

    @model_validator(mode="after")
    def complete_for_kind(self):
        if self.kind == "sql_server" and not (self.server and self.database and (self.table or self.query)):
            raise ValueError("a sql_server source needs server, database and either table or query")
        if self.kind in ("csv", "excel") and not self.path:
            raise ValueError(f"a {self.kind} source needs path")
        if self.kind == "excel" and not self.sheet:
            raise ValueError("an excel source needs sheet")
        if self.kind == "m" and not self.expression.strip():
            raise ValueError("an m source needs expression")
        return self


class Table(BaseModel):
    name: str
    source: Source
    columns: list[Column] = Field(min_length=1, max_length=MAX_COLUMNS)
    measures: list[Measure] = Field(default_factory=list, max_length=MAX_MEASURES)
    hidden: bool = False
    description: str = Field(default="", max_length=300)

    @field_validator("name")
    @classmethod
    def valid_name(cls, value: str) -> str:
        return checked_name(value)


class Relationship(BaseModel):
    from_table: str
    from_column: str
    to_table: str
    to_column: str
    cross_filter: Literal["single", "both"] = "single"
    active: bool = True


class FieldRef(BaseModel):
    table: str
    name: str
    kind: Literal["column", "measure"] = "column"
    aggregation: Aggregation | None = None


class Visual(BaseModel):
    id: str
    type: VisualType
    title: str = Field(default="", max_length=120)
    category: FieldRef | None = None
    values: list[FieldRef] = Field(default_factory=list, max_length=12)
    x: float | None = Field(default=None, ge=0)
    y: float | None = Field(default=None, ge=0)
    width: float | None = Field(default=None, gt=0)
    height: float | None = Field(default=None, gt=0)
    hidden: bool = False

    @field_validator("id")
    @classmethod
    def valid_id(cls, value: str) -> str:
        if not ID_PATTERN.match(value):
            raise ValueError("must be 1-40 letters, digits, dashes or underscores")
        return value


class Page(BaseModel):
    id: str
    title: str = Field(min_length=1, max_length=80)
    visuals: list[Visual] = Field(default_factory=list, max_length=MAX_VISUALS)
    hidden: bool = False

    @field_validator("id")
    @classmethod
    def valid_id(cls, value: str) -> str:
        if not ID_PATTERN.match(value):
            raise ValueError("must be 1-40 letters, digits, dashes or underscores")
        return value


class ProjectSpec(BaseModel):
    name: str
    tables: list[Table] = Field(min_length=1, max_length=MAX_TABLES)
    relationships: list[Relationship] = Field(default_factory=list, max_length=60)
    pages: list[Page] = Field(default_factory=list, max_length=MAX_PAGES)

    @field_validator("name")
    @classmethod
    def valid_name(cls, value: str) -> str:
        if not PROJECT_PATTERN.match(value) or value != value.strip():
            raise ValueError("must start with a letter or digit and use only letters, digits, spaces, dashes or underscores (up to 60)")
        return value