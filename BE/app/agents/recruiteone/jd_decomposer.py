from functools import lru_cache
from typing import TypedDict

from langchain_core.messages import HumanMessage, SystemMessage
from langgraph.graph import END, START, StateGraph

from app.agents.recruiteone.prompts import JD_DECOMPOSITION_PROMPT
from app.integrations.foundry import get_chat_model
from app.schemas.recruiteone.jd import JdDecomposition


class JdDecompositionState(TypedDict, total=False):
    name: str
    text: str
    decomposition: JdDecomposition


async def decompose_jd(state: JdDecompositionState) -> dict:
    model = get_chat_model().with_structured_output(JdDecomposition)
    brief = f"Job title: {state['name']}\n\n{state['text']}"
    decomposition = await model.ainvoke([SystemMessage(content=JD_DECOMPOSITION_PROMPT), HumanMessage(content=brief)])
    return {"decomposition": decomposition}


def build_jd_decomposition_graph():
    graph = StateGraph(JdDecompositionState)
    graph.add_node("decompose_jd", decompose_jd)
    graph.add_edge(START, "decompose_jd")
    graph.add_edge("decompose_jd", END)
    return graph.compile()


@lru_cache
def get_jd_decomposition_graph():
    return build_jd_decomposition_graph()
