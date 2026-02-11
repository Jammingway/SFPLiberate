ARG BUILD_FROM=ghcr.io/home-assistant/amd64-base:3.22
ARG BUILD_VERSION=0.0.0

FROM --platform=$BUILDPLATFORM python:3.12-slim AS backend-build
WORKDIR /backend
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    && rm -rf /var/lib/apt/lists/*
RUN pip install --no-cache-dir poetry==1.8.5
COPY backend/pyproject.toml backend/poetry.lock ./
RUN poetry export -f requirements.txt --output requirements.txt --without-hashes --without dev
RUN pip install --no-cache-dir -r requirements.txt
COPY backend/app /backend/app

FROM --platform=$BUILDPLATFORM node:22-alpine AS frontend-build
WORKDIR /frontend
COPY frontend/package*.json ./
RUN npm ci --only=production
COPY frontend/ ./
ENV DEPLOYMENT_MODE=homeassistant
ENV BACKEND_URL=http://localhost:80
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

ARG BUILD_FROM
ARG BUILD_VERSION
FROM ${BUILD_FROM}

RUN apk add --no-cache \
    python3=~3.12 \
    py3-pip \
    nodejs \
    npm \
    dbus \
    bluez \
    bluez-deprecated \
    curl \
    jq

COPY --from=backend-build /backend/app /app/backend/app
COPY --from=backend-build /usr/local/lib/python3.12/site-packages /usr/lib/python3.12/site-packages

COPY --from=frontend-build /frontend/.next/standalone /app/frontend
COPY --from=frontend-build /frontend/.next/static /app/frontend/.next/static
COPY --from=frontend-build /frontend/public /app/frontend/public

# Copy add-on files from add-on root
COPY run.sh /
COPY rootfs /

RUN chmod +x /run.sh && \
    chmod +x /etc/services.d/backend/run && \
    chmod +x /etc/services.d/frontend/run

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD curl -f http://localhost:3000/ || exit 1

EXPOSE 3000

ENV ADDON_VERSION="${BUILD_VERSION}"

LABEL \
    io.hass.name="SFPLiberate" \
    io.hass.description="Bluetooth companion for Ubiquiti SFP Wizard" \
    io.hass.arch="aarch64|amd64|armhf|armv7" \
    io.hass.type="addon" \
    io.hass.version="${BUILD_VERSION}" \
    maintainer="Josiah Nelson <https://github.com/josiah-nelson>" \
    org.opencontainers.image.title="SFPLiberate" \
    org.opencontainers.image.description="Bluetooth companion for Ubiquiti SFP Wizard" \
    org.opencontainers.image.vendor="SFPLiberate" \
    org.opencontainers.image.authors="Josiah Nelson" \
    org.opencontainers.image.licenses="MIT" \
    org.opencontainers.image.url="https://github.com/Jammingway/SFPLiberate" \
    org.opencontainers.image.source="https://github.com/Jammingway/SFPLiberate" \
    org.opencontainers.image.documentation="https://github.com/Jammingway/SFPLiberate/blob/main/docs/HOME_ASSISTANT.md" \
    org.opencontainers.image.version="${BUILD_VERSION}"

CMD ["/run.sh"]
