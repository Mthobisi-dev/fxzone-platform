# FxZone premium UI redesign

## Purpose

Make FxZone feel like a coherent financial-intelligence product on phones,
tablets, laptops, and large displays while preserving all current routes,
Supabase integrations, market data, social activity, chat, and live-session
behavior. The redesign is visual and structural at the component level; it
does not alter business rules, database schema, or provider contracts.

## Audit summary

The application already has a useful three-theme model and a solid component
inventory, but it has accumulated page-specific visual rules. `globals.css`
contains both semantic variables and broad compatibility selectors, while many
views retain hard-coded Tailwind colours and uneven type scales. This creates
inconsistent contrast in the light theme and makes mobile adjustments depend on
global emergency overrides instead of the intention of each component.

The public landing page has an established FxZone watermark and a responsive
shell, but it hides meaningful product context on narrow devices. Authenticated
views expose dense financial data, social controls, chat panels, and live-room
controls through different surface and spacing patterns. They need a small set
of shared primitives rather than a visual rewrite of working workflows.

## Chosen approach

The implementation will be token-first and incremental:

1. Establish a semantic foundation for colour, type, spacing, radii, shadows,
   focus, and motion.
2. Update reusable application-shell and UI primitives to consume those
   foundations.
3. Apply the resulting patterns to public/auth screens and then to the
   authenticated product areas.
4. Verify every stage at phone, tablet, laptop, and wide desktop sizes.

This avoids two rejected approaches: a global CSS-only makeover, which would
continue to fight individual component styles; and a wholesale page rewrite,
which would risk working product flows.

## Design system

### Themes and colour

The existing **Dark Terminal**, **Neon Cyber**, and **Minimal Light** themes
remain user-selectable. Their values will be expressed through the same
semantic roles:

| Role | Dark Terminal foundation | Intended use |
| --- | --- | --- |
| `--fx-bg-canvas` | `#0B1220` | Application and page canvas |
| `--fx-bg-surface` | `#111827` | Navigation, standard cards, menus |
| `--fx-bg-elevated` | `#172235` | Raised panels, dialogs, selected states |
| `--fx-text-strong` | `#F8FAFC` | Headings and primary labels |
| `--fx-text-muted` | `#94A3B8` | Supporting information and timestamps |
| `--fx-accent` | `#38BDF8` | Primary actions, focus, active state |
| `--fx-positive` | `#22C55E` | Real positive market movement only |
| `--fx-negative` | `#EF4444` | Real negative market movement only |

All components will use semantic tokens for structural colour. Provider quote
and market-direction colours remain separate so visual styling cannot alter
financial meaning. Glass effects use a single restrained surface recipe and
will never be required to make text readable.

### Typography

`next/font` will provide Manrope for display and section headings, Inter for
interface text, and JetBrains Mono for symbols, prices, percentages, and
timestamps. The Google `@import` will be removed once all fonts are locally
served by Next.js.

The type scale will use `clamp()` so headings grow without overflowing narrow
screens. Financial figures use tabular numerals. Body copy, labels, and
controls will retain readable minimum sizes, with inputs at 16px on phones to
avoid browser zoom.

### Layout and components

The system will define a constrained content shell, an application-shell
spacing rhythm, card variants, compact section headers, a form-control shape,
and button sizes with a 44px minimum touch target where the control is an
interactive primary target. It will reuse current `Card`, `Button`, `Input`,
`Badge`, `Avatar`, `Modal`, `Dropdown`, navigation, and layout components;
their public props stay stable.

## Page treatment

### Public and authentication

The landing page will keep FxZone branding, legal links, existing registration
and dashboard destinations, and the animated watermark. It will gain compact
mobile product context instead of hiding desktop-only content. Decorative
layers remain pointer-inert, low-opacity, and disabled or reduced under
`prefers-reduced-motion`.

Login, registration, and OAuth callbacks will receive an accessible, compact
card layout with visible validation states. Authentication behavior, redirect
destinations, and Supabase client logic will not be changed as part of this
visual work.

### Authenticated workspace

The dashboard and market screens will receive a consistent data hierarchy:
toolbar, selected-instrument context, provider quality, chart/data surface,
and secondary research panel. Quote provenance, unavailable states, and real
market values will remain unchanged.

Discover, the feed, profiles, and comments will share compact social cards,
clear action rows, stable media containers, and mobile-safe menus. Chat will
use the same surface hierarchy, preserve message behavior, and keep the
composer visible above mobile safe areas. Live-session controls, participant
panels, screen-share notices, and live indicators will be visually unified
without changing WebRTC or admission behavior.

## Responsive and accessibility rules

The responsive pass covers 320, 360, 375, 390, 430, 768, 1024, 1280, and 1440
pixel viewport widths. Every page must prevent horizontal document overflow;
dense tables and screeners use intentional scrolling or compact summaries.
Navigation remains reachable on mobile, with no hidden product route used as
the only access path.

Keyboard focus is visible, controls have labels or accessible names, colour is
not the sole source of market direction, and status/error regions retain their
semantic roles. Motion is limited to short state transitions and respects the
user's motion preference. No animation layer may intercept interaction.

## Implementation stages

1. **Foundation:** introduce local fonts, semantic tokens, type/spacing
   utilities, focus styles, and the reduced-motion contract.
2. **Shared shell:** refine navigation, mobile navigation, surfaces, actions,
   forms, loading, error, and empty-state patterns.
3. **Public/auth:** update landing, login, registration, callback, and legal
   page presentation without changing their behavior.
4. **Product views:** apply the system to dashboard/market, Discover/feed,
   profile, chat, and live sessions in small reviewable changes.
5. **Quality pass:** correct responsive overflow, contrast, keyboard states,
   and performance regressions; remove obsolete one-off visual styles only
   after their replacement is in use.

## Validation

Each stage will use targeted component checks plus `npm run lint`, `npm run
typecheck`, `npm run test`, and `npm run build` from `frontend`. Visual review
will cover the listed viewport widths on the landing page, authentication,
dashboard, Discover, feed, chat, and a live-session entry screen. Where local
Supabase public configuration is unavailable, visual checks will be made only
against safe rendered routes or the deployed environment; missing verification
will be reported rather than inferred.

## Explicit non-goals

- No Supabase migration, RLS, Auth, API, WebRTC, or market-provider rewrite.
- No fabricated market data, testimonials, statistics, or partner claims.
- No new component library or broad dependency upgrade.
- No route removal, deep-link change, or feature replacement with placeholder
  UI.
