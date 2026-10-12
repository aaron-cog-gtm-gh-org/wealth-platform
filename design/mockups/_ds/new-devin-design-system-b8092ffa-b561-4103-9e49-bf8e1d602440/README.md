# Devin Design System

A design system for **Devin** — *the AI software engineer*, built by **Cognition**.
It covers the two surfaces represented in the source files: the **Devin Desktop**
product UI and the **Devin marketing site** (devin.ai / "Website 2.0").

> This folder lets a design agent produce on-brand Devin screens, marketing
> sections, decks and assets — using the real logos, fonts, colors, type scale
> and component vocabulary.

---

## What Devin is

Devin is an AI software engineer you direct rather than micromanage. The product
puts **fleets of local and cloud agents** at an engineer's fingertips:

- **Devin Local** — the most capable local agent; plans and prototypes "at the
  speed of thought," runs on your machine, shares architecture with the Devin CLI.
- **Devin Cloud** — picks up complex work on its own machine and keeps building
  after you close your laptop.
- **Agent Command Center / Kanban** — every agent you're running, local and cloud,
  in a single board (Running → Waiting for review → Done). The engineer's job
  shifts from writing code to **directing work**.
- **Spaces** — a Space groups everything for a task: agent sessions, PRs, files and
  context. New sessions inherit what the Space already knows.

The desktop app is a Cursor / VS-Code-style IDE shell: macOS window chrome, a
left activity rail, a file explorer, a center canvas with an "Ask anything (⌘L)"
composer + model picker (Code · SWE-1.6 Fast · Devin Local), and a right-hand
agent session panel.

---

## Surfaces / products

| Surface | What it is | Primary font | Background |
|---|---|---|---|
| **Devin Desktop** | The product — IDE shell, agent kanban, composer, model picker, session cards | Inter | `#fcfcfc` app canvas, white panels |
| **Marketing site** | devin.ai — Devin Desktop landing page: announcement bar, hero, customer logos, feature sections, integrations, pricing, stats, FAQ, footer | NB International Pro (display) + IBM Plex Sans/Mono | `#f7f6f5` warm beige + black sections |

---

## Sources (for whoever picks this up later)

These were the inputs used to build this system. You may not have access; they are
recorded for provenance.

- **Devin Desktop marketing page** (`uploads/Devin Desktop _ Devin.html` + assets) —
  the live, current landing page (post *Windsurf → Devin Desktop* rebrand). The
  `ui_kits/marketing/` kit is rebuilt from this, so its copy / pricing / integration
  logos are accurate to the real site.
- **Figma — "Design System.fig" + "Devin Marketing Site.fig"** (mounted read-only).
  Key pages/frames:
  - `CURRENT-Devin-Desktop-pages` → `Desktop`, `Desktop-Kanban` (1–4), `editor`,
    `Model-picker-menu-and-popover`, `components/`.
  - `Website-2.0` → `Home`, `Pricing`, `Cloud`, `Desktop`, `Download`,
    `Navigation`, `Footerspo`, `components/`.
- **Uploaded brand assets** (`uploads/`):
  - `devin-desktop-logo.png`, `devin-desktop-wordmark.svg` — Devin puzzle mark + wordmark.
  - `Copy of 01_Cognition_PrimaryMark_Black.svg`, `Copy of 03_Cognition_PrimaryLockup_Black.svg` — Cognition parent-brand marks.
  - `PPMori-*.otf` — alt brand display (Pangram Pangram).
  - `IBM_Plex_Mono.zip` — mono / label font.
  - `IBMPlexSans-*VariableFont*.ttf` — brand text face (roman + italic).
  - `NB-International-Pro-*` — marketing display + body grotesk (Neubau).
  - `Bureau_Serif/*` / `STKBureauSerif-*` — editorial serif accent.
  - `Cognition - Brand Guidelines.pdf` — *image-only PDF; could not be auto-parsed
    in this environment (see CAVEATS).*

---

## CONTENT FUNDAMENTALS

How Devin writes. The voice is **engineer-to-engineer**: confident, plain, a little
irreverent. It respects the reader's time and intelligence.

- **Person.** Address the engineer as **"you"**; the product is **"Devin"** (or
  "Devin Local" / "Devin Cloud"). Avoid "we" in product UI; "we" appears only in
  rare marketing asides.
- **Casing.**
  - Headlines & body: **sentence case**, often ending in a **period** even when
    short — *"A team for every engineer." · "See everything. Direct everything."*
  - Section eyebrows: **UPPERCASE mono** — *AGENT COMMAND CENTER · SPACES · DEVIN
    LOCAL · STATS* (rendered uppercase from lowercase source via `text-transform`).
  - UI labels & buttons: sentence case — *"Book a demo", "Start new session",
    "Waiting for review", "Ask anything"*.
