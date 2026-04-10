<wizard-report>
# PostHog post-wizard report

The wizard has completed a deep integration of PostHog analytics into the Carelog web app. PostHog is initialized client-side via `instrumentation-client.ts` (Next.js 15.3+ pattern — no provider needed), proxied through `/ingest` rewrites in `next.config.ts`, and backed by a server-side singleton in `lib/posthog-server.ts` using `posthog-node`. Users are identified on the client at sign-in using their Supabase user ID. Ten events are instrumented across 7 files, covering the full user lifecycle from sign-in through activation, engagement, and churn.

**One action required:** Run `pnpm install` to install the newly added `posthog-node` dependency (the package was added to `apps/web/package.json` but could not be installed automatically due to a sandbox pnpm store conflict).

| Event | Description | File |
|---|---|---|
| `sign_in_otp_requested` | User submits email to receive a sign-in OTP | `apps/web/app/signin/SignInForm.tsx` |
| `sign_in_completed` | User successfully verifies OTP and is authenticated | `apps/web/app/signin/SignInForm.tsx` |
| `care_team_created` | User completes onboarding and creates a care team (client) | `apps/web/app/onboarding/OnboardingForm.tsx` |
| `care_team_created_server` | Server confirms care team creation (org + identity + membership) | `apps/web/app/api/onboarding/create/route.ts` |
| `invite_sent` | Coordinator sends an invite email to a new team member | `apps/web/app/api/invite/route.ts` |
| `invite_accepted` | Invited user accepts their invite and joins the care team | `apps/web/app/api/invite/[token]/accept/route.ts` |
| `journal_entry_submitted` | Caregiver submits a journal entry to the care timeline | `apps/web/app/(app)/journal/[recipientId]/JournalEntryForm.tsx` |
| `care_history_exported` | Coordinator exports care history as PDF or JSON | `apps/web/app/(app)/journal/[recipientId]/ExportButton.tsx` |
| `burnout_checkin_submitted` | Caregiver submits a weekly wellbeing check-in | `apps/web/app/(app)/journal/[recipientId]/BurnoutCheckin.tsx` |
| `subscription_cancel_initiated` | User confirms clicking cancel subscription | `apps/web/app/(app)/subscriptions/page.tsx` |

## Next steps

We've built some insights and a dashboard for you to keep an eye on user behavior, based on the events we just instrumented:

- **Dashboard — Analytics basics:** https://us.posthog.com/project/373261/dashboard/1454477
- **Sign-in → Activation funnel:** https://us.posthog.com/project/373261/insights/Uswve9pt
- **Weekly journal & burnout engagement:** https://us.posthog.com/project/373261/insights/ocAI3EkU
- **Invite virality: sent vs accepted:** https://us.posthog.com/project/373261/insights/fXZTzVuG
- **Subscription cancellation attempts:** https://us.posthog.com/project/373261/insights/7wl0GFhw
- **Care history exports:** https://us.posthog.com/project/373261/insights/T1oifooQ

### Agent skill

We've left an agent skill folder in your project at `.claude/skills/integration-nextjs-app-router/`. You can use this context for further agent development when using Claude Code. This will help ensure the model provides the most up-to-date approaches for integrating PostHog.

</wizard-report>
