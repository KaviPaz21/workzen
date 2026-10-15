import secrets

from fastapi import Depends, Header, HTTPException, Request

from app.config import Settings, get_settings


def load_or_create_token(settings: Settings) -> str:
    path = settings.token_file
    if path.exists():
        existing = path.read_text(encoding="utf-8").strip()
        if existing:
            return existing
    path.parent.mkdir(parents=True, exist_ok=True)
    token = secrets.token_urlsafe(18)
    path.write_text(token, encoding="utf-8")
    return token


def require_token(
    request: Request,
    authorization: str = Header(default=""),
    settings: Settings = Depends(get_settings),
) -> None:
    expected = request.app.state.token
    scheme, _, supplied = authorization.partition(" ")
    if scheme.lower() != "bearer" or not secrets.compare_digest(supplied.strip(), expected):
        raise HTTPException(status_code=401, detail="The pairing code is not correct")
    origin = request.headers.get("origin")
    if origin and origin not in settings.coworker_allowed_origins:
        raise HTTPException(status_code=403, detail="This website is not allowed to control the Co-worker")

