"""
Development settings for StockFlow.
"""

import os

from .base import *  # noqa: F403, F401

DEBUG = True

ALLOWED_HOSTS = ["*"]
CSRF_TRUSTED_ORIGINS = list(
    dict.fromkeys(
        [
            "http://localhost:5173",
            "http://127.0.0.1:5173",
            *(
                origin.strip()
                for origin in os.environ.get("CSRF_TRUSTED_ORIGINS", "").split(",")
                if origin.strip()
            ),
        ]
    )
)

# In development, use a simple secret key
SECRET_KEY = "django-insecure-dev-only-key-do-not-use-in-production"
