from django.apps import AppConfig


class PortfolioConfig(AppConfig):
    name = "apps.portfolio"
    label = "apps_portfolio"  # Distinct from legacy 'portfolio'; changed to 'portfolio' in Phase 9
    default_auto_field = "django.db.models.BigAutoField"
