# Fendo Golf — Global Design System

> **ALWAYS use this design system for every component, page, and UI element in this app.**
> Consistency across all surfaces is non-negotiable.
>
> Aligned to the **2026 Fendo Brand Guide** (`CLAUDE_DOCS/UI/Fendo-DESIGN.md`) — the
> brand source of truth. This file is the code-level implementation of that guide;
> when they conflict, the brand guide wins.

---

## Color Tokens (defined in `globals.css` @theme)

### Approved brand palette (six colors)

| Token | Hex | Tailwind Class | Brand name | Usage |
|---|---|---|---|---|
| `--color-bg` | `#F8EDD9` | `bg-bg` / `text-bg` | Warm White | Default page background; text on dark surfaces |
| `--color-fg` | `#0C1C23` | `bg-fg` / `text-fg` | Dark Cyan | Primary text **and** primary dark surface |
| `--color-brand-black` | `#0A0A0A` | `bg-brand-black` / `text-brand-black` | Brand Black | Pure-black text/fields when a colder near-black is wanted |
| `--color-dark-cyan` | `#0C1C23` | `bg-dark-cyan` | Dark Cyan | Explicit alias for editorial dark panels |
| `--color-navy` | `#040F2C` | `bg-navy` / `text-navy` | Deep Navy | Darkest dark, deep hero sections |
| `--color-green` | `#31483B` | `bg-green` / `text-green` | Course Green | Restrained supporting color — never dominant |
| `--color-accent` | `#BD5846` | `bg-accent` / `text-accent` | Rust | The single approved accent — CTAs, labels, rules |
| `--color-accent-hover` | `#A84136` | — | Rust (dark) | Accent hover state |

### Derived warm neutrals (Brand Black over Warm White)

Not stand-alone hues — composites of the two anchor colors, used for text hierarchy the six-color palette doesn't cover.

| Token | Hex | Tailwind Class | Usage |
|---|---|---|---|
| `--color-muted` | `#45443F` | `text-muted` | Secondary / body copy (≈72% Brand Black) |
| `--color-muted-2` | `#726C61` | `text-muted-2` | Timestamps, meta (≈55% Brand Black) |
| `--color-border` | `#C8B596` | `border-border` | Warm White hairline — dividers, borders |
| `--color-surface` | `#F1E2C5` | `bg-surface` | Warm White deepened — subtle section fills |

### Functional status colors (states only — NOT brand colors)

Reserved for success / warning / error UI. **Never use decoratively or as brand color.**

| Token | Hex | Tailwind Class | Usage |
|---|---|---|---|
| `--color-success` | `#31483B` | `text-success` | Success states |
| `--color-danger` | `#9E3525` | `text-danger` | Error / danger states |
| `--color-mustard` | `#F2E19E` | `bg-mustard` / `text-mustard` | Pending / waitlist / warning states |

**Hard rules (from the brand guide):**
- Warm White is the default light background; primary text is near-black on it.
- **Rust is the only accent — never a page background or large fill, never more than one accent in a layout.**
- Never place near-black text on Deep Navy — use Warm White.
- Course Green stays quiet; never the dominant color.
- Introduce no colors outside this system (functional status colors excepted, states only).

---

## Typography Scale

| Class | Size | Weight | Tracking | Case | Use |
|---|---|---|---|---|---|
| `display-xl` | clamp(3.5rem→7.5rem) | 600 | −0.02em | UPPERCASE | Hero headlines |
| `display-lg` | clamp(2.5rem→4.5rem) | 600 | −0.015em | UPPERCASE | Section heroes |
| `display-md` | clamp(1.75rem→2.5rem) | 600 | −0.01em | UPPERCASE | Sub-section headers |
| `label-mono` | 0.7rem | 400 | +0.18em | UPPERCASE | Eyebrow / spec labels (muted) |
| `label-mono-accent` | 0.7rem | 400 | +0.18em | UPPERCASE | Eyebrow / spec labels (Rust) |

**Heading base:** `font-display` (Outfit) + `font-semibold tracking-tight`, applied globally to `h1–h6`. Raw headings are **not** force-uppercased (protects CMS titles, names, proper nouns); use `display-*` utilities for deliberate all-caps editorial headlines.
**Body:** DM Sans **Light (300)** is the global default; `text-base md:text-lg leading-relaxed` with `text-muted`. Minimum digital body size 14px.
**No italics for emphasis; no Bold 700 in body copy** — use scale, spacing, case, rules, and color.

---

## Fonts

