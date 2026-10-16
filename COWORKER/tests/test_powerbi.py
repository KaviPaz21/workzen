import copy
import json
from pathlib import Path

import pytest
from jsonschema import Draft7Validator
from referencing import Registry, Resource
from referencing.jsonschema import DRAFT7

from app.actions.powerbi import launcher
from app.actions.powerbi.project import MARKER

SCHEMAS = Path(__file__).parent / "schemas"
SCHEMA_ROOT = "https://developer.microsoft.com/json-schemas/"

SPEC = {
    "name": "Sales Demo",
    "tables": [
        {
            "name": "Sales",
            "source": {"kind": "inline", "rows": [[1, "2025-01-05", "Laptop", 3, 2400.0], [2, "2025-01-09", "Phone", 5, 2500.5]]},
            "columns": [{"name": "Sale ID", "type": "int64"}, {"name": "Order Date", "type": "dateTime"}, {"name": "Product", "type": "string"}, {"name": "Quantity", "type": "int64"}, {"name": "Amount", "type": "double"}],
            "measures": [
                {"name": "Total Sales", "expression": "SUM(Sales[Amount])", "format_string": "#,0.00"},
                {"name": "Average Sale", "expression": "DIVIDE([Total Sales], COUNTROWS(Sales))"},
            ],
        },
        {"name": "Product", "source": {"kind": "inline", "rows": [["Laptop", "Computers"], ["Phone", "Mobile"]]}, "columns": [{"name": "Product", "type": "string"}, {"name": "Category", "type": "string"}]},
    ],
    "relationships": [{"from_table": "Sales", "from_column": "Product", "to_table": "Product", "to_column": "Product"}],
    "pages": [
        {
            "id": "overview",
            "title": "Overview",
            "visuals": [
                {"id": "k1", "type": "card", "title": "Total sales", "values": [{"table": "Sales", "name": "Total Sales", "kind": "measure"}]},
                {"id": "s1", "type": "slicer", "category": {"table": "Product", "name": "Category"}},
                {"id": "c1", "type": "column_chart", "title": "By product", "category": {"table": "Sales", "name": "Product"}, "values": [{"table": "Sales", "name": "Total Sales", "kind": "measure"}]},
                {"id": "l1", "type": "line_chart", "category": {"table": "Sales", "name": "Order Date"}, "values": [{"table": "Sales", "name": "Amount", "aggregation": "sum"}]},
                {"id": "t1", "type": "table", "values": [{"table": "Sales", "name": "Sale ID"}, {"table": "Sales", "name": "Product"}]},
            ],
        }
    ],
}


def act(client, auth, name, args):
    return client.post(f"/actions/{name}", json={"args": args}, headers=auth).json()


def spec_with(**changes):
    spec = copy.deepcopy(SPEC)
    spec.update(changes)
    return spec


def problems_of(client, auth, spec):
    result = act(client, auth, "powerbi_validate_model", {"spec": spec})
    assert result["ok"], result
    return result["result"]


def test_a_correct_model_passes_without_problems(client, auth):
    result = problems_of(client, auth, SPEC)
    assert result["valid"] is True and result["errors"] == [] and result["warnings"] == []


def edit(path, value):
    spec = copy.deepcopy(SPEC)
    target = spec
    for part in path[:-1]:
        target = target[part]
    target[path[-1]] = value
    return spec


