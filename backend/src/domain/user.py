from dataclasses import dataclass, field


@dataclass(frozen=True)
class CurrentUser:
    user_id: str
    email: str
    """Cognito group names from the access token (`cognito:groups`)."""

    groups: frozenset[str] = field(default_factory=frozenset)
