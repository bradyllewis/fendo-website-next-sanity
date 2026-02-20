# Fendo Golf — Global Design System

> **ALWAYS use this design system for every component, page, and UI element in this app.**
> Consistency across all surfaces is non-negotiable.

---

## Color Tokens (defined in `globals.css` @theme)

| Token | Hex | Tailwind Class | Usage |
|---|---|---|---|
| `--color-bg` | `#F8EDD9` | `bg-bg` / `text-bg` | Page background (warm beige) |
| `--color-fg` | `#0C1C23` | `bg-fg` / `text-fg` | Primary text, dark surfaces |
| `--color-muted` | `#4D6B59` | `text-muted` | Body copy, secondary text |
| `--color-muted-2` | `#6E8880` | `text-muted-2` | Timestamps, meta info |
| `--color-border` | `#C8B596` | `border-border` | All dividers and borders |
| `--color-surface` | `#F1E2C5` | `bg-surface` | Subtle section backgrounds |
| `--color-accent` | `#BD5846` | `bg-accent` / `text-accent` | Primary CTA, active states |
| `--color-accent-hover` | `#A84136` | — | Accent hover state |
| `--color-navy` | `#040F2C` | `bg-navy` / `text-navy` | Darkest dark, deep hero sections |
| `--color-green` | `#31483B` | `bg-green` / `text-green` | Forest green, secondary brand |
| `--color-mustard` | `#F2E19E` | `bg-mustard` / `text-mustard` | Warm highlight accent |
| `--color-success` | `#31483B` | `text-success` | Success states |
| `--color-danger` | `#9E3525` | `text-danger` | Error/danger states |

**Rule:** Keep accent usage disciplined. One primary CTA color, one focus ring color, everything else monochrome + photography.

---

## Typography Scale

| Class | Size | Weight | Tracking | Use |
|---|---|---|---|---|
| `display-xl` | clamp(3.5rem→7.5rem) | 600 | −0.04em | Hero headlines |
| `display-lg` | clamp(2.5rem→4.5rem) | 600 | −0.03em | Section heroes |
| `display-md` | clamp(1.75rem→2.5rem) | 600 | −0.025em | Sub-section headers |
| `label-mono` | 0.7rem | 400 | +0.18em | Uppercase spec labels (gray) |
| `label-mono-accent` | 0.7rem | 400 | +0.18em | Uppercase spec labels (accent blue) |

**Heading base:** `font-semibold tracking-tight` (applied globally in base layer)
**Body:** `text-base md:text-lg leading-relaxed` with `text-muted`

---

## Fonts

- **Sans:** `Inter` (`--font-inter`) → loaded in `layout.tsx`, mapped via `--font-sans`
- **Mono:** `IBM Plex Mono` (`--font-ibm-plex-mono`) → for labels, code, timestamps

Use `font-mono` for: uppercase tracking labels, dates, stat units, code.
Use `font-sans` (default) for everything else.

---

## Button System

| Class | Appearance | Use |
|---|---|---|
| `btn-primary` | Solid dark (`fg` bg, `bg` text) | Primary page actions |
| `btn-accent` | Solid blue (`accent` bg, white text) | Featured CTAs, header CTA |
| `btn-ghost` | Invisible, muted text → fg on hover | Secondary / text links |
| `btn-outline` | Border only → fills dark on hover | Alternative actions |

All buttons: 44px+ height, `rounded-xl`, transitions at 160ms, `active:scale-[0.98]`.

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
| `display-xl/lg/md` | Editorial headline scale |
| `label-mono` | Uppercase mono label (gray) |
| `label-mono-accent` | Uppercase mono label (blue) |
| `btn-primary/accent/ghost/outline` | Full button system |
| `card-base` | Border card with hover shadow transition |
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
- Focus rings: visible via `:focus-visible` (accent blue, 2px offset 3px)
- Min touch target: 44×44px for all interactive elements
- Heading hierarchy: `h1` per page → `h2` for sections → `h3` for cards
