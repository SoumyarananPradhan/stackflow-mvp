from django.contrib.auth import authenticate, login, logout, password_validation
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from django.middleware.csrf import get_token
from rest_framework import serializers, status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .authentication import CsrfEnforcedSessionAuthentication
from .models import Organization, User

# ---------------------------------------------------------------------------
# Serializers
# ---------------------------------------------------------------------------


class OrganizationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Organization
        fields = ("id", "name")
        read_only_fields = fields


class UserSerializer(serializers.ModelSerializer):
    organization = OrganizationSerializer(read_only=True)

    class Meta:
        model = User
        fields = ("id", "email", "organization")
        read_only_fields = fields


class SignupSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)
    confirm_password = serializers.CharField(write_only=True)
    organization_name = serializers.CharField(max_length=255)

    def validate_organization_name(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Organization name is required.")
        return value

    def validate_email(self, value):
        return value.strip().lower()

    def validate(self, data):
        if data["password"] != data["confirm_password"]:
            raise serializers.ValidationError({"confirm_password": "Passwords do not match."})

        try:
            password_validation.validate_password(
                data["password"],
                user=User(email=data["email"]),
            )
        except DjangoValidationError as exc:
            raise serializers.ValidationError({"password": exc.messages}) from exc

        # Check for duplicate email (case-insensitive)
        if User.objects.filter(email__iexact=data["email"]).exists():
            raise serializers.ValidationError({"email": "A user with this email already exists."})

        return data

    def create(self, validated_data):
        with transaction.atomic():
            org = Organization.objects.create(name=validated_data["organization_name"])
            user = User.objects.create_user(
                email=validated_data["email"],
                password=validated_data["password"],
                organization=org,
            )
        return user


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)


# ---------------------------------------------------------------------------
# Views
# ---------------------------------------------------------------------------


class CsrfView(APIView):
    """GET /api/auth/csrf/ — sets the CSRF cookie and returns 204."""

    permission_classes = [AllowAny]
    authentication_classes = []  # no auth needed

    def get(self, request):
        get_token(request)  # forces Django to set the csrftoken cookie
        return Response(status=status.HTTP_204_NO_CONTENT)


class SignupView(APIView):
    """POST /api/auth/signup/ — create org + user, log in, return user payload."""

    permission_classes = [AllowAny]
    authentication_classes = [CsrfEnforcedSessionAuthentication]

    def post(self, request):
        serializer = SignupSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        login(request, user)
        return Response(UserSerializer(user).data, status=status.HTTP_201_CREATED)


class LoginView(APIView):
    """POST /api/auth/login/ — authenticate and log in."""

    permission_classes = [AllowAny]
    authentication_classes = [CsrfEnforcedSessionAuthentication]

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data["email"].strip().lower()
        password = serializer.validated_data["password"]
        user = authenticate(request, email=email, password=password)
        if user is None:
            return Response(
                {"detail": "Invalid email or password"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        login(request, user)
        return Response(UserSerializer(user).data)


class LogoutView(APIView):
    """POST /api/auth/logout/ — log out."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        logout(request)
        return Response(status=status.HTTP_204_NO_CONTENT)


class MeView(APIView):
    """GET /api/auth/me/ — return current user info."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(UserSerializer(request.user).data)
