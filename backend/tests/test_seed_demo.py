import pytest
from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import override_settings

from accounts.models import Organization, User
from inventory.models import Product


def set_demo_credentials(monkeypatch):
    monkeypatch.setenv("SEED_DEMO_ORG1_PASSWORD", "demo-password-one")
    monkeypatch.setenv("SEED_DEMO_ORG2_PASSWORD", "demo-password-two")


@pytest.mark.django_db
@override_settings(DEBUG=True)
def test_seed_demo_is_idempotent_and_prints_credentials(monkeypatch, capsys):
    set_demo_credentials(monkeypatch)

    call_command("seed_demo")
    call_command("seed_demo")

    first_organization = Organization.objects.get(name="StockFlow Demo")
    second_organization = Organization.objects.get(name="StockFlow Demo - Second Organization")
    first_user = User.objects.get(email="demo-owner@stockflow.example")
    second_user = User.objects.get(email="demo-owner-2@stockflow.example")

    assert Organization.objects.count() == 2
    assert User.objects.count() == 2
    assert Product.objects.filter(organization=first_organization).count() == 15
    assert Product.objects.filter(organization=second_organization).count() == 3
    assert first_user.check_password("demo-password-one")
    assert second_user.check_password("demo-password-two")
    assert Product.objects.filter(
        organization=first_organization, cost_price__isnull=True
    ).exists()
    assert "Password: demo-password-one" in capsys.readouterr().out


@pytest.mark.django_db
@override_settings(DEBUG=False)
def test_seed_demo_refuses_production_without_force_then_allows_force(monkeypatch):
    set_demo_credentials(monkeypatch)

    with pytest.raises(CommandError, match="DEBUG=False"):
        call_command("seed_demo")
    assert Organization.objects.count() == 0

    call_command("seed_demo", force=True)
    assert Organization.objects.count() == 2
