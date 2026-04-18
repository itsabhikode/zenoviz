"""Architecture compliance: ensure all route handlers are async."""
import inspect

from src.main import health


def test_health_endpoint_is_async() -> None:
    assert inspect.iscoroutinefunction(health), (
        "health() must be 'async def' — all route handlers must be async per CLAUDE.md"
    )
