# Building the Firefox add-on (for AMO reviewers)

> This file exists to be pasted into the "source code" / reviewer-notes field
> when submitting to the Firefox Add-on store (AMO), which requires reproducible
> build instructions because the extension is bundled. Keep it in sync with the
> build scripts.

Step-by-step instructions to reproduce an exact copy of the submitted add-on.

## Environment requirements

- Operating system: any (Windows, macOS, or Linux) — the build is pure
  Node.js/WXT (Vite) with no OS-specific or native steps.
- Node.js **24** (the version in `.nvmrc`) and npm (bundled with Node.js).
  Install Node from <https://nodejs.org/>, or with
  [nvm](https://github.com/nvm-sh/nvm): `nvm install 24 && nvm use 24`.
- No other globally installed programs are required; all build tools are
  project-local dependencies installed by `npm ci`.

## Build steps

```sh
npm ci                   # install exact dependencies from package-lock.json
npm run package:firefox  # produces .output/korean-ime-<version>-firefox.zip
```

`package:firefox` runs every step needed to produce the add-on: validate
(message keys → type-check → lint → translation check → tests) → generate build
assets (`scripts/gen-assets.mjs`) → WXT production build (Firefox MV3) into
`.output/firefox-mv3/` → `wxt zip` that build into the add-on zip. WXT generates
the manifest — including the Firefox MV3 `background.scripts` form — from
`wxt.config.ts`. The contents of the resulting zip match the submitted add-on.
