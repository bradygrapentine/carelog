<!-- BEGIN:nextjs-agent-rules -->

# Next.js 16 — breaking changes from training data

## Route params are async
`params` is now a `Promise`. Always `await` it before use.
```ts
// WRONG — params.id is undefined
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
Turbopack is the default bundler. The `experimental.turbo` config key is removed — it throws if present. Do not add it.

<!-- END:nextjs-agent-rules -->
