from django.urls import path

from . import views

urlpatterns = [
    path("connect/", views.exchange_connect, name="exchange-connect"),
    path("connections/", views.exchange_connections, name="exchange-connections"),
    path("connections/<int:pk>/", views.exchange_connection_detail, name="exchange-connection-detail"),
    path("connections/<int:pk>/sync/", views.exchange_sync, name="exchange-sync"),
]
