module.exports = {
  testEnvironment: "node",
  testMatch: ["**/__tests__/**/*.test.ts?(x)"],
  transform: {
    "^.+\\.[jt]sx?$": ["babel-jest", { configFile: "./babel.config.js" }],
  },
  transformIgnorePatterns: [
    "node_modules/(?!(.pnpm|react-native|@react-native|@react-native-community|@testing-library|expo|@expo))",
  ],
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json"],
  globals: {
    __DEV__: true,
  },
};
