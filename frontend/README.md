# StockFlow frontend

## Development

```bash
npm install
npm run dev
```

The Vite server proxies `/api` requests to `http://localhost:8000`.
The development Django settings trust the default Vite origins on port `5173`.
If Vite runs on another origin, add it to `CSRF_TRUSTED_ORIGINS`.

## Checks and production build

```bash
npm run lint
npm run typecheck
npm run build
```

The production build is written to `dist/` and references assets under `/static/`.
For Django production serving, add `frontend/dist` to `STATICFILES_DIRS`, run
`collectstatic`, and serve `frontend/dist/index.html` for frontend routes while
excluding `/api/`, `/admin/`, and `/static/`.
