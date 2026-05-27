import logging

from django.contrib.auth import authenticate
from django.contrib.auth.models import User
from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenRefreshView  # noqa: F401

from core.throttles import AuthRateThrottle

from .serializers import RegisterSerializer, UserSerializer

logger = logging.getLogger(__name__)


@extend_schema(
    summary="Register a new user account",
    request=RegisterSerializer,
    responses={201: UserSerializer},
    tags=["Auth"],
)
@api_view(["POST"])
@permission_classes([AllowAny])
@throttle_classes([AuthRateThrottle])
def register(request):
    serializer = RegisterSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    user = serializer.save()
    refresh = RefreshToken.for_user(user)
    logger.info("New user registered: %s", user.username)
    return Response(
        {
            "user": UserSerializer(user).data,
            "access": str(refresh.access_token),
            "refresh": str(refresh),
        },
        status=status.HTTP_201_CREATED,
    )


@extend_schema(
    summary="Obtain JWT tokens via username + password",
    tags=["Auth"],
)
@api_view(["POST"])
@permission_classes([AllowAny])
@throttle_classes([AuthRateThrottle])
def login(request):
    username = (request.data.get("username") or "").strip()
    password = (request.data.get("password") or "").strip()
    if not username or not password:
        return Response({"error": "Username and password are required."}, status=400)
    user = authenticate(username=username, password=password)
    if user is None:
        return Response({"error": "Invalid credentials."}, status=401)
    if not user.is_active:
        return Response({"error": "Account is disabled."}, status=403)
    refresh = RefreshToken.for_user(user)
    return Response(
        {
            "user": UserSerializer(user).data,
            "access": str(refresh.access_token),
            "refresh": str(refresh),
        }
    )


@extend_schema(
    summary="Logout — blacklists the refresh token",
    tags=["Auth"],
)
@api_view(["POST"])
@permission_classes([IsAuthenticated])
def logout(request):
    """POST /api/auth/logout/"""
    try:
        token = RefreshToken(request.data.get("refresh"))
        token.blacklist()
    except Exception:
        pass  # Token may already be invalid — still return success
    return Response({"message": "Logged out successfully."})


@extend_schema(
    summary="Return the currently authenticated user",
    responses={200: UserSerializer},
    tags=["Auth"],
)
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def me(request):
    """GET /api/auth/me/"""
    return Response(UserSerializer(request.user).data)


@extend_schema(
    summary="Permanently delete the authenticated user account",
    tags=["Auth"],
)
@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def delete_account(request):
    """DELETE /api/auth/delete/ — requires password confirmation."""
    password = (request.data.get("password") or "").strip()
    user = authenticate(username=request.user.username, password=password)
    if user is None:
        return Response({"error": "Incorrect password."}, status=403)
    username = user.username
    user.delete()
    logger.info("User account deleted: %s", username)
    return Response({"message": "Account deleted successfully."})
