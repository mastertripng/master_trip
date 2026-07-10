This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load Inter, a custom Google Font.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Design System

This app implements the MasterTrip brand design system on top of Tailwind CSS v4's CSS-first
config. Every new page/section should reuse these tokens and patterns rather than introducing
one-off values, so the product stays visually consistent as it grows.

### Design tokens (`app/globals.css`)

All tokens live in the single `@theme` block in `app/globals.css`. Tailwind auto-generates
utility classes from them (e.g. `--color-primary` → `bg-primary` / `text-primary`).

**Colors**

| Token | Value | Utility | Usage |
|---|---|---|---|
| `--color-primary` | `#2563eb` | `bg-primary` / `text-primary` | Primary actions, links, focus |
| `--color-primary-hover` | `#1d4ed8` | `bg-primary-hover` | Primary button hover state |
| `--color-primary-active` | `#1e40af` | `bg-primary-active` | Primary button active/pressed state |
| `--color-navy` | `#0f172a` | `bg-navy` / `text-navy` | Headings, dark surfaces (nav, mobile menu) |
| `--color-sky` | `#eff6ff` | `bg-sky` | Section backgrounds, subtle highlight fills |
| `--color-emerald` | `#10b981` | `bg-emerald` | Success states only |
| `--color-amber` | `#f59e0b` | `bg-amber` | Warnings only |
| `--color-coral` | `#f97316` | `bg-coral` | Sparingly: active tab pill, promo accents, mobile-menu CTA |

Neutrals use Tailwind's built-in `slate-*` scale directly (`slate-50` … `slate-900`) — it already
matches the brand's neutral hex values 1:1, so there's no separate neutral token. Default body
text/background: `text-slate-700` on `bg-slate-50`.

Don't reach for a raw hex value or an arbitrary Tailwind color (`bg-blue-600`, `bg-red-500`,
etc.) in product UI — extend the `@theme` block instead if a new token is genuinely needed.

**Fonts**

- `font-display` → Playfair Display (serif). Headings only: `h1`–`h3`, destination card titles,
  the intro splash logo treatment. Never body copy.
- `font-sans` → Inter (default). Everything else: nav, body copy, form fields, buttons, captions.

**Type scale** — use the semantic size, not a raw Tailwind size:

`text-h1` (64px/bold) · `text-h2` (48px/bold) · `text-h3` (36px/semibold) · `text-h4` (28px/semibold)
· `text-h5` (22px/medium) · `text-body-lg` (18px) · `text-body` (16px, default) · `text-caption`
(14px) · `text-small` (12px)

**Border radius** — every rounded corner in the product maps to one of these, chosen by what the
element *is*, not by eyeballing a px value:

| Utility | Value | Use for |
|---|---|---|
| `rounded-button` | 12px | Tab pills, small in-widget buttons |
| `rounded-cta` | 14px | (reserved — rectangular CTA variant, currently unused in favor of pill CTAs) |
| `rounded-search` | 18px | (reserved) |
| `rounded-card` | 20px | Generic content cards |
| `rounded-image` | 24px | Destination/photo cards |
| `rounded-floating` | 24px | Floating panels, e.g. the hero search widget |
| `rounded-full` | pill | Primary/secondary buttons, search input fields — anything meant to read as a pill |

**Shadows**: `shadow-button` / `shadow-button-hover` (soft blue glow, primary CTA only),
`shadow-card`, `shadow-floating` (floating widget/panel elevation).

**Spacing**: stick to Tailwind's default 4px-based scale (which already covers the brand's 8pt
spacing scale — 4, 8, 16, 24, 32...). Don't hand-roll arbitrary spacing values.

### Layout & breakpoints

Mobile-first, three target widths, matched to Tailwind's default breakpoints:

- **Phone** (base, `<640px`): single column everywhere. Stack form fields fully (one per row).
  Nav collapses to a hamburger + full-screen `MobileMenu`.
- **Tablet** (`sm:`, `≥640px`): denser multi-column layouts (e.g. 3-across search fields with the
  submit button on its own full-width row below; 2-up card grids). Still uses the hamburger nav.
