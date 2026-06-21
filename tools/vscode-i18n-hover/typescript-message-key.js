"use strict";

const path = require("node:path");

const messageKeyTypePattern = /(^|[^\w$])MessageKey($|[^\w$])/;

class TypeScriptMessageKeyResolver {
    #output;
    #projects = new Map();
    #loggedMessages = new Set();

    constructor(output) {
        this.#output = output;
    }

    find(documentPath, documentText, offset, workspaceRoots) {
        const workspaceRoot = findOwningWorkspaceRoot(documentPath, workspaceRoots);
        if (!workspaceRoot) {
            return undefined;
        }

        const project = this.#getProject(workspaceRoot);
        if (!project) {
            return undefined;
        }

        try {
            return findContextualMessageKeyAtOffset({
                ts: project.ts,
                configPath: project.configPath,
                fileName: documentPath,
                text: documentText,
                offset,
            });
        } catch (error) {
            this.#logOnce(
                `semantic-hover-error:${workspaceRoot}:${error.message}`,
                `[typescript] semantic hover failed for ${documentPath}: ${error.message}`
            );
            return undefined;
        }
    }

    dispose() {
        this.#projects.clear();
    }

    #getProject(workspaceRoot) {
        if (this.#projects.has(workspaceRoot)) {
            return this.#projects.get(workspaceRoot);
        }

        const ts = loadTypeScript(workspaceRoot);
        if (!ts) {
            this.#logOnce(
                `typescript-missing:${workspaceRoot}`,
                `[typescript] could not load TypeScript from ${workspaceRoot}/node_modules`
            );
            this.#projects.set(workspaceRoot, undefined);
            return undefined;
        }

        const configPath = ts.findConfigFile(workspaceRoot, ts.sys.fileExists, "tsconfig.json");
        if (!configPath) {
            this.#logOnce(`tsconfig-missing:${workspaceRoot}`, `[typescript] no tsconfig.json found under ${workspaceRoot}`);
            this.#projects.set(workspaceRoot, undefined);
            return undefined;
        }

        const project = { configPath, ts };
        this.#projects.set(workspaceRoot, project);
        this.#logOnce(`project:${workspaceRoot}`, `[typescript] using ${configPath}`);
        return project;
    }

    #logOnce(key, message) {
        if (this.#loggedMessages.has(key)) {
            return;
        }

        this.#loggedMessages.add(key);
        this.#output?.appendLine(message);
    }
}

function findContextualMessageKeyAtOffset({ ts, configPath, fileName, text, offset }) {
    const parsedConfig = readParsedConfig(ts, configPath);
    if (!parsedConfig) {
        return undefined;
    }

    const useCaseSensitiveFileNames = ts.sys.useCaseSensitiveFileNames;
    const rootNames = includeFileName(parsedConfig.fileNames, fileName, useCaseSensitiveFileNames);
    const host = createOverlayCompilerHost(ts, parsedConfig.options, fileName, text);
    const program = ts.createProgram(rootNames, parsedConfig.options, host);
    const sourceFile = getSourceFile(program, fileName, useCaseSensitiveFileNames);
    if (!sourceFile) {
        return undefined;
    }

    const literal = findStringLiteralNodeAtOffset(ts, sourceFile, offset);
    if (!literal) {
        return undefined;
    }

    const checker = program.getTypeChecker();
    const contextualType = checker.getContextualType(literal);
    if (!contextualType || !typeIncludesMessageKey(ts, checker, contextualType)) {
        return undefined;
    }

    return {
        key: literal.text,
        start: literal.getStart(sourceFile),
        end: literal.getEnd(),
    };
}

function readParsedConfig(ts, configPath) {
    const config = ts.readConfigFile(configPath, ts.sys.readFile);
    if (config.error) {
        return undefined;
    }

    return ts.parseJsonConfigFileContent(config.config, ts.sys, path.dirname(configPath));
}

