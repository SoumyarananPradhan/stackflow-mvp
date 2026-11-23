from unittest.mock import patch

import pytest
from rest_framework.test import APIClient

from inventory.models import Product
from inventory.serializers import ProductSerializer

PRODUCTS_URL = "/api/products/"


def product_payload(**overrides):
    payload = {
        "name": "Widget",
        "sku": "widget-1",
        "description": "",
        "quantity_on_hand": 10,
        "cost_price": "2.50",
        "selling_price": "4.00",
    }
    payload.update(overrides)
    return payload


@pytest.mark.django_db
def test_product_crud_happy_path(client_a, user_a, organization_a):
    response = client_a.post(PRODUCTS_URL, product_payload(), format="json")

    assert response.status_code == 201
    product_id = response.json()["id"]
    assert response.json()["sku"] == "WIDGET-1"
    assert response.json()["organization"] == organization_a.pk
    assert response.json()["last_updated_by"] == user_a.pk
    assert response.json()["effective_threshold"] == organization_a.default_low_stock_threshold
    assert response.json()["is_low_stock"] is False

    detail_url = f"{PRODUCTS_URL}{product_id}/"
    response = client_a.get(detail_url)
    assert response.status_code == 200

    response = client_a.patch(
        detail_url,
        {"name": "  Updated widget  ", "quantity_on_hand": 2},
        format="json",
    )
    assert response.status_code == 200
    assert response.json()["name"] == "Updated widget"
    assert response.json()["quantity_on_hand"] == 2
    assert response.json()["last_updated_by"] == user_a.pk
    assert response.json()["is_low_stock"] is True

    response = client_a.delete(detail_url)
    assert response.status_code == 204
    assert not Product.objects.filter(pk=product_id).exists()


@pytest.mark.django_db
def test_unauthenticated_product_access_is_denied():
    response = APIClient().get(PRODUCTS_URL)

    assert response.status_code in (401, 403)


@pytest.mark.django_db
def test_same_sku_is_allowed_between_organizations_but_not_within_one(client_a, client_b):
    first = client_a.post(PRODUCTS_URL, product_payload(sku="Same-1"), format="json")
    other_organization = client_b.post(
        PRODUCTS_URL,
        product_payload(sku="same-1"),
        format="json",
    )
    duplicate = client_a.post(
        PRODUCTS_URL,
        product_payload(sku=" same-1 "),
        format="json",
    )

    assert first.status_code == 201
    assert other_organization.status_code == 201
    assert duplicate.status_code == 400
    assert duplicate.json() == {"sku": ["A product with this SKU already exists."]}


@pytest.mark.django_db
def test_sku_integrity_error_race_returns_duplicate_validation_error(client_a):
    created = client_a.post(PRODUCTS_URL, product_payload(sku="race-1"), format="json")
    assert created.status_code == 201

    with patch.object(ProductSerializer, "validate", lambda self, attrs: attrs):
        response = client_a.post(
            PRODUCTS_URL,
            product_payload(sku="race-1"),
            format="json",
        )

    assert response.status_code == 400
    assert response.json() == {"sku": ["A product with this SKU already exists."]}


@pytest.mark.django_db
def test_model_save_normalizes_sku(organization_a):
    product = Product.objects.create(
        organization=organization_a,
        name="Widget",
        sku="  widget-1 ",
    )

    assert product.sku == "WIDGET-1"


@pytest.mark.django_db
def test_invalid_product_values_are_rejected(client_a):
    for payload in (
        product_payload(name="   "),
        product_payload(sku="   "),
        product_payload(quantity_on_hand=-1),
        product_payload(cost_price="-0.01"),
        product_payload(selling_price="-0.01"),
    ):
        response = client_a.post(PRODUCTS_URL, payload, format="json")
        assert response.status_code == 400


@pytest.mark.django_db
def test_low_stock_uses_product_override_and_organization_default(client_a, organization_a):
    products = (
        Product.objects.create(
            organization=organization_a,
            name="Override above threshold",
            sku="OVERRIDE-ABOVE",
            quantity_on_hand=3,
            low_stock_threshold=2,
        ),
        Product.objects.create(
            organization=organization_a,
            name="Default at threshold",
            sku="DEFAULT-AT",
            quantity_on_hand=organization_a.default_low_stock_threshold,
        ),
        Product.objects.create(
            organization=organization_a,
            name="Override at threshold",
            sku="OVERRIDE-AT",
            quantity_on_hand=4,
            low_stock_threshold=4,
        ),
    )

    response = client_a.get(PRODUCTS_URL)
    assert response.status_code == 200
    results = {item["sku"]: item for item in response.json()["results"]}

    assert results[products[0].sku]["effective_threshold"] == 2
    assert results[products[0].sku]["is_low_stock"] is False
    assert results[products[1].sku]["effective_threshold"] == 5
    assert results[products[1].sku]["is_low_stock"] is True
    assert results[products[2].sku]["effective_threshold"] == 4
    assert results[products[2].sku]["is_low_stock"] is True


@pytest.mark.django_db
def test_search_matches_name_and_sku(client_a, organization_a):
    Product.objects.create(
        organization=organization_a,
        name="Blue Widget",
        sku="PART-ALPHA",
    )
    Product.objects.create(
        organization=organization_a,
        name="Red Gadget",
        sku="BLUE-BETA",
    )
    Product.objects.create(
        organization=organization_a,
        name="Green Item",
        sku="PART-GAMMA",
    )

    name_response = client_a.get(PRODUCTS_URL, {"search": "blue widget"})
    sku_response = client_a.get(PRODUCTS_URL, {"search": "blue-beta"})

    assert [item["name"] for item in name_response.json()["results"]] == ["Blue Widget"]
    assert [item["sku"] for item in sku_response.json()["results"]] == ["BLUE-BETA"]


@pytest.mark.django_db
def test_products_use_page_number_pagination(client_a, organization_a):
    for number in range(21):
        Product.objects.create(
            organization=organization_a,
            name=f"Widget {number:02}",
            sku=f"WIDGET-{number:02}",
        )

    response = client_a.get(PRODUCTS_URL)

    assert response.status_code == 200
    assert set(response.json()) == {"count", "next", "previous", "results"}
    assert response.json()["count"] == 21
    assert len(response.json()["results"]) == 20
    assert response.json()["next"] is not None
    assert response.json()["previous"] is None


@pytest.mark.django_db
def test_ordering_whitelist_orders_and_rejects_unknown_fields(client_a, organization_a):
    Product.objects.create(organization=organization_a, name="Z Widget", sku="Z-1")
    Product.objects.create(organization=organization_a, name="A Widget", sku="A-1")

    ordered = client_a.get(PRODUCTS_URL, {"ordering": "name"})
    rejected = client_a.get(PRODUCTS_URL, {"ordering": "organization"})

    assert [item["name"] for item in ordered.json()["results"]] == ["A Widget", "Z Widget"]
    assert rejected.status_code == 400
    assert "ordering" in rejected.json()


@pytest.mark.django_db
def test_product_list_has_no_per_row_queries(client_a, organization_a, django_assert_num_queries):
    for number in range(5):
        Product.objects.create(
            organization=organization_a,
            name=f"Widget {number}",
            sku=f"WIDGET-{number}",
        )

    with django_assert_num_queries(2):
        response = client_a.get(PRODUCTS_URL)

    assert response.status_code == 200
    assert len(response.json()["results"]) == 5
