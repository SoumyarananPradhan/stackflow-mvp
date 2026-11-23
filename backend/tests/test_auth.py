"""Tests for the accounts app: auth endpoints."""

from unittest.mock import patch

import pytest
from django.contrib import admin
from django.db import IntegrityError
from rest_framework.test import APIClient

from accounts.models import Organization, User
from accounts.views import SignupSerializer

SIGNUP_URL = "/api/auth/signup/"
LOGIN_URL = "/api/auth/login/"
LOGOUT_URL = "/api/auth/logout/"
ME_URL = "/api/auth/me/"
CSRF_URL = "/api/auth/csrf/"

VALID_PASSWORD = "Str0ng!Pass#99"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


@pytest.fixture()
def api_client():
    """Plain DRF APIClient (no CSRF enforcement — simulates normal test use)."""
    return APIClient()


@pytest.fixture()
def csrf_client():
    """APIClient with CSRF checks enabled."""
    return APIClient(enforce_csrf_checks=True)


def signup(client, **overrides):
    """Helper: POST a valid signup payload (overrides merged in)."""
    data = {
        "email": "test@example.com",
        "password": VALID_PASSWORD,
        "confirm_password": VALID_PASSWORD,
        "organization_name": "Acme Corp",
    }
    data.update(overrides)
    return client.post(SIGNUP_URL, data, format="json")


def _get_csrf_token(client):
    """Fetch a CSRF token via the csrf endpoint and return it."""
    resp = client.get(CSRF_URL)
    assert resp.status_code == 204
    return resp.cookies["csrftoken"].value


# ---------------------------------------------------------------------------
# Signup
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestSignup:
    def test_signup_creates_org_and_user(self, api_client):
        resp = signup(api_client)
        assert resp.status_code == 201
        data = resp.json()
        assert data["email"] == "test@example.com"
        assert data["organization"]["name"] == "Acme Corp"
        assert User.objects.count() == 1
        assert Organization.objects.count() == 1

    def test_user_manager_normalizes_email_and_creates_superuser(self):
        organization = Organization.objects.create(name="Acme Corp")
        user = User.objects.create_user(
            email=" Test@Example.COM ",
            password=VALID_PASSWORD,
            organization=organization,
        )
        superuser = User.objects.create_superuser(
            email=" Admin@Example.COM ",
            password=VALID_PASSWORD,
            organization=organization,
        )

        assert user.email == "test@example.com"
        assert superuser.email == "admin@example.com"
        assert superuser.is_staff
        assert superuser.is_superuser

    def test_user_admin_creation_uses_normalized_email(self):
        organization = Organization.objects.create(name="Acme Corp")
        form_class = admin.site._registry[User].add_form
        form = form_class(
            data={
                "email": " Admin@Example.COM ",
                "organization": organization.pk,
                "password1": VALID_PASSWORD,
                "password2": VALID_PASSWORD,
            }
        )

        assert "username" not in form.fields
        assert form.is_valid(), form.errors
        assert form.save().email == "admin@example.com"

    def test_signup_logs_user_in(self, api_client):
        signup(api_client)
        resp = api_client.get(ME_URL)
        assert resp.status_code == 200
        assert resp.json()["email"] == "test@example.com"

    def test_signup_duplicate_email_case_insensitive(self, api_client):
        signup(api_client, email="Test@Example.com")
        resp = signup(api_client, email="test@example.com", organization_name="Other Corp")
        assert resp.status_code == 400
        assert "email" in resp.json()

    def test_signup_weak_password_rejected(self, api_client):
        resp = signup(api_client, password="123", confirm_password="123")
        assert resp.status_code == 400
        assert "password" in resp.json()

    def test_signup_password_mismatch(self, api_client):
        resp = signup(api_client, confirm_password="different")
        assert resp.status_code == 400
        assert "confirm_password" in resp.json()

    def test_signup_empty_org_name_rejected(self, api_client):
        resp = signup(api_client, organization_name="   ")
        assert resp.status_code == 400
        assert "organization_name" in resp.json()

    def test_failed_signup_rolls_back_organization(self):
        data = {
            "email": "test@example.com",
            "password": VALID_PASSWORD,
            "confirm_password": VALID_PASSWORD,
            "organization_name": "Acme Corp",
        }
        serializer = SignupSerializer(data=data)
        assert serializer.is_valid(), serializer.errors

        with (
            patch.object(User, "save", side_effect=IntegrityError("forced failure")),
            pytest.raises(IntegrityError, match="forced failure"),
        ):
            serializer.save()

        assert Organization.objects.count() == 0
        assert User.objects.count() == 0


