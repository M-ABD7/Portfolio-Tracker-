from .base import *  # noqa: F401, F403

DEBUG = True
ALLOWED_HOSTS = ["localhost", "127.0.0.1"]

# Relax static files storage in dev (no manifest needed)
STATICFILES_STORAGE = "django.contrib.staticfiles.storage.StaticFilesStorage"
