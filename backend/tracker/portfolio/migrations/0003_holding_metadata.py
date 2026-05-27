# Generated migration — adds metadata JSONField to Holding
# so exchange can be stored per-holding (fixes ETH on Binance + MEXC bug)

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("portfolio", "0002_transaction"),
    ]

    operations = [
        migrations.AddField(
            model_name="holding",
            name="metadata",
            field=models.JSONField(blank=True, default=dict),
        ),
    ]
