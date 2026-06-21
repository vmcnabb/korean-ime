"use strict";

import * as path from "node:path";
import { createRequire } from "node:module";
import type * as ts from "typescript";

type TypeScriptModule = typeof import("typescript");
const requireFromExtension = createRequire(__filename);

export type ContextualMessageKeyHit = {
    key: string;
    start: number;
    end: number;
};

type Project = {
    configPath: string;
    ts: TypeScriptModule;
};

type OutputChannelLike = {
    appendLine(message: string): void;
};

const messageKeyTypePattern = /(^|[^\w$])MessageKey($|[^\w$])/;

export class TypeScriptMessageKeyResolver {
    #output: OutputChannelLike | undefined;
    #projects = new Map<string, Project | undefined>();
    #loggedMessages = new Set<string>();

    constructor(output?: OutputChannelLike) {
        this.#output = output;
    }

    find(
        documentPath: string,
        documentText: string,
        offset: number,
        workspaceRoots: string[]
    ): ContextualMessageKeyHit | undefined {
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
            const message = error instanceof Error ? error.message : String(error);
            this.#logOnce(
                `semantic-hover-error:${workspaceRoot}:${message}`,
                `[typescript] semantic hover failed for ${documentPath}: ${message}`
            );
            return undefined;
        }
    }

    dispose(): void {
        this.#projects.clear();
    }

    #getProject(workspaceRoot: string): Project | undefined {
        if (this.#projects.has(workspaceRoot)) {
            return this.#projects.get(workspaceRoot);
        }

        const tsModule = loadTypeScript(workspaceRoot);
        if (!tsModule) {
            this.#logOnce(
                `typescript-missing:${workspaceRoot}`,
                `[typescript] could not load TypeScript from ${workspaceRoot}/node_modules`
            );
            this.#projects.set(workspaceRoot, undefined);
            return undefined;
        }

        const configPath = tsModule.findConfigFile(workspaceRoot, tsModule.sys.fileExists, "tsconfig.json");
        if (!configPath) {
            this.#logOnce(
                `tsconfig-missing:${workspaceRoot}`,
                `[typescript] no tsconfig.json found under ${workspaceRoot}`
            );
            this.#projects.set(workspaceRoot, undefined);
            return undefined;
        }

        const project = { configPath, ts: tsModule };
        this.#projects.set(workspaceRoot, project);
        this.#logOnce(`project:${workspaceRoot}`, `[typescript] using ${configPath}`);
        return project;
    }

    #logOnce(key: string, message: string): void {
        if (this.#loggedMessages.has(key)) {
            return;
        }

        this.#loggedMessages.add(key);
        this.#output?.appendLine(message);
    }
}

