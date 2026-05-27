from django.urls import path
from . import views

urlpatterns = [
    path("overview/", views.overview, name="analytics-overview"),
    path("performance/", views.analytics, name="analytics-performance"),
    path("insights/", views.insights, name="analytics-insights"),
]
