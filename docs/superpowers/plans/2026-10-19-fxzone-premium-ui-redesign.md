# FxZone Premium UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a responsive, accessible, theme-consistent financial product UI while preserving all existing product flows and integrations.

**Architecture:** Consolidate structural colour, typography, spacing, interaction, and motion into semantic CSS tokens and the existing UI primitives. Upgrade the application shell first, then update public and authenticated views without changing their API, Supabase, market-data, or WebRTC contracts.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS 3, Framer Motion, `next/font`, Lucide React, existing Supabase client.

**Spec:** `docs/superpowers/specs/2026-10-19-fxzone-premium-ui-redesign-design.md`

## Global Constraints

- Preserve Dark Terminal, Neon Cyber, and Minimal Light themes and current user preference behavior.
- Do not alter Supabase schemas, migrations, RLS, Auth behavior, backend APIs, WebRTC admission, or market calculations.
- Preserve existing routes, deep links, provider provenance, legal disclosures, and feature availability.
- Use existing dependencies and Tailwind architecture; do not add a component library or upgrade the framework.
- Load Manrope for display headings, Inter for UI/body copy, and JetBrains Mono for financial data through `next/font`.
- Ensure 44px primary touch targets, no horizontal page overflow from 320px upward, visible focus states, and `prefers-reduced-motion` support.

## Review Focus

- Minimal Light structural surfaces and muted copy retain readable contrast without changing positive/negative market colours.
- 320px viewports retain reachable navigation, market controls, chat composer, post controls, and auth fields without document overflow.
- Decorative motion respects the system preference and does not block interaction.
- Provider-unavailable market states remain explicit and never gain fabricated figures or claims.
- Chat and live-session layouts preserve all action, disabled, and loading states.

---

## File structure

| Path | Responsibility |
| --- | --- |
| `frontend/app/layout.tsx` | Load local font variables at the application root. |
| `frontend/app/globals.css` | Define semantic theme, type, focus, motion, and responsive foundations. |
| `frontend/components/ui/{Button,Card,Input,Badge}.tsx` | Render stable, token-aware shared primitives. |
| `frontend/components/layout/{Sidebar,Navbar,ThemeSwitcher}.tsx` | Render responsive app navigation. |
| `frontend/app/page.tsx`, `frontend/components/landing/*` | Public product narrative and footer. |
| `frontend/app/(auth)/*/page.tsx` | Responsive authentication surfaces without auth logic changes. |
| `frontend/app/(dashboard)/*/page.tsx` and feature components | Compose product views with the shared hierarchy. |
| `frontend/**/*.test.js` | Protect visual contracts where screenshot testing is unavailable. |

### Task 1: Install visual foundations

**Files:** Modify `frontend/app/layout.tsx`, `frontend/app/globals.css`, `frontend/app/themeCompatibility.test.js`, and `frontend/app/landingMotion.test.js`.

**Interfaces:** Produces `--fx-bg-canvas`, `--fx-bg-surface`, `--fx-bg-elevated`, `--fx-text-strong`, `--fx-text-muted`, `--fx-accent`, `--fx-positive`, `--fx-negative`, and the root font variables `--font-display`, `--font-ui`, and `--font-data` for each theme.

- [ ] **Step 1: Write the failing foundation tests.** Extend the theme test to require every semantic token for all three themes and the motion test to require a reduced-motion rule for decorative animation.
- [ ] **Step 2: Run `node --test app/themeCompatibility.test.js app/landingMotion.test.js`.** Expect failure because the new token/font contract does not exist.
- [ ] **Step 3: Load `Manrope`, `Inter`, and `JetBrains_Mono` with `next/font` in `app/layout.tsx`.** Attach their variables to `<html>` and remove the external Google font import.
- [ ] **Step 4: Add the token and accessibility base layer in `globals.css`.** Use semantic structural mappings, tabular data typography, visible focus, safe-area spacing, and reduced-motion handling. Keep market gain/loss colours direction-specific.
- [ ] **Step 5: Re-run the focused tests.** Expect PASS.
- [ ] **Step 6: Commit as `feat: establish fxzone visual foundations`.**

