import { series, src, dest, parallel } from "gulp";
import browserify from "gulp-browserify";
import babelify from "babelify";
import del from "del";

import log from "fancy-log";
import packageJson from "./package.json";

exports.default = series(
    clean,
    reportProjectVersion,
    popupConverterFiles,
    parallel(
        js,
        popupConverterJs,
        images,
        locales,
        manifest
    )
);

export function clean(cb) {
    log("clean...");
    return del("dist");
}

function reportProjectVersion(cb) {
    log(packageJson.version);
    cb();
}

function images() {
    return src("src/images/*").pipe(dest("dist/images"));
}

function locales() {
    return src("src/_locales/**").pipe(dest("dist/_locales"));
}

function manifest() {
    return src("src/manifest.json").pipe(dest("dist"));
}

function js() {
    return compileJs(
        src(["src/background.js", "src/content.js"]),
        dest("dist")
    );
}

function popupConverterFiles() {
    const path = "src/popup-converter";

    return src([`${path}/*.html`, `${path}/*.css`])
        .pipe(dest("dist/popup-converter"));
}

function popupConverterJs() {
    return compileJs(
        src("src/popup-converter/popup-converter.js"),
        dest("dist/popup-converter/")
    );
}

/**
 * @param {NodeJS.ReadWriteStream} src 
 * @param {NodeJS.ReadWriteStream} dest 
 */
function compileJs(src, dest) {
    const browserfied = src.pipe(browserify({
        "transform": babelify
    }));

    return browserfied.pipe(dest);
}
