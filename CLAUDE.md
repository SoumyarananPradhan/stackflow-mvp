# CLAUDE.md — StockFlow Project Contract

## Overview
StockFlow is a multi-tenant SaaS inventory MVP (take-home assessment, 12–16 hrs).
Do **not** add features beyond this spec: no RBAC, CSV import, billing, Celery,
Redis, charts, stock-movement history.

---

## Stack

| Layer | Technology |
|-------|-----------|
| Backend | Python 3.12, Django 5.x, Django REST Framework |
| Database | PostgreSQL (`DATABASE_URL` via `dj-database-url`) |
| API Docs | drf-spectacular |
| Testing | pytest + pytest-django |
| Production | Gunicorn + WhiteNoise |
| Linting | Ruff |
| Frontend (later) | React + Vite + Tailwind + React Router + TanStack Query |
| Auth | Django session cookie + CSRF (no JWT) |

Frontend is served by Django from the same origin in production.

---

## Data Model

### `accounts.Organization`
- `name` — CharField
- `default_low_stock_threshold` — PositiveIntegerField, default 5
- `created_at` — DateTimeField auto_now_add

### `accounts.User` (custom user, `AUTH_USER_MODEL`)
- `email` — EmailField, **USERNAME_FIELD**, lowercase-normalized
- Case-insensitive unique via `UniqueConstraint` on `Lower("email")`
- `organization` — FK → Organization, `on_delete=PROTECT`
- `is_active`, `is_staff`, `created_at`

### `inventory.Product`
- `organization` — FK → Organization
- `name` — CharField
- `sku` — CharField, normalized with `strip()` and `upper()`
- `description` — TextField, blank
- `quantity_on_hand` — PositiveIntegerField, default 0
- `cost_price` — DecimalField(12, 2), nullable
- `selling_price` — DecimalField(12, 2), nullable
- `low_stock_threshold` — PositiveIntegerField, nullable
- `last_updated_by` — FK → User, `on_delete=SET_NULL`
- `created_at` — DateTimeField auto_now_add
- `updated_at` — DateTimeField auto_now
- `UniqueConstraint(organization, sku)`

---

## API (all under `/api/`)

### Auth
| Method | Endpoint | Notes |
|--------|----------|-------|
| GET | `/auth/csrf/` | 204, sets CSRF cookie |
| POST | `/auth/signup/` | `{email, password, confirm_password, organization_name}` |
| POST | `/auth/login/` | `{email, password}` |
| POST | `/auth/logout/` | |
| GET | `/auth/me/` | `{id, email, organization:{id, name}}` |

### Products
| Method | Endpoint | Notes |
|--------|----------|-------|
| GET | `/products/` | `?search=` on name or sku, `?ordering=`, page-number pagination (size 20) |
| POST | `/products/` | Create a product |
| GET | `/products/{id}/` | |
| PATCH | `/products/{id}/` | |
| DELETE | `/products/{id}/` | Hard delete |
| POST | `/products/{id}/adjust/` | `{delta, note?}` — atomic stock adjustment |

### Dashboard
| Method | Endpoint | Notes |
|--------|----------|-------|
| GET | `/dashboard/` | `{total_products, total_quantity, low_stock_items:[…]}` |

### Settings
| Method | Endpoint | Notes |
|--------|----------|-------|
| GET | `/settings/` | `{default_low_stock_threshold}` |
| PATCH | `/settings/` | |

### Other
| Method | Endpoint | Notes |
|--------|----------|-------|
| GET | `/health/` | Public, no auth |
| GET | `/api/schema/` | OpenAPI schema (drf-spectacular) |
| GET | `/api/docs/` | Swagger UI (drf-spectacular) |

---

## Engineering Rules

1. **Tenant isolation** — Every inventory view is scoped through
   `core.mixins.TenantScopedViewSetMixin` (`get_queryset` filters by
   `request.user.organization`). Organization is set server-side in
   `perform_create` and read-only in serializers. Cross-tenant access
   returns **404**, never 403.

2. **Low stock** — Computed in the database:
   `effective_threshold = Coalesce(product.low_stock_threshold, organization.default_low_stock_threshold)`;
   low stock when `quantity_on_hand <= effective_threshold`.

3. **Stock adjust** — Atomic (`F()` expression or `select_for_update`
   inside `transaction.atomic()`); result below 0 returns **400**.

4. **Money** — Always `Decimal`, never `float`. Secrets only from env.
   No secrets in git.

5. **Simplicity** — No extra abstraction layers unless a view becomes
   genuinely complex.

6. **Documented APIs only** — Use only documented APIs for the installed
   versions; if unsure, check the docs instead of guessing.

7. **Verify before claiming** — Never claim something passes unless
   you ran it.

8. **Commits** — Conventional Commit messages (`feat:`, `fix:`, `test:`,
   `chore:`, `docs:`). Small commits, never one giant commit. Commit
   after every logical step.

9. **README assumptions**:
   - Default threshold is per-organization
   - SKUs are normalized (strip + upper)
   - Hard delete is used
   - Adjustments cannot go below zero
