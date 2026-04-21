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
    assert abstract_methods == {
        "register",
        "login",
        "forgot_password",
        "confirm_forgot_password",
        "logout",
        "refresh_token",
        "resolve_sub_by_email",
        "list_users",
        "get_user_by_sub",
        "admin_add_user_to_group",
        "admin_remove_user_from_group",
        "admin_list_groups_for_user",
        "admin_list_users_in_group",
    }


def test_all_methods_are_coroutines() -> None:
    for name in (
        "register",
        "login",
        "forgot_password",
        "confirm_forgot_password",
        "logout",
        "refresh_token",
        "resolve_sub_by_email",
        "list_users",
        "get_user_by_sub",
        "admin_add_user_to_group",
        "admin_remove_user_from_group",
        "admin_list_groups_for_user",
        "admin_list_users_in_group",
    ):
        method = getattr(AbstractCognitoClient, name)
        assert inspect.iscoroutinefunction(method), f"{name} must be async"
