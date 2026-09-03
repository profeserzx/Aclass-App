# Aclass — Base44 Dev Environment

## What this is
A Next.js 14 school management app (Aclass) with Drizzle ORM, JWT auth, and
optional integrations for Gmail (email), Africa's Talking (SMS), and M-Pesa
(Safaricom Daraja) payments.

## How it runs here
- `docker-compose.base44.yml` brings up Postgres 16 + a Node 22 dev server.
- The web service installs deps, generates Drizzle migrations, creates the
  schema, seeds a demo admin, then starts `next dev -H 0.0.0.0` on port 3000.
- Source is bind-mounted at `/app`; edits hot-reload via Next.js dev server.

## Database
- **Original driver:** `@neondatabase/serverless` (Neon HTTP API — cannot
  connect to local Postgres).
- **Local adaptation:** `db/index.ts` was changed to use `pg` (node-postgres)
  with `drizzle-orm/node-postgres` so it works with the local Postgres container.
- `drizzle-kit push` also can't be used because drizzle-kit auto-detects
  `@neondatabase/serverless` and tries a WebSocket connection. Instead, the
  compose command runs `drizzle-kit generate` (no DB connection) to produce
  SQL, then `scripts/setup-db.mjs` executes that SQL via `pg`.
- Schema lives in `db/schema.ts`. The generated SQL is in `db/migrations/`.

## Demo credentials
- Email: `admin@demo.ac.ke`
- Password: `demo1234`
- You can also sign up a new school at `/signup`.

## Secrets (all optional — not required to boot)
- `GMAIL_USER` / `GMAIL_APP_PASSWORD` — outgoing email
- `AT_USERNAME` / `AT_API_KEY` / `AT_SENDER_ID` — SMS via Africa's Talking
- M-Pesa credentials are per-school (stored encrypted in the DB, configured
  from the dashboard billing page), not env vars.
- `SESSION_SECRET` and `ENCRYPTION_KEY` are generated locally in
  `.env.base44-defaults` — they're app secrets, not external service creds.

## Verification
- `curl -sf -H "Host: external.example" http://localhost:3000/` → 200
- Landing page, `/login`, `/signup` all render without external secrets.
- Login with demo credentials to access the dashboard.
