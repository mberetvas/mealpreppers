---
name: Mealprepper
description: Culinary Atelier — warm editorial meal planning for households.
colors:
  primary: "#0f5238"
  primary-container: "#2d6a4f"
  secondary: "#944a00"
  secondary-container: "#fc8f34"
  surface: "#fbf9f8"
  surface-container-low: "#f5f3f3"
  surface-container-lowest: "#ffffff"
  on-surface: "#1b1c1c"
  on-surface-variant: "#404943"
  outline-variant: "#bfc9c1"
  primary-fixed: "#b1f0ce"
  on-primary-fixed: "#002114"
  error: "#ba1a1a"
  atelier-canvas: "#f7f2e8"
  atelier-parchment: "#fffaf0"
  atelier-ink: "#1e261f"
  atelier-heading: "#123628"
  atelier-warm-accent: "#b7662f"
  atelier-chip: "#f0e4d2"
  atelier-image-well: "#e6d6bd"
  atelier-description: "#5d6c60"
  atelier-meta: "#6a786b"
  atelier-neutral-action: "#485746"
  atelier-icon-muted: "#6b7b6e"
  atelier-error-foreground: "#9c3d16"
  atelier-primary-hover: "#174d38"
typography:
  display:
    fontFamily: "Newsreader, Georgia, serif"
    fontSize: "clamp(2.25rem, 5vw, 3.75rem)"
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Newsreader, Georgia, serif"
    fontSize: "clamp(1.5rem, 3vw, 2rem)"
    fontWeight: 600
    lineHeight: 1.2
  title:
    fontFamily: "Newsreader, Georgia, serif"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: 1.25
  body:
    fontFamily: "\"Plus Jakarta Sans\", system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 500
    lineHeight: 1.75
  label:
    fontFamily: "\"Plus Jakarta Sans\", system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "0.14em"
rounded:
  sm: "0.25rem"
  md: "0.5rem"
  xl: "0.75rem"
  catalog: "1.75rem"
spacing:
  touch-sm: "2.75rem"
  touch-lg: "3.5rem"
  section-gap: "2rem"
components:
  nav-top-bar-target:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.atelier-heading}"
    typography: "{typography.title}"
    rounded: "{rounded.sm}"
    padding: "0 2rem"
    height: "5rem"
  recipe-page-canvas:
    backgroundColor: "{colors.atelier-canvas}"
    textColor: "{colors.atelier-ink}"
    typography: "{typography.body}"
    rounded: "{rounded.catalog}"
    padding: "2rem 1rem 8rem"
  recipe-catalog-card:
    backgroundColor: "{colors.atelier-parchment}"
    textColor: "{colors.atelier-heading}"
    typography: "{typography.title}"
    rounded: "{rounded.catalog}"
    padding: "0"
  filter-trigger-pill:
    backgroundColor: "{colors.atelier-parchment}"
    textColor: "{colors.atelier-heading}"
    typography: "{typography.body}"
    rounded: "{rounded.catalog}"
    padding: "0 1rem"
    height: "{spacing.touch-sm}"
  primary-cta-button:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.surface-container-lowest}"
    typography: "{typography.body}"
    rounded: "{rounded.catalog}"
    padding: "0 1.5rem"
    height: "{spacing.touch-lg}"
---

# Design System: Mealprepper

## Overview

**Creative North Star: "The Living Editorial"**

The interface reads like a high-end food magazine: generous space, serif-led hierarchy, and parchment-like surfaces so recipes stay the hero. The product rejects sterile dashboards and coupon-driven meal-kit chrome; depth comes from paper-like tones and soft shadows, not from stacking boxes.

**Token architecture (normative for implementation).** The codebase uses two coordinated layers, both defined in `tailwind.config.ts` and `app/assets/css/tailwind.css`:

1. **Material-aligned roles** (`primary`, `surface`, `on-surface`, `surface-container-*`, `outline-variant`, …): hex literals in Tailwind, used for global chrome, form patterns (for example `.design-input`), and anywhere the app aligns with the original palette spec.
2. **Atelier semantic roles** (`atelier/*`): RGB triplets exposed as CSS variables on `:root` (light and `.dark`), consumed as `rgb(var(--atelier-*) / <alpha>)`. These drive recipe catalog cards, planner surfaces, and rich content areas. **Recipe list and detail pages** use many hex literals in markup; those values intentionally match the atelier variables (for example page canvas `#f7f2e8` equals `atelier-canvas`). A color pass should replace literals with `bg-atelier-*` / `text-atelier-*` / `ring-primary/*` for consistency with `designTokenCompliance.ts` and `RecipeCatalogGridCard.vue`.

