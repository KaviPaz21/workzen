import asyncio
from dataclasses import dataclass, field
from uuid import uuid4

from pydantic import ValidationError

from app.agents.assistant.coworker_tools import TOOL_INDEX, describe_action

ACTION_WAIT_SECONDS = 180
DETAIL_CHARACTERS = 160


def short_id(prefix: str) -> str:
    return f"{prefix}-{uuid4().hex[:10]}"


def detail_of(tool: str, outcome: dict) -> str:
    if not outcome.get("ok"):
        return str(outcome.get("error") or "")[:DETAIL_CHARACTERS]
    result = outcome.get("result") or {}
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
        record = {"id": action_id, "tool": tool, "summary": summary, "status": "failed", "detail": ""}
        self.trace.append(record)
        future = asyncio.get_running_loop().create_future()
        self.waiting[action_id] = future
        await self.events.put({"type": "action", "action": {"id": action_id, "tool": tool, "summary": summary, "args": args}})
        try:
            outcome = await asyncio.wait_for(future, timeout=ACTION_WAIT_SECONDS)
        except TimeoutError:
            outcome = {"ok": False, "error": "Nobody approved or finished this action in time, so it was cancelled."}
        finally:
            self.waiting.pop(action_id, None)
        record["status"] = "denied" if outcome.get("denied") else "done" if outcome.get("ok") else "failed"
        record["detail"] = detail_of(tool, outcome)
        await self.events.put({"type": "action_result", "id": action_id, "status": record["status"], "detail": record["detail"]})
        return outcome

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
