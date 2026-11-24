"""
Production settings for StockFlow.
"""

import os

from django.core.exceptions import ImproperlyConfigured

from .base import *  # noqa: F403, F401

debug_setting = os.environ.get("DEBUG", "false").strip().lower()
if debug_setting not in {"false", "0", "no", "off"}:
    raise ImproperlyConfigured("DEBUG must remain disabled in production.")
DEBUG = False

SECRET_KEY = os.environ.get("DJANGO_SECRET_KEY")
if not SECRET_KEY:
    raise ImproperlyConfigured("DJANGO_SECRET_KEY must be set in production.")

ALLOWED_HOSTS = [
    host.strip() for host in os.environ.get("ALLOWED_HOSTS", "").split(",") if host.strip()
]
CSRF_TRUSTED_ORIGINS = [
    origin.strip()
    for origin in os.environ.get("CSRF_TRUSTED_ORIGINS", "").split(",")
    if origin.strip()
]

ssl_redirect = os.environ.get("SECURE_SSL_REDIRECT", "true").strip().lower()
if ssl_redirect not in {"true", "false", "1", "0", "yes", "no", "on", "off"}:
    raise ImproperlyConfigured("SECURE_SSL_REDIRECT must be a boolean value.")
SECURE_SSL_REDIRECT = ssl_redirect in {"true", "1", "yes", "on"}
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SESSION_COOKIE_SAMESITE = "Lax"
SECURE_HSTS_SECONDS = 31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True
SECURE_CONTENT_TYPE_NOSNIFF = True

STATIC_URL = "/static/"

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "json": {"()": "config.logging.JsonFormatter"},
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "json",
        },
    },
    "root": {
        "handlers": ["console"],
        "level": os.environ.get("LOG_LEVEL", "INFO").upper(),
    },
    "loggers": {
        "django": {
            "handlers": ["console"],
            "level": os.environ.get("LOG_LEVEL", "INFO").upper(),
            "propagate": False,
        },
        "django.server": {
            "handlers": ["console"],
            "level": os.environ.get("LOG_LEVEL", "INFO").upper(),
            "propagate": False,
        },
    },
}
