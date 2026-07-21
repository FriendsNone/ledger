# Ledger — Design System

The rules. Build new UI by **referencing these primitives**, never by inventing a
one-off style or borrowing a class that was made for something else.

> **The one rule:** if you're writing a raw `px`, `rgba()`, or a new component class,
> stop — either a token exists, or a primitive exists, or you're adding to this file.

This document is the **parity design spec** carried over from the original single-file
app (`reference/index.html`) and re-expressed for the Svelte + Vite + Capacitor project.
The tokens, primitives, and rules are unchanged in intent; how they're *delivered*
(fonts, icons, Svelte components) is described in §6–§8. See `CLAUDE.md` for the working
guide and `MIGRATION_PLAN.md` for the roadmap.

---

## 1. Tokens

Every value in the CSS comes from a token. There are **no raw numbers** in the stylesheet.
Tokens live once, as CSS custom properties in a global stylesheet's `:root`, overridden in
`[data-theme="dark"]`. Svelte component `<style>` blocks reference the tokens — they never
redefine them.

### Color

Defined once in `:root`, overridden in `[data-theme="dark"]`. Never hardcode a colour.

| Token | Use |
|---|---|
| `--paper` / `--paper-2` | Page background / recessed surfaces (troughs, quiet fills) |
| `--card` | Raised surfaces (cards, modals, inputs) |
| `--ink` / `--ink-soft` / `--ink-faint` | Primary / secondary / tertiary text |
| `--line` / `--line-strong` | Hairlines / borders |
| `--income` / `--income-soft` | Money **in**, gains |
| `--expense` / `--expense-soft` | Money **out**, losses, overdue |
| `--amber` / `--amber-soft` | Due soon, warnings |
| `--accent` / `--accent-ink` | Actions, active states |
| `--danger` / `--danger-soft` | Destructive actions |
| `--hover` | Universal hover wash |
| `--ring` / `--ring-danger` | Focus rings |
| `--scrim` | Modal backdrop |

**Money colour semantics (non-negotiable):**
- 🟢 green = money in, gains
- 🔴 red = money out, losses, overdue, negative balances
- 🟡 amber = due soon
- ⚪ neutral = transfers, settled items, principal, plain balances
- ⚫ accent = actions

A transfer is **never** green or red — no money entered or left your world.

> **Privacy mode** re-tints amounts to neutral so nothing leaks whether you're up or
> down. Colour is a statement about money; in privacy mode it must say nothing.

### Elevation

`--shadow-sm` · `--shadow-md` · `--shadow-lg`

Nothing else. No inline `box-shadow: 0 4px 14px rgba(...)`.

### Type

| Token | Size | Use |
|---|---|---|
| `--fs-xs` | 11px | Badges, micro-labels, chips |
| `--fs-sm` | 12.5px | Meta text, sub-lines, hints |
| `--fs-md` | 14px | **Body default** |
| `--fs-lg` | 16px | Emphasis, row values |
| `--fs-xl` | 20px | Section figures, modal titles |
| `--fs-display-sm` | 26px | Card figures |
| `--fs-display-md` | 32px | Page titles in the hero (Help, Settings) — the `.big` class |
| `--fs-display` | 42px | The hero net-worth figure |

**Weights: `--fw-regular` (400), `--fw-semi` (600), `--fw-bold` (700). Only these.**

> ⚠️ **500 and 800 are not embedded.** Using them makes the browser *synthesize* a fake
> weight — it renders smeared and differs per platform. This was a real bug. Don't.
> The packaged fonts (§6) ship **only 400/600/700**, which enforces this by construction.

**Families**
- `'Hanken Grotesk'` — everything (body, UI)
- `'Fraunces'` — display only (brand, hero figures, card titles, modal titles)
- `'JetBrains Mono'` — numbers only, via `.num` (tabular figures so columns align)

### Radius

`--r-xs` 5px · `--r-sm` 8px · `--r-md` 10px · `--r-lg` 14px · `--r-pill` · `--r-circle`

Rough guide: chips/pills → `--r-pill`; controls & buttons → `--r-sm`/`--r-md`; cards & modals → `--r-lg`.

### Space

`--s-1` 4px · `--s-2` 8px · `--s-3` 12px · `--s-4` 16px · `--s-5` 24px

Use for `gap`, `padding`, `margin`. If you need a value between two steps, you probably don't.

### Control heights

