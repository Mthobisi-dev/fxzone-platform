import { createHmac } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { apiError } from '@/lib/api-error';
import { getSupabaseAdmin, getUserFromRequest } from '@/lib/supabase';
import turnCredentials from '@/lib/server/turnCredentials';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const { parseTurnUrls, credentialTtlSeconds } = turnCredentials;

/**
 * Issues short-lived TURN REST credentials for an authenticated participant.
 * Configure a coturn-compatible TURN_SHARED_SECRET; it is never exposed to
 * the browser or compiled into the client bundle.
 */
export async function GET(request: NextRequest) {
  const { user, error: authError } = await getUserFromRequest(request);
  if (authError || !user) {
    return apiError('UNAUTHORIZED', authError || 'Authentication required', 401);
  }

  const sessionId = request.nextUrl.searchParams.get('sessionId')?.trim();
  if (!sessionId || sessionId.length > 64) {
    return apiError('UNPROCESSABLE_ENTITY', 'A valid sessionId is required.', 422);
  }

  const urls = parseTurnUrls(process.env.TURN_URL);
  const sharedSecret = process.env.TURN_SHARED_SECRET?.trim();
  if (!urls || !sharedSecret) {
    return apiError('SERVICE_UNAVAILABLE', 'TURN relay is not configured.', 503);
  }

  try {
    const db = getSupabaseAdmin(request);
    const { data: participant, error } = await db
      .from('session_participants')
      .select('id')
      .eq('session_id', sessionId)
      .eq('user_id', user.id)
      .is('left_at', null)
      .maybeSingle();

    if (error) throw error;
    if (!participant) {
      return apiError('FORBIDDEN', 'Join the live session before requesting relay credentials.', 403);
    }

    const ttl = credentialTtlSeconds(process.env.TURN_TTL_SECONDS);
    const expiresAt = Math.floor(Date.now() / 1_000) + ttl;
    const username = `${expiresAt}:${user.id}`;
    const credential = createHmac('sha1', sharedSecret).update(username).digest('base64');

    return NextResponse.json(
      { urls, username, credential, ttl },
      { headers: { 'Cache-Control': 'no-store, max-age=0' } }
    );
  } catch (error: unknown) {
    console.error('TURN credential request failed', error);
    return apiError('INTERNAL_SERVER_ERROR', 'Unable to issue relay credentials.', 500);
  }
}
