# Next.js 16 — Web App Rules

## Route params are async
`params` is now a `Promise`. Always `await` before use.
```ts
// WRONG
export async function GET(req, { params }) {
  const { id } = params
}
// RIGHT
export async function GET(req, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
}
```

## No middleware.ts — use proxy.ts
Next.js 16 replaces `middleware.ts` with `proxy.ts`. Export a named `proxy` function, not a default `middleware` export.

## No experimental.turbo in next.config.ts
Turbopack is the default bundler. The `experimental.turbo` config key is removed — throws if present.

## Code rules
See `docs/project-info/technology/CODE_STANDARDS.md` for Turbopack/JSX rules, auth
patterns, form handling, and API route conventions.

## Service role key
See `docs/project-info/technology/SECURITY_MODEL.md` for service role isolation rules.

## App shell auth
The `(app)/layout.tsx` provides server-side auth for the entire app shell. Protected
pages receive `user` as a non-null prop. Client components that need Supabase for data
queries use `createClient()` (browser) for RLS-scoped reads and mutations.

## Testing
When writing tests: plan with expected counts per file first, check off each item as
you complete it. See `docs/project-info/technology/CODE_STANDARDS.md` for RLS and
pgTAP patterns.

## Screenshot Workflow
- Install Puppeteer and Chrome Cache