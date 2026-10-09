from functools import lru_cache

from langgraph.graph import END, START, StateGraph

from app.agents.recruiteone.nodes import extract_requirements, profile_candidate, quality_check, score_match
from app.agents.recruiteone.state import EvaluationState


def build_evaluation_graph():
    graph = StateGraph(EvaluationState)
    graph.add_node("extract_requirements", extract_requirements)
    graph.add_node("profile_candidate", profile_candidate)
    graph.add_node("score_match", score_match)
    graph.add_node("quality_check", quality_check)
    graph.add_edge(START, "extract_requirements")
    graph.add_edge(START, "profile_candidate")
    graph.add_edge(["extract_requirements", "profile_candidate"], "score_match")
    graph.add_edge("score_match", "quality_check")
    graph.add_edge("quality_check", END)
    return graph.compile()


@lru_cache
def get_evaluation_graph():
    return build_evaluation_graph()
