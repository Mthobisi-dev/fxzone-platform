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

export interface NewsExplanation {
  source: 'ai_gateway' | 'verified_data';
  isAiGenerated: boolean;
  explanation: string;
  evidence: {
    provider: string;
    publishedAt: string | null;
    assetTags: string[];
  };
  limitation: string;
}

const NEWS_SYSTEM_PROMPT = [
  'Explain only the supplied provider headline and provider article summary.',
  'Do not add facts, causes, forecasts, sentiment, prices, statistics, people, companies, or events that are absent from the supplied evidence.',
  'Do not give investment advice or trading instructions.',
  'Write two concise plain-language sentences: what the provider reports and why a reader may want to open the original source for context.',
].join(' ');

const UNSAFE_NEWS_COPY = /\b(?:buy|sell|long|short|enter|entry|target|stop(?:-loss)?|guarantee|confidence|recommend(?:ation)?|should invest|must invest)\b/i;

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

function safeGeneratedCopy(value: string | null): value is string {
  if (!value) return false;
  const text = value.trim();
  return text.length >= 40 && text.length <= 700 && !UNSAFE_NEWS_COPY.test(text);
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
    ].join('\n'),
  });

  if (!safeGeneratedCopy(generated)) return fallback;

  return {
    ...fallback,
    source: 'ai_gateway',
    isAiGenerated: true,
    explanation: generated.trim(),
  };
}

