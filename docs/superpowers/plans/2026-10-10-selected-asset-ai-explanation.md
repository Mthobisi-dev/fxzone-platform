# Selected Instrument AI Explanation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the selected market instrument a concise AI-generated explanation that is anchored to verified quote and historical-candle data.

**Architecture:** A server-only route will assemble the current provider quote and deterministic technical analysis before optionally sending only those facts to Vercel AI Gateway. When Gateway is unavailable or unconfigured, the route returns the existing verified-data summary with an explicit source label. The dashboard component will reload the explanation when selection changes and expose refresh, loading, and unavailable states.

**Tech Stack:** Next.js App Router, TypeScript, Vercel AI Gateway compatible API, existing market-service and technical-analysis modules, Node test runner.

**Spec:** Conversation request on 2026-10-10: “the Selected instrument must also use AI for better explanation of selected asset and other relevant information”.

## Global Constraints

- Use only verified quote fields and deterministic indicators as model context.
- No fabricated confidence, target, order-flow, on-chain, or investment-advice claims.
- Keep AI Gateway credentials server-only and do not add secrets to source.
- Require `AI_GATEWAY_MODEL` to be an explicitly configured model ID; do not invent a model choice.
- Preserve a useful verified-data fallback when the AI service is unavailable.

## Review Focus

- Unknown symbols return a safe not-found response rather than calling a provider.
- Missing quotes produce an unavailable response without a made-up narrative.
- Missing historical candles withhold all technical claims.
- Missing Gateway configuration produces a clearly labelled verified-data fallback.
- A changed selection cannot display a stale explanation for the prior asset.

---

### Task 1: Evidence-backed explanation service

**Files:**
- Create: `frontend/lib/server/selectedAssetExplanation.ts`
- Test: `frontend/lib/server/selectedAssetExplanation.test.js`

**Interfaces:**
- Consumes: a structurally typed verified market insight built by the route from `buildMarketInsight`, `fetchLivePrices`, `fetchHistoricalCandles`, and `calculateTechnicalAnalysis`.
- Produces: `buildSelectedAssetExplanation(insight, dependencies)` returning an explanation, source label, insight, and availability status.

- [x] **Step 1: Write the failing service tests**

Assert that a verified quote and technical analysis produce a fact-only prompt, while an absent quote produces no fabricated explanation.

- [x] **Step 2: Run the focused test to verify it fails**

Run: `node --test lib/server/selectedAssetExplanation.test.js`
Expected: FAIL because the service does not exist.

- [x] **Step 3: Implement `buildSelectedAssetExplanation`**

Build the evidence summary through the existing market-insight module, optionally call AI Gateway only when server credentials and an explicit model are configured, and otherwise return labelled verified data.

- [x] **Step 4: Run the focused test to verify it passes**

Run: `node --test lib/server/selectedAssetExplanation.test.js`
Expected: PASS.

### Task 2: Selected-instrument API route

**Files:**
- Create: `frontend/app/api/market/explanation/[symbol]/route.ts`
- Test: `frontend/app/api/market/selectedAssetExplanationRoute.test.js`

**Interfaces:**
- Consumes: `buildSelectedAssetExplanation(symbol)`.
- Produces: a no-store JSON response with a stable explanation source and data-quality state.

- [x] **Step 1: Write the failing route tests**

Assert unknown symbols are rejected and a missing quote does not masquerade as an AI result.

- [x] **Step 2: Run tests to verify failure**

Run: `node --test app/api/market/explanation/[symbol]/route.test.js`
Expected: FAIL because the route does not exist.

- [x] **Step 3: Implement the route**

Validate the symbol against `SUPPORTED_ASSETS`, return safe API errors, and ensure the explanation response cannot be cached as a current quote.

- [x] **Step 4: Run tests to verify pass**

Run: `node --test app/api/market/explanation/[symbol]/route.test.js`
Expected: PASS.

### Task 3: Selected-instrument explanation panel

**Files:**
- Modify: `frontend/components/trading/VerifiedAssetDetail.tsx`
- Modify: `frontend/package.json`
- Test: `frontend/components/trading/VerifiedAssetDetail.test.js`

**Interfaces:**
- Consumes: `/api/market/explanation/:symbol` response.
- Produces: an accessible responsive explanation panel with loading, refresh, AI-generated, verified-data, and unavailable states.

- [x] **Step 1: Write the failing component-contract test**

Assert the component requests the selected asset’s explanation and exposes the returned source label rather than calling a legacy simulated-sentiment route.

- [x] **Step 2: Run the focused test to verify failure**

Run: `node --test components/trading/VerifiedAssetDetail.test.js`
Expected: FAIL because the selected-instrument AI panel does not exist.

- [x] **Step 3: Implement the responsive panel**

Use an abortable effect keyed by the selected asset, provide a refresh control, and distinguish AI output from deterministic verified data in visible copy.

- [x] **Step 4: Run component test to verify pass**

Run: `node --test components/trading/VerifiedAssetDetail.test.js`
Expected: PASS.

### Task 4: Verification and deployment documentation

**Files:**
- Modify: `frontend/.env.example` or existing environment documentation if present.
- Modify: `frontend/package.json`

- [x] **Step 1: Document the optional server-only variables**

Document `AI_GATEWAY_API_KEY` or Vercel OIDC and the required `AI_GATEWAY_MODEL`, without values.

- [x] **Step 2: Run quality gates**

Run: `npm run lint`, `npm run typecheck`, `npm run test`, and `npm run build` from `frontend/`.
Expected: all pass.

- [ ] **Step 3: Commit and deploy**

Commit only feature files and push `main`; confirm Vercel serves the new selected-instrument explanation endpoint.
