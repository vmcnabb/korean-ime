# AGENTS.md

Guidance for working in this repo. Keep it short and current.

## What this is

A **Chrome Manifest V3 extension** that lets people type Hangul (Korean) in the
browser without an OS-level Korean IME, plus romanization tools and a floating
on-screen keyboard. TypeScript, bundled with **Parcel**; the options page uses
**Vue 3**.

## Workflow

Features and fixes should start with a GitHub issue. Branch off `master` using
`issue/<issue-number>-<short-kebab-case-description>` (release prep keeps its
own `release/vX.Y.Z` branch pattern). Open a PR that references the issue and
run `npm run validate` before pushing so CI passes on the first try. `master` is
protected, so changes are merged through PRs and GitHub auto-deletes the merged
branch. After a merge, **confirm it via the PR's merged state** (e.g. `gh pr
view <n> --json state`) rather than inferring it from local `git` — a local
checkout that's behind `origin/master`, or that still has the feature branch
around, can look merged when it isn't (or vice versa). `git checkout master &&
git pull` first if you do check locally.

## Commands

| Command | Purpose |
|---|---|
| `npm run start:chrome` | Parcel watch mode (Chrome) — rebuilds to `dist-chrome-dev/` on change |
| `npm run build` | Build **both** targets (Chrome + Firefox) — all-targets sanity build |
| `npm run build:chrome` | Production Chrome build to `dist-chrome/`: `clean` → `gen-manifest:chrome` → `parcel build` (no gates — run `validate` separately) |
| `npm run validate` | `check` + `lint` + `check-translations` + `test` — the full gate (also run by `package:*` and CI) |
| `npm run build:firefox` | Firefox build to `dist-firefox/` (see Firefox build note below) |
| `npm run lint:firefox` | `web-ext lint` the Firefox build in `dist-firefox/` |
| `npm run build-dev:chrome` | Unoptimized dev Chrome build to `dist-chrome-dev/` |
| `npm run dev:chrome` | One-off dev build + launch Chrome on a fresh throwaway profile, auto-load the extension over CDP, open a test page (no watcher; re-run to rebuild — see `scripts/dev.mjs`). Add `--watch` for a live-reloading Parcel watcher. |
| `npm run dev:firefox` | One-off dev build (to `dist-firefox-dev/`, patched) + launch Firefox via `web-ext` with the extension as a temporary add-on on a throwaway profile, open a test page (see `scripts/dev-firefox.mjs`). Add `--watch` to rebuild → re-patch → reload on change. Set `FIREFOX_PATH` to override the binary. |
| `npm run check` | Type-check only (`tsc --noEmit`) |
| `npm run lint` / `lint:fix` | ESLint (flat config in `eslint.config.mjs`) |
| `npm test` | Jest unit tests (ts-jest + jsdom) |
| `npm run package` | Prints guidance — packaging is per-browser (run `package:chrome` or `package:firefox`) |
| `npm run package:chrome` | Chrome build + zip `dist-chrome/` into `korean-ime-<version>-chrome.zip` (Web Store upload) |
| `npm run package:firefox` | Firefox build + `web-ext lint` + zip `dist-firefox/` into `korean-ime-<version>-firefox.zip` (AMO upload) |

Load `dist-chrome/` as an unpacked extension at `chrome://extensions` (Developer mode → Load unpacked).

## Architecture

The extension has three runtime contexts that talk via typed messages in `src/messaging/`:

- **`src/service-worker/`** — background service worker. `state-manager.ts` holds
  per-tab state (Hangul/Latin mode, on-screen-keyboard toggle) and is
  dependency-injected into the listeners (`content-script-listener.ts`,
  `menus.ts`, `action.ts`). Also hosts romanize context-menu actions and the
  romanize popup converter.
- **`src/content-script/`** — injected into all frames. Drives the IME on the
  focused element and renders the on-screen keyboard (`on-screen-keyboard/`).
- **`src/options-app/`** — Vue 3 options page.

Core domain logic (mostly pure, well unit-tested):

- **`src/composition/`** — the heart of the IME. `hangul-compositor.ts` assembles
  jamo into syllable blocks (`hangul-block.ts`, `hangul-maps.ts`).
  `hangul-ime-controller.ts` interprets keydown events and drives composition.
  **`composition-adapters/`** abstracts over editor types; the right adapter is
  chosen by `composition-adapter-factory.ts`. Active adapters: plain input,
  contentEditable, CKEditor. **Google Docs is unsupported** (factory returns no
  adapter — see gotcha below). The `GoogleDocsAdapter` file is kept for
  reference but is no longer selected.
- **`src/romanization/`** — Hangul → Latin conversion.
- **`src/settings/`** — a plain typed `Settings` object + defaults
  (`settings.ts`), loaded/saved to `chrome.storage.sync` via `settings-store.ts`.
  Other contexts react to changes via `chrome.storage.onChanged` (the options
  page only writes — there is no options→service-worker message).
- **`src/keyboard/`** — `korean-keyboard-map.ts`: the `KeyCode` enum, the key
  map (`keyMap`), and key helpers (`isModifierKey`, `isAltKey`). Foundational —
  imported across `composition/`, `content-script/`, and `messaging/`.
- Translation tone, locale inheritance, and regional wording guidance live in
  `TRANSLATIONS.md`; required complete locales are configured in
  `scripts/translations.config.json`.

