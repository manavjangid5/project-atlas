module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/src"],
  testMatch: ["**/*.test.ts"],
  forceExit: true,
  setupFiles: ["<rootDir>/jest.setup.ts"],
};