**Every interactive control snaps to one of three heights. Never let a height fall out of
padding math — declare it.**

| Token | Height | Used by |
|---|---|---|
| `--ctl-xs` | 30px | Row actions: `.mini`, `.del`, `.act` |
| `--ctl-sm` | 34px | Compact controls: the filter row (search, type, funnel, account, dates) |
| `--ctl-md` | 44px | Default: form fields, `.btn`, `.seg` |

For a `.seg`, the trough has `--s-1` padding top and bottom, so the **button** height is
`calc(<target> - var(--s-2))` and the total lands exactly on the target.

> Controls used to derive their height from padding + font-size + border, which produced
> **eight different heights** (30, 32, 33, 34, 42, 43, 44, 45) in rows that were supposed to
> line up. Declaring the height is what fixes it. A control that needs a size not on this
> scale is a control that needs a good reason.
>
> **44px (`--ctl-md`) is also the touch-target floor** — it doubles as the native tap
> minimum, so default controls are already thumb-friendly on device.

### Motion

`--t-fast` 120ms (hover, colour) · `--t-base` 180ms (modals, reveals) · `--t-slow` 300ms (layout)
`--ease` — the shared easing curve.

Animate `opacity` and `transform` only. Never animate layout properties in a hot path.

---

## 2. Primitives

In this project each primitive is a **Svelte component that owns its styles** — the
primitive's CSS lives co-located in that component's scoped `<style>` (e.g. `.btn` lives in
`<Button>`, `.seg` in `<Seg>`). The global stylesheet holds **only** the `:root` tokens and
a minimal base/reset — no primitive class library. The class names below are the contract —
`<Button>` renders `.btn`, `<Seg>` renders `.seg`, and so on — so the rules travel intact
from the original app, and new UI **composes components, not raw classes**.

### Buttons

| Class | What it is |
|---|---|
| `.btn` | **Full-width primary.** Accent fill. The main action of a form or modal. |
| `.btn.sec` | Secondary. Quiet fill. |
| `.btn.danger` | Destructive. |
| `.btn.btn-sm` | Compact + auto-width. Combine: `.btn.sec.btn-sm`. |
| `.icon-btn` | **Square, bordered, icon-only.** Header tools. `.on` = active. |
| `.mini` | Borderless icon action **inside a row** (edit). |
| `.del` | Same, destructive (delete). Hovers red. |
| `.act` | **Text action inside a row or toolbar** — "Log", "Settle", "Clear". |
| `.act.primary` | Filled variant (accent). |
| `.act.pill` | Pill-shaped, for compound chips carrying a name + amount (`.nm` / `.amt`). |

> **`.mini` is for icons. `.act` is for text.** Putting a text label in `.mini`
> (a 30×30 icon box) is what made the Settle button look wrong.

> **Why `.act` uses full-contrast `--ink`, not `--ink-soft`.** A muted text action goes
> washed-out on dark surfaces. **One text-action button. Full contrast. Both themes.**

#### Two surface roles — never invent a third

| Role | Members | Surface | Border |
|---|---|---|---|
| **Filled** | `.btn`, `.btn.sec`, `.btn.danger` | `--accent` / `--paper-2` / `--danger` | none — the fill carries the weight |
| **Outlined** | `.icon-btn`, `.act` | **always `--card`** | `1px solid --line-strong` |

`--card` is the *raised-surface* token, and an interactive control **is** a raised thing.
Every outlined button uses it, on every background. Hover on either role washes with `--hover`.

> These once had three different backgrounds (`--paper-2`, `--card`, `--paper`) for no
> reason. `.act` was even using the *page background* token while claiming to be a raised
> control. Pure drift. Don't reintroduce it.

**Toast-scoped exceptions:** `.toast-x` and `.toast-undo` sit *on* the accent fill, so they
invert deliberately. They are the only buttons allowed outside the system, and only there.

All buttons get a visible `:focus-visible` ring. Non-negotiable.

### Segmented control — `.seg`

**One** implementation. It replaced three (`.seg`, `.periodbar`, `.vtoggle`).

```html
<div class="seg" role="group" aria-label="...">           <!-- 2 columns -->
<div class="seg three" role="group">                      <!-- 3 columns -->
<div class="seg scroll" role="group">                     <!-- horizontal scroller -->
  <button class="on" aria-pressed="true">…</button>
```

