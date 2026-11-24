# StockFlow

Multi-tenant SaaS inventory management MVP.

## Tech Stack

- **Backend:** Python 3.12, Django 5.x, Django REST Framework
- **Database:** PostgreSQL (via `DATABASE_URL` + `dj-database-url`)
- **API Docs:** drf-spectacular (OpenAPI + Swagger UI)
- **Auth:** Django session cookie + CSRF (no JWT)
- **Production:** Gunicorn + WhiteNoise
- **Linting:** Ruff
- **Frontend (later):** React + Vite + Tailwind + React Router + TanStack Query

## Assumptions

- Default low-stock threshold is configured per-organization.
- SKUs are normalized: `strip()` + `upper()`.
- Products use hard delete (no soft delete).
- Stock adjustments cannot bring quantity below zero.
- Stock adjustment notes are validated but not stored; stock-movement history is out of scope.

## Quick Start

```bash
# 1. Start PostgreSQL
docker compose up -d

# 2. Create virtualenv & install deps
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r backend/requirements.txt

# 3. Copy env file
cp .env.example .env

# 4. Run migrations & dev server
cd backend
python manage.py migrate
python manage.py runserver

# 5. Run tests
pytest

# 6. Lint
ruff check backend/
ruff format --check backend/
```

## Project Structure

```
Stockflow/
├── CLAUDE.md              # Project contract & spec
├── README.md
├── .env.example
├── .gitignore
├── docker-compose.yml     # PostgreSQL for local dev
├── pyproject.toml         # Ruff & pytest config
└── backend/
    ├── manage.py
    ├── requirements.txt
    ├── config/
    │   ├── settings/
    │   │   ├── base.py
    │   │   ├── dev.py
    │   │   └── prod.py
    │   ├── urls.py
    │   └── wsgi.py
    ├── accounts/          # Organization & User models
    ├── inventory/         # Product model
    ├── core/              # Shared mixins
    └── tests/
```
