// Detached watchdog that closes the dev Firefox when the dev launcher process
// (scripts/dev-firefox.mjs) goes away — by Ctrl+C, force-kill, or clean exit.
//
// Why this exists: on Windows the launcher's SIGINT handler is unreliable when
// run through `npm`/`cmd` — Ctrl+C can preempt node (and the powershell child it
// would spawn) before cleanup runs, so the detached browser is orphaned. This
// reaper is spawned detached (its own process group, no console), so the same
// Ctrl+C doesn't kill it; it simply waits for the parent PID to disappear and
// then tree-kills the Firefox matching our throwaway profile.
//
// Usage: node firefox-reaper.mjs <parentPid> <profileDir> [profileDir...]

import { killFirefoxByProfile } from "./dev-shared.mjs";

const [parentPidArg, ...profileDirs] = process.argv.slice(2);
const parentPid = Number(parentPidArg);

// Safety net: never linger more than a few hours even if something goes wrong.
const deadline = Date.now() + 4 * 60 * 60 * 1000;

function parentAlive() {
    try {
        // Signal 0 doesn't kill — it just checks existence (EPERM still = alive).
        process.kill(parentPid, 0);
        return true;
    } catch (err) {
        return err.code === "EPERM";
    }
}

if (!Number.isInteger(parentPid) || profileDirs.length === 0) {
    process.exit(0);
}

const timer = setInterval(() => {
    if (parentAlive() && Date.now() < deadline) return;
    clearInterval(timer);
    killFirefoxByProfile(profileDirs);
    process.exit(0);
}, 500);
