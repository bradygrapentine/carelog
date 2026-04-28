# Resend Domain Verification Runbook

How to verify the `care-log.org` sender domain in Resend so transactional
mail (contact-form confirmations from PR #257, internal notifications, and
future weekly digests) lands in the inbox instead of the spam folder.

This is the actionable half of the Wave D / D2 follow-ups. The inactionable
half — `RESEND_API_KEY` already present in Vercel — needed no work.

---

## 1. Why this matters

- Carelog's contact-form confirmation email (`apps/web/app/api/contact/route.ts`)
  ships from `noreply@care-log.org`.
- Internal admin notifications (new signups, billing events) and the future
  weekly digest will use the same sending domain.
- Unverified domains land in spam at most providers (Gmail, Outlook,
  iCloud, ProtonMail) regardless of content quality. SPF + DKIM + DMARC
  alignment is the difference between "delivered" and "silently dropped."

---

## 2. Verify the domain in the Resend dashboard

1. Sign in to [resend.com](https://resend.com) with the project owner
   account.
2. Navigate to **Domains** → **Add Domain**.
3. Enter `care-log.org`. Resend issues three DNS records — one each for
   SPF, DKIM, and DMARC.

| Record | Type | Host | Value (provided by Resend) | Purpose |
|---|---|---|---|---|
| SPF | TXT | `send.care-log.org` (or root, depending on Resend's instructions) | `v=spf1 include:amazonses.com ~all` (Resend uses Amazon SES under the hood) | Authorizes Resend's relays to send for the domain |
| DKIM | TXT | `resend._domainkey.care-log.org` | `p=...` long base64 string | Cryptographic per-message signature; receivers verify against the published key |
| DMARC | TXT | `_dmarc.care-log.org` | `v=DMARC1; p=none; rua=mailto:dmarc@care-log.org` (start with `p=none`, escalate to `quarantine` after 30 days clean) | Tells receivers what to do when SPF/DKIM fail; receives aggregate reports |

4. Add each record in the DNS provider for `care-log.org` (Vercel, Cloudflare,
   Namecheap, or wherever the zone is hosted).
5. Back in Resend → **Domains** → click **Verify**. Each record flips from
   "Pending" → "Verified" within 5–60 minutes (TTL-dependent).
6. Once all three are green, the domain is ready to send from.

---

## 3. DKIM key rotation policy

- **Cadence:** Annually (set a calendar reminder for the anniversary of the
  initial verification).
- **How:**
  1. In Resend dashboard → **Domains** → **`care-log.org`** → **Rotate DKIM key**.
  2. Resend issues a new DKIM record alongside the old one (dual-publish window).
  3. Add the new TXT record in DNS without removing the old one.
  4. Wait 24 hours (covers DNS TTL plus mail-in-flight).
  5. Verify the new key in Resend → mark the old one for removal.
  6. After another 24 hours, remove the old TXT record from DNS.
- **Why dual-publish:** Mail signed under the old key while DNS still
  resolves to it must keep verifying for the duration of receiver caches.
  Hard cut-over breaks delivery for ~48 hours.

Verify a key with `dig`:

```sh
dig TXT resend._domainkey.care-log.org +short
# Want: a single quoted "p=..." string. Multiple = mid-rotation, expected.
```

---

## 4. Spam-folder / deliverability checks

After domain verification flips green, run a deliverability test before
declaring "done":

1. Visit [mail-tester.com](https://www.mail-tester.com).
2. Copy the unique address it shows.
3. From the Resend dashboard → **Send a test email** to that address, using
   the production template (not the Resend default).
4. Click **Check your score**.
5. **Target:** ≥ 9/10. Below 9 is a real deliverability gap.

If the score is < 9:

- Note the specific findings (SPF alignment, DKIM, content, blacklist hit).
- Capture the score and findings in a follow-up `chore(backlog): add ...`
  PR as a `🧑 Needs human` row — do not silently ship a runbook claiming
  pass without evidence.
- Common low-score causes: missing DMARC, sending from a brand-new domain
  with no warm-up, or content that triggers SpamAssassin rules (excessive
  links, IMG-only emails).

Optional second-opinion: [GlockApps](https://glockapps.com) for Gmail
inbox-placement testing across multiple Gmail tenants.

---

## 5. Cross-references

- Sending code: `apps/web/app/api/contact/route.ts` (PR #257)
- Env var: `RESEND_API_KEY` (already in Vercel — verify with
  `vercel env ls production | grep RESEND`)
- Observability: `docs/project-info/runbooks/OBSERVABILITY.md` — Sentry
  captures `[contact-form] resend api error` breadcrumbs when the Resend
  API itself returns non-2xx. If confirmation-email delivery rate drops
  visibly (Sentry breadcrumb spike or user reports), page on-call and
  start with the deliverability check in §4.
- Resend docs: <https://resend.com/docs/dashboard/domains/introduction>

---

## 6. Verification checklist (one-time, on initial setup)

- [ ] All three DNS records published in the `care-log.org` zone
- [ ] All three records show "Verified" in the Resend dashboard
- [ ] `dig TXT resend._domainkey.care-log.org +short` returns a `p=...` string
- [ ] Mail-Tester score ≥ 9/10 (record the score in this runbook on initial pass)
- [ ] DKIM rotation calendar reminder set (annual)
- [ ] Initial DMARC policy set to `p=none` with a 30-day review reminder to
      escalate to `p=quarantine` if no legitimate-sender failures are observed