- **Tone.** Direct and declarative. Short sentences. Occasional swagger:
  *"Download the damn app already."* Never hypey, never emoji.
- **Punctuation.** Em-dashes for asides — *"Every agent you're running—local and
  cloud—in a single Kanban view."* Periods on fragments. No exclamation marks
  (except the one deliberate CTA).
- **Numbers & proof.** Stated flatly, no fluff: *"1M+ Users", "4,000+ Enterprise
  Customers", "94% of code written by AI."*
- **Product microcopy.** Imperative & specific: *"Explore my codebase and diagram
  how it works", "Review my latest changes and suggest improvements", "Write tests
  for my most critical code paths", "Describe your task to Devin."*
- **Model / status language.** Terse system nouns: *Running, Waiting for review,
  Done, Idle, PR is ready, Ready to merge, Has conflicts.*
- **Emoji:** never. **Exclamation:** essentially never. Let the product be the flex.

**Voice cheat-sheet**

> ✅ "See everything. Direct everything."
> ✅ "The world's most capable local agent."
> ✅ "Devin Cloud picks up complex work and keeps building after you close your laptop."
> ❌ "Supercharge your workflow with our amazing AI! 🚀"

---

## VISUAL FOUNDATIONS

The system is **monochrome-first** — a near-black/white/beige neutral spine with a
single electric **blue accent** and a small set of status colors. It reads as
precise, editorial and engineering-grade. Nothing decorative earns its place
unless it carries meaning.

**Color**
- Spine is neutral: `--black #000`, `--ink #191919` (brand near-black), through
  warm grays to `--white`. Hierarchy in the app is built with **ink at opacity**
  (`56%` secondary, `40%` tertiary) rather than new grays.
- Surfaces: app canvas `#fcfcfc`, panels white, marketing on warm **beige
  `#f7f6f5`**, plus full **black** marketing sections for contrast.
- One accent: **blue `#317cff`** — section-label squares, links, focus, primary
  emphasis. Used sparingly.
- Status: green `#00a558` (ready/merge), red `#f53b3a` (error/conflict), orange
  `#f58e3a` (running/warning). Warm taupe `#ac9983` shows up as an illustration tint.

**Type** — full stack, all self-hosted (Inter via CDN)
- **Display / marketing:** **NB International Pro** — the devin.ai headline + body
  grotesk. Headlines set **−0.03em**, line-height ~1.1, sentence case. Weights
  300/400/500/700.
- **Brand text / long-form:** **IBM Plex Sans** (variable) — the IBM Plex
  superfamily mate to Plex Mono; used for body and docs-style copy.
- **Editorial accent:** **STK Bureau Serif** (Book/Medium + italics) — used
  *sparingly* for pull-quotes and figures. Never body.
- **Product UI / body (app):** **Inter** everywhere in Devin Desktop. Default UI
  text is **13px / 18px, weight 500**; metadata 12px.
- **Mono / labels:** **IBM Plex Mono** — 12px, `+0.03em`, uppercased for section
  eyebrows; also code and stat captions. (Figma also uses Geist Mono for some labels.)
- **Alt brand display:** **PP Mori** (`--font-display-alt`) — a Cognition brand
  face, available but secondary to NB International Pro here.

**Backgrounds & texture**
- Flat color fields — **no gradients**, no noise, no photographic hero washes.
  Media/product shots sit in plain `rgba(0,0,0,0.04)` placeholder blocks with
  `4px` radius. Marketing alternates beige and black full-bleed bands.

**Layout**
- Generous: marketing sections stack with **120px** gaps on a 1272px content
  column inside a 1440 frame. The grid is visible and orderly — logo clouds and
  feature rows snap to even cells. Lots of negative space.
- Section pattern: blue-square mono eyebrow → display headline (often two short
  lines) → 56%-ink supporting paragraph → media block.

**Shape & elevation**
- **Small radii.** App: cards `6px`, columns `10px`, window `12px`, inputs/menus
  `8px`. **Marketing CTAs and hero media are SQUARE (radius 0)** — a signature.
- **Soft neutral shadows**, never colored. Cards: `0 1px 2px rgba(0,0,0,.05)`;
  popovers/windows: `0 4px 6px -2px rgba(0,0,0,.05), 0 10px 15px -3px rgba(0,0,0,.1)`.
- Cards = white fill + `1px rgba(0,0,0,0.08)` hairline + small radius + soft
  shadow. Hairline dividers are `#e7e7e7`.

