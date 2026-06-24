import { KeyBinding, matchesKeyBinding } from "../../keyboard/key-binding";
import { KeyCode } from "../../keyboard/korean-keyboard-map";
import { cancelEvent } from "../../messaging/dom-events";
import { CompositionAdapter } from "../composition-adapters/composition-adapter";
import { HanjaCandidate } from "./hanja-candidate";
import { HanjaCandidatePager } from "./hanja-candidate-pager";
import { HanjaCandidateDisplayOptions, HanjaCandidateWindow, HanjaCandidateWindowPage } from "./hanja-candidate-window";
import { HanjaCompositionOverlay } from "./hanja-composition-overlay";
import { commitHanjaCandidate, getHanjaConversionTarget, HanjaConversionTarget } from "./hanja-converter";
import { HanjaDictionaryProvider } from "./hanja-dictionary-provider";
import { defaultHanjaKeyBindingForPlatform } from "./hanja-key";

/** All user-configurable Hanja settings, owned here (not by the IME controller). */
export type HanjaImeOptions = {
    enabled: boolean;
    keyBinding: KeyBinding | null;
    showSimplified: boolean;
    showPinyin: boolean;
};

export function defaultHanjaImeOptions(): HanjaImeOptions {
    return {
        enabled: true,
        keyBinding: defaultHanjaKeyBindingForPlatform(),
        showSimplified: true,
        showPinyin: true,
    };
}

type HanjaCandidateSelection = {
    target: HanjaConversionTarget;
    pager: HanjaCandidatePager<HanjaCandidate>;
    overlay: HanjaCompositionOverlay;
    window: HanjaCandidateWindow;
};

/**
 * Owns the Hanja conversion lifecycle for one element: deciding whether a key
 * starts a conversion, resolving the committed-text target, the dictionary
 * lookup (with staleness tracking), and the candidate window/overlay/pager plus its
 * navigation, paging, and commit.
 *
 * Deliberately independent of the IME's Han/Yong (active) mode: the owning
 * key listener simply offers it each keydown. It converts existing committed
 * Hangul, including text typed by the OS IME while our Hangul typing is off.
 */
export class HanjaCandidateController {
    private selection?: HanjaCandidateSelection;
    private lookupGeneration = 0;
    private options: HanjaImeOptions;

    constructor(
        private readonly element: HTMLElement,
        private readonly adapter: CompositionAdapter,
        private readonly dictionaryProvider: HanjaDictionaryProvider,
        private readonly onCommitted: () => void,
        options: Partial<HanjaImeOptions> = {}
    ) {
        this.options = { ...defaultHanjaImeOptions(), ...options };
    }

    get isOpen(): boolean {
        return this.selection !== undefined;
    }

    setOptions(options: Partial<HanjaImeOptions>): void {
        const previousDisplayOptions = this.displayOptions();
        this.options = { ...this.options, ...options };

        if (!this.options.enabled || !this.options.keyBinding) {
            this.cancelPendingLookup();
            this.close();
            return;
        }

        const nextDisplayOptions = this.displayOptions();
        if (
            previousDisplayOptions.showSimplified !== nextDisplayOptions.showSimplified ||
            previousDisplayOptions.showPinyin !== nextDisplayOptions.showPinyin
        ) {
            this.refresh();
        }
    }

    /**
     * Pure query: whether this keydown is the configured Hanja key and the feature is on.
     */
    isConversionKey(event: KeyboardEvent): boolean {
        if (process.env.KIME_ENABLE_HANJA !== "true" || !this.options.enabled || !this.options.keyBinding) {
            return false;
        }
        return matchesKeyBinding(event, this.options.keyBinding);
    }

    /**
     * Drive an open candidate window. Returns true when the key was a candidate
     * action (number/arrow/Enter/Escape/Backspace) and was consumed. Any other key
     * while the window is open closes it and returns false, so the caller can let
     * that key fall through to normal handling.
     */
    handleKey(event: KeyboardEvent): boolean {
        if (!this.selection) {
            return false;
        }
        if (this.handleSelectionKey(event)) {
            return true;
        }
        this.close();
        return false;
    }

    /** Invalidate any in-flight lookup so its window never opens (e.g. a mode change). */
    cancelPendingLookup(): void {
        this.lookupGeneration += 1;
    }

    close(): void {
        this.selection?.overlay.remove();
        this.selection?.window.remove();
        this.selection = undefined;
    }

    /**
     * Start a conversion from already-committed text. The key is consumed even when
     * there is no convertible target, matching native IME behavior for the Hanja key.
     */
    startConversion(event: KeyboardEvent): void {
        this.close();
        const lookupGeneration = this.beginLookup();
        cancelEvent(event);

        const target = getHanjaConversionTarget(this.adapter);
        if (!target) {
            return;
        }

        void this.openCandidates(target, lookupGeneration);
    }