- **Active state is always the `.on` class.** ⚠️ **Never** style active state from an
  attribute selector (`[data-t="income"]`). That was a real bug: new toggles silently
  had no active state until someone remembered to add a selector for them.
- Optional semantic colour via **class**: `.tone-income`, `.tone-expense`, `.tone-neutral`.
- Always set `aria-pressed`.

#### Two active tones — one structure

`nav.tabs` and `.seg` are the **same primitive**: a trough with buttons inside. They differ
only in how "active" reads, and that difference is **deliberate**:

| Variant | Active looks like | Use for | Question it answers |
|---|---|---|---|
| `.seg` (default) | **Filled** — accent pill, inverted text | **Selection** | *"What did I pick?"* |
| `.seg.raised` | **Lifted** — light card + soft shadow | **Navigation** (`nav.tabs`) | *"Where am I?"* |

Selection is a deliberate act, so it's emphatic. Navigation is ambient — it's on screen all
day, so it stays quiet. iOS and Material draw the same line.

> **Don't "fix" this into consistency.** It looks like drift and isn't. If you need a raised
> toggle somewhere new, use `.seg.raised` — don't invent a third treatment.

### Rows

`.lrow` is the canonical row: **lead → body → end**.

```
[dot/ring]  [title + sub]  ................  [value] [actions]
```

Specialised rows exist where the structure genuinely differs, and only there:
- `.prow` — People history (no lead; delta + running context)
- `.stmt-row` — Statement (3 columns: description / change / running balance)
- `.bd-row` — Trends breakdown (label / bar / amount)

**Action order inside a row is always:** value → primary action → edit (`.mini`) → delete (`.del`).

### Stacks — `.vstack`

**The parent owns the rhythm.** A vertical group of controls uses `.vstack`, which sets one
uniform `gap`; its children contribute **no margin of their own**.

> Without this, each child brings its own `margin-bottom` and the gaps come out uneven —
> the Track filter stack ran **12px / 14px / 8px / 8px** and looked visibly ragged. If you're
> setting `margin-bottom` on a child to space siblings, use a stack instead.

**Align the edges too.** Elements in a group must share the same left/right inset, or their
right edges won't line up. (People's "Settle up" sat 8px in while the rows below sat 2px in —
a 6px stagger you could see immediately.)

### Cards, fields, modals

- `.card` (`<Card>`) — the container. Collapsible by default; pass `collapsible={false}` to pin open.
- `.field` (`<Field>`) — `<label>` + control; the component associates them (id/`for`) —
  **don't hand-wire `for`.**
- `.modal` (`<Modal>`) — `.modal-h` (title + close) / body / `.modal-f` (actions). A confirm
  handler returning `false` keeps it open for validation.

---

## 3. Rules for new UI

1. **No raw values.** No `px` for size/radius/space, no `rgba()`. If a token doesn't exist, add one *here* first.
2. **Reuse a primitive.** If it looks like a button, it's `<Button>`/`.btn`. If it toggles, it's `<Seg>`/`.seg`. If it lists, it's a row.
3. **Never borrow a class for a job it wasn't made for.** (`.mini` for text, `.seg` attribute selectors — both bit us.)
4. **Active state = `.on` class.** Always.
5. **Focus rings on everything interactive.**
6. **Respect money semantics.** Green in, red out, neutral transfers. A colour choice is a statement about money.
7. **Numbers use `.num`** so columns align.
8. **Mask money through the format helpers** (`fmt()` / `fmtBig()` in the domain layer) — never print a raw amount, or you'll leak through privacy mode.

---

## 4. No escape hatches

**Inline styles must never carry raw values.** `style="font-size:16px;padding:14px"` on a
button silently overrides the control-height scale and re-introduces exactly the drift the
tokens exist to prevent. If an element needs different spacing, use a **token**
(`style="margin-top:var(--s-2)"`) or give it a class. SVG chart internals are the only
exception — they're drawing coordinates, not UI chrome.

**Every collapsible/interactive element is a real `<button>`.** No `div[role="button"]`
with a hand-rolled key handler; native buttons get Enter/Space and focus for free.

---

## 5. Accessibility floor

- Every interactive element: keyboard-reachable, visible focus ring, accessible name.
- Use real `<button>` elements — not `<div role="button">` with a hand-rolled key handler.
- Icons are decorative: `aria-hidden="true"` + a label on the parent.
- Contrast: `--ink-soft` is the *minimum* for secondary text. `--ink-faint` is for
  decorative/tertiary only — never for text a user must read.
