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
- Minimal shell wiring only (`npm install @capacitor/status-bar @capacitor/app`, then
  `npx cap sync`): portrait lock, status-bar color `#f4f1ea`, `viewport-fit=cover` +
  safe-area padding, Android back button → tab state, allowlist `api.github.com`.
- **Outcome:** the *entire* app ships (triage buckets A + B), including GitHub sync.
  Verify parity, offline, persistence, and a sync round-trip on-device.

### Phase 2 — Drop / cleanup
- **Drop:** the `window.storage` Claude-artifact adapter; the service worker in the
  native build (bundle handles offline — keep the SW for the web build); **CSV import**
  (not useful as backup; revisit only if a general "Import from…" feature is built).
  Soften the backup-due nag.
- **Keep:** CSV **export**.
- **GitHub sync:** retained and working; flagged for replacement by Drive (Phase 4a). Not
  dropped here — there is no replacement yet.

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
| **A · Ship now** (direct port) | all entities; all 8 screens; all cross-cutting UX (quick-add FAB, autocomplete, Undo, privacy blur, collapsible cards, themes, multi-currency, toasts); JSON backup/restore; CSV **export**; local storage; GitHub E2E sync |
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
- **P1:** debug APK installs; app launches **offline** (airplane mode); create data →
  force-close → reopen persists; feature parity vs reference; GitHub sync push/pull works
  on-device; back button navigates tabs.
- **P3:** Vitest green on domain modules — money rounding, **crypto encrypt/decrypt
  round-trip**, sync **sha-guard/conflict**; each migrated screen visually matches the
  reference.
- **P4:** on-device plugin checks — Drive sign-in + push/pull, biometric prompt, a fired
  notification, share-sheet backup, Keystore-persisted token.
