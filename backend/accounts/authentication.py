"""
CSRF enforcement for unauthenticated DRF views.

DRF's APIView wraps views with @csrf_exempt, and SessionAuthentication only
enforces CSRF when it finds a session user. For unauthenticated POST endpoints
like signup and login, we need explicit CSRF enforcement so the SPA pattern
(fetch /auth/csrf/ first, then POST with X-CSRFToken header) works correctly.
"""

from rest_framework.authentication import SessionAuthentication


class CsrfEnforcedSessionAuthentication(SessionAuthentication):
    """
    Like SessionAuthentication, but always enforces CSRF — even if the
    request has no session (i.e. the user is not logged in).

    Use on views that are AllowAny but still need CSRF protection
    (signup, login).
    """

    def authenticate(self, request):
        # Always enforce CSRF, regardless of whether there's an active session.
        self.enforce_csrf(request)
        # Then do normal session auth (returns None if not logged in).
        return super().authenticate(request)
