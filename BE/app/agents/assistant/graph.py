from datetime import datetime, timezone
from functools import lru_cache
from typing import TypedDict

from langchain_core.messages import AIMessage, BaseMessage, HumanMessage, SystemMessage
from langchain_core.runnables import RunnableConfig
from langgraph.graph import END, START, StateGraph

from app.agents.assistant.prompts import GENERAL_PROMPT, KNOWLEDGE_PROMPT, NO_KNOWLEDGE_MESSAGE
from app.integrations.foundry import get_assistant_model

KNOWLEDGE_RESULTS = 5
HISTORY_MESSAGES = 20
EXCERPT_CHARACTERS = 240


class AssistantState(TypedDict, total=False):
    history: list[dict]
    question: str
    mode: str
    model: str
    effort: str
    passages: list[dict]
    answer: str


def text_of(content) -> str:
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        return "".join(part if isinstance(part, str) else str(part.get("text", "")) for part in content if isinstance(part, (str, dict)))
    return ""


def route_start(state: AssistantState) -> str:
    return "retrieve" if state["mode"] == "kb" else "generate"


def route_after_retrieve(state: AssistantState) -> str:
    return "generate" if state.get("passages") else "no_context"


async def retrieve(state: AssistantState, config: RunnableConfig) -> dict:
    knowledge = config["configurable"]["knowledge"]
    hits = knowledge.search(state["question"], KNOWLEDGE_RESULTS)
    return {"passages": [{"name": hit.source, "text": hit.text, "excerpt": hit.text[:EXCERPT_CHARACTERS]} for hit in hits]}


async def no_context(state: AssistantState) -> dict:
    return {"answer": NO_KNOWLEDGE_MESSAGE}


def build_messages(state: AssistantState) -> list[BaseMessage]:
    today = datetime.now(timezone.utc).strftime("%A %d %B %Y")
    knowledge_mode = state["mode"] == "kb"
    system = f"{KNOWLEDGE_PROMPT if knowledge_mode else GENERAL_PROMPT}\nToday's date is {today} (UTC)."
    messages: list[BaseMessage] = [SystemMessage(content=system)]
    for item in state.get("history", [])[-HISTORY_MESSAGES:]:
        messages.append(HumanMessage(content=item["content"]) if item["role"] == "user" else AIMessage(content=item["content"]))
    if knowledge_mode:
        excerpts = "\n\n".join(f"[{number}] (source: {passage['name']})\n{passage['text']}" for number, passage in enumerate(state["passages"], start=1))
        messages.append(HumanMessage(content=f"Knowledge base excerpts:\n\n{excerpts}\n\nQuestion: {state['question']}"))
    else:
        messages.append(HumanMessage(content=state["question"]))
    return messages


async def generate(state: AssistantState) -> dict:
    model = get_assistant_model(state["model"], state["effort"])
    response = await model.ainvoke(build_messages(state))
    return {"answer": text_of(response.content)}


def build_assistant_graph():
    graph = StateGraph(AssistantState)
    graph.add_node("retrieve", retrieve)
    graph.add_node("no_context", no_context)
    graph.add_node("generate", generate)
    graph.add_conditional_edges(START, route_start, {"retrieve": "retrieve", "generate": "generate"})
    graph.add_conditional_edges("retrieve", route_after_retrieve, {"generate": "generate", "no_context": "no_context"})
    graph.add_edge("no_context", END)
    graph.add_edge("generate", END)
    return graph.compile()


@lru_cache
def get_assistant_graph():
    return build_assistant_graph()