- **Display / headers / labels / CTAs:** `Outfit` (`--font-outfit`) → mapped to `--font-display` and `--font-mono`. ALL CAPS for headers and CTAs.
- **Body:** `DM Sans` (`--font-dm-sans`) → mapped to `--font-sans`, default weight **300 (Light)**.

Loaded in `layout.tsx`. There is **no monospace face** in the brand system — `--font-mono` (and the `label-mono*` utilities) resolve to Outfit so labels render in the brand display face.

Use `font-display` / `label-mono` for: uppercase tracking labels, eyebrows, dates, stat units.
Use `font-sans` (default) for body and everything else.

---

## Button System

| Class | Appearance | Use |
|---|---|---|
| `btn-primary` | Solid dark (`fg` bg, `bg` text) | Primary page actions |
| `btn-accent` | Solid Rust (`accent` bg, white text) | Featured CTAs, header CTA |
| `btn-ghost` | Invisible, muted text → fg on hover | Secondary / inline text links |
| `btn-outline` | `fg` border → fills dark on hover | Alternative actions |

All CTA buttons: **sharp corners (`border-radius: 0`)**, **Outfit 400 ALL CAPS**, letter-spacing 0.04em, **48px min-height**, transitions at 160ms, `active:scale-[0.98]`.
`btn-ghost` is the exception — an inline text link, kept sentence-case in body face.
Cards (`card-base`) are also rectilinear (`border-radius: 0`) — default to sharp corners; round only when a real object/image crop requires it.

---

## Layout System

- **Max content width:** 1200px via `.container` utility
- **Container padding:** 1.5rem (24px) per side
- **Section padding:** `section-padding` = `py-24` | `section-padding-sm` = `py-16`
- **Header height:** `h-20` (80px) → body padded with `pt-20`
- **Feature blocks:** `lg:grid lg:grid-cols-2` — alternating dark/light halves
- **Card grid:** `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6`

---

## Component Utilities (in `globals.css`)

| Utility | Description |
|---|---|
| `container` | Centered, max-width 1200px, padded |
| `display-xl/lg/md` | Editorial headline scale (Outfit, UPPERCASE) |
| `label-mono` | Uppercase Outfit label (muted) |
| `label-mono-accent` | Uppercase Outfit label (Rust) |
| `btn-primary/accent/ghost/outline` | Full button system (sharp corners, Outfit caps) |
| `card-base` | Rectilinear border card with hover shadow transition |
| `section-padding` | Consistent vertical rhythm |
| `link-arrow` | Text link with animated `→` |

---

## Logo

Path: `/public/images/Fendo-golf-blue-logo.webp`
- Normal use: `className="h-7 w-auto"` (header)
- Inverted for dark bg: `className="h-6 w-auto brightness-0 invert"` (footer)

---

## Motion Principles

- **Micro-interactions:** 160–200ms ease
- **Hover → lift:** `hover:-translate-y-px` + shadow increase
- **Button press:** `active:scale-[0.98]`
- **Arrow links:** child `.arrow` span gets `group-hover:translate-x-1`
- **No bounce animations. No confetti. No glow effects.**

---

## Section Pattern (Homepage)

1. Hero Manifesto → large headline + subtext + CTAs
2. Stats strip → hairline-bordered horizontal stats
3. Feature blocks → alternating dark-visual / text columns (3 blocks)
4. Proof cards → testimonials in a `card-base` grid
5. Product callout → split layout with feature list
6. Brand quote strip → dark bg, manifesto quote + CTA
7. Blog/Playbook posts → `AllPosts` component grid

---

## Background Texture

Available tile patterns (use at very low opacity, 0.025–0.05):
- `tile-grid-black.png` → for light backgrounds
- `tile-grid-white.png` → for dark (`bg-fg`) sections
- `tile-1-black.png` → fine dot pattern for light sections
- `tile-1-white.png` → fine dot pattern for dark sections

Always use `aria-hidden="true"` on decorative pattern divs.

---

## Dark Surface Rules (bg-fg sections)

- Text: `text-bg` (white/near-white)
- Muted text: `text-bg/50` or `text-bg/40`
- Borders: `border-bg/10` or `border-bg/15`
- Labels: `text-bg/30`
- Inputs: `bg-white/8 border-white/15 text-white placeholder:text-white/30`

---

## Accessibility Checklist

- All images: `alt` text
- Decorative elements: `aria-hidden="true"`
- Icon-only buttons: `aria-label`
- Form inputs: `<label>` with `htmlFor` (or `sr-only` label)
- Focus rings: visible via `:focus-visible` (Rust accent, 2px offset 3px)
- Min touch target: 44×44px for all interactive elements
- Heading hierarchy: `h1` per page → `h2` for sections → `h3` for cards
