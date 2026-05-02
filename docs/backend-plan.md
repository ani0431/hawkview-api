# HawkView Backend Plan
This project is aimed to design the backend for product.md

## Current Status
- NestJS running
- Postgres + Prisma when Docker DB is up
- Health endpoint working
- Auth with short-lived access JWT + DB-backed rotating refresh token (single-session), plus `/auth/refresh`
- Global rate limiter (100/min default, 10/min on login/register) and Swagger UI at `/docs`

---

## Completed
- Bootstrap
- Database setup
- Prisma integration
- Health check
- **Auth (V1 contract)** — `POST /auth/register`, `POST /auth/login`, `GET /auth/me`, `POST /auth/refresh`, `POST /auth/logout`; 15-min access JWT + 7-day opaque refresh token (SHA-256 hash in DB, rotation on use, single-session); bcrypt password hashing; validation + API error envelope.
- **Rate limiting** — `ThrottlerModule` registered globally via `APP_GUARD`; 100 req/min default, 10 req/min on `/auth/login` and `/auth/register`; 429 is mapped to `RATE_LIMITED` by the global exception filter.
- **Swagger** — `SwaggerModule` wired in `main.ts`; UI at `GET /docs`, JSON at `GET /docs-json`; cookie auth scheme registered; DTOs and controllers annotated with `@Api*` decorators.

### What changed (this milestone)
- Prisma schema: added `RefreshToken` model (1:0..1 with `User`, `userId` unique, SHA-256 `tokenHash`, `expiresAt`). Migration: `add_refresh_tokens`. Note: the original "add `url = env(\"DATABASE_URL\")` to `datasource`" review item does NOT apply to Prisma 7 — Prisma 7 rejects `url` in schema files (`P1012`) and expects connection config in `prisma.config.ts`, which is where it already lives. No schema URL change needed.
- `JwtModule` now reads `JWT_ACCESS_TTL` (default `15m`) via `ConfigService`.
- New env vars: `JWT_ACCESS_TTL`, `REFRESH_TOKEN_TTL_DAYS` (validated, optional with defaults).
- `AuthService`: added `issueRefreshToken`, `rotateRefreshToken`, `revokeRefreshToken`, `revokeRefreshTokenByRaw`, `getRefreshCookieMaxAgeMs`.
- `AuthController`: injects `ConfigService` (no more `process.env`), sets both cookies on register/login, adds `POST /auth/refresh`, logout resolves user via refresh cookie and deletes the DB row. `@Throttle({ default: { limit: 10, ttl: 60_000 } })` on login/register.
- `AppModule`: `ThrottlerModule.forRoot` (100/min default), `ThrottlerGuard` bound via `APP_GUARD`.
- `ApiExceptionFilter`: maps HTTP 429 to `code: RATE_LIMITED` with a clean message.
- `main.ts`: Swagger set up with `DocumentBuilder` (cookie auth scheme), mounted at `/docs`.
- New deps: `@nestjs/swagger`, `@nestjs/throttler`.
- Updated `docs/api-contract.md` with Swagger URL, rate limit policy, `/auth/refresh` details, dual-cookie auth model.

### Next step
- Users module (align with product needs; keep controllers thin).

---

## Next Milestones

### 1. Users module

### 2. Tenants model

### 3. Microsoft OAuth

### 4. Graph integration

---

## Commands

```bash
pnpm install
pnpm start:dev
pnpm exec prisma migrate dev
```

---

## Planning Rules (MANDATORY)

Before making ANY change:
- Read docs/backend-plan.md
- Identify current milestone
- Confirm next task

After completing ANY task:
- Update docs/backend-plan.md with:
  - what was completed
  - what changed
  - next step

Never skip this.


---

## Context Awareness Rules

Before coding:
- Read docs/product.md
- Read docs/api-contract.md
- Read docs/backend-plan.md

Do not invent behavior outside these files.
If something is missing, propose an update first.

## API Discipline Rule

Never create or modify an endpoint unless it matches docs/api-contract.md.

If something is missing:
- propose contract change first
- then implement

Do not invent endpoints.