### Task 2: Refine shared primitives and navigation

**Files:** Modify `frontend/components/ui/{Button,Card,Input,Badge}.tsx`, `frontend/components/layout/{Sidebar,Navbar,ThemeSwitcher}.tsx`, and `frontend/app/themeCompatibility.test.js`.

**Interfaces:** Consumes Task 1 tokens. Preserves all current primitive props. Produces token-aware variants, visible focus, and touch-safe standard actions.

- [ ] **Step 1: Write failing source assertions.** Require shared primitives to use semantic surface/text roles and navigation controls to expose accessible labels with 44px targets.
- [ ] **Step 2: Run `node --test app/themeCompatibility.test.js`.** Expect failure until primitives use the new contract.
- [ ] **Step 3: Replace structural zinc/blue classes with scoped token-aware variants.** Preserve semantic danger, success, and disabled states, and do not change any public component prop.
- [ ] **Step 4: Apply the shell pattern to Sidebar, Navbar, and ThemeSwitcher.** Keep every existing route link and safe-area-aware mobile controls.
- [ ] **Step 5: Run `node --test app/themeCompatibility.test.js app/discoverExperience.test.js`.** Expect PASS.
- [ ] **Step 6: Commit as `feat: unify application shell and ui primitives`.**

### Task 3: Redesign public, legal, and authentication surfaces

**Files:** Modify `frontend/app/page.tsx`, `frontend/components/landing/LandingDetails.tsx`, `frontend/app/(auth)/login/page.tsx`, `frontend/app/(auth)/register/page.tsx`, `frontend/app/(auth)/auth/callback/page.tsx`, legal pages, and `frontend/app/landingMotion.test.js`.

**Interfaces:** Consumes Tasks 1–2. Preserves registration/login/dashboard/legal destinations, OAuth callback behavior, and social links. Produces responsive public/auth presentation with pointer-inert decoration.

- [ ] **Step 1: Write failing landing contract tests.** Assert mobile keeps login/registration access, retains equivalent product context, and declares watermark layers pointer-inert.
- [ ] **Step 2: Run `node --test app/landingMotion.test.js`.** Expect failure before the mobile contract is represented.
- [ ] **Step 3: Refactor landing sections around real FxZone capabilities.** Keep truthful copy, existing calls to action, legal links, and the live brand mark; never add invented testimonials, statistics, or prices.
- [ ] **Step 4: Apply the shared auth/legal surface.** Improve labels, error/status regions, and responsive form containment without changing form handlers, redirects, or OAuth exchange calls.
- [ ] **Step 5: Run `node --test app/landingMotion.test.js lib/oauthRedirect.test.js lib/oauthClientConsistency.test.js`.** Expect PASS.
- [ ] **Step 6: Commit as `feat: refine public and authentication experiences`.**

### Task 4: Apply the market-workspace hierarchy

**Files:** Modify `frontend/app/(dashboard)/dashboard/page.tsx`, market components (`StockScreenerDashboard`, `VerifiedAssetDetail`, `MarketOverview`, `WatchlistPanel`, `CandlestickChart`), AI/news panels, and market view tests.

**Interfaces:** Consumes existing quote, indicator, explanation, and provider-quality props. Preserves all API fetches, selected-asset behavior, unavailable states, and calculations.

- [ ] **Step 1: Add failing market visual-contract tests.** Require delayed/unavailable labels and a responsive selected-asset/provider-provenance surface.
- [ ] **Step 2: Run `node --test lib/marketDashboard.test.js lib/marketScreenerView.test.js components/trading/VerifiedAssetDetail.test.js`.** Expect failure.
- [ ] **Step 3: Apply shared section headers and surfaces to screener, asset detail, chart, research, AI explanation, watchlist, and news.** Use `--font-data` for values and retain real provider semantics.
- [ ] **Step 4: Make filter rows and dense tables intentionally scroll or stack on small screens.** Preserve every control and asset category.
- [ ] **Step 5: Re-run the market tests.** Expect PASS.
- [ ] **Step 6: Commit as `feat: refine market intelligence workspace`.**

### Task 5: Refine social, Discover, and profile presentation

