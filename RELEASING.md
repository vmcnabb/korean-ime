# Releasing

A release checklist so this is a routine, not archaeology. Versioning is
single-source-of-truth from `package.json`; the build propagates it into the
manifest (see [CLAUDE.md](CLAUDE.md) → *Releases*).

## 1. Pre-flight

```sh
git checkout master
git pull
git status        # working tree should be clean
npm ci            # match the lockfile
npm test          # tests green
```

## 2. Bump the version

Edit **`package.json`** only — `"version": "X.Y.Z"`. Do **not** hand-edit the
manifest version; the build generates `src/manifest.json` from
`src/manifest.base.json` and fills in the version from `package.json` (see
CLAUDE.md → the manifest gotcha).

Follow semver: patch for fixes, minor for features, major for breaking changes.

## 3. Update the changelog

In `CHANGELOG.md`, give the new version a real release date (replace any
"release candidate" line) and list the user-facing changes since the last
release.

## 4. Build both targets

```sh
npm run build
```

First run the full gate, then build **both** targets:

```sh
npm run validate   # check (tsc) → lint → check-translations → tests
```

`npm run build` builds Chrome then Firefox (pure builds — gates live in
`validate`) into **`dist-chrome/`** and **`dist-firefox/`**. (The
`package:chrome` / `package:firefox` scripts run `validate` themselves, so step 7
re-checks anyway — but don't ship a red `validate`.)

## 5. Smoke-test the build

Load the freshly built extension in each browser and click through the basics:

- **Chrome:** `chrome://extensions` → **Developer mode** → **Load unpacked** → `dist-chrome/`.
- **Firefox:** `about:debugging` → **This Firefox** → **Load Temporary Add-on** → pick `dist-firefox/manifest.json`.

In each:
1. Toggle Hangul with the right-hand **Alt**, type in a normal input.
2. Right-click selected Hangul → **Romanize**.
3. Toggle the on-screen keyboard from the context menu.
4. Open the options page and confirm settings apply.

## 6. Commit and tag

```sh
git add package.json CHANGELOG.md
git commit -m "Release vX.Y.Z"
git tag -a vX.Y.Z -m "vX.Y.Z"
git push
git push --tags
```

(`src/manifest.json` is generated and gitignored, so it isn't committed. Tags
`v1.0.1`–`v2.2.2` are approximate, reconstructed after the fact. From 2.3.0
onward, tags are exact — created at release time from the real commit.)

## 7. Package for the stores

Packaging is per-browser — produce each zip separately:

```sh
npm run package:chrome     # → korean-ime-<version>-chrome.zip   (Web Store)
npm run package:firefox    # → korean-ime-<version>-firefox.zip  (AMO)
```

Each re-runs its build and zips the *contents* of the dist dir (with
`manifest.json` at the zip root, as the stores require). `package:firefox` also
runs `web-ext lint`. The zips are git-ignored. (`npm run package` with no target
just prints a reminder to pick one.)

## 8. Upload and submit

**Chrome Web Store**
1. Open the [Developer Dashboard](https://chrome.google.com/webstore/devconsole).
2. Select the **Korean IME** item
   ([store listing](https://chromewebstore.google.com/detail/korean-ime/cimmbifnciobjhchpimjekibbndgmkfk)).
3. Upload `korean-ime-<version>-chrome.zip`, review the listing, **submit for review**.

**Firefox Add-ons (AMO)**
1. Open the [Add-on Developer Hub](https://addons.mozilla.org/developers/).
2. Upload `korean-ime-<version>-firefox.zip` as a new version.
3. AMO requires the **source code** for review (the extension is bundled). Submit
   a `git archive` of the tagged commit — `git archive --format=zip -o source.zip vX.Y.Z` —
   the README's "Building the Firefox add-on" section is the reviewer build guide.

The version must be higher than the last published one (on each store). Note the
2.2.0 accident in the changelog — a published version number can never be
lowered, so double-check before submitting.

## Notes

- The first 3.x/MV3 submission (2.3.0) is what brings the extension back to the
  store after it was removed for still being Manifest V2.
- Don't add `engines.node` to `package.json` to "help" CI — it breaks the
  Parcel build (see CLAUDE.md). The Node version is pinned in `.nvmrc`.
