import json
from unittest.mock import patch

import pytest
from rest_framework.authentication import BasicAuthentication
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.test import APIClient, APIRequestFactory
from rest_framework.views import APIView

LOGIN_URL = "/api/auth/login/"


class BasicAuthenticationProbe(APIView):
    authentication_classes = [BasicAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response()


@pytest.mark.django_db
def test_schema_and_swagger_ui_are_served_with_documented_request_shapes():
    client = APIClient()

    schema_response = client.get(
        "/api/schema/",
        HTTP_ACCEPT="application/vnd.oai.openapi+json",
    )
    docs_response = client.get("/api/docs/")

    assert schema_response.status_code == 200
    schema = json.loads(schema_response.content)
    paths = schema["paths"]
    signup = paths["/api/auth/signup/"]["post"]
    adjust_path = next(path for path in paths if path.endswith("/adjust/"))
    adjust = paths[adjust_path]["post"]
    dashboard = paths["/api/dashboard/"]["get"]
    settings_patch = paths["/api/settings/"]["patch"]

    signup_request = signup["requestBody"]["content"]["application/json"]["schema"]
    assert set(_resolve_schema(schema, signup_request)["properties"]) == {
        "email",
        "password",
        "confirm_password",
        "organization_name",
    }
    adjust_request = adjust["requestBody"]["content"]["application/json"]["schema"]
    assert set(_resolve_schema(schema, adjust_request)["properties"]) == {"delta", "note"}
    dashboard_response = dashboard["responses"]["200"]["content"]["application/json"]["schema"]
    assert set(_resolve_schema(schema, dashboard_response)["properties"]) == {
        "total_products",
        "total_quantity",
        "low_stock_items",
    }
    settings_request = settings_patch["requestBody"]["content"]["application/json"]["schema"]
    assert set(_resolve_schema(schema, settings_request)["properties"]) == {
        "default_low_stock_threshold"
    }
    assert docs_response.status_code == 200
    assert docs_response["Content-Type"].startswith("text/html")


def _resolve_schema(document, schema):
    while "$ref" in schema:
        name = schema["$ref"].rsplit("/", maxsplit=1)[-1]
        schema = document["components"]["schemas"][name]
    return schema


@pytest.mark.django_db
def test_auth_login_is_throttled_by_ip():
    client = APIClient()
    payload = {"email": "missing@example.com", "password": "not-a-password"}

    with patch("accounts.views.authenticate", return_value=None):
        responses = [
            client.post(LOGIN_URL, payload, format="json", REMOTE_ADDR="198.51.100.42")
            for _ in range(11)
        ]

    assert all(response.status_code == 400 for response in responses[:10])
    assert responses[10].status_code == 429
    assert responses[10]["Content-Type"].startswith("application/json")


@pytest.mark.django_db
def test_health_endpoint_is_public():
    response = APIClient().get("/api/health/")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


@pytest.mark.django_db
def test_api_errors_use_json_for_common_error_statuses(client_a):
    unauthenticated = APIClient().get("/api/products/")
    invalid = client_a.patch(
        "/api/settings/",
        {"default_low_stock_threshold": -1},
        format="json",
    )
    missing = client_a.get("/api/unmatched-endpoint/", HTTP_ACCEPT="text/html")
    method_not_allowed = client_a.post("/api/dashboard/", {}, format="json")
    unauthenticated_response = BasicAuthenticationProbe.as_view()(
        APIRequestFactory().get("/api/auth-probe/")
    )
    unauthenticated_response.render()

    assert unauthenticated.status_code == 403
    assert invalid.status_code == 400
    assert missing.status_code == 404
    assert method_not_allowed.status_code == 405
    assert unauthenticated_response.status_code == 401
    for response in (
        unauthenticated,
        invalid,
        missing,
        method_not_allowed,
        unauthenticated_response,
    ):
        assert response["Content-Type"].startswith("application/json")
