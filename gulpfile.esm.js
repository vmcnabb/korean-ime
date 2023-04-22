import { series, src, dest, parallel } from "gulp";
import del from "del";
import replace from "gulp-replace";
import log from "fancy-log";
import packageJson from "./package.json";
import { compileAndBundleTypescript } from "./compile-and-bundle-typescript";
const sass = require('gulp-sass')(require('sass'));

const buildTasks = series(
    clean,
    reportProjectVersion,
    buildServiceWorker,
    buildContentScript,
    buildStyles,
    buildPopupConverter,
    copyPopupConverterFiles,
    copyImages,
    copyLocales,
    processManifest,
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
    buildMode = "development";
    cb();
}

function setBuildModeToProd(cb) {
    buildMode = "production";
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
    return compileAndBundleTypescript(
        ["src/content-script/index.ts"],
        dest("dist"),
        "contentScript.js"
    );
}

function buildStyles() {
    return src("src/**/*.scss")
        .pipe(sass().on("error", sass.logError))
        .pipe(dest("dist"));
}

function buildServiceWorker() {
    return compileAndBundleTypescript(
        ["src/service-worker/index.ts"],
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
    return compileAndBundleTypescript(
        "src/popup-converter/popup-converter.ts",
        dest("dist/popup-converter"),
        "popup-converter.js"
    );
}
