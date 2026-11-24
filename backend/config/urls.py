"""
URL configuration for StockFlow.
"""

from django.contrib import admin
from django.urls import include, path
from drf_spectacular.utils import extend_schema, inline_serializer
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView
from rest_framework import serializers
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response


@extend_schema(
    responses=inline_serializer(
        name="HealthResponse",
        fields={"status": serializers.CharField()},
    )
)
@api_view(["GET"])
@permission_classes([AllowAny])
def health_check(request):
    """GET /api/health/ — public health check."""
    return Response({"status": "ok"})


urlpatterns = [
    path("admin/", admin.site.urls),
    # API
    path("api/auth/", include("accounts.urls")),
    path("api/", include("inventory.urls")),
    path("api/health/", health_check, name="health"),
    # API schema & docs
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path(
        "api/docs/",
        SpectacularSwaggerView.as_view(url_name="schema"),
        name="swagger-ui",
    ),
]
