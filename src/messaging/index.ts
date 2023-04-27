import { TabState } from "../extension-state/tab-state";

export type TabStateMessage = {
    type: "tabState",
    action: "update",
    data: TabState
}


export type ActionHandlers<TMessage, TMessageActions extends string> = {
    [K in TMessageActions]: (message: TMessage) => void;
};

export function isTabStateMessage(message: any): message is TabStateMessage {
    return message?.type === "tabState" && message?.action === "update";
}
