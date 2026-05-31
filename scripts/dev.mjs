// Dev loop: starts Parcel in watch mode (which auto-reloads the extension on
// rebuild) and launches Chrome with the extension available, opening a built-in
// test page served over http://localhost so the content script actually injects
// (it won't on data:/about: URLs).
//
// NOTE on loading the extension: Chrome 137+ removed the --load-extension
// command-line switch (anti-malware hardening), and by Chrome 148 even the
// --disable-features=DisableLoadExtensionCommandLineSwitch opt-out no longer
// works. So we can't auto-load into a throwaway profile any more. Instead we use
// a *persistent* dev profile: you "Load unpacked" once, and every later run
// reuses the profile with the extension still installed. Because the unpacked
// extension is read from dist/ on each launch (and Parcel keeps rebuilding into
// the same dir, with HMR auto-reload during the session), it stays current.
//
// chrome-launcher is used only to locate the Chrome binary. Close the Chrome
// window or press Ctrl+C to stop everything.

import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:http";
import { existsSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import * as ChromeLauncher from "chrome-launcher";

const root = process.cwd();
// Dev builds go to dist-dev/ so they can never be mistaken for, or clobber, the
// production dist/ that `npm run package` ships. Keep this in sync with the
// --dist-dir in the "start" npm script.
const distDir = resolve(root, "dist-dev");
const profileDir = resolve(root, ".chrome-profile");

const TEST_PAGE = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Korean IME — test page</title>
<style>
  body { font: 16px system-ui, sans-serif; max-width: 720px; margin: 2rem auto; padding: 0 1rem; }
  h1 { font-size: 1.3rem; }
  .hint { color: #555; background: #f4f4f4; padding: .75rem 1rem; border-radius: 6px; }
  label { display: block; margin: 1.25rem 0 .35rem; font-weight: 600; }
  textarea, input { width: 100%; font-size: 1.1rem; padding: .5rem; box-sizing: border-box; }
  textarea { height: 6rem; }
  [contenteditable] { border: 1px solid #bbb; border-radius: 4px; padding: .5rem; min-height: 3rem; font-size: 1.1rem; }
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

let server;
let watch;
let chrome;
let shuttingDown = false;

// child.kill() only kills the immediate process. `npm start` runs through a
// shell and spawns Parcel underneath, so on Windows we must kill the whole tree
// or Parcel keeps holding the HMR port (1234) after we exit.
function killTree(proc) {
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

function shutdown(code = 0) {
    if (shuttingDown) return;
    shuttingDown = true;
    killTree(chrome);
    killTree(watch);
    server?.close();
    process.exit(code);
}

process.on("uncaughtException", (err) => {
    console.error("[dev] uncaught error:", err);
    shutdown(1);
});
process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

// 1. Serve the test page on a random localhost port.
server = createServer((_req, res) => {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(TEST_PAGE);
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const testUrl = `http://localhost:${server.address().port}/`;

// 2. Start Parcel watch (via `npm start`) and wait for the first completed build.
watch = spawn("npm", ["start"], {
    shell: true,
    stdio: ["inherit", "pipe", "inherit"],
    env: { ...process.env, NODE_ENV: "development" },
});
watch.on("exit", (code) => {
    if (!shuttingDown) {
        console.error(`[dev] Parcel watch exited (code ${code}). Shutting down.`);
        shutdown(1);
    }
});

await new Promise((resolveBuild) => {
    let built = false;
    const timeout = setTimeout(() => {
        console.error("[dev] Timed out waiting for the first Parcel build.");
        shutdown(1);
    }, 120000);
    // Permanent listener: always drain + tee Parcel's stdout (detaching it
    // would stall the pipe and crash Parcel with EPIPE), resolving on a build.
    watch.stdout.on("data", (chunk) => {
        process.stdout.write(chunk);
        if (!built && /Built in/i.test(chunk.toString())) {
            built = true;
            clearTimeout(timeout);
            resolveBuild();
        }
    });
});

// 3. Launch Chrome on the persistent dev profile.
const chromePath = process.env.CHROME_PATH || ChromeLauncher.Launcher.getFirstInstallation();
if (!chromePath) {
    console.error("[dev] Could not find Chrome. Set CHROME_PATH to the chrome executable.");
    shutdown(1);
}

const firstRun = !existsSync(profileDir);
mkdirSync(profileDir, { recursive: true });

// On first run, also open the extensions page so the one-time load is easy.
const urls = firstRun ? ["chrome://extensions", testUrl] : [testUrl];
const args = [`--user-data-dir=${profileDir}`, "--no-first-run", "--no-default-browser-check", ...urls];

chrome = spawn(chromePath, args, { stdio: "ignore" });
const launchedAt = Date.now();

chrome.on("exit", () => {
    if (!shuttingDown && Date.now() - launchedAt < 3000) {
        console.error("\n[dev] Chrome exited almost immediately — it may have handed off to an");
        console.error("[dev] already-running Chrome. Close ALL other Chrome windows and re-run.\n");
    }
    shutdown(0);
});

if (firstRun) {
    console.log("\n[dev] First run on this dev profile — load the extension once:");
    console.log("[dev]   1. On the chrome://extensions tab, turn on \"Developer mode\" (top right).");
    console.log('[dev]   2. Click "Load unpacked" and select:');
    console.log(`[dev]        ${distDir}`);
    console.log("[dev]   It stays loaded for future `npm run dev` runs (Parcel still auto-reloads it).");
}
console.log(`\n[dev] Dev profile:  ${profileDir}`);
console.log(`[dev] Extension:    ${distDir}`);
console.log(`[dev] Test page:    ${testUrl}`);
console.log("[dev] Edit & save to rebuild (auto-reloads). Close Chrome or press Ctrl+C to stop.\n");
