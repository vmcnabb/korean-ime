import { SimplifySettings, createCheckBoxOption, createSection, createSystemSetting } from "./option-definitions";
import { createPersistenceOption } from "./option-enums";

export type SettingsStore = SimplifySettings<ReturnType<typeof createDefaultSettings>["options"]>;

export function createDefaultSettings() {
    return createSection("Korean IME Options", {
        onScreenKeyboard: createSection("On-screen Keyboard", {
            persist: createPersistenceOption("State of the on-screen keyboard when the browser starts."),
            /** the last state of the on-screen keyboard when the browser was closed */
            lastState: createSystemSetting(false),
            shareStateAcrossTabs: createCheckBoxOption(
                "Share state across tabs",
                false,
                "If enabled, the on-screen keyboard will be shown/hidden in all tabs when it is shown/hidden in one tab."
            ),
        }),
        hanYongToggle: createSection("Han/Yong Toggle", {
            persist: createPersistenceOption("State of the Han/Yong toggle when the browser starts."),
            lastState: createSystemSetting(false),
            shareStateAcrossTabs: createCheckBoxOption(
                "Share state across tabs",
                false,
                "If enabled, Hangul mode will be enabled/disabled in all tabs when it is enabled/disabled in one tab."
            )
        }),
    });
}
