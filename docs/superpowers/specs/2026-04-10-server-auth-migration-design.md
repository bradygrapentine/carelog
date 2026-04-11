# Server-Side Auth Migration — Design Spec

**Date:** 2026-04-10
**Status:** Approved
**Scope:** Replace client-side `useEffect` auth with server component auth guards on all protected pages

---

## 1. Problem

All protected pages use a client-side auth pattern: `createClient().auth.getUser()` inside `useEffect`. This causes:
- Page flash before auth check completes
- No server-side rendering of protected content
- Auth state duplicated across every page component

This pattern was a workaround for local dev where `createServerSupabase()` couldn't read cookies reliably. Now that Supabase cloud is deployed, server-side auth works correctly.

---

## 2. Pattern

Each protected `page.tsx` becomes an async server component:

```tsx
import { redirect } from 'next/navigation'
import { createServerSupabase } from '@/lib/supabaseServer'

export default async function Page({ params }) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/signin')
  return <ClientComponent user={user} />
}
```

The client component receives `user` as a non-null prop. No more `useEffect` auth, no more loading spinners for auth state.

---

## 3. Pages to Migrate

### Dashboard — `app/(app)/dashboard/`
- `page.tsx`: add server auth guard, pass `user` to `DashboardClient`
- `DashboardClient.tsx`: remove `useEffect` auth block, accept `user: User` prop, remove `useState<User | null>`, remove loading spinner for auth

### Journal — `app/(app)/journal/[recipientId]/`
- `page.tsx`: add server auth guard, pass `user` to `JournalClient`
- `JournalClient.tsx`: remove `useEffect` auth block, accept `user: User` prop, remove auth-related state

### Team Admin — `app/(app)/team/admin/`
- `page.tsx`: add server auth guard if component uses client auth (check first)

### Subscriptions — `app/(app)/subscriptions/`
- `page.tsx`: add server auth guard if component uses client auth (check first)

### AppShellClient — `components/app/AppShellClient.tsx`
- If it fetches auth independently, refactor to accept `user` as prop from the layout or page

### NOT migrated (intentionally client-side):
- `app/invite/[token]/page.tsx` — works for unauthenticated users, auth checked on accept action
- `app/auth/confirm/page.tsx` — processes auth callbacks, server auth would be circular
- `app/signin/SignInForm.tsx` — auth entry point, no guard needed

---

## 4. Changes Per Client Component

For each migrated component:

1. **Remove:** `useEffect` block containing `createClient().auth.getUser()` + redirect
2. **Remove:** `useState<User | null>(null)` for user state
3. **Remove:** Loading spinner conditioned on `!user`
4. **Add:** `user: User` in props type (non-null — server guarantees auth)
5. **Keep:** Any `createClient()` usage for real-time subscriptions or client-side mutations
6. **Keep:** All tRPC calls (use their own server context)

---

## 5. AppShellClient / AppTabBar

`AppShellClient` currently has its own `useEffect` auth to get user initials. After migration:
- The `(app)/layout.tsx` server component gets the user and passes initials down
- OR `AppShellClient` accepts `userInitials` as a prop from the page

---

## 6. Testing Updates

- Update `DashboardClient.test.tsx` and `DashboardClient.flow.test.tsx` — pass `user` prop instead of mocking `createClient().auth.getUser()`
- Update `JournalClient.flow.test.tsx` — same
- Update `AppTabBar.test.tsx` if it depends on auth mock
- No changes to API route tests or router tests

---

## 7. Constraints

- `createServerSupabase()` is defined in `lib/supabaseServer.ts` — already exists, used by API routes
- Must use `await` (it's async) — page components must be `async function`
- Next.js 16: `params` is a `Promise` — unwrap with `await` in server components
- Do not break local dev — if `createServerSupabase` fails locally, the user just sees the signin redirect (acceptable)
- Do not change API routes — they already use server auth correctly
