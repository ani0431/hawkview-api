# HawkView — Cursor agent prompt templates
# Copy-paste these into Cursor chat when starting a task. Be specific, get better results.
#
# Phase 1 is complete: refresh tokens, rate limiting (100/min default, 10/min
# on login/register), and Swagger at /docs are all shipped. The "Prisma schema
# missing url" item was a false positive — Prisma 7 keeps the URL in
# apps/api/prisma.config.ts, not in schema.prisma.

---

## Phase 2: Microsoft OAuth URL endpoint

```
Build the Microsoft OAuth redirect URL endpoint (phase 2, step 1 of 4):

Goal: GET /microsoft/auth/url returns a URL the MSP admin visits to grant consent.

Steps:
1. Add env vars to env.validation.ts: AZURE_CLIENT_ID, AZURE_CLIENT_SECRET, AZURE_REDIRECT_URI
2. Generate a random state param, store it in a signed short-lived cookie (oauth_state, 10 min)
3. Build the Azure consent URL:
   https://login.microsoftonline.com/common/adminconsent
   ?client_id={AZURE_CLIENT_ID}
   &redirect_uri={AZURE_REDIRECT_URI}
   &state={state}
4. Return { success: true, data: { url } }
5. Protect endpoint with JwtAuthGuard
6. Add unit test for URL generation
7. Build must pass
```

---

## Phase 2: OAuth callback + token storage

```
Build the Microsoft OAuth callback handler (phase 2, step 2 of 4):

Prerequisite: Tenant model must be in schema. Add if not present:
  - id, displayName, microsoftTenantId, userId, accessToken (encrypted),
    refreshToken (encrypted), tokenExpiresAt, scopes, connectedAt, isActive

Steps:
1. Create common/utils/crypto.util.ts with encrypt(text) and decrypt(text) using AES-256-GCM
   Key = env var ENCRYPTION_KEY (32-byte hex). Add to env.validation.ts.
2. GET /microsoft/auth/callback receives: code, state, tenant (from Microsoft)
3. Verify state cookie matches — throw OAUTH_STATE_MISMATCH if not
4. Exchange code for tokens via POST to:
   https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token
5. Encrypt access + refresh tokens before saving to DB
6. Create Tenant record scoped to req.user.id
7. Return { success: true, data: { tenantId } }
8. Handle TENANT_ALREADY_CONNECTED if microsoftTenantId exists for this user
9. Unit test: crypto util encrypt/decrypt roundtrip
10. Run migration + prisma generate
```

---

## Phase 2: Tenant CRUD endpoints

```
Build tenant management endpoints (phase 2, step 3 of 4):

All endpoints require JwtAuthGuard. All DB queries must scope by userId.

Endpoints:
- GET    /tenants          → list user's tenants (id, displayName, isActive, connectedAt only — no tokens)
- GET    /tenants/:id      → single tenant (same fields)
- DELETE /tenants/:id      → set isActive=false, revoke MS token if possible
- GET    /tenants/:id/status → call Graph API to verify token still works
                               return { valid: true } or { valid: false, reason }

Rules:
- Never return accessToken or refreshToken fields in any response
- Use tenant-response.dto.ts to enforce safe field selection
- For /status: call https://graph.microsoft.com/v1.0/organization via GraphService
  If 401 → attempt token refresh → if still fails → TENANT_AUTH_EXPIRED
- Add unit tests for tenants.service.ts with mocked PrismaService
- Build must pass
```

---

## Start a new session after a break

```
I'm returning to work on HawkView backend after some time away.

Current state: [briefly describe what was last completed, e.g. "phase 1 auth is done, 
refresh tokens are implemented, now starting phase 2 Microsoft OAuth"]

Before continuing:
1. Run setup checks (pnpm install, docker up, health endpoint)
2. Run pnpm --filter api test to confirm nothing is broken
3. Run pnpm --filter api build
4. Tell me current pass/fail status before doing anything else

Then we'll proceed with: [next task]
```

---

## Debug a failing test or build

```
The build/tests are failing. Before fixing anything:

1. Run pnpm --filter api build and show me the full error output
2. Run pnpm --filter api test and show me which tests fail and why
3. Do not guess — read the actual error messages
4. Diagnose the root cause
5. Propose a fix and explain it before making any changes
6. Make the minimal change needed to fix it
7. Re-run build + tests to confirm fixed
```

---

## Tips for autonomous Cursor sessions

- Always include "build must pass" and "tests must pass" in your prompt
- One concern per prompt — don't ask for two features at once
- Say "do not change anything outside [module]" to prevent scope creep
- End prompts with "summarise what you changed and what is still TODO"
- If Cursor gets stuck in a loop, start a new chat and paste the relevant file contents fresh