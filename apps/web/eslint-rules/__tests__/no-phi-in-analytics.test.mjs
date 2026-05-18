/**
 * Test suite for the no-phi-in-analytics ESLint rule.
 *
 * Uses ESLint's RuleTester. Run via: npx vitest run eslint-rules.
 * File is .mjs because vitest forbids require("vitest") in CJS.
 * The rule itself stays CJS (ESLint plugin standard) and is consumed
 * via Node's interop for default-import of CommonJS modules.
 */

import { RuleTester } from "eslint";
import rule from "../no-phi-in-analytics.js";

const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2022,
    sourceType: "module",
  },
});

ruleTester.run("no-phi-in-analytics", rule, {
      valid: [
        // PostHog identify with UUID only — the canonical pattern.
        { code: "posthog.identify('user-uuid-123');" },
        // PostHog identify with org_id only (allowed metadata).
        { code: "posthog.identify('user-uuid', { org_id: 'org-123' });" },
        // PostHog capture with event name + safe properties.
        {
          code: "posthog.capture('dashboard_viewed', { duration_ms: 200 });",
        },
        // PostHog capture with no properties.
        { code: "posthog.capture('sign_in_completed');" },
        // Sentry setUser with id only.
        { code: "Sentry.setUser({ id: 'user-uuid' });" },
        // Sentry setContext where 'name' is metadata (allowed in setContext).
        {
          code: "Sentry.setContext('browser', { name: 'Chrome', version: '120' });",
        },
        // Unrelated calls — not in TARGET_CALLS.
        { code: "logger.info({ email: 'x@y.com' });" },
        { code: "supabase.from('users').insert({ email: 'x@y.com' });" },
        // Different object name shouldn't match.
        { code: "myPosthog.identify('uuid', { email: 'x@y.com' });" },
        // Server-side posthog.capture object form — distinctId/event are
        // allowed top-level metadata; properties is recursed.
        {
          code: "posthog.capture({ distinctId: 'uuid', event: 'contact_form_submitted', properties: { has_email: true } });",
        },
        // Server-side posthog.identify object form, safe.
        {
          code: "posthog.identify({ distinctId: 'uuid', properties: { org_id: 'org-1' } });",
        },
        // Sentry.captureException with safe extra/tags.
        {
          code: "Sentry.captureException(err, { extra: { request_id: 'abc' }, tags: { route: '/api/x' } });",
        },
        // Sentry.addBreadcrumb with safe data.
        {
          code: "Sentry.addBreadcrumb({ message: 'cache miss', category: 'cache', data: { key: 'k' } });",
        },
        // TD-181: Resend transactional email with safe `from` (literal string in
        // safe key — keys-only rule should not flag the string value).
        {
          code: "resend.emails.send({ from: 'CareSync <noreply@carelog.app>', to: 'user-uuid@example.com', subject: 'hello', html: '<p>hi</p>' });",
        },
        // TD-181: posthog.identify with bare Identifier as distinctId (1st arg)
        // — must NOT trigger spreadIdentifier; distinctId is conventionally a
        // UUID variable and flagging it is noise.
        { code: "posthog.identify(userId);" },
        // TD-186: Sentry.setTag with safe key — allowed.
        { code: "Sentry.setTag('env', 'prod');" },
        // TD-186: Sentry.setExtra with safe key — allowed.
        { code: "Sentry.setExtra('request_id', 'abc-123');" },
        // TD-186: Sentry.setTags with safe object — allowed.
        { code: "Sentry.setTags({ env: 'prod', region: 'us-east-1' });" },
        // TD-186: Sentry.setExtras with safe object — allowed.
        { code: "Sentry.setExtras({ request_id: 'abc', org_id: 'org-1' });" },
      ],
      invalid: [
        // PostHog identify with email.
        {
          code: "posthog.identify('uuid', { email: 'user@example.com' });",
          errors: [{ messageId: "forbiddenKey", data: { key: "email" } }],
        },
        // PostHog identify with name.
        {
          code: "posthog.identify('uuid', { name: 'Alice' });",
          errors: [{ messageId: "forbiddenKey", data: { key: "name" } }],
        },
        // PostHog capture with phone in properties.
        {
          code: "posthog.capture('event', { phone: '555-1234' });",
          errors: [{ messageId: "forbiddenKey", data: { key: "phone" } }],
        },
        // Case-insensitive: Email, EMAIL, FirstName.
        {
          code: "posthog.capture('event', { Email: 'x@y.com' });",
          errors: [{ messageId: "forbiddenKey", data: { key: "Email" } }],
        },
        {
          code: "posthog.capture('event', { FirstName: 'Alice' });",
          errors: [{ messageId: "forbiddenKey", data: { key: "FirstName" } }],
        },
        // Nested object — recursion check.
        {
          code: "posthog.capture('event', { user: { email: 'x@y.com' } });",
          errors: [{ messageId: "forbiddenKey", data: { key: "email" } }],
        },
        // Sentry.setUser with email (forbidden — id only).
        {
          code: "Sentry.setUser({ id: 'uuid', email: 'x@y.com' });",
          errors: [{ messageId: "forbiddenKey", data: { key: "email" } }],
        },
        // Sentry.setUser with name (forbidden in setUser; allowed only in setContext).
        {
          code: "Sentry.setUser({ id: 'uuid', name: 'Alice' });",
          errors: [{ messageId: "forbiddenKey", data: { key: "name" } }],
        },
        // Sentry.setContext with email (still forbidden — only `name` is special-cased).
        {
          code: "Sentry.setContext('user', { email: 'x@y.com' });",
          errors: [{ messageId: "forbiddenKey", data: { key: "email" } }],
        },
        // String-literal key.
        {
          code: "posthog.capture('event', { 'email': 'x@y.com' });",
          errors: [{ messageId: "forbiddenKey", data: { key: "email" } }],
        },
        // Multiple violations in one object — both reported.
        {
          code: "posthog.identify('uuid', { email: 'x', phone: 'y' });",
          errors: [
            { messageId: "forbiddenKey", data: { key: "email" } },
            { messageId: "forbiddenKey", data: { key: "phone" } },
          ],
        },
        // Server posthog.capture object form — PHI inside properties.
        // (Reviewer must-fix: this shape was uncaught before TARGET_CALLS rewrite.)
        {
          code: "posthog.capture({ distinctId: 'uuid', event: 'e', properties: { email: 'x@y.com' } });",
          errors: [{ messageId: "forbiddenKey", data: { key: "email" } }],
        },
        // Server posthog.identify object form — PHI at top level.
        {
          code: "posthog.identify({ distinctId: 'uuid', email: 'x@y.com' });",
          errors: [{ messageId: "forbiddenKey", data: { key: "email" } }],
        },
        // Sentry.captureException with PII in extra (the historical leak surface).
        // Note: rule matches exact normalized keys, so `user_email` would NOT be
        // caught — flag only `email`, `name`, etc. Document gap in plan.
        {
          code: "Sentry.captureException(err, { extra: { email: 'x@y.com' } });",
          errors: [{ messageId: "forbiddenKey", data: { key: "email" } }],
        },
        // Sentry.addBreadcrumb with PII in data.
        {
          code: "Sentry.addBreadcrumb({ message: 'login', data: { phone: '555-1234' } });",
          errors: [{ messageId: "forbiddenKey", data: { key: "phone" } }],
        },
        // TD-181 — Resend.emails.send: forbidden key in headers (top-level recursion).
        {
          code:
            "resend.emails.send({ from: 'a@b', to: 'c@d', subject: 's', html: '<p/>', headers: { email: 'leak@x' } });",
          errors: [{ messageId: "forbiddenKey", data: { key: "email" } }],
        },
        // TD-181 — Resend.emails.send: forbidden key in `to` array-of-objects
        // (proves ArrayExpression walker recursion).
        {
          code:
            "resend.emails.send({ from: 'a@b', to: [{ phone: '555-1234' }], subject: 's', html: '<p/>' });",
          errors: [{ messageId: "forbiddenKey", data: { key: "phone" } }],
        },
        // TD-181 — Resend.emails.send: forbidden key in nested `attachments` array.
        {
          code:
            "resend.emails.send({ from: 'a@b', to: 'c@d', subject: 's', html: '<p/>', attachments: [{ filename: 'x', dob: '1990-01-01' }] });",
          errors: [{ messageId: "forbiddenKey", data: { key: "dob" } }],
        },
        // TD-181 — Sentry.captureException called with bare Identifier as the
        // captureContext arg — emits spreadIdentifier so reviewer manually
        // confirms PHI safety.
        {
          code: "Sentry.captureException(err, ctx);",
          errors: [
            {
              messageId: "spreadIdentifier",
              data: { call: "Sentry.captureException", name: "ctx" },
            },
          ],
        },
        // TD-181 — posthog.capture 2-arg form with Identifier in properties
        // position emits spreadIdentifier.
        {
          code: "posthog.capture('event', props);",
          errors: [
            {
              messageId: "spreadIdentifier",
              data: { call: "posthog.capture", name: "props" },
            },
          ],
        },
        // TD-181 — resend.emails.send called with bare Identifier payload.
        {
          code: "resend.emails.send(payload);",
          errors: [
            {
              messageId: "spreadIdentifier",
              data: { call: "resend.emails.send", name: "payload" },
            },
          ],
        },
        // TD-186 — Sentry.setTag with PHI literal key (the key itself lands in
        // Sentry's indexed tag UI).
        {
          code: "Sentry.setTag('email', 'leak@x');",
          errors: [
            {
              messageId: "forbiddenTagKey",
              data: { call: "setTag", key: "email" },
            },
          ],
        },
        // TD-186 — Sentry.setExtra with PHI literal key.
        {
          code: "Sentry.setExtra('phone', '555-leak');",
          errors: [
            {
              messageId: "forbiddenTagKey",
              data: { call: "setExtra", key: "phone" },
            },
          ],
        },
        // TD-186 — Sentry.setTag with 'name' literal key — forbidden in tags
        // (the setContext name-allowance does NOT apply here).
        {
          code: "Sentry.setTag('name', 'Alice');",
          errors: [
            {
              messageId: "forbiddenTagKey",
              data: { call: "setTag", key: "name" },
            },
          ],
        },
        // TD-186 — Sentry.setTags object form with forbidden key.
        {
          code: "Sentry.setTags({ email: 'leak@x', env: 'prod' });",
          errors: [{ messageId: "forbiddenKey", data: { key: "email" } }],
        },
        // TD-186 — Sentry.setExtras object form with forbidden key.
        {
          code: "Sentry.setExtras({ phone: '555-leak' });",
          errors: [{ messageId: "forbiddenKey", data: { key: "phone" } }],
        },
        // TD-186 — Sentry.setTags case-insensitive (FirstName).
        {
          code: "Sentry.setTags({ FirstName: 'Alice' });",
          errors: [{ messageId: "forbiddenKey", data: { key: "FirstName" } }],
        },
  ],
});
