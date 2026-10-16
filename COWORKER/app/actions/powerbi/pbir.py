import json
import uuid

from app.actions.powerbi.spec import FieldRef, Page, ProjectSpec, Visual
from app.actions.powerbi.tmdl import NAMESPACE

SCHEMA_BASE = "https://developer.microsoft.com/json-schemas/fabric/item/report"
PROPERTIES_SCHEMA = f"{SCHEMA_BASE}/definitionProperties/2.0.0/schema.json"
REPORT_SCHEMA = f"{SCHEMA_BASE}/definition/report/3.0.0/schema.json"
VERSION_SCHEMA = f"{SCHEMA_BASE}/definition/versionMetadata/1.0.0/schema.json"
PAGES_SCHEMA = f"{SCHEMA_BASE}/definition/pagesMetadata/1.1.0/schema.json"
PAGE_SCHEMA = f"{SCHEMA_BASE}/definition/page/2.0.0/schema.json"
VISUAL_SCHEMA = f"{SCHEMA_BASE}/definition/visualContainer/2.0.0/schema.json"
THEME_NAME = "CY24SU10"
PAGE_WIDTH = 1280
PAGE_HEIGHT = 720
MARGIN = 20
GAP = 16
VISUAL_TYPES = {
    "card": "card",
    "column_chart": "clusteredColumnChart",
    "bar_chart": "clusteredBarChart",
    "line_chart": "lineChart",
    "area_chart": "areaChart",
    "pie_chart": "pieChart",
    "donut_chart": "donutChart",
    "table": "tableEx",
    "slicer": "slicer",
}
DEFAULT_SIZES = {
    "card": (300, 110),
    "slicer": (300, 110),
    "pie_chart": (400, 320),
    "donut_chart": (400, 320),
    "table": (PAGE_WIDTH - 2 * MARGIN, 320),
}
CHART_SIZE = (610, 320)
AGGREGATIONS = {"sum": (0, "Sum"), "average": (1, "Average"), "distinct_count": (2, "DistinctCount"), "min": (3, "Min"), "max": (4, "Max"), "count": (5, "Count")}
QUERY_ROLES = {"card": ("Values", None), "table": ("Values", None), "slicer": ("Values", None)}


def hex_name(*parts: str) -> str:
    return uuid.uuid5(NAMESPACE, "|".join(parts)).hex[:20]


def dumps(value: dict) -> str:
    return json.dumps(value, indent=2, ensure_ascii=False) + "\n"


def projection(ref: FieldRef, active: bool = False) -> dict:
    entity = {"Expression": {"SourceRef": {"Entity": ref.table}}, "Property": ref.name}
    if ref.kind == "measure":
        field, query_ref = {"Measure": entity}, f"{ref.table}.{ref.name}"
    elif ref.aggregation:
        code, label = AGGREGATIONS[ref.aggregation]
        field, query_ref = {"Aggregation": {"Expression": {"Column": entity}, "Function": code}}, f"{label}({ref.table}.{ref.name})"
    else:
        field, query_ref = {"Column": entity}, f"{ref.table}.{ref.name}"
    item = {"field": field, "queryRef": query_ref, "nativeQueryRef": ref.name}
    if active:
        item["active"] = True
    return item


def query_state(visual: Visual) -> dict:
    if visual.type == "slicer":
        return {"Values": {"projections": [projection(visual.category, True)]}}
    if visual.type in ("card", "table"):
        return {"Values": {"projections": [projection(ref) for ref in visual.values]}}
    return {"Category": {"projections": [projection(visual.category, True)]}, "Y": {"projections": [projection(ref) for ref in visual.values]}}


def text_literal(value: str) -> dict:
    escaped = value.replace("'", "''")
    return {"expr": {"Literal": {"Value": f"'{escaped}'"}}}


def visual_json(page: Page, visual: Visual, position: tuple[float, float, float, float], order: int) -> dict:
    x, y, width, height = position
    body = {"visualType": VISUAL_TYPES[visual.type], "query": {"queryState": query_state(visual)}, "drillFilterOtherVisuals": True}
    if visual.title:
        body["visualContainerObjects"] = {"title": [{"properties": {"show": {"expr": {"Literal": {"Value": "true"}}}, "text": text_literal(visual.title)}}]}
    container = {
        "$schema": VISUAL_SCHEMA,
        "name": hex_name("visual", page.id, visual.id),
        "position": {"x": x, "y": y, "z": order * 1000, "height": height, "width": width, "tabOrder": order * 1000},
        "visual": body,
    }
    if visual.hidden:
        container["isHidden"] = True
    return container


def layout(page: Page) -> tuple[list[tuple[float, float, float, float]], int]:
    positions = []
    cursor_x, cursor_y, row_height = MARGIN, MARGIN, 0
    for visual in page.visuals:
        default_width, default_height = DEFAULT_SIZES.get(visual.type, CHART_SIZE)
        width = visual.width or default_width
        height = visual.height or default_height
        if visual.x is not None and visual.y is not None:
            positions.append((visual.x, visual.y, width, height))
            continue
        if cursor_x + width > PAGE_WIDTH - MARGIN and cursor_x > MARGIN:
            cursor_x, cursor_y, row_height = MARGIN, cursor_y + row_height + GAP, 0
        positions.append((cursor_x, cursor_y, width, height))
        cursor_x += width + GAP
        row_height = max(row_height, height)
    bottom = max([y + height for _, y, _, height in positions] + [PAGE_HEIGHT - MARGIN])
    return positions, int(bottom + MARGIN)


def page_json(page: Page, height: int) -> dict:
    body = {"$schema": PAGE_SCHEMA, "name": hex_name("page", page.id), "displayName": page.title, "displayOption": "FitToPage", "height": height, "width": PAGE_WIDTH}
    if page.hidden:
        body["visibility"] = "HiddenInViewMode"
    return body


def report_files(spec: ProjectSpec, model_folder: str) -> dict[str, str]:
    files = {
        "definition.pbir": dumps({"$schema": PROPERTIES_SCHEMA, "version": "4.0", "datasetReference": {"byPath": {"path": f"../{model_folder}"}}}),
        "definition/version.json": dumps({"$schema": VERSION_SCHEMA, "version": "2.0.0"}),
        "definition/report.json": dumps(
            {
                "$schema": REPORT_SCHEMA,
                "themeCollection": {"baseTheme": {"name": THEME_NAME, "reportVersionAtImport": {"visual": "2.0.0", "report": "3.0.0", "page": "2.0.0"}, "type": "SharedResources"}},
                "resourcePackages": [{"name": "SharedResources", "type": "SharedResources", "items": [{"name": THEME_NAME, "path": f"BaseThemes/{THEME_NAME}.json", "type": "BaseTheme"}]}],
            }
        ),
    }
    pages = spec.pages or [Page(id="page1", title="Page 1")]
    order = [hex_name("page", page.id) for page in pages]
    files["definition/pages/pages.json"] = dumps({"$schema": PAGES_SCHEMA, "pageOrder": order, "activePageName": order[0]})
    for page in pages:
        positions, height = layout(page)
        page_folder = f"definition/pages/{hex_name('page', page.id)}"
        files[f"{page_folder}/page.json"] = dumps(page_json(page, height))
        for number, (visual, position) in enumerate(zip(page.visuals, positions)):
            files[f"{page_folder}/visuals/{hex_name('visual', page.id, visual.id)}/visual.json"] = dumps(visual_json(page, visual, position, number))
    return files