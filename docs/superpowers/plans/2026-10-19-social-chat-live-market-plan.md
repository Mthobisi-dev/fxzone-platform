# Social, chat, live, and market workspace refinement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the mobile and desktop social, chat, live-session, and market experiences dependable, responsive, and grounded in real application data.

**Architecture:** Preserve the existing Next.js App Router routes and Supabase-backed access model. Add small pure helpers for canonical conversations, asset tags, chart intervals, unread state, and screen-share capability; keep provider data flowing through the existing API routes and keep UI-only filtering separate from account deletion.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS, Supabase Realtime/Storage, `lightweight-charts`, Node’s built-in test runner.

**Spec:** `docs/superpowers/specs/2026-10-19-social-chat-live-market-design.md`

## Global Constraints

- Keep Next.js, Supabase Auth/Postgres/Realtime/Storage, and Vercel as the active architecture.
- Preserve existing working posting, reactions, mutual-follow chat access, host-controlled broadcast admission, provider-market data, and theme preferences.
- Do not delete real database accounts without an explicit target list and an authorized maintenance operation.
- Exclude demo/mock identities and posts only where existing data marks them as demo or system-generated.
- Do not claim universal mobile screen-sharing support; report unsupported browser capability clearly.
- Do not manufacture prices, OHLC candles, indicators, news facts, or AI chart conclusions.
- Avoid schema changes unless route and policy inspection proves they are required.

## Review Focus

- Duplicate direct-chat creation under concurrent starts: one canonical conversation must be returned.
- Unread notification/message state after navigation or reconnect: badges must not drift or expose another user’s data.
- Provider history missing an interval or quote: the chart must show unavailable state instead of synthetic candles.
- Mobile browsers without `getDisplayMedia`: the screen-share control must explain capability and never claim a broadcast started.
- Demo-marked data mixed with real users/posts: presentation must exclude it without deleting real database records.

### Task 1: Footer status, theme contrast, and social post cleanup

**Files:**
- Create: `frontend/lib/postAssetTags.ts`
- Modify: `frontend/components/layout/Sidebar.tsx`
- Modify: `frontend/components/layout/Navbar.tsx`
- Modify: `frontend/components/social/PostComposer.tsx`
- Modify: `frontend/components/social/PostCard.tsx`
- Modify: `frontend/app/globals.css`
- Test: `frontend/app/socialSurface.test.js`

**Interfaces:**
- `extractPostAssetTags(text: string, knownSymbols: ReadonlySet<string>): string[]` returns canonical, unique catalogue symbols.
- `getUnreadBadgeLabel(count: number): string | null` returns `null` for zero and a bounded display label for positive counts.

- [ ] **Step 1: Write failing tests** for asset-tag extraction, demo-row exclusion markers, zero/positive badge labels, caption prompt absence, and light-theme wordmark contrast tokens.
- [ ] **Step 2: Run `node --test app/socialSurface.test.js`** and verify the new assertions fail for the current implementation.
- [ ] **Step 3: Implement the helpers and UI changes.** Keep tags limited to the known market catalogue; remove only the optional-caption copy; render badge state on mobile and desktop navigation using semantic theme tokens; keep post upload/reaction behavior unchanged.
- [ ] **Step 4: Run the focused test and confirm all assertions pass.**
- [ ] **Step 5: Commit** with `feat: polish social surfaces and navigation status`.

### Task 2: Canonical direct chats, deletion, and unread message indicators

**Files:**
- Create: `frontend/lib/directConversation.ts`
- Modify: `frontend/app/api/chat/conversations/route.ts`
- Modify: `frontend/lib/chatThreads.ts`
- Modify: `frontend/components/chat/ChatSidebar.tsx`
- Modify: `frontend/components/chat/ChatWindow.tsx`
- Modify: `frontend/components/chat/MessageInput.tsx`
- Modify: `frontend/components/layout/Sidebar.tsx`
- Test: `frontend/lib/directConversation.test.js`
- Test: `frontend/app/chatSurface.test.js`

**Interfaces:**
- `canonicalDirectPair(firstUserId: string, secondUserId: string): readonly [string, string]` returns sorted IDs and rejects equal/blank IDs.
- `findOrCreateDirectConversation(client, firstUserId: string, secondUserId: string): Promise<Conversation>` reads an existing pair before creating one and scopes all reads to the authenticated user.
- `getConversationUnreadCount(conversations: ReadonlyArray<Conversation>): number` sums only finite non-negative unread counts.

- [ ] **Step 1: Write failing tests** for canonical pair ordering, self-chat rejection, duplicate existing-conversation lookup, unread badge aggregation, and authorized conversation deletion semantics.
- [ ] **Step 2: Run the focused tests** and verify they fail against the current create-first flow or missing helper.
- [ ] **Step 3: Implement canonical lookup and route behavior.** Use the current Supabase user-context/RLS path where supported; preserve groups; return the existing direct conversation on duplicate starts; ensure deletion only hides/removes the authenticated user’s membership or thread view according to the current schema.
- [ ] **Step 4: Fix the mobile chat shell** so the composer sits directly above the safe-area footer and add the unread indicator to the chat navigation entry.
- [ ] **Step 5: Run focused chat tests plus existing chat policy/deletion tests.**
- [ ] **Step 6: Commit** with `fix: canonicalize direct chats and mobile message state`.

### Task 3: Provider-backed chat charts and structured signal sharing

