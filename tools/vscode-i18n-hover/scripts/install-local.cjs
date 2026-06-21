"use strict";

const { spawnSync } = require("node:child_process");
const { readFileSync, rmSync } = require("node:fs");
const path = require("node:path");

const extensionDir = path.resolve(__dirname, "..");
const extensionPackage = JSON.parse(readFileSync(path.join(extensionDir, "package.json"), "utf8"));
const vsixFile = `${extensionPackage.name}-${extensionPackage.version}.vsix`;
const vsixPath = path.join(extensionDir, vsixFile);

let exitCode = 0;

try {
    removeVsix();

    run("npm", ["run", "build"], { cwd: extensionDir });
    run("npm", ["exec", "--", "vsce", "package", "--skip-license", "--out", vsixFile], { cwd: extensionDir });

    run("code", ["--install-extension", vsixPath, "--force"], { cwd: extensionDir });
} catch (error) {
    if (error instanceof CommandFailedError) {
        exitCode = error.exitCode;
    } else {
        throw error;
    }
} finally {
    removeVsix();
}

if (exitCode !== 0) {
    process.exit(exitCode);
}

function removeVsix() {
    rmSync(vsixPath, { force: true });
}

function run(command, args, options) {
    const result = spawnSync(command, args, {
        ...options,
        stdio: "inherit",
        shell: process.platform === "win32",
    });

    if (result.error) {
        throw result.error;
    }

    if (result.status !== 0) {
        throw new CommandFailedError(result.status ?? 1);
    }
}

class CommandFailedError extends Error {
    constructor(exitCode) {
        super(`Command failed with exit code ${exitCode}`);
        this.exitCode = exitCode;
    }
}
