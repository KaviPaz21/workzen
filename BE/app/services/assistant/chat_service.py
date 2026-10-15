import asyncio
import contextlib
import logging
import re
from collections.abc import AsyncIterator
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from langchain_core.messages import AIMessage, HumanMessage

from app.agents.assistant.graph import text_of
from app.core.errors import InvalidRequestError, NotFoundError
from app.integrations.blob import BlobStorage
from app.repositories.chat_session_repository import ChatSessionRepository
from app.schemas.assistant.chat import DEFAULT_EFFORT, EFFORTS, ActionResult, AssistantOptions, ChatRequest, ModeStatus
from app.services.assistant.coworker_service import CoworkerRuns
from app.services.assistant.knowledge_service import KnowledgeIndex

logger = logging.getLogger(__name__)

TITLE_CHARACTERS = 60
HISTORY_MESSAGES = 20
ANSWER_FAILED = "The assistant could not answer. Please try again."


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def new_id(prefix: str) -> str:
    return f"{prefix}-{uuid4().hex[:12]}"


def title_from(message: str) -> str:
    text = re.sub(r"\s+", " ", message).strip()
    return text if len(text) <= TITLE_CHARACTERS else f"{text[: TITLE_CHARACTERS - 1].rstrip()}…"


def summarize(session: dict) -> dict:
    return {"id": session["id"], "title": session["title"], "updated_at": session["updated_at"], "message_count": len(session["messages"])}


