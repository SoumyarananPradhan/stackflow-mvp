import pytest
from rest_framework.test import APIClient

from accounts.models import Organization, User


@pytest.fixture
def organization_a(db):
    return Organization.objects.create(name="Organization A")


@pytest.fixture
def organization_b(db):
    return Organization.objects.create(name="Organization B")


@pytest.fixture
def user_a(organization_a):
    return User.objects.create_user(
        email="user-a@example.com",
        password="Test-password-#123",
        organization=organization_a,
    )


@pytest.fixture
def user_b(organization_b):
    return User.objects.create_user(
        email="user-b@example.com",
        password="Test-password-#123",
        organization=organization_b,
    )


@pytest.fixture
def client_a(user_a):
    client = APIClient()
    client.force_authenticate(user=user_a)
    return client


@pytest.fixture
def client_b(user_b):
    client = APIClient()
    client.force_authenticate(user=user_b)
    return client
