import logging

from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

logger = logging.getLogger(__name__)


@extend_schema(
    summary="Portfolio overview (total value, assets, P&L)",
    tags=["Analytics"],
)
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def overview(request):
    from portfolio.api import build_overview_payload, get_or_create_portfolio
    portfolio = get_or_create_portfolio(request.user)
    return Response(build_overview_payload(portfolio))


@extend_schema(
    summary="Performance chart data",
    parameters=[OpenApiParameter("period", str, description="One of: 7d, 1m, 3m")],
    tags=["Analytics"],
)
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def analytics(request):
    from portfolio.api import build_analytics_payload, get_or_create_portfolio
    portfolio = get_or_create_portfolio(request.user)
    period = request.query_params.get("period", "1m")
    return Response(build_analytics_payload(portfolio, period))


@extend_schema(
    summary="AI signals, risk score, allocation and diversification insights",
    tags=["Analytics"],
)
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def insights(request):
    from portfolio.api import build_insights_payload, get_or_create_portfolio
    portfolio = get_or_create_portfolio(request.user)
    return Response(build_insights_payload(portfolio))
