import asyncio
import json
from dataclasses import dataclass, field
from types import SimpleNamespace

import pytest

from app.agents.assistant.graph import build_assistant_graph, get_assistant_graph
from app.agents.assistant.prompts import NO_KNOWLEDGE_MESSAGE
from app.api import deps
from app.core.config import Settings
from app.integrations.blob import BlobInfo
from app.services.assistant.knowledge_service import KnowledgeIndex, split_into_chunks

BASE = "/api/v1/assistant"
USER = {"X-User-Id": "p-004"}
OTHER = {"X-User-Id": "p-005"}


@dataclass
class FakeSessionRepository:
    items: dict = field(default_factory=dict)

    async def list_for_user(self, user_id):
        rows = [item for item in self.items.values() if item["user_id"] == user_id]
        rows.sort(key=lambda item: item["updated_at"], reverse=True)
        return [{"id": row["id"], "title": row["title"], "updated_at": row["updated_at"], "message_count": len(row["messages"])} for row in rows]

    async def get(self, session_id):
        return self.items.get(session_id)

    async def save(self, session):
        self.items[session["id"]] = json.loads(json.dumps(session))
        return session

    async def delete(self, session_id):
        return self.items.pop(session_id, None) is not None


@dataclass
class FakeKnowledgeStorage:
    files: dict = field(default_factory=dict)

    async def list_documents(self):
        return [BlobInfo(name=name, etag=etag) for name, (etag, _) in self.files.items()]

    async def download(self, name):
        return self.files[name][1]


class FakeAssistantGraph:
    def __init__(self):
        self.states = []

    async def astream_events(self, state, config=None, version="v2"):
        self.states.append(state)
        if state["mode"] == "kb":
            hits = config["configurable"]["knowledge"].search(state["question"], 3)
            passages = [{"name": hit.source, "text": hit.text, "excerpt": hit.text[:40]} for hit in hits]
            yield {"event": "on_chain_end", "name": "retrieve", "data": {"output": {"passages": passages}}}
        for piece in ("Hello ", "there"):
            yield {"event": "on_chat_model_stream", "name": "model", "data": {"chunk": SimpleNamespace(content=piece)}}
        yield {"event": "on_chain_end", "name": "generate", "data": {"output": {"answer": "Hello there"}}}


@pytest.fixture
def graph():
    return FakeAssistantGraph()


@pytest.fixture
def assistant(client, graph):
    settings = Settings(_env_file=None, foundry_endpoint="https://example.test", foundry_api_key="key", foundry_chat_deployment="alpha", assistant_models="alpha,beta")
    app = client.app
    app.dependency_overrides[deps.get_settings] = lambda: settings
    app.dependency_overrides[deps.get_chat_session_repository] = lambda: FakeSessionRepository()
    app.dependency_overrides[get_assistant_graph] = lambda: graph
    repository = FakeSessionRepository()
    app.dependency_overrides[deps.get_chat_session_repository] = lambda: repository
    app.state.knowledge_index = KnowledgeIndex()
    app.state.knowledge_storage = None
    return client


def events(response):
    return [json.loads(line) for line in response.text.splitlines() if line.strip()]


def chat(client, message="What is our leave policy?", session_id=None, mode="gpt", model="alpha", effort="medium", headers=USER):
    body = {"session_id": session_id, "message": message, "mode": mode, "model": model, "effort": effort}
    return client.post(f"{BASE}/chat", json=body, headers=headers)


def test_options_list_models_efforts_and_mode_status(assistant):
    body = assistant.get(f"{BASE}/options").json()
    assert body["models"] == ["alpha", "beta"]
    assert body["default_model"] == "alpha"
    assert body["efforts"] == ["low", "medium", "high"]
    modes = {mode["id"]: mode for mode in body["modes"]}
    assert modes["gpt"]["ready"] is True
    assert modes["kb"]["ready"] is False


def test_chat_streams_start_deltas_and_done_and_saves_the_session(assistant):
    response = chat(assistant)
    assert response.status_code == 200
    sequence = events(response)
    assert [event["type"] for event in sequence] == ["start", "delta", "delta", "done"]
    assert sequence[0]["user_message"]["content"] == "What is our leave policy?"
    assert sequence[-1]["message"]["content"] == "Hello there"
    assert sequence[-1]["message"]["model"] == "alpha"
    session_id = sequence[0]["session"]["id"]

    listed = assistant.get(f"{BASE}/sessions", headers=USER).json()
    assert [item["id"] for item in listed] == [session_id]
    assert listed[0]["title"] == "What is our leave policy?"
    assert listed[0]["message_count"] == 2

    full = assistant.get(f"{BASE}/sessions/{session_id}", headers=USER).json()
    assert [message["role"] for message in full["messages"]] == ["user", "assistant"]


