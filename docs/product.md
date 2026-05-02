# HawkView - Product Overview

## What is HawkView?

HawkView is a SaaS platform for Managed Service Providers (MSPs) to monitor and analyze Microsoft 365 tenants.

It connects to customer tenants, scans security posture, and provides actionable insights.

---

## Core Goals

- Give MSPs visibility across multiple tenants
- Identify security risks (MFA gaps, risky users, misconfigurations)
- Provide simple dashboards and reports
- Extend Microsoft’s limited visibility with better summaries

---

## Key Features (V1)

1. User authentication (HawkView login)
2. Connect Microsoft tenant (OAuth)
3. List connected tenants
4. Tenant overview dashboard
5. MFA coverage reporting
6. Basic audit insights

---

## Future Features

- Conditional Access analysis
- Risk scoring
- Alerting
- Historical tracking
- Long-term log storage
- Multi-org support

---

## Architecture Direction

- Backend: NestJS + PostgreSQL + Prisma
- Frontend: Next.js
- Auth: JWT (cookies)
- Microsoft: Graph API + OAuth
- Data strategy: sync + store snapshots (not live calls everywhere)

---

## Key Design Principles

- Simple APIs over complex abstractions
- Performance through caching/snapshots
- Security-first (least privilege)
- Multi-tenant safe design
- Clear separation: Microsoft integration vs internal data