@pytest.mark.parametrize(
    "path,value,expected",
    [
        (["tables", 0, "measures", 0, "expression"], "SUM(Sale[Amount])", "table 'Sale' does not exist"),
        (["tables", 0, "measures", 0, "expression"], "SUM(Sales[Ammount])", "no column or measure called 'Ammount'"),
        (["tables", 0, "measures", 0, "expression"], "SUM(Sales[Amount]", "not balanced"),
        (["tables", 0, "measures", 0, "expression"], "= SUM(Sales[Amount])", "do not start the expression with '='"),
        (["tables", 0, "measures", 0, "expression"], "SUM(Sales[Product])", "SUM needs a number column"),
        (["tables", 0, "measures", 1, "expression"], "DIVIDE([Total Sale], COUNTROWS(Sales))", "[Total Sale] is not a measure"),
        (["tables", 0, "measures", 0, "name"], "Amount", "same name as a column"),
        (["relationships", 0, "from_column"], "Quantity", "types differ"),
        (["relationships", 0, "to_table"], "Products", "table 'Products' does not exist"),
        (["tables", 0, "source", "rows", 0], [1, "2025-01-05", "Laptop", 3], "has 4 values but there are 5 columns"),
        (["tables", 0, "source", "rows", 0], [1, "yesterday", "Laptop", 3, 1.0], "not an ISO date"),
        (["tables", 0, "source", "rows", 0], [1, "2025-01-05", "Laptop", 3, "lots"], "is double but the value"),
        (["pages", 0, "visuals", 0, "values", 0, "name"], "Missing", "no measure called 'Missing'"),
        (["pages", 0, "visuals", 2, "values", 0], {"table": "Sales", "name": "Amount"}, "without an aggregation"),
        (["pages", 0, "visuals", 0, "category"], {"table": "Sales", "name": "Product"}, "a card shows exactly one value"),
        (["pages", 0, "visuals", 1, "values"], [{"table": "Sales", "name": "Amount", "aggregation": "sum"}], "a slicer needs one column"),
    ],
)
def test_model_problems_are_found_with_a_plain_message(client, auth, path, value, expected):
    result = problems_of(client, auth, edit(path, value))
    assert result["valid"] is False
    assert any(expected in error for error in result["errors"]), result["errors"]


def test_unknown_dax_functions_are_flagged_as_warnings(client, auth):
    spec = edit(["tables", 0, "measures", 0, "expression"], "SUMM(Sales[Amount])")
    result = problems_of(client, auth, spec)
    assert result["valid"] is True and any("SUMM" in warning for warning in result["warnings"])


def test_sql_sources_must_be_read_only(client, auth):
    spec = spec_with()
    spec["tables"][1]["source"] = {"kind": "sql_server", "server": "sql01", "database": "dw", "query": "DELETE FROM Product"}
    assert any("not allowed" in error for error in problems_of(client, auth, spec)["errors"])


def test_a_bad_description_is_rejected_with_the_field_names(client, auth):
    result = act(client, auth, "powerbi_validate_model", {"spec": {"name": "x!", "tables": []}})
    assert result["ok"] is False and "name" in result["error"] and "tables" in result["error"]


@pytest.fixture
def project(client, auth):
    result = act(client, auth, "powerbi_create_project", {"spec": SPEC})
    assert result["ok"], result
    return result["result"]


def local_registry():
    resources = []
    for file in SCHEMAS.glob("*.json"):
        document = json.loads(file.read_text(encoding="utf-8"))
        if "$id" in document:
            resources.append((document["$id"], Resource.from_contents(document, default_specification=DRAFT7)))

    def retrieve(uri):
        name = uri.replace(SCHEMA_ROOT, "").replace("/", "__")
        return Resource.from_contents(json.loads((SCHEMAS / name).read_text(encoding="utf-8")), default_specification=DRAFT7)

    return Registry(retrieve=retrieve).with_resources(resources)


def assert_valid(file: Path, schema_name: str, registry):
    schema = json.loads((SCHEMAS / schema_name).read_text(encoding="utf-8"))
    errors = list(Draft7Validator(schema, registry=registry).iter_errors(json.loads(file.read_text(encoding="utf-8"))))
    assert not errors, f"{file.name}: {errors[0].message}"


def test_the_project_is_written_in_the_power_bi_project_format(project):
    folder = Path(project["folder"])
    assert project["path"].endswith("Sales Demo.pbip") and (folder / MARKER).is_file()
    assert (project["tables"], project["measures"], project["relationships"], project["pages"], project["visuals"]) == (2, 2, 1, 1, 5)
    model = folder / "Sales Demo.SemanticModel" / "definition"
    sales = (model / "tables" / "Sales.tmdl").read_text(encoding="utf-8")
    assert "table Sales" in sales and "measure 'Total Sales' = SUM(Sales[Amount])" in sales and "column 'Sale ID'" in sales
    assert "dataType: dateTime" in sales and "partition Sales = m" in sales and "#table(type table" in sales and '#datetime(2025, 1, 5, 0, 0, 0)' in sales
    assert "ref table Sales" in (model / "model.tmdl").read_text(encoding="utf-8")
    relationship = (model / "relationships.tmdl").read_text(encoding="utf-8")
    assert "fromColumn: Sales.Product" in relationship and "toColumn: Product.Product" in relationship
    assert all("\t" in line or not line.startswith(" ") for line in sales.splitlines())


