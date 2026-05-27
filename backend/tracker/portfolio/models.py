from django.db import models
from django.contrib.auth.models import User


class Asset(models.Model):
    ASSET_TYPES = [
        ('crypto', 'Cryptocurrency'),
        ('forex', 'Forex'),
        ('commodity', 'Commodity'),
        ('stock', 'Stock'),
    ]

    symbol = models.CharField(max_length=50, unique=True)
    name = models.CharField(max_length=100)
    asset_type = models.CharField(max_length=20, choices=ASSET_TYPES)
    # Stores market_symbol only — exchange moved to Holding.metadata
    metadata = models.JSONField(default=dict, blank=True)

    def __str__(self):
        return f"{self.symbol} ({self.asset_type})"


class PricePoint(models.Model):
    asset = models.ForeignKey(Asset, on_delete=models.CASCADE, related_name="price_points")
    timestamp = models.DateTimeField(db_index=True)
    open = models.FloatField()
    high = models.FloatField()
    low = models.FloatField()
    close = models.FloatField()
    volume = models.FloatField(null=True, blank=True)
    indicators = models.JSONField(default=dict, blank=True)

    class Meta:
        unique_together = ('asset', 'timestamp')
        ordering = ['timestamp']

    def __str__(self):
        return f"{self.asset.symbol} @ {self.timestamp}"


class Portfolio(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    name = models.CharField(max_length=100)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('user', 'name')

    def __str__(self):
        return f"{self.name} ({self.user.username})"


class Holding(models.Model):
    portfolio = models.ForeignKey(Portfolio, on_delete=models.CASCADE, related_name="holdings")
    asset = models.ForeignKey(Asset, on_delete=models.CASCADE)
    quantity = models.FloatField()
    cost_basis = models.FloatField(null=True, blank=True)
    # FIX: stores exchange per-holding so the same symbol can exist on
    # multiple exchanges (e.g. ETH on Binance AND ETH on MEXC)
    metadata = models.JSONField(default=dict, blank=True)

    def __str__(self):
        exchange = self.metadata.get("exchange", "")
        return f"{self.asset.symbol} - {self.quantity} ({exchange})"


class ExchangeConnection(models.Model):
    EXCHANGE_CHOICES = [
        ("okx", "OKX"),
        ("mexc", "MEXC"),
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="exchange_connections")
    exchange = models.CharField(max_length=20, choices=EXCHANGE_CHOICES)
    api_key_enc = models.TextField()
    api_secret_enc = models.TextField()
    # Passphrase required by OKX; null/blank for other exchanges
    passphrase_enc = models.TextField(blank=True, null=True)
    is_active = models.BooleanField(default=True)
    last_synced_at = models.DateTimeField(null=True, blank=True)
    # Non-empty when dangerous permissions (trading/withdrawal) are detected on the key
    permissions_warning = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("user", "exchange")

    def __str__(self):
        return f"{self.user.username} – {self.exchange}"

    def masked_key(self) -> str:
        from .encryption import decrypt
        plain = decrypt(self.api_key_enc)
        return f"{'*' * (len(plain) - 4)}{plain[-4:]}" if len(plain) > 4 else "****"


class Transaction(models.Model):
    TRANSACTION_TYPES = [
        ("buy", "Buy"),
        ("sell", "Sell"),
        ("transfer", "Transfer"),
    ]

    portfolio = models.ForeignKey(
        Portfolio, on_delete=models.CASCADE, related_name="transactions",
    )
    asset = models.ForeignKey(
        Asset, on_delete=models.CASCADE, related_name="transactions",
    )
    transaction_type = models.CharField(max_length=20, choices=TRANSACTION_TYPES)
    quantity = models.FloatField()
    price = models.FloatField()
    total = models.FloatField()
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ["-created_at", "-id"]

    def __str__(self):
        return f"{self.transaction_type} {self.asset.symbol} ({self.quantity})"


class UserProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="legacy_profile")
    display_name = models.CharField(max_length=150, blank=True)
    preferred_currency = models.CharField(max_length=10, default="USD")
    theme = models.CharField(max_length=10, default="dark")
    notifications = models.JSONField(default=dict)
    two_factor_enabled = models.BooleanField(default=False)
    two_factor_secret = models.CharField(max_length=64, blank=True)

    def __str__(self):
        return f"Profile({self.user.username})"