**Known drift before color pass:** `app/components/layout/TopNavBar.vue` uses Tailwind default **stone** and **emerald** scales (`bg-stone-50/80`, `text-emerald-900`, …), not the tokens above. The nav should converge on `surface` / `atelier-heading` / `primary` (and dark-mode equivalents) plus the same frosted-bar treatment described under Components.

**Key Characteristics:**

- Serif display (Newsreader) for page titles and recipe names; Plus Jakarta Sans for UI labels and dense text.
- Warm canvas (`atelier-canvas`) under catalog flows; slightly cooler global `surface` for system-wide baseline.
- Large corner radius on catalog shells and cards (**28px**, `rounded-[28px]` in code, token `rounded.catalog` in frontmatter).
- Shadows: utility classes `shadow-atelier-*` in `tailwind.css` (primary-tinted RGB from `--atelier-shadow`), not generic gray-only drops.

## Colors: The Fresh Palette

Earthy greens and sun-warm accents on parchment neutrals; text stays off-black via `on-surface` or `atelier-ink`.

### Primary and secondary (Material roles)

- **Leafy green (`primary`, `#0f5238`)** and **`primary-container` (`#2d6a4f`)**: brand actions, focus rings, primary-tinted rings on cards, gradient CTAs where specified.
- **Warm orange (`secondary` / `secondary-container`)**: appetite and emphasis; use sparingly per strategy in PRODUCT.

### Atelier roles (recipe and planner)

These correspond to `:root` variables in `app/assets/css/tailwind.css` and are the **target** for replacing raw hex on `app/pages/recipes/index.vue` and `app/pages/recipes/[id]/index.vue`:

| Role (Tailwind) | Hex (light) | Typical use on recipe surfaces |
| --- | --- | --- |
| `atelier-canvas` | `#f7f2e8` | Full-page background behind catalog/detail |
| `atelier-parchment` | `#fffaf0` | Cards, filter panel, empty states |
| `atelier-ink` | `#1e261f` | Default body copy where not using `on-surface` |
| `atelier-heading` | `#123628` | H1/H2, strong titles |
| `atelier-warm-accent` | `#b7662f` | Eyebrow labels ("Recipe Catalog", category line) |
| `atelier-chip` | `#f0e4d2` | Soft fills (selection mode toggle, meta chips) |
| `atelier-image-well` | `#e6d6bd` | Image placeholder area |
| `atelier-description` | `#5d6c60` | Secondary descriptions |
| `atelier-meta` / `atelier-neutral-action` / `atelier-icon-muted` | `#6a786b` / `#485746` / `#6b7b6e` | Metadata, icons, muted labels |
| `atelier-error-foreground` | `#9c3d16` | Error banners and destructive actions |
| `atelier-primary-hover` | `#174d38` | Primary button hover near `#0f5238` |

**The Ring-Instead-Of-Rule (for catalog).** Section separation on recipe list uses **`ring-1 ring-primary/8–15`** on parchment panels and cards, not 1px solid dividers. This is the implemented interpretation of tonal separation; keep rings soft and low-contrast.

**The Dual-Surface Rule.** Global body uses `surface` (`#fbf9f8`); recipe flows often sit on **`atelier-canvas`**, which is warmer. Both are valid: do not collapse them to a single hex without an explicit decision; document the intent (catalog feels like a dedicated "atelier room").

## Typography: The Editorial Rhythm

**Display / headline font:** Newsreader (with Georgia fallback). **Body / label font:** Plus Jakarta Sans.

**Character:** Confident editorial display paired with a legible sans for lists, filters, and metadata.

### Hierarchy

- **Display** (semibold, clamp ~2.25–3.75rem, tight line height): catalog hero "Your Atelier", large recipe titles.
- **Headline** (semibold, ~1.5–2rem): section titles ("Ingredients", "Steps"), empty-state headings.
- **Title** (semibold, ~1.5rem): card titles in the grid (`RecipeCatalogGridCard`).
- **Body** (medium ~1rem, relaxed line height): descriptions, ingredients, steps; cap long measure lines around **65ch** where possible (detail steps already use `max-w-[65ch]`).
- **Label** (semibold, ~0.75rem, wide tracking, uppercase): "Sort", filter field labels, eyebrow lines.

**The Left-Align Body Rule.** Do not center-align body paragraphs except in dedicated empty-state blocks.

## Elevation: Tonal Layering and Atelier Shadows

Depth is primarily **tonal** (parchment on canvas, white inputs on parchment) with **primary-tinted** shadows for atmosphere.

