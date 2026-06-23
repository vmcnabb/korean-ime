export type ImeKeySettingKind = "hanYong" | "hanja";

export const keyBindingUnboundEvent = "kime-key-binding-unbound";

export type KeyBindingUnboundEventDetail = {
    kind: ImeKeySettingKind;
};

export function notifyKeyBindingUnbound(kind: ImeKeySettingKind): void {
    window.dispatchEvent(
        new CustomEvent<KeyBindingUnboundEventDetail>(keyBindingUnboundEvent, {
            detail: { kind },
        })
    );
}
