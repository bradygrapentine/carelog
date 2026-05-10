/**
 * Enforces ADR-0001: PHI must use anonymous UUID only in analytics.
 *
 * Fails when a forbidden property key appears in an object literal passed to:
 *   - posthog.identify(distinctId, propertiesObject?)
 *   - posthog.capture(eventName, propertiesObject?)
 *   - Sentry.setUser(userObject)
 *   - Sentry.setContext(name, contextObject)
 *
 * Forbidden keys (case-insensitive): email, phone, dob, ssn, first_name,
 * last_name, full_name, address, zip, street, city. Plus `name` — except
 * inside Sentry.setContext where it's commonly legitimate metadata.
 *
 * Walks nested object literals. Cannot resolve spread elements, variable
 * references, or computed keys — flag those manually in code review.
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
function resolveArgsToInspect(obj, method, args) {
  if (obj === "posthog") {
    if (method === "identify" || method === "capture") {
      // Single-arg object form (posthog-node) — first arg is itself the props bag.
      if (args[0]?.type === "ObjectExpression") return [args[0]];
      // Two-arg form (posthog-js) — second arg is the props.
      if (args[1]?.type === "ObjectExpression") return [args[1]];
    }
  }
  if (obj === "Sentry") {
    if (method === "setUser") {
      if (args[0]?.type === "ObjectExpression") return [args[0]];
    }
    if (method === "setContext") {
      if (args[1]?.type === "ObjectExpression") return [args[1]];
    }
    if (method === "captureException") {
      // captureException(err, captureContext) — captureContext.extra/tags/contexts.
      if (args[1]?.type === "ObjectExpression") return [args[1]];
    }
    if (method === "addBreadcrumb") {
      // addBreadcrumb({ message, data, category, ... }) — data is the leak surface.
      if (args[0]?.type === "ObjectExpression") return [args[0]];
    }
  }
  return [];
}

function isTargetCall(obj, method) {
  if (obj === "posthog") return method === "identify" || method === "capture";
  if (obj === "Sentry") {
    return (
      method === "setUser" ||
      method === "setContext" ||
      method === "captureException" ||
      method === "addBreadcrumb"
    );
  }
  return false;
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
    },
  },

  create(context) {
    return {
      CallExpression(node) {
        const { callee } = node;
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

        const argsToInspect = resolveArgsToInspect(obj, method, node.arguments);
        if (argsToInspect.length === 0) return;

        const allowName = allowsName(obj, method);
        for (const arg of argsToInspect) {
          checkObjectExpression(context, arg, allowName);
        }
      },
    };
  },
};
