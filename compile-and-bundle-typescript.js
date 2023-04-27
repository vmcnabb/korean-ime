import browserify from "browserify";
import babelify from "babelify";
import glob from "glob";
import source from "vinyl-source-stream";
import eventStream from "event-stream";
import path from "path";
import replace from "gulp-replace";
import terser from "gulp-terser";
import buffer from "vinyl-buffer";
import { buildMode } from "./gulpfile.esm";
import tsify from "tsify";
const envify = require('loose-envify/custom')

/**
 * Compiles TS files into a single file for the browser.
 *
 * @param {string|string[]} globs
 * @param {NodeJS.ReadWriteStream} dest destination directory
 * @param {string} [rename] new name for the output file
 */
export function compileAndBundleTypescript(globs, dest, rename = null) {
    globs = [].concat(globs);

    /** @type {string[]} */
    const files = globs.map(g => {
        return glob.sync(g);
    }).flat();


    let browserfied = eventStream.merge.apply(
        null,
        files.map(entry =>
            browserify({
                entries: entry,
                debug: buildMode === "development"
            })
                .plugin(tsify, { noImplicitAny: true })
                .transform(babelify)
                .transform(envify({ NODE_ENV: buildMode }))
                .bundle()
                .pipe(source(rename || path.basename(entry)))
                .pipe(buffer())
        ));

    if (buildMode === "production") {
        browserfied = browserfied
            .pipe(terser())
            .pipe(replace(/console\.debug\((.*?)\);/g, ""));
    }

    return browserfied.pipe(dest);
}

