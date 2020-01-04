import { series, src, dest, parallel } from "gulp";
import browserify from "browserify";
import babelify from "babelify";
import del from "del";
import glob from "glob";
import source from "vinyl-source-stream";
import eventStream from "event-stream";
import path from "path";
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
    return src("src/manifest.json")
        .pipe(dest("dist"));
}

function js() {
    return compileJs(
        ["src/background.js", "src/content.js"],
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
        "src/popup-converter/popup-converter.js",
        dest("dist/popup-converter/")
    );
}

/**
 * @param {string|string[]} globs 
 * @param {NodeJS.ReadWriteStream} dest 
 */
function compileJs(globs, dest) {
    globs = Array.isArray(globs) ? globs : [globs];

    /** @type {string[]} */
    const files = globs.map(g => {
        return glob.sync(g);
    }).flat();

    const browserfied = eventStream.merge.apply(null, files.map(entry => 
        browserify({
                entries: entry,
                debug: true,
                transform: babelify
            })
            .bundle()
            .pipe(source(path.basename(entry)))
    ));

    return browserfied.pipe(dest);
}
