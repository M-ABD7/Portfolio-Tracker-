from django.contrib import admin
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

urlpatterns = [
    path("admin/", admin.site.urls),
    # API documentation
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="swagger-ui"),
    # New modular app routes
    path("api/auth/", include("apps.users.urls")),
    path("api/portfolio/", include("apps.portfolio.urls")),
    path("api/exchange/", include("apps.exchanges.urls")),
    path("api/analytics/", include("apps.analytics.urls")),
    path("api/wallets/", include("apps.wallets.urls")),
    path("api/notifications/", include("apps.notifications.urls")),
    # Legacy routes — kept during transition, removed in Phase 9
    path("api/", include("portfolio.urls")),
]
