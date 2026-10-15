import hashlib
from functools import lru_cache
from typing import TypedDict

from langchain_core.messages import HumanMessage, SystemMessage
from langgraph.graph import END, START, StateGraph

from app.agents.recruiteone.grade_points import (
    checklist_grade_point,
    experience_grade_point,
    grade_point_to_score,
    weighted_overall_score,
)
from app.agents.recruiteone.prompts import CV_SCORING_PROMPT
from app.integrations.foundry import get_scoring_model
from app.schemas.recruiteone.scoring import (
    BENCHMARK_LABELS,
    BenchmarkLlmResult,
    BenchmarkScore,
    CvScore,
    CvScoringLlmOutput,
    JdForScoring,
)

MAX_CV_CHARACTERS = 20000
MAX_CACHED_EVALUATIONS = 500
ALTERNATIVE_BENCHMARKS = {"technical_skills", "certifications", "education", "extra_curricular"}
ACHIEVEMENT_RELEVANCE = 100

evaluation_cache: dict[str, CvScoringLlmOutput] = {}


class CvScoringState(TypedDict, total=False):
    jd: JdForScoring
    cv_text: str
    llm_output: CvScoringLlmOutput
    result: CvScore


def describe_jd(jd: JdForScoring) -> str:
    sections = [f"Job description: {jd.name}", f"Role: {jd.role}", f"Sector: {jd.sector}", f"Level: {jd.level}"]
    for key, label in BENCHMARK_LABELS.items():
        items = getattr(jd.buckets, key)
        lines = "\n".join(f"{number}. {item}" for number, item in enumerate(items, start=1)) if items else "nothing listed"
        sections.append(f"{key} ({label}):\n{lines}")
    return "\n\n".join(sections)


def recommendation_for(score: int) -> str:
    if score >= 75:
        return "strong_match"
    if score >= 50:
        return "potential_match"
    return "not_a_match"


def evaluation_key(jd: JdForScoring, cv_text: str) -> str:
    content = jd.model_dump_json(exclude={"weights"}) + cv_text
    return hashlib.sha256(content.encode("utf-8")).hexdigest()


def seed_for(key: str) -> int:
    return int(key[:8], 16) % (2**31 - 1)


def remember_evaluation(key: str, output: CvScoringLlmOutput) -> None:
    if len(evaluation_cache) >= MAX_CACHED_EVALUATIONS:
        del evaluation_cache[next(iter(evaluation_cache))]
    evaluation_cache[key] = output


async def score_benchmarks(state: CvScoringState) -> dict:
    cv_text = state["cv_text"][:MAX_CV_CHARACTERS]
    key = evaluation_key(state["jd"], cv_text)
    cached = evaluation_cache.get(key)
    if cached:
        return {"llm_output": cached}
    model = get_scoring_model(seed_for(key)).with_structured_output(CvScoringLlmOutput)
    brief = f"{describe_jd(state['jd'])}\n\nCANDIDATE CV\n{cv_text}"
    output = await model.ainvoke([SystemMessage(content=CV_SCORING_PROMPT), HumanMessage(content=brief)])
    remember_evaluation(key, output)
    return {"llm_output": output}


def aligned_matches(item_count: int, returned: BenchmarkLlmResult) -> list[bool]:
    flags = [check.matched for check in returned.checks[:item_count]]
    return flags + [False] * (item_count - len(flags))


def alternative_relevance(key: str, returned: BenchmarkLlmResult) -> list[int]:
    if key not in ALTERNATIVE_BENCHMARKS:
        return []
    if key == "extra_curricular":
        return [ACHIEVEMENT_RELEVANCE] * len(returned.alternatives)
    return [alternative.relevance for alternative in returned.alternatives]


def benchmark_grade_point(key: str, item_count: int, returned: BenchmarkLlmResult | None) -> float:
    if returned is None:
        return 0.0
    if key == "experience":
        return experience_grade_point(returned.required_months, returned.available_months)
    return checklist_grade_point(aligned_matches(item_count, returned), alternative_relevance(key, returned))


def finalize_score(state: CvScoringState) -> dict:
    jd = state["jd"]
    by_key = {item.key: item for item in state["llm_output"].benchmarks}
    benchmarks = []
    counted_points = []
    counted_weights = []
    for key, label in BENCHMARK_LABELS.items():
        returned = by_key.get(key)
        item_count = len(getattr(jd.buckets, key))
        applicable = item_count > 0
        weight = getattr(jd.weights, key)
        grade_point = benchmark_grade_point(key, item_count, returned) if applicable else 0.0
        if applicable:
            counted_points.append(grade_point)
            counted_weights.append(weight)
        benchmarks.append(
            BenchmarkScore(
                key=key,
                label=label,
                score=grade_point_to_score(grade_point),
                weight=weight,
                applicable=applicable,
                reasoning=returned.reasoning if returned else "The AI did not return an assessment for this benchmark.",
            )
        )
    overall = weighted_overall_score(counted_points, counted_weights)
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
