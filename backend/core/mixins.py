class TenantScopedViewSetMixin:
    def get_queryset(self):
        return super().get_queryset().filter(organization_id=self.request.user.organization_id)

    def perform_create(self, serializer):
        serializer.save(
            organization=self.request.user.organization,
            last_updated_by=self.request.user,
        )

    def perform_update(self, serializer):
        serializer.save(last_updated_by=self.request.user)
