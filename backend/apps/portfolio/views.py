from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def portfolio_overview(request):
    """Thin wrapper — delegates to legacy portfolio app helper during transition."""
    from portfolio.api import build_overview_payload, get_or_create_portfolio
    portfolio = get_or_create_portfolio(request.user)
    return Response(build_overview_payload(portfolio))


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def portfolio_analytics(request):
    from portfolio.api import build_analytics_payload, get_or_create_portfolio
    portfolio = get_or_create_portfolio(request.user)
    period = request.query_params.get("period", "1m")
    return Response(build_analytics_payload(portfolio, period))


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def portfolio_insights(request):
    from portfolio.api import build_insights_payload, get_or_create_portfolio
    portfolio = get_or_create_portfolio(request.user)
    return Response(build_insights_payload(portfolio))
