/**
 * Enforces ADR-0001: PHI must use anonymous UUID only in analytics.
 *
 * Fails when a forbidden property key appears in an object literal passed to:
 *   - posthog.identify(distinctId, propertiesObject?)
 *   - posthog.capture(eventName, propertiesObject?)
 *   - Sentry.setUser(userObject)
 *   - Sentry.setContext(name, contextObject)
 *   - Sentry.setTags(tagsObject) / Sentry.setExtras(extrasObject)
 *
 * Also fails the SINGULAR form `Sentry.setTag(key, value)` /
 * `Sentry.setExtra(key, value)` when `key` is a forbidden literal — those
 * forms put the literal `key` into Sentry's indexed UI, so a key like
 * `"email"` is itself a PHI leak surface regardless of the value's runtime
 * shape. Non-literal `value` arguments are not inspected (the rule only
 * checks static keys); dynamic PHI passed via variable still requires
 * review per the spreadIdentifier convention used elsewhere in this rule.
 *
 * Forbidden keys (case-insensitive): email, phone, dob, ssn, first_name,
 * last_name, full_name, address, zip, street, city. Plus `name` — except
 * inside Sentry.setContext where it's commonly legitimate metadata.
 *
 * Also inspects:
 *   - resend.emails.send(payload) — payload's keys + nested object literals
 *     (including {to: [{ email: ... }]} array-of-objects shapes).
 *
 * Walks nested object literals AND ObjectExpression elements inside
 * ArrayExpressions (Resend's `to: [{ email: ... }]` shape). Cannot resolve
 * spread elements, variable references, or computed keys.
 *
 * When the inspected argument position holds a bare Identifier (e.g.
 * `Sentry.captureException(err, ctx)` where `ctx` is a variable), emits a
 * `spreadIdentifier` warning so reviewers can manually confirm PHI safety.
 */

"use strict";

// Normalized form: lowercase, underscores stripped. Matches both camelCase
// (`FirstName`) and snake_case (`first_name`) variants of the same property.
const FORBIDDEN_KEYS = new Set([
  "email",
  "phone",
  "dob",
  "ssn",
  "firstname",
  "lastname",
  "fullname",
  "address",
  "zip",
  "street",
  "city",
]);

function normalizeKey(s) {
  return s.toLowerCase().replace(/_/g, "");
}

// `name` is forbidden in posthog.* and Sentry.setUser, but allowed in
// Sentry.setContext (where it's often browser/runtime metadata).
const NAME_FORBIDDEN_BUT_ALLOWED_IN_SETCONTEXT = "name";

// Resolver maps a CallExpression's arguments to the object literal(s) the
// rule should inspect. Returns an array because some calls (e.g. posthog
// capture) have either a 2-arg form (eventName, propsObj) used by posthog-js
// in the browser OR a 1-arg form ({distinctId, event, properties: {...}})
// used by posthog-node on the server. Both must be checked.
//
// `name` is allowed in the inspected object only for Sentry.setContext,
// where it commonly carries non-identity metadata (e.g. browser name).
// Returns { argIndex, allowName } describing which positional argument the
// rule should inspect for a given target call. Returns null if not a target.
function resolveArgPosition(obj, method) {
  if (obj === "posthog") {
    if (method === "identify" || method === "capture") {
      // posthog has two shapes; both are checked below by the caller.
      return { argIndices: [0, 1], allowName: false };
    }
  }
  if (obj === "Sentry") {
    if (method === "setUser") return { argIndices: [0], allowName: false };
    if (method === "setContext") return { argIndices: [1], allowName: true };
    if (method === "captureException") return { argIndices: [1], allowName: false };
    if (method === "addBreadcrumb") return { argIndices: [0], allowName: false };
    // setTags/setExtras take a single object literal — inspect like setUser.
    if (method === "setTags" || method === "setExtras") {
      return { argIndices: [0], allowName: false };
    }
    // setTag/setExtra SINGULAR — (key, value). Handled separately because
    // the leak surface is the STRING-LITERAL KEY at args[0], not an object.
    // resolveArgPosition returns null; the CallExpression visitor branches.
  }
  if (obj === "resend" || obj === "Resend") {
    // resend.emails.send(payload) — handled by MemberExpression chain matcher.
    return null;
  }
  return null;
}

function isTargetCall(obj, method) {
  if (obj === "posthog") return method === "identify" || method === "capture";
  if (obj === "Sentry") {
    return (
      method === "setUser" ||
      method === "setContext" ||
      method === "captureException" ||
      method === "addBreadcrumb" ||
      method === "setTag" ||
      method === "setTags" ||
      method === "setExtra" ||
      method === "setExtras"
    );
  }
  return false;
}

// Sentry.setTag(key, value) / Sentry.setExtra(key, value) — singular form
// has a string-literal KEY as args[0]. That key lands in Sentry's indexed
// tag/extra UI verbatim, so a key of `"email"` is itself a PHI surface.
function isSentrySingularTagOrExtra(obj, method) {
  return obj === "Sentry" && (method === "setTag" || method === "setExtra");
}

// Matches `resend.emails.send(payload)` callee shape. Returns true if the
// CallExpression's callee is a `<id>.emails.send` member access where the
// root identifier is the literal `resend` (lowercase, the conventional name
// in the codebase for the Resend client instance).
function isResendEmailsSend(callee) {
  if (callee.type !== "MemberExpression") return false;
  if (callee.property.type !== "Identifier" || callee.property.name !== "send")
    return false;
  const inner = callee.object;
  if (inner.type !== "MemberExpression") return false;
  if (inner.property.type !== "Identifier" || inner.property.name !== "emails")
    return false;
  if (inner.object.type !== "Identifier") return false;
  return inner.object.name === "resend" || inner.object.name === "Resend";
}

