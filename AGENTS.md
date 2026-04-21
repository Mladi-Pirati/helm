<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Public API CORS

For public route handlers under `src/app/api/**/route.ts` and `src/app/api/**/route.tsx`, use the shared CORS helper in `src/lib/api/cors.ts`.

- Apply this to public ingest/API endpoints.
- Do not apply this rule to `/api/auth/**` or `/api/admin/**` unless explicitly requested.
- Export an `OPTIONS` handler using `createCorsPreflightResponse(...)`.
- Wrap returned responses using `withCors(...)`.
- Keep the allowlist centralized in `src/lib/api/cors.ts`.
- For repo-specific guidance, see `.codex/skills/public-api-cors/SKILL.md`.
