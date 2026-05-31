# CLAUDE.md

Guidance for working in this repo. Keep it short and current.

## What this is

A **Chrome Manifest V3 extension** that lets people type Hangul (Korean) in the
browser without an OS-level Korean IME, plus romanization tools and a floating
on-screen keyboard. TypeScript, bundled with **Parcel**; the options page uses
**Vue 3**.

## Commands

| Command | Purpose |
|---|---|
| `npm start` | Parcel watch mode — rebuilds to `dist/` on change |
| `npm run build` | Production build to `dist/`: `clean` → `sync-version` → `check` → `lint` → `parcel build` |
| `npm run build-dev` | Unoptimized dev build to `dist-dev/` |
| `npm run dev` | Watch + launch Chrome on a persistent dev profile + test page (see `scripts/dev.mjs`) |
| `npm run check` | Type-check only (`tsc --noEmit`) |
| `npm run lint` / `lint:fix` | ESLint (flat config in `eslint.config.mjs`) |
| `npm test` | Jest unit tests (ts-jest + jsdom) |
| `npm run package` | Build and zip `dist/` into `korean-ime-<version>.zip` (store upload) |

Load `dist/` as an unpacked extension at `chrome://extensions` (Developer mode → Load unpacked).

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
  **`composition-adapters/`** abstracts over editor types (plain input,
  contentEditable, Google Docs, Word for the Web, CKEditor); the right adapter
  is chosen by `composition-adapter-factory.ts`.
- **`src/romanization/`** — Hangul → Latin conversion.
- **`src/settings/`** — option definitions and a `SettingsManager` backed by
  `chrome.storage.sync`.

## Gotchas

- **Do NOT add `engines.node` to `package.json`.** Parcel reads it as a build
  target and the web-extension HTML transformer then fails with
  `invalid type: unit value, expected a sequence`. The Node version is pinned in
  `.nvmrc` (used by CI) instead.
- **`src/manifest.json` must keep its `version` field** — Parcel's manifest
  schema requires it and Chrome won't load the extension without it. (It was
  once dropped by accident and broke the build.) The build runs
  `npm run sync-version` to copy `package.json`'s version into the manifest, so
  **bump the version in `package.json`** and let the build propagate it.
- **`--load-extension` is dead in current Chrome.** Chrome 137+ removed the
  command-line switch (anti-malware), and by Chrome 148 the
  `--disable-features=DisableLoadExtensionCommandLineSwitch` opt-out no longer
  works either. So `npm run dev` can't auto-load into a throwaway profile — it
  uses a persistent `.chrome-profile/` where you "Load unpacked" once (from
  `dist-dev/`; dev builds are kept out of the production `dist/`).
- ESLint uses **flat config** (`eslint.config.mjs`). There is no `.eslintrc`.
- `tsc` is type-check only (`--noEmit`); Parcel does the actual bundling.
- Tracing decorator (`src/decorators/trace.ts`) is a no-op in production and
  logs method calls in dev — handy for debugging composition flow.

## Releases

The last published release was 2.2.x (Manifest V2, 2020), since removed from the
Chrome Web Store. 2.3.0 is the unreleased MV3 rewrite — see `CHANGELOG.md`.

Git tags were reconstructed after the fact. **All tags (v1.0.1–v2.2.2) are
approximate**: they're anchored to commits by best effort using the dates in
`CHANGELOG.md`, so they mark roughly where each release was, not exactly. 2.3.0
is intentionally untagged until it actually ships.

The full release checklist (bump → build → tag → push → upload) is in
`RELEASING.md`.
