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
- **When we first ship: after Phase 4 — not before.** P1 and P2 are *technically*
  shippable, and that is deliberate rather than accidental; we are choosing not to. By the
  end of P4 the migration is actually finished (P3 rebuilds the screens, P4 lands the
  native capabilities) and the app is stable enough to use daily, which is the bar for
  handing it to anyone.
  - **Until then the legacy single-file PWA stays hosted, and it is what real users are
    on.** The native build's entire audience is the dev devices in the matrix below.
  - **This is what makes the accepted carve-outs survivable**, and they are only survivable
    because of it: GitHub sync's push does not land (P1), and the native build has **no way
    to export data at all** — backup download and CSV export both produce no file (P1, P2).
    Shipping either of those to a real user would be indefensible. Both must be closed
    **by P4**, since first ship is the moment they stop being survivable.
  - **Corollary for the `sw.js` kill switch:** "keep it until every install has been through
    it" is a tractable condition precisely because nothing shipped — the install population
    is the dev devices, not the public. It can go once the last of them (currently the
    Huawei, held on P1 on purpose) has been updated. This says nothing about the *web*
    build's service worker, which is a different origin and scope and stays.
  - Practical consequence, worth repeating where it hurts: **do not keep a real ledger in
    the native build** before P4 fixes export.
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
  - **The runtime capability probe landed in Phase 2** — a feature probe, not UA sniffing:
    `CSS.supports("translate", "-50% 0") && CSS.supports("selector(:has(*))")`, at the top
    of `www/native.js`. On failure it says so plainly (update Android System WebView, or
    use the web build) instead of rendering a subtly broken layout.
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
  code with a known end date, and nothing ships to users before P4 — the hosted legacy
  version remains the one real users are on (see *Locked decisions* → **When we first
  ship**).
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
  way**. Restore still works — it uses `<input type=file>`, which the WebView does handle,
  and restoring the fixture on-device is how P1 parity was checked. (CSV *import* also
  worked at P1; P2 dropped it. Restore is now the only way in — and, with download dead,
  data only travels one way until P4.)
  - This is a **genuine regression against the web build**, where the download works. It
    is accepted deliberately and deferred to Phase 4's native share/save (bucket B's
    "backup download → native Share/Filesystem"), not treated as parity.
  - ⚠️ Combined with sync being broken, **native currently has no way to get data off the
    device at all.** That is survivable only because nothing ships before P4 (see *Locked
    decisions* → **When we first ship**). Do not let P4 slip past this without fixing it,
    and do not treat the native build as a place to keep a real ledger until it is.

### Phase 2 — Drop / cleanup ✅
- **Dropped: the `window.storage` Claude-artifact adapter.** The `store` chain is now
  localStorage → IndexedDB → memory. Settings' *Saved in* row reads "this browser" on
  native, which is inherited wording, not a P2 change — it goes when the storage layer
  moves to Capacitor Preferences.
- **Dropped: the service worker in the native build** — the registration is gone from
  `www/index.html`, and the web build keeps its own (`reference/sw.js`, untouched).
  > The SW is not just redundant natively, it actively bites while iterating on Phase 1:
  > it caches `index.html` under `https://localhost`, and reinstalling an updated APK does
  > **not** invalidate that cache unless `sw.js` itself changed. Symptom: the new APK
  > shows the old UI.
  - **Deleting the registration is not enough**, and this is the part worth remembering:
    a device that installed an earlier APK still has the old worker registered, and it
    serves the stale `index.html` **cache-first**, so the new page never runs and can
    never unregister anything. The one file that *does* reach those devices is `sw.js`
    itself — the stale page still calls `register("sw.js")`, and the browser fetches it
    and installs it on any byte change.
  - So **`www/sw.js` is now a self-destructing kill switch**: it deletes every cache,
    unregisters itself, and reloads open windows, which then load from the APK. No fetch
    handler — an unregistering worker must not answer from the cache it is deleting.
    It is inert on a fresh install (nothing registers it). **Keep it until every install
    has been through it.**
  - Verified in the browser harness against a deliberately staged stale registration:
    old worker controlling + `index.html` cached → register `sw.js` → caches `[]`,
    registration gone, `navigator.serviceWorker.controller === null`, app re-renders.
    Only its own scope was cleared (a `/reference/` registration survived untouched).
