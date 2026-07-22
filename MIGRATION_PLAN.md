# Ledger → Native App (Svelte + Capacitor) — Migration Plan

## Context

**Ledger** is a private, local-first money tracker that today ships as a single-file PWA
(`index.html`, ~2,483 lines of dependency-free vanilla JS, plus `sw.js`,
`manifest.webmanifest`, icons). It is feature-rich and cohesive: accounts, transactions,
loans, templates, goals, IOUs, trends, multi-currency, themes, privacy mode, JSON/CSV
backup, and opt-in **end-to-end-encrypted sync** (AES-GCM/PBKDF2) to GitHub-compatible
hosts.

The goal is to ship it as a **native app** — Android first, iOS later — and, in the
process, modernize it into a **maintainable, typed, component-based** codebase, *without
losing any features* and *without diluting its identity or its privacy-first,
local-first, no-server character*. The work is done in ordered phases so every step is
shippable and reversible.

Companion docs: `CLAUDE.md` (working guide) and `DESIGN.md` (visual system).

## Locked decisions

- **Packaging:** **Capacitor** — bundles the app inside the APK (fully offline, no web
  host, no domain), reuses the existing code, and exposes a native bridge for later.
- **Frontend:** **Svelte + Vite + TypeScript + Vitest**. *Not* SvelteKit (SPA, no
  server — SvelteKit's server features are unusable under Capacitor and its routing adds
  back-button/history complexity). No heavy UI framework.
- **Navigation:** keep the current **in-memory tab state** (no URL router) — simpler and
  friendlier to the Android hardware back button.
- **Design:** keep **Ledger's visual identity** on every platform; achieve "native" via
  ergonomics + real system components, driven by a `data-platform` token layer
  (see `DESIGN.md`).
- **Sync:** stays **backendless / bring-your-own-storage** (adapter model, client-side
  E2E encryption unchanged). GitHub sync **ships in v1**, then is **replaced by Google
  Drive sync** (native Google Sign-In + `drive.appdata`, no backend) as the top post-ship
  priority, and **retired once Drive lands**. Rationale: a GitHub account + PAT is too
  technical for an average user; Drive is more accessible.
- **App identity:** `appId` **`io.friendsnone.ledger`** — a permanent reverse-DNS-style
  identifier (no domain purchase required; must be unique on the Play Store).
- **Distribution:** Web → **GitHub Pages via a build step** — Pages **Source = GitHub
  Actions** building `dist/` (the repo root is now unbuilt source, so serving from branch
  root no longer works); set Vite **`base: '/ledger/'`** (project-page URL
  `friendsnone.github.io/ledger/`). No SPA 404 fallback needed (navigation is in-memory tab
  state); no custom domain required. Android → **sideload APK** + optional **Play Store**;
  iOS → **TestFlight / Ad Hoc** (requires the $99/yr Apple Developer Program + an
  Xcode/cloud-Mac build; no free-form sideloading).
- **Storage:** stays client-side/local; E2E crypto parameters unchanged.
- **Platform support: the real floor is the WebView, not the OS.** `minSdkVersion` only
  gates *installation*; Android System WebView updates through the Play Store
  independently of the OS, so the OS version predicts almost nothing. Measured against the
  code, the app needs **Chromium ≥ 105**: `:has()` (105) and the independent `translate:`
  property (104, and load-bearing — it centres and animates `.toast`), plus
  `:focus-visible` (86) and flex `gap` (84, used 49 times). Below that you do not get
  graceful degradation, you get a half-off-screen toast and 49 flex rows losing their
  spacing. The JS is far more conservative (ES5-style; only `async function` needs ≥55).
  - **Declared / tested floor: Android 9 (API 28).** Confirmed on a Huawei SHT-AL09 running
    Chrome 138 as its WebView provider — all four feature probes pass and the layout is
    correct, so old Android is cheap to support *when Play Services keep WebView current*.
  - **`minSdkVersion` stays 24.** Changing it buys nothing today and it lets Android 7–8
    devices with a current WebView keep working. Treat 7–8 as "probably fine, untested",
    not as supported. Revisit only if a Phase 4 native API forces it.
  - **Phase 2 should add a runtime capability probe**, not UA sniffing — exactly this:
    `CSS.supports("translate", "-50% 0") && CSS.supports("selector(:has(*))")`. If it
    fails, say so plainly (update Android System WebView, or use the web build) instead of
    rendering a subtly broken layout. ~10 lines.
  - Anyone the native build excludes still has the **web/PWA build**, which is what makes a
    higher floor cheap.