**Files:**
- Create: `frontend/lib/chartIntervals.ts`
- Create: `frontend/lib/shareSignal.ts`
- Modify: `frontend/components/trading/TradingViewChatPanel.tsx`
- Modify: `frontend/app/api/market/prices/[symbol]/history/route.ts`
- Modify: `frontend/components/chat/ChatWindow.tsx`
- Test: `frontend/lib/chartIntervals.test.js`
- Test: `frontend/lib/shareSignal.test.js`

**Interfaces:**
- `SUPPORTED_CHART_INTERVALS` is a readonly list of provider-supported interval descriptors with `id`, `label`, and provider query value.
- `validateShareSignal(input: unknown): ShareSignal` accepts only a known symbol, finite positive entry/TP/SL, supported interval, and `BUY`/`SELL` side.
- `serializeShareSignal(signal: ShareSignal): string` produces a bounded structured chat payload containing symbol, interval, side, levels, provider, and timestamp.

- [ ] **Step 1: Write failing tests** for supported interval mapping, rejected unknown intervals, invalid signal levels, and safe serialized signal output.
- [ ] **Step 2: Run focused tests** and verify they fail before implementation.
- [ ] **Step 3: Implement interval and signal helpers** with no inferred prices or unsupported provider intervals.
- [ ] **Step 4: Update the chart panel** to switch intervals, poll the existing history/quote APIs, render provider timestamps/status, keep horizontal lines and analysis tools client-side, and send serialized signals through the existing chat callback.
- [ ] **Step 5: Run focused tests plus market-history and chart tests.**
- [ ] **Step 6: Commit** with `feat: add provider-backed chat chart intervals and signals`.

### Task 4: Workspace density, provider history, and evidence-based news graph

**Files:**
- Create: `frontend/lib/newsEvidence.ts`
- Modify: `frontend/app/dashboard/page.tsx`
- Modify: `frontend/components/trading/LiveMarketScreener.tsx`
- Modify: `frontend/components/trading/VerifiedAssetDetail.tsx`
- Modify: `frontend/app/discover/page.tsx`
- Modify: `frontend/components/news/NewsCard.tsx`
- Test: `frontend/lib/newsEvidence.test.js`
- Test: `frontend/app/marketWorkspace.test.js`

**Interfaces:**
- `buildNewsEvidence(article: ProviderNewsArticle): NewsEvidence` returns source, publication time, tagged assets, explicit facts, and uncertainty labels only from provider fields.
- `densityClass(density: 'compact' | 'comfortable' | 'spacious'): string` returns the corresponding bounded layout class.

- [ ] **Step 1: Write failing tests** for density mapping, provider-history interval switching, missing-candle state, and evidence graph output that excludes invented sentiment/confidence.
- [ ] **Step 2: Run focused tests** and verify expected failures.
- [ ] **Step 3: Implement density persistence using the existing settings state** and apply classes to the active dashboard panels without changing data queries.
- [ ] **Step 4: Wire verified provider-history intervals** into selected-asset detail and show unavailable states when the provider returns no candles.
- [ ] **Step 5: Render the Discover news evidence graph** from source/timestamp/assets/facts with a readable mobile layout; keep AI explanation text grounded in the same evidence.
- [ ] **Step 6: Run focused market/news tests plus selected-asset tests.**
- [ ] **Step 7: Commit** with `feat: refine market workspace and news evidence`.

### Task 5: Mobile live-session capability and screen-share UX

**Files:**
- Create: `frontend/lib/screenShareCapability.ts`
- Modify: `frontend/components/live/ScreenShare.tsx`
- Modify: `frontend/components/live/SessionRoom.tsx`
- Modify: `frontend/components/live/SessionControls.tsx`
- Test: `frontend/lib/screenShareCapability.test.js`

**Interfaces:**
- `getScreenShareCapability(navigatorLike: NavigatorLike): 'supported' | 'unsupported' | 'restricted'` reports native capability without starting a capture.
- `screenShareUnavailableMessage(capability: ShareCapability): string` returns actionable, non-misleading copy.

- [ ] **Step 1: Write failing tests** for supported desktop/Android-like capability, unavailable mobile capability, and no stream-start side effects when unsupported.
- [ ] **Step 2: Run the focused test** and verify it fails before implementation.
- [ ] **Step 3: Implement capability detection and UI states.** Keep host authorization and private signaling unchanged; use native `getDisplayMedia` only when present; retain whole-display capture and host self-capture suppression.
- [ ] **Step 4: Run focused live-session and broadcast tests.**
- [ ] **Step 5: Commit** with `fix: clarify mobile screen sharing capability`.

### Task 6: Full regression and delivery checks

**Files:**
- Modify: `design-qa.md`
- Modify: `.superpowers/sdd/2026-10-19-social-chat-live-market/progress.md`

- [ ] **Step 1: Run** `npm run lint` from `frontend/`.
- [ ] **Step 2: Run** `npm run typecheck` from `frontend/`.
- [ ] **Step 3: Run** `npm run test` from `frontend/` and confirm zero failures.
- [ ] **Step 4: Run** `npm run build` with Node 22/npm 10; record any environment-only limitation without calling it a source pass.
- [ ] **Step 5: Run** `git diff --check` and inspect the final diff for generated files, secrets, and unintended database changes.
- [ ] **Step 6: Update QA notes** with actual results and visual/manual limitations.
- [ ] **Step 7: Commit** with `test: verify social chat live and market refinements`.
