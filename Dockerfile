# syntax=docker/dockerfile:1
FROM node:22-alpine AS frontend-build

WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM python:3.12-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    DJANGO_SETTINGS_MODULE=config.settings.prod

WORKDIR /app
COPY backend/requirements.txt /app/backend/requirements.txt
RUN pip install --no-cache-dir -r /app/backend/requirements.txt

COPY backend/ /app/backend/
COPY --from=frontend-build /app/frontend/dist/ /app/frontend/dist/

WORKDIR /app/backend
RUN DJANGO_SETTINGS_MODULE=config.settings.base python manage.py collectstatic --noinput

RUN groupadd --system app && useradd --system --gid app --create-home app
COPY --chmod=755 entrypoint.sh /usr/local/bin/entrypoint.sh
RUN python -c "from pathlib import Path; p = Path('/usr/local/bin/entrypoint.sh'); p.write_bytes(p.read_bytes().replace(b'\r\n', b'\n'))"

ARG PORT=8000
ENV PORT=${PORT}
EXPOSE ${PORT}

USER app:app
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
