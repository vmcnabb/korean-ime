#!/usr/bin/env node

// Production-build wrapper. It owns the project-specific flags that WXT does
// not understand, translates them into build-time environment variables, and
// forwards every remaining argument to `wxt build`.

import { spawnSync } from "node:child_process";

const [target, ...args] = process.argv.slice(2);
if (target !== "chrome" && target !== "firefox") {
    console.error("[build] target must be chrome or firefox.");
    process.exit(1);
}

const enableHanja =
    args.includes("--enable-hanja") ||
    process.env.KIME_ENABLE_HANJA === "true" ||
    isTruthy(process.env.npm_config_enable_hanja);
const wxtArgs = args.filter((arg) => arg !== "--enable-hanja");
const env = { ...process.env };
if (enableHanja) {
    env.KIME_ENABLE_HANJA = "true";
    console.log("[build] Hanja feature: enabled");
}

run(process.execPath, ["scripts/gen-assets.mjs", target]);
run(process.platform === "win32" ? "wxt.cmd" : "wxt", [
    "build",
    ...(target === "firefox" ? ["-b", "firefox", "--mv3"] : []),
    ...wxtArgs,
]);

function run(command, commandArgs) {
    const result = spawnSync(command, commandArgs, {
        stdio: "inherit",
        env,
    });

    if (result.error) {
        throw result.error;
    }
    if (result.status !== 0) {
        process.exit(result.status ?? 1);
    }
}

function isTruthy(value) {
    return value !== undefined && value !== "" && value !== "false" && value !== "0";
}
