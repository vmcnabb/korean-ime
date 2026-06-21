import { rm, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const extensionDir = path.join(repoRoot, "tools", "vscode-i18n-hover");
const extensionPackage = JSON.parse(await readFile(path.join(extensionDir, "package.json"), "utf8"));
const vsixFile = `${extensionPackage.name}-${extensionPackage.version}.vsix`;
const vsixPath = path.join(extensionDir, vsixFile);

let exitCode = 0;

try {
    await removeVsix();

    run("npm", ["exec", "--", "vsce", "package", "--skip-license", "--out", vsixFile], { cwd: extensionDir });

    run("code", ["--install-extension", vsixPath, "--force"], { cwd: repoRoot });
} catch (error) {
    if (error instanceof CommandFailedError) {
        exitCode = error.exitCode;
    } else {
        throw error;
    }
} finally {
    await removeVsix();
}

if (exitCode !== 0) {
    process.exit(exitCode);
}

async function removeVsix() {
    await rm(vsixPath, { force: true });
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
