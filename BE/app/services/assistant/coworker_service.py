import asyncio
from dataclasses import dataclass, field
from uuid import uuid4

from pydantic import ValidationError

from app.agents.assistant.coworker_safety import DELETE_MESSAGE
from app.agents.assistant.coworker_tools import TOOL_INDEX, describe_action, risk_of

ACTION_WAIT_SECONDS = 180
DETAIL_CHARACTERS = 160
CREATING_TOOLS = {"create_excel_document", "create_word_document", "write_text_file"}


def short_id(prefix: str) -> str:
    return f"{prefix}-{uuid4().hex[:10]}"


def detail_of(tool: str, outcome: dict) -> str:
    if not outcome.get("ok"):
        return str(outcome.get("error") or "")[:DETAIL_CHARACTERS]
    result = outcome.get("result") or {}
    if tool == "browser_expect" and "all_passed" in result:
        passed = sum(1 for item in result.get("results", []) if item.get("passed"))
        return f"{passed} of {len(result.get('results', []))} checks passed"
    if tool == "db_query" and "row_count" in result:
        return f"{result.get('row_count', 0)} rows" + (" (more available)" if result.get("truncated") else "")
    if tool == "db_schema":
        return f"{len(result.get('tables', []))} tables"
    if tool == "powerbi_validate_model":
        return "model is valid" if result.get("valid") else f"{len(result.get('errors', []))} problems to fix"
    if tool in ("powerbi_create_project", "powerbi_update_project") and result.get("path"):
        return str(result["path"])[:DETAIL_CHARACTERS]
    if tool == "browser_issues":
        return f"{result.get('count', 0)} issues found"
    if tool == "browser_inspect":
        return f"{result.get('total', 0)} elements found"
    if tool.startswith("browser_") and result.get("title"):
        return f"{result.get('title')} ({result.get('url', '')})"[:DETAIL_CHARACTERS]
    for key in ("path", "filename", "url"):
        if result.get(key):
            return str(result[key])[:DETAIL_CHARACTERS]
    return ""


@dataclass
class CoworkerRun:
    id: str
    user_id: str
    events: asyncio.Queue = field(default_factory=asyncio.Queue)
    waiting: dict[str, asyncio.Future] = field(default_factory=dict)
    trace: list[dict] = field(default_factory=list)
    created: set[str] = field(default_factory=set)

    async def execute(self, tool: str, args: dict) -> dict:
        spec = TOOL_INDEX.get(tool)
        if spec is None:
            return {"ok": False, "error": f"There is no tool called {tool}."}
        try:
            args = spec.schema(**args).model_dump()
        except ValidationError as error:
            first = error.errors()[0]
            return {"ok": False, "error": f"The arguments for {tool} are not valid: {'.'.join(str(part) for part in first['loc'])} {first['msg']}"}
        action_id = short_id("act")
        summary = describe_action(tool, args)
        risk = risk_of(tool, args, self.created)
        record = {"id": action_id, "tool": tool, "summary": summary, "status": "failed", "detail": ""}
        self.trace.append(record)
        if risk == "delete":
            record["status"] = "denied"
            record["detail"] = DELETE_MESSAGE
            return {"ok": False, "denied": True, "error": DELETE_MESSAGE}
        future = asyncio.get_running_loop().create_future()
        self.waiting[action_id] = future
        await self.events.put({"type": "action", "action": {"id": action_id, "tool": tool, "summary": summary, "risk": risk, "args": args}})
        try:
            outcome = await asyncio.wait_for(future, timeout=ACTION_WAIT_SECONDS)
        except TimeoutError:
            outcome = {"ok": False, "error": "Nobody approved or finished this action in time, so it was cancelled."}
        finally:
            self.waiting.pop(action_id, None)
        record["status"] = "denied" if outcome.get("denied") else "done" if outcome.get("ok") else "failed"
        self.remember_created(tool, outcome)
        record["detail"] = detail_of(tool, outcome)
        await self.events.put({"type": "action_result", "id": action_id, "status": record["status"], "detail": record["detail"]})
        return outcome

    def remember_created(self, tool: str, outcome: dict) -> None:
        result = outcome.get("result") or {}
        if not outcome.get("ok"):
            return
        if tool in CREATING_TOOLS and result.get("filename"):
            self.created.add(str(result["filename"]).lower())
        if tool == "powerbi_create_project" and result.get("project"):
            self.created.add(str(result["project"]).lower())

    def resolve(self, action_id: str, outcome: dict) -> bool:
        future = self.waiting.get(action_id)
        if future is None or future.done():
            return False
        future.set_result(outcome)
        return True

    def cancel(self) -> None:
        for future in self.waiting.values():
            if not future.done():
                future.cancel()


@dataclass
class CoworkerRuns:
    runs: dict[str, CoworkerRun] = field(default_factory=dict)

    def create(self, user_id: str) -> CoworkerRun:
        run = CoworkerRun(id=short_id("run"), user_id=user_id)
        self.runs[run.id] = run
        return run

    def get(self, run_id: str) -> CoworkerRun | None:
        return self.runs.get(run_id)

    def remove(self, run_id: str) -> None:
        run = self.runs.pop(run_id, None)
        if run is not None:
            run.cancel()
