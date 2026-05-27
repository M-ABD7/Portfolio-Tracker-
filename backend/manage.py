#!/usr/bin/env python
"""Django's command-line utility for administrative tasks."""
import os
import sys
from pathlib import Path


def main():
    # Add backend/tracker/ to sys.path so the legacy `portfolio` app is importable
    # during the transition period (removed in Phase 9).
    tracker_dir = str(Path(__file__).resolve().parent / "tracker")
    if tracker_dir not in sys.path:
        sys.path.insert(0, tracker_dir)
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings.dev")
    try:
        from django.core.management import execute_from_command_line
    except ImportError as exc:
        raise ImportError(
            "Couldn't import Django. Are you sure it's installed and "
            "available on your PYTHONPATH environment variable? Did you "
            "forget to activate a virtual environment?"
        ) from exc
    execute_from_command_line(sys.argv)


if __name__ == "__main__":
    main()
