from django.urls import path
from . import views

urlpatterns = [
    path("", views.wallet_list, name="wallet-list"),
]
