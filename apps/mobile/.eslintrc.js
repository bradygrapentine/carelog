// ESLint config for apps/mobile — uses legacy .eslintrc.js format (ESLint 8)
// because eslint-plugin-react-native-a11y@3.5.1 requires ESLint ^3-^8.
module.exports = {
  root: true,
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaFeatures: { jsx: true },
    ecmaVersion: 2021,
    sourceType: "module",
  },
  plugins: ["react-native-a11y"],
  extends: ["plugin:react-native-a11y/recommended"],
  // Override noisy rules to warn — keep critical image/role rules at error.
  rules: {
    // Keep as error — must fix before shipping
    "react-native-a11y/accessible-image-has-label": "error",
    "react-native-a11y/has-valid-accessibility-role": "error",
    // Downgrade rest to warn — document violations, fix incrementally
    "react-native-a11y/has-accessibility-hint": "warn",
    "react-native-a11y/has-valid-accessibility-ignores-invert-colors": "warn",
    "react-native-a11y/has-valid-accessibility-live-region": "warn",
    "react-native-a11y/has-valid-accessibility-value": "warn",
    "react-native-a11y/has-valid-access-key": "warn",
    "react-native-a11y/has-valid-accessibility-actions": "warn",
    "react-native-a11y/has-valid-accessibility-descriptors": "warn",
    "react-native-a11y/no-nested-touchables": "warn",
  },
  ignorePatterns: ["node_modules/", "__tests__/", "*.test.ts", "*.test.tsx"],
};
