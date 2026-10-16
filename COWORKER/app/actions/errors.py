class ActionError(Exception):
    pass


class ApprovalNeeded(ActionError):
    def __init__(self, label: str, effect: str):
        super().__init__(f"'{label}' may create or submit something, so it needs the user's approval first.")
        self.label = label
        self.effect = effect
