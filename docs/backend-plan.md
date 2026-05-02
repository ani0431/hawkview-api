# HawkView Backend Plan
This project is aimed to design the backend for product.md

## Current Status
- NestJS running
- Postgres + Prisma when Docker DB is up
- Health endpoint working
- Auth (register, login, me, logout) with httpOnly `access_token` cookie and contract-shaped JSON

---

## Completed
- Bootstrap
- Database setup
- Prisma integration
- Health check
- **Auth (V1 contract)** — `POST /auth/register`, `POST /auth/login`, `GET /auth/me`, `POST /auth/logout`; JWT in cookie; bcrypt password hashing; validation + API error envelope (`success` / `error.code` / `error.message`)

### What changed (this milestone)
- Added `JWT_SECRET` to required env (see `apps/api/.env`).
- Global `ValidationPipe` (whitelist), `cookie-parser`, and `ApiExceptionFilter` for standard error responses.
- Jest: `moduleNameMapper` so `.js` Prisma import paths resolve in tests.

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