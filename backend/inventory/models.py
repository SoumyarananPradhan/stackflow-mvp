from django.conf import settings
from django.db import models
from django.db.models import UniqueConstraint

from accounts.models import Organization


class Product(models.Model):
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name="products",
    )
    name = models.CharField(max_length=255)
    sku = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    quantity_on_hand = models.PositiveIntegerField(default=0)
    cost_price = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    selling_price = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    low_stock_threshold = models.PositiveIntegerField(null=True, blank=True)
    last_updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="updated_products",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            UniqueConstraint(
                fields=("organization", "sku"),
                name="unique_product_organization_sku",
            ),
        ]
        indexes = [
            models.Index(
                fields=("organization", "name"),
                name="product_org_name_idx",
            ),
        ]

    def save(self, *args, **kwargs):
        self.sku = self.sku.strip().upper()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.name} ({self.sku})"
