# Deployment

StockFlow is deployed as one Docker web service. Django serves the React app,
and WhiteNoise serves its static assets; PostgreSQL should be a separate
managed database.

## Deploy to a Docker host

1. Create a managed PostgreSQL database and copy its connection URL. Use the
   provider's SSL-enabled URL if it requires SSL.
2. Create a web service from this repository and select its Dockerfile. The
   container runs database migrations before starting Gunicorn.
3. Configure these environment variables in the host's service settings:

   | Variable | Value |
   | --- | --- |
   | `DJANGO_SETTINGS_MODULE` | `config.settings.prod` |
   | `DJANGO_SECRET_KEY` | A newly generated, long random secret |
   | `DEBUG` | `False` |
   | `DATABASE_URL` | The managed PostgreSQL connection URL |
   | `ALLOWED_HOSTS` | Your hostname, without a scheme |
   | `CSRF_TRUSTED_ORIGINS` | Your origin including `https://`, e.g. `https://stockflow.example.com` |
   | `SECURE_SSL_REDIRECT` | `true` when the host terminates HTTPS and forwards `X-Forwarded-Proto` |

   The host should provide `PORT`; otherwise the container defaults to `8000`.
   Optional settings include `WEB_CONCURRENCY`, `LOG_LEVEL`,
   `API_USER_THROTTLE_RATE`, `API_LOGIN_THROTTLE_RATE`, and
   `API_SIGNUP_THROTTLE_RATE`. Defaults are in
   [.env.production.example](./.env.production.example).

4. Set the service health-check path to `/api/health/`.
5. Deploy, then run the smoke checklist below.

## Local Docker smoke test

These commands use the PostgreSQL service in `docker-compose.yml`. Copy
`.env.production.example` to `.env.production` first and replace the secret and
placeholder values. The `docker run` options override the database and
HTTP-origin settings for local testing.

```powershell
docker compose up -d db
docker compose ps
docker build -t stockflow:local .
docker run --rm --name stockflow-web --network stockflow -p 8000:8000 `
  --env-file .env.production `
  -e DATABASE_URL=postgres://stockflow:stockflow@db:5432/stockflow `
  -e ALLOWED_HOSTS=localhost,127.0.0.1 `
  -e CSRF_TRUSTED_ORIGINS=http://localhost:8000 `
  -e SECURE_SSL_REDIRECT=false `
  stockflow:local
```

In another terminal:

```powershell
curl.exe -i http://localhost:8000/
curl.exe -i http://localhost:8000/api/health/
curl.exe -i http://localhost:8000/products/1/edit
curl.exe -i http://localhost:8000/api/unknown/
```

The root and deep-link requests should return the SPA HTML, health should return
`{"status":"ok"}`, and the unknown API route should return a JSON 404. Stop the
web container with Ctrl+C; stop the database with `docker compose down` when
finished.

## Post-deploy smoke checklist

- Open `/` and confirm the app loads.
- Sign up through the app and confirm the authenticated dashboard loads.
- Create a product through the Products page.
- Open a deep link such as `/products/1/edit` and refresh; the SPA should load.
- Open `/api/docs/` and confirm the API documentation loads.
- Confirm the host health check at `/api/health/` reports `{"status":"ok"}`.
