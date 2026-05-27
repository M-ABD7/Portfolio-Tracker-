bind = "0.0.0.0:8000"
workers = 3
worker_class = "sync"
timeout = 120
keepalive = 5
accesslog = "logs/gunicorn-access.log"
errorlog = "logs/gunicorn-error.log"
loglevel = "info"