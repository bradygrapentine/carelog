# Carelog — Authentication Flows

## 1. OTP Sign-In Flow

```
User                  Browser               Next.js API           Supabase Auth   Mailpit
 │                       │                      │                      │             │
 │  enter email          │                      │                      │             │
 │──────────────────────►│                      │                      │             │
 │                       │  signInWithOtp()     │                      │             │
 │                       │  (browser client)    │                      │             │
 │                       │─────────────────────────────────────────────►             │
 │                       │                      │                      │  send OTP   │
 │                       │                      │                      │────────────►│
 │                       │                      │                      │             │
 │  "Check your email"   │                      │                      │             │
 │◄──────────────────────│                      │                      │             │
 │                       │                      │                      │             │
 │  enter 6-digit code   │                      │                      │             │
 │──────────────────────►│                      │                      │             │
 │                       │  POST /api/auth/verify                       │             │
 │                       │─────────────────────►│                      │             │
 │                       │                      │  verifyOtp()         │             │
 │                       │                      │  (server client)     │             │
 │                       │                      │─────────────────────►│             │
 │                       │                      │  session tokens      │             │
 │                       │                      │◄─────────────────────│             │
 │                       │  { success: true }   │                      │             │
 │                       │  + Set-Cookie header │                      │             │
 │                       │◄─────────────────────│                      │             │
 │                       │                      │                      │             │
 │                       │  window.location.replace('/dashboard')       │             │
 │                       │  (hard redirect — not router.push)          │             │
 │◄──────────────────────│                      │                      │             │
```

**Why API route, not server action:** Server actions don't reliably propagate
cookie writes before `redirect()` fires. The API route writes the session cookie
in the same HTTP response, so the next page load always sees the session.

**Why `window.location.replace` not `router.push`:** The Next.js router uses
client-side navigation, which may not pick up the new session cookie. A hard
navigation forces a fresh request where the cookie is read correctly.

**Why client-side auth check in local dev:** Supabase names its session cookie
after the project URL (`sb-127-auth-token` for `127.0.0.1:54321`). The
`@supabase/ssr` helper expects a different format. Rather than patching this,
all protected pages use `createClient().auth.getUser()` in a `useEffect`.
This resolves automatically on Supabase Cloud (production).

---

## 2. Invite Acceptance Flow

This flow requires bridging two separate browser sessions: the invite URL
visit (possibly unauthenticated) and the post-sign-in redirect back.

```
Invitee                Browser               /signin               /dashboard
   │                      │                     │                       │
   │  visit /invite/TOKEN │                     │                       │
   │─────────────────────►│                     │                       │
   │                      │  GET /api/invite/TOKEN                      │
   │                      │  → { email, role, orgName }                 │
   │                      │                     │                       │
   │  [not signed in]     │                     │                       │
   │                      │  sessionStorage.set('pending_invite', TOKEN)│
   │                      │  window.location.href = '/signin'           │
   │                      │────────────────────►│                       │
   │                      │                     │                       │
   │  [OTP sign-in flow]  │                     │                       │
   │──────────────────────────────────────────► │                       │
   │                      │  window.location.replace('/dashboard')      │
   │                      │─────────────────────────────────────────────►
   │                      │                     │                       │
   │                      │                     │  useEffect: check     │
   │                      │                     │  sessionStorage for   │
   │                      │                     │  'pending_invite'     │
   │                      │                     │                       │
   │                      │  window.location.href = '/invite/' + TOKEN  │
   │◄─────────────────────────────────────────────────────────────────── │
   │                      │                     │                       │
   │  [back on invite page, now signed in]       │                       │
   │  click "Accept invitation"                  │                       │
   │─────────────────────►│                     │                       │
   │                      │  POST /api/invite/TOKEN/accept              │
   │                      │  { userId, userEmail }                      │
   │                      │  → validates email match                    │
   │                      │  → marks token consumed                     │
   │                      │  → activates membership                     │
   │                      │  window.location.href = '/dashboard'        │
   │◄─────────────────────│                     │                       │
```

**The sessionStorage bridge:** When a user visits the invite URL without being
signed in, the token is saved to `sessionStorage` before redirecting to `/signin`.
After sign-in always lands on `/dashboard`, `DashboardClient` checks for this
value and immediately bounces the user back to their invite URL.

**Email matching:** The invite token is scoped to the email it was sent to.
`acceptInvite()` compares `invite.email` against `acceptingUser.email` (both
normalized to lowercase). A mismatch returns HTTP 403.

---

## 3. Session Storage by Layer

```
Layer                  Storage                    Lifetime
─────────────────────────────────────────────────────────
Browser client         localStorage (Supabase)    Until sign-out
Browser cookie         sb-127-auth-token           Session / persistent
sessionStorage         pending_invite token        Until tab closes
Server component       Reads cookie only           Per-request
API route              Reads + sets cookie         Per-request
```

---

## 4. New User Onboarding Branch

After first sign-in, `user_profiles.onboarded` determines routing:

```
sign in → /dashboard
               │
               ▼
  user_profiles.onboarded = false?
               │
       Yes ────┘
               │
               ▼
        /onboarding
    (create org + identity + recipient + membership)
               │
               ▼
  user_profiles.onboarded = true  (set by /api/onboarding/create)
               │
               ▼
        /dashboard  (now shows care teams)
```
