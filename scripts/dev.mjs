// Dev launcher. Serves a localhost test page (the content script injects on
// http(s) pages, not file:/about:/data: URLs) and runs `wxt`, which builds,
// loads the extension into a throwaway browser profile, and opens the test page
// — wxt.config.ts `webExt.startUrls` points at the port below. Browser launch
// and teardown are WXT/web-ext's job now, so this is just the page + server
// (the Parcel-era dev-chrome/dev-firefox/dev-shared did all of that by hand).
//
// Args are forwarded to wxt, e.g. `node scripts/dev.mjs -b firefox --mv3`.

import { spawn } from "node:child_process";
import { createServer } from "node:http";

const PORT = 3344;

const TEST_PAGE = `<!DOCTYPE html>
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

const server = createServer((_req, res) => {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(TEST_PAGE);
});

server.listen(PORT, "127.0.0.1", () => {
    console.log(`[dev] test page → http://localhost:${PORT}/`);
});

const wxt = spawn("wxt", process.argv.slice(2), { stdio: "inherit", shell: true });

const shutdown = () => {
    server.close();
    if (!wxt.killed) {
        wxt.kill();
    }
};

wxt.on("exit", (code) => {
    server.close();
    process.exit(code ?? 0);
});
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
