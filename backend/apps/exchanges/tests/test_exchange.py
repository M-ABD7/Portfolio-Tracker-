from django.contrib.auth.models import User
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import RefreshToken

from services.encryption import decrypt, encrypt


class EncryptionTests(APITestCase):
    def test_round_trip(self):
        self.assertEqual(decrypt(encrypt("my-secret-key")), "my-secret-key")

    def test_different_encryptions_same_input(self):
        # Fernet uses random IV so two encryptions of same plaintext differ
        enc1 = encrypt("same")
        enc2 = encrypt("same")
        self.assertNotEqual(enc1, enc2)
        self.assertEqual(decrypt(enc1), "same")
        self.assertEqual(decrypt(enc2), "same")


class ExchangeConnectionTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="exchuser", password="testpass123")
        refresh = RefreshToken.for_user(self.user)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}")

    def test_connect_missing_fields(self):
        resp = self.client.post("/api/exchange/connect/", {}, format="json")
        self.assertEqual(resp.status_code, 400)

    def test_connect_unsupported_exchange(self):
        resp = self.client.post(
            "/api/exchange/connect/",
            {"exchange": "kraken", "apiKey": "abc", "apiSecret": "def"},
            format="json",
        )
        self.assertEqual(resp.status_code, 400)
        self.assertIn("not supported", resp.data["error"])

    def test_connections_list_empty(self):
        resp = self.client.get("/api/exchange/connections/")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data["connections"], [])

    def test_sync_nonexistent_connection_404(self):
        resp = self.client.post("/api/exchange/connections/9999/sync/")
        self.assertEqual(resp.status_code, 404)

    def test_delete_nonexistent_connection_404(self):
        resp = self.client.delete("/api/exchange/connections/9999/")
        self.assertEqual(resp.status_code, 404)

    def test_requires_auth(self):
        self.client.credentials()
        resp = self.client.get("/api/exchange/connections/")
        self.assertEqual(resp.status_code, 401)