- **Assets & styling:** replace the base64-inline fonts + inline SVG icon sprite with
  **Vite-packaged, self-hosted** fonts (`woff2`, weights 400/600/700 only) and
  tree-shaken Phosphor icons — local, offline, CSP-safe (`DESIGN.md` §6). Styling is
  **scoped CSS + tokens with no utility framework** — each primitive owns its scoped
  styles; Tailwind and UnoCSS were evaluated and set aside (`DESIGN.md` §7).

## Phased roadmap

### Phase 0 — Alignment & documentation
- Agree the guidelines; write `CLAUDE.md`, `DESIGN.md`, and keep this plan as the roadmap
  of record.
- **Repo/branch setup (clean slate, non-destructive):** rename `main` → `legacy` to
  archive the old history, push the fresh scaffold as a new **`develop`** branch (clean,
  *unrelated* history — that's fine on GitHub) and set it default, and create
  **`production`** for stable Pages snapshots. See `CLAUDE.md` → *Git workflow*.
- **Scaffold** in an empty dir:
  ```
  npm create vite@latest ledger-native -- --template svelte-ts
  cd ledger-native && npm install
  npm install @capacitor/core && npm install -D @capacitor/cli
  npx cap init "Ledger" "io.friendsnone.ledger" --web-dir www
  npm install @capacitor/android && npx cap add android
  ```
  `webDir` is **`www`** for now (Phase 1 literal copy); it flips to **`dist`** at Phase 3.
- **Carry the keepers into the initial commit:** the three docs (`CLAUDE.md`, `DESIGN.md`,
  `MIGRATION_PLAN.md`) and today's `index.html` → **`reference/index.html`** (the parity
  oracle for every later phase).

### Phase 1 — Ship now (literal copy)
- **Sanity check first:** confirm the scaffold builds before changing anything. Note
  `www/` must contain an `index.html` for `npx cap sync` / `cap open android` to work — an
  empty `www/` errors (missing `assets/`, `capacitor.settings.gradle`); the copy step below
  provides it. After copying, `npx cap doctor` should be green and `npx cap open android`
  should build a debug APK.
- Copy the existing app (`index.html`, `sw.js`, `manifest.webmanifest`, icons) into the
  Capacitor web dir **`www/` unchanged** — no Vite build step yet; `src/` stays dormant
  until Phase 3. Produce a buildable **debug APK**.
