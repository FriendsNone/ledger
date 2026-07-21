# Ledger (native) — project guide

Ledger is a **private, local-first money tracker**, migrating from a single-file PWA to a
**Svelte + TypeScript** app wrapped in **Capacitor** for native Android (iOS later), while
keeping a web/PWA build. This file orients any new session working in this repo. See
`MIGRATION_PLAN.md` for the phased roadmap and `DESIGN.md` for the visual system.

## Golden rules
- **Private & local-first.** All data lives on-device. Nothing leaves it except via
  opt-in, end-to-end-**encrypted** sync. Never add analytics, telemetry, accounts, or a
  server. No new network calls without explicit sign-off.
- **No feature regressions.** The original app is preserved at `reference/index.html` —
  it is the **parity oracle**. When migrating a screen, diff behavior against it and do
  not silently drop features.
- **Keep the identity.** Preserve Ledger's visual design (see `DESIGN.md`). "Native" means
  ergonomics + real system components, **not** re-skinning to stock Material/Cupertino.
- **Backendless sync.** Sync is a bring-your-own-storage **adapter** (`SyncBackend`);
  client-side crypto is unchanged. Don't introduce a backend.
- **Small & auditable.** Minimal dependencies — this is a security-sensitive finance app.
  Justify every new dependency; prefer platform/standard APIs.
- **Don't touch the crypto params.** AES-GCM + PBKDF2 (250k iterations, SHA-256). Don't
  weaken them.

## Stack
- Svelte + Vite + TypeScript; **Vitest** for tests. **Not** SvelteKit (SPA, no server).
- Capacitor for native (Android now, iOS later). Native access via `@capacitor/*`
  plugins behind a `src/lib/platform/` layer with web fallbacks
  (`Capacitor.isNativePlatform()` / `Capacitor.getPlatform()`).
- Navigation: in-memory **tab state**, no URL router. Wire the Android hardware back
  button to tab state.

## Architecture
- `src/lib/domain/` — framework-agnostic, typed, **tested**: state model, money math,
  currency/format, crypto, `SyncBackend` interface + implementations.
- `src/lib/stores/` — Svelte stores wrapping domain state + persistence (autosave).
- `src/lib/platform/` — Capacitor bridges (storage, share, filesystem, biometric,
  notifications, secure storage) with web fallbacks.
- `src/lib/components/` — reusable UI. `src/views/` — the tab screens.
- `reference/index.html` — original app (parity oracle; do not delete).

## Data model
Accounts · Transactions (income / expense / transfer + fee) · Loans (lent/borrowed,
partial settle) · Templates (recurring + shortcuts, fixed/variable amount) · Goals ·
IOUs · Settings. Backup schema is **version 9** (see the original `backupText`). Keep
restore backward-compatible.

## Toolchain / prerequisites
Install once before scaffolding (Phase 0). **Node** covers the web/Svelte/Capacitor side;
**Android Studio** covers the native Android build.

- **Node.js LTS (20+)** + npm — Vite, Svelte, Capacitor CLI, web build (a version manager
  like `nvm`/`fnm` is convenient).
- **Git.**
- **Android Studio** — bundles the Android SDK, build-tools, platform-tools (`adb`), a
  compatible **JDK 21** (its JetBrains Runtime), and the emulator; it also works with
  Capacitor's **Gradle wrapper** (`./gradlew` fetches Gradle itself — no separate Gradle or
  JDK install needed).
