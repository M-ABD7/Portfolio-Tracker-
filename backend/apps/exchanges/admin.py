from django.contrib import admin

from portfolio.models import ExchangeConnection

from .models import ExchangeSyncLog


@admin.register(ExchangeConnection)
class ExchangeConnectionAdmin(admin.ModelAdmin):
    list_display = ("user", "exchange", "masked_key_display", "is_active", "last_synced_at", "created_at")
    list_filter = ("exchange", "is_active")
    search_fields = ("user__username",)
    readonly_fields = ("api_key_enc", "api_secret_enc", "passphrase_enc", "created_at", "last_synced_at")
    ordering = ("-created_at",)

    @admin.display(description="Masked Key")
    def masked_key_display(self, obj):
        return obj.masked_key()


@admin.register(ExchangeSyncLog)
class ExchangeSyncLogAdmin(admin.ModelAdmin):
    list_display = ("user", "exchange", "synced_count", "added_count", "updated_count", "error", "created_at")
    list_filter = ("exchange",)
    search_fields = ("user__username",)
    ordering = ("-created_at",)
    readonly_fields = ("user", "exchange", "synced_count", "added_count", "updated_count", "error", "created_at")