- Minimal shell wiring only — `@capacitor/app` and `@capacitor/status-bar`. What landed:
  - **Portrait lock** via `android:screenOrientation="portrait"` in the manifest — no
    plugin needed.
  - **Status bar — two mechanisms, because Android split in half at API 35.**
    **Three mechanisms, and on-device testing proved all three are load-bearing** — each
    covers a configuration the other two do not. Do not "simplify" this to one.

    | Config | What paints the bar | Covered by |
    |---|---|---|
    | **API ≤34** (realme A13, Huawei A9) | system, from `android:statusBarColor` | `statusBarColor` in the theme + `StatusBar.setBackgroundColor` at runtime |
    | **API ≥35, WebView <140** (A15 emu, WebView 124) | decor view — `statusBarColor` is *ignored*, and Capacitor pads the WebView instead of passing insets through | **`android:windowBackground`** — nothing else reaches it |
    | **API ≥35, WebView ≥140** (A17 emu, WebView 149) | the page itself, edge-to-edge | `SystemBars` + the safe-area insets below |

    - The original grey band was the API ≤34 case: with `statusBarColor` unset the platform
      falls back to its grey `colorPrimaryDark`. All three colour attributes now point at
      `@color/ledgerPaper` (`values/` + `values-night/`).
    - The **runtime** `StatusBar.setBackgroundColor` exists because a theme resource can
      only follow the *device's* night mode. The runtime call makes the bar follow the
      **app's** theme setting — verified with the app in dark on a light-mode device.
    - Icon contrast is `SystemBars.setStyle` everywhere, driven by a `MutationObserver` on
      `data-theme`. The colour is read from the live `--paper` token so it cannot drift.
    - Icon contrast is `SystemBars.setStyle` on both, driven by a `MutationObserver` on
      `data-theme` (what `applyTheme()` resolves `system` to). The colour is read from the
      live `--paper` token so it cannot drift from the stylesheet.
  - **Safe areas.** `viewport-fit=cover` plus `www/native.css`, which adds the top and
    side insets to `body` at both breakpoints; the bottom was already handled by the
    original app. Insets read `var(--safe-area-inset-*, env(safe-area-inset-*, 0px))` —
    the custom properties are what SystemBars injects, `env()` is the web/PWA fallback.
    Both halves are verified on-device:
    - **Android 13 (API 33):** neither is ever populated — SystemBars only injects the
      properties from API 35 up, and `env()` stays 0 because the window is not
      edge-to-edge. Harmless: nothing needs insetting when the window already sits below
      the bars, so the `calc()` adds 0 and the layout is correct.
    - **Android 17 (API 37):** `--safe-area-inset-top: 52px` is injected, `--sa-top`
      resolves to it, `body` padding-top lands on `18px + 52px = 70px`, the header's
      client rect starts at exactly y=70, `innerHeight === screen.height`, and the bottom
      inset flows into the app's existing rules (`nav.tabs` padding-bottom `10 + 24`).
  - **Back button.** `App.addListener("backButton")` in `www/native.js`, unwinding modal
    → Settings/Help overlay → non-Overview tab → `exitApp()`. It drives the app's own
    buttons through the DOM, so `index.html` needs no hooks. Gesture-back, 3-button back
    and a hardware key are all the *same* Android event, so one listener covers all three.
    Verified end-to-end with real `KEYCODE_BACK` events: Trends → Overview; modal over
    Settings closes the modal alone; the next back leaves Settings for the tab it was
    opened from (Track); from Overview the app exits to the launcher.
  - **`allowNavigation: ['api.github.com']`** in `capacitor.config.ts`.
- **No bundler is involved.** `www/` is a plain static directory, so the shell reaches
  Capacitor through the *global* build of `@capacitor/core`
  (`window.Capacitor` + `registerPlugin`). `npm run prepare:www` stages it as
  `www/capacitor.js` from `node_modules` — gitignored, so it can never drift from the
  installed version — and `npm run cap:sync` runs that before `cap sync`.
- **Outcome:** the *entire* app ships (triage buckets A + B) — but see the sync caveat
  below. Verify parity, offline, persistence, and a sync round-trip on-device.
- 🔴 **GitHub sync is BROKEN — treat it as non-functional and leave it switched off.**
  Pull works; **push does not reliably land**. This is **pre-existing**, not a migration
  regression: it reproduces identically on the currently hosted single-file version, so
  the feature appears never to have been finished. Deliberately **not fixed** — it is
  scheduled for deletion in Phase 4a (replaced by Drive), so any fix is throwaway work on
  code with a known end date, and nothing ships to users during these phases (the hosted
  version remains the one real users are on).
  - The failure is **not visible by inspection**: `syncPush`, `GitHubBackend.push` and the
    `markDirty()` trigger via `commit()` all read correctly. Diagnosing it needs a live
    round-trip against a real repo and token.
  - Evidence contradicts a clean "never pushes": across two reinstalls an entry created
    locally *reappeared* after a relaunch and the transaction count went 51 → 52, which
    only a pull can do — so the remote **did** receive it at some point. The failure may
    be intermittent or conditional. **Do not assume either that it works or that it never
    works.**
  - Consequence for P1 sign-off: the "sync round-trip works on-device" criterion is
    **not met** and must not be ticked. Auto-sync pulls on launch, and while `syncPull`
    does guard against clobbering (it returns a conflict when `dirty` is set) that guard
    is not worth trusting against a real ledger while the push side is not understood.
- 🔴 **CONFIRMED ON DEVICE: backup *download* is silently dead.** *Download backup
  (.json)* produces no file and no error. `download()` builds a `blob:` URL and clicks an
  `<a download>`; Capacitor's Android bridge sets **no** `DownloadListener` (the class
  appears nowhere in `@capacitor/android`), and Android will not route a blob URL to the
  DownloadManager. *Export CSV* shares the helper and **was confirmed to fail the same
  way**. Restore and import still work — they use `<input type=file>`, which the WebView
  does handle, and restoring the fixture on-device is how P1 parity was checked.
  - This is a **genuine regression against the web build**, where the download works. It
    is accepted deliberately and deferred to Phase 4's native share/save (bucket B's
    "backup download → native Share/Filesystem"), not treated as parity.
  - ⚠️ Combined with sync being broken, **native currently has no way to get data off the
    device at all.** That is survivable only because nothing ships to users during these
    phases. Do not let P4 slip past this without fixing it, and do not treat the native
    build as a place to keep a real ledger until it is fixed.