def test_every_json_file_passes_the_official_microsoft_schema(project):
    registry = local_registry()
    folder = Path(project["folder"])
    report = folder / "Sales Demo.Report"
    assert_valid(report / "definition.pbir", "report__definitionProperties__2.0.0__schema.json", registry)
    assert_valid(report / "definition" / "report.json", "report__definition__report__3.0.0__schema.json", registry)
    assert_valid(report / "definition" / "version.json", "report__definition__versionMetadata__1.0.0__schema.json", registry)
    assert_valid(report / "definition" / "pages" / "pages.json", "report__definition__pagesMetadata__1.1.0__schema.json", registry)
    assert_valid(folder / "Sales Demo.SemanticModel" / "definition.pbism", "semanticModel__definitionProperties__1.0.0__schema.json", registry)
    for page in report.glob("definition/pages/*/page.json"):
        assert_valid(page, "report__definition__page__2.0.0__schema.json", registry)
    visuals = list(report.glob("definition/pages/*/visuals/*/visual.json"))
    assert len(visuals) == 5
    for visual in visuals:
        assert_valid(visual, "report__definition__visualContainer__2.0.0__schema.json", registry)


def test_visuals_are_laid_out_without_overlapping(project):
    boxes = []
    for file in Path(project["folder"]).glob("Sales Demo.Report/definition/pages/*/visuals/*/visual.json"):
        position = json.loads(file.read_text(encoding="utf-8"))["position"]
        boxes.append((position["x"], position["y"], position["x"] + position["width"], position["y"] + position["height"]))
    for index, first in enumerate(boxes):
        for second in boxes[index + 1 :]:
            assert first[2] <= second[0] or second[2] <= first[0] or first[3] <= second[1] or second[3] <= first[1], (first, second)
        assert first[2] <= 1280


def test_a_second_project_with_the_same_name_gets_its_own_folder(client, auth, project):
    second = act(client, auth, "powerbi_create_project", {"spec": SPEC})["result"]
    assert second["project"] == "Sales Demo (2)" and Path(second["path"]).name == "Sales Demo (2).pbip" and Path(second["path"]).is_file()


def test_nothing_is_written_when_the_model_has_errors(client, auth, settings):
    broken = edit(["tables", 0, "measures", 0, "expression"], "SUM(Nope[Amount])")
    result = act(client, auth, "powerbi_create_project", {"spec": broken})
    assert result["ok"] is False and "Fix these problems first" in result["error"]
    assert list(Path(settings.coworker_workspace).glob("*")) == []


def test_a_project_can_be_extended_but_never_shrunk(client, auth, project):
    extended = copy.deepcopy(SPEC)
    extended["tables"][0]["measures"].append({"name": "Units", "expression": "SUM(Sales[Quantity])"})
    extended["pages"][0]["visuals"].append({"id": "k2", "type": "card", "values": [{"table": "Sales", "name": "Units", "kind": "measure"}]})
    updated = act(client, auth, "powerbi_update_project", {"project": "Sales Demo", "spec": extended})
    assert updated["ok"], updated
    assert updated["result"]["measures"] == 3 and updated["result"]["visuals"] == 6
    assert "measure Units = SUM(Sales[Quantity])" in (Path(project["folder"]) / "Sales Demo.SemanticModel/definition/tables/Sales.tmdl").read_text(encoding="utf-8")

    shrunk = copy.deepcopy(extended)
    shrunk["pages"][0]["visuals"].pop()
    refused = act(client, auth, "powerbi_update_project", {"project": "Sales Demo", "spec": shrunk})
    assert refused["ok"] is False and "cannot remove" in refused["error"] and "hidden" in refused["error"]
    no_table = copy.deepcopy(extended)
    no_table["tables"].pop()
    no_table["relationships"] = []
    no_table["pages"][0]["visuals"] = [visual for visual in no_table["pages"][0]["visuals"] if visual["id"] != "s1"]
    assert "cannot remove" in act(client, auth, "powerbi_update_project", {"project": "Sales Demo", "spec": no_table})["error"]

    hidden = copy.deepcopy(extended)
    hidden["pages"][0]["visuals"][0]["hidden"] = True
    assert act(client, auth, "powerbi_update_project", {"project": "Sales Demo", "spec": hidden})["ok"]
    visual = next(Path(project["folder"]).glob("Sales Demo.Report/definition/pages/*/visuals/*/visual.json"))
    flags = [json.loads(file.read_text(encoding="utf-8")).get("isHidden") for file in Path(project["folder"]).glob("Sales Demo.Report/definition/pages/*/visuals/*/visual.json")]
    assert flags.count(True) == 1 and visual.is_file()


