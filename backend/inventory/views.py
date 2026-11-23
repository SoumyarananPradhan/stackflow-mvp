from django.db import IntegrityError, transaction
from django.db.models import BooleanField, Case, F, PositiveIntegerField, Value, When
from django.db.models.functions import Coalesce
from rest_framework import serializers, viewsets
from rest_framework.filters import OrderingFilter, SearchFilter

from core.mixins import TenantScopedViewSetMixin

from .models import Product
from .serializers import DUPLICATE_SKU_MESSAGE, ProductSerializer


class ProductViewSet(TenantScopedViewSetMixin, viewsets.ModelViewSet):
    queryset = Product.objects.all()
    serializer_class = ProductSerializer
    filter_backends = (SearchFilter, OrderingFilter)
    search_fields = ("name", "sku")
    ordering_fields = (
        "name",
        "sku",
        "quantity_on_hand",
        "selling_price",
        "created_at",
        "updated_at",
    )
    ordering = ("created_at", "pk")

    def get_queryset(self):
        return (
            super()
            .get_queryset()
            .annotate(
                effective_threshold=Coalesce(
                    "low_stock_threshold",
                    "organization__default_low_stock_threshold",
                    output_field=PositiveIntegerField(),
                )
            )
            .annotate(
                is_low_stock=Case(
                    When(
                        quantity_on_hand__lte=F("effective_threshold"),
                        then=Value(True),
                    ),
                    default=Value(False),
                    output_field=BooleanField(),
                )
            )
        )

    def filter_queryset(self, queryset):
        ordering = self.request.query_params.get("ordering")
        if ordering:
            requested_fields = [term.strip().removeprefix("-") for term in ordering.split(",")]
            if any(field not in self.ordering_fields for field in requested_fields):
                raise serializers.ValidationError({"ordering": ["Invalid ordering field."]})
        return super().filter_queryset(queryset)

    def _save_product(self, serializer, save):
        organization_id = self.request.user.organization_id
        sku = serializer.validated_data.get("sku")
        if sku is None and serializer.instance is not None:
            sku = serializer.instance.sku

        try:
            with transaction.atomic():
                save(serializer)
        except IntegrityError as exc:
            matching_products = Product.objects.filter(
                organization_id=organization_id,
                sku=sku,
            )
            if serializer.instance is not None:
                matching_products = matching_products.exclude(pk=serializer.instance.pk)
            if sku is not None and matching_products.exists():
                raise serializers.ValidationError({"sku": [DUPLICATE_SKU_MESSAGE]}) from exc
            raise
        serializer.instance = self.get_queryset().get(pk=serializer.instance.pk)

    def perform_create(self, serializer):
        self._save_product(serializer, super().perform_create)

    def perform_update(self, serializer):
        self._save_product(serializer, super().perform_update)
