import asyncio
import json
import re
import sqlite3
import subprocess
from dataclasses import dataclass
from datetime import date, datetime, time
from decimal import Decimal
from pathlib import Path
from typing import Any, Callable, Literal

from pydantic import BaseModel, Field

from app.actions.errors import ActionError
from app.installer import NO_WINDOW

MAX_ROWS = 50
MAX_TABLES = 100
MAX_COLUMNS = 60
CONNECT_TIMEOUT_SECONDS = 20
QUERY_TIMEOUT_SECONDS = 30
CREDENTIAL_TIMEOUT_SECONDS = 180
NAME_PATTERN = re.compile(r"^[A-Za-z0-9_-]{1,40}$")
SERVER_PATTERN = re.compile(r"^[A-Za-z0-9_.\-\\,:() ]{1,200}$")
DATABASE_PATTERN = re.compile(r"^[A-Za-z0-9_.\- ]{1,128}$")
DRIVER_PATTERN = re.compile(r"^(ODBC Driver \d+ for SQL Server|SQL Server)$")
STRING_PATTERN = re.compile(r"'(?:[^']|'')*'")
BRACKET_PATTERN = re.compile(r"\[[^\]]*\]")
QUOTED_PATTERN = re.compile(r'"(?:[^"]|"")*"')
BLOCK_COMMENT_PATTERN = re.compile(r"/\*.*?\*/", re.DOTALL)
LINE_COMMENT_PATTERN = re.compile(r"--[^\n]*")
FORBIDDEN_PATTERN = re.compile(
    r"(?<![a-z0-9_])(insert|update|delete|drop|alter|create|truncate|merge|exec|execute|grant|revoke|deny|backup|restore|shutdown|into|openrowset|openquery|opendatasource|"
    r"bulk|attach|detach|pragma|vacuum|reindex|load_extension|waitfor|dbcc|reconfigure|kill)(?![a-z0-9_])|(?<![a-z0-9_])(xp_|sp_)[a-z0-9_]*",
    re.IGNORECASE,
)
CREDENTIAL_SCRIPT = (
    "$ErrorActionPreference = 'Stop'; "
    "$c = Get-Credential -Message $env:WORKZEN_PROMPT; "
    "if ($c) { @{ user = $c.UserName; password = $c.GetNetworkCredential().Password } | ConvertTo-Json -Compress }"
)

CredentialAsker = Callable[[str], tuple[str, str] | None]


class ConnectArgs(BaseModel):
    name: str = Field(description="A short name for this connection")
    kind: Literal["sqlite", "sql_server"]
    path: str = Field(default="", max_length=400)
    server: str = Field(default="", max_length=200)
    database: str = Field(default="", max_length=128)
    auth: Literal["windows", "sql", "entra_interactive"] = "windows"
    driver: str = Field(default="ODBC Driver 18 for SQL Server", max_length=60)
    encrypt: bool = True
    trust_server_certificate: bool = False


class SchemaArgs(BaseModel):
    connection: str
    schema_name: str = Field(default="", max_length=128)
    table: str = Field(default="", max_length=128)


class QueryArgs(BaseModel):
    connection: str
    sql: str = Field(min_length=1, max_length=8000)
    max_rows: int = Field(default=MAX_ROWS, ge=1, le=MAX_ROWS)


class NameArgs(BaseModel):
    connection: str


def strip_sql(sql: str) -> str:
    cleaned = BLOCK_COMMENT_PATTERN.sub(" ", sql)
    cleaned = LINE_COMMENT_PATTERN.sub(" ", cleaned)
    cleaned = STRING_PATTERN.sub("''", cleaned)
    cleaned = BRACKET_PATTERN.sub("[x]", cleaned)
    return QUOTED_PATTERN.sub('"x"', cleaned)


def ensure_read_only(sql: str) -> str:
    text = sql.strip().rstrip(";").strip()
    if not text:
        raise ActionError("The SQL is empty.")
    stripped = strip_sql(text)
    if ";" in stripped:
        raise ActionError("Only one statement is allowed.")
    first = stripped.split(None, 1)[0].lower() if stripped.split() else ""
    if first not in ("select", "with"):
        raise ActionError("Only read-only SELECT queries are allowed (a statement may start with SELECT or WITH).")
    found = FORBIDDEN_PATTERN.search(stripped)
    if found:
        raise ActionError(f"The word '{found.group(0).strip()}' is not allowed. Only read-only SELECT queries can run.")
    return text


def json_safe(value: Any) -> Any:
    if value is None or isinstance(value, (bool, int, float, str)):
        return value
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, (datetime, date, time)):
        return value.isoformat()
    if isinstance(value, (bytes, bytearray)):
        return f"<binary {len(value)} bytes>"
    return str(value)


def short_error(error: Exception) -> str:
    text = " ".join(str(error).split())
    return text[:500] or error.__class__.__name__


