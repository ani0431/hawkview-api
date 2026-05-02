# HawkView API Contract (V1)

## Base URL
http://localhost:3000

## Authentication Model
HawkView uses cookie-based authentication.

Cookie:
- Name: access_token
- Type: httpOnly

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

POST /auth/logout
Response:
{
  "success": true,
  "data": {
    "loggedOut": true
  }
}

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
