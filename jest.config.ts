import type { Config } from "jest";

const config: Config = {
    preset: "ts-jest",
    testEnvironment: "jsdom",
    setupFilesAfterEnv: ["<rootDir>/src/test-setup.ts"],
    // All tests live in src/. Confining discovery here keeps jest from scanning
    // build output and the dev Chrome profile (.chrome-profile/), which can
    // contain third-party extensions that ship their own test files.
    roots: ["<rootDir>/src"],
    // Coverage is reported, not enforced (no thresholds). Scope it to the
    // testable TypeScript logic so the number is meaningful — exclude:
    //   - Vue components (UI, exercised manually, not unit-tested)
    //   - the GoogleDocsAdapter (kept for reference, not wired into the factory)
    //   - test files, type declarations, and the test setup itself.
    collectCoverageFrom: [
        "src/**/*.ts",
        "!src/**/*.test.ts",
        "!src/**/*.d.ts",
        "!src/test-setup.ts",
        "!src/composition/composition-adapters/google-docs-adapter.ts",
    ],
    coverageReporters: ["text-summary", "lcov"],
};

export default config;