def ask_windows_credentials(prompt: str) -> tuple[str, str] | None:
    import os

    environment = {**os.environ, "WORKZEN_PROMPT": prompt}
    try:
        result = subprocess.run(
            ["powershell", "-NoProfile", "-STA", "-Command", CREDENTIAL_SCRIPT],
            capture_output=True,
            text=True,
            timeout=CREDENTIAL_TIMEOUT_SECONDS,
            creationflags=NO_WINDOW,
            env=environment,
            check=False,
        )
    except subprocess.TimeoutExpired:
        return None
    output = result.stdout.strip()
    if not output:
        return None
    data = json.loads(output)
    return data["user"], data["password"]


@dataclass
class Connection:
    name: str
    kind: str
    label: str
    handle: Any


class DatabaseManager:
    def __init__(self, ask_credentials: CredentialAsker = ask_windows_credentials):
        self.ask_credentials = ask_credentials
        self.connections: dict[str, Connection] = {}
        self.lock = asyncio.Lock()

    def find(self, name: str) -> Connection:
        connection = self.connections.get(name)
        if connection is None:
            known = ", ".join(self.connections) or "none"
            raise ActionError(f"There is no open connection called '{name}'. Open connections: {known}.")
        return connection

    def open_sqlite(self, parsed: ConnectArgs) -> Connection:
        path = Path(parsed.path).expanduser()
        if not parsed.path or not path.is_file():
            raise ActionError("The SQLite file was not found. Give the full path of an existing .db or .sqlite file.")
        try:
            handle = sqlite3.connect(f"{path.resolve().as_uri()}?mode=ro", uri=True, check_same_thread=False, timeout=QUERY_TIMEOUT_SECONDS)
            handle.execute("PRAGMA query_only = ON")
            handle.execute("SELECT name FROM sqlite_master LIMIT 1").fetchall()
        except sqlite3.Error as error:
            raise ActionError(f"The SQLite file could not be opened. {short_error(error)}") from error
        return Connection(parsed.name, "sqlite", path.name, handle)

    def build_sql_server_string(self, parsed: ConnectArgs, credentials: tuple[str, str] | None) -> str:
        if not SERVER_PATTERN.match(parsed.server):
            raise ActionError("The server name has characters that are not allowed.")
        if not DATABASE_PATTERN.match(parsed.database):
            raise ActionError("The database name has characters that are not allowed.")
        if not DRIVER_PATTERN.match(parsed.driver):
            raise ActionError("Use the driver 'ODBC Driver 18 for SQL Server' (or 17).")
        parts = [
            f"DRIVER={{{parsed.driver}}}",
            f"SERVER={parsed.server}",
            f"DATABASE={parsed.database}",
            f"Encrypt={'yes' if parsed.encrypt else 'no'}",
            f"TrustServerCertificate={'yes' if parsed.trust_server_certificate else 'no'}",
            "ApplicationIntent=ReadOnly",
        ]
        if parsed.auth == "windows":
            parts.append("Trusted_Connection=yes")
        elif parsed.auth == "entra_interactive":
            parts.append("Authentication=ActiveDirectoryInteractive")
        else:
            user, password = credentials or ("", "")
            parts.append(f"UID={{{user.replace('}', '}}')}}}")
            parts.append(f"PWD={{{password.replace('}', '}}')}}}")
        return ";".join(parts)

    def open_sql_server(self, parsed: ConnectArgs) -> Connection:
        try:
            import pyodbc
        except ImportError as error:
            raise ActionError("SQL Server support is not installed in this Co-worker app. Update the app.") from error
        if not parsed.server or not parsed.database:
            raise ActionError("A SQL Server connection needs a server and a database.")
        credentials = None
        if parsed.auth == "sql":
            credentials = self.ask_credentials(f"WorkZen Co-worker: SQL login for {parsed.server} / {parsed.database}. Your password stays on this computer.")
            if credentials is None:
                raise ActionError("The sign-in window was closed, so nothing was connected.")
        text = self.build_sql_server_string(parsed, credentials)
        if parsed.driver not in pyodbc.drivers():
            raise ActionError(f"The driver '{parsed.driver}' is not installed on this computer. Installed drivers: {', '.join(pyodbc.drivers()) or 'none'}.")
        try:
            handle = pyodbc.connect(text, timeout=CONNECT_TIMEOUT_SECONDS, autocommit=True)
            handle.timeout = QUERY_TIMEOUT_SECONDS
            handle.cursor().execute("SELECT 1").fetchall()
        except Exception as error:
            raise ActionError(f"The database connection failed. {short_error(error)}") from error
        return Connection(parsed.name, "sql_server", f"{parsed.server}/{parsed.database}", handle)

    def connect_now(self, args: dict) -> dict:
        parsed = ConnectArgs(**args)
        if not NAME_PATTERN.match(parsed.name):
            raise ActionError("The connection name may use letters, digits, dashes and underscores only.")
        if parsed.name in self.connections:
            self.close_now(parsed.name)
        connection = self.open_sqlite(parsed) if parsed.kind == "sqlite" else self.open_sql_server(parsed)
        self.connections[parsed.name] = connection
        return {"connection": parsed.name, "kind": connection.kind, "target": connection.label, "read_only": True}

    def schema_now(self, args: dict) -> dict:
        parsed = SchemaArgs(**args)
        connection = self.find(parsed.connection)
        if connection.kind == "sqlite":
            return self.sqlite_schema(connection, parsed)
        return self.sql_server_schema(connection, parsed)

    def sqlite_schema(self, connection: Connection, parsed: SchemaArgs) -> dict:
        cursor = connection.handle.cursor()
        rows = cursor.execute("SELECT name, type FROM sqlite_master WHERE type IN ('table', 'view') AND name NOT LIKE 'sqlite_%' ORDER BY name").fetchall()
        tables = []
        for name, kind in rows:
            if parsed.table and parsed.table.lower() not in name.lower():
                continue
            if len(tables) >= MAX_TABLES:
                break
            escaped = name.replace('"', '""')
            columns = [{"name": row[1], "type": row[2] or "", "key": bool(row[5])} for row in cursor.execute(f'PRAGMA table_info("{escaped}")').fetchall()]
            count = cursor.execute(f'SELECT COUNT(*) FROM "{escaped}"').fetchone()[0] if kind == "table" else None
            tables.append({"schema": "main", "name": name, "kind": kind, "rows": count, "columns": columns[:MAX_COLUMNS]})
        return {"connection": connection.name, "tables": tables}

    def sql_server_schema(self, connection: Connection, parsed: SchemaArgs) -> dict:
        sql = (
            "SELECT c.TABLE_SCHEMA, c.TABLE_NAME, t.TABLE_TYPE, c.COLUMN_NAME, c.DATA_TYPE, c.IS_NULLABLE "
            "FROM INFORMATION_SCHEMA.COLUMNS c JOIN INFORMATION_SCHEMA.TABLES t ON t.TABLE_SCHEMA = c.TABLE_SCHEMA AND t.TABLE_NAME = c.TABLE_NAME "
            "WHERE (? = '' OR c.TABLE_SCHEMA = ?) AND (? = '' OR c.TABLE_NAME LIKE ?) ORDER BY c.TABLE_SCHEMA, c.TABLE_NAME, c.ORDINAL_POSITION"
        )
        pattern = f"%{parsed.table}%" if parsed.table else ""
        try:
            rows = connection.handle.cursor().execute(sql, parsed.schema_name, parsed.schema_name, parsed.table, pattern).fetchall()
        except Exception as error:
            raise ActionError(f"The schema could not be read. {short_error(error)}") from error
        grouped: dict[tuple[str, str], dict] = {}
        for schema, name, table_type, column, data_type, nullable in rows:
            key = (schema, name)
            if key not in grouped:
                if len(grouped) >= MAX_TABLES:
                    continue
                grouped[key] = {"schema": schema, "name": name, "kind": "view" if table_type == "VIEW" else "table", "columns": []}
            if len(grouped[key]["columns"]) < MAX_COLUMNS:
                grouped[key]["columns"].append({"name": column, "type": data_type, "nullable": nullable == "YES"})
        return {"connection": connection.name, "tables": list(grouped.values())}

    def query_now(self, args: dict) -> dict:
        parsed = QueryArgs(**args)
        connection = self.find(parsed.connection)
        sql = ensure_read_only(parsed.sql)
        try:
            cursor = connection.handle.cursor()
            cursor.execute(sql)
            if cursor.description is None:
                raise ActionError("The query returned no result set.")
            columns = [column[0] for column in cursor.description]
            fetched = cursor.fetchmany(parsed.max_rows + 1)
        except ActionError:
            raise
        except Exception as error:
            raise ActionError(f"The query failed. {short_error(error)}") from error
        rows = [[json_safe(value) for value in row] for row in fetched[: parsed.max_rows]]
        return {"connection": connection.name, "columns": columns, "rows": rows, "row_count": len(rows), "truncated": len(fetched) > parsed.max_rows}

    def close_now(self, name: str) -> None:
        connection = self.connections.pop(name, None)
        if connection is not None:
            try:
                connection.handle.close()
            except Exception:
                return

    async def connect(self, args: dict) -> dict:
        async with self.lock:
            return await asyncio.to_thread(self.connect_now, args)

    async def schema(self, args: dict) -> dict:
        async with self.lock:
            return await asyncio.to_thread(self.schema_now, args)

    async def query(self, args: dict) -> dict:
        async with self.lock:
            return await asyncio.to_thread(self.query_now, args)

    async def disconnect(self, args: dict) -> dict:
        parsed = NameArgs(**args)
        async with self.lock:
            self.find(parsed.connection)
            self.close_now(parsed.connection)
        return {"connection": parsed.connection, "closed": True}

    async def shutdown(self) -> None:
        async with self.lock:
            for name in list(self.connections):
                self.close_now(name)