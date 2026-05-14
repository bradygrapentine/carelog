/**
 * Project-local ESLint plugin for Carelog.
 *
 * Rules:
 *   - no-phi-in-analytics — TD-117, ADR-0001 enforcement.
 *   - no-html-in-ai       — TD-131, FIND-006 enforcement.
 */

"use strict";

const noPhiInAnalytics = require("./no-phi-in-analytics");
const noHtmlInAi = require("./no-html-in-ai");

module.exports = {
  rules: {
    "no-phi-in-analytics": noPhiInAnalytics,
    "no-html-in-ai": noHtmlInAi,
  },
};
