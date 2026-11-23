from django.contrib import admin

from .models import Product


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "name",
        "sku",
        "organization",
        "quantity_on_hand",
        "updated_at",
    )
    list_filter = ("organization",)
    search_fields = ("name", "sku")
