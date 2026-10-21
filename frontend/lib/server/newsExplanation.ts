export interface NewsAiRequest {
  system: string;
  prompt: string;
}

export type NewsAiGenerator = (request: NewsAiRequest) => Promise<string | null>;

export interface NewsExplanationEvidence {
  title: string;
  content: string;
  source: string;
  publishedAt: string | null;
  assetTags: string[];
}

export type NewsMarketImpact = {
  stance: 'positive' | 'negative' | 'mixed' | 'unclear';
  horizon: 'near_term' | 'medium_term' | 'long_term' | 'unclear';
  affectedAssets: string[];
  rationale: string;
  traderFocus: string;
  investorFocus: string;
};

export interface NewsExplanation {
  source: 'ai_gateway' | 'verified_data';
  isAiGenerated: boolean;
  explanation: string;
  evidence: {
    provider: string;
    publishedAt: string | null;
    assetTags: string[];
  };
  marketImpact: NewsMarketImpact;
  limitation: string;
}

const NEWS_SYSTEM_PROMPT = [
  'Explain only the supplied provider headline and provider article summary.',
  'Do not add facts, causes, forecasts, prices, statistics, people, companies, or events that are absent from the supplied evidence.',
  'Return JSON only with keys explanation and marketImpact.',
  'marketImpact must contain stance (positive, negative, mixed, or unclear), horizon (near_term, medium_term, long_term, or unclear), affectedAssets (only supplied related instruments), rationale, traderFocus, and investorFocus.',
  'The impact fields must describe what the supplied report may affect and what a reader should verify; they must not give personalised investment advice, buy or sell instructions, entry or exit levels, targets, stops, probabilities, or guarantees.',
  'Use unclear when the article does not provide enough evidence. Keep every string concise and explicitly state that the provider source should be reviewed.',
].join(' ');

const UNSAFE_NEWS_COPY = /\b(?:buy|sell|long|short|enter|entry|target|stop(?:-loss)?|guarantee|confidence|probability|recommend(?:ation)?|should invest|must invest)\b/i;

function compact(value: string, limit: number): string {
  const normalized = value.trim().replace(/\s+/g, ' ');
  if (normalized.length <= limit) return normalized;
  return `${normalized.slice(0, Math.max(0, limit - 1)).trimEnd()}…`;
}

function fallbackExplanation(evidence: NewsExplanationEvidence): string {
  if (!evidence.content.trim()) {
    return `The provider headline reports “${compact(evidence.title, 220)}”. The article body is not available in FxZone, so open the original source before drawing conclusions.`;
  }

  return `${compact(evidence.content, 420)} This is provider-supplied context; open the original source for the complete report.`;
}

function classifyImpact(evidence: NewsExplanationEvidence): NewsMarketImpact {
  const text = `${evidence.title} ${evidence.content}`.toLowerCase();
  const positiveTerms = ['growth', 'increase', 'inflow', 'record', 'strong', 'beat', 'expansion', 'approval', 'surge', 'raises'];
  const negativeTerms = ['decline', 'decrease', 'outflow', 'loss', 'weak', 'cut', 'downgrade', 'warning', 'risk', 'lawsuit', 'falls'];
  const positive = positiveTerms.some((term) => text.includes(term));
  const negative = negativeTerms.some((term) => text.includes(term));
  const stance = positive && negative ? 'mixed' : positive ? 'positive' : negative ? 'negative' : 'unclear';
  const horizon = /today|intraday|immediate|this week|next few days/.test(text)
    ? 'near_term'
    : /quarter|earnings|guidance|month|months/.test(text)
      ? 'medium_term'
      : /long[- ]term|structural|multi[- ]year|years/.test(text)
        ? 'long_term'
        : 'unclear';

  return {
    stance,
    horizon,
    affectedAssets: evidence.assetTags.slice(0, 12),
    rationale: stance === 'unclear'
      ? 'The supplied provider text does not establish a directional market impact.'
      : `The supplied provider text contains language consistent with a ${stance} market impact; this is an evidence classification, not a price forecast.`,
    traderFocus: 'Verify the latest provider quote, volatility, volume, and the full source before making any trading decision.',
    investorFocus: 'Review the full source, fundamentals, and your own time horizon; this context is not personalised investment advice.',
  };
}

