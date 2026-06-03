# MesaFácil

A guest management and event check-in system for organizing seating arrangements and managing event attendees.

## Run & Operate

- `PORT=5000 BASE_PATH=/ pnpm --filter @workspace/mesa-facil run dev` — run the frontend (port 5000)
- `PORT=8080 pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React 19, Vite 7, Tailwind CSS 4, Wouter (routing), TanStack Query, Radix UI
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle for server), Vite (frontend)

## Where things live

- `artifacts/mesa-facil/` — React frontend (Vite)
- `artifacts/api-server/` — Express API server
- `lib/db/` — Drizzle ORM schema & DB client (source of truth for DB schema)
- `lib/api-spec/openapi.yaml` — OpenAPI spec (source of truth for API contract)
- `lib/api-client-react/` — Generated React hooks (via Orval)
- `lib/api-zod/` — Generated Zod schemas (via Orval)

## Architecture decisions

- Frontend runs on port 5000 (webview), API runs on port 8080; Vite dev server proxies `/api` → `localhost:8080`
- API client uses relative `/api` paths — no base URL config needed in web builds
- `BASE_PATH` and `PORT` env vars are required by the Vite config at startup
- Drizzle schema is pushed via `drizzle-kit push` (not migrations) in development

## Product

MesaFácil lets organizers create events, manage guest lists, arrange floor items (tables, chairs), and run check-in flows for attendees.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Always set `PORT` and `BASE_PATH` env vars when running the frontend dev server
- Frontend proxies `/api/*` to `localhost:8080` — both services must be running for full functionality
- Run `pnpm --filter @workspace/api-spec run codegen` after changing `openapi.yaml` to regenerate hooks/schemas

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
