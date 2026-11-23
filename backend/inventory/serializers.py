from rest_framework import serializers

from .models import Product

DUPLICATE_SKU_MESSAGE = "A product with this SKU already exists."


class ProductSerializer(serializers.ModelSerializer):
    organization = serializers.PrimaryKeyRelatedField(read_only=True)
    last_updated_by = serializers.PrimaryKeyRelatedField(read_only=True)
    quantity_on_hand = serializers.IntegerField(min_value=0)
    low_stock_threshold = serializers.IntegerField(
        min_value=0,
        allow_null=True,
        required=False,
    )
    effective_threshold = serializers.IntegerField(read_only=True)
    is_low_stock = serializers.BooleanField(read_only=True)

    class Meta:
        model = Product
        fields = (
            "id",
            "organization",
            "name",
            "sku",
            "description",
            "quantity_on_hand",
            "cost_price",
            "selling_price",
            "low_stock_threshold",
            "last_updated_by",
            "created_at",
            "updated_at",
            "effective_threshold",
            "is_low_stock",
        )
        read_only_fields = (
            "id",
            "organization",
            "last_updated_by",
            "created_at",
            "updated_at",
            "effective_threshold",
            "is_low_stock",
        )
        validators = []

    def validate_name(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Name must not be empty.")
        return value

    def validate_sku(self, value):
        value = value.strip().upper()
        if not value:
            raise serializers.ValidationError("SKU must not be empty.")
        return value

    def validate_cost_price(self, value):
        if value is not None and value < 0:
            raise serializers.ValidationError("Cost price must be greater than or equal to zero.")
        return value

    def validate_selling_price(self, value):
        if value is not None and value < 0:
            raise serializers.ValidationError(
                "Selling price must be greater than or equal to zero."
            )
        return value

    def validate(self, attrs):
        sku = attrs.get("sku")
        if sku is None:
            return attrs

        organization_id = (
            self.instance.organization_id
            if self.instance is not None
            else self.context["request"].user.organization_id
        )
        matching_products = Product.objects.filter(organization_id=organization_id, sku=sku)
        if self.instance is not None:
            matching_products = matching_products.exclude(pk=self.instance.pk)
        if matching_products.exists():
            raise serializers.ValidationError({"sku": [DUPLICATE_SKU_MESSAGE]})
        return attrs
