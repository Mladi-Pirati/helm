---
name: public-api-cors
description: Use when creating or updating public route handlers in this repository so they apply the shared CORS policy from src/lib/api/cors.ts, export OPTIONS support, and leave auth/admin routes unchanged unless explicitly requested.
---

# Public API CORS

Use this skill whenever you add or modify a public route handler under `src/app/api`.

Do not apply this pattern to `/api/auth/**` or `/api/admin/**` unless the task explicitly asks for it.

## Required pattern

- Import `createCorsPreflightResponse` and `withCors` from `@/lib/api/cors`.
- Export an `OPTIONS` handler for every public route file.
- Wrap every returned `Response` or `NextResponse` with `withCors(...)`.
- Keep the allowlist only in `src/lib/api/cors.ts`.

## Allowed origins

- Exact host: `legalizirajmo.si`
- Exact or subdomain host: `mladipirati.si`
- Exact or subdomain host: `prt.si`
- Exact or subdomain host: `piratskastranka.si`

## Example

```ts
const ROUTE_METHODS = ["POST", "OPTIONS"] as const;

export async function POST(request: Request) {
  return withCors(
    request,
    Response.json({ ok: true }),
    { methods: ROUTE_METHODS },
  );
}

export function OPTIONS(request: Request) {
  return createCorsPreflightResponse(request, {
    methods: ROUTE_METHODS,
  });
}
```
