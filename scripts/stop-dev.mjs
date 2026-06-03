import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { resolve } from "node:path";

const sessionFile = resolve(process.cwd(), ".chrome-profile", "dev-session.json");

function readSession() {
    if (!existsSync(sessionFile)) return null;

    try {
        return JSON.parse(readFileSync(sessionFile, "utf8"));
    } catch {
        return null;
    }
}

function killTree(pid) {
    if (!Number.isInteger(pid) || pid <= 0) return;

    if (process.platform === "win32") {
        spawnSync("taskkill", ["/pid", String(pid), "/T", "/F"], { stdio: "ignore" });
        return;
    }

    try {
        process.kill(pid, "SIGTERM");
    } catch {
        /* already gone */
    }
}

async function waitForSessionFileToClear(timeout = 5000) {
    const deadline = Date.now() + timeout;

    while (Date.now() < deadline) {
        if (!existsSync(sessionFile)) return true;
        await new Promise((resolveDelay) => setTimeout(resolveDelay, 200));
    }

    return !existsSync(sessionFile);
}

const session = readSession();
if (!session) {
    console.log("[stop-dev] No active dev session found.");
    process.exit(0);
}

killTree(session.chromePid);

if (!(await waitForSessionFileToClear())) {
    killTree(session.devPid);
    await waitForSessionFileToClear(1000);
}

rmSync(sessionFile, { force: true });
console.log("[stop-dev] Dev session stopped.");
