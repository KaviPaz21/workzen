import sqlite3
import sys
import types

import pytest

from app.actions.database import DatabaseManager, ensure_read_only
from app.actions.errors import ActionError


@pytest.fixture
def sqlite_file(tmp_path):
    path = tmp_path / "shop.db"
    connection = sqlite3.connect(path)
    connection.execute("CREATE TABLE sales (id INTEGER PRIMARY KEY, product TEXT, amount REAL, created_at TEXT)")
    connection.executemany("INSERT INTO sales (product, amount, created_at) VALUES (?, ?, ?)", [(f"item {number}", number * 1.5, f"2025-01-{number % 28 + 1:02d}") for number in range(1, 121)])
    connection.execute("CREATE VIEW big_sales AS SELECT * FROM sales WHERE amount > 100")
    connection.commit()
    connection.close()
    return path


def manager_with(path):
    manager = DatabaseManager(ask_credentials=lambda prompt: None)
    manager.connect_now({"name": "shop", "kind": "sqlite", "path": str(path)})
    return manager


@pytest.mark.parametrize(
    "sql",
    ["SELECT 1", "select * from sales;", "WITH a AS (SELECT 1 AS x) SELECT * FROM a", "SELECT 'delete me' AS note", "SELECT [Update Date] FROM t", "SELECT created_at, updated_by FROM t", "SELECT -- drop table\n 1"],
)
def test_read_only_queries_are_allowed(sql):
    assert ensure_read_only(sql)


@pytest.mark.parametrize(
    "sql",
    [
        "DELETE FROM sales",
        "UPDATE sales SET amount = 0",
        "INSERT INTO sales VALUES (1)",
        "DROP TABLE sales",
        "SELECT 1; DROP TABLE sales",
        "SELECT * INTO copy FROM sales",
        "EXEC sp_who",
        "SELECT * FROM OPENROWSET('x','y','z')",
        "CREATE TABLE x (a int)",
        "PRAGMA writable_schema = 1",
        "WITH a AS (SELECT 1) DELETE FROM sales",
        "",
        "   ;  ",
        "SHOW TABLES",
    ],
)
def test_anything_that_changes_data_is_refused(sql):
    with pytest.raises(ActionError):
        ensure_read_only(sql)


def test_sqlite_connect_schema_and_query(sqlite_file):
    manager = manager_with(sqlite_file)
    schema = manager.schema_now({"connection": "shop"})
    names = {table["name"]: table for table in schema["tables"]}
    assert set(names) == {"sales", "big_sales"} and names["sales"]["rows"] == 120 and names["big_sales"]["kind"] == "view"
    assert [column["name"] for column in names["sales"]["columns"]] == ["id", "product", "amount", "created_at"]
    assert manager.schema_now({"connection": "shop", "table": "big"})["tables"][0]["name"] == "big_sales"
    result = manager.query_now({"connection": "shop", "sql": "SELECT product, amount FROM sales ORDER BY id LIMIT 3"})
    assert result["columns"] == ["product", "amount"] and result["rows"][0] == ["item 1", 1.5] and result["truncated"] is False
    many = manager.query_now({"connection": "shop", "sql": "SELECT * FROM sales"})
    assert many["row_count"] == 50 and many["truncated"] is True


def test_query_errors_are_reported_so_they_can_be_fixed(sqlite_file):
    manager = manager_with(sqlite_file)
    with pytest.raises(ActionError, match="no such column: amout"):
        manager.query_now({"connection": "shop", "sql": "SELECT amout FROM sales"})
    with pytest.raises(ActionError, match="no such table"):
        manager.query_now({"connection": "shop", "sql": "SELECT * FROM salez"})
    with pytest.raises(ActionError, match="no open connection"):
        manager.query_now({"connection": "other", "sql": "SELECT 1"})


def test_the_database_file_itself_is_opened_read_only(sqlite_file):
    manager = manager_with(sqlite_file)
    handle = manager.find("shop").handle
    with pytest.raises(sqlite3.OperationalError):
        handle.execute("INSERT INTO sales (product) VALUES ('x')")
    assert sqlite3.connect(sqlite_file).execute("SELECT COUNT(*) FROM sales").fetchone()[0] == 120


def test_missing_files_and_bad_names_are_refused(tmp_path):
    manager = DatabaseManager(ask_credentials=lambda prompt: None)
    with pytest.raises(ActionError, match="not found"):
        manager.connect_now({"name": "x", "kind": "sqlite", "path": str(tmp_path / "missing.db")})
    with pytest.raises(ActionError, match="connection name"):
        manager.connect_now({"name": "bad name!", "kind": "sqlite", "path": str(tmp_path)})


class FakeCursor:
    def __init__(self, log):
        self.log = log
        self.description = [("x",)]

    def execute(self, sql, *params):
        self.log.append(sql)
        return self

    def fetchall(self):
        return [(1,)]

    def fetchmany(self, count):
        return [(1,)]