@dataclass
class ChatService:
    sessions: ChatSessionRepository
    graph: Any
    knowledge: KnowledgeIndex
    knowledge_storage: BlobStorage | None
    models: list[str]
    coworker_graph: Any = None
    coworker_runs: CoworkerRuns = field(default_factory=CoworkerRuns)

    async def refresh_knowledge(self) -> None:
        if self.knowledge_storage is not None:
            await self.knowledge.refresh(self.knowledge_storage)

    async def options(self) -> AssistantOptions:
        knowledge = ModeStatus(id="kb", label="Internal KB", ready=False, detail="Azure Blob Storage is not configured")
        if self.knowledge_storage is not None:
            try:
                await self.refresh_knowledge()
                count = self.knowledge.document_count
                knowledge = ModeStatus(
                    id="kb",
                    label="Internal KB",
                    ready=count > 0,
                    detail=f"{count} {'document' if count == 1 else 'documents'} indexed" if count else "The knowledge base has no documents yet",
                )
            except Exception:
                logger.exception("Knowledge base could not be read")
                knowledge = ModeStatus(id="kb", label="Internal KB", ready=False, detail="The knowledge base could not be read")
        general = ModeStatus(id="gpt", label="GPT", ready=bool(self.models), detail="General knowledge" if self.models else "No model is configured")
        return AssistantOptions(
            models=self.models,
            default_model=self.models[0] if self.models else None,
            efforts=EFFORTS,
            default_effort=DEFAULT_EFFORT,
            modes=[general, knowledge],
        )

    async def list_sessions(self, user_id: str) -> list[dict]:
        return await self.sessions.list_for_user(user_id)

    async def get_session(self, user_id: str, session_id: str) -> dict:
        session = await self.sessions.get(session_id)
        if session is None or session.get("user_id") != user_id:
            raise NotFoundError("Chat session was not found")
        return session

    async def delete_session(self, user_id: str, session_id: str) -> None:
        await self.get_session(user_id, session_id)
        await self.sessions.delete(session_id)

    async def open_session(self, user_id: str, request: ChatRequest) -> dict:
        if request.session_id:
            return await self.get_session(user_id, request.session_id)
        stamp = now_iso()
        return {
            "id": new_id("chat"),
            "user_id": user_id,
            "title": title_from(request.message),
            "messages": [],
            "created_at": stamp,
            "updated_at": stamp,
        }

    def check_request(self, request: ChatRequest) -> None:
        if request.model not in self.models:
            raise InvalidRequestError("That model is not available")
        if request.mode == "kb" and self.knowledge_storage is None:
            raise InvalidRequestError("The internal knowledge base is not configured")

    async def submit_action_result(self, user_id: str, run_id: str, action_id: str, result: ActionResult) -> None:
        run = self.coworker_runs.get(run_id)
        if run is None or run.user_id != user_id or not run.resolve(action_id, result.model_dump()):
            raise NotFoundError("That action is no longer waiting for a result")

    async def stream_coworker(self, user_id: str, request: ChatRequest) -> AsyncIterator[dict]:
        session = await self.open_session(user_id, request)
        messages = [HumanMessage(content=item["content"]) if item["role"] == "user" else AIMessage(content=item["content"]) for item in session["messages"][-HISTORY_MESSAGES:]]
        question = request.message.strip()
        user_message = {"id": new_id("msg"), "role": "user", "content": question, "created_at": now_iso(), "sources": [], "actions": []}
        session["messages"].append(user_message)
        session["updated_at"] = user_message["created_at"]
        await self.sessions.save(session)
        run = self.coworker_runs.create(user_id)
        yield {"type": "start", "session": summarize(session), "user_message": user_message, "run_id": run.id}

        state = {"messages": [*messages, HumanMessage(content=question)], "model": request.model, "effort": request.effort, "rounds": 0}
        config = {"configurable": {"coworker": run}, "recursion_limit": 80}
        answer = ""

        async def drive() -> None:
            try:
                async for event in self.coworker_graph.astream_events(state, config=config, version="v2"):
                    if event["event"] == "on_chat_model_stream":
                        text = text_of(event["data"]["chunk"].content)
                        if text:
                            await run.events.put({"type": "delta", "text": text})
                await run.events.put({"type": "finished"})
            except asyncio.CancelledError:
                raise
            except Exception:
                logger.exception("Co-worker run failed")
                await run.events.put({"type": "error", "detail": ANSWER_FAILED})

        task = asyncio.create_task(drive())
        try:
            while True:
                item = await run.events.get()
                if item["type"] == "finished":
                    break
                if item["type"] == "error":
                    yield item
                    return
                if item["type"] == "delta":
                    answer += item["text"]
                yield item
        finally:
            task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await task
            self.coworker_runs.remove(run.id)

        assistant_message = {
            "id": new_id("msg"),
            "role": "assistant",
            "content": answer.strip() or "I stopped before finishing. Look at the actions above to see what was done.",
            "created_at": now_iso(),
            "sources": [],
            "actions": run.trace,
            "mode": "gpt",
            "model": request.model,
            "effort": request.effort,
        }
        session["messages"].append(assistant_message)
        session["updated_at"] = assistant_message["created_at"]
        await self.sessions.save(session)
        yield {"type": "done", "message": assistant_message, "session": summarize(session)}

    async def stream_chat(self, user_id: str, request: ChatRequest) -> AsyncIterator[dict]:
        if request.coworker:
            async for event in self.stream_coworker(user_id, request):
                yield event
            return
        session = await self.open_session(user_id, request)
        history = [{"role": message["role"], "content": message["content"]} for message in session["messages"]]
        user_message = {"id": new_id("msg"), "role": "user", "content": request.message.strip(), "created_at": now_iso(), "sources": []}
        session["messages"].append(user_message)
        session["updated_at"] = user_message["created_at"]
        await self.sessions.save(session)
        yield {"type": "start", "session": summarize(session), "user_message": user_message}

        answer = ""
        sources: list[dict] = []
        try:
            if request.mode == "kb":
                await self.refresh_knowledge()
            state = {"history": history, "question": request.message.strip(), "mode": request.mode, "model": request.model, "effort": request.effort}
            config = {"configurable": {"knowledge": self.knowledge}}
            async for event in self.graph.astream_events(state, config=config, version="v2"):
                kind = event["event"]
                name = event.get("name")
                if kind == "on_chat_model_stream":
                    text = text_of(event["data"]["chunk"].content)
                    if text:
                        answer += text
                        yield {"type": "delta", "text": text}
                elif kind == "on_chain_end" and name == "retrieve":
                    sources = [{"name": passage["name"], "excerpt": passage["excerpt"]} for passage in event["data"]["output"].get("passages", [])]
                elif kind == "on_chain_end" and name in ("no_context", "generate") and not answer:
                    answer = event["data"]["output"].get("answer", "")
                    if answer:
                        yield {"type": "delta", "text": answer}
        except Exception:
            logger.exception("Assistant answer failed")
            yield {"type": "error", "detail": ANSWER_FAILED}
            return

        assistant_message = {
            "id": new_id("msg"),
            "role": "assistant",
            "content": answer.strip() or ANSWER_FAILED,
            "created_at": now_iso(),
            "sources": sources,
            "mode": request.mode,
            "model": request.model,
            "effort": request.effort,
        }
        session["messages"].append(assistant_message)
        session["updated_at"] = assistant_message["created_at"]
        await self.sessions.save(session)
        yield {"type": "done", "message": assistant_message, "session": summarize(session)}
