# Fonts

This directory contains source font assets used at build time when rasterizing
SVG artwork into PNG files.

These font files are used by `scripts/build-manifest.mjs` and are not packaged
into the browser extension bundles.

## Included Font

Nanum Myeongjo

- Current build asset: `Nanum_Myeongjo/NanumMyeongjo-Bold.ttf`
- License text: `Nanum_Myeongjo/OFL.txt`
- Current use: bundled font for generating the action icon PNGs from SVG
  sources

## When Adding Fonts

- Keep each font family in its own subdirectory.
- Include the upstream license text with the font files.
- Prefer redistributable open-source licenses.