- **Dropped: CSV import.** Button, `#fileCSV` input + handler, and
  `importCSV`/`parseCSV`/`acctIdByName` are gone; the *Backup & data* hint no longer
  offers it. A CSV round-trip was always lossy — it never carried goals, IOUs, templates,
  tags or ids — so it was never a backup, and the backup file is. Revisit only under a
  general "Import from…" feature.
- **Softened the backup-due nag.** It used to appear at 5 records and again after 7 days
  or 20 changes, and "Not now" set a flag that was **never persisted** — so it came back
  on the next launch. A reminder that returns every time you open the app is one you stop
  reading. Now: first nag at **25** records, repeat after **30** days or **50** changed
  records, and "Not now" is a **persisted 14-day snooze** (`nagSnooze`, saved in settings
  and cleared by any backup or restore). `nagDismissed` is gone.
- **Keep:** CSV **export** — but it produces no file on native (confirmed on device; same
  `download()` helper as the JSON backup, see Phase 1). Fixing that is Phase 4's job.
- **Added: the WebView capability probe** (`www/native.js`, ahead of the Capacitor
  early-return so it runs even if the bridge is missing):
  `CSS.supports("translate", "-50% 0") && CSS.supports("selector(:has(*))")`. On failure it
  inserts a themed `role="alert"` banner as the first child of `<main>` — above
  `#backupNag`, and outside `#app`, so `render()` never wipes it — saying the engine is out
  of date, the data is safe, and to update Android System WebView or use a browser. A
  feature probe, not UA sniffing, so it self-corrects when the WebView updates. Rationale
  and the measured Chromium ≥ 105 floor are in *Locked decisions*.
- **GitHub sync:** 🔴 **broken, not working** (push does not land — pre-existing; see
  Phase 1). Deliberately not fixed and *not* dropped here either, because Drive (Phase 4a)
  is the replacement and there is no point rewriting code with a known end date. Leave the
  feature switched off.
- **P2 verification — web harness (full fixture).** `npm run check` clean; both shell files
  and the app's inline script parse. Seven of the eight screens are **byte-identical** to
  `reference/index.html` in text *and* structural signature; **Settings** differs by
  exactly the two intended edits (the *Import CSV* button removed, the hint reworded) and
  nothing else. Backup/CSV export still build their blobs and filenames; the snooze was
  exercised end-to-end (dismiss → survives reload → returns once aged past 14 days →
  cleared by taking a backup); the probe banner was forced on and renders themed, in the
  right place, surviving a re-render.
- **P2 verification — on-device, two emulators + the realme.** The upgrade path was tested for real:
  build the **pre-P2 APK** (from `HEAD` with the P2 changes stashed), install it, seed the
  fixture, confirm the stale state, then `adb install -r` the P2 APK **without
  uninstalling** — the exact scenario the kill switch exists for.

  | Device | API | WebView | Stale state before | After in-place update |
  |---|---|---|---|---|
  | Pixel_9_Pro (emu) | 15 (35) | 124 | SW at `https://localhost/sw.js`, controlling, cache `ledger-v101`, `index.html` cached, old UI | caches `[]`, no registration, uncontrolled, P2 UI |
  | Pixel_10_Pro (emu) | 17 (37) | 149 | identical | identical |
  | **realme RMX3370 (real)** | 13 (33) | 150 | **a genuine P1-era install**, not a staged one — installed 14:25, updated 15:34 that day, with the fixture and real accumulated settings | identical |

  🟢 **The realme run is the one that actually settles it.** The emulator runs reconstructed
  the stale state; the realme *was* in it — a P1 APK that had been installed, used, and
  already updated once, carrying its own cache and a settings blob written by the old build.
  After `adb install -r` with **no uninstall**: registration gone, `caches []`,
  `cachedIndexHtml false`, uncontrolled, and the P2 UI on screen (Settings shows three
  buttons, no *Import CSV*). Everything the user owns survived byte-for-byte — 157 tx,
  6 accounts, 2 loans, 11 templates, 4 goals, 5 IOUs, `cur` `₱`, `theme` `system`,
  `lastBackup 1784713440531`, `backupCount 176`, sync still off — with `nagSnooze` the only
  key added. The nag correctly stayed hidden, since `total 176 === backupCount`.

  Also on-device: **157 transactions and 6 accounts survived** the update; settings written
  by the *old* build (no `nagSnooze` key) load without complaint and gain the field;
  "Not now" **survives a full force-stop + relaunch**; back button still unwinds
  Trends → Overview and exits from Overview; both probes return true so no banner, as
  expected for these WebViews. Inspection was done over CDP against the debug WebView
  (`adb forward` to `webview_devtools_remote_*`), not by reading screenshots.
