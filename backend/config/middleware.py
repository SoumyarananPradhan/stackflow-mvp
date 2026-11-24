from django.http import JsonResponse


class ApiJsonErrorMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        content_type = response.get("Content-Type", "").split(";", maxsplit=1)[0]
        if (
            request.path.startswith("/api/")
            and response.status_code >= 400
            and content_type == "text/html"
        ):
            headers = {
                name: response[name]
                for name in ("Allow", "Retry-After", "WWW-Authenticate")
                if name in response
            }
            return JsonResponse(
                {"detail": response.reason_phrase},
                status=response.status_code,
                headers=headers,
            )
        return response
