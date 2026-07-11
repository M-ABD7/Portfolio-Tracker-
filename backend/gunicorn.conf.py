import os

bind = f"0.0.0.0:{os.environ.get('PORT', '8000')}"
workers = 3
worker_class = "sync"
timeout = 120
keepalive = 5
accesslog = "logs/gunicorn-access.log"
errorlog = "logs/gunicorn-error.log"
loglevel = "info"