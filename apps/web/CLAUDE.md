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

## Middleware is proxy.ts — NOT middleware.ts
Next.js 16 renames `middleware.ts` to `proxy.ts`. Export a named `proxy` function. Do NOT create `middleware.ts` — having both files causes a build error. The Supabase session refresh lives in `proxy.ts`.

**Critical — @supabase/ssr version pin:** `proxy.ts` and `lib/supabaseServer.ts` use the `{ getAll, setAll }` cookie API introduced in `@supabase/ssr@0.4.0`. Never downgrade below 0.4.0 — earlier versions silently ignore these methods (they only accept `{ get, set, remove }`), causing every cookie read to be a no-op and `getUser()` to return null server-side. `lib/__tests__/proxy.test.ts` is the regression guard.

## No experimental.turbo in next.config.ts
Turbopack is the default bundler. The `experimental.turbo` config key is removed — throws if present.

## Code rules
See `docs/project-info/technology/CODE_STANDARDS.md` for Turbopack/JSX rules, auth
patterns, form handling, and API route conventions.

## UI standards — read before every UI change
Hard rules for Tailwind, shadcn, design tokens, WCAG 2.2 AA, responsive breakpoints,
and the panel / form / tinted-header patterns live in `.claude/rules/ui-standards.md`.
Load that file before touching anything under `app/` or `components/`. Violations
should block review — no raw hex, no raw font imports, no un-labelled inputs, no
missing focus rings, no click-only interactions without a keyboard path.

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