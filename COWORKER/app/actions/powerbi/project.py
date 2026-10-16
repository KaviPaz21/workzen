import json
from pathlib import Path

from pydantic import BaseModel, ValidationError

from app.actions.errors import ActionError
from app.actions.paths import free_path, resolve_in_workspace, workspace_folder
from app.actions.powerbi import pbir, tmdl
from app.actions.powerbi.spec import ProjectSpec
from app.actions.powerbi.validate import check_model
from app.config import Settings

MARKER = ".workzen-project.json"
PBIP_SCHEMA = "https://developer.microsoft.com/json-schemas/fabric/pbip/pbipProperties/1.0.0/schema.json"
PBISM_SCHEMA = "https://developer.microsoft.com/json-schemas/fabric/item/semanticModel/definitionProperties/1.0.0/schema.json"


class SpecArgs(BaseModel):
    spec: dict


class UpdateArgs(BaseModel):
    project: str
    spec: dict


class ProjectArgs(BaseModel):
    project: str


def parse_spec(raw: dict) -> ProjectSpec:
    try:
        return ProjectSpec(**raw)
    except ValidationError as error:
        problems = [f"{'.'.join(str(part) for part in item['loc'])}: {item['msg']}" for item in error.errors()[:12]]
        raise ActionError("The model description is not valid. " + " | ".join(problems)) from error


def blocking_problems(spec: ProjectSpec) -> list[str]:
    errors, warnings = check_model(spec)
    if errors:
        raise ActionError("Fix these problems first: " + " | ".join(errors[:15]) + (f" (and {len(errors) - 15} more)" if len(errors) > 15 else ""))
    return warnings


def build_files(spec: ProjectSpec) -> dict[str, str]:
    model_folder = f"{spec.name}.SemanticModel"
    report_folder = f"{spec.name}.Report"
    files = {
        f"{spec.name}.pbip": json.dumps({"$schema": PBIP_SCHEMA, "version": "1.0", "artifacts": [{"report": {"path": report_folder}}], "settings": {"enableAutoRecovery": True}}, indent=2) + "\n",
        f"{model_folder}/definition.pbism": json.dumps({"$schema": PBISM_SCHEMA, "version": "4.0", "settings": {}}, indent=2) + "\n",
        f"{model_folder}/definition/database.tmdl": tmdl.database_file(),
        f"{model_folder}/definition/model.tmdl": tmdl.model_file(spec),
    }
    if spec.relationships:
        files[f"{model_folder}/definition/relationships.tmdl"] = tmdl.relationships_file(spec)
    for table in spec.tables:
        files[f"{model_folder}/definition/tables/{table.name}.tmdl"] = tmdl.table_file(table)
    for relative, text in pbir.report_files(spec, model_folder).items():
        files[f"{report_folder}/{relative}"] = text
    return files


def write_files(folder: Path, files: dict[str, str]) -> None:
    for relative, text in files.items():
        target = folder / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(text, encoding="utf-8", newline="\n")


def summary(spec: ProjectSpec, folder: Path, warnings: list[str]) -> dict:
    return {
        "project": folder.name,
        "path": str(folder / f"{spec.name}.pbip"),
        "folder": str(folder),
        "tables": len(spec.tables),
        "measures": sum(len(table.measures) for table in spec.tables),
        "relationships": len(spec.relationships),
        "pages": len(spec.pages),
        "visuals": sum(len(page.visuals) for page in spec.pages),
        "warnings": warnings,
    }


async def validate_model(settings: Settings, args: dict) -> dict:
    spec = parse_spec(SpecArgs(**args).spec)
    errors, warnings = check_model(spec)
    return {"valid": not errors, "errors": errors, "warnings": warnings, "tables": len(spec.tables), "measures": sum(len(table.measures) for table in spec.tables)}


async def create_project(settings: Settings, args: dict) -> dict:
    spec = parse_spec(SpecArgs(**args).spec)
    warnings = blocking_problems(spec)
    folder = free_path(resolve_in_workspace(settings, spec.name))
    renamed = spec.model_copy(update={"name": spec.name if folder.name == spec.name else folder.name})
    files = build_files(renamed)
    folder.mkdir(parents=True)
    write_files(folder, files)
    (folder / MARKER).write_text(json.dumps({"version": 1, "spec": renamed.model_dump()}, indent=2), encoding="utf-8")
    return summary(renamed, folder, warnings)


def project_folder(settings: Settings, name: str) -> Path:
    folder = resolve_in_workspace(settings, name)
    if not (folder / MARKER).is_file():
        raise ActionError(f"'{name}' is not a Power BI project created by Co-worker in the workspace folder.")
    return folder


def stored_spec(folder: Path) -> ProjectSpec:
    return ProjectSpec(**json.loads((folder / MARKER).read_text(encoding="utf-8"))["spec"])


def removed_items(old: ProjectSpec, new: ProjectSpec) -> list[str]:
    problems = []
    new_tables = {table.name.lower() for table in new.tables}
    problems.extend(f"table '{table.name}'" for table in old.tables if table.name.lower() not in new_tables)
    new_pages = {page.id: {visual.id for visual in page.visuals} for page in new.pages}
    for page in old.pages:
        if page.id not in new_pages:
            problems.append(f"page '{page.id}'")
            continue
        problems.extend(f"visual '{visual.id}' on page '{page.id}'" for visual in page.visuals if visual.id not in new_pages[page.id])
    return problems


async def update_project(settings: Settings, args: dict) -> dict:
    parsed = UpdateArgs(**args)
    folder = project_folder(settings, parsed.project)
    old = stored_spec(folder)
    new = parse_spec({**parsed.spec, "name": old.name})
    removed = removed_items(old, new)
    if removed:
        raise ActionError("Co-worker cannot remove things from a project: " + ", ".join(removed) + ". Keep them and set hidden to true instead, or create a new project.")
    warnings = blocking_problems(new)
    write_files(folder, build_files(new))
    (folder / MARKER).write_text(json.dumps({"version": 1, "spec": new.model_dump()}, indent=2), encoding="utf-8")
    return summary(new, folder, warnings)


async def read_spec(settings: Settings, args: dict) -> dict:
    folder = project_folder(settings, ProjectArgs(**args).project)
    return {"project": folder.name, "path": str(folder / f"{stored_spec(folder).name}.pbip"), "spec": stored_spec(folder).model_dump()}


def list_projects(settings: Settings) -> list[str]:
    return sorted(item.name for item in workspace_folder(settings).iterdir() if item.is_dir() and (item / MARKER).is_file())