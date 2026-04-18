"""Verify AbstractCognitoClient defines the required interface."""
import inspect

import pytest

from src.clients.base import AbstractCognitoClient


def test_abstract_cognito_client_cannot_be_instantiated() -> None:
    with pytest.raises(TypeError):
        AbstractCognitoClient()  # type: ignore[abstract]


def test_abstract_methods_present() -> None:
    abstract_methods = {
        name
        for name, method in inspect.getmembers(AbstractCognitoClient, predicate=inspect.isfunction)
        if getattr(method, "__isabstractmethod__", False)
    }
    assert abstract_methods == {"register", "login", "logout", "refresh_token"}


def test_all_methods_are_coroutines() -> None:
    for name in ("register", "login", "logout", "refresh_token"):
        method = getattr(AbstractCognitoClient, name)
        assert inspect.iscoroutinefunction(method), f"{name} must be async"
