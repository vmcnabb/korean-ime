import { ContentScriptController } from "./content-script-controller";

const controller = new ContentScriptController();
const isTopWindow = window === top;
controller.initialize(isTopWindow);