### Phase 2 — Drop / cleanup
- **Drop:** the `window.storage` Claude-artifact adapter; the service worker in the
  native build (bundle handles offline — keep the SW for the web build); **CSV import**
  (not useful as backup; revisit only if a general "Import from…" feature is built).
  Soften the backup-due nag.
  > The SW is not just redundant natively, it actively bites while iterating on Phase 1:
  > it caches `index.html` under `https://localhost`, and reinstalling an updated APK does
  > **not** invalidate that cache unless `sw.js` itself changed. Symptom: the new APK
  > shows the old UI. Workaround until this phase lands — uninstall (or clear app data)
  > between installs.
- **Keep:** CSV **export** — but it produces no file on native (confirmed on device; same
  `download()` helper as the JSON backup, see Phase 1). Fixing that is Phase 4's job.
- **Add: a WebView capability probe.** ~10 lines, and the only thing standing between an
  under-spec WebView and a silently broken layout:
  `CSS.supports("translate", "-50% 0") && CSS.supports("selector(:has(*))")`. On failure,
  say so plainly — update Android System WebView, or use the web build. Rationale and the
  measured Chromium ≥ 105 floor are in *Locked decisions*.
- **GitHub sync:** 🔴 **broken, not working** (push does not land — pre-existing; see
  Phase 1). Deliberately not fixed and *not* dropped here either, because Drive (Phase 4a)
  is the replacement and there is no point rewriting code with a known end date. Leave the
  feature switched off.

