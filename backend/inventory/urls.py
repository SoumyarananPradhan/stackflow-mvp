from django.urls import path
from rest_framework.routers import SimpleRouter

from .views import DashboardView, ProductViewSet

router = SimpleRouter()
router.register("products", ProductViewSet, basename="product")

urlpatterns = [
    path("dashboard/", DashboardView.as_view(), name="dashboard"),
    *router.urls,
]
