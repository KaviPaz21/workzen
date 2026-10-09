from functools import lru_cache
from typing import TypedDict

from langchain_core.messages import HumanMessage, SystemMessage
from langgraph.graph import END, START, StateGraph

from app.agents.recruiteone.prompts import CV_SCORING_PROMPT
from app.integrations.foundry import get_chat_model
from app.schemas.recruiteone.scoring import (
    BENCHMARK_LABELS,
    BenchmarkScore,
    CvScore,
    CvScoringLlmOutput,
    JdForScoring,
)

MAX_CV_CHARACTERS = 20000


class CvScoringState(TypedDict, total=False):
    jd: JdForScoring
    cv_text: str
    llm_output: CvScoringLlmOutput
    result: CvScore


def describe_jd(jd: JdForScoring) -> str:
    sections = [f"Job description: {jd.name}", f"Role: {jd.role}", f"Sector: {jd.sector}", f"Level: {jd.level}"]
    for key, label in BENCHMARK_LABELS.items():
        items = getattr(jd.buckets, key)
        lines = "\n".join(f"- {item}" for item in items) if items else "- nothing listed"
        sections.append(f"{key} ({label}):\n{lines}")
    return "\n\n".join(sections)


def recommendation_for(score: int) -> str:
    if score >= 75:
        return "strong_match"
    if score >= 50:
        return "potential_match"
    return "not_a_match"


async def score_benchmarks(state: CvScoringState) -> dict:
    model = get_chat_model().with_structured_output(CvScoringLlmOutput)
    brief = f"{describe_jd(state['jd'])}\n\nCANDIDATE CV\n{state['cv_text'][:MAX_CV_CHARACTERS]}"
    output = await model.ainvoke([SystemMessage(content=CV_SCORING_PROMPT), HumanMessage(content=brief)])
    return {"llm_output": output}


def finalize_score(state: CvScoringState) -> dict:
    jd = state["jd"]
    by_key = {item.key: item for item in state["llm_output"].benchmarks}
    benchmarks = []
    for key, label in BENCHMARK_LABELS.items():
        returned = by_key.get(key)
        applicable = len(getattr(jd.buckets, key)) > 0
        benchmarks.append(
            BenchmarkScore(
                key=key,
                label=label,
                score=returned.score if returned and applicable else 0,
                weight=getattr(jd.weights, key),
                applicable=applicable,
                reasoning=returned.reasoning if returned else "The AI did not return an assessment for this benchmark.",
            )
        )
    counted = [item for item in benchmarks if item.applicable]
    total_weight = sum(item.weight for item in counted)
    if total_weight > 0:
        overall = round(sum(item.score * item.weight for item in counted) / total_weight)
    elif counted:
        overall = round(sum(item.score for item in counted) / len(counted))
    else:
        overall = 0
    result = CvScore(
        overall_score=overall,
        recommendation=recommendation_for(overall),
        summary=state["llm_output"].summary,
        benchmarks=benchmarks,
    )
    return {"result": result}


def build_cv_scoring_graph():
    graph = StateGraph(CvScoringState)
    graph.add_node("score_benchmarks", score_benchmarks)
    graph.add_node("finalize_score", finalize_score)
    graph.add_edge(START, "score_benchmarks")
    graph.add_edge("score_benchmarks", "finalize_score")
    graph.add_edge("finalize_score", END)
    return graph.compile()


@lru_cache
def get_cv_scoring_graph():
    return build_cv_scoring_graph()