## Gotchas

- **Do NOT add `engines.node` to `package.json`.** Parcel reads it as a build
  target and the web-extension HTML transformer then fails with
  `invalid type: unit value, expected a sequence`. The Node version is pinned in
  `.nvmrc` (used by CI) instead.
- **`src/manifest.json` is generated — do not edit it.** It's produced from
  `src/manifest.base.json` by `scripts/build-manifest.mjs` (run as
  `gen-manifest:chrome` before a Chrome build, and inline in `build:firefox`)
  and is gitignored. Edit `manifest.base.json` for shared
  fields; `version` comes from `package.json` (so **bump the version there**) and
  the per-browser `background` key + browser-specific settings come from the
  target overrides in `build-manifest.mjs`. Parcel requires the generated file to
  be named exactly `manifest.json` and to sit in `src/` beside the assets it
  references (relative paths like `images/`, `_locales/`), which is why it's
  generated in place.
- **Firefox build needs a post-build manifest patch.** Firefox MV3 requires
  `background.scripts` (it doesn't support `service_worker`), but Parcel's
  webextension transformer *only* accepts `service_worker` and rejects a manifest
  with both keys. So `build:firefox` generates a `service_worker` manifest (what
  Parcel allows), lets Parcel bundle, then `scripts/patch-firefox-manifest.mjs`
  rewrites the *emitted* `dist-firefox/manifest.json`, swapping `service_worker`
  for `background.scripts` (dropping the `service_worker` key Firefox ignores),
  assembled after Parcel because it won't pass `scripts` through pre-build. We
  swap rather than keep both keys because this manifest is Firefox-only — Mozilla's
  dual-key form only helps a single manifest shared across browsers, and keeping
  `service_worker` here would just earn a `BACKGROUND_SERVICE_WORKER_IGNORED`
  warning from `web-ext lint` for no benefit. `lint:firefox` (`web-ext lint`)
  validates the result. In
  `dev:firefox --watch` this patch must re-run after *every* Parcel rebuild
  (Parcel re-emits the `service_worker`-only manifest each time), and the Firefox
  reload must fire only after the patch — `scripts/dev-firefox.mjs` drives that
  `rebuild → patch → reload` sequence (web-ext's own auto-reload is disabled).
- **`dev:firefox` needs a detached reaper to close Firefox on Ctrl+C.** Firefox's
  Windows launcher process detaches the real browser from the PID web-ext
  spawned, so web-ext's `runner.exit()` can't kill it; worse, Ctrl+C through
  npm/cmd can kill the launcher node before its SIGINT cleanup runs at all. So
  `dev-firefox.mjs` spawns `scripts/firefox-reaper.mjs` *detached* (its own
  process group, immune to the same Ctrl+C); it waits for the launcher PID to
  die, then tree-kills the Firefox matching our throwaway profile dir name
  (scoped so it never touches the user's own Firefox).
- **Google Docs uses canvas + the EditContext API.** Docs
  ignores synthetic composition events entirely (input goes through an
  EditContext the page owns, not the DOM), so it's unsupported — the factory
  returns no adapter for it. Don't waste time trying to drive Docs with
  synthetic events; that door is closed (Google Input Tools only works via a
  private main-world bridge into Docs' internal `kix` editor).
- **`--load-extension` is dead in current Chrome, so `dev:chrome` loads over
  CDP.** Chrome 137+ removed the command-line switch (anti-malware), and by Chrome
  148 the `--disable-features=DisableLoadExtensionCommandLineSwitch` opt-out no
  longer works either. So `npm run dev:chrome` instead launches Chrome on a
  *fresh throwaway profile* with `--enable-unsafe-extension-debugging` +
  `--remote-debugging-pipe` and loads `dist-chrome-dev/` over the DevTools
  Protocol (`Extensions.loadUnpacked`). The Extensions domain is gated to the
  **pipe** transport (fd 3/4) — over `--remote-debugging-port` it returns "Method
  not available", so the port is kept only for VS Code debugging + `/json`
  polling. No manual "Load unpacked" step, and the throwaway profile means no
  stale extension to uninstall. Needs a recent Chrome (we assume the latest). The
  temp profile is removed on shutdown; `.chrome-profile/` now only holds the
  stop-dev session file. Dev builds stay out of the production `dist-chrome/`.
- ESLint uses **flat config** (`eslint.config.mjs`). There is no `.eslintrc`.
- `tsc` is type-check only (`--noEmit`); Parcel does the actual bundling.
- A **husky pre-commit hook** (`.husky/pre-commit`, installed via the `prepare`
  script on `npm install`) runs `lint-staged` (ESLint `--fix` on staged files)
  then `npm run check`. Commits with lint/type errors are blocked; `--no-verify`
  bypasses.
- Tracing decorator (`src/decorators/trace.ts`) is a no-op in production and
  logs method calls in dev — handy for debugging composition flow.

## Releases

For information on each release, see `CHANGELOG.md`.

The full release checklist is in `RELEASING.md`.

### Note
The first release to be properly tagged in the repo is 2.3.0.

All previous Git tags (v1.0.1–v2.2.2) were reconstructed after the fact on the day we did the 2.3.0 release
and are approximate: they're anchored to commits by best effort using the dates in
`CHANGELOG.md`, so they mark roughly where each release was, not exactly.
