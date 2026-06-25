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
// (icons, videos, the generated Hanja .data dictionaries).
declare module "*?url" {
    const value: string;
    export default value;
}
