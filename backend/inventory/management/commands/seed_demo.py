import os
from decimal import Decimal

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from accounts.models import Organization, User
from inventory.models import Product

DEMO_ORGANIZATIONS = (
    {
        "name": "StockFlow Demo",
        "email_env": "SEED_DEMO_ORG1_EMAIL",
        "password_env": "SEED_DEMO_ORG1_PASSWORD",
        "default_email": "demo-owner@stockflow.example",
    },
    {
        "name": "StockFlow Demo - Second Organization",
        "email_env": "SEED_DEMO_ORG2_EMAIL",
        "password_env": "SEED_DEMO_ORG2_PASSWORD",
        "default_email": "demo-owner-2@stockflow.example",
    },
)

FIRST_ORG_PRODUCTS = (
    {
        "name": "Arabica Coffee Beans",
        "sku": "COFFEE-ARABICA-1KG",
        "quantity_on_hand": 3,
        "cost_price": Decimal("12.50"),
        "selling_price": Decimal("18.00"),
    },
    {
        "name": "Ceramic Mug",
        "sku": "MUG-CERAMIC-01",
        "quantity_on_hand": 24,
        "cost_price": Decimal("4.25"),
        "selling_price": Decimal("9.50"),
    },
    {
        "name": "Pour-over Filters",
        "sku": "FILTER-POUR-100",
        "quantity_on_hand": 0,
        "cost_price": Decimal("2.00"),
        "selling_price": Decimal("5.00"),
    },
    {
        "name": "Stainless Kettle",
        "sku": "KETTLE-STEEL-01",
        "quantity_on_hand": 2,
        "cost_price": Decimal("22.00"),
        "selling_price": Decimal("39.00"),
    },
    {
        "name": "Espresso Machine",
        "sku": "MACHINE-ESPRESSO-01",
        "quantity_on_hand": 8,
        "cost_price": Decimal("105.00"),
        "selling_price": Decimal("179.00"),
        "low_stock_threshold": 10,
    },
    {
        "name": "Reusable Bottle",
        "sku": "BOTTLE-REUSE-01",
        "quantity_on_hand": 10,
        "cost_price": Decimal("6.00"),
        "selling_price": Decimal("14.00"),
        "low_stock_threshold": 2,
    },
    {
        "name": "Glass Storage Jar",
        "sku": "JAR-GLASS-01",
        "quantity_on_hand": 2,
        "cost_price": Decimal("3.50"),
        "selling_price": Decimal("8.00"),
        "low_stock_threshold": 2,
    },
    {
        "name": "Tea Sampler",
        "sku": "TEA-SAMPLER-01",
        "quantity_on_hand": 18,
        "cost_price": Decimal("7.00"),
        "selling_price": Decimal("14.00"),
    },
    {
        "name": "Paper Cups",
        "sku": "CUPS-PAPER-50",
        "quantity_on_hand": 4,
        "cost_price": Decimal("1.50"),
        "selling_price": Decimal("4.00"),
    },
    {
        "name": "Digital Scale",
        "sku": "SCALE-DIGITAL-01",
        "quantity_on_hand": 6,
        "cost_price": Decimal("11.00"),
        "selling_price": Decimal("24.00"),
    },
    {
        "name": "Cold Brew Pitcher",
        "sku": "PITCHER-COLD-01",
        "quantity_on_hand": 1,
        "cost_price": Decimal("8.00"),
        "selling_price": Decimal("19.00"),
        "low_stock_threshold": 0,
    },
    {
        "name": "Cleaning Brush",
        "sku": "BRUSH-CLEAN-01",
        "quantity_on_hand": 0,
        "cost_price": Decimal("2.25"),
        "selling_price": Decimal("6.00"),
        "low_stock_threshold": 0,
    },
    {
        "name": "Gift Card",
        "sku": "GIFT-CARD-25",
        "quantity_on_hand": 50,
        "cost_price": None,
        "selling_price": Decimal("25.00"),
    },
    {
        "name": "Display Stand",
        "sku": "STAND-DISPLAY-01",
        "quantity_on_hand": 4,
        "cost_price": Decimal("14.00"),
        "selling_price": Decimal("29.00"),
        "low_stock_threshold": 3,
    },
    {
        "name": "Shipping Box",
        "sku": "BOX-SHIPPING-01",
        "quantity_on_hand": 0,
        "cost_price": None,
        "selling_price": None,
    },
)

