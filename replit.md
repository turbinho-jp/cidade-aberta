# Cidade Aberta

Plataforma pública de participação cidadã, transparência municipal e gestão de demandas urbanas.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080, serves at /api)
- `pnpm --filter @workspace/cidade-aberta run dev` — run the frontend (port 21533, serves at /)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string, `SESSION_SECRET` — cookie signing secret

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite, Wouter router, TailwindCSS, Shadcn UI, react-leaflet (map), recharts (charts)
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Auth: Cookie-based sessions (sha256 hash, signed cookies)
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `lib/api-spec/openapi.yaml` — OpenAPI spec (source of truth for all API contracts)
- `lib/db/src/schema/` — DB schema files (one file per entity)
- `artifacts/api-server/src/routes/` — Express route handlers
- `artifacts/cidade-aberta/src/` — React frontend
- `artifacts/cidade-aberta/src/pages/` — Page components
- `artifacts/cidade-aberta/src/contexts/` — Auth context

## Architecture decisions

- Cookie-based auth with sha256 + salt (no bcrypt or JWT to keep it simple for first build)
- All demands, timeline, comments, and service orders are fully public (no auth required to read)
- Activity log table captures all significant events for the public feed
- Neighborhood/category demand counts are maintained via trigger-style updates on write
- Leaflet (OpenStreetMap) for maps — no API key needed

## Product

Citizens can register problems in their neighborhood, confirm they also experience the same issue, comment on demands, and follow the public timeline as the city responds. Secretaries and admins can triage, create service orders, assign teams, and update statuses publicly. The dashboard shows live city health metrics. The map shows all demands with colored pins by status.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- After any OpenAPI spec change, always run codegen before touching frontend or backend
- `react-leaflet` and `leaflet` must be installed in cidade-aberta package (not in workspace root)
- The 401 from `/api/auth/me` on page load is expected for unauthenticated users

## Seed accounts

- Admin: `admin@cidadeaberta.gov.br` / `senha123`
- Secretary: `infra@prefeitura.gov.br` / `senha123`
- Citizens: `maria@email.com`, `joao@email.com`, `ana@email.com`, `carlos@email.com` / `senha123`

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
