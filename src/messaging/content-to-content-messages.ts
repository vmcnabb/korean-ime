import { SupportedCompositionFeatures } from "../composition/composition-adapters/composition-adapter-interface";
import { hasProperties } from "../types/objects";

/** intended for broadcasts to all content script on the current tab */
export enum ContentScriptBroadcastAction {
    UpdateCompositionFeatures = "updateCompositionFeatures",
}

/**
 * Message that is sent to the on-screen keyboard to inform it of which feature are supported
 * by the adapter attached to the active element.
 */
type UpdateCompositionFeaturesMessage = {
    type: "broadcast";
    action: ContentScriptBroadcastAction.UpdateCompositionFeatures;
    data: SupportedCompositionFeatures;
};

export type ContentScriptBroadcastMessage = UpdateCompositionFeaturesMessage;

export function isContentScriptBroadcastMessage(message: unknown): message is ContentScriptBroadcastMessage {
    return (
        hasProperties(message, "type", "action") &&
        message.type === "broadcast" &&
        Object.values(ContentScriptBroadcastAction).includes(message.action as ContentScriptBroadcastAction)
    );
}
