from django.contrib import admin

from portfolio.models import Asset, Holding, Portfolio, Transaction


@admin.register(Portfolio)
class PortfolioAdmin(admin.ModelAdmin):
    list_display = ("name", "user", "created_at")
    search_fields = ("name", "user__username")
    ordering = ("-created_at",)


@admin.register(Asset)
class AssetAdmin(admin.ModelAdmin):
    list_display = ("symbol", "name", "asset_type")
    list_filter = ("asset_type",)
    search_fields = ("symbol", "name")
    ordering = ("symbol",)


@admin.register(Holding)
class HoldingAdmin(admin.ModelAdmin):
    list_display = ("asset", "portfolio", "quantity", "cost_basis")
    list_filter = ("asset__asset_type",)
    search_fields = ("asset__symbol", "portfolio__user__username")


@admin.register(Transaction)
class TransactionAdmin(admin.ModelAdmin):
    list_display = ("transaction_type", "asset", "quantity", "price", "created_at")
    list_filter = ("transaction_type",)
    search_fields = ("asset__symbol", "portfolio__user__username")
    ordering = ("-created_at",)