**Borders, transparency & blur**
- Hairlines everywhere (`#e7e7e7`, `rgba(0,0,0,0.06–0.08)`). Overlays use plain
  black at low alpha. Blur is minimal — reserved for macOS-style vibrancy if at all;
  the system favors crisp flat surfaces over glassmorphism.

**Buttons & states**
- Marketing **primary**: solid **black**, white text, **square**, PP Mori 14px.
  **Outline**: 1px black border, square, transparent.
- App buttons: **ghost** (transparent, hover = faint `rgba(0,0,0,0.06)` fill) and
  **secondary** (white, hairline, `--shadow-xs`). Segmented control: track
  `rgba(0,0,0,0.06)` r8, active segment white + hairline + xs shadow, r6.
- **Hover:** subtle fill darkening / faint gray wash; links → blue. **Press:** a
  touch darker, no bounce. **Focus:** blue ring.

**Motion**
- Restrained and functional. Quick fades and 120–200ms ease-outs; no bounces, no
  decorative looping. Content should be readable with motion disabled.

**Iconography** — see the dedicated section below.

---

## ICONOGRAPHY

- **Style:** thin, geometric **line icons** at 1.5px stroke on a 16/20/24px grid —
  the VS-Code / Lucide family of forms (file, search, git-branch, settings,
  sidebar, plus, history, ellipsis, mic, arrow-up, chevrons). Monochrome, inheriting
  text color; never multi-color, never filled-illustrative.
- **In this system:** the app's own icons live in Figma as vector components
  (`FilledYes*/FilledNo*`, `_Dock Icon`, status glyphs). For UI-kit recreations we
  use **[Lucide](https://lucide.dev)** from CDN — it matches the stroke weight and
  metrics almost exactly. *(Substitution flagged: not the literal exported set.)*
- **Status glyphs** carry color, not the UI chrome: green check / merge
  (`#00a558`), red conflict (`#f53b3a`), orange running (`#f58e3a`), blue unread
  dot (`#317cff`).
- **Brand marks** (in `assets/`):
  - `devin-logo.svg` / `devin-logo-white.svg` — the primary **Devin** logo (mark +
    "Devin" wordmark, `#070707`). Use this as the brand lockup in nav/headers.
  - `devin-logo.png` — raster version of the primary logo.
  - `devin-mark.svg` / `devin-mark-white.svg` — the Devin "puzzle/interlock" glyph (icon only).
  - `devin-mark.png` — raster mark.
  - `devin-wordmark.svg` — legacy mark + wordmark (superseded by `devin-logo.svg`).
  - `cognition-mark.svg`, `cognition-lockup.svg` — Cognition parent brand.
- **Emoji / unicode icons:** never used. The brand stays on the line-icon set.
- Keyboard shortcuts render as plain glyphs in mono/UI text: `⌘L`, `⌘P`.

---

## INDEX — what's in this folder

```
README.md                 ← you are here (context, voice, visual rules, index)
SKILL.md                  ← Agent-Skills entry point (portable use)
colors_and_type.css       ← CSS variables: color, type, spacing, radius, shadow
fonts/                    ← NB International Pro, IBM Plex Sans, IBM Plex Mono,
                            STK Bureau Serif, PP Mori (self-hosted)
assets/                   ← Devin + Cognition logos / marks (svg, png)
preview/                  ← Design-System tab cards (foundations + components)
ui_kits/
  desktop/                ← Devin Desktop product UI kit (IDE + kanban prototype)
  marketing/              ← Devin marketing-site UI kit (hero, sections, footer)
```

- **Foundations** → `colors_and_type.css` + the cards in `preview/`.
- **Components & screens** → `ui_kits/<product>/` (each has its own README,
  `index.html` interactive demo, and JSX component files).

---

## CAVEATS

- **Brand Guidelines PDF** is image-only and would not render/parse in this
  environment — its rules are *not* reflected here beyond what's visible in Figma
  and the uploaded marks. If it contains color/spacing/logo-clearspace rules,
  share them and I'll reconcile.
- **Display font:** all marketing faces are now licensed and self-hosted —
  **NB International Pro** (display/body), **STK Bureau Serif** (serif accent),
  **IBM Plex Sans** (brand text), **IBM Plex Mono** (mono), **PP Mori** (alt
  display). **Inter** (product UI) is CDN-loaded. No font substitutions remain.
  *(These are trial/edition files — confirm production licensing before shipping.)*
- **Icons** are Lucide (CDN) standing in for the exported icon set — same look,
  not byte-identical.
