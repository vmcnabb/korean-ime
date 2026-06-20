import { HangulImeController } from "../../composition/hangul-ime-controller";
import { KoreanKeyboardMode } from "../../extension-state/korean-keyboard-mode";
import { KeyBinding, isModifierOnlyBinding, matchesKeyBinding } from "../../keyboard/key-binding";
import {
    popupModeIconEnglish,
    popupModeIconEnglishSrcset,
    popupModeIconHangul,
    popupModeIconHangulSrcset,
} from "../../content-script/on-screen-keyboard/mode-icons";
import { romanize } from "../../romanization/romanize";
import { TOGGLE_KEY_STORAGE_KEY, loadToggleKeyBinding } from "../../settings/toggle-key-store";
import { PopupConverterData, popupConverterDataKey } from "./popup-converter-data";
import { isHangulInputMode, togglePopupInputMode } from "./popup-input-mode";
import { api } from "../../platform/browser-api";
import { MessageKey, t } from "../../i18n";

const original = document.getElementById("original") as HTMLDivElement,
    roman = document.getElementById("romanized") as HTMLDivElement,
    inputModeButton = document.getElementById("input-mode-toggle") as HTMLButtonElement,
    inputModeIcon = document.getElementById("input-mode-icon") as HTMLImageElement,
    copyOriginalButton = document.getElementById("copy-original") as HTMLButtonElement,
    copyRomanizedButton = document.getElementById("copy-romanized") as HTMLButtonElement,
    copyStatus = document.getElementById("copy-status") as HTMLDivElement,
    originalCount = document.getElementById("original-count") as HTMLSpanElement,
    romanizedCount = document.getElementById("romanized-count") as HTMLSpanElement;

let inputMode = KoreanKeyboardMode.Hangul;
let toggleKeyBinding: KeyBinding | null = null;
let copyFeedbackTimer: number | undefined;

setupLocalization();
setupInputModeToggleKey();
const he = new HangulImeController(original);
setInputMode(KoreanKeyboardMode.Hangul);
updateCounts();
void populateFromStorage();
void loadToggleKey();
watchToggleKey();

/**
 * Load the text the service worker stashed for this popup. Reads the value if
 * it's already present, and also subscribes to storage in case the popup loads
 * before the worker finishes writing — either ordering populates exactly once.
 * The entry is removed once consumed so it doesn't linger in session storage.
 */
async function populateFromStorage() {
    const win = await api.windows.getCurrent();
    if (win.id === undefined) {
        return;
    }
    const key = popupConverterDataKey(win.id);

    const apply = (data: PopupConverterData) => {
        original.textContent = data.original;
        roman.textContent = data.romanized;
        updateCounts();
        void api.storage.session.remove(key);
    };

    api.storage.session.onChanged.addListener((changes) => {
        const data = changes[key]?.newValue as PopupConverterData | undefined;
        if (data) {
            apply(data);
        }
    });

    const existing = (await api.storage.session.get(key))[key] as PopupConverterData | undefined;
    if (existing) {
        apply(existing);
    }
}

function doRomanize() {
    roman.textContent = romanize(original.innerText);
    updateCounts();
}

he.onEntry(() => doRomanize());
original.addEventListener("input", doRomanize);

// Paste as plain text only — the input is a contenteditable, so a default paste
// would drop in the source's HTML/styling. insertText also fires `input`, which
// triggers doRomanize.
original.addEventListener("paste", (event) => {
    event.preventDefault();
    const text = event.clipboardData?.getData("text/plain") ?? "";
    document.execCommand("insertText", false, text);
});

inputModeButton.addEventListener("click", () => setInputMode(togglePopupInputMode(inputMode)));
copyOriginalButton.addEventListener("click", () => void copyText(original.innerText, copyOriginalButton));
copyRomanizedButton.addEventListener("click", () => void copyText(roman.innerText, copyRomanizedButton));

