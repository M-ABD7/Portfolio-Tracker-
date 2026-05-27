from django.contrib.auth.models import User
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import RefreshToken


class AuthTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="testuser", password="testpass123", email="test@example.com"
        )

    def _auth_headers(self):
        refresh = RefreshToken.for_user(self.user)
        return {"HTTP_AUTHORIZATION": f"Bearer {refresh.access_token}"}

    def test_register_success(self):
        resp = self.client.post(
            "/api/auth/register/",
            {"username": "newuser", "password": "newpass123", "email": "new@example.com"},
            format="json",
        )
        self.assertEqual(resp.status_code, 201)
        self.assertIn("access", resp.data)
        self.assertIn("refresh", resp.data)
        self.assertEqual(resp.data["user"]["username"], "newuser")

    def test_register_duplicate_username(self):
        resp = self.client.post(
            "/api/auth/register/",
            {"username": "testuser", "password": "anotherpass"},
            format="json",
        )
        self.assertEqual(resp.status_code, 400)

    def test_register_short_password(self):
        resp = self.client.post(
            "/api/auth/register/",
            {"username": "newuser2", "password": "short"},
            format="json",
        )
        self.assertEqual(resp.status_code, 400)

    def test_login_success(self):
        resp = self.client.post(
            "/api/auth/login/",
            {"username": "testuser", "password": "testpass123"},
            format="json",
        )
        self.assertEqual(resp.status_code, 200)
        self.assertIn("access", resp.data)
        self.assertIn("refresh", resp.data)

    def test_login_wrong_password(self):
        resp = self.client.post(
            "/api/auth/login/",
            {"username": "testuser", "password": "wrongpassword"},
            format="json",
        )
        self.assertEqual(resp.status_code, 401)

    def test_me_requires_auth(self):
        resp = self.client.get("/api/auth/me/")
        self.assertEqual(resp.status_code, 401)

    def test_me_returns_user(self):
        resp = self.client.get("/api/auth/me/", **self._auth_headers())
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data["username"], "testuser")

    def test_token_refresh(self):
        refresh = RefreshToken.for_user(self.user)
        resp = self.client.post(
            "/api/auth/token/refresh/",
            {"refresh": str(refresh)},
            format="json",
        )
        self.assertEqual(resp.status_code, 200)
        self.assertIn("access", resp.data)

    def test_delete_account_wrong_password(self):
        resp = self.client.delete(
            "/api/auth/delete/",
            {"password": "wrongpass"},
            format="json",
            **self._auth_headers(),
        )
        self.assertEqual(resp.status_code, 403)

    def test_delete_account_success(self):
        resp = self.client.delete(
            "/api/auth/delete/",
            {"password": "testpass123"},
            format="json",
            **self._auth_headers(),
        )
        self.assertEqual(resp.status_code, 200)
        self.assertFalse(User.objects.filter(username="testuser").exists())