function createOverlayCompilerHost(ts, options, fileName, text) {
    const host = ts.createCompilerHost(options, true);
    const originalFileExists = host.fileExists.bind(host);
    const originalGetSourceFile = host.getSourceFile.bind(host);
    const originalReadFile = host.readFile.bind(host);
    const useCaseSensitiveFileNames = ts.sys.useCaseSensitiveFileNames;

    host.fileExists = (candidate) => {
        if (samePath(candidate, fileName, useCaseSensitiveFileNames)) {
            return true;
        }

        return originalFileExists(candidate);
    };

    host.getSourceFile = (candidate, languageVersion, onError, shouldCreateNewSourceFile) => {
        if (samePath(candidate, fileName, useCaseSensitiveFileNames)) {
            return ts.createSourceFile(candidate, text, languageVersion, true, scriptKindForFile(ts, candidate));
        }

        return originalGetSourceFile(candidate, languageVersion, onError, shouldCreateNewSourceFile);
    };

    host.readFile = (candidate) => {
        if (samePath(candidate, fileName, useCaseSensitiveFileNames)) {
            return text;
        }

        return originalReadFile(candidate);
    };

    return host;
}

function findStringLiteralNodeAtOffset(ts, sourceFile, offset) {
    let found;

    function visit(node) {
        if (offset < node.getStart(sourceFile) || offset > node.getEnd()) {
            return;
        }

        if (isStringLiteralLike(ts, node)) {
            found = node;
        }

        ts.forEachChild(node, visit);
    }

    visit(sourceFile);
    return found;
}

function isStringLiteralLike(ts, node) {
    return ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node);
}

function typeIncludesMessageKey(ts, checker, type, seen = new Set()) {
    if (!type || seen.has(type)) {
        return false;
    }

    seen.add(type);

    if (symbolNameIsMessageKey(checker, type.aliasSymbol) || symbolNameIsMessageKey(checker, type.symbol)) {
        return true;
    }

    const typeText = checker.typeToString(type, undefined, ts.TypeFormatFlags.UseAliasDefinedOutsideCurrentScope);
    if (messageKeyTypePattern.test(typeText)) {
        return true;
    }

    if (type.isUnion?.()) {
        return type.types.some((child) => typeIncludesMessageKey(ts, checker, child, seen));
    }

    return false;
}

function symbolNameIsMessageKey(checker, symbol) {
    return symbol ? checker.symbolToString(symbol) === "MessageKey" : false;
}

function loadTypeScript(workspaceRoot) {
    const candidates = [path.join(workspaceRoot, "node_modules", "typescript"), "typescript"];

    for (const candidate of candidates) {
        try {
            return require(candidate);
        } catch {
            // Try the next candidate.
        }
    }

    return undefined;
}

function includeFileName(fileNames, fileName, useCaseSensitiveFileNames) {
    if (fileNames.some((candidate) => samePath(candidate, fileName, useCaseSensitiveFileNames))) {
        return fileNames;
    }

    return [...fileNames, fileName];
}

function getSourceFile(program, fileName, useCaseSensitiveFileNames) {
    return (
        program.getSourceFile(fileName) ??
        program.getSourceFiles().find((sourceFile) => samePath(sourceFile.fileName, fileName, useCaseSensitiveFileNames))
    );
}

function findOwningWorkspaceRoot(documentPath, workspaceRoots) {
    return workspaceRoots
        .map((workspaceRoot) => path.resolve(workspaceRoot))
        .filter((workspaceRoot) => isPathInside(documentPath, workspaceRoot))
        .sort((left, right) => right.length - left.length)[0];
}

function isPathInside(child, parent) {
    const relative = path.relative(parent, path.resolve(child));
    return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function samePath(left, right, useCaseSensitiveFileNames) {
    const normalizedLeft = normalizePath(left, useCaseSensitiveFileNames);
    const normalizedRight = normalizePath(right, useCaseSensitiveFileNames);
    return normalizedLeft === normalizedRight;
}

function normalizePath(fileName, useCaseSensitiveFileNames) {
    const normalized = path.normalize(path.resolve(fileName));
    return useCaseSensitiveFileNames ? normalized : normalized.toLowerCase();
}

function scriptKindForFile(ts, fileName) {
    if (fileName.endsWith(".tsx")) {
        return ts.ScriptKind.TSX;
    }

    if (fileName.endsWith(".jsx")) {
        return ts.ScriptKind.JSX;
    }

    if (fileName.endsWith(".js")) {
        return ts.ScriptKind.JS;
    }

    return ts.ScriptKind.TS;
}

module.exports = {
    TypeScriptMessageKeyResolver,
    findContextualMessageKeyAtOffset,
};
