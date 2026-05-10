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
  ],
});
