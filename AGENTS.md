# AGENTS.md

Guidance for working in this repo. Keep it short and current.

## What this is

A **Chrome Manifest V3 extension** that lets people type Hangul (Korean) in the
browser without an OS-level Korean IME, plus romanization tools and a floating
on-screen keyboard. TypeScript, bundled with **Parcel**; the options page uses
**Vue 3**.

## Workflow

**`master` is protected — never commit to it directly.** All changes land via
pull request: branch off `master`, push the branch, open a PR, and merge it
(GitHub auto-deletes the merged branch). A direct push to `master` will be
rejected, so don't try it even for a one-line doc fix. Run `npm run validate`
before pushing so CI passes on the first try. After a merge, **confirm it via the
PR's merged state** (e.g. `gh pr view <n> --json state`) rather than inferring it
from local `git` — a local checkout that's behind `origin/master`, or that still
has the feature branch around, can look merged when it isn't (or vice versa).
`git checkout master && git pull` first if you do check locally.

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
| `npm run dev:chrome` | One-off dev build + launch Chrome on a persistent dev profile + test page (no watcher; re-run to rebuild — see `scripts/dev.mjs`). Add `--watch` for a live-reloading Parcel watcher. |
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
  adapter — see gotcha below) and **Word for the Web is off by default**
  (flag-gated on `KIME_ENABLE_WORD`). The `GoogleDocsAdapter` file is kept for
  reference but is no longer selected.
- **`src/romanization/`** — Hangul → Latin conversion.
- **`src/settings/`** — a plain typed `Settings` object + defaults
  (`settings.ts`), loaded/saved to `chrome.storage.sync` via `settings-store.ts`.
  Other contexts react to changes via `chrome.storage.onChanged` (the options
  page only writes — there is no options→service-worker message).
- **`src/keyboard/`** — `korean-keyboard-map.ts`: the `KeyCode` enum, the key
  map (`keyMap`), and key helpers (`isModifierKey`, `isAltKey`). Foundational —
  imported across `composition/`, `content-script/`, and `messaging/`.

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
  adds `background.scripts` to the *emitted* `dist-firefox/manifest.json` — the
  dual-key form Mozilla recommends, assembled after Parcel because it won't pass
  it through pre-build. `lint:firefox` (`web-ext lint`) validates the result;
  `BACKGROUND_SERVICE_WORKER_IGNORED` is the expected, correct warning.
- **Google Docs & Word for the Web use canvas + the EditContext API.** Docs
  ignores synthetic composition events entirely (input goes through an
  EditContext the page owns, not the DOM), so it's unsupported — the factory
  returns no adapter for it. Word still works via direct DOM editing but is on
  the same path, so it's disabled by default behind `KIME_ENABLE_WORD`
  (`npm run dev:chrome -- --enable-word`). Don't waste time trying to drive Docs with
  synthetic events; that door is closed (Google Input Tools only works via a
  private main-world bridge into Docs' internal `kix` editor).
- **`--load-extension` is dead in current Chrome.** Chrome 137+ removed the
  command-line switch (anti-malware), and by Chrome 148 the
  `--disable-features=DisableLoadExtensionCommandLineSwitch` opt-out no longer
  works either. So `npm run dev:chrome` can't auto-load into a throwaway profile
  — it uses a persistent `.chrome-profile/` where you "Load unpacked" once (from
  `dist-chrome-dev/`; dev builds are kept out of the production `dist-chrome/`).
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