export function findContextualMessageKeyAtOffset({
    ts,
    configPath,
    fileName,
    text,
    offset,
}: {
    ts: TypeScriptModule;
    configPath: string;
    fileName: string;
    text: string;
    offset: number;
}): ContextualMessageKeyHit | undefined {
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

function readParsedConfig(tsModule: TypeScriptModule, configPath: string): ts.ParsedCommandLine | undefined {
    const config = tsModule.readConfigFile(configPath, tsModule.sys.readFile);
    if (config.error) {
        return undefined;
    }

    return tsModule.parseJsonConfigFileContent(config.config, tsModule.sys, path.dirname(configPath));
}

function createOverlayCompilerHost(
    tsModule: TypeScriptModule,
    options: ts.CompilerOptions,
    fileName: string,
    text: string
): ts.CompilerHost {
    const host = tsModule.createCompilerHost(options, true);
    const originalFileExists = host.fileExists.bind(host);
    const originalGetSourceFile = host.getSourceFile.bind(host);
    const originalReadFile = host.readFile.bind(host);
    const useCaseSensitiveFileNames = tsModule.sys.useCaseSensitiveFileNames;

    host.fileExists = (candidate) => {
        if (samePath(candidate, fileName, useCaseSensitiveFileNames)) {
            return true;
        }

        return originalFileExists(candidate);
    };

    host.getSourceFile = (candidate, languageVersionOrOptions, onError, shouldCreateNewSourceFile) => {
        if (samePath(candidate, fileName, useCaseSensitiveFileNames)) {
            return tsModule.createSourceFile(
                candidate,
                text,
                languageVersionOrOptions,
                true,
                scriptKindForFile(tsModule, candidate)
            );
        }

        return originalGetSourceFile(candidate, languageVersionOrOptions, onError, shouldCreateNewSourceFile);
    };

    host.readFile = (candidate) => {
        if (samePath(candidate, fileName, useCaseSensitiveFileNames)) {
            return text;
        }

        return originalReadFile(candidate);
    };

    return host;
}

function findStringLiteralNodeAtOffset(
    tsModule: TypeScriptModule,
    sourceFile: ts.SourceFile,
    offset: number
): ts.StringLiteral | ts.NoSubstitutionTemplateLiteral | undefined {
    let found: ts.StringLiteral | ts.NoSubstitutionTemplateLiteral | undefined;

    function visit(node: ts.Node): void {
        if (offset < node.getStart(sourceFile) || offset > node.getEnd()) {
            return;
        }

        if (isStringLiteralLike(tsModule, node)) {
            found = node;
        }

        tsModule.forEachChild(node, visit);
    }

    visit(sourceFile);
    return found;
}

function isStringLiteralLike(
    tsModule: TypeScriptModule,
    node: ts.Node
): node is ts.StringLiteral | ts.NoSubstitutionTemplateLiteral {
    return tsModule.isStringLiteral(node) || tsModule.isNoSubstitutionTemplateLiteral(node);
}

function typeIncludesMessageKey(
    tsModule: TypeScriptModule,
    checker: ts.TypeChecker,
    type: ts.Type,
    seen = new Set<ts.Type>()
): boolean {
    if (seen.has(type)) {
        return false;
    }

    seen.add(type);

    if (symbolNameIsMessageKey(checker, type.aliasSymbol) || symbolNameIsMessageKey(checker, type.symbol)) {
        return true;
    }

    const typeText = checker.typeToString(type, undefined, tsModule.TypeFormatFlags.UseAliasDefinedOutsideCurrentScope);
    if (messageKeyTypePattern.test(typeText)) {
        return true;
    }

    if (type.isUnion()) {
        return type.types.some((child) => typeIncludesMessageKey(tsModule, checker, child, seen));
    }

    return false;
}

function symbolNameIsMessageKey(checker: ts.TypeChecker, symbol: ts.Symbol | undefined): boolean {
    return symbol ? checker.symbolToString(symbol) === "MessageKey" : false;
}

function loadTypeScript(workspaceRoot: string): TypeScriptModule | undefined {
    const candidates = [path.join(workspaceRoot, "node_modules", "typescript"), "typescript"];

    for (const candidate of candidates) {
        try {
            return requireFromExtension(candidate) as TypeScriptModule;
        } catch {
            // Try the next candidate.
        }
    }

    return undefined;
}

function includeFileName(fileNames: string[], fileName: string, useCaseSensitiveFileNames: boolean): string[] {
    if (fileNames.some((candidate) => samePath(candidate, fileName, useCaseSensitiveFileNames))) {
        return fileNames;
    }

    return [...fileNames, fileName];
}

function getSourceFile(
    program: ts.Program,
    fileName: string,
    useCaseSensitiveFileNames: boolean
): ts.SourceFile | undefined {
    return (
        program.getSourceFile(fileName) ??
        program
            .getSourceFiles()
            .find((sourceFile) => samePath(sourceFile.fileName, fileName, useCaseSensitiveFileNames))
    );
}

function findOwningWorkspaceRoot(documentPath: string, workspaceRoots: string[]): string | undefined {
    return workspaceRoots
        .map((workspaceRoot) => path.resolve(workspaceRoot))
        .filter((workspaceRoot) => isPathInside(documentPath, workspaceRoot))
        .sort((left, right) => right.length - left.length)[0];
}

function isPathInside(child: string, parent: string): boolean {
    const relative = path.relative(parent, path.resolve(child));
    return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function samePath(left: string, right: string, useCaseSensitiveFileNames: boolean): boolean {
    const normalizedLeft = normalizePath(left, useCaseSensitiveFileNames);
    const normalizedRight = normalizePath(right, useCaseSensitiveFileNames);
    return normalizedLeft === normalizedRight;
}

function normalizePath(fileName: string, useCaseSensitiveFileNames: boolean): string {
    const normalized = path.normalize(path.resolve(fileName));
    return useCaseSensitiveFileNames ? normalized : normalized.toLowerCase();
}

function scriptKindForFile(tsModule: TypeScriptModule, fileName: string): ts.ScriptKind {
    if (fileName.endsWith(".tsx")) {
        return tsModule.ScriptKind.TSX;
    }

    if (fileName.endsWith(".jsx")) {
        return tsModule.ScriptKind.JSX;
    }

    if (fileName.endsWith(".js")) {
        return tsModule.ScriptKind.JS;
    }

    return tsModule.ScriptKind.TS;
}