**Files:** Modify Discover, feed, and profile pages; `UserCard`, `StoryBar`, `PostGallery`, `PostComposer`, `PostCard`, `CommentThread`, `BrokerSelector`; and Discover/post gesture tests.

**Interfaces:** Consumes current social responses and callbacks. Preserves follow filtering, post/story creation, reactions, comments, bookmarks, reposts, profile updates, brokers, and gallery gestures.

- [ ] **Step 1: Add failing mobile social contract tests.** Require compact suggestions, reachable action rows, and active-position information for galleries without altering gestures.
- [ ] **Step 2: Run `node --test app/discoverExperience.test.js lib/postGesture.test.js`.** Expect failure.
- [ ] **Step 3: Apply shared cards, composer, media, menu, and profile-metric presentation.** Do not modify fetches, follow rules, or interaction callbacks.
- [ ] **Step 4: Check a 320px layout for composer, comments, menus, actions, profile metrics, and gallery controls.** Fix only reproducible overflow.
- [ ] **Step 5: Run `node --test app/discoverExperience.test.js lib/postGesture.test.js lib/postAttachments.test.js`.** Expect PASS.
- [ ] **Step 6: Commit as `feat: polish social discovery and profiles`.**

### Task 6: Unify chat and live-session presentation

**Files:** Modify chat/session pages, `ChatSidebar`, `ChatWindow`, `MessageInput`, `SessionRoom`, `SessionControls`, `SessionChat`, `ScreenShare`, `lib/chatMessageDeletion.test.js`, and `lib/live-session.test.js`.

**Interfaces:** Consumes current conversation, membership, WebSocket, and WebRTC interfaces. Preserves mutual-chat visibility, message deletion, session admission, host controls, private signaling, and screen-share behavior.

- [ ] **Step 1: Add failing safety assertions.** Require a mobile-safe composer and visible session role/screen-share status without changing client APIs.
- [ ] **Step 2: Run `node --test lib/chatMessageDeletion.test.js lib/live-session.test.js`.** Expect failure.
- [ ] **Step 3: Apply responsive communication surfaces.** Refine spacing, message grouping, composer placement, control arrangement, participant presentation, and focus treatment while retaining WebRTC/media constraints and API calls.
- [ ] **Step 4: Re-run the chat/live tests.** Expect PASS.
- [ ] **Step 5: Commit as `feat: refine chat and live session interfaces`.**

### Task 7: Perform responsive, accessibility, and regression verification

**Files:** Modify `design-qa.md` and only source/tests needed to fix a reproduced issue.

**Interfaces:** Consumes tasks 1–6 and produces an evidence-based QA record.

- [ ] **Step 1: Run `npm run lint`, `npm run typecheck`, `npm run test`, and `npm run build` from `frontend`.** Record exact results; if Windows build infrastructure fails, capture its output and verify the isolated deployment build instead.
- [ ] **Step 2: Review landing, login, registration, dashboard, Discover, feed, chat, profile, and live-session entry at 320, 360, 375, 390, 430, 768, 1024, 1280, and 1440px.** Record routes blocked by missing safe configuration rather than inferring their result.
- [ ] **Step 3: Tab through navigation, forms, menus, modals, social actions, composer, and live controls in all three themes.** Confirm visible focus, readable text, and operational actions.
- [ ] **Step 4: Update `design-qa.md` with only observed evidence and unresolved limitations.**
- [ ] **Step 5: Commit as `test: verify premium ui redesign`.**

## Plan self-review

- **Spec coverage:** Tasks 1–2 cover themes, typography, motion, primitives, and navigation; Task 3 covers public/auth/legal; Tasks 4–6 cover each product capability; Task 7 covers responsive and accessibility QA.
- **Review focus coverage:** The five review-focus risks map to Tasks 1–2, 3/5/6, 1/3, 4, and 6 respectively, each with an automated or manual test.
- **Type consistency:** Existing component and data interfaces stay authoritative; the plan adds CSS/font contracts rather than a new runtime data contract.
- **Scope check:** No component library, provider integration, database change, route removal, or fake product content is planned.
