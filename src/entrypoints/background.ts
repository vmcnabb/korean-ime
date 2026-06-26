import "../platform/process-shim";
import { defineBackground } from "wxt/utils/define-background";

// The service worker registers its listeners at module-evaluation time (MV3
// requires synchronous top-level registration so an idle worker can wake). A
// side-effect import preserves that: the imported module's top-level code runs
// when this background bundle is evaluated, i.e. on worker startup.
import "../service-worker/service-worker";

export default defineBackground({
    type: "module",
    main() {},
});
