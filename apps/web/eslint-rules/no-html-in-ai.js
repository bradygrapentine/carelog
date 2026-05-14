/**
 * ESLint rule: no-html-in-ai — TD-131, FIND-006 enforcement.
 *
 * Forbids two patterns inside components/ai/:
 *   1. dangerouslySetInnerHTML JSX attribute.
 *   2. Imports of HTML/markdown renderers (react-markdown, marked, dompurify, html-react-parser).
 *
 * Rationale: LLM output must be rendered as JSX text only. Wrapping it in an HTML sink
 * creates a stored-XSS / PHI-leak vector. See docs/security/2026-05-14-owasp-audit.md FIND-006.
 */

"use strict";

const FORBIDDEN_IMPORTS = new Set([
  "react-markdown",
  "marked",
  "dompurify",
  "html-react-parser",
]);

module.exports = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Forbid HTML sinks (dangerouslySetInnerHTML, markdown renderers) inside components/ai/ — enforces TD-131 XSS invariant on LLM-rendered surfaces.",
    },
    schema: [],
    messages: {
      noDangerousHtml:
        "components/ai/ may not use dangerouslySetInnerHTML — see TD-131 / FIND-006.",
      noHtmlRenderer:
        "components/ai/ may not import HTML/markdown renderers ('{{name}}') — see TD-131 / FIND-006.",
    },
  },
  create(context) {
    return {
      JSXAttribute(node) {
        if (node.name && node.name.name === "dangerouslySetInnerHTML") {
          context.report({ node, messageId: "noDangerousHtml" });
        }
      },
      ImportDeclaration(node) {
        const src = node.source && node.source.value;
        if (typeof src === "string" && FORBIDDEN_IMPORTS.has(src)) {
          context.report({
            node,
            messageId: "noHtmlRenderer",
            data: { name: src },
          });
        }
      },
    };
  },
};
