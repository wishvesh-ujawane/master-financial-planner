# Master Financial Planner

A privacy‑first personal finance planning application. It helps you map your
net worth, cash flow, investments and life goals — then projects what it takes
to reach those goals using inflation, SIP step‑up and per‑asset‑class return
assumptions. All of your data stays in your browser; nothing is transmitted to a
server.

The repository is a **pnpm monorepo** that also ships a typed API stack
(OpenAPI → Orval → Express + Drizzle) that the planner can be wired into.

---

## Table of contents

- [Features](#features)
- [Repository layout](#repository-layout)
- [Modules](#modules)
- [Tech stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Getting started](#getting-started)
- [Running the apps](#running-the-apps)
- [Scripts reference](#scripts-reference)
- [Environment variables](#environment-variables)
- [API code generation workflow](#api-code-generation-workflow)
- [Data, storage & privacy](#data-storage--privacy)
- [Cross‑platform / Windows notes](#cross-platform--windows-notes)

---

## Features

The planner (`@workspace/master-financial-planner`) is a single‑page React app
organised into these pages:

| Page | What it does |
| --- | --- |
| **Overview** | Snapshot of net worth, cash flow and goal progress. |
| **Assumptions** | Editable expected returns (short / medium / long term) and target allocation per asset class. |
| **Cash flow** | Monthly income (inflows) vs. expenses (outflows), split Essential / Flexible. |
| **Net worth** | Assets and liabilities, with outstanding balances. |
| **Investments** | Holdings by category with current value, amount contributed, monthly SIP and notes. |
| **Goals** | Goal planning with years to go, today's target, inflation, annual SIP step‑up and required monthly SIP. |
| **Privacy & backup** | Export / import a JSON backup, restore sample data, review storage status. |

Highlights:

- India‑first defaults (₹, SGB / PPF / EPF, SIP step‑up, goal inflation).
- Inline tooltips on every input explaining what the field means and what value to enter.
- Goal maths that inflate today's target and account for an annual SIP step‑up.
- Schema‑validated JSON import/export for portable backups.
- Entirely client‑side — works offline, no account required.

---

## Repository layout

```
master-financial-planner/
├─ artifacts/                     # Runnable apps
│  ├─ master-financial-planner/   # The React planner SPA (Vite)
│  ├─ api-server/                 # Express 5 API server
│  └─ mockup-sandbox/             # Vite sandbox for UI mockups / previews
├─ lib/                           # Shared, reusable packages
│  ├─ api-spec/                   # OpenAPI spec + Orval codegen config
│  ├─ api-zod/                    # Generated Zod schemas / types
│  ├─ api-client-react/           # Generated React Query API client
│  └─ db/                         # Drizzle ORM schema + Postgres client
├─ scripts/                       # Workspace maintenance scripts
├─ pnpm-workspace.yaml            # Workspace + dependency catalog + overrides
├─ tsconfig*.json                 # Shared TypeScript project references
└─ replit.md                      # Operator notes
```

---

## Modules

### Applications (`artifacts/`)

- **`@workspace/master-financial-planner`** — The user‑facing planner.
  React 19 + Vite 7 + Tailwind CSS 4, `wouter` for routing, `recharts` for
  charts, Radix UI primitives for components. State lives in
  [`src/lib/planner-store.ts`](artifacts/master-financial-planner/src/lib/planner-store.ts)
  and persists to `localStorage`. Main UI is in
  [`src/App.tsx`](artifacts/master-financial-planner/src/App.tsx).

- **`@workspace/api-server`** — Express 5 API. Entry point
  [`src/index.ts`](artifacts/api-server/src/index.ts) reads `PORT` and starts the
  app defined in [`src/app.ts`](artifacts/api-server/src/app.ts) (CORS, JSON body
  parsing, `pino-http` logging). Routes are mounted under `/api` from
  [`src/routes/index.ts`](artifacts/api-server/src/routes/index.ts) (currently a
  `/api/healthz` health check). Bundled to a single CJS file with esbuild via
  [`build.mjs`](artifacts/api-server/build.mjs).

- **`@workspace/mockup-sandbox`** — A Vite playground for building and previewing
  UI mockups in isolation, sharing the same component library.

### Shared libraries (`lib/`)

- **`@workspace/api-spec`** — Source of truth for the HTTP contract:
  [`openapi.yaml`](lib/api-spec/openapi.yaml). Running codegen uses
  [`orval.config.ts`](lib/api-spec/orval.config.ts) to generate the client and
  Zod packages below. **Do not rename the OpenAPI `info.title`** — import paths
  depend on it.

- **`@workspace/api-client-react`** — Generated typed React Query hooks and a
  configurable fetch wrapper
  ([`custom-fetch.ts`](lib/api-client-react/src/custom-fetch.ts)) exposing
  `setBaseUrl` and `setAuthTokenGetter`. Consumed by the planner app.

- **`@workspace/api-zod`** — Generated Zod schemas and types for request/response
  validation, shared between server and clients.

- **`@workspace/db`** — Drizzle ORM setup over PostgreSQL.
  [`src/index.ts`](lib/db/src/index.ts) creates the `pg` pool and `db` client
  (requires `DATABASE_URL`); table models go in
  [`src/schema/`](lib/db/src/schema/index.ts). Schema is pushed with
  `drizzle-kit`.

### Tooling (`scripts/`)

- **`@workspace/scripts`** — Workspace utility scripts (e.g. `post-merge` hooks),
  run with `tsx`.

---

## Tech stack

- **Runtime / tooling:** Node.js 24, TypeScript 5.9, pnpm workspaces
- **Frontend:** React 19, Vite 7, Tailwind CSS 4, Radix UI, `wouter`, `recharts`,
  `react-hook-form`, TanStack React Query
- **Backend:** Express 5, `pino` / `pino-http` logging, esbuild bundling
- **Database:** PostgreSQL + Drizzle ORM (`drizzle-kit`, `drizzle-zod`)
- **Validation:** Zod (`zod/v4`)
- **API codegen:** OpenAPI 3.1 → Orval → React Query client + Zod schemas

---

## Prerequisites

- **Node.js 24+**
- **pnpm** (this repo enforces pnpm; npm/yarn are blocked by a `preinstall` guard)
- **PostgreSQL** — only required if you run the API server / database module

---

## Getting started

```powershell
# Install all workspace dependencies
pnpm install
```

> A minimum‑release‑age supply‑chain guard (`minimumReleaseAge: 1440`) is enabled
> in `pnpm-workspace.yaml`. Do not disable it.

---

## Running the apps

### Planner (frontend)

The planner's Vite config requires `PORT` and `BASE_PATH` environment variables.

```powershell
$env:PORT="5173"; $env:BASE_PATH="/"; pnpm --filter @workspace/master-financial-planner run dev
```

Then open <http://localhost:5173/>.

### API server

Requires `DATABASE_URL` and `PORT`.

```powershell
$env:PORT="5000"; $env:DATABASE_URL="postgres://user:pass@localhost:5432/db"; pnpm --filter @workspace/api-server run dev
```

Health check: `GET http://localhost:5000/api/healthz`.

### Mockup sandbox

```powershell
pnpm --filter @workspace/mockup-sandbox run dev
```

---

## Scripts reference

Run from the repository root.

| Command | Description |
| --- | --- |
| `pnpm install` | Install all workspace dependencies. |
| `pnpm run typecheck` | Typecheck every package. |
| `pnpm run build` | Typecheck, then build all packages. |
| `pnpm --filter @workspace/master-financial-planner run dev` | Start the planner dev server (needs `PORT`, `BASE_PATH`). |
| `pnpm --filter @workspace/master-financial-planner run build` | Production build of the planner. |
| `pnpm --filter @workspace/master-financial-planner run serve` | Preview the built planner. |
| `pnpm --filter @workspace/api-server run dev` | Build and run the API server (needs `PORT`, `DATABASE_URL`). |
| `pnpm --filter @workspace/mockup-sandbox run dev` | Start the mockup sandbox. |
| `pnpm --filter @workspace/api-spec run codegen` | Regenerate the API client and Zod schemas from the OpenAPI spec. |
| `pnpm --filter @workspace/db run push` | Push Drizzle schema changes to the database (dev). |
| `pnpm --filter @workspace/db run push-force` | Force‑push schema changes (destructive). |

---

## Environment variables

| Variable | Used by | Required | Notes |
| --- | --- | --- | --- |
| `PORT` | planner, api-server | Yes | Port to bind the dev server / API. |
| `BASE_PATH` | planner | Yes | Base path for the app (use `/` for local dev). |
| `DATABASE_URL` | api-server, db | Yes (for DB) | Postgres connection string. |

---

## API code generation workflow

The HTTP contract is defined once in [`lib/api-spec/openapi.yaml`](lib/api-spec/openapi.yaml).
After editing the spec, regenerate the typed client and schemas:

```powershell
pnpm --filter @workspace/api-spec run codegen
```

This runs Orval and then typechecks the libraries, updating:

- `@workspace/api-client-react` — React Query hooks + fetch wrapper
- `@workspace/api-zod` — Zod schemas and types

> Keep the OpenAPI `info.title` as `Api` — generated import paths depend on it.

---

## Data, storage & privacy

- The planner stores everything in the browser's `localStorage`
  (key `goodmeasure-plan-v2`, with migration from a legacy key). No personal
  finance data leaves the device.
- Use **Privacy & backup → Export JSON** to take a portable backup; **Choose
  file** validates the schema before replacing your current plan.
- Clearing browser storage or switching browser profiles can hide or remove your
  notebook — export backups periodically.

---

## Cross‑platform / Windows notes

The workspace was originally configured for a Linux (Replit) environment, and
`pnpm-workspace.yaml` `overrides` strip native binaries for other platforms. The
`win32-x64` binaries for `esbuild`, `rollup`, `lightningcss` and
`@tailwindcss/oxide` are enabled so the project installs and runs on Windows x64.
If you develop on a different platform (macOS / ARM), you may need to re‑enable
the matching native binaries in that `overrides` block.
