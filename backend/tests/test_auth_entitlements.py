"""Helmholtz OAuth callback entitlement/VO restriction tests."""

from unittest.mock import patch

from backend.extensions import db

MEMBER_ENTITLEMENT = "urn:geant:helmholtz.de:group:Helmholtz-member"
OTHER_ENTITLEMENT = "urn:geant:helmholtz.de:group:Some-other-group"


def _callback(client, sub: str, entitlements: list[str]):
    token = {"access_token": "token", "userinfo": {"sub": sub, "entitlements": entitlements}}
    with patch("backend.routes.auth.oauth.helmholtz.authorize_access_token", return_value=token):
        return client.get("/auth/callback")


def test_helmholtz_callback_accepts_required_entitlement(client, monkeypatch):
    """A user holding the configured required entitlement is logged in.

    Arguments:
        client {Any} -- anonymous Flask test client
        monkeypatch {pytest.MonkeyPatch} -- reverts the config overrides after the test
    """
    monkeypatch.setitem(client.application.config, "HELMHOLTZ_RESTRICT_BY_ENTITLEMENT", True)
    monkeypatch.setitem(client.application.config, "HELMHOLTZ_REQUIRED_ENTITLEMENT", MEMBER_ENTITLEMENT)

    response = _callback(client, "sub-member", [MEMBER_ENTITLEMENT])

    assert response.status_code == 302
    assert "oauth_error" not in response.headers["Location"]
    assert db.users.find_one({"helmholtz_sub": "sub-member"}) is not None


def test_helmholtz_callback_rejects_non_member(client, monkeypatch):
    """A user without the required entitlement is denied and no account is created.

    Arguments:
        client {Any} -- anonymous Flask test client
        monkeypatch {pytest.MonkeyPatch} -- reverts the config overrides after the test

    Notes:
        Denial is a redirect with an oauth_error query param, not a 401/403.
    """
    monkeypatch.setitem(client.application.config, "HELMHOLTZ_RESTRICT_BY_ENTITLEMENT", True)
    monkeypatch.setitem(client.application.config, "HELMHOLTZ_REQUIRED_ENTITLEMENT", MEMBER_ENTITLEMENT)

    response = _callback(client, "sub-outsider", [OTHER_ENTITLEMENT])

    assert response.status_code == 302
    assert "oauth_error=vo_access_denied" in response.headers["Location"]
    assert db.users.find_one({"helmholtz_sub": "sub-outsider"}) is None


def test_helmholtz_callback_allows_all_when_restriction_disabled(client, monkeypatch):
    """With entitlement restriction disabled, any authenticated user is accepted.

    Arguments:
        client {Any} -- anonymous Flask test client
        monkeypatch {pytest.MonkeyPatch} -- reverts the config overrides after the test
    """
    monkeypatch.setitem(client.application.config, "HELMHOLTZ_RESTRICT_BY_ENTITLEMENT", False)

    response = _callback(client, "sub-no-entitlements", [])

    assert response.status_code == 302
    assert "oauth_error" not in response.headers["Location"]
    assert db.users.find_one({"helmholtz_sub": "sub-no-entitlements"}) is not None


def test_helmholtz_callback_accepts_any_of_multiple_required_vos(client, monkeypatch):
    """Matching any one of several configured required VOs is sufficient to log in.

    Arguments:
        client {Any} -- anonymous Flask test client
        monkeypatch {pytest.MonkeyPatch} -- reverts the config overrides after the test

    Notes:
        HELMHOLTZ_REQUIRED_ENTITLEMENT accepts a comma-separated list of VOs.
    """
    monkeypatch.setitem(client.application.config, "HELMHOLTZ_RESTRICT_BY_ENTITLEMENT", True)
    monkeypatch.setitem(
        client.application.config,
        "HELMHOLTZ_REQUIRED_ENTITLEMENT",
        f"{OTHER_ENTITLEMENT},{MEMBER_ENTITLEMENT}",
    )

    response = _callback(client, "sub-second-vo", [MEMBER_ENTITLEMENT])

    assert response.status_code == 302
    assert "oauth_error" not in response.headers["Location"]
    assert db.users.find_one({"helmholtz_sub": "sub-second-vo"}) is not None
