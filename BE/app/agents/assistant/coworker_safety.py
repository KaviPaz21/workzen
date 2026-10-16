import re

DELETE_PATTERN = re.compile(
    r"(?<![a-z])(delete|remove|erase|destroy|wipe|trash|discard|purge|deactivate|terminate|uninstall)(?![a-z])",
    re.IGNORECASE,
)
CREATE_PATTERN = re.compile(
    r"(?<![a-z])(create|add|new|save|publish|upload|register|sign ?up|checkout|place order|buy|pay|book|schedule|invite|import|order)(?![a-z])",
    re.IGNORECASE,
)

DELETE_MESSAGE = "Co-worker cannot delete things, whatever permissions are set, so this action was not run."


def wants_delete(args: dict) -> bool:
    if args.get("effect") == "deletes":
        return True
    return bool(DELETE_PATTERN.search(f"{args.get('target') or ''} {args.get('label') or ''}"))


def wants_create(args: dict) -> bool:
    if args.get("effect") == "creates":
        return True
    return bool(CREATE_PATTERN.search(f"{args.get('target') or ''} {args.get('label') or ''}"))
