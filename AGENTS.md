# HawkView Backend Agent Guide

## Mission
Build and maintain the HawkView backend using NestJS, PostgreSQL, and Prisma.
Focus on fast, safe, testable progress.

---

## Stack
- NestJS
- PostgreSQL (Docker)
- Prisma
- pnpm
- REST API (V1)
- JWT (httpOnly cookies)
- Jest (testing)

---

## Architecture Rules
- Feature-based modules
- Controllers = thin
- Services = business logic
- Prisma only inside services
- Do not break working code

---

## Required Workflow (MANDATORY)

For every task:

1. Run setup checks
2. Fix setup if broken
3. Plan before coding
4. Implement ONE milestone
5. Add tests
6. Run:
   - build
   - tests
7. Summarize changes

---

## Setup Checks

Always verify:

- pnpm install works
- .env exists
- Docker is running
- DB container is running
- Prisma connects
- migrations valid
- app starts
- /health works

If anything fails:
- diagnose
- fix if safe
- explain

---

## Definition of Done

A task is NOT complete unless:

- builds successfully
- tests pass
- no broken imports
- migrations applied (if schema changed)
- prisma generated if needed
- endpoint works

---

## Backend Milestones

1. bootstrap & DX
2. auth + users
3. tenants
4. Microsoft OAuth
5. Graph API integration
6. findings/reporting
7. background jobs
8. audit/security

---

## Coding Rules

- small changes only
- no massive refactors
- keep modules isolated
- avoid placeholder logic

---

## Testing Rules

- test services where possible
- test critical endpoints
- if skipping tests → explain why

---

## PR Rules

If asked:

- create branch
- commit cleanly
- run tests
- open PR

If PR fails:
- output PR title + body

---

## Commit Format

feat:
fix:
refactor:
test:
chore: