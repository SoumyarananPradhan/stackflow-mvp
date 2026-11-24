# StockFlow

StockFlow is a small multi-tenant inventory management MVP. Organizations can
manage products, adjust stock, and see low-stock items using an organization
default or a product-specific threshold.

## Project links

- **Live URL:** `https://YOUR-LIVE-URL` (placeholder until deployed)
- **API reference:** [Swagger UI](/api/docs/) · [OpenAPI schema](/api/schema/)
- **Deployment guide:** [DEPLOYMENT.md](./DEPLOYMENT.md)
- **Demo access:** Not configured in this repository. Run `seed_demo` with
  password environment variables; the command prints the resulting credentials.
  It defaults to `demo-owner@stockflow.example` and
  `demo-owner-2@stockflow.example`.

## Stack

- **Django 5 and Django REST Framework** provide the session-authenticated API
  and server-side tenant scoping.
- **PostgreSQL** stores tenant, user, and product data.
- **React, TypeScript, Vite, Tailwind CSS, React Router, and TanStack Query**
  provide the same-origin single-page app.
- **Gunicorn and WhiteNoise** serve the production Django app and static assets
  from one web container.
- **pytest and Ruff** cover backend tests and linting; Vitest and Testing
  Library cover focused frontend behavior.

## Architecture and tenant isolation

The production Docker image contains both the Django API and the built React
app. Django returns the SPA for non-API routes, while WhiteNoise serves built
assets. PostgreSQL is a separate managed service. Authentication uses Django
session cookies and CSRF tokens; the frontend and API share an origin in
production.

Product list/detail/create/update/delete and stock adjustment use
`TenantScopedViewSetMixin`, which scopes product querysets to the signed-in
user's organization. The dashboard uses the same mixin for its aggregate and
low-stock queries. Organization settings read and update only
`request.user.organization`. Product identifiers from another organization
therefore return 404 rather than exposing cross-tenant records. Product
organization fields are read-only and assigned server-side.

## Data model

- **Organization:** name and the default low-stock threshold (default `5`).
- **User:** lowercase-normalized, case-insensitively unique email and a
  protected foreign key to one organization.
- **Product:** organization, name, normalized SKU, description, quantity,
  optional decimal cost/selling prices, optional per-product threshold, and the
  last user to update it. SKU is unique within an organization.

## API

All API routes are under `/api/`. Open the [API docs](/api/docs/) for request
and response schemas.

| Area | Routes |
| --- | --- |
| Authentication | `GET /api/auth/csrf/`, `POST /api/auth/signup/`, `POST /api/auth/login/`, `POST /api/auth/logout/`, `GET /api/auth/me/` |
| Products | `GET, POST /api/products/`; `GET, PATCH, DELETE /api/products/{id}/`; `POST /api/products/{id}/adjust/` |
| Dashboard | `GET /api/dashboard/` |
| Organization settings | `GET, PATCH /api/settings/` |
| Health | `GET /api/health/` (public) |
| API schema and UI | `GET /api/schema/`, `GET /api/docs/` |

Product listing supports `search`, `ordering`, and page-number pagination.
Stock adjustment is atomic and cannot reduce quantity below zero. The optional
adjustment note is validated but not stored.

## Local development

Prerequisites: Python 3.12+, Node.js 22+, npm, and Docker Compose.

### Start PostgreSQL

From the repository root:

```powershell
docker compose up -d db
```

The local database uses the development credentials in `docker-compose.yml`.
Do not reuse them outside local development.

### Start the backend

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r backend\requirements.txt
Copy-Item .env.example .env
python backend\manage.py migrate
python backend\manage.py runserver 8000
```

On macOS/Linux, activate with `source .venv/bin/activate` and copy the sample
with `cp .env.example .env`. The development settings load `.env` from the
repository root.

### Start the frontend

In another terminal:

```powershell
cd frontend
npm ci
npm run dev
```

Open the Vite URL (normally `http://localhost:5173`). Requests to `/api/` are
proxied to the Django server on port `8000`.

### Seed demo data

Set two local passwords, then run the management command. Replace the sample
values with passwords suitable for your local demo; do not commit them.

```powershell
$env:SEED_DEMO_ORG1_PASSWORD = "choose-a-local-password"
$env:SEED_DEMO_ORG2_PASSWORD = "choose-another-local-password"
python backend\manage.py seed_demo
```

The command is idempotent, creates 15 products for the first organization and
3 for the second, and prints both email/password pairs. It resets those demo
users' passwords to the supplied values on each run. Optional email overrides
are `SEED_DEMO_ORG1_EMAIL` and `SEED_DEMO_ORG2_EMAIL`. It refuses to run with
`DEBUG=False` unless explicitly invoked with `--force`.

## Checks and tests

Run backend commands from the repository root:

```powershell
ruff check backend
python backend\manage.py check
python backend\manage.py makemigrations --check --dry-run
pytest
```

PostgreSQL is required to exercise the stock-adjustment concurrency test; that
test is skipped when running on SQLite. CI runs the backend suite against
PostgreSQL. Start the Compose database first. Frontend checks:

```powershell
cd frontend
npm run lint
npm run typecheck
npm run test
npm run build
```

## Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for the single-container deployment steps,
environment variables, health check, and smoke-test checklist.

## Assumptions and limitations

- The low-stock default is per organization; a product may override it.
- SKUs are normalized with `strip()` and `upper()`.
- Product deletion is a hard delete.
- Stock quantity cannot become negative.
- Adjustment notes are accepted and validated but not persisted.
- There is no stock-movement ledger, password reset, organization invites or
  roles, CSV import, email alerting, or billing in this MVP.

Potential future work includes a `StockMovement` ledger, password reset and
invitation flows, role management, CSV import, email alerts, and billing.
