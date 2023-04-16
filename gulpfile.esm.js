import { series, src, dest, parallel } from "gulp";
import del from "del";
import replace from "gulp-replace";
import log from "fancy-log";
import packageJson from "./package.json";
import { compileAndBundleJavascript } from "./compileAndBundleJavascript";

const buildTasks = series(
    clean,
    reportProjectVersion,
    parallel(
        buildServiceWorker,
        buildContentScript,
        buildPopupConverter,
        buildOnScreenKeyboard,
        copyPopupConverterFiles,
        copyOnScreenKeyboardFiles,
        copyImages,
        copyLocales,
        processManifest,
    )
);

exports.dev = series(
    setBuildModeToDev,
    buildTasks
);

exports.prod = series(
    setBuildModeToProd,
    buildTasks
);

exports.clean = clean;

export let buildMode;

function setBuildModeToDev(cb) {
    buildMode = "dev";
    cb();
}

function setBuildModeToProd(cb) {
    buildMode = "prod";
    cb();
}

export function clean() {
    log("clean...");
    return del("dist");
}

function reportProjectVersion(cb) {
    log(packageJson.version);
    cb();
}

function copyImages() {
    return src("src/images/*").pipe(dest("dist/images"));
}

function copyLocales() {
    return src("src/_locales/**").pipe(dest("dist/_locales"));
}

function processManifest() {
    return src("src/manifest.json")
        .pipe(replace("[package-version]", packageJson.version))
        .pipe(dest("dist"));
}

function buildContentScript() {
    return compileAndBundleJavascript(
        ["src/contentScript/index.ts"],
        dest("dist"),
        "contentScript.js"
    );
}

function buildServiceWorker() {
    return compileAndBundleJavascript(
        ["src/serviceWorker/index.ts"],
        dest("dist"),
        "serviceWorker.js"
    );
}

function copyPopupConverterFiles() {
    const pcPath = "src/popup-converter";

    return src([`${pcPath}/*.html`, `${pcPath}/*.css`])
        .pipe(dest("dist/popup-converter"));
}

function buildPopupConverter() {
    return compileAndBundleJavascript(
        "src/popup-converter/popup-converter.ts",
        dest("dist/popup-converter"),
        "popup-converter.js"
    );
}

function copyOnScreenKeyboardFiles() {
    const oskPath = "src/popupKeyboard";

    return src([`${oskPath}/*.html`, `${oskPath}/*.css`])
        .pipe(dest("dist/popupKeyboard"));
}

function buildOnScreenKeyboard() {
    return compileAndBundleJavascript(
        "src/popupKeyboard/index.ts",
        dest("dist/popupKeyboard"),
        "index.js"
    );
}
