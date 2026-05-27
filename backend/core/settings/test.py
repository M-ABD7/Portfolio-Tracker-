"""
Test settings — uses SQLite so tests run without a PostgreSQL server.
"""
from .dev import *  # noqa: F401, F403

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": ":memory:",
    }
}

# Disable whitenoise in tests
STATICFILES_STORAGE = "django.contrib.staticfiles.storage.StaticFilesStorage"