- 🟢 **Offline launch survives losing the service worker** — the one thing dropping it
  could plausibly have broken. Verified with **airplane mode on**, `caches []` and zero
  registrations: the app launches and renders the full ledger, because Capacitor serves
  every asset from the APK. The SW was never what made the native build offline-capable.
- ⚠️ **Pre-existing, found while testing P2, not caused by it:** localStorage writes are
  flushed to disk asynchronously, so `am force-stop` **within about a second** of a write
  loses it — the first snooze test failed this way before the value was re-read as `0`.
  At a 2-second gap it persists reliably. This applies to *every* setting the app writes
  (theme, currency, privacy, collapsed cards), not just the nag, and it is a normal
  Chromium property rather than a Ledger bug. Real users will not hit it. It disappears
  when storage moves to **Capacitor Preferences** (bucket B) — worth remembering as one
  more reason to make that move.
- 🟢 **The probe's *failure* path is confirmed on a genuinely under-spec WebView.** An
  **AOSP Android 10 (API 29) AVD** carries `com.android.webview` **74.0.3729.185** and has
  **no Play Store**, so the WebView is frozen at the system-image version and cannot drift
  above the floor — which is exactly what makes an AOSP image the right choice here; a
  Google Play image would auto-update itself out of the test. Both probes return `false`
  and the banner renders, legible and correctly placed, with the app still usable behind it.
  - The screenshot also **confirms the predicted breakage rather than just asserting it**:
    flex `gap` (Chromium 84) is absent, so the hero renders
    `INCOME · THIS MONTHEXPENSES · THIS MONTH` with the labels run together, and every
    shortcut chip loses the space between name and amount (`Morning coffee-₱145.00`). This
    is the "49 flex rows losing their spacing" from *Locked decisions*, observed.
  - Cosmetic aside, below the floor so not actionable: the `₱` glyph renders as tofu on
    WebView 74.
  - Keep this AVD. It is the **permanent regression target for the reject path** — see the
    Phase 3 note below, which is the real reason it matters.

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
- 🛑 **BLOCKING, do this before the `webDir` flip: `sw.js` must still be served from the
  app root in `dist/`.** It is currently `www/sw.js`; `public/` holds only `favicon.svg` and
  `icons.svg`, so a naive flip **drops it from the build**. That is not a cosmetic loss —
  it is a one-way trap:
  - A device still on a P1 build loads its **cached** `index.html`, which calls
    `register("sw.js")`. If that request **404s**, the update check fails and the *existing*
    old worker stays registered and keeps serving the stale cache **cache-first, forever**.
    The device never sees the P3 app and cannot be rescued except by clearing app data or
    reinstalling.
  - So: copy `sw.js` into `public/` (or otherwise guarantee it lands at the root of `dist/`)
    **before** flipping `webDir`, and re-verify on a device that is genuinely still on P1.
  - The **Huawei SHT-AL09 is deliberately being held on a P1 build** for exactly this test —
    it is the P1 → P3 upgrade path, a bigger jump than P1 → P2. Do not update it casually.
  - Only once every install has been through the kill switch can `sw.js` be deleted. With
    the Huawei parked on P1, that condition is explicitly **not yet met**.
