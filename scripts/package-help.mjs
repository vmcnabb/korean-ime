// `npm run package` has no single meaning: Chrome and Firefox are packaged
// separately (different builds, different stores, often released at different
// times). Rather than silently pick one, point the user at the explicit target
// scripts and exit non-zero so it's not mistaken for a successful package.

console.error("Packaging is per-browser. Run one of:");
console.error("  npm run package:chrome    → korean-ime-<version>-chrome.zip");
console.error("  npm run package:firefox   → korean-ime-<version>-firefox.zip");
process.exit(1);
