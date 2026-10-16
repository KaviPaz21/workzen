import re

DELETE_PATTERN = re.compile(
    r"(?<![a-z])(delete|remove|erase|destroy|wipe|trash|discard|purge|deactivate|terminate|uninstall)(?![a-z])",
    re.IGNORECASE,
)
CREATE_PATTERN = re.compile(
    r"(?<![a-z])(create|add|new|submit|save|send|post|publish|upload|register|sign ?up|checkout|place order|buy|pay|confirm|book|schedule|invite|import|generate|share|order)(?![a-z])",
    re.IGNORECASE,
)
PLAIN_SUBMIT_PATTERN = re.compile(r"(?<![a-z])(search|find|filter|go|show|next|previous|back|continue|apply filters?|log ?in|sign ?in)(?![a-z])", re.IGNORECASE)


def classify(info: dict) -> str:
    label = str(info.get("label") or "")
    if DELETE_PATTERN.search(label):
        return "delete"
    if info.get("search"):
        return "none"
    words = {match.lower() for match in CREATE_PATTERN.findall(label)}
    if info.get("chat") and words <= {"send"}:
        return "none"
    if words:
        return "create"
    if info.get("isSubmit") and not PLAIN_SUBMIT_PATTERN.search(label):
        return "create"
    return "none"


def classify_form_submit(info: dict) -> str:
    if info.get("chat"):
        return "none"
    if info.get("form") and not info.get("search"):
        return "create"
    return "none"