class FakeHandle:
    def __init__(self):
        self.timeout = 0
        self.log = []

    def cursor(self):
        return FakeCursor(self.log)

    def close(self):
        self.log.append("closed")


def install_fake_pyodbc(monkeypatch, drivers=("ODBC Driver 18 for SQL Server",)):
    seen = {}
    module = types.SimpleNamespace(drivers=lambda: list(drivers), connect=lambda text, timeout, autocommit: seen.setdefault("handle", FakeHandle()) if seen.update(text=text) is None else None)
    monkeypatch.setitem(sys.modules, "pyodbc", module)
    return seen


def test_sql_server_windows_login_builds_a_read_only_connection(monkeypatch):
    seen = install_fake_pyodbc(monkeypatch)
    manager = DatabaseManager(ask_credentials=lambda prompt: pytest.fail("must not ask for a password"))
    result = manager.connect_now({"name": "dw", "kind": "sql_server", "server": "tcp:sql01.contoso.com,1433", "database": "Sales DW"})
    assert result["read_only"] is True and result["target"] == "tcp:sql01.contoso.com,1433/Sales DW"
    text = seen["text"]
    assert "DRIVER={ODBC Driver 18 for SQL Server}" in text and "Trusted_Connection=yes" in text and "ApplicationIntent=ReadOnly" in text and "Encrypt=yes" in text and "PWD" not in text


def test_sql_login_asks_on_this_computer_and_never_returns_the_password(monkeypatch):
    seen = install_fake_pyodbc(monkeypatch)
    prompts = []
    manager = DatabaseManager(ask_credentials=lambda prompt: prompts.append(prompt) or ("report_user", "pa;ss}word"))
    result = manager.connect_now({"name": "dw", "kind": "sql_server", "server": "sql01", "database": "dw", "auth": "sql"})
    assert len(prompts) == 1 and "stays on this computer" in prompts[0]
    assert "UID={report_user}" in seen["text"] and "PWD={pa;ss}}word}" in seen["text"]
    assert "pa;ss" not in str(result)


def test_sql_login_cancelled_connects_nothing(monkeypatch):
    install_fake_pyodbc(monkeypatch)
    manager = DatabaseManager(ask_credentials=lambda prompt: None)
    with pytest.raises(ActionError, match="closed"):
        manager.connect_now({"name": "dw", "kind": "sql_server", "server": "sql01", "database": "dw", "auth": "sql"})
    assert manager.connections == {}


def test_entra_interactive_needs_no_password(monkeypatch):
    seen = install_fake_pyodbc(monkeypatch)
    manager = DatabaseManager(ask_credentials=lambda prompt: pytest.fail("must not ask"))
    manager.connect_now({"name": "az", "kind": "sql_server", "server": "myserver.database.windows.net", "database": "db", "auth": "entra_interactive"})
    assert "Authentication=ActiveDirectoryInteractive" in seen["text"]


@pytest.mark.parametrize("field,value", [("server", "x;DRIVER={evil}"), ("database", "db;Trusted_Connection=no"), ("driver", "Evil Driver")])
def test_connection_string_injection_is_refused(monkeypatch, field, value):
    install_fake_pyodbc(monkeypatch)
    manager = DatabaseManager(ask_credentials=lambda prompt: None)
    args = {"name": "dw", "kind": "sql_server", "server": "sql01", "database": "dw", field: value}
    with pytest.raises(ActionError):
        manager.connect_now(args)


def test_a_missing_driver_lists_what_is_installed(monkeypatch):
    install_fake_pyodbc(monkeypatch, drivers=("SQL Server",))
    manager = DatabaseManager(ask_credentials=lambda prompt: None)
    with pytest.raises(ActionError, match="Installed drivers: SQL Server"):
        manager.connect_now({"name": "dw", "kind": "sql_server", "server": "sql01", "database": "dw"})


def test_the_actions_work_through_the_api(client, auth, sqlite_file):
    def act(name, args):
        return client.post(f"/actions/{name}", json={"args": args}, headers=auth).json()

    assert act("db_connect", {"name": "shop", "kind": "sqlite", "path": str(sqlite_file)})["ok"]
    assert act("db_schema", {"connection": "shop"})["result"]["tables"][0]["name"]
    assert act("db_query", {"connection": "shop", "sql": "SELECT COUNT(*) AS n FROM sales"})["result"]["rows"] == [[120]]
    refused = act("db_query", {"connection": "shop", "sql": "DELETE FROM sales"})
    assert refused["ok"] is False and "read-only" in refused["error"].lower()
    assert act("db_disconnect", {"connection": "shop"})["result"]["closed"] is True
    assert act("db_query", {"connection": "shop", "sql": "SELECT 1"})["ok"] is False