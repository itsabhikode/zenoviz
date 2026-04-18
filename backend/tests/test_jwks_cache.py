"""Tests for JWKSCache — encapsulates the previously global _jwks_cache."""
from unittest.mock import MagicMock, patch

from src.dependencies import JWKSCache

FAKE_JWKS_URL = "https://cognito-idp.us-east-1.amazonaws.com/us-east-1_ABC/.well-known/jwks.json"
FAKE_JWKS = {"keys": [{"kid": "test-key-id", "kty": "RSA"}]}


def _mock_httpx_get(return_value: dict) -> MagicMock:
    mock_resp = MagicMock()
    mock_resp.json.return_value = return_value
    mock_resp.raise_for_status = MagicMock()
    return mock_resp


def test_jwks_cache_fetches_on_first_call() -> None:
    cache = JWKSCache()
    with patch("src.dependencies.httpx.get", return_value=_mock_httpx_get(FAKE_JWKS)) as mock_get:
        result = cache.get(FAKE_JWKS_URL)
    assert result == FAKE_JWKS
    mock_get.assert_called_once_with(FAKE_JWKS_URL)


def test_jwks_cache_reuses_cached_value_on_second_call() -> None:
    cache = JWKSCache()
    with patch("src.dependencies.httpx.get", return_value=_mock_httpx_get(FAKE_JWKS)) as mock_get:
        cache.get(FAKE_JWKS_URL)
        cache.get(FAKE_JWKS_URL)
    assert mock_get.call_count == 1


def test_jwks_cache_refetches_after_invalidate() -> None:
    cache = JWKSCache()
    with patch("src.dependencies.httpx.get", return_value=_mock_httpx_get(FAKE_JWKS)) as mock_get:
        cache.get(FAKE_JWKS_URL)
        cache.invalidate()
        cache.get(FAKE_JWKS_URL)
    assert mock_get.call_count == 2


def test_jwks_cache_returns_fresh_keys_after_invalidate() -> None:
    cache = JWKSCache()
    old_jwks = {"keys": [{"kid": "old"}]}
    new_jwks = {"keys": [{"kid": "new"}]}
    with patch("src.dependencies.httpx.get") as mock_get:
        mock_get.return_value = _mock_httpx_get(old_jwks)
        cache.get(FAKE_JWKS_URL)
        cache.invalidate()
        mock_get.return_value = _mock_httpx_get(new_jwks)
        result = cache.get(FAKE_JWKS_URL)
    assert result == new_jwks
