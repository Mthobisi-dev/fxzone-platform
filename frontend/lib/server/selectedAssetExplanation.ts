export type ExplanationSource = 'ai_gateway' | 'verified_data';

export interface SelectedAssetInsight {
  symbol: string;
  name: string;
  status: 'available' | 'insufficient_data' | 'unavailable';
  direction: 'up' | 'down' | 'flat' | 'unavailable';
  price: number | null;
  changePct: number | null;
  timestamp: string | null;
  dataSource: string | null;
  freshness: string | null;
  summary: string;
  highlights: string[];
}

export interface AiExplanationRequest {
  system: string;
  prompt: string;
}

export type AiExplanationGenerator = (request: AiExplanationRequest) => Promise<string | null>;

export interface SelectedAssetResearchItem {
  label: string;
  value: string;
}

export interface SelectedAssetResearchSection {
  id: 'market_snapshot' | 'technical_context' | 'data_quality';
  title: string;
  items: SelectedAssetResearchItem[];
}

export interface SelectedAssetExplanation {
  source: ExplanationSource;
  isAiGenerated: boolean;
  explanation: string;
  evidence: string[];
  insight: SelectedAssetInsight;
  research: SelectedAssetResearchSection[];
}

const AI_SYSTEM_PROMPT = [
  'Explain only the supplied verified market facts for a research interface.',
  'Write no numbers, prices, percentages, targets, confidence scores, trade instructions, or investment recommendations.',
  'Do not add causes, news, on-chain, order-flow, macro, or sentiment claims that are not in the supplied facts.',
  'Use one or two plain-language sentences and state that the information is research context, not an action recommendation.',
].join(' ');

const UNSAFE_AI_COPY = /\d|\b(?:buy|sell|long|short|trade|target|stop(?:-loss)?|confidence|recommend(?:ation)?|should|must|guarantee|order block|fair value gap|mvrv|etf)\b/i;

function verifiedFallback(insight: SelectedAssetInsight): string {
  if (insight.status === 'unavailable') {
    return 'A verified quote is unavailable for this instrument, so an AI explanation is not generated.';
  }

  if (insight.status === 'insufficient_data') {
    return 'This briefing uses the latest verified quote. Historical indicators are unavailable, so it makes no technical interpretation.';
  }

  return 'This verified-data briefing combines the latest provider quote with the deterministic historical indicators shown above. It is research context and does not recommend an action.';
}

function directionLabel(direction: SelectedAssetInsight['direction']): string {
  if (direction === 'up') return 'Up today';
  if (direction === 'down') return 'Down today';
  if (direction === 'flat') return 'Unchanged today';
  return 'Unavailable';
}

function formatChange(changePct: number | null): string {
  if (changePct === null || !Number.isFinite(changePct)) return 'Not supplied';
  return `${changePct > 0 ? '+' : ''}${changePct.toFixed(2)}%`;
}

/**
 * Turns the verified insight into inspectable sections. These values are
 * deterministic provider facts or calculated indicators; model wording never
 * creates a new metric or a trading recommendation.
 */
export function buildSelectedAssetResearch(insight: SelectedAssetInsight): SelectedAssetResearchSection[] {
  const sections: SelectedAssetResearchSection[] = [{
    id: 'market_snapshot',
    title: 'Market snapshot',
    items: [
      { label: 'Daily move', value: formatChange(insight.changePct) },
      { label: 'Session state', value: directionLabel(insight.direction) },
      { label: 'Verified status', value: insight.status === 'unavailable' ? 'Quote unavailable' : 'Quote available' },
    ],
  }];

  if (insight.status === 'available' && insight.highlights.length > 0) {
    sections.push({
      id: 'technical_context',
      title: 'Technical context',
      items: insight.highlights.map((highlight, index) => ({
        label: index === 0 ? 'Calculated indicator' : 'Calculated context',
        value: highlight,
      })),
    });
  }

  sections.push({
    id: 'data_quality',
    title: 'Data quality',
    items: [
      { label: 'Provider', value: insight.dataSource ?? 'Not supplied' },
      { label: 'Freshness', value: insight.freshness ?? 'Unavailable' },
      { label: 'Provider time', value: insight.timestamp ?? 'Time unavailable' },
    ],
  });
  return sections;
}

function isSafeAiCopy(value: string): boolean {
  const text = value.trim();
  return text.length >= 24 && text.length <= 420 && !UNSAFE_AI_COPY.test(text);
}

function extractCompletionText(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null;
  const choices = (value as { choices?: unknown }).choices;
  if (!Array.isArray(choices)) return null;
  const content = (choices[0] as { message?: { content?: unknown } } | undefined)?.message?.content;
  return typeof content === 'string' ? content.trim() : null;
}

/**
 * Generates a qualitative explanation through Vercel AI Gateway when the
 * deployment has both an authentication token and an explicitly selected
 * model. It intentionally returns null on every gateway failure so callers
 * can show the verified-data fallback without exposing provider errors.
 */
export async function generateGatewayExplanation(request: AiExplanationRequest): Promise<string | null> {
  const token = process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN;
  const model = process.env.AI_GATEWAY_MODEL;
  if (!token || !model) return null;

  try {
    const response = await fetch('https://ai-gateway.vercel.sh/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: request.system },
          { role: 'user', content: request.prompt },
        ],
        temperature: 0.1,
        max_tokens: 120,
      }),
      cache: 'no-store',
      signal: AbortSignal.timeout(8_000),
    });

    if (!response.ok) {
      console.warn('Selected-asset AI explanation unavailable:', response.status);
      return null;
    }

    return extractCompletionText(await response.json());
  } catch (error) {
    console.warn('Selected-asset AI explanation request failed:', error instanceof Error ? error.message : 'unknown error');
    return null;
  }
}

/**
 * Builds a selected-instrument explanation from real provider data. A model
 * can rephrase the verified evidence, but invalid or unavailable model output
 * is always replaced by an explicit verified-data briefing.
 */
export async function buildSelectedAssetExplanation(
  insight: SelectedAssetInsight,
  generate: AiExplanationGenerator = generateGatewayExplanation,
): Promise<SelectedAssetExplanation> {
  const fallback: SelectedAssetExplanation = {
    source: 'verified_data',
    isAiGenerated: false,
    explanation: verifiedFallback(insight),
    evidence: insight.highlights,
    insight,
    research: buildSelectedAssetResearch(insight),
  };

  if (insight.status !== 'available') return fallback;

  const generated = await generate({
    system: AI_SYSTEM_PROMPT,
    prompt: [
      `Instrument: ${insight.symbol} (${insight.name}).`,
      `Verified quote summary: ${insight.summary}`,
      `Deterministic indicators: ${insight.highlights.join(' ')}`,
      'Write the requested qualitative research explanation now.',
    ].join('\n'),
  });

  if (!generated || !isSafeAiCopy(generated)) return fallback;

  return {
    ...fallback,
    source: 'ai_gateway',
    isAiGenerated: true,
    explanation: generated.trim(),
  };
}
