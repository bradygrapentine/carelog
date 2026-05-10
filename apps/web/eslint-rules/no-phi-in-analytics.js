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

const TARGET_CALLS = {
  // identifier on posthog object → property-arg index
  posthog: {
    identify: 1, // identify(distinctId, propsObj?)
    capture: 1, // capture(eventName, propsObj?)
  },
  Sentry: {
    setUser: 0, // setUser(userObj) — userObj at arg 0
    setContext: 1, // setContext(name, contextObj)
  },
};

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

        const targetMethods = TARGET_CALLS[obj];
        if (!targetMethods) return;
        if (!Object.prototype.hasOwnProperty.call(targetMethods, method)) {
          return;
        }

        const propsArgIndex = targetMethods[method];
        const propsArg = node.arguments[propsArgIndex];
        if (!propsArg) return;

        // `name` is allowed only in Sentry.setContext
        const allowName = obj === "Sentry" && method === "setContext";

        checkObjectExpression(context, propsArg, allowName);
      },
    };
  },
};