function setupInputModeToggleKey() {
    window.addEventListener(
        "keydown",
        (event) => {
            const binding = toggleKeyBinding;
            if (!binding || event.repeat || !matchesKeyBinding(event, binding)) {
                return;
            }

            setInputMode(togglePopupInputMode(inputMode));
            event.preventDefault();

            if (!isModifierOnlyBinding(binding)) {
                event.stopImmediatePropagation();
            }
        },
        true
    );

    window.addEventListener(
        "keyup",
        (event) => {
            const binding = toggleKeyBinding;
            if (binding && isModifierOnlyBinding(binding) && event.code === binding.code) {
                event.preventDefault();
            }
        },
        true
    );
}

async function loadToggleKey() {
    toggleKeyBinding = await loadToggleKeyBinding();
}

function watchToggleKey() {
    api.storage.onChanged.addListener((changes, area) => {
        if (area === "local" && TOGGLE_KEY_STORAGE_KEY in changes) {
            loadToggleKey().catch((error) => console.error("loadToggleKey failed:", error));
        }
    });
}

function setInputMode(mode: KoreanKeyboardMode) {
    inputMode = mode;

    if (isHangulInputMode(mode)) {
        he.activate();
    } else {
        he.deactivate();
    }

    const isHangul = isHangulInputMode(mode);
    inputModeIcon.src = isHangul ? popupModeIconHangul : popupModeIconEnglish;
    inputModeIcon.srcset = isHangul ? popupModeIconHangulSrcset : popupModeIconEnglishSrcset;
    inputModeButton.classList.toggle("active", isHangul);
    inputModeButton.setAttribute("aria-pressed", String(isHangul));

    const modeLabel = t(isHangul ? "romanize_popup_hangulMode" : "romanize_popup_latinMode");
    inputModeButton.setAttribute("aria-label", modeLabel);
    inputModeButton.title = modeLabel;
    original.dataset.inputMode = isHangul ? "hangul" : "latin";
}

function updateCounts() {
    originalCount.textContent = formatCharacterCount(original.innerText.length);
    romanizedCount.textContent = formatCharacterCount(roman.innerText.length);
}

function formatCharacterCount(count: number) {
    return t("romanize_popup_characterCount", String(count));
}

async function copyText(text: string, button: HTMLButtonElement) {
    if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
    } else {
        fallbackCopyText(text);
    }

    showCopyFeedback(button);
}

function fallbackCopyText(text: string) {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.insetInlineStart = "-9999px";
    document.body.append(textarea);
    textarea.select();
    document.execCommand("copy");
    textarea.remove();
}

function showCopyFeedback(button: HTMLButtonElement) {
    const copiedMessage = t("romanize_popup_copied");
    copyStatus.textContent = copiedMessage;

    if (copyFeedbackTimer !== undefined) {
        window.clearTimeout(copyFeedbackTimer);
    }

    document.querySelectorAll<HTMLElement>(".copy-action").forEach((copyAction) => {
        copyAction.classList.remove("copied");
    });

    const copyAction = button.closest<HTMLElement>(".copy-action");
    copyAction?.classList.add("copied");

    copyFeedbackTimer = window.setTimeout(() => {
        copyAction?.classList.remove("copied");
        copyStatus.textContent = "";
        copyFeedbackTimer = undefined;
    }, 1400);
}

function setupLocalization() {
    document.querySelectorAll("[data-message]").forEach((el) => {
        const element = el as HTMLElement;
        element.innerText = getMessage(element.dataset.message);
    });

    document.querySelectorAll("[data-placeholder-message]").forEach((el) => {
        const element = el as HTMLElement;
        element.dataset.placeholder = getMessage(element.dataset.placeholderMessage);
    });

    document.querySelectorAll("[data-aria-label-message]").forEach((el) => {
        const element = el as HTMLElement;
        element.setAttribute("aria-label", getMessage(element.dataset.ariaLabelMessage));
    });
}

function getMessage(messageKey: string | undefined) {
    return messageKey ? t(messageKey as MessageKey) : "";
}