function safeGeneratedCopy(value: unknown, minimum = 20, maximum = 700): value is string {
  if (typeof value !== 'string') return false;
  const text = value.trim();
  return text.length >= minimum && text.length <= maximum && !UNSAFE_NEWS_COPY.test(text);
}

function parseGeneratedResponse(value: string | null, evidence: NewsExplanationEvidence): { explanation: string; marketImpact: NewsMarketImpact } | null {
  if (!value) return null;

  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    const impact = parsed.marketImpact;
    if (!impact || typeof impact !== 'object' || !safeGeneratedCopy(parsed.explanation)) return null;
    const impactRecord = impact as Record<string, unknown>;
    const stance = ['positive', 'negative', 'mixed', 'unclear'].includes(String(impactRecord.stance))
      ? String(impactRecord.stance) as NewsMarketImpact['stance']
      : null;
    const horizon = ['near_term', 'medium_term', 'long_term', 'unclear'].includes(String(impactRecord.horizon))
      ? String(impactRecord.horizon) as NewsMarketImpact['horizon']
      : null;
    const affectedAssets = Array.isArray(impactRecord.affectedAssets)
      ? impactRecord.affectedAssets.map((asset) => String(asset).toUpperCase().trim()).filter((asset) => evidence.assetTags.includes(asset)).slice(0, 12)
      : [];
    if (!stance || !horizon || !safeGeneratedCopy(impactRecord.rationale) || !safeGeneratedCopy(impactRecord.traderFocus) || !safeGeneratedCopy(impactRecord.investorFocus)) return null;
    return {
      explanation: String(parsed.explanation).trim(),
      marketImpact: {
        stance,
        horizon,
        affectedAssets,
        rationale: String(impactRecord.rationale).trim(),
        traderFocus: String(impactRecord.traderFocus).trim(),
        investorFocus: String(impactRecord.investorFocus).trim(),
      },
    };
  } catch {
    return safeGeneratedCopy(value) ? { explanation: value.trim(), marketImpact: classifyImpact(evidence) } : null;
  }
}

function completionText(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null;
  const choices = (value as { choices?: unknown }).choices;
  if (!Array.isArray(choices)) return null;
  const content = (choices[0] as { message?: { content?: unknown } } | undefined)?.message?.content;
  return typeof content === 'string' ? content.trim() : null;
}

async function generateNewsGatewayExplanation(request: NewsAiRequest): Promise<string | null> {
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
        max_tokens: 160,
      }),
      cache: 'no-store',
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) {
      console.warn('News AI explanation unavailable:', response.status);
      return null;
    }
    return completionText(await response.json());
  } catch (error) {
    console.warn('News AI explanation request failed:', error instanceof Error ? error.message : 'unknown error');
    return null;
  }
}

/**
 * Builds a source-labelled explanation without allowing a model to fill gaps.
 * Headline-only provider results use an explicit deterministic fallback.
 */
export async function buildNewsExplanation(
  evidence: NewsExplanationEvidence,
  generate: NewsAiGenerator = generateNewsGatewayExplanation,
): Promise<NewsExplanation> {
  const fallback: NewsExplanation = {
    source: 'verified_data',
    isAiGenerated: false,
    explanation: fallbackExplanation(evidence),
    evidence: {
      provider: evidence.source,
      publishedAt: evidence.publishedAt,
      assetTags: evidence.assetTags,
    },
    marketImpact: classifyImpact(evidence),
    limitation: evidence.content.trim()
      ? 'The explanation is limited to the provider summary supplied to FxZone.'
      : 'Only the provider headline is available; no article body was supplied for AI explanation.',
  };

  if (evidence.content.trim().length < 40) return fallback;

  const generated = await generate({
    system: NEWS_SYSTEM_PROMPT,
    prompt: [
      `Provider: ${evidence.source}`,
      `Headline: ${evidence.title}`,
      `Provider summary: ${evidence.content}`,
      `Published at: ${evidence.publishedAt ?? 'not supplied'}`,
      `Related instruments: ${evidence.assetTags.join(', ') || 'not supplied'}`,
      'Return valid JSON only. Do not use markdown fences.',
    ].join('\n'),
  });

  const parsed = parseGeneratedResponse(generated, evidence);
  if (!parsed) return fallback;

  return {
    ...fallback,
    source: 'ai_gateway',
    isAiGenerated: true,
    explanation: parsed.explanation,
    marketImpact: parsed.marketImpact,
  };
}

