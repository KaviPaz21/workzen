import json
from collections.abc import AsyncIterator

from fastapi import APIRouter, Depends, status
from fastapi.responses import StreamingResponse

from app.api.deps import get_chat_service, get_user_id
from app.schemas.assistant.chat import ActionResult, AssistantOptions, ChatRequest, ChatSession, SessionSummary
from app.services.assistant.chat_service import ChatService

router = APIRouter(prefix="/assistant", tags=["assistant"])


async def encode_events(events: AsyncIterator[dict]) -> AsyncIterator[bytes]:
    async for event in events:
        yield (json.dumps(event) + "\n").encode("utf-8")


@router.get("/options", response_model=AssistantOptions)
async def read_options(service: ChatService = Depends(get_chat_service)):
    return await service.options()


@router.get("/sessions", response_model=list[SessionSummary])
async def list_sessions(user_id: str = Depends(get_user_id), service: ChatService = Depends(get_chat_service)):
    return await service.list_sessions(user_id)


@router.get("/sessions/{session_id}", response_model=ChatSession)
async def read_session(session_id: str, user_id: str = Depends(get_user_id), service: ChatService = Depends(get_chat_service)):
    return await service.get_session(user_id, session_id)


@router.delete("/sessions/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_session(session_id: str, user_id: str = Depends(get_user_id), service: ChatService = Depends(get_chat_service)):
    await service.delete_session(user_id, session_id)


@router.post("/chat")
async def chat(request: ChatRequest, user_id: str = Depends(get_user_id), service: ChatService = Depends(get_chat_service)):
    service.check_request(request)
    return StreamingResponse(
        encode_events(service.stream_chat(user_id, request)),
        media_type="application/x-ndjson",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.post("/coworker/runs/{run_id}/actions/{action_id}", status_code=status.HTTP_204_NO_CONTENT)
async def submit_action_result(
    run_id: str,
    action_id: str,
    result: ActionResult,
    user_id: str = Depends(get_user_id),
    service: ChatService = Depends(get_chat_service),
):
    await service.submit_action_result(user_id, run_id, action_id, result)
