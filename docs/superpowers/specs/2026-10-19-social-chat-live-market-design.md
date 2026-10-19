# Social, chat, live, and market workspace refinement

## Goal

Make FxZone’s mobile and desktop social, chat, live-session, and market experiences more dependable and easier to scan while keeping all displayed market and account data honest and backed by the existing application services.

## Scope and constraints

- Keep Next.js, Supabase Auth/Postgres/Realtime/Storage, and Vercel as the active architecture.
- Preserve existing working posting, reactions, mutual-follow chat access, host-controlled broadcast admission, provider-market data, and theme preferences.
- Do not delete real database accounts without an explicit target list and an authorized maintenance operation.
- Exclude demo/mock identities and posts only where the existing data marks them as demo or system-generated.
- Do not claim universal mobile screen-sharing support: show native sharing only where `getDisplayMedia` is available and explain unavailable browser capability clearly.
- Do not manufacture prices, OHLC candles, indicators, news facts, or AI chart conclusions.

## Increment 1 — navigation, theme, and social composition

- Add an accessible unread badge to footer/mobile navigation icons. Badge state comes from existing notification/message unread counts and is hidden when zero.
- Use semantic theme tokens for the FxZone wordmark in light mode so it remains readable against every supported canvas.
- Remove the optional-caption prompt from the composer without changing attachment metadata or post submission validation.
- Normalize and render real supported asset tags from post text and attachment metadata. Tags link to the existing selected-instrument/dashboard path only when the catalogue recognizes the symbol.
- Ensure no mock/demo rows are generated in social/discovery presentation. Existing real user records remain queryable under current authorization policies.

## Increment 2 — direct chat correctness and mobile layout

- Canonicalize direct conversations by the sorted pair of participant IDs. A lookup returns the existing conversation before attempting a new one, preventing duplicate direct threads.
- Keep group conversations separate; their participant set and settings remain independent of direct-chat identity.
- Add an authorized delete-conversation action that removes the current user’s membership or hides the thread for that user, depending on existing schema support. It must never let a user delete another user’s messages or group.
- Fix the mobile composer/page container so it ends at the safe-area footer without a blank strip. Keep send controls reachable above the keyboard and mobile footer.
- Expose an unread badge in chat navigation and update it from the existing private notification/realtime flow.

## Increment 3 — real chart sharing and signals

- Build a compact chat market chart from the current provider quote/history endpoint and `lightweight-charts`.
- Support provider-available intervals only; unavailable intervals remain explicitly unavailable rather than interpolated.
- Add horizontal price-line annotations and a share-signal composer that shares symbol, interval, level, direction, and optional rationale as structured chat content.
- Keep drawing/analysis controls bounded to client-side annotations. Do not imply TradingView or institutional analysis when the underlying provider does not supply it.

## Increment 4 — market workspace and Discover research

- Wire workspace density to compact, comfortable, and spacious layout classes for the active screener/detail panels; persist through the existing settings store.
- Make provider-history interval switching fetch/use verified OHLC candles and clearly show when a selected interval has no data.
- Add an evidence graph to Discover’s AI news explanation. The graph presents article source, timestamp, tagged assets, and stated facts/uncertainties; it is not a price prediction or sentiment score.

## Increment 5 — live-session mobile behaviour

- Preserve the current host-only broadcast controls and whole-display capture preference.
- Detect browser screen-capture support and mobile constraints before enabling sharing. Unsupported devices get a short actionable message, while supported Android/desktop browsers use the native picker.
- Keep remote screen display responsive and prevent a host from rendering their own captured stream inside the capture surface.

## Data and authorization

- Existing Supabase RLS and route authorization remain the enforcement point for profiles, direct-chat membership, messages, follows, session participants, and notifications.
- Any migration is introduced only if inspection proves the existing schema cannot enforce canonical direct conversations or user-visible thread removal safely. Migrations must be additive and idempotent.
- Demo-data filtering is presentation/query logic unless a user supplies an explicit deletion target list.

## Validation

- Add focused tests for unread-badge visibility, canonical direct-chat lookup, mobile composer layout contracts, supported asset-tag mapping, structured signal validation, chart interval availability, density persistence, and screen-share capability messaging.
- Run lint, typecheck, the full test suite, and a production build using the repository-supported Node 22/npm 10 runtime when available.
- Manually verify authenticated mobile and desktop flows against a Supabase-configured deployment before declaring visual parity.