    private async openCandidates(target: HanjaConversionTarget, lookupGeneration: number): Promise<void> {
        let candidates: readonly HanjaCandidate[];
        try {
            candidates = await this.dictionaryProvider.lookup(target.reading);
        } catch (error) {
            console.error(error);
            return;
        }

        // Not gated on the IME's active state: Hanja conversion is independent of
        // Han/Yong mode (matching the Microsoft IME, where the Hanja key works in
        // 영 mode too). Staleness from a mode change mid-lookup is still covered —
        // the owner calls cancelPendingLookup(), which bumps the generation.
        if (lookupGeneration !== this.lookupGeneration || candidates.length === 0) {
            return;
        }

        const overlay = new HanjaCompositionOverlay(this.element, this.adapter);
        const overlayRect = overlay.show(target.reading);
        const pager = new HanjaCandidatePager(candidates);
        this.selection = {
            target,
            pager,
            overlay,
            window: new HanjaCandidateWindow(this.element, this.page(pager), overlayRect, {
                onPreviousPage: () => this.movePage(-1),
                onNextPage: () => this.movePage(1),
                onMoveSelection: (delta) => this.moveSelection(delta),
                onSelectCandidate: (visibleIndex) => this.commitVisible(visibleIndex, KeyCode.Lang2),
                displayOptions: this.displayOptions(),
            }),
        };
    }

    private handleSelectionKey(event: KeyboardEvent): boolean {
        const selection = this.selection;
        if (!selection) {
            return false;
        }

        const numberedIndex = hanjaCandidateNumberIndex(event);
        const candidateIndex =
            numberedIndex === undefined ? undefined : selection.pager.selectByVisibleIndex(numberedIndex);
        if (candidateIndex !== undefined) {
            this.commit(candidateIndex, event.code as KeyCode);
            cancelEvent(event);
            return true;
        }

        switch (event.key) {
            case "ArrowDown":
                this.moveSelection(1);
                cancelEvent(event);
                return true;

            case "ArrowUp":
                this.moveSelection(-1);
                cancelEvent(event);
                return true;

            case "ArrowRight":
                this.movePage(1);
                cancelEvent(event);
                return true;

            case "ArrowLeft":
                this.movePage(-1);
                cancelEvent(event);
                return true;

            case "Enter":
                this.commit(selection.pager.selectedIndex, event.code as KeyCode);
                cancelEvent(event);
                return true;

            case "Escape":
                this.close();
                cancelEvent(event);
                return true;

            case "Backspace":
            case "Delete":
                this.close();
                cancelEvent(event);
                return true;

            default:
                return false;
        }
    }

    private moveSelection(delta: number): void {
        const selection = this.selection;
        if (!selection) {
            return;
        }

        selection.pager.moveSelection(delta);
        this.refresh();
    }

    private movePage(delta: number): void {
        const selection = this.selection;
        if (!selection) {
            return;
        }

        selection.pager.movePage(delta);
        this.refresh();
    }

    private commitVisible(visibleIndex: number, keyCode: KeyCode): void {
        const selection = this.selection;
        if (!selection) {
            return;
        }

        const candidateIndex = selection.pager.selectByVisibleIndex(visibleIndex);
        if (candidateIndex === undefined) {
            return;
        }

        this.commit(candidateIndex, keyCode);
    }

    private commit(index: number, keyCode: KeyCode): void {
        const selection = this.selection;
        if (!selection) {
            return;
        }

        const candidate = selection.pager.candidateAt(index);
        if (!candidate) {
            return;
        }

        this.close();
        commitHanjaCandidate(candidate, this.adapter, keyCode);
        this.onCommitted();
    }

    private page(pager: HanjaCandidatePager<HanjaCandidate>): HanjaCandidateWindowPage {
        return {
            candidates: pager.visibleCandidates,
            selectedIndex: pager.selectedPageIndex,
            pageIndex: pager.pageIndex,
            pageCount: pager.pageCount,
        };
    }

    private displayOptions(): HanjaCandidateDisplayOptions {
        return {
            showSimplified: this.options.showSimplified,
            showPinyin: this.options.showPinyin,
        };
    }

    private refresh(): void {
        const selection = this.selection;
        if (!selection) {
            return;
        }

        selection.window.setDisplayOptions(this.displayOptions());
        selection.window.update(this.page(selection.pager));
    }

    private beginLookup(): number {
        this.lookupGeneration += 1;
        return this.lookupGeneration;
    }
}

function hanjaCandidateNumberIndex(event: KeyboardEvent): number | undefined {
    if (!/^[1-9]$/.test(event.key)) {
        return undefined;
    }

    return Number(event.key) - 1;
}