### Phase 3 — Adapt to TypeScript + Svelte (piece by piece, tested)
- **Extract domain logic first** into framework-agnostic, typed, **Vitest-covered**
  modules: the `state` model, money math, currency/format helpers, the crypto
  (`deriveKey`/`sealBlob`/`openBlob`), and a generalized **`SyncBackend` interface**
  (today's `GitHubBackend` becomes one implementation).
- **Rebuild the view layer screen-by-screen** as Svelte components — one tab at a time
  (Overview → Track → Accounts → People → Templates → Trends → Settings → Help) —
  verifying parity against `reference/index.html` after each. Preserve tab navigation and
  Undo semantics.
- **Swap asset delivery:** base64 `@font-face` → packaged `woff2` (Fontsource / Vite);
  inline SVG sprite → tree-shaken Phosphor (`unplugin-icons` / `phosphor-svelte`). Move the
  token system into a global stylesheet; each primitive becomes a Svelte component owning
  its scoped styles (`.btn` in `<Button>`) — no utility framework (`DESIGN.md` §6–§7).
- **Flip Capacitor `webDir` `www` → `dist`** once the Svelte app builds, and stand up the
  GitHub Pages deploy (Actions build of `dist/`, Vite `base: '/ledger/'`).

### Phase 4 — Native capabilities (piece by piece, tested)
- **4a (top priority): Google Drive sync** — native Google Sign-In, `drive.appdata`
  scope, native HTTP (bypasses CORS), no backend. Slot in behind the `SyncBackend`
  interface; then **retire GitHub sync**.
- Then, incrementally: real **biometric/PIN lock** (replacing the visual blur); **Keystore
  / secure storage** for tokens; **local notifications** for Upcoming bills; **native
  share/save + file picker** for backups; **haptics**; native date picker; safe-area /
  status-bar polish.

### Phase 5 — New features
- Only after everything above is evaluated, tested, and real-world used. Pull from the
  backlog below.

## New-features backlog (revisit after first ship)
- Google Drive sync *(pulled forward into Phase 4a)*
- Additional sync backends: Dropbox (OAuth PKCE), WebDAV/Nextcloud
- Real biometric/PIN lock *(Phase 4)*; local bill notifications *(Phase 4)*
- Home-screen widget / Quick Settings tile (needs a native module)
- General **"Import from…"** feature (would revive a CSV/other importer)
- iOS build via TestFlight; optional desktop (same codebase)

## Feature triage

| Bucket | Items |
|---|---|
| **A · Ship now** (direct port) | all entities; all 8 screens; all cross-cutting UX (quick-add FAB, autocomplete, Undo, privacy blur, collapsible cards, themes, multi-currency, toasts); JSON backup/restore; CSV **export**; local storage; ~~GitHub E2E sync~~ *(ported but **broken** — push does not land; pre-existing, not fixed, see Phase 1)* |
| **B · Adapt in place** (ships v1, swapped later) | storage (web → Capacitor Preferences/SQLite); backup download & file import (`<a download>` / `<input file>` → native Share/Filesystem/picker); sync `fetch` (→ native HTTP); service worker (web only) |
| **C · Do later** (native) | Google Drive sync *(4a)*; biometric/PIN lock; Keystore token storage; bill notifications; native share/save + picker; haptics; date picker; widget |
| **D · Dropped / changed** | `window.storage` shim (drop); native-build SW (drop, keep for web); **CSV import (drop)**; backup nag (soften); GitHub sync (retire after Drive) |

## Critical files

- **Parity oracle:** `reference/index.html` (the current app; do not delete).
- **Reuse as TS modules (near-verbatim):** crypto (`deriveKey`/`sealBlob`/`openBlob`);
  sync adapter (`GitHubBackend` → generalize to `SyncBackend`); currency/format helpers;
  the `state` shape; backup schema v9 (`backupText`).
- **New scaffold:** `package.json`, `vite.config.ts`, `capacitor.config.ts`,
  `src/lib/{domain,stores,components,platform}`, `src/views/*`, `android/` (generated),
  `ios/` (later), `dist/` (build output → `webDir`).

## Verification (per phase)

**Always load the fixture first.** `reference/ledger-testdata.json` (synthetic, schema v9,
₱/PHP) restores through Settings → *Restore from backup*. Every check below assumes it —
an empty ledger renders empty states and hides nearly every parity bug. Grow the fixture
when a case is missing; it currently has **no transfers, no transfer fees and no loans**.

**Device matrix actually exercised in P1** — keep this current; the interesting axis is
`API × WebView × layout regime`, not device count.

| Device | API | WebView | CSS width → regime | Result |
|---|---|---|---|---|
| realme RMX3370 | 13 (33) | 150 | 360 → `≤480` phone | ✅ found + fixed the grey status bar |
| Huawei SHT-AL09 (tablet) | 9 (28) | Chrome 138 | 627 → `481–780` middle | ✅ wide hero, 7 tabs unscrolled, no overflow |
| Emulator | 15 (35) | 124 | 411 → `≤480` | ✅ the `windowBackground`-only case |
| Emulator | 17 (37) | 149 | 411 → `≤480` | ✅ true edge-to-edge, insets 52/24px |

⚠️ **Untested: the `>780px` wide regime on a real screen** — where `nav.tabs` is *not*
bottom-fixed. The Huawei is 627 CSS px in portrait and the app is portrait-locked, so no
device on hand reaches it; only the desktop browser harness has. **Deferred to Phase 3**,
where the screens get rebuilt in Svelte and every regime needs re-checking anyway. Close it
with a large tablet or by temporarily lifting the portrait lock.

A cheap and effective web-side parity harness: serve the repo root, open
`/reference/index.html` and `/www/index.html` in the same tab (one origin, so both read the
same restored data), and diff each tab's `#app` `innerText` plus a structural signature of
tag + class names. That caught nothing in P1 — all eight screens were byte-identical — but
it is the fast regression check for the screen-by-screen P3 rebuild.

- **P1:** debug APK installs; app launches **offline** (airplane mode); create data →
  force-close → reopen persists; feature parity vs reference; back button navigates tabs.
  ~~GitHub sync push/pull works on-device~~ — **struck: sync is broken and stays broken**
  (see Phase 1). Do not treat this criterion as passable until Drive sync lands in 4a.
- **P3:** Vitest green on domain modules — money rounding, **crypto encrypt/decrypt
  round-trip**, sync **sha-guard/conflict**; each migrated screen visually matches the
  reference.
- **P4:** on-device plugin checks — Drive sign-in + push/pull, biometric prompt, a fired
  notification, share-sheet backup, Keystore-persisted token.
