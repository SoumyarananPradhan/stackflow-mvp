"""Minimal smoke test: Django settings load correctly."""

from django.conf import settings


def test_settings_load():
    """Verify the Django project settings are configured."""
    assert settings.ROOT_URLCONF == "config.urls"
    assert settings.AUTH_USER_MODEL == "accounts.User"
    assert settings.REST_FRAMEWORK["PAGE_SIZE"] == 20
    assert "rest_framework" in settings.INSTALLED_APPS
    assert "drf_spectacular" in settings.INSTALLED_APPS
    assert "accounts" in settings.INSTALLED_APPS
    assert "inventory" in settings.INSTALLED_APPS
    assert "core" in settings.INSTALLED_APPS