- ⚠️ **Give the web build the capability probe too — it does not have one.** The probe ships
  only in `www/native.js`, which only the native `www/index.html` loads; `reference/index.html`
  (the hosted web build) has zero occurrences of `CSS.supports`. So an under-spec *browser*
  still gets the silently broken layout. That is not merely a missing nicety: the stated
  reason a high native floor is acceptable is "anyone the native build excludes still has the
  web/PWA build" — and the native banner sends those users to a build that is **equally
  broken and says nothing**. Fix it when Vite's `index.html` becomes the web build; do **not**
  retrofit `reference/index.html`, which is the frozen oracle.
  - **iOS raises the stakes.** `:has()` needs **Safari 15.4** (March 2022), and on iOS every
    browser uses Safari's engine — so an older iPad user cannot escape by switching browsers,
    and iOS is a planned target. Reword the shared banner so it does not say "Android System
    WebView" on the web.
- ⚠️ **Keep the capability probe outside the bundle, and keep it ES5.** Today it survives a
  broken engine because it is its own `<script>` in `www/native.js`, parsed independently of
  the app. Once Vite emits the app, its default target is modern syntax that **Chromium 74
  cannot parse** — and a `SyntaxError` in the bundle kills the page *before* any probe
  inside it runs, turning a clear "your WebView is too old" banner into a **white screen**,
  which is strictly worse than the silent breakage the probe was added to prevent. So the
  probe must stay a small, separate, ES5-safe script that the bundle cannot take down with
  it. Verify on the **AOSP Android 10 AVD** (WebView 74) after the flip: the banner must
  still render. This is the specific reason that AVD is worth keeping around.

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
| **D · Dropped / changed** | *done in P2:* `window.storage` shim (dropped); native-build SW (dropped — `www/sw.js` is now a kill switch; web build keeps `reference/sw.js`); **CSV import (dropped)**; backup nag (softened + persisted snooze). *Still pending:* GitHub sync (retire after Drive) |

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
₱/PHP, 157 transactions) restores through Settings → *Restore from backup*. Every check
below assumes it — an empty ledger renders empty states and hides nearly every parity bug.
It now covers every feature, including the two previously-uncovered ones: **transfers with
fees** and **both debt systems** (tag-based People *and* the legacy lent/borrowed loans).
Grow it when a case is missing rather than inventing throwaway data.

**Device matrix actually exercised in P1** — keep this current; the interesting axis is
`API × WebView × layout regime`, not device count.

| Device | API | WebView | CSS width → regime | Result |
|---|---|---|---|---|
| realme RMX3370 | 13 (33) | 150 | 360 → `≤480` phone | ✅ found + fixed the grey status bar |
| Huawei SHT-AL09 (tablet) | 9 (28) | Chrome 138 | 627 → `481–780` middle | ✅ wide hero, 7 tabs unscrolled, no overflow |
| Emulator | 15 (35) | 124 | 411 → `≤480` | ✅ the `windowBackground`-only case |
| Emulator | 17 (37) | 149 | 411 → `≤480` | ✅ true edge-to-edge, insets 52/24px |
| Emulator (AOSP, **P2**) | 10 (29) | **74** | 360 → `≤480` | ⛔ **below floor on purpose** — probe fires, banner renders, flex `gap` visibly absent |

**What each device is actually for.** The fleet is not "more devices is better" — each unit
covers something the others cannot, and knowing which is what saves re-testing on hardware
that has nothing new to say.

| Device | Uniquely covers | Matters most in |
|---|---|---|
| realme RMX3370 (13/33, WV 150) | the **only OEM skin** (realme UI): background killing, custom share sheet, file picker, permission dialogs; plus API ≤34 bar painting | **P4** — notifications, native share/save, biometric prompts |
| Huawei SHT-AL09 (9/28, Chrome 138) | the **support floor**, old OS + current WebView; the `481–780` middle layout; pre-2019 Huawei **GMS** | P1 ✅, **P4a** Drive sign-in |
| Emulator (15/35, WV 124) | `windowBackground`-only bar case | P1 ✅, P2 ✅ |
| Emulator (17/37, WV 149) | true edge-to-edge + injected insets | P1 ✅, P2 ✅ |
| Emulator AOSP (10/29, **WV 74**) | **below the floor on purpose** — the probe's reject path; frozen WebView, no Play Store | P2 ✅, **P3** (probe must survive bundling) |

