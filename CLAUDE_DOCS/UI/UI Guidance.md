Below is a **Claude Code–ready UI guide** to match Fendo Golf’s site vibe: premium, minimalist, performance-obsessed, “short game culture,” with bold editorial sections and high-end product photography energy. The language and section structure on the site is very “manifesto + proof + product tech.” ([Fendo Golf][1])

---

# Fendo-Inspired UI Guide (for our accompanying app)

## 1) Brand + UI DNA (what we’re matching)

**Personality:** premium performance gear, modern golf culture, confident and disciplined—not playful.
**Tone pillars (copy + UI):**

* **Preparation > power** (habit + craft framing) ([Fendo Golf][2])
* **Short-game / scoring-zone obsession** (“inside 150/160 yards”) ([Fendo Golf][3])
* **“No fluff”** value language (clean, direct, purposeful) ([Fendo Golf][2])

**Visual vibe:**

* Clean editorial layouts, big headlines, lots of whitespace
* High-contrast black/white foundation
* Product/photography is the “texture” (golf course light, gear close-ups)

**Design rule:** *Everything should feel like performance equipment.* No cute UI patterns. No default component-library look.

**Logo:** /frontend/public/images/Fendo-golf-blue-logo.webp

---

## 2) Layout System

**Page structure pattern (repeatable):**

1. **Hero Manifesto**: giant headline + short subcopy + single primary CTA ([Fendo Golf][1])
2. **Feature Blocks**: alternating image + text, very scannable, “tech callouts” ([Fendo Golf][1])
3. **Proof**: testimonials / stats / credibility band ([Fendo Golf][1])
4. **Culture/Community**: “clubhouse” section, badges, membership language ([Fendo Golf][3])
5. **Footer CTA**: email capture / stay sharp messaging ([Fendo Golf][1])

**Grid & spacing:**

* Max content width: **1120–1240px**
* Section padding: **py-20 to py-28** desktop, **py-14** mobile
* Use **intentional negative space**; avoid dense dashboards unless absolutely necessary.
* Prefer **2-column editorial** layouts over “cards everywhere.”

---

## 3) Typography (editorial + athletic)

**Goal:** “premium magazine + performance manual.”

**Type scale (Tailwind-ish targets):**

* H1: `text-5xl md:text-7xl font-semibold tracking-tight leading-[0.95]`
* H2: `text-3xl md:text-4xl font-semibold tracking-tight`
* H3: `text-xl md:text-2xl font-semibold`
* Body: `text-base md:text-lg leading-relaxed`
* Microcopy / labels: `text-xs uppercase tracking-[0.18em]`

**Styling behaviors:**

* Headings: tight tracking, confident.
* Labels: uppercase + letterspaced for “gear/spec” vibe.
* Emphasize *short sentences* and *line breaks* (manifesto cadence) ([Fendo Golf][1])

---

## 4) Color + Materials (match the site’s restraint)

The brand reads as **near-black + near-white** with subtle grays, plus a bold product accent (their product photography frequently uses a bright blue).
A publicly shared palette associated with the brand mark uses near-black/white and cool grays. ([Dribbble][4])

### Recommended token set (verify exact hex from live CSS, but start here)

```css
:root{
  --bg:        #FDFDFE; /* near-white */
  --fg:        #010106; /* near-black */
  --muted:     #555967; /* slate */
  --muted-2:   #91949F; /* cool gray */
  --border:    #BCBEC6; /* soft border */
  --surface:   rgba(1,1,6,0.03); /* subtle tint */
  --accent:    #2D6BFF; /* “product-blue” starting point (tune to match photography) */
  --success:   #0E7A3B; /* restrained green */
  --danger:    #B42318; /* restrained red */
}
```

**Important:** Keep accent usage disciplined:

* 1 primary CTA color
* 1 subtle highlight color for focus rings / selection
* Everything else monochrome + photography

**Finish:** add *barely-there grain* or noise on large surfaces (5–8% opacity) to avoid flat “SaaS default.”

---

## 5) Components (build these with nuance + polish)

### 5.1 Navigation (web → app adaptation)

Website uses a clean top nav + a slide-out menu/drawer pattern. ([Fendo Golf][1])
**App translation:**

* Desktop: left “rail” *or* top bar (choose based on app IA)
* Mobile: bottom bar for primary areas + “More” opens a sheet

**Polish requirements:**

* Sticky header with subtle border that appears only after scroll (opacity animation)
* Drawer uses **blurred scrim** + **springy** slide-in

---