# ---------------------------------------------------------------------------
# Login
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestLogin:
    def test_login_success(self, api_client):
        signup(api_client)
        api_client.logout()
        resp = api_client.post(
            LOGIN_URL,
            {"email": "test@example.com", "password": VALID_PASSWORD},
            format="json",
        )
        assert resp.status_code == 200
        assert resp.json()["email"] == "test@example.com"

    def test_login_failure_wrong_password(self, api_client):
        signup(api_client)
        api_client.logout()
        resp = api_client.post(
            LOGIN_URL,
            {"email": "test@example.com", "password": "wrong"},
            format="json",
        )
        assert resp.status_code == 400
        assert resp.json()["detail"] == "Invalid email or password"

    def test_login_failure_no_user(self, api_client):
        resp = api_client.post(
            LOGIN_URL,
            {"email": "nobody@example.com", "password": "whatever"},
            format="json",
        )
        assert resp.status_code == 400
        assert resp.json()["detail"] == "Invalid email or password"


# ---------------------------------------------------------------------------
# Logout
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestLogout:
    def test_logout(self, api_client):
        signup(api_client)
        resp = api_client.post(LOGOUT_URL)
        assert resp.status_code == 204
        # After logout, /me/ should fail
        resp = api_client.get(ME_URL)
        assert resp.status_code in (401, 403)


# ---------------------------------------------------------------------------
# Me
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestMe:
    def test_me_authenticated(self, api_client):
        signup(api_client)
        resp = api_client.get(ME_URL)
        assert resp.status_code == 200
        data = resp.json()
        assert data["email"] == "test@example.com"
        assert "organization" in data
        assert data["organization"]["id"] is not None
        assert data["organization"]["name"] == "Acme Corp"

    def test_me_unauthenticated(self, api_client):
        resp = api_client.get(ME_URL)
        assert resp.status_code in (401, 403)


# ---------------------------------------------------------------------------
# CSRF enforcement
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestCsrf:
    def test_csrf_endpoint_sets_cookie(self, api_client):
        resp = api_client.get(CSRF_URL)
        assert resp.status_code == 204
        assert "csrftoken" in resp.cookies

    def test_signup_without_csrf_token_rejected(self, csrf_client):
        """With enforce_csrf_checks=True, POST without token is rejected."""
        resp = signup(csrf_client)
        assert resp.status_code == 403

    def test_signup_with_csrf_token_accepted(self, csrf_client):
        """Fetch CSRF cookie first, then POST with the token header."""
        token = _get_csrf_token(csrf_client)
        csrf_client.credentials(HTTP_X_CSRFTOKEN=token)
        resp = signup(csrf_client)
        assert resp.status_code == 201

    def test_login_without_csrf_token_rejected(self, csrf_client):
        """Login also requires CSRF token."""
        resp = csrf_client.post(
            LOGIN_URL,
            {"email": "test@example.com", "password": VALID_PASSWORD},
            format="json",
        )
        assert resp.status_code == 403

    def test_login_with_csrf_token_accepted(self, csrf_client):
        signup(APIClient())
        token = _get_csrf_token(csrf_client)
        csrf_client.credentials(HTTP_X_CSRFTOKEN=token)
        resp = csrf_client.post(
            LOGIN_URL,
            {"email": "test@example.com", "password": VALID_PASSWORD},
            format="json",
        )
        assert resp.status_code == 200
