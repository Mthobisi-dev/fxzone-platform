# Dashboard heat-map design QA

## Comparison target

- Source visual truth: `C:\Users\mthob\OneDrive\Pictures\Camera imports\2026-09-17\151063.jpg`
- Source dimensions: 400 × 225 pixels.
- Intended implementation route: `http://localhost:3001/dashboard`
- Intended viewport: desktop wide-screen, with a responsive mobile pass after the desktop comparison.
- Intended state: authenticated dashboard with the verified market catalogue loaded, dark terminal theme, US equities selected.

## Capture status

The local Next.js server started successfully on port 3001. Browser rendering of `/dashboard` was blocked before the dashboard could load because `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (or `NEXT_PUBLIC_SUPABASE_ANON_KEY`) are not available in the local environment. The browser showed the Next.js runtime error from `lib/supabase.ts` rather than the dashboard.

- Implementation screenshot path: unavailable — the route did not render.
- Implementation viewport/pixels/density: unavailable — no application content was rendered.
- Full-view and focused-region comparison: blocked because an implementation capture does not exist.
- Primary interactions exercised: not possible; the screen did not render.
- Console/runtime check: failed at Supabase client initialization before the dashboard mounted.

## Findings

- [P1] Visual fidelity cannot be confirmed without a rendered authenticated dashboard.
  - Location: `/dashboard` local preview.
  - Evidence: the source is a compact dark heat map; the local route showed a Supabase configuration error instead of application content.
  - Impact: desktop and mobile layout, tiles, controls, theme states, and responsive behavior cannot be compared to the reference image.
  - Fix: provide non-production Supabase public configuration for local preview, or authenticate to a deployed environment that contains the new commit, then capture and compare the same desktop and mobile states.

## Implementation checklist

1. Supply safe local public Supabase configuration or use the deployed authenticated dashboard.
2. Capture desktop and mobile heat-map views with loaded market data.
3. Compare both captures with the supplied reference and resolve any P1/P2 differences.

## Comparison history

- Iteration 1: blocked before a rendered implementation capture due to missing local Supabase public environment variables. No visual findings can be resolved until the route renders.

final result: blocked
