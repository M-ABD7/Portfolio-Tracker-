from django.contrib.auth.models import User
from django.core.management.base import BaseCommand
from rest_framework.authtoken.models import Token

DEMO_USERNAME = "demo"
DEMO_PASSWORD = "demo1234"


class Command(BaseCommand):
    help = "Create (or reset) the demo user account."

    def handle(self, *args, **options):
        user, created = User.objects.get_or_create(username=DEMO_USERNAME)
        user.set_password(DEMO_PASSWORD)
        user.is_active = True
        user.save()

        Token.objects.get_or_create(user=user)

        if created:
            self.stdout.write(
                self.style.SUCCESS(
                    f"Demo user created. Username: {DEMO_USERNAME} / Password: {DEMO_PASSWORD}"
                )
            )
        else:
            self.stdout.write(
                self.style.SUCCESS(
                    f"Demo user already exists. Password reset to: {DEMO_PASSWORD}"
                )
            )
