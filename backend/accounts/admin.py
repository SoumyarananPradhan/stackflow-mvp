from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.contrib.auth.forms import BaseUserCreationForm

from .models import Organization, User


class UserCreationForm(BaseUserCreationForm):
    class Meta(BaseUserCreationForm.Meta):
        model = User
        fields = ("email", "organization")

    def clean_email(self):
        return self.cleaned_data["email"].strip().lower()


@admin.register(Organization)
class OrganizationAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "default_low_stock_threshold", "created_at")
    search_fields = ("name",)


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    add_form = UserCreationForm
    list_display = ("id", "email", "organization", "is_active", "is_staff", "created_at")
    list_filter = ("is_active", "is_staff", "organization")
    search_fields = ("email",)
    ordering = ("email",)

    # Override fieldsets since we don't have username, first_name, last_name
    fieldsets = (
        (None, {"fields": ("email", "password")}),
        ("Organization", {"fields": ("organization",)}),
        (
            "Permissions",
            {"fields": ("is_active", "is_staff", "is_superuser", "groups", "user_permissions")},
        ),
    )
    add_fieldsets = (
        (
            None,
            {
                "classes": ("wide",),
                "fields": ("email", "organization", "password1", "password2"),
            },
        ),
    )
