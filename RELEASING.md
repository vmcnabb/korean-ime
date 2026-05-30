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
manifest version; `npm run sync-version` (part of the build) copies it across.

Follow semver: patch for fixes, minor for features, major for breaking changes.

## 3. Update the changelog

In `CHANGELOG.md`, give the new version a real release date (replace any
"release candidate" line) and list the user-facing changes since the last
release.

## 4. Build

```sh
npm run build
```

This runs `clean` → `sync-version` → `check` (tsc) → `lint` → `parcel build`,
producing the unpacked extension in **`dist/`**. If it doesn't pass cleanly,
stop and fix — don't ship a red build.

## 5. Smoke-test the build

Load the freshly built extension and click through the basics:

1. `chrome://extensions` → **Developer mode** → **Load unpacked** → select `dist/`.
2. Toggle Hangul with the right-hand **Alt**, type in a normal input.
3. Right-click selected Hangul → **Romanize**.
4. Toggle the on-screen keyboard from the context menu.

## 6. Commit and tag

```sh
git add package.json src/manifest.json CHANGELOG.md
git commit -m "Release vX.Y.Z"
git tag -a vX.Y.Z -m "vX.Y.Z"
git push
git push --tags
```

(Tags `v1.0.1`–`v2.2.2` are approximate, reconstructed after the fact. From
2.3.0 onward, tags are exact — created at release time from the real commit.)

## 7. Package for the Chrome Web Store

The store wants a `.zip` whose **root** contains `manifest.json` — i.e. zip the
*contents* of `dist/`, not the `dist/` folder:

```powershell
Compress-Archive -Path dist/* -DestinationPath korean-ime-X.Y.Z.zip -Force
```

## 8. Upload and submit

1. Open the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole).
2. Select the **Korean IME** item
   ([store listing](https://chromewebstore.google.com/detail/korean-ime/cimmbifnciobjhchpimjekibbndgmkfk)).
3. Upload the new `.zip`, review the listing, and **submit for review**.
4. The version must be higher than the last published one. Note the 2.2.0
   accident in the changelog — a published version number can never be
   lowered, so double-check before submitting.

## Notes

- The first 3.x/MV3 submission (2.3.0) is what brings the extension back to the
  store after it was removed for still being Manifest V2.
- Don't add `engines.node` to `package.json` to "help" CI — it breaks the
  Parcel build (see CLAUDE.md). The Node version is pinned in `.nvmrc`.
