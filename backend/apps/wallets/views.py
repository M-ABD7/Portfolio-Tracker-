from drf_spectacular.utils import extend_schema
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response


@extend_schema(summary="List connected wallets (stub)", tags=["Wallets"])
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def wallet_list(request):
    return Response({
        "wallets": [],
        "message": "Wallet integrations are coming soon. On-chain wallet support (Ethereum, Solana, Bitcoin) will be added in a future update.",
    })
