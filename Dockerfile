# Stage 1: Build Frontend Assets
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm install

COPY frontend/ ./
ARG VITE_MAPBOX_ACCESS_TOKEN
ENV VITE_MAPBOX_ACCESS_TOKEN=${VITE_MAPBOX_ACCESS_TOKEN:-pk.eyJ1IjoiZGVlcGFua2FycyIsImEiOiJjbXdxcmljZXAwYnAwMnlzZXA4dDcxejNzIn0.4WWz38CQw1YbErk1WaIT2w}
ENV VITE_API_BASE_URL=/api

RUN npm run build

# Stage 2: Python Backend with Gunicorn
FROM python:3.11-slim
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

# Install Python dependencies
COPY backend/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copy Backend Source
COPY backend/ /app/

# Copy built frontend assets
COPY --from=frontend-builder /app/frontend/dist /app/frontend_dist/
COPY --from=frontend-builder /app/frontend/dist /app/staticfiles/

EXPOSE 8000

CMD ["sh", "-c", "python manage.py migrate && gunicorn config.wsgi:application --bind 0.0.0.0:${PORT:-8000}"]
