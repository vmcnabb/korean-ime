import type { Config } from "jest";

const config: Config = {
    preset: "ts-jest",
    testEnvironment: "jsdom",
    setupFilesAfterEnv: ["<rootDir>/src/test-setup.ts"],
    // All tests live in src/. Confining discovery here keeps jest from scanning
    // build output and the dev Chrome profile (.chrome-profile/), which can
    // contain third-party extensions that ship their own test files.
    roots: ["<rootDir>/src"],
};

export default config;