SECOND_ORG_PRODUCTS = (
    {
        "name": "Blue Notebook",
        "sku": "NOTEBOOK-BLUE-01",
        "quantity_on_hand": 12,
        "cost_price": Decimal("2.00"),
        "selling_price": Decimal("5.00"),
    },
    {
        "name": "Desk Lamp",
        "sku": "LAMP-DESK-01",
        "quantity_on_hand": 2,
        "cost_price": Decimal("13.00"),
        "selling_price": Decimal("27.00"),
    },
    {
        "name": "Pen Set",
        "sku": "PEN-SET-01",
        "quantity_on_hand": 4,
        "cost_price": None,
        "selling_price": Decimal("8.00"),
    },
)


class Command(BaseCommand):
    help = "Create or update two organizations and representative demo inventory."

    def add_arguments(self, parser):
        parser.add_argument(
            "--force",
            action="store_true",
            help="Allow seeding when DEBUG is disabled.",
        )

    def handle(self, *args, **options):
        if not settings.DEBUG and not options["force"]:
            raise CommandError(
                "Refusing to seed demo data with DEBUG=False; pass --force to continue."
            )

        credentials = [
            self._read_credentials(organization_config)
            for organization_config in DEMO_ORGANIZATIONS
        ]

        with transaction.atomic():
            seeded = []
            for index, (organization_config, (email, password)) in enumerate(
                zip(DEMO_ORGANIZATIONS, credentials, strict=True)
            ):
                organization, _ = Organization.objects.get_or_create(
                    name=organization_config["name"],
                    defaults={"default_low_stock_threshold": 5},
                )
                user = self._get_demo_user(email, password, organization)
                products = FIRST_ORG_PRODUCTS if index == 0 else SECOND_ORG_PRODUCTS
                self._seed_products(organization, user, products)
                seeded.append((organization, email, password, len(products)))

        for organization, email, password, product_count in seeded:
            self.stdout.write(f"{organization.name}: {product_count} products")
            self.stdout.write(f"  Email: {email}")
            self.stdout.write(f"  Password: {password}")

    def _read_credentials(self, organization_config):
        email = (
            os.environ.get(
                organization_config["email_env"],
                organization_config["default_email"],
            )
            .strip()
            .lower()
        )
        password = os.environ.get(organization_config["password_env"])
        if not email:
            raise CommandError(f"{organization_config['email_env']} must not be empty.")
        if not password:
            raise CommandError(f"{organization_config['password_env']} must be set and non-empty.")
        return email, password

    def _get_demo_user(self, email, password, organization):
        user = User.objects.filter(email__iexact=email).first()
        if user is None:
            return User.objects.create_user(
                email=email,
                password=password,
                organization=organization,
            )
        if user.organization_id != organization.pk:
            raise CommandError(f"Demo email {email} already belongs to a different organization.")

        user.email = email
        user.is_active = True
        user.set_password(password)
        user.save(update_fields=("email", "password", "is_active"))
        return user

    def _seed_products(self, organization, user, product_records):
        for product_record in product_records:
            Product.objects.update_or_create(
                organization=organization,
                sku=product_record["sku"],
                defaults={
                    "name": product_record["name"],
                    "quantity_on_hand": product_record["quantity_on_hand"],
                    "cost_price": product_record["cost_price"],
                    "selling_price": product_record["selling_price"],
                    "low_stock_threshold": product_record.get("low_stock_threshold"),
                    "last_updated_by": user,
                },
            )
