from django.urls import path
from rest_framework.routers import SimpleRouter

from .views import DashboardView, OrganizationSettingsView, ProductViewSet

router = SimpleRouter()
router.register("products", ProductViewSet, basename="product")

urlpatterns = [
    path("dashboard/", DashboardView.as_view(), name="dashboard"),
    path("settings/", OrganizationSettingsView.as_view(), name="settings"),
    *router.urls,
]
