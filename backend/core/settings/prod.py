import dj_database_url

from .base import *  # noqa: F401, F403

DEBUG = False

# Require ALLOWED_HOSTS in production, falling back to Render's own domain
ALLOWED_HOSTS = [
    h.strip()
    for h in os.getenv("DJANGO_ALLOWED_HOSTS", ".onrender.com").split(",")  # noqa: F405
    if h.strip()
]

DATABASES = {
    "default": dj_database_url.config(
        default=os.getenv("DATABASE_URL"),  # noqa: F405
        conn_max_age=600,
        ssl_require=True,
    )
}

# HTTPS security headers
SECURE_SSL_REDIRECT = True
SECURE_HSTS_SECONDS = 31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True
SESSION_COOKIE_SECURE = True
SESSION_COOKIE_SAMESITE = "None"
CSRF_COOKIE_SECURE = True
CSRF_COOKIE_SAMESITE = "None"
CSRF_TRUSTED_ORIGINS = [
    o.strip()
    for o in os.getenv("DJANGO_CSRF_TRUSTED_ORIGINS", "").split(",")  # noqa: F405
    if o.strip()
]
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
