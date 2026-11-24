"""
URL configuration for StockFlow.
"""

from django.conf import settings
from django.contrib import admin
from django.http import FileResponse, Http404, HttpResponseNotFound, JsonResponse
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


def spa_view(request, path=""):
    index_file = settings.FRONTEND_DIST_DIR / "index.html"
    try:
        return FileResponse(index_file.open("rb"))
    except FileNotFoundError as exc:
        raise Http404("Frontend build is unavailable.") from exc


def api_not_found(request, path=""):
    return JsonResponse({"detail": "Not found."}, status=404)


def reserved_path_not_found(request, path=""):
    return HttpResponseNotFound("Not found.", content_type="text/plain")


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
    path("api", api_not_found, name="api-not-found-without-slash"),
    path("api/", api_not_found, name="api-root-not-found"),
    path("api/<path:path>", api_not_found, name="api-not-found"),
    path("admin", reserved_path_not_found, name="admin-not-found"),
    path("admin/<path:path>", reserved_path_not_found, name="admin-path-not-found"),
    path("static", reserved_path_not_found, name="static-root-not-found"),
    path("static/", reserved_path_not_found, name="static-directory-not-found"),
    path("static/<path:path>", reserved_path_not_found, name="static-not-found"),
    path("", spa_view, name="spa-root"),
    path("<path:path>", spa_view, name="spa-deep-link"),
]
