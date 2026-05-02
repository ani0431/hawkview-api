# HawkView API Contract (V1)

## Base URL
http://localhost:3000

## Authentication Model
HawkView uses cookie-based authentication with short-lived access tokens and rotating refresh tokens.

Cookies (both httpOnly, sameSite=lax, secure in production):
- access_token — signed JWT, 15-minute TTL, path `/`
- refresh_token — opaque random token (SHA-256 hash stored in DB), 7-day TTL, path `/auth`

Refresh tokens are single-session per user: logging in on a new device invalidates the previous refresh token. Each call to `POST /auth/refresh` rotates the refresh token (new opaque value, new DB hash, new access token).

## Standard Success Response
{
  "success": true,
  "data": {}
}

## Standard Error Response
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Readable error message"
  }
}

## HEALTH
GET /health

Response:
{
  "success": true,
  "data": {
    "status": "ok",
    "database": "connected",
    "timestamp": "ISO"
  }
}

## AUTH

POST /auth/register
Request:
{
  "email": "user@example.com",
  "password": "password123"
}

Response:
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "role": "admin"
    }
  }
}

POST /auth/login
Request:
{
  "email": "user@example.com",
  "password": "password123"
}

Response:
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "role": "admin"
    }
  }
}

GET /auth/me
Response:
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "role": "admin"
    }
  }
}

POST /auth/refresh
Request: no body. Must include the `refresh_token` cookie set by login/register/refresh.

Response:
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "role": "admin"
    }
  }
}

On success, new `access_token` and `refresh_token` cookies are set (old refresh token is invalidated).

Errors:
- 401 INVALID_REFRESH_TOKEN — refresh cookie is missing, unknown, or expired.

POST /auth/logout
Request: no body.

Response:
{
  "success": true,
  "data": {
    "loggedOut": true
  }
}

Logout is idempotent. If a `refresh_token` cookie is present, its DB record is deleted. Both cookies are cleared on the response.

## TENANTS

GET /tenants
Response:
{
  "success": true,
  "data": {
    "tenants": []
  }
}

GET /tenants/:id
Response:
{
  "success": true,
  "data": {
    "tenant": {}
  }
}

GET /tenants/:id/summary
Response:
{
  "success": true,
  "data": {
    "tenant": {},
    "summary": {}
  }
}

## MICROSOFT

GET /auth/microsoft
Redirect endpoint

GET /auth/microsoft/callback
Handles OAuth callback