Rules of thumb this implies:
- A **WebView-only change** (all of P2) is fully covered by the emulators; the physical
  devices add nothing and are not worth plugging in.
- A **native-surface change** (all of P4) is barely covered by emulators at all — stock
  images hide exactly the OEM behaviour that breaks things. Go to the realme first.
- The **AOSP AVD must never be "fixed"** into passing. A failing screenshot there is the
  expected result.
- Highest-fidelity kill-switch test available: a device still carrying the **P1-era APK**,
  updated in place with `adb install -r`. That is the real upgrade path rather than a staged
  one; the tell is *Import CSV* being gone from Settings.

⚠️ **Untested: the `>780px` wide regime on a real screen** — where `nav.tabs` is *not*
bottom-fixed. The Huawei is 627 CSS px in portrait and the app is portrait-locked, so no
device on hand reaches it; only the desktop browser harness has. **Deferred to Phase 3**,
where the screens get rebuilt in Svelte and every regime needs re-checking anyway. Close it
with a large tablet or by temporarily lifting the portrait lock.

A cheap and effective web-side parity harness: serve the repo root, open
`/reference/index.html` and `/www/index.html` in the same tab (one origin, so both read the
same restored data), and diff each tab's `#app` `innerText` plus a structural signature of
tag + class names. Run twice in P1 — once on a thin fixture and again on the full 157-entry
one — and all eight screens were byte-identical both times. It is the fast regression check
for the screen-by-screen P3 rebuild.

Rules the full fixture makes checkable, verified in P1 and worth re-checking in P3:
- **Transfers are never green or red.** All render `.neu` (grey), paired as
  `From → To` with a `⇄` glyph and the fee inline; none leak into `.pos`/`.neg`.
- **Both debt systems coexist on People.** Tag-derived balances and legacy loans list
  together, the latter marked `· old loan`; partial settlement nets correctly
  (owed 1,300 − paid 500 = 800).
- **Templates split recurring vs shortcuts** by the presence of `dueDay`, and overdue
  recurring entries carry a day count.

- **P1:** debug APK installs; app launches **offline** (airplane mode); create data →
  force-close → reopen persists; feature parity vs reference; back button navigates tabs.
  ~~GitHub sync push/pull works on-device~~ — **struck: sync is broken and stays broken**
  (see Phase 1). Do not treat this criterion as passable until Drive sync lands in 4a.
- **P2:** ✅ all met. Parity harness — 7 of 8 screens byte-identical to the oracle, Settings
  differing only by the dropped *Import CSV* button and its reworded hint. **Kill switch**
  clears caches + unregisters when a P2 APK is installed **over** a pre-P2 one with no
  uninstall (proved on a genuinely P1-era realme, not just staged emulators), with every
  record and setting preserved. **Offline launch still works in airplane mode with zero
  caches.** Capability probe passes on modern WebViews and **renders its banner on
  WebView 74** (AOSP AVD). Backup restore, CSV export and the 14-day nag snooze all
  exercised end-to-end.
- **P3:** Vitest green on domain modules — money rounding, **crypto encrypt/decrypt
  round-trip**, sync **sha-guard/conflict**; each migrated screen visually matches the
  reference. **Plus the P2 carry-overs:** `sw.js` must still be served from the root of
  `dist/` after the `webDir` flip (verify on the Huawei, deliberately held on P1); the
  capability probe must survive bundling as a separate ES5 script; and the web build needs
  a probe of its own.
- **P4:** on-device plugin checks — Drive sign-in + push/pull, biometric prompt, a fired
  notification, share-sheet backup, Keystore-persisted token.
