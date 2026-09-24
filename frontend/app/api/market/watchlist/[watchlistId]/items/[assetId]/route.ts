import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin, getUserFromRequest } from '@/lib/supabase';
import { SUPPORTED_ASSETS } from '@/lib/server/marketService';

// DELETE /api/market/watchlist/[watchlistId]/items/[assetId]
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ watchlistId: string; assetId: string }> }
) {
  try {
    const { user, error: authError } = await getUserFromRequest(request);
    if (authError || !user) return NextResponse.json({ detail: authError || 'Not authenticated' }, { status: 401 });
    const db = getSupabaseAdmin(request);

    const { assetId, watchlistId } = await context.params;
    const { data: watchlist } = await db.from('watchlists').select('id').eq('id', watchlistId).eq('user_id', user.id).maybeSingle();
    if (!watchlist) return NextResponse.json({ detail: 'Watchlist not found.' }, { status: 404 });

    const local = SUPPORTED_ASSETS.find(
      a => a.id === assetId || a.symbol.toUpperCase() === assetId.toUpperCase()
    );

    let dbAssetId: string | null = null;

    if (local) {
      const { data } = await db
        .from('assets')
        .select('id')
        .eq('symbol', local.symbol)
        .single();
      dbAssetId = data?.id || null;
    }

    if (!dbAssetId) {
      const { data } = await db
        .from('assets')
        .select('id')
        .or(`id.eq.${assetId},symbol.eq.${assetId.toUpperCase()}`)
        .single();
      dbAssetId = data?.id || null;
    }

    if (dbAssetId) {
      const { error } = await db
        .from('watchlist_items')
        .delete()
        .eq('watchlist_id', watchlistId)
        .eq('asset_id', dbAssetId);
      if (error) throw error;
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Remove watchlist item error:', error);
    return NextResponse.json({ detail: error?.message || 'Unable to remove the watchlist item.' }, { status: 500 });
  }
}
