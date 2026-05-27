from django.contrib.auth.models import User
from django.db import models


class ExchangeSyncLog(models.Model):
    """Records each exchange sync attempt for audit and monitoring."""
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="sync_logs")
    exchange = models.CharField(max_length=20)
    synced_count = models.IntegerField(default=0)
    added_count = models.IntegerField(default=0)
    updated_count = models.IntegerField(default=0)
    error = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"SyncLog({self.user.username}, {self.exchange}, {self.created_at:%Y-%m-%d})"
