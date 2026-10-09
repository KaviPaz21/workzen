import asyncio
import logging

from langchain_core.messages import HumanMessage, SystemMessage

from app.agents.recruiteone.prompts import PROFILE_PROMPT, REQUIREMENTS_PROMPT, SCORING_PROMPT
from app.agents.recruiteone.state import CandidateProfile, EvaluationState, JobRequirements
from app.integrations.foundry import get_chat_model, get_quality_evaluators
from app.schemas.recruiteone.evaluation import MatchResult, QualityScores

logger = logging.getLogger(__name__)


async def extract_requirements(state: EvaluationState) -> dict:
    model = get_chat_model().with_structured_output(JobRequirements)
    requirements = await model.ainvoke(
        [SystemMessage(content=REQUIREMENTS_PROMPT), HumanMessage(content=state["jd_text"])]
    )
    return {"requirements": requirements}


async def profile_candidate(state: EvaluationState) -> dict:
    model = get_chat_model().with_structured_output(CandidateProfile)
    profile = await model.ainvoke([SystemMessage(content=PROFILE_PROMPT), HumanMessage(content=state["cv_text"])])
    return {"profile": profile}


async def score_match(state: EvaluationState) -> dict:
    model = get_chat_model().with_structured_output(MatchResult)
    brief = (
        f"JOB REQUIREMENTS\n{state['requirements'].model_dump_json(indent=2)}\n\n"
        f"CANDIDATE PROFILE\n{state['profile'].model_dump_json(indent=2)}\n\n"
        f"CANDIDATE CV\n{state['cv_text']}"
    )
    match = await model.ainvoke([SystemMessage(content=SCORING_PROMPT), HumanMessage(content=brief)])
    return {"match": match}


def build_quality_inputs(state: EvaluationState) -> dict[str, dict]:
    match = state["match"]
    query = f"Assess how well the candidate fits this role.\n\n{state['jd_text']}"
    response = "\n".join(
        [match.summary, "Strengths: " + "; ".join(match.strengths), "Gaps: " + "; ".join(match.gaps)]
    )
    base = {"query": query, "response": response}
    return {
        "relevance": base,
        "coherence": base,
        "groundedness": {**base, "context": state["cv_text"]},
    }


async def run_evaluator(name: str, evaluator, inputs: dict) -> float | None:
    try:
        result = await asyncio.to_thread(evaluator, **inputs)
    except Exception:
        logger.warning("Quality evaluator %s failed", name, exc_info=True)
        return None
    value = result.get(name)
    return float(value) if isinstance(value, (int, float)) else None


async def quality_check(state: EvaluationState) -> dict:
    evaluators = get_quality_evaluators()
    inputs = build_quality_inputs(state)
    names = list(evaluators)
    values = await asyncio.gather(*[run_evaluator(name, evaluators[name], inputs[name]) for name in names])
    return {"quality": QualityScores(**dict(zip(names, values)))}