- **Desktop** (`lg:`, `≥1024px`): full horizontal nav appears; widgets switch from a stretchy grid
  to a content-sized `flex` row (`lg:w-fit`) so elements hug their content instead of stretching
  with lopsided leftover space on one side.

Page sections are full-bleed (`bg-slate-50`, full width) with responsive horizontal padding:
`px-4 sm:px-6 lg:px-20`, and inner content constrained with `mx-auto max-w-[1440px]`
(the brand's desktop grid width).

### Component patterns (`app/components/`)

One component per file, PascalCase filename matching the export. Only mark a component
`"use client"` if it actually needs state/effects/refs (`SearchWidget`, `Navbar`, `MobileMenu`,
`IntroTakeoff`, and any section with a scroll-triggered GSAP reveal — `GlobalEducation`,
`PopularDestinations`, `WhyChooseUs`, `TravelInsights`) — plain presentational sections with no
hooks (`Hero`) stay server components.

- **Section wrapper**: `<section className="bg-slate-50 px-4 pt-… pb-… sm:px-6 lg:px-20">` with an
  inner `mx-auto max-w-[1440px]` container. Section heading pattern: `font-display text-3xl
  font-bold text-navy sm:text-h3` + a `text-body text-slate-500` subheading underneath.

- **Pill form field** (see `SearchWidget.tsx`'s `Field` helper): the label sits *outside and above*
  the input as a plain `text-small text-slate-500` caption — never inside the same bordered
  container as the value. The value sits in its own `rounded-full border border-slate-300
  bg-white` row with a leading icon. Always set `text-left` explicitly on containers that inherit
  `text-center` from a hero/centered parent, and use `whitespace-nowrap` on label/value text so
  pills don't randomly reflow at odd widths.

- **Primary button**: `rounded-full bg-primary text-white shadow-button`, hover →
  `bg-primary-hover` + `shadow-button-hover`, active → `bg-primary-active`. Height comes from
  padding (`py-3.5`), never a fixed `h-*`.

- **Secondary/dark button** (e.g. "Consultation"): `rounded-full bg-navy text-white`, hover →
  `bg-slate-900`.

- **Tab pills** (e.g. Flights/Hotels/Tours/Study Abroad): `flex flex-wrap` (never force a single
  row with shrinking font — let extra tabs wrap to a new line naturally on narrow screens),
  `rounded-button`, active state = `bg-coral text-white`, inactive = `text-slate-500` with a
  `hover:bg-slate-50` hover.

- **Photo cards** (destination cards etc.): `relative overflow-hidden rounded-image`, `next/image`
  with `fill` + `object-cover`, a `bg-gradient-to-t from-navy/80 via-navy/10 to-transparent`
  scrim, and title/subtitle text absolutely positioned at `inset-x-0 bottom-0`. Vary the `aspect-*`
  by breakpoint (wide on a single mobile column, portrait once the grid goes multi-column) rather
  than keeping one fixed ratio at every size.

- **Floating widget card** (search widget): `rounded-floating bg-white shadow-floating`, sized
  `w-full` on phone/tablet so its grid can stretch, then `lg:w-fit lg:max-w-none` on desktop so it
  hugs its content and padding stays visually even on both sides.

- **Icons**: `lucide-react` exclusively for UI iconography (nav, form fields, buttons). Custom
  brand SVGs (logo, plane) live in `public/` and are referenced by path, not imported as
  components.

- **Motion**: respect `prefers-reduced-motion` in every animated component (see
  `IntroTakeoff.tsx` and `MobileMenu.tsx` for the pattern — check the media query and skip straight
  to the end state). One-off CSS keyframe animations go in `globals.css` guarded by the same media
  query; anything more complex (staggered/timeline animation) uses `gsap`.

### Adding a new section/page

1. Reuse the section wrapper + heading pattern above — don't invent new padding/heading styles.
2. Pull every color/font-size/radius/shadow from the tokens above; if none fits, add a new token
   to `@theme` in `globals.css` rather than hardcoding a value inline.
3. Build mobile-first: get the base (phone) layout right, then layer in `sm:` and `lg:` overrides
   for tablet/desktop — don't design desktop-first and retrofit smaller screens.
4. Verify all three breakpoints before calling it done (phone ~390px, tablet ~768px, desktop
   ~1440px).
