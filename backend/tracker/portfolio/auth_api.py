import base64
import hashlib
import hmac
import secrets
import struct
import time

from django.contrib.auth import authenticate
from django.contrib.auth.models import User
from rest_framework.authtoken.models import Token
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from .models import Portfolio, UserProfile


DEFAULT_PORTFOLIO_NAME = "Main Portfolio"


# ── Profile helpers ───────────────────────────────────────────────────────────

def get_or_create_profile(user: User) -> UserProfile:
    profile, _ = UserProfile.objects.get_or_create(
        user=user,
        defaults={"display_name": user.first_name or user.username},
    )
    if not profile.display_name:
        profile.display_name = user.first_name or user.username
        profile.save(update_fields=["display_name"])
    return profile


def serialize_auth_user(user: User, profile: UserProfile) -> dict:
    return {
        "id": user.pk,
        "username": user.username,
        "email": user.email,
        "dateJoined": user.date_joined.isoformat(),
        "displayName": profile.display_name or user.first_name or user.username,
        "isStaff": user.is_staff,
        "isActive": user.is_active,
        "theme": profile.theme,
        "currency": profile.preferred_currency,
        "notifications": profile.notifications,
        "twoFactorEnabled": profile.two_factor_enabled,
    }


def serialize_profile(user: User, profile: UserProfile) -> dict:
    return {
        "username": user.username,
        "displayName": profile.display_name or user.first_name or user.username,
        "email": user.email,
        "currency": profile.preferred_currency,
        "theme": profile.theme,
        "notifications": profile.notifications,
        "twoFactorEnabled": profile.two_factor_enabled,
    }


def get_auth_token(user: User) -> str:
    token, _ = Token.objects.get_or_create(user=user)
    return token.key


def resolve_request_user(request) -> User | None:
    auth = request.META.get("HTTP_AUTHORIZATION", "")
    if not auth.startswith("Token "):
        return None
    key = auth[6:].strip()
    if not key:
        return None
    try:
        return Token.objects.select_related("user").get(key=key).user
    except Token.DoesNotExist:
        return None


# ── TOTP helpers ──────────────────────────────────────────────────────────────

def generate_totp_secret() -> str:
    return base64.b32encode(secrets.token_bytes(20)).decode("ascii").rstrip("=")


def _totp_code(secret: str, for_time: int | None = None, interval: int = 30) -> str:
    normalized = secret.upper()
    padding = "=" * ((8 - len(normalized) % 8) % 8)
    key = base64.b32decode(normalized + padding)
    counter = int((for_time or int(time.time())) / interval)
    digest = hmac.new(key, struct.pack(">Q", counter), hashlib.sha1).digest()
    offset = digest[-1] & 0x0F
    code = (struct.unpack(">I", digest[offset: offset + 4])[0] & 0x7FFFFFFF) % 1_000_000
    return f"{code:06d}"


def verify_totp(secret: str, code: str, *, window: int = 1) -> bool:
    normalized = str(code or "").strip()
    if not normalized.isdigit() or len(normalized) != 6:
        return False
    now = int(time.time())
    for offset in range(-window, window + 1):
        if _totp_code(secret, for_time=now + offset * 30) == normalized:
            return True
    return False


def totp_setup_uri(user: User, secret: str) -> str:
    return f"otpauth://totp/PortfolioTracker:{user.username}?secret={secret}&issuer=PortfolioTracker"


# ── Auth views ────────────────────────────────────────────────────────────────

@api_view(["POST"])
@permission_classes([AllowAny])
def auth_register(request):
    username = str(request.data.get("username", "")).strip()
    password = str(request.data.get("password", "")).strip()
    email = str(request.data.get("email", "")).strip()
    display_name = str(request.data.get("displayName", username)).strip() or username

    if not username:
        return Response({"error": "Username is required."}, status=400)
    if not password:
        return Response({"error": "Password is required."}, status=400)
    if len(password) < 8:
        return Response({"error": "Password must be at least 8 characters."}, status=400)
    if User.objects.filter(username=username).exists():
        return Response({"error": "Username is already taken."}, status=409)

    user = User.objects.create_user(
        username=username, password=password, email=email, first_name=display_name
    )
    profile = get_or_create_profile(user)
    profile.display_name = display_name
    profile.save(update_fields=["display_name"])
    Portfolio.objects.get_or_create(user=user, name=DEFAULT_PORTFOLIO_NAME)
    token = get_auth_token(user)
    return Response(
        {"token": token, "user": serialize_auth_user(user, profile)},
        status=201,
    )


@api_view(["POST"])
@permission_classes([AllowAny])
def auth_login(request):
    username = str(request.data.get("username", "")).strip()
    password = str(request.data.get("password", ""))
    otp = str(request.data.get("otp", "")).strip()

    if not username or not password:
        return Response({"error": "Username and password are required."}, status=400)

    user = authenticate(username=username, password=password)
    if user is None:
        return Response({"error": "Invalid credentials."}, status=401)
    if not user.is_active:
        return Response({"error": "Account is disabled."}, status=403)

    profile = get_or_create_profile(user)
    if profile.two_factor_enabled and not verify_totp(profile.two_factor_secret, otp):
        return Response(
            {"error": "A valid 2FA code is required.", "requiresTwoFactor": True},
            status=400,
        )

    Portfolio.objects.get_or_create(user=user, name=DEFAULT_PORTFOLIO_NAME)
    token = get_auth_token(user)
    return Response({"token": token, "user": serialize_auth_user(user, profile)})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def auth_logout(request):
    try:
        request.user.auth_token.delete()
    except Token.DoesNotExist:
        pass
    return Response({"message": "Logged out successfully."})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def auth_me(request):
    profile = get_or_create_profile(request.user)
    return Response({"authenticated": True, "user": serialize_auth_user(request.user, profile)})