def test_follow_up_messages_carry_the_history(assistant, graph):
    first = events(chat(assistant))
    session_id = first[0]["session"]["id"]
    events(chat(assistant, message="And for contractors?", session_id=session_id))
    assert graph.states[1]["history"] == [
        {"role": "user", "content": "What is our leave policy?"},
        {"role": "assistant", "content": "Hello there"},
    ]
    assert assistant.get(f"{BASE}/sessions", headers=USER).json()[0]["message_count"] == 4


def test_sessions_are_private_to_their_owner_and_can_be_deleted(assistant):
    session_id = events(chat(assistant))[0]["session"]["id"]
    assert assistant.get(f"{BASE}/sessions", headers=OTHER).json() == []
    assert assistant.get(f"{BASE}/sessions/{session_id}", headers=OTHER).status_code == 404
    assert assistant.delete(f"{BASE}/sessions/{session_id}", headers=OTHER).status_code == 404
    assert assistant.delete(f"{BASE}/sessions/{session_id}", headers=USER).status_code == 204
    assert assistant.get(f"{BASE}/sessions", headers=USER).json() == []


def test_unknown_models_empty_messages_and_bad_user_ids_are_rejected(assistant):
    assert chat(assistant, model="gamma").status_code == 400
    assert chat(assistant, message="").status_code == 422
    assert assistant.get(f"{BASE}/sessions", headers={"X-User-Id": "bad id!"}).status_code == 400


def test_knowledge_mode_needs_the_knowledge_store(assistant):
    assert chat(assistant, mode="kb").status_code == 400


def test_knowledge_mode_returns_sources_from_indexed_documents(assistant, client):
    storage = FakeKnowledgeStorage(files={"leave.md": ("v1", b"Annual leave is 21 days per year for all permanent employees.\n\nSick leave is 7 days.")})
    client.app.state.knowledge_storage = storage
    options = assistant.get(f"{BASE}/options").json()
    assert next(mode for mode in options["modes"] if mode["id"] == "kb")["ready"] is True
    done = events(chat(assistant, message="How many days of annual leave?", mode="kb"))[-1]
    assert done["message"]["sources"][0]["name"] == "leave.md"
    assert "21 days" in done["message"]["sources"][0]["excerpt"] or done["message"]["sources"][0]["excerpt"].startswith("Annual leave")


def test_real_graph_answers_without_calling_the_model_when_nothing_is_found():
    async def run():
        graph = build_assistant_graph()
        state = {"history": [], "question": "anything", "mode": "kb", "model": "alpha", "effort": "low"}
        config = {"configurable": {"knowledge": KnowledgeIndex()}}
        return [event async for event in graph.astream_events(state, config=config, version="v2") if event["event"] == "on_chain_end" and event["name"] == "no_context"]

    ended = asyncio.run(run())
    assert ended[0]["data"]["output"]["answer"] == NO_KNOWLEDGE_MESSAGE


def test_knowledge_index_ranks_relevant_passages_and_follows_changes():
    asyncio.run(check_knowledge_index())


async def check_knowledge_index():
    storage = FakeKnowledgeStorage(
        files={
            "leave.txt": ("1", b"Employees receive twenty one days of annual leave every year."),
            "travel.txt": ("1", b"Flights must be booked through the travel desk at least a week ahead."),
        }
    )
    index = KnowledgeIndex()
    await index.refresh(storage, force=True)
    assert index.document_count == 2
    assert index.search("how many days of annual leave", 3)[0].source == "leave.txt"
    assert index.search("zzzz unrelated", 3) == []

    storage.files["travel.txt"] = ("2", b"Hotels are capped at a nightly rate set by finance.")
    del storage.files["leave.txt"]
    await index.refresh(storage, force=True)
    assert index.document_count == 1
    assert index.search("hotel rate", 1)[0].source == "travel.txt"


def test_long_text_is_split_into_bounded_chunks():
    text = "\n\n".join(f"Paragraph {number} " + "word " * 120 for number in range(5))
    chunks = split_into_chunks(text, size=400)
    assert len(chunks) > 5
    assert all(len(chunk) <= 400 for chunk in chunks)

