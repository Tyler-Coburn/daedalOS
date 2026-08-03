module.exports = require("next/jest")()({
  moduleDirectories: ["<rootDir>", "node_modules"],
  testEnvironment: "jest-environment-jsdom",
  // `__tests__/**/fixtures/` holds recorded contract data, not test suites.
  testPathIgnorePatterns: ["<rootDir>/e2e/", "/__tests__/.*/fixtures/"],
});