- Honor **Dynamic Type / large-text** scaling; keep tap targets on the `--ctl-*` scale
  (44px default is the touch floor).

---

## 6. Asset delivery (Vite)

The original app inlined everything as base64 to stay a single file. With Vite that's no
longer necessary — assets are **bundled locally** (fingerprinted, cached), which stays
**CSP-safe and fully offline** with **no CDN**. This is a delivery change only; the tokens
above are unchanged.

**Fonts — packaged, self-hosted `woff2`.** Replace the base64 `@font-face` blocks with
locally bundled fonts (e.g. `@fontsource/*`, or committed `woff2` + `@font-face` via Vite
asset URLs). Ship **only the three families and only weights 400 / 600 / 700** — this is
what enforces the "no 500/800" rule structurally. Latin-subset the files to keep the bundle
small. Never load fonts from a remote origin.

**Icons — packaged Phosphor, tree-shaken.** Replace the inline SVG `<symbol>` sprite with a
build-time importer (`unplugin-icons` with the Iconify Phosphor set, or `phosphor-svelte`).
Icons import as components, only the ones used are bundled, there is no runtime network
call, and **Phosphor stays the icon set** to preserve identity. Keep the
`aria-hidden` + parent-label convention from §5.

---

## 7. Styling approach in Svelte

**Decision: scoped CSS + tokens. No utility framework.**

- **Tokens are global; nothing else is.** One stylesheet defines `:root` /
  `[data-theme="dark"]` custom properties and a minimal base/reset. Every other style is
  **Svelte component-scoped `<style>`** referencing tokens — scoping gives locality without
  leaking or duplicating.
- **Primitives are components that own their styles** (`<Button>`, `<Seg>`, `<Row>`,
  `<Card>`, `<Field>`, `<Modal>`). The `.btn` rules live in `<Button>`, not a global sheet —
  open the component, see everything it is. New UI composes these components.
- **No Tailwind, no UnoCSS.** Both were evaluated and set aside. They buy fast one-off
  utilities but cost style locality, add a build-time static-extraction footgun for this
  app's heavily **dynamic/semantic class names** (`tone-${type}`, ternary `cls`), and run a
  two-model split (utilities + the real CSS still needed for `calc()` heights,
  `:focus-visible`, the `.seg` trough, animations). For a primitive-heavy, dynamic-styling,
  security-sensitive app that values auditability, plain scoped CSS + tokens is the better
  fit — one model, full locality, universally legible, zero new deps. *If this is ever
  revisited*, prefer **UnoCSS token-bound** (preset-less, primitives as shortcuts) over
  Tailwind — but it is not planned.

---

## 8. Native look & feel (Capacitor)

Keep Ledger's identity on every platform; earn "native" through ergonomics and real system
components, **not** by re-skinning to stock Material/Cupertino.

- **One component tree, branch on tokens.** Set `data-platform="ios|android"` on `<html>`
  from `Capacitor.getPlatform()`; express per-platform deltas (nav heights, radii, motion
  timing, switch styling) through CSS custom properties — don't fork components.
- **Safe areas:** `viewport-fit=cover` + `env(safe-area-inset-*)` padding (notch, status
  bar, iOS home indicator).
- **Status / nav bar:** `@capacitor/status-bar`, edge-to-edge, matched to the theme's
  `--paper` (and its dark variant).
- **Touch polish:** momentum scroll; `overscroll-behavior` to tame rubber-band / unwanted
  pull-to-refresh; remove tap-highlight + long-press callout; custom `:active` feedback;
  `@capacitor/haptics` on key actions.
- **Navigation:** Android hardware back → tab state; respect the iOS edge-swipe-back
  gesture; never hijack system gestures.
- **Use real system components** for system tasks (share sheet, file picker, biometric
  prompt, notifications, date picker). **Never build fake-native controls** — a custom thing
  that mimics a system control but behaves differently. Either the real component, or clearly
  your own.

**iOS note.** Apple's HIG allows a tasteful custom brand — the real gate is conventions +
accessibility + using system components, not visual conformity. The genuine review risk is
**Guideline 4.2 (Minimum Functionality)** (an app that feels like a wrapped website); the
roadmap's native features (offline, biometric lock, notifications, file handling) clear it.
