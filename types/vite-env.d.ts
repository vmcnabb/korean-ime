// Let Typescript know that we can import these file types.

declare module "*.png" {
    const value: string;
    export default value;
}

declare module "*.html" {
    const value: string;
    export default value;
}

declare module "*.vue" {
    import type { DefineComponent } from "vue";
    const component: DefineComponent<object, object, unknown>;
    export default component;
}

declare module "*.scss" {}

declare module "*.css" {}

// Vite asset imports with the `?url` suffix resolve to a URL string
// (icons, videos, and the generated Hanja .data files).
declare module "*?url" {
    const value: string;
    export default value;
}

// Vite exposes build-time env on import.meta.env. The project tsc doesn't pull
// in WXT's generated types, so declare the keys the source reads.
interface ImportMetaEnv {
    readonly BROWSER?: string;
    readonly COMMAND?: "build" | "serve";
    readonly FIREFOX?: boolean;
    readonly MANIFEST_VERSION?: 2 | 3;
    readonly VITE_ENABLE_HANJA?: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