- **After installing Studio:**
  - SDK Manager → an SDK Platform (API 34/35), Build-Tools, Platform-Tools, Command-line Tools.
  - Accept licenses: `sdkmanager --licenses`.
  - Env vars (for CLI builds / `adb`): `ANDROID_HOME` → SDK path; add `platform-tools` to
    `PATH`; `JAVA_HOME` → a JDK 21 (can point at Studio's bundled `jbr`). Building only via
    Studio's UI needs no `JAVA_HOME`.
  - A physical device (USB debugging on) or an emulator AVD to run on.
- **Verify:** `npx cap doctor`, then `npx cap open android` should build a debug APK.
- **iOS (later, not now):** macOS + Xcode + CocoaPods — Mac-only (or a cloud-Mac CI).

### Windows
- **Physical device:** install the **Google USB Driver** (SDK Manager → SDK Tools) and
  enable USB debugging; some OEMs need their own driver too.
- **Long paths:** deep `node_modules`/Gradle paths can exceed the legacy `MAX_PATH` — enable
  Win32 long paths (registry `LongPathsEnabled=1` or Group Policy) and
  `git config --global core.longpaths true`.
- **Env vars:** set `ANDROID_HOME` / `JAVA_HOME` via System Properties → Environment
  Variables (or `setx`); restart the terminal afterward.
- **Emulator speed:** enable hardware acceleration (WHPX/Hyper-V or the Android Emulator
  hypervisor driver). Excluding the project + SDK folders from antivirus noticeably speeds
  up Gradle.

### macOS
- **Xcode Command Line Tools** (`xcode-select --install`) for the git/build toolchain;
  Homebrew for Node. Apple Silicon is fine. (Full Xcode + CocoaPods only when adding iOS.)

### Linux
- **Emulator:** enable **KVM** and add your user to the `kvm` group for usable speed.
- **Physical device:** add **udev rules** (`51-android.rules`) so `adb` detects it.

## Commands
- Dev server: `npm run dev`
- Tests: `npm run test` (Vitest)
- Build web: `npm run build` → `dist/`
- Sync native: `npx cap sync`
- Android: `npx cap open android`, or `./gradlew assembleDebug` inside `android/`
- iOS (later, needs macOS/Xcode): `npx cap open ios`
- App ID: `io.friendsnone.ledger` (permanent; no domain purchase needed).
- Capacitor `webDir`: **`www`** in Phase 1 (literal copy), flips to **`dist`** from Phase 3.
- Web deploy: GitHub Pages via **Actions** (builds `dist/`); Vite **`base: '/ledger/'`**
  (served at `friendsnone.github.io/ledger/`). No SPA 404 fallback — nav is tab state.

## Git workflow
- **Branches:**
  - `legacy` — archived pre-migration history (the old single-file PWA). Reference only;
    never build on it. Unrelated history to `develop` by design.
  - `develop` — **default / integration** branch; day-to-day work lands here.
  - `production` — stable release snapshots; **GitHub Pages deploys from pushes here** (an
    Action builds `dist/`). Promote a build by merging `develop` → `production`.
  - Feature work → short-lived branches off `develop`, merged back via PR.
- **Commits:** Conventional Commits (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`,
  `chore:`) — matches the original app's `feat/fix` history. Keep messages descriptive.
- **History:** don't rewrite published history on `develop` / `production`; rebase only
  local feature branches before merging.

## Migration status (keep this current)
- [x] **P0** Alignment & docs
- [ ] **P1** Ship literal copy in Capacitor (debug APK, parity verified)
- [ ] **P2** Drop: `window.storage` shim, native-build SW, **CSV import**; soften backup nag
- [ ] **P3** Extract typed/tested domain modules; rebuild screens in Svelte (parity-checked)
- [ ] **P4** Native: **Google Drive sync first** → retire GitHub sync; then biometric lock,
      Keystore, notifications, share/save, haptics
- [ ] **P5** New features (see `MIGRATION_PLAN.md` backlog)

## Dropped / changed (don't reintroduce without reason)
- Dropped: `window.storage` Claude-artifact adapter; service worker in the native build
  (kept for the web build); **CSV import**.
- Kept: CSV **export**.
- GitHub sync ships in v1 → **replaced by Google Drive sync** (native Google Sign-In,
  `drive.appdata`, no backend), then retired.
- Asset delivery: base64-inline fonts + inline SVG icon sprite → **Vite-packaged** local
  fonts (Hanken Grotesk / Fraunces / JetBrains Mono, weights 400/600/700 only) +
  tree-shaken Phosphor icons. Styling: **scoped CSS + tokens, no utility framework**
  (Tailwind/UnoCSS evaluated and set aside); each primitive owns its scoped styles
  (`.btn` in `<Button>`). See `DESIGN.md`.

## Do / Don't
- DO port **screen-by-screen** with parity checks against `reference/index.html`.
- DO keep Undo on every mutation and the privacy-blur behavior.
- DON'T add a backend, accounts, analytics, or external CDN/fonts (stay CSP-safe, offline).
- DON'T break the Android back button, safe areas, or offline launch.

## References
- `MIGRATION_PLAN.md` — phased roadmap, decisions, feature triage, verification
- `DESIGN.md` — visual system & platform-adaptation rules
- `reference/index.html` — original app (parity oracle)
