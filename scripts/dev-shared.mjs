// Shared helpers for the per-browser dev launchers (dev.mjs / dev-firefox.mjs):
// flag parsing, the localhost test page + server, and process-tree teardown.

import { createServer } from "node:http";
import { spawnSync } from "node:child_process";
import { basename } from "node:path";

// Watch mode (Parcel watch + auto-reload) is opt-in:
// `npm run dev:<browser> -- --watch` (flag reaches argv) or
// `npm run dev:<browser> --watch` (npm exposes it as npm_config_watch).
export function watchRequested() {
    if (process.argv.slice(2).includes("--watch")) return true;
    const cfg = process.env.npm_config_watch;
    return cfg !== undefined && cfg !== "false" && cfg !== "0";
}

// Optional UI locale for the dev browser, for testing i18n strings.
// `npm run dev:<browser> -- --locale=ko` (flag reaches argv) or
// `npm run dev:<browser> --locale=ko` (npm exposes it as npm_config_locale).
export function requestedLocale() {
    const fromArgv = process.argv.slice(2).find((a) => a.startsWith("--locale="));
    if (fromArgv) return fromArgv.slice("--locale=".length);
    return process.env.npm_config_locale || undefined;
}

function truthyNpmFlag(value) {
    return value !== undefined && value !== "false" && value !== "0";
}

// Optional color scheme for testing light/dark UI without changing the OS theme.
// `npm run dev:<browser> -- --dark` / `--light` (flag reaches argv), or
// `npm run dev:<browser> --dark` / `--light` (npm exposes npm_config_dark/light).
export function requestedColorScheme() {
    const args = process.argv.slice(2);
    const dark = args.includes("--dark") || truthyNpmFlag(process.env.npm_config_dark);
    const light = args.includes("--light") || truthyNpmFlag(process.env.npm_config_light);

    if (dark && light) {
        throw new Error("Choose either --dark or --light, not both.");
    }

    if (dark) return "dark";
    if (light) return "light";
    return undefined;
}

// child.kill() only kills the immediate process. On Windows, killing the whole
// process tree is the reliable way to take down a spawned browser — and, in
// --watch mode, the Parcel watcher (which runs through a shell) and its HMR
// server — with us.
export function killTree(proc) {
    if (!proc || proc.pid === undefined || proc.killed) return;
    if (process.platform === "win32") {
        spawnSync("taskkill", ["/pid", String(proc.pid), "/T", "/F"], { stdio: "ignore" });
    } else {
        try {
            proc.kill("SIGTERM");
        } catch {
            /* already gone */
        }
    }
}