**Shadow vocabulary** (see `@layer components` in `app/assets/css/tailwind.css`):

- **`shadow-atelier-grid-card` / `shadow-atelier-grid-card-hover`:** recipe grid cards; smaller blur than hero cards.
- **`shadow-atelier-float`:** floating pills and chrome.
- **`shadow-atelier-primary-btn`:** solid primary CTAs.
- **`shadow-atelier-dock`:** fixed bottom bulk bar.
- **`shadow-atelier-status-*`:** error/warn/success panels.

**The No-Layout-Animation Rule.** Prefer transitioning `transform` and `box-shadow` on cards (as on catalog links), not width/height/margin animations.

**Frosted chrome.** Navigation and dock use **backdrop blur** with a light opaque tint (`bg-.../95` patterns). DESIGN intent: glass is functional (legibility over imagery), not decorative blur everywhere.

## Components

### Navigation (top bar)

- **Current implementation:** Fixed bar, height ~5rem, `bg-stone-50/80` (dark: `stone-900/80`), `backdrop-blur-md`, `shadow-sm`. Brand link: Newsreader italic, **emerald** tones. Items: emerald active underline, stone idle (**drift** vs token table above).
- **Target for color pass:** Map to `bg-surface/80` or `bg-atelier-parchment/80`, text `atelier-heading` / `on-surface`, active state `primary` or `atelier-heading` with `border-b-2` in `primary`, idle `on-surface-variant` or `atelier-muted`, hover `primary` or `atelier-primary-hover`. Keep backdrop blur and fixed positioning.

### Recipe catalog grid card

- **Wrapper (index):** `rounded-[28px]`, `bg-atelier-parchment`, `ring-1 ring-primary/10`, `shadow-atelier-grid-card`; hover lifts slightly with stronger shadow. Selection mode: `ring-2 ring-primary` when selected.
- **Inner content:** `RecipeCatalogGridCard` uses `atelier-image-well`, `atelier-heading`, `atelier-description`, `atelier-meta`, and `AtelierRecipePill` for chips (tokenized).

### Filter triggers and sort

- **Filter triggers:** `rounded-2xl` pill, `bg-atelier-parchment`, `shadow-atelier-float`, `ring-1 ring-primary/10`, min height 48px (`min-h-12`).
- **Sort control:** `rounded-full`, `bg-surface-container-low`, `text-on-surface-variant` (Material role, not atelier).

### Recipe detail

- **Structure:** Same canvas background as catalog; back link and primary actions use `primary` / `atelier-chip` fills; hero image container uses `atelier-image-well` or equivalent fill with primary-tinted shadow.
- **Ingredients:** Step numbers in Newsreader with **`atelier-warm-accent`** (matches catalog eyebrow).
- **Tags:** Pills with white/translucent fill and `ring-primary/10`.

### Buttons (CTAs)

- **Primary solid:** `primary` background, white text, `rounded-2xl`, `shadow-atelier-primary-btn`, hover toward `atelier-primary-hover` or darker primary.
- **Soft secondary:** `atelier-chip` fill, `primary` or `atelier-heading` text (edit, clear filters).

## Do's and Don'ts

### Do:

- **Do** use `atelier/*` or Material semantic colors from `tailwind.config.ts` instead of re-typing hex on surfaces covered by `designTokenCompliance.ts` (and extend that list when stabilizing recipes list/detail).
- **Do** keep touch targets at least **44px** height on primary actions (`min-h-touch`, `min-h-12`, `min-h-14` in recipe flows).
- **Do** use Newsreader for recipe titles and step indices where the catalog already does.
- **Do** respect `prefers-reduced-motion` on hover transitions (patterns already use `motion-reduce:*` in catalog).

### Don't:

- **Don't** build new recipe UI on **stone** / **emerald** Tailwind defaults; align with **TopNavBar** remediation to the shared token set.
- **Don't** let the product feel like **industrial ERP systems**: sterile grids, data-dump tables, zero personality, overwhelming options.
- **Don't** mimic **generic meal-kit subscription apps** (stock-photo heaviness, gamified upsell patterns, corporate-warm tone).
- **Don't** ship **cluttered recipe-aggregator** patterns: ad-like density, competing CTAs, unclear workflow.
- **Don't** use pure **#000** / **#fff** for large text or page backgrounds; use `on-surface`, `atelier-ink`, or `surface-container-lowest`.
- **Don't** use **gradient text** (`background-clip: text` with gradients) for core content (detail error CTA uses a primary gradient; treat as an exception or migrate to solid in a later pass if simplifying).
