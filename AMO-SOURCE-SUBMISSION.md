# Building the Firefox add-on (for AMO reviewers)

> This file exists to be pasted into the "source code" / reviewer-notes field
> when submitting to the Firefox Add-on store (AMO), which requires reproducible
> build instructions because the extension is bundled. Keep it in sync with the
> build scripts.

Step-by-step instructions to reproduce an exact copy of the submitted add-on.

## Environment requirements

- Operating system: any (Windows, macOS, or Linux) — the build is pure
  Node.js/Parcel with no OS-specific or native steps.
- Node.js **24** (the version in `.nvmrc`) and npm (bundled with Node.js).
  Install Node from <https://nodejs.org/>, or with
  [nvm](https://github.com/nvm-sh/nvm): `nvm install 24 && nvm use 24`.
- No other globally installed programs are required; all build tools are
  project-local dependencies installed by `npm ci`.

## Build steps

```sh
npm ci                   # install exact dependencies from package-lock.json
npm run package:firefox  # produces korean-ime-<version>-firefox.zip
```

`package:firefox` runs every step needed to produce the add-on: validate
(type-check → lint → translation check → tests) → generate the Firefox manifest
from `src/manifest.base.json` (`scripts/build-manifest.mjs`) → Parcel production
build into `dist-firefox/` → patch the emitted manifest's background key
(`scripts/patch-firefox-manifest.mjs`) → `web-ext lint` → zip the contents of
`dist-firefox/`. The contents of the resulting zip match the submitted add-on.
