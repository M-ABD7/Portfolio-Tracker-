from drf_spectacular.utils import extend_schema
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response


@extend_schema(summary="List notifications (stub)", tags=["Notifications"])
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def notification_list(request):
    return Response({"notifications": [], "unread": 0})
