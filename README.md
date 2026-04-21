# Mladi Pirati - Applications Receiver

This project is a Next.js admin panel and ingestion API for Mladi pirati applications. It uses PostgreSQL, Drizzle ORM, Auth.js v5 credentials auth, Zod validation, and shadcn/ui.

## Setup

Install dependencies:

```bash
bun install
```

Run PostgreSQL locally if needed:

```bash
docker compose up -d db
```

Generate and apply migrations:

```bash
bun run db:generate
bun run db:migrate
```

Bootstrap the first admin user from env:

```bash
bun run bootstrap:admin
```

Start the app:

```bash
bun run dev
```

## Required Environment Variables

Copy `.env.example` to `.env` and provide:

- `DATABASE_URL`
- `AUTH_SECRET`
- `LEGALIZIRAJMO_TURNSTILE_SECRET_KEY`
- `INITIAL_ADMIN_NAME`
- `INITIAL_ADMIN_USERNAME`
- `INITIAL_ADMIN_PASSWORD`

Optional:

- `LEGALIZIRAJMO_TURNSTILE_EXPECTED_HOSTNAME`

`LEGALIZIRAJMO_TURNSTILE_SECRET_KEY` is used by the newsletter subscribe API and the membership application API to verify Cloudflare Turnstile tokens server-side. `LEGALIZIRAJMO_TURNSTILE_EXPECTED_HOSTNAME` can be set to enforce that successful Turnstile challenges were solved for the expected frontend hostname.

## Auth Overview

- Auth.js v5 is configured with a credentials provider that signs users in with `username` and `password`.
- User records live in PostgreSQL and passwords are stored as `argon2id` hashes.
- Sessions use the JWT strategy and expose `id`, `fullName`, `username`, and `role`.
- `/admin` is protected for authenticated users, while `/admin/users` is limited to `admin` users only.

## Available Commands

```bash
bun run db:generate
bun run db:migrate
bun run db:studio
bun run bootstrap:admin
bun run lint
bun run build
```