### 5.2 Buttons (performance gear feel)

**Primary button:** solid accent, slightly rounded, crisp.

* Height 44–48px
* Radius 12–14px
* Hover: tiny lift + subtle shadow, **not** glow
* Active: press-down scale 0.98

**Secondary:** ghost/outline in near-black with light border.

**CTA copy style:** short and directive (“Get First Access”, “Check out The Playbook”). ([Fendo Golf][2])

---

### 5.3 “Tech Feature” blocks (signature pattern)

Site highlights features like misting, dual bristles, ergonomic grip, etc., with image + tight explanation. ([Fendo Golf][1])
**App pattern:**

* Use for “modules” and “capabilities” inside the app
* Alternating layout: image left then right
* Each block: label → headline → 2–3 sentences → “Learn more” link

**Polish:**

* Image container has a soft radius + gentle shadow
* Subtle divider lines between blocks (hairline)

---

### 5.4 Proof / Testimonials / Social validation

Site has a “Proof” section with short, punchy testimonials. ([Fendo Golf][1])
**App pattern:**

* Use “Proof cards” for user wins, coach feedback, stats, recent improvements
* Cards are monochrome with one accent element (icon, underline, badge)

---

### 5.5 Badges + “Clubhouse” UI (community energy)

Community page uses “clubhouse” language: collective, beta access, badges. ([Fendo Golf][3])
**App pattern ideas:**

* “Collective” badge system (tasteful, not gamified-cartoony)
* Challenges + leaderboards UI (clean tables, strong typography, minimal chrome)

**Polish:**

* Badge icons: flat, single-color, premium (no gradients unless extremely subtle)
* Leaderboard rows: hover highlight is a *surface tint*, not a bright fill

---

### 5.6 Forms (email capture style)

Site repeatedly uses simple, confident capture CTAs (“Get it first / Stay sharp”). ([Fendo Golf][1])
**Form design:**

* Large input, clean border, minimal placeholder
* One button, no extra clutter
* Inline validation (quiet, not shouty)

---

## 6) Motion & Micro-interactions (mandatory; this is where “not boring” happens)

**Motion principles:**

* Fast, crisp: 160–220ms for most transitions
* Use **spring** only for drawers/sheets
* Prefer **opacity + translateY(6–10px)** entrance on scroll sections

**Signature micro-interactions to implement:**

1. **Scroll-reveal** for section headers (stagger label → H2 → body)
2. **CTA button** press physics (tiny compression)
3. **Card hover**: border darkens slightly + shadow tightens (premium tactile)
4. **Active nav state**: underline slides (not fades)

No confetti. No bouncy toy animations.

---

## 7) Imagery & Iconography

**Photography direction (match site):**

* Real golfers, real light, tight crops, “in the bag / on-course” moments
* Product close-ups with crisp details
* Avoid stocky business imagery; keep it golf-authentic

**Icon style:**

* Monoline, slightly heavier stroke (1.75–2px)
* Use icons sparingly; typography should do most of the work

---

## 8) App UI Patterns (how to feel like Fendo even in “app land”)

To avoid generic SaaS:

* Use **editorial sectioning** inside the app (modules read like “chapters”)
* Prefer **big type + simple surfaces** over heavy card grids
* Build a “Playbook” reading experience (clean article layout, progress, saved items) ([Fendo Golf][2])
* When you *must* do dashboards: keep charts minimal, monochrome lines, accent only for highlights.

---

## 9) Claude Code Implementation Notes (what to build)

**Tech assumptions (adjust if needed):**

* Next.js App Router + Tailwind
* Use CSS variables for tokens and map to Tailwind via `theme.extend.colors`
* Build components as composable primitives (Button, Input, Card, Section, Stat, Badge, Sheet)

**Deliverables for Claude Code:**

1. `theme.css` (CSS variables + light/dark ready)
2. Tailwind config mapping tokens
3. Component set:

   * `AppShell` (header/rail + responsive nav)
   * `SectionHeader` (label + headline + subcopy)
   * `FeatureBlock` (image + text alt layout)
   * `ProofCarousel` or `ProofGrid`
   * `Badge` + `LeaderboardTable`
   * `EmailCaptureCTA`
4. Motion utilities (Framer Motion variants or CSS keyframes)

**Quality bar instruction for Claude Code:**

* “No default shadcn look.” Every component needs tuned spacing, radius, shadow, hover/active states, and focus rings.
* Add subtle grain + smart dividers so large white surfaces don’t feel empty.
* Keep color disciplined; let typography and photography carry.