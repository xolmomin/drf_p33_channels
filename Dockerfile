FROM ghcr.io/astral-sh/uv:python3.13-alpine

WORKDIR /app

COPY . .
RUN uv sync

EXPOSE 8000 8001
