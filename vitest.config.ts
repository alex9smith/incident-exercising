import { defineConfig } from "vitest/config";

// eslint-disable-next-line no-restricted-exports
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    expect: {
      requireAssertions: true,
    },
    coverage: {
      include: ["src/**/*.ts"],
      exclude: ["src/cli.ts"],
      reporter: ["lcov", "text"],
      thresholds: {
        lines: 85,
        functions: 85,
        branches: 85,
        statements: 85,
      },
    },
  },
});
