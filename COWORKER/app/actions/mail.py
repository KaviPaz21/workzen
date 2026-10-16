import os
from urllib.parse import quote

from pydantic import BaseModel, Field

from app.actions.errors import ActionError
from app.config import Settings

MAX_MAILTO_CHARACTERS = 1800
RECIPIENT_PATTERN_CHARACTERS = set("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@._-+")


class MailArgs(BaseModel):
    to: list[str] = Field(default_factory=list, max_length=10)
    cc: list[str] = Field(default_factory=list, max_length=10)
    subject: str = Field(max_length=200)
    body: str = Field(max_length=6000)


def checked_addresses(addresses: list[str]) -> list[str]:
    for address in addresses:
        if "@" not in address or not set(address) <= RECIPIENT_PATTERN_CHARACTERS:
            raise ActionError(f"'{address}' is not a valid email address.")
    return addresses


def build_mailto(parsed: MailArgs) -> str:
    query = []
    cc = checked_addresses(parsed.cc)
    if cc:
        query.append("cc=" + ",".join(cc))
    query.append("subject=" + quote(parsed.subject, safe=""))
    query.append("body=" + quote(parsed.body.replace("\r\n", "\n").replace("\n", "\r\n"), safe=""))
    return f"mailto:{','.join(checked_addresses(parsed.to))}?" + "&".join(query)


async def draft_email(settings: Settings, args: dict) -> dict:
    parsed = MailArgs(**args)
    link = build_mailto(parsed)
    if len(link) > MAX_MAILTO_CHARACTERS:
        raise ActionError("The email is too long to open as a draft in a mail app. Shorten it, or save it as a Word document instead.")
    if not settings.coworker_launch_apps:
        raise ActionError("Opening apps is switched off on this computer, so the draft could not be opened in the mail app.")
    os.startfile(link)
    return {"opened": True, "to": parsed.to, "subject": parsed.subject, "note": "The draft is open in the user's mail app. It has not been sent."}