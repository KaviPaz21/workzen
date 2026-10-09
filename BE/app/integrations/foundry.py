from functools import lru_cache

from azure.ai.evaluation import (
    AzureOpenAIModelConfiguration,
    CoherenceEvaluator,
    GroundednessEvaluator,
    RelevanceEvaluator,
)
from langchain_openai import AzureChatOpenAI

from app.core.config import get_settings


@lru_cache
def get_chat_model() -> AzureChatOpenAI:
    settings = get_settings()
    return AzureChatOpenAI(
        azure_endpoint=settings.foundry_endpoint,
        api_key=settings.foundry_api_key.get_secret_value(),
        api_version=settings.foundry_api_version,
        azure_deployment=settings.foundry_chat_deployment,
    )


@lru_cache
def get_quality_evaluators() -> dict:
    settings = get_settings()
    model_config = AzureOpenAIModelConfiguration(
        azure_endpoint=settings.foundry_endpoint,
        api_key=settings.foundry_api_key.get_secret_value(),
        api_version=settings.foundry_api_version,
        azure_deployment=settings.foundry_evaluator_deployment or settings.foundry_chat_deployment,
    )
    return {
        "relevance": RelevanceEvaluator(model_config),
        "coherence": CoherenceEvaluator(model_config),
        "groundedness": GroundednessEvaluator(model_config),
    }