@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def auth_delete_account(request):
    password = str(request.data.get("password", "")).strip()
    if not password:
        return Response({"error": "Password is required to confirm deletion."}, status=400)
    user = authenticate(username=request.user.username, password=password)
    if user is None:
        return Response({"error": "Incorrect password."}, status=403)
    user.delete()
    return Response({"message": "Account deleted successfully."})


# ── Settings view ─────────────────────────────────────────────────────────────

@api_view(["GET", "PUT"])
@permission_classes([IsAuthenticated])
def user_settings(request):
    user = request.user
    profile = get_or_create_profile(user)

    if request.method == "PUT":
        display_name = str(request.data.get("displayName", profile.display_name)).strip() or user.username
        email = str(request.data.get("email", user.email)).strip()
        currency = str(request.data.get("currency", profile.preferred_currency)).strip() or "USD"
        theme = str(request.data.get("theme", profile.theme)).strip() or "dark"
        notifications = request.data.get("notifications", profile.notifications)
        if not isinstance(notifications, dict):
            return Response({"error": "Notifications must be an object."}, status=400)

        user.first_name = display_name
        user.email = email
        user.save(update_fields=["first_name", "email"])

        profile.display_name = display_name
        profile.preferred_currency = currency
        profile.theme = theme
        profile.notifications = notifications
        profile.save(update_fields=["display_name", "preferred_currency", "theme", "notifications"])

    return Response({"settings": serialize_profile(user, profile)})


# ── Admin views ───────────────────────────────────────────────────────────────

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def admin_users(request):
    if not request.user.is_staff:
        return Response({"error": "Admin access required."}, status=403)

    users = User.objects.order_by("-date_joined")
    payload = [serialize_auth_user(u, get_or_create_profile(u)) for u in users]
    return Response({"users": payload})


@api_view(["PATCH"])
@permission_classes([IsAuthenticated])
def admin_user_detail(request, user_id: int):
    if not request.user.is_staff:
        return Response({"error": "Admin access required."}, status=403)

    target = User.objects.filter(id=user_id).first()
    if target is None:
        return Response({"error": "User not found."}, status=404)
    if target.id == request.user.id and request.data.get("isActive") is False:
        return Response({"error": "You cannot deactivate your own account."}, status=400)

    if "isActive" in request.data:
        target.is_active = bool(request.data.get("isActive"))
    if "isStaff" in request.data and target.id != request.user.id:
        target.is_staff = bool(request.data.get("isStaff"))

    target.save(update_fields=["is_active", "is_staff"])
    profile = get_or_create_profile(target)
    return Response({"user": serialize_auth_user(target, profile)})


# ── Security views ────────────────────────────────────────────────────────────

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def security_change_password(request):
    current_password = str(request.data.get("currentPassword", ""))
    new_password = str(request.data.get("newPassword", ""))
    if not request.user.check_password(current_password):
        return Response({"error": "Current password is incorrect."}, status=400)
    if len(new_password) < 8:
        return Response({"error": "New password must be at least 8 characters long."}, status=400)
    request.user.set_password(new_password)
    request.user.save(update_fields=["password"])
    return Response({"message": "Password updated successfully."})


@api_view(["GET", "POST", "DELETE"])
@permission_classes([IsAuthenticated])
def security_two_factor(request):
    profile = get_or_create_profile(request.user)

    if request.method == "GET":
        return Response({
            "twoFactorEnabled": profile.two_factor_enabled,
            "hasPendingSetup": bool(profile.two_factor_secret and not profile.two_factor_enabled),
        })

    if request.method == "DELETE":
        profile.two_factor_enabled = False
        profile.two_factor_secret = ""
        profile.save(update_fields=["two_factor_enabled", "two_factor_secret"])
        return Response({"message": "Two-factor authentication disabled."})

    action = str(request.data.get("action", "setup")).strip().lower()
    if action == "setup":
        secret = generate_totp_secret()
        profile.two_factor_enabled = False
        profile.two_factor_secret = secret
        profile.save(update_fields=["two_factor_enabled", "two_factor_secret"])
        return Response({
            "secret": secret,
            "setupUri": totp_setup_uri(request.user, secret),
            "message": "Add this secret to your authenticator app, then verify with the generated 6-digit code.",
        })

    if action == "verify":
        code = str(request.data.get("code", "")).strip()
        if not profile.two_factor_secret:
            return Response({"error": "Start 2FA setup first."}, status=400)
        if not verify_totp(profile.two_factor_secret, code):
            return Response({"error": "Invalid authentication code."}, status=400)
        profile.two_factor_enabled = True
        profile.save(update_fields=["two_factor_enabled"])
        return Response({"message": "Two-factor authentication enabled.", "twoFactorEnabled": True})

    return Response({"error": "Unsupported action."}, status=400)
