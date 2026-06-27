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
// `shell: true` so Windows can resolve the `wxt.cmd` shim in node_modules/.bin;
// since the CVE-2024-27980 fix, Node refuses to spawn `.cmd` files otherwise.
run("wxt", ["build", ...(target === "firefox" ? ["-b", "firefox", "--mv3"] : []), ...wxtArgs], true);

function run(command, commandArgs, shell = false) {
    // With `shell: true`, pass the whole invocation as one pre-joined string and
    // an empty args array: Node deprecates (DEP0190) passing args separately
    // under a shell because it concatenates them unescaped. Our args are fixed
    // literals with no spaces or shell metacharacters, so joining is safe.
    const [file, fileArgs] = shell ? [[command, ...commandArgs].join(" "), []] : [command, commandArgs];
    const result = spawnSync(file, fileArgs, {
        stdio: "inherit",
        env,
        shell,
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