function allowsName(obj, method) {
  return obj === "Sentry" && method === "setContext";
}

function isLiteralKey(prop) {
  if (prop.type !== "Property") return null;
  if (prop.computed) return null; // computed keys can't be statically resolved
  if (prop.key.type === "Identifier") return prop.key.name;
  if (prop.key.type === "Literal" && typeof prop.key.value === "string") {
    return prop.key.value;
  }
  return null;
}

function checkObjectExpression(context, node, allowName) {
  if (!node || node.type !== "ObjectExpression") return;

  for (const prop of node.properties) {
    const keyName = isLiteralKey(prop);
    if (keyName === null) continue;

    const norm = normalizeKey(keyName);
    const isForbidden =
      FORBIDDEN_KEYS.has(norm) ||
      (norm === NAME_FORBIDDEN_BUT_ALLOWED_IN_SETCONTEXT && !allowName);

    if (isForbidden) {
      context.report({
        node: prop.key,
        messageId: "forbiddenKey",
        data: { key: keyName },
      });
    }

    // Recurse into nested object literals
    if (prop.value && prop.value.type === "ObjectExpression") {
      checkObjectExpression(context, prop.value, allowName);
    }
    // Recurse into ArrayExpression elements that are object literals
    // (e.g. Resend `to: [{ email: "x@y" }]`).
    if (prop.value && prop.value.type === "ArrayExpression") {
      for (const el of prop.value.elements) {
        if (el && el.type === "ObjectExpression") {
          checkObjectExpression(context, el, allowName);
        }
      }
    }
  }
}

module.exports = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow PHI/PII property keys in analytics calls (PostHog, Sentry). Codifies ADR-0001.",
      recommended: true,
    },
    schema: [],
    messages: {
      forbiddenKey:
        "PHI rule: property key '{{key}}' is forbidden in analytics calls. Use anonymous UUID only — never email, name, phone, or other PII. See docs/adr/0001-phi-anonymous-uuid-only.md.",
      spreadIdentifier:
        "PHI rule: '{{call}}' was called with an Identifier ('{{name}}') instead of an inline object literal — the rule cannot statically inspect its keys for PHI. Verify the value carries no email/name/phone/PII, or pass an object literal. Suppress with `// eslint-disable-next-line carelog/no-phi-in-analytics` after manual review.",
      forbiddenTagKey:
        "Sentry.{{call}} key '{{key}}' is PHI — use anonymous UUID or a non-PHI label (e.g. user_id, org_id). See docs/adr/0001-phi-anonymous-uuid-only.md.",
    },
  },

  create(context) {
    function inspectArg(arg, allowName, callDesc) {
      if (!arg) return;
      if (arg.type === "ObjectExpression") {
        checkObjectExpression(context, arg, allowName);
        return;
      }
      if (arg.type === "Identifier") {
        context.report({
          node: arg,
          messageId: "spreadIdentifier",
          data: { call: callDesc, name: arg.name },
        });
      }
    }

    return {
      CallExpression(node) {
        const { callee } = node;

        // resend.emails.send(payload)
        if (isResendEmailsSend(callee)) {
          const arg = node.arguments[0];
          inspectArg(arg, false, "resend.emails.send");
          return;
        }

        if (callee.type !== "MemberExpression") return;
        if (
          callee.object.type !== "Identifier" ||
          callee.property.type !== "Identifier"
        ) {
          return;
        }

        const obj = callee.object.name;
        const method = callee.property.name;

        if (!isTargetCall(obj, method)) return;

        // Sentry.setTag(key, value) / Sentry.setExtra(key, value) — inspect
        // the literal string KEY at args[0], not an object. The `name` key
        // is also forbidden here (no setContext-style allowance).
        if (isSentrySingularTagOrExtra(obj, method)) {
          const keyArg = node.arguments[0];
          if (
            keyArg &&
            keyArg.type === "Literal" &&
            typeof keyArg.value === "string"
          ) {
            const norm = normalizeKey(keyArg.value);
            if (
              FORBIDDEN_KEYS.has(norm) ||
              norm === NAME_FORBIDDEN_BUT_ALLOWED_IN_SETCONTEXT
            ) {
              context.report({
                node: keyArg,
                messageId: "forbiddenTagKey",
                data: { call: method, key: keyArg.value },
              });
            }
          }
          return;
        }

        const position = resolveArgPosition(obj, method);
        if (!position) return;

        const callDesc = `${obj}.${method}`;
        for (const idx of position.argIndices) {
          const arg = node.arguments[idx];
          if (!arg) continue;
          if (arg.type === "ObjectExpression") {
            checkObjectExpression(context, arg, position.allowName);
          } else if (
            arg.type === "Identifier" &&
            // For posthog 2-arg form, skip Identifier at arg[0] (it's distinctId,
            // typically a UUID variable — flagging it is noise). Only flag the
            // properties-bag positions.
            !(obj === "posthog" && idx === 0)
          ) {
            context.report({
              node: arg,
              messageId: "spreadIdentifier",
              data: { call: callDesc, name: arg.name },
            });
          }
        }
      },
    };
  },
};
