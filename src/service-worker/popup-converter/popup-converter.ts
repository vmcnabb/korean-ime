import { HangulImeController } from "../../composition/hangul-ime-controller";
import { KoreanKeyboardMode } from "../../extension-state/korean-keyboard-mode";
import { KeyBinding, isModifierOnlyBinding, matchesKeyBinding } from "../../keyboard/key-binding";
import { romanize } from "../../romanization/romanize";
import { TOGGLE_KEY_STORAGE_KEY, loadToggleKeyBinding } from "../../settings/toggle-key-store";
import { PopupConverterData, popupConverterDataKey } from "./popup-converter-data";
import { isHangulInputMode, togglePopupInputMode } from "./popup-input-mode";
import { api } from "../../platform/browser-api";

const original = document.getElementById("original") as HTMLDivElement,
    roman = document.getElementById("romanized") as HTMLDivElement,
    hangulModeButton = document.getElementById("hangul-mode") as HTMLButtonElement,
    latinModeButton = document.getElementById("latin-mode") as HTMLButtonElement,
    copyOriginalButton = document.getElementById("copy-original") as HTMLButtonElement,
    copyRomanizedButton = document.getElementById("copy-romanized") as HTMLButtonElement,
    copyStatus = document.getElementById("copy-status") as HTMLDivElement,
    originalCount = document.getElementById("original-count") as HTMLSpanElement,
    romanizedCount = document.getElementById("romanized-count") as HTMLSpanElement;

let inputMode = KoreanKeyboardMode.Hangul;
let toggleKeyBinding: KeyBinding | null = null;
let copyStatusTimer: number | undefined;

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

hangulModeButton.addEventListener("click", () => setInputMode(KoreanKeyboardMode.Hangul));
latinModeButton.addEventListener("click", () => setInputMode(KoreanKeyboardMode.English));
copyOriginalButton.addEventListener("click", () => void copyText(original.innerText, "romanize_popup_originalCopied"));
copyRomanizedButton.addEventListener("click", () => void copyText(roman.innerText, "romanize_popup_romanizedCopied"));

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
    hangulModeButton.classList.toggle("active", isHangul);
    latinModeButton.classList.toggle("active", !isHangul);
    hangulModeButton.setAttribute("aria-pressed", String(isHangul));
    latinModeButton.setAttribute("aria-pressed", String(!isHangul));
    original.dataset.inputMode = isHangul ? "hangul" : "latin";
}

function updateCounts() {
    originalCount.textContent = formatCharacterCount(original.innerText.length);
    romanizedCount.textContent = formatCharacterCount(roman.innerText.length);
}

function formatCharacterCount(count: number) {
    return api.i18n.getMessage("romanize_popup_characterCount", String(count));
}

async function copyText(text: string, copiedMessageKey: string) {
    if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
    } else {
        fallbackCopyText(text);
    }

    showCopyStatus(api.i18n.getMessage(copiedMessageKey));
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

function showCopyStatus(message: string) {
    copyStatus.textContent = message;
    if (copyStatusTimer !== undefined) {
        window.clearTimeout(copyStatusTimer);
    }
    copyStatusTimer = window.setTimeout(() => {
        copyStatus.textContent = "";
        copyStatusTimer = undefined;
    }, 1600);
}

function setupLocalization() {
    document.querySelectorAll("[data-message]").forEach((el) => {
        const element = el as HTMLElement;
        element.innerText = element.dataset.message ? api.i18n.getMessage(element.dataset.message) : "";
    });

    document.querySelectorAll("[data-placeholder-message]").forEach((el) => {
        const element = el as HTMLElement;
        element.dataset.placeholder = element.dataset.placeholderMessage
            ? api.i18n.getMessage(element.dataset.placeholderMessage)
            : "";
    });

    document.querySelectorAll("[data-aria-label-message]").forEach((el) => {
        const element = el as HTMLElement;
        element.setAttribute(
            "aria-label",
            element.dataset.ariaLabelMessage ? api.i18n.getMessage(element.dataset.ariaLabelMessage) : ""
        );
    });
}
