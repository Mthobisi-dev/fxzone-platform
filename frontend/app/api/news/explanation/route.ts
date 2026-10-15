import { NextResponse } from 'next/server';
import { apiError } from '@/lib/api-error';
import { buildNewsExplanation, type NewsExplanationEvidence } from '@/lib/server/newsExplanation';
import { getUserFromRequest } from '@/lib/server/supabaseServer';

export const dynamic = 'force-dynamic';

function normalizedString(value: unknown, maxLength: number): string {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').slice(0, maxLength) : '';
}

function parseEvidence(value: unknown): NewsExplanationEvidence | null {
  if (!value || typeof value !== 'object') return null;
  const body = value as Record<string, unknown>;
  const title = normalizedString(body.title, 300);
  const source = normalizedString(body.source, 120);
  if (title.length < 5 || source.length < 2) return null;

  const publishedAtValue = normalizedString(body.published_at, 64);
  const publishedAt = publishedAtValue && Number.isFinite(Date.parse(publishedAtValue))
    ? new Date(publishedAtValue).toISOString()
    : null;
  const assetTags = Array.isArray(body.asset_tags)
    ? body.asset_tags
      .filter((tag): tag is string => typeof tag === 'string')
      .map((tag) => normalizedString(tag, 24).toUpperCase())
      .filter(Boolean)
      .slice(0, 12)
    : [];

  return {
    title,
    source,
    content: normalizedString(body.content, 4_000),
    publishedAt,
    assetTags: Array.from(new Set(assetTags)),
  };
}

export async function POST(request: Request) {
  const { user, error: authError } = await getUserFromRequest(request);
  if (!user || authError) {
    return apiError('UNAUTHORIZED', 'Authentication required to explain market news.', 401);
  }

  let evidence: NewsExplanationEvidence | null = null;
  try {
    evidence = parseEvidence(await request.json());
  } catch {
    return apiError('BAD_REQUEST', 'A valid JSON news article is required.', 400);
  }
  if (!evidence) {
    return apiError('UNPROCESSABLE_ENTITY', 'A valid news title and provider are required.', 422);
  }

  try {
    const explanation = await buildNewsExplanation(evidence);
    return NextResponse.json(explanation, {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (error) {
    console.error('News explanation route error:', error);
    return apiError('SERVICE_UNAVAILABLE', 'News explanation is temporarily unavailable.', 503);
  }
}

