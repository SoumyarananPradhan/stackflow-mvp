from django.db import IntegrityError, transaction
from django.db.models import BooleanField, Case, Count, F, PositiveIntegerField, Sum, Value, When
from django.db.models.functions import Coalesce
from django.shortcuts import get_object_or_404
from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework import serializers, viewsets
from rest_framework.decorators import action
from rest_framework.filters import OrderingFilter, SearchFilter
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import Organization
from core.mixins import TenantScopedViewSetMixin

from .models import Product
from .serializers import DUPLICATE_SKU_MESSAGE, ProductSerializer


class StockAdjustmentSerializer(serializers.Serializer):
    delta = serializers.IntegerField()
    note = serializers.CharField(required=False, allow_blank=True, max_length=255)

    def validate_delta(self, value):
        if value == 0:
            raise serializers.ValidationError("Delta must be non-zero.")
        return value


class DashboardSerializer(serializers.Serializer):
    total_products = serializers.IntegerField()
    total_quantity = serializers.IntegerField()
    low_stock_items = ProductSerializer(many=True)


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

    @extend_schema(
        request=StockAdjustmentSerializer,
        responses={
            200: ProductSerializer,
            400: OpenApiResponse(description="Invalid adjustment or insufficient stock."),
            404: OpenApiResponse(description="Product not found."),
            429: OpenApiResponse(description="Request rate limit exceeded."),
        },
    )
    @action(detail=True, methods=("post",))
    def adjust(self, request, pk=None):
        adjustment = StockAdjustmentSerializer(data=request.data)
        adjustment.is_valid(raise_exception=True)
        delta = adjustment.validated_data["delta"]

        with transaction.atomic():
            product = get_object_or_404(
                self.get_queryset().select_for_update(),
                pk=pk,
            )
            if product.quantity_on_hand + delta < 0:
                raise serializers.ValidationError(
                    {"delta": ["Insufficient stock. Cannot reduce below 0."]}
                )

            product.quantity_on_hand += delta
            product.last_updated_by = request.user
            product.save(update_fields=("quantity_on_hand", "last_updated_by", "updated_at"))
            product = self.get_queryset().get(pk=product.pk)

        return Response(ProductSerializer(product, context=self.get_serializer_context()).data)


class DashboardView(APIView):
    @extend_schema(responses={200: DashboardSerializer})
    def get(self, request):
        products = Product.objects.filter(organization_id=request.user.organization_id)
        totals = products.aggregate(
            total_products=Count("pk"),
            total_quantity=Coalesce(
                Sum("quantity_on_hand"),
                0,
                output_field=PositiveIntegerField(),
            ),
        )
        low_stock_items = (
            products.annotate(
                effective_threshold=Coalesce(
                    "low_stock_threshold",
                    "organization__default_low_stock_threshold",
                    output_field=PositiveIntegerField(),
                )
            )
            .filter(quantity_on_hand__lte=F("effective_threshold"))
            .annotate(is_low_stock=Value(True, output_field=BooleanField()))
            .order_by("quantity_on_hand", "name")[:50]
        )

        return Response(
            {
                **totals,
                "low_stock_items": ProductSerializer(
                    low_stock_items,
                    many=True,
                    context={"request": request},
                ).data,
            }
        )


class OrganizationSettingsSerializer(serializers.ModelSerializer):
    default_low_stock_threshold = serializers.IntegerField(
        min_value=0,
        max_value=1_000_000,
    )

    class Meta:
        model = Organization
        fields = ("default_low_stock_threshold",)


class OrganizationSettingsView(APIView):
    @extend_schema(responses={200: OrganizationSettingsSerializer})
    def get(self, request):
        serializer = OrganizationSettingsSerializer(request.user.organization)
        return Response(serializer.data)

    @extend_schema(
        request=OrganizationSettingsSerializer,
        responses={
            200: OrganizationSettingsSerializer,
            400: OpenApiResponse(description="Invalid settings."),
        },
    )
    def patch(self, request):
        serializer = OrganizationSettingsSerializer(
            request.user.organization,
            data=request.data,
            partial=True,
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)
