"""
Development settings for StockFlow.
"""

from .base import *  # noqa: F403, F401

DEBUG = True

ALLOWED_HOSTS = ["*"]

# In development, use a simple secret key
SECRET_KEY = "django-insecure-dev-only-key-do-not-use-in-production"
