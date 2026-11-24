from concurrent.futures import ThreadPoolExecutor
from threading import Barrier

import pytest
from django.db import close_old_connections, connection, connections
from rest_framework.test import APIClient

from inventory.models import Product

PRODUCTS_URL = "/api/products/"
DASHBOARD_URL = "/api/dashboard/"
SETTINGS_URL = "/api/settings/"


def create_product(organization, name, sku, quantity=0, low_stock_threshold=None):
    return Product.objects.create(
        organization=organization,
        name=name,
        sku=sku,
        quantity_on_hand=quantity,
        low_stock_threshold=low_stock_threshold,
    )


@pytest.mark.django_db
def test_adjust_increments_and_decrements_stock_and_records_updater(
    client_a, user_a, organization_a
):
    product = create_product(organization_a, "Adjustable", "ADJUST", quantity=5)
    url = f"{PRODUCTS_URL}{product.pk}/adjust/"

    incremented = client_a.post(url, {"delta": 3, "note": "Received stock"}, format="json")
    decremented = client_a.post(url, {"delta": -2}, format="json")

    assert incremented.status_code == 200
    assert incremented.json()["quantity_on_hand"] == 8
    assert decremented.status_code == 200
    assert decremented.json()["quantity_on_hand"] == 6
    product.refresh_from_db()
    assert product.last_updated_by_id == user_a.pk


@pytest.mark.django_db
def test_adjust_rejects_zero_delta(client_a, organization_a):
    product = create_product(organization_a, "Adjustable", "ADJUST-ZERO", quantity=5)

    response = client_a.post(
        f"{PRODUCTS_URL}{product.pk}/adjust/",
        {"delta": 0},
        format="json",
    )

    assert response.status_code == 400
    assert "delta" in response.json()
    product.refresh_from_db()
    assert product.quantity_on_hand == 5


@pytest.mark.django_db
def test_adjust_rejects_note_longer_than_255_characters(client_a, organization_a):
    product = create_product(organization_a, "Adjustable", "ADJUST-NOTE", quantity=5)

    response = client_a.post(
        f"{PRODUCTS_URL}{product.pk}/adjust/",
        {"delta": 1, "note": "n" * 256},
        format="json",
    )

    assert response.status_code == 400
    assert "note" in response.json()
    product.refresh_from_db()
    assert product.quantity_on_hand == 5


@pytest.mark.django_db
def test_adjust_rejects_below_zero_without_changing_quantity(client_a, organization_a):
    product = create_product(organization_a, "Adjustable", "ADJUST-LOW", quantity=2)

    response = client_a.post(
        f"{PRODUCTS_URL}{product.pk}/adjust/",
        {"delta": -3},
        format="json",
    )

    assert response.status_code == 400
    assert response.json() == {"delta": ["Insufficient stock. Cannot reduce below 0."]}
    product.refresh_from_db()
    assert product.quantity_on_hand == 2


@pytest.mark.django_db
def test_adjust_hides_other_tenant_product(client_a, organization_b):
    product = create_product(organization_b, "Private", "PRIVATE-ADJUST", quantity=2)

    response = client_a.post(
        f"{PRODUCTS_URL}{product.pk}/adjust/",
        {"delta": 1},
        format="json",
    )

    assert response.status_code == 404
    product.refresh_from_db()
    assert product.quantity_on_hand == 2


@pytest.mark.django_db(transaction=True)
@pytest.mark.skipif(
    connection.vendor != "postgresql",
    reason="Concurrent select_for_update behavior requires PostgreSQL.",
)
def test_concurrent_decrements_cannot_reduce_stock_below_zero(user_a, organization_a):
    product = create_product(organization_a, "Concurrent", "CONCURRENT", quantity=1)
    url = f"{PRODUCTS_URL}{product.pk}/adjust/"
    barrier = Barrier(2)

    def decrement():
        close_old_connections()
        try:
            client = APIClient()
            client.force_authenticate(user=user_a)
            barrier.wait(timeout=10)
            return client.post(url, {"delta": -1}, format="json").status_code
        finally:
            connections.close_all()

    with ThreadPoolExecutor(max_workers=2) as executor:
        results = list(executor.map(lambda _: decrement(), range(2)))

    assert sorted(results) == [200, 400]
    product.refresh_from_db()
    assert product.quantity_on_hand == 0


@pytest.mark.django_db
def test_dashboard_totals_and_low_stock_are_tenant_scoped_and_threshold_aware(
    client_a, organization_a, organization_b, django_assert_num_queries
):
    create_product(organization_a, "Override above", "OVERRIDE-ABOVE", 3, 2)
    create_product(organization_a, "Default low", "DEFAULT-LOW", 5)
    create_product(organization_a, "Override low", "OVERRIDE-LOW", 4, 4)
    create_product(organization_b, "Other tenant", "OTHER-TENANT", 100)

    with django_assert_num_queries(2):
        response = client_a.get(DASHBOARD_URL)

    assert response.status_code == 200
    data = response.json()
    assert data["total_products"] == 3
    assert data["total_quantity"] == 12
    assert [item["sku"] for item in data["low_stock_items"]] == [
        "OVERRIDE-LOW",
        "DEFAULT-LOW",
    ]
    assert [item["effective_threshold"] for item in data["low_stock_items"]] == [4, 5]


@pytest.mark.django_db
def test_dashboard_empty_state_returns_zero_totals_and_no_low_stock(client_a):
    response = client_a.get(DASHBOARD_URL)

    assert response.status_code == 200
    assert response.json() == {
        "total_products": 0,
        "total_quantity": 0,
        "low_stock_items": [],
    }


@pytest.mark.django_db
def test_dashboard_low_stock_list_is_capped_at_50(client_a, organization_a):
    for number in range(51):
        create_product(organization_a, f"Low {number:02}", f"LOW-{number:02}")

    response = client_a.get(DASHBOARD_URL)

    assert response.status_code == 200
    assert len(response.json()["low_stock_items"]) == 50


@pytest.mark.django_db
def test_settings_updates_default_used_by_dashboard(client_a, organization_a):
    product = create_product(organization_a, "Threshold boundary", "THRESHOLD", quantity=6)

    before = client_a.get(DASHBOARD_URL)
    update = client_a.patch(
        SETTINGS_URL,
        {"default_low_stock_threshold": 6},
        format="json",
    )
    after = client_a.get(DASHBOARD_URL)

    assert before.status_code == 200
    assert before.json()["low_stock_items"] == []
    assert update.status_code == 200
    assert update.json() == {"default_low_stock_threshold": 6}
    assert [item["id"] for item in after.json()["low_stock_items"]] == [product.pk]


@pytest.mark.django_db
def test_settings_are_isolated_between_organizations(client_a, client_b, organization_b):
    updated = client_a.patch(
        SETTINGS_URL,
        {"default_low_stock_threshold": 12},
        format="json",
    )
    organization_b.default_low_stock_threshold = 9
    organization_b.save(update_fields=("default_low_stock_threshold",))

    response_a = client_a.get(SETTINGS_URL)
    response_b = client_b.get(SETTINGS_URL)

    assert updated.status_code == 200
    assert response_a.json() == {"default_low_stock_threshold": 12}
    assert response_b.json() == {"default_low_stock_threshold": 9}


@pytest.mark.django_db
@pytest.mark.parametrize("threshold", [-1, 1_000_001])
def test_settings_reject_negative_and_absurd_thresholds(client_a, threshold):
    response = client_a.patch(
        SETTINGS_URL,
        {"default_low_stock_threshold": threshold},
        format="json",
    )

    assert response.status_code == 400
    assert "default_low_stock_threshold" in response.json()
