# TD-151 — DMARC record + sender hardening for care-log.org

Operator runbook to publish a DMARC TXT record on `care-log.org` and (optionally) move Supabase Auth's From-address off the `noreply@` apex. Mitigates Gmail's silent-drop behavior for DMARC-less transactional mail surfaced by Cowork live-test run `1778988534`.

Budget ~15 min active + up to 24h DMARC propagation (typically <30 min on Cloudflare).

## 1. Publish DMARC TXT record

- [ ] Open the DNS console for `care-log.org` (Cloudflare or wherever the apex is hosted)
- [ ] Add a new TXT record:

  ```
  Name:   _dmarc
  Type:   TXT
  Value:  v=DMARC1; p=none; rua=mailto:dmarc@care-log.org
  TTL:    auto (or 3600)
  ```

- [ ] Save. Wait ~30 min for propagation.
- [ ] Verify from your terminal:

  ```bash
  dig +short TXT _dmarc.care-log.org
  ```

  Expected output:

  ```
  "v=DMARC1; p=none; rua=mailto:dmarc@care-log.org"
  ```

> Note: `p=none` is **monitor mode** — Gmail reads the policy but does not enforce. After 1–2 weeks of clean delivery + zero `rua` aggregate-report complaints, tighten to `p=quarantine` then `p=reject`. Don't jump straight to `p=reject`.

> Tip: if you want aggregate DMARC reports, ensure `dmarc@care-log.org` is a real inbox (forward to your main Gmail). Otherwise replace with `dmarc-reports@<some-real-mailbox>`.

## 2. Re-verify Resend domain DNS

The SEC-001 rotation may have left Resend's DNS verification stale.

- [ ] Open [Resend → Domains → care-log.org](https://resend.com/domains)
- [ ] Confirm all three rows show **Verified** (green):
  - SPF — `TXT v=spf1 include:_spf.resend.com ~all`
  - DKIM — `TXT resend._domainkey ...`
  - Return-Path / MX — `MX feedback-smtp.<region>.amazonses.com`
- [ ] If any are pending or red, re-publish the displayed DNS values via the DNS console and wait for re-verification.

## 3. (Optional) Move From-address off `noreply@`

> ⚠️ **Behavior change.** This changes the sender on **every** transactional email in production (auth OTPs, invites, future receipts). Once users are conditioned to the new address, reversing is awkward. Skip this step for now if you'd rather A/B it later — TD-151 is satisfied by the DMARC record alone.

If proceeding:

### 3a. Pre-verify the new sender in Resend

The new address must be a verified sender in Resend BEFORE flipping Supabase, or every email will fail.

- [ ] Decide the new From-address — recommend `hello@care-log.org` or `auth@care-log.org`. Sender name stays `CareSync`.
- [ ] In Resend: domain-level verification (step 2) covers the whole `care-log.org` domain, so any local-part on the apex is implicitly authorized. Confirm by attempting a one-off send from the Resend dashboard test interface with the new address. If it sends with status `delivered`, you're good.

### 3b. Flip Supabase Auth SMTP

- [ ] Open [Supabase → Project Settings → Auth → SMTP Settings](https://supabase.com/dashboard/project/_/settings/auth)
- [ ] Edit **Sender email** → set to your chosen address (e.g. `hello@care-log.org`)
- [ ] Keep **Sender name** = `CareSync`
- [ ] Save
- [ ] Trigger a test OTP from production: open https://care-log.org in fresh incognito, submit a throwaway email
- [ ] Confirm via Resend logs the email was sent from the new address with status `delivered`

## 4. Re-test against Gmail

- [ ] In a fresh incognito window, hit https://care-log.org and request OTP for `<your-real-gmail>+livetest-dmarc-$(date +%s)@gmail.com`
- [ ] Wait up to 60s
- [ ] Confirm: email arrives in **Inbox** (not Spam, not silently dropped)
- [ ] If still missing, screenshot Resend's delivery log entry for the message — that's the authoritative delivery signal

## 5. Verification artifact for the TD-151 PR

Attach to the PR description:

1. `dig +short TXT _dmarc.care-log.org` output (proves DMARC record resolves)
2. Screenshot of the Resend delivery log entry for the test OTP (proves delivery to Gmail)
3. (Optional) Inbox screenshot showing the email arrived

> Watch: if you proceeded with step 3 but the new From-address isn't actually verified in Resend, the OTP will appear as `bounced` in Resend logs — the silent-fail mode SEC-001's rotation already caught once. Stop and re-verify before reporting "DMARC fixed".

## Related

- [BACKLOG TD-151](../../BACKLOG.md)
- [Post-SEC-001 happy-path runbook](./post-sec-001-happy-path.md)
- [RFC 7489 — DMARC](https://datatracker.ietf.org/doc/html/rfc7489)