// Force-close the dev Firefox by matching processes whose command line contains
// our unique throwaway profile dir name and tree-killing them. web-ext's own
// teardown only kill()s the single PID it spawned, which on Windows is a launcher
// process that detaches the real browser — so that kill misses the window.
// Matching on the throwaway profile name is scoped to this dev session, so it
// never touches the user's own Firefox.
export function killFirefoxByProfile(profileDirs) {
    for (const dir of profileDirs) {
        const needle = basename(dir);
        if (!needle) continue;
        if (process.platform === "win32") {
            const escaped = needle.replace(/'/g, "''");
            spawnSync(
                "powershell.exe",
                [
                    "-NoProfile",
                    "-Command",
                    `Get-CimInstance Win32_Process -Filter "Name='firefox.exe'" | Where-Object { $_.CommandLine -like '*${escaped}*' } | ForEach-Object { taskkill /PID $_.ProcessId /T /F }`,
                ],
                { stdio: "ignore" }
            );
        } else {
            spawnSync("pkill", ["-f", needle], { stdio: "ignore" });
        }
    }
}

// The dev Chrome runs on a throwaway profile created as mkdtemp(tmpdir/"kime-dev-…"),
// so every dev Chrome's command line carries this prefix in its --user-data-dir.
// Matching on it scopes our kills to our own throwaway sessions — never the
// user's real Chrome.
const DEV_CHROME_PROFILE_PREFIX = "kime-dev";

// Tree-kill every chrome.exe whose command line contains `needle`. The captured
// PID is unreliable on Windows: Chrome's launcher detaches the real browser into
// a separate process tree, so a taskkill on the spawned PID can miss the actual
// windows (the same problem the Firefox launcher has — see killFirefoxByProfile).
// Matching the throwaway-profile name in the command line finds the detached tree.
function killChromeMatchingCommandLine(needle) {
    if (!needle) return;
    if (process.platform === "win32") {
        const escaped = needle.replace(/'/g, "''");
        spawnSync(
            "powershell.exe",
            [
                "-NoProfile",
                "-Command",
                `Get-CimInstance Win32_Process -Filter "Name='chrome.exe'" | Where-Object { $_.CommandLine -like '*${escaped}*' } | ForEach-Object { taskkill /PID $_.ProcessId /T /F }`,
            ],
            { stdio: "ignore" }
        );
    } else {
        spawnSync("pkill", ["-f", needle], { stdio: "ignore" });
    }
}

// Force-close the dev Chrome for a specific run by matching its unique throwaway
// profile dir name. Mirrors killFirefoxByProfile — scoped to that one session, so
// it never touches the user's own Chrome.
export function killChromeByProfile(profileDirs) {
    for (const dir of profileDirs) {
        killChromeMatchingCommandLine(basename(dir));
    }
}

// Clear *any* lingering dev Chrome left by an earlier run that didn't shut down
// cleanly (a crash or abrupt kill can strand a kime-dev Chrome on the debug port,
// which then breaks the next launch). Matches the shared kime-dev profile prefix,
// so it only ever reaps our own throwaway sessions, never the user's own Chrome.
export function killStrayDevChromes() {
    killChromeMatchingCommandLine(DEV_CHROME_PROFILE_PREFIX);
}

// A built-in test page served over http://localhost so the content script
// actually injects (it won't on file:/data:/about: URLs).
export const TEST_PAGE = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Korean IME — test page</title>
<style>
  :root {
    color-scheme: light dark;
    --hint-bg: light-dark(#f4f4f4, #333);
    --hint-color: light-dark(#555, #ccc);
    --content-editable-border: light-dark(#bbb, #555);
    --input-bg: light-dark(white, #222);
  }
  body { font: 16px system-ui, sans-serif; max-width: 720px; margin: 2rem auto; padding: 0 1rem; }
  h1 { font-size: 1.3rem; }
  .hint { color: var(--hint-color); background: var(--hint-bg); padding: .75rem 1rem; border-radius: 6px; }
  label { display: block; margin: 1.25rem 0 .35rem; font-weight: 600; }
  textarea, input { width: 100%; font-size: 1.1rem; padding: .5rem; box-sizing: border-box; background: var(--input-bg); }
  textarea { height: 6rem; }
  [contenteditable] { border: 1px solid var(--content-editable-border); border-radius: 4px; padding: .5rem; min-height: 3rem; font-size: 1.1rem; background: var(--input-bg); }
</style>
</head>
<body>
  <h1>Korean IME — test page</h1>
  <p class="hint">Toggle Hangul with the right-hand <b>Alt</b> key (or click the extension icon).
  Try <code>dkssudgktpdy</code> → 안녕하세요.</p>

  <label for="ta">textarea</label>
  <textarea id="ta" placeholder="Type here…"></textarea>

  <label for="ti">input[type=text]</label>
  <input id="ti" type="text" placeholder="Type here…" />

  <label>contenteditable</label>
  <div contenteditable></div>
</body>
</html>`;

// Serve the test page on a random localhost port. Resolves to { server, testUrl }.
export function startTestPageServer() {
    return new Promise((resolve) => {
        const server = createServer((_req, res) => {
            res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
            res.end(TEST_PAGE);
        });
        server.listen(0, "127.0.0.1", () => {
            resolve({ server, testUrl: `http://localhost:${server.address().port}/` });
        });
    });
}
