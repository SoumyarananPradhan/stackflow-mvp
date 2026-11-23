import pytest

from inventory.models import Product

PRODUCTS_URL = "/api/products/"


@pytest.mark.django_db
def test_other_tenant_product_is_hidden_for_list_retrieve_update_and_delete(
    client_a, organization_a, organization_b, user_b
):
    foreign_product = Product.objects.create(
        organization=organization_b,
        name="Private product",
        sku="PRIVATE-1",
        last_updated_by=user_b,
    )

    list_response = client_a.get(PRODUCTS_URL)
    assert list_response.status_code == 200
    assert all(item["id"] != foreign_product.pk for item in list_response.json()["results"])

    detail_url = f"{PRODUCTS_URL}{foreign_product.pk}/"
    retrieve_response = client_a.get(detail_url)
    update_response = client_a.patch(
        detail_url,
        {"name": "Changed by another tenant"},
        format="json",
    )
    delete_response = client_a.delete(detail_url)

    assert retrieve_response.status_code == 404
    assert update_response.status_code == 404
    assert delete_response.status_code == 404
    foreign_product.refresh_from_db()
    assert foreign_product.name == "Private product"
    assert foreign_product.organization_id == organization_b.pk
    assert organization_a.pk != organization_b.pk


@pytest.mark.django_db
def test_posted_organization_is_ignored(client_a, user_a, organization_a, organization_b):
    response = client_a.post(
        PRODUCTS_URL,
        {
            "organization": organization_b.pk,
            "name": "Owned by caller",
            "sku": "OWNED-1",
            "quantity_on_hand": 1,
        },
        format="json",
    )

    assert response.status_code == 201
    assert response.json()["organization"] == organization_a.pk
    assert response.json()["last_updated_by"] == user_a.pk
