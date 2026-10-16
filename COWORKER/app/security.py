import asyncio
import secrets
from urllib.parse import urlparse

from fastapi import Depends, Header, HTTPException, Request

from app import dialogs
from app.config import Settings, get_settings

PAIRING_QUESTION = (
    "The website {host} wants to connect to WorkZen Co-worker.\n\n"
    "If you allow this, the WorkZen AI Assistant can do small tasks on this computer, "
    "such as opening web pages and creating Word documents. It will ask you before every action.\n\n"
    "Do you want to allow it?"
)


def load_or_create_token(settings: Settings) -> str:
    path = settings.token_file
    if path.exists():
        existing = path.read_text(encoding="utf-8").strip()
        if existing:
            return existing
    return replace_token(settings)


def replace_token(settings: Settings) -> str:
    path = settings.token_file
    path.parent.mkdir(parents=True, exist_ok=True)
    token = secrets.token_urlsafe(18)
    path.write_text(token, encoding="utf-8")
    return token


def ask_user_to_pair(origin: str) -> bool:
    host = urlparse(origin).netloc or origin
    return dialogs.ask(PAIRING_QUESTION.format(host=host))


async def confirm_pairing(settings: Settings, origin: str) -> bool:
    if not settings.coworker_pairing_prompt:
        return True
    return await asyncio.to_thread(ask_user_to_pair, origin)


def require_allowed_origin(request: Request, settings: Settings) -> str:
    origin = request.headers.get("origin", "")
    if origin not in settings.coworker_allowed_origins:
        raise HTTPException(status_code=403, detail="This website is not allowed to control the Co-worker")
    return origin


def require_token(
    request: Request,
    authorization: str = Header(default=""),
    settings: Settings = Depends(get_settings),
) -> None:
    expected = request.app.state.token
    scheme, _, supplied = authorization.partition(" ")
    if scheme.lower() != "bearer" or not secrets.compare_digest(supplied.strip(), expected):
        raise HTTPException(status_code=401, detail="The connection is not set up or has been reset")
    origin = request.headers.get("origin")
    if origin and origin not in settings.coworker_allowed_origins:
        raise HTTPException(status_code=403, detail="This website is not allowed to control the Co-worker")
