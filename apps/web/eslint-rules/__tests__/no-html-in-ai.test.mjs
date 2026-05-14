/**
 * Test suite for the no-html-in-ai ESLint rule.
 *
 * Uses ESLint's RuleTester. Run via: npx vitest run eslint-rules.
 * File is .mjs because vitest forbids require("vitest") in CJS.
 * The rule itself stays CJS (ESLint plugin standard) and is consumed
 * via Node's interop for default-import of CommonJS modules.
 */

import { RuleTester } from "eslint";
import rule from "../no-html-in-ai.js";

const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2022,
    sourceType: "module",
    parserOptions: {
      ecmaFeatures: { jsx: true },
    },
  },
});

ruleTester.run("no-html-in-ai", rule, {
  valid: [
    // JSX text node rendering — the approved pattern.
    {
      code: `
        function AIChatThread({ messages }) {
          return (
            <div>
              {messages.map((msg) => (
                <div key={msg.id}>{msg.content}</div>
              ))}
            </div>
          );
        }
      `,
    },
    // Safe imports — not in the forbidden list.
    { code: `import React from 'react';` },
    { code: `import { useState } from 'react';` },
    { code: `import sanitizeHtml from 'sanitize-html';` },
  ],
  invalid: [
    // dangerouslySetInnerHTML in JSX.
    {
      code: `
        function AIChatMessage({ content }) {
          return <div dangerouslySetInnerHTML={{ __html: content }} />;
        }
      `,
      errors: [{ messageId: "noDangerousHtml" }],
    },
    // Import of react-markdown.
    {
      code: `import ReactMarkdown from 'react-markdown';`,
      errors: [{ messageId: "noHtmlRenderer", data: { name: "react-markdown" } }],
    },
    // Import of marked.
    {
      code: `import { marked } from 'marked';`,
      errors: [{ messageId: "noHtmlRenderer", data: { name: "marked" } }],
    },
    // Import of dompurify.
    {
      code: `import DOMPurify from 'dompurify';`,
      errors: [{ messageId: "noHtmlRenderer", data: { name: "dompurify" } }],
    },
    // Import of html-react-parser.
    {
      code: `import parse from 'html-react-parser';`,
      errors: [{ messageId: "noHtmlRenderer", data: { name: "html-react-parser" } }],
    },
  ],
});
