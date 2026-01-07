# webFianlBackend

Go + Gin + MariaDB simple IRC-style chat backend with a Vite React frontend.

## Quick start (Docker)

Requirements:
- Docker + Docker Compose

From the project root:

```bash
docker compose up --build
```

Open:
- Frontend: http://localhost:5173
- Backend: http://localhost:8080

## Local dev (without Docker)

Requirements:
- Go 1.21+
- Node.js 20+
- MariaDB/MySQL

1) Start DB and create database:
```sql
CREATE DATABASE IF NOT EXISTS irc
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;
```

2) Create user (example):
```sql
CREATE USER IF NOT EXISTS 'irc_user'@'localhost' IDENTIFIED BY 'irc_pass';
GRANT ALL PRIVILEGES ON irc.* TO 'irc_user'@'localhost';
FLUSH PRIVILEGES;
```

3) Backend env:
```bash
export DB_DSN="irc_user:irc_pass@tcp(127.0.0.1:3306)/irc?charset=utf8mb4&parseTime=True&loc=Local"
export JWT_SECRET="change-this"
export ADDR=":8080"
export CORS_ORIGINS="http://localhost:5173"
```

4) Run backend:
```bash
go run ./cmd/server
```

5) Run frontend:
```bash
cd webFianalFrontend
npm install
npm run dev
```

## Features

- Register / Login
- Create / list own channels
- Search and join channels by `owner@channel`
- WebSocket chat per channel
- Profile edit + delete account

## API (JSON)

Base: `/api`

Auth:
- `POST /api/register` { name, email, password }
- `POST /api/login` { name or email, password }
- `POST /api/logout`
- `GET /api/me`
- `PUT /api/me` { name?, email?, password? }
- `DELETE /api/me`

Channels:
- `GET /api/channels` (owned)
- `GET /api/channels/joined`
- `POST /api/channels` { name }
- `GET /api/channels/search?query=userA@test`
- `POST /api/channels/:id/join`
- `GET /api/channels/:id/members`
- `DELETE /api/channels/:id`

WebSocket:
- `GET /ws/:id`

## Notes

- Auth uses HttpOnly cookie (JWT). If you use a different frontend origin, keep CORS and cookies in sync.
- For local dev, Vite proxy is configured in `webFianalFrontend/vite.config.ts`.