def test_only_projects_made_by_co_worker_can_be_changed(client, auth, settings):
    foreign = Path(settings.coworker_workspace) / "Other"
    foreign.mkdir(parents=True)
    assert "not a Power BI project created by Co-worker" in act(client, auth, "powerbi_update_project", {"project": "Other", "spec": SPEC})["error"]
    assert act(client, auth, "powerbi_read_spec", {"project": "..\\x"})["ok"] is False


def test_the_stored_description_can_be_read_back(client, auth, project):
    stored = act(client, auth, "powerbi_read_spec", {"project": "Sales Demo"})["result"]
    assert stored["spec"]["tables"][0]["name"] == "Sales" and stored["path"].endswith("Sales Demo.pbip")


@pytest.mark.parametrize(
    "source,expected",
    [
        ({"kind": "sql_server", "server": "sql01", "database": "dw", "schema_name": "dbo", "table": "Sales"}, ['Sql.Database("sql01", "dw")', 'Item = "Sales"']),
        ({"kind": "sql_server", "server": "sql01", "database": "dw", "query": "SELECT 1 AS A"}, ['[Query = "SELECT 1 AS A"]']),
        ({"kind": "csv", "path": "C:\\data\\sales.csv"}, ["Csv.Document(File.Contents(", "Table.PromoteHeaders", "Table.TransformColumnTypes"]),
        ({"kind": "excel", "path": "C:\\data\\book.xlsx", "sheet": "Sales"}, ["Excel.Workbook(", 'Item = "Sales"']),
        ({"kind": "m", "expression": "let\n    Source = 1\nin\n    Source"}, ["Source = 1"]),
    ],
)
def test_every_source_kind_writes_power_query(client, auth, settings, source, expected):
    spec = spec_with(name="Source Test")
    spec["tables"] = [{"name": "Sales", "source": source, "columns": [{"name": "A", "type": "int64"}]}]
    spec["relationships"] = []
    spec["pages"] = []
    result = act(client, auth, "powerbi_create_project", {"spec": spec})
    assert result["ok"], result
    text = (Path(result["result"]["folder"]) / "Source Test.SemanticModel/definition/tables/Sales.tmdl").read_text(encoding="utf-8")
    for fragment in expected:
        assert fragment in text, fragment
    assert text.count("(") == text.count(")") and text.count("{") == text.count("}")


def test_quotes_and_line_breaks_in_data_cannot_break_the_power_query(client, auth):
    spec = spec_with(name="Quote Test")
    spec["tables"] = [{"name": "Notes", "source": {"kind": "inline", "rows": [['say "hi"\nthere', 1]]}, "columns": [{"name": "Note", "type": "string"}, {"name": "N", "type": "int64"}]}]
    spec["relationships"] = []
    spec["pages"] = []
    result = act(client, auth, "powerbi_create_project", {"spec": spec})["result"]
    text = (Path(result["folder"]) / "Quote Test.SemanticModel/definition/tables/Notes.tmdl").read_text(encoding="utf-8")
    assert '"say ""hi""#(lf)there"' in text


def test_opening_power_bi_needs_a_project_made_here_and_the_app_setting(client, auth, project, monkeypatch, settings):
    assert "switched off" in act(client, auth, "powerbi_open", {"project": "Sales Demo"})["error"]
    opened = []
    monkeypatch.setattr(launcher, "start_desktop", lambda target: opened.append(target) or "Power BI Desktop (test)")
    settings.coworker_launch_apps = True
    result = act(client, auth, "powerbi_open", {"project": "Sales Demo"})
    assert result["ok"] and opened[0].name == "Sales Demo.pbip" and result["result"]["opened"] is True
    assert act(client, auth, "powerbi_open", {"project": "Nope"})["ok"] is False
    assert act(client, auth, "powerbi_open", {})["ok"] and opened[1] is None