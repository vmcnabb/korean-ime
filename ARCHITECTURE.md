# Architecture

How the pieces of the extension fit together. For the prose version of this, see
[`AGENTS.md`](AGENTS.md); this file is the picture.

The extension runs in three live contexts — the **service worker** (background),
a **content script** injected into every frame, and the **options page** (plus a
small **romanize popup** window). They never call each other directly: they talk
over typed `chrome.runtime` messages and react to shared `chrome.storage`.

## 1. Messaging between contexts

The runtime message channels, the browser events that drive the service worker,
and the path a keystroke takes through the content script.

```mermaid
flowchart LR
    user["⌨ User keystrokes"]
    page["Focused editable element (page DOM)"]

    subgraph browser["Browser events / UI"]
        actionIcon["Toolbar action icon"]
        ctxMenu["Context menu"]
        tabsEv["tabs.onActivated / onRemoved"]
        installEv["runtime.onInstalled"]
    end

    subgraph sw["Service worker (background)"]
        action["action.ts"]
        menus["menus.ts"]
        csl["ContentScriptListener"]
        sm["StateManager"]
        roman["romanize-menu-actions + romanize()"]
        hanjaProv["Hanja dictionary provider"]
        gs["getting-started"]
    end

    subgraph cs["Content script (every frame)"]
        csc["ContentScriptController"]
        tim["TextInputManager"]
        ime["HangulImeController"]
        osk["OnScreenKeyboardController<br/>(top frame only)"]
        hanjaClient["Hanja provider client"]
    end

    subgraph other["Other extension pages"]
        opts["Options page (Vue 3)"]
        popupPage["Romanize popup"]
    end

    %% browser events into the service worker
    actionIcon -->|onClicked| action --> sm
    ctxMenu -->|onClicked| menus
    menus -->|toggle keyboard| sm
    menus -->|romanize selection| roman
    menus -->|open options| opts
    tabsEv --> csl
    installEv --> gs

    %% user input handled inside the page
    user -. keydown .-> csc
    user -. keydown capture .-> ime
    osk -->|on-screen key tap| csc
    csc --> tim
    tim --> ime
    ime -->|compose / commit text| page

    %% content script -> service worker requests
    csc -. "RefreshState · ToggleHanYong · SendKey · Request/Persist keyboard layout" .-> csl
    csc -. "UpdateCompositionFeatures (broadcast)" .-> csl
    ime --> hanjaClient
    hanjaClient -. "HanjaLookup ⇄ candidates" .-> csl
    csl --> sm
    csl --> hanjaProv

    %% service worker -> content script pushes
    sm -. "UpdateState (per-tab mode)" .-> csc
    sm -. "SendKey → focused frame" .-> tim
    roman -. "InsertTextAfterSelection" .-> tim
    csl -. "OnScreenKeyboardLayout" .-> osk
    csl -. "UpdateCompositionFeatures → focused frame" .-> osk

    %% toolbar / menu presentation
    sm -. "setIcon · setTitle · menu checkbox" .-> browser
```

Notes:

- **Only the top frame hosts the on-screen keyboard.** Sub-frames run the IME but
  no keyboard. A key tapped on the OSK is tried locally first; if the focused
  editable lives in another frame, the service worker routes it there as a
  `SendKey` (using the recorded *focused frame*).
- **`UpdateCompositionFeatures` is a broadcast.** A frame reports which
  composition features its focused element supports; the service worker relays it
  to the tab so the (top-frame) keyboard can enable/disable keys.
- **Hanja lookup is a request/response round-trip.** The dictionary lives in the
  service worker; the content-script `HanjaDictionaryProviderClient` asks for
  candidates and gets them back.

## 2. Shared state via `chrome.storage`

There is **no** options → service-worker message. The options page only *writes*
storage; every other context subscribes to `storage.onChanged` and reacts. The
write is the broadcast.

```mermaid
flowchart LR
    subgraph ctxs["Contexts"]
        sm["StateManager (SW)"]
        oskStore["osk-layout-store (SW)"]
        roman["romanize popup flow (SW)"]
        csc["ContentScriptController (content)"]
        opts["Options page (Vue 3)"]
        popupPage["Romanize popup page"]
    end

    subgraph storage["chrome.storage"]
        sync["sync<br/>Settings + keyboard arrangement"]
        session["session<br/>tabState · liveState · focusedFrame · popup data"]
        local["local<br/>lastState · toggle key · keyboard position"]
    end

    opts -->|write settings| sync
    opts -->|write toggle key| local
    csc <-->|read / write arrangement| sync
    csc -->|read toggle key| local
    sm <-->|tab + live state| session
    sm <-->|lastState| local
    sync -->|read settings| sm
    oskStore <-->|keyboard position| local
    roman -->|write popup text| session
    popupPage -->|read popup text| session

    sync -. "onChanged ⇒ re-derive & push state" .-> sm
    sync -. "onChanged ⇒ re-apply arrangement" .-> csc
    local -. "onChanged ⇒ reload toggle key" .-> csc
```

- **`sync`** — the user's `Settings` (incl. the keyboard's key arrangement).
  Roams across devices.
- **`local`** — per-device things: the remembered `lastState` (for "keep last
  state"), the Han/Yong **toggle key** binding, and the keyboard's pixel
  **position** per site. These are device-specific, so they deliberately don't
  roam.
- **`session`** — per-tab runtime state (`tabState-<id>`), the global `liveState`
  new tabs inherit, the `focusedFrame-<id>` used to route keys, and the handed-off
  romanize **popup text**. Cleared on browser close.

## 3. Content-script composition pipeline

Inside the content script, the IME core (mostly pure, well unit-tested) turns
keystrokes into Hangul and, on demand, Hanja.

```mermaid
flowchart TB
    csc["ContentScriptController"] --> tim["TextInputManager"]
    tim -->|"creates per focused element"| factory["CompositionAdapterFactory"]
    factory -->|input| inAd["InputAdapter"]
    factory -->|contentEditable| ceAd["ContentEditableAdapter"]
    factory -->|CKEditor| ckAd["CkEditorAdapter"]
    factory -. "Google Docs ⇒ no adapter (unsupported)" .-> none(("∅"))

    tim --> ime["HangulImeController"]
    ime --> compositor["HangulCompositor<br/>jamo ⇒ syllable blocks"]
    compositor --> blocks["hangul-block / hangul-maps"]
    ime --> box["compositing-box<br/>(composing overlay)"]
    ime --> adapter["chosen CompositionAdapter"]
    adapter --> el["Editable element"]

    subgraph hanjaUI["Hanja conversion (on the convert key)"]
        hkey["hanja-key"]
        conv["hanja-converter"]
        pager["hanja-candidate-pager"]
        win["hanja-candidate-window"]
        ov["hanja-composition-overlay"]
    end
    ime --> hanjaUI
    ime --> client["Hanja provider client<br/>→ service worker lookup"]
```

- **`TextInputManager`** owns one `HangulImeController` for the focused element,
  swapping it when focus moves. The right `CompositionAdapter` is picked by
  `CompositionAdapterFactory` based on the editor type (plain input,
  contentEditable, CKEditor). **Google Docs gets no adapter** and is unsupported.
- **`HangulCompositor`** is the heart: it assembles jamo into syllable blocks.
- **Hanja** conversion is layered on top: pressing the convert key asks the
  service-worker dictionary (via the client), then drives the candidate window,
  pager, and overlay.
```
