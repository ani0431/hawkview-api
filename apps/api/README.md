# HawkView API

NestJS backend for HawkView. Connects Microsoft 365 tenants via Graph API and surfaces security posture findings for MSPs.

## Stack
- NestJS 11
- PostgreSQL (Docker) + Prisma 7
- pnpm workspace
- Jest for tests
- JWT in httpOnly cookies (15-min access + 7-day rotating refresh)
- Swagger UI at `/docs`
- Rate limiting via `@nestjs/throttler` (100 req/min default, 10 req/min on `/auth/login` and `/auth/register`)

## Quick start

```bash
# from repo root
pnpm install
docker compose -f apps/api/docker-compose.yml up -d   # starts hawkview_postgres
pnpm --filter api exec prisma migrate deploy
pnpm --filter api exec prisma generate
pnpm --filter api start:dev
```

Health check:
```bash
curl http://localhost:3000/health
```

Swagger UI: http://localhost:3000/docs

## Environment

Copy and set these in `apps/api/.env`:

| Variable | Required | Default | Notes |
|---|---|---|---|
| `DATABASE_URL` | yes | — | Postgres connection string. Read by `prisma.config.ts`; do not put `url` in `schema.prisma` (Prisma 7 rejects it with P1012). |
| `JWT_SECRET` | yes | — | Signing key for access JWTs. |
| `NODE_ENV` | no | `development` | Sets cookie `secure` flag when `production`. |
| `PORT` | no | `3000` | |
| `JWT_ACCESS_TTL` | no | `15m` | Duration string (`15m`, `1h`, `30s`). |
| `REFRESH_TOKEN_TTL_DAYS` | no | `7` | 1–90. |

## Scripts

```bash
pnpm --filter api start:dev       # watch mode
pnpm --filter api build           # tsc via nest build
pnpm --filter api test            # jest unit tests
pnpm --filter api test:e2e        # jest e2e (supertest)
pnpm --filter api exec prisma migrate dev --name <desc>
pnpm --filter api exec prisma generate
pnpm --filter api exec prisma studio
```

## Architecture

- Feature-based modules under `src/` (`auth`, `users`, `tenants`, `microsoft`, `health`).
- Controllers stay thin — validation + delegation. Business logic lives in services.
- Only services touch Prisma. `PrismaModule` is `@Global`.
- All responses follow `{ success, data }` / `{ success: false, error: { code, message } }`.
- Global `ApiExceptionFilter` maps every `HttpException` to this envelope.
- See `docs/api-contract.md` for the full endpoint contract and `.cursor/rules/backend.mdc` for conventions.

## Auth model

- `POST /auth/register` — creates user, sets both cookies.
- `POST /auth/login` — validates credentials, sets both cookies. Single-session: logging in on another device invalidates the previous refresh token.
- `GET  /auth/me` — returns the current user (requires `access_token`).
- `POST /auth/refresh` — rotates the refresh token (new opaque value, new DB hash, new `access_token`).
- `POST /auth/logout` — deletes the refresh token row and clears both cookies.

Cookies are `httpOnly`, `sameSite=lax`, and `secure` in production. Only SHA-256 hashes of refresh tokens are ever written to the database.

## Project layout

```
apps/api/
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── prisma.config.ts           # DATABASE_URL wiring (Prisma 7)
├── src/
│   ├── main.ts                # bootstrap, Swagger, filters
│   ├── app.module.ts          # ThrottlerModule + feature modules
│   ├── auth/                  # auth.{controller,service,module}, dto/, guards/, strategies/
│   ├── health/
│   ├── prisma/                # PrismaService (global)
│   ├── users/ tenants/ microsoft/
│   ├── common/                # filters, guards, decorators, utils
│   └── config/                # app.config.ts + env.validation.ts
└── test/                      # e2e specs
```

## License

UNLICENSED — internal HawkView project.
