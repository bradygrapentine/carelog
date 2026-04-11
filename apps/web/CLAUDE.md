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

## Turbopack JSX rules
- Never use template literals in JSX props — compute URLs as variables first
- Keep JSX opening tags single-line when they have dynamic props
```tsx
// WRONG
<a href={`/journal/${recipientId}`}>...</a>
// RIGHT
const url = '/journal/' + recipientId
<a href={url}>...</a>
```

## Auth pattern — IMPORTANT
Auth is server-side. Protected pages use `createServerSupabase().auth.getUser()` in async
server components and pass `user` as a non-null prop to client components.
The `(app)/layout.tsx` provides auth for the entire app shell.

Client components that need Supabase for data queries still use `createClient()` (browser)
for RLS-scoped reads and mutations.

Use API routes (not server actions) for any operation writing cookies + redirecting.
Server actions don't reliably propagate cookie writes before redirect.

## Service role key rule
`supabaseAdmin` used ONLY in `server/` and `app/api/` directories. Never in client components.
File has a runtime window guard — throws if accidentally imported client-side.

## Form values must be read before async calls
`e.currentTarget` becomes null after any `await`. Read all form values synchronously first.
```tsx
// RIGHT
async function handleSubmit(e) {
  const form = e.currentTarget
  const name = (form.elements.namedItem('name') as HTMLInputElement).value
  // Now safe to await
}
```

## Testing
When writing tests: plan with expected counts per file first, check off each item as you complete it.
See `docs/project-info/ENTERPRISE_PRINCIPLES.md` for RLS and pgTAP patterns.

## Screenshot Workflow
- Install Puppeteer and Chrome Cache