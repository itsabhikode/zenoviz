"""Architecture compliance: ensure all route handlers are async."""
import inspect
from typing import get_type_hints

from src.clients.base import AbstractCognitoClient
from src.dependencies import get_cognito_client
from src.main import health


def test_health_endpoint_is_async() -> None:
    assert inspect.iscoroutinefunction(health), (
        "health() must be 'async def' — all route handlers must be async per CLAUDE.md"
    )


def test_get_cognito_client_returns_abstract_type() -> None:
    hints = get_type_hints(get_cognito_client)
    assert hints["return"] is AbstractCognitoClient, (
        "get_cognito_client() must be annotated to return AbstractCognitoClient, "
        "not the concrete CognitoClient, to honour the client ABC pattern"
    )
