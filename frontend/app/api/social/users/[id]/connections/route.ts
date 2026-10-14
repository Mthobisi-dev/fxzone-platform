import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin, getUserFromRequest } from '@/lib/server/supabaseServer';
import { apiError } from '@/lib/api-error';
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { user } = await getUserFromRequest(request);
    if (!user) return apiError('UNAUTHORIZED', 'Sign in to view connections.', 401);
    const { id } = await context.params;
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return apiError('BAD_REQUEST', 'Invalid profile ID.', 400);
    const params = new URL(request.url).searchParams;
    const kind = params.get('kind');
    if (kind !== 'followers' && kind !== 'following') return apiError('BAD_REQUEST', 'Invalid list type.', 400);
    const offset = Number(params.get('offset') || 0);
    if (!Number.isSafeInteger(offset) || offset < 0 || offset > 100000) return apiError('BAD_REQUEST', 'Invalid offset.', 400);
    const db = getSupabaseAdmin(request);
    const target = kind === 'followers' ? 'follower_id' : 'following_id';
    const { data, error } = await db.from('follows').select(`id,${target}`).eq(kind === 'followers' ? 'following_id' : 'follower_id', id).order('id').range(offset, offset + 50);
    if (error) throw error;
    const rows = data || [];
    const ids = rows.slice(0,50).map((row: any) => row[target]);
    if (!ids.length) return NextResponse.json({ users: [], has_more: false });
    const profiles = await db.from('users').select('id,username,display_name,avatar_url').in('id',ids);
    if (profiles.error) throw profiles.error;
    return NextResponse.json({users: ids.map(id => profiles.data?.find(person => person.id === id)).filter(Boolean),has_more:rows.length > 50}, {headers:{'Cache-Control':'no-store'}});
  } catch (error) { console.error('Profile connections:', error); return apiError('INTERNAL_SERVER_ERROR','Unable to load connections.',500); }
}
