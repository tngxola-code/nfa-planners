# NFA Planners — Opportunity-Intelligence Console

Internal console for NFA Planners that turns South African public tender data into
actionable opportunities:

- **OCDS eTenders ingestion** — pulls releases from the eTenders OCDS API
  (`ETENDERS_OCDS_BASE_URL`, defaults to `https://ocds-api.etenders.gov.za`) and
  normalises them into an internal opportunity model.
- **Capability matching** — scores each opportunity against NFA's capability
  categories (Town Planning, Spatial Planning, GIS, Surveying, Infrastructure,
  Human Settlements) so low-fit releases are dropped early.
- **Email digests** — sends matching-opportunity digests via [Resend](https://resend.com).
- **Console UI** — protected internal console (single env-configured user) with a
  dashboard, opportunity list/detail views, and a notification centre.

## Tech stack

Single Next.js app (App Router, TypeScript, Tailwind CSS) with a `src/` layout at the
repo root. Persistence is JSON files under `data/` (no database).

## Persistence

`data/opportunities.json` and `data/notifications.json` are committed as empty
arrays so fresh clones work out of the box, and are then **mutated at runtime**
by the ingest/notification pipeline (atomic tmp-file + rename writes, serialised
in-process). Treat local diffs to `data/*.json` as runtime state, not source —
don't commit them unless you intend to seed data. This is a deliberate
single-user choice; Postgres replaces it once a second user or a console write
path exists. Set `NFA_DATA_DIR` to point the repositories at another directory
(useful for tests and local experiments).

## Getting started

```bash
cp .env.example .env.local   # fill in values
npm install
npm run dev
```

The root path redirects to `/console` (auth + console shell land in later PRs).

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run lint` | `next lint` (eslint `next/core-web-vitals`) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run test:smoke` | Dependency-light offline smoke tests (`scripts/smoke/`) |

## Environment

See `.env.example` for all variables: console auth (`CONSOLE_AUTH_EMAIL`,
`CONSOLE_AUTH_PASSWORD_HASH`, `CONSOLE_SESSION_SECRET`), email (`RESEND_API_KEY`,
`EMAIL_FROM`), and ingestion (`ETENDERS_OCDS_BASE_URL`).

## Development process

This repo is delivered as a stack of small, stacked PRs (see PR-PLAN). CI runs
typecheck, smoke tests, and build as required checks; AI review workflows run
advisory-only on every PR.
