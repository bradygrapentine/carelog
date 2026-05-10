/**
 * Project-local ESLint plugin for Carelog.
 *
 * Currently exports one rule:
 *   - no-phi-in-analytics — TD-117, ADR-0001 enforcement.
 */

"use strict";

const noPhiInAnalytics = require("./no-phi-in-analytics");

module.exports = {
  rules: {
    "no-phi-in-analytics": noPhiInAnalytics,
  },
};
