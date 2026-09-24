import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin, getUserFromRequest } from '@/lib/supabase';
import { SUPPORTED_ASSETS } from '@/lib/server/marketService';

async function resolveAssetId(db: ReturnType<typeof getSupabaseAdmin>, symbolOrId: string): Promise<string | null> {
  if (!symbolOrId) return null;
  const cleanSymbol = symbolOrId.replace(/^asset-/, '').toUpperCase();

  const local = SUPPORTED_ASSETS.find(
    a => a.id === symbolOrId || a.symbol.toUpperCase() === cleanSymbol
  );
  const targetSymbol = local ? local.symbol : cleanSymbol;

  // Query assets table in Supabase
  const { data } = await db
    .from('assets')
    .select('id')
    .or(`id.eq.${symbolOrId},symbol.eq.${targetSymbol}`)
    .maybeSingle();

  if (data?.id) return data.id;

  // Auto-upsert into assets table so DB row always exists
  try {
    const { data: upserted } = await db
      .from('assets')
      .upsert(
        {
          symbol: targetSymbol,
          name: local?.name || targetSymbol,
          asset_type: local?.asset_type || 'stock',
          description: local?.description || `${targetSymbol} Market Asset`,
          is_active: true,
        },
        { onConflict: 'symbol' }
      )
      .select('id')
      .maybeSingle();
    return upserted?.id || null;
  } catch (err) {
    console.warn('[resolveAssetId] Auto-upsert asset warning:', err);
    return null;
  }
}

// POST /api/market/watchlist/[watchlistId]/items — add asset to watchlist
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ watchlistId: string }> }
) {
  try {
    const { user, error: authError } = await getUserFromRequest(request);
    if (authError || !user) return NextResponse.json({ detail: authError || 'Not authenticated' }, { status: 401 });
    const db = getSupabaseAdmin(request);
    const body = await request.json();
    const { asset_id, symbol } = body;
    const { watchlistId } = await context.params;

    const symbolOrId = asset_id || symbol;
    if (!symbolOrId) {
      return NextResponse.json({ detail: 'asset_id or symbol required' }, { status: 400 });
    }

    const { data: watchlist } = await db.from('watchlists').select('id').eq('id', watchlistId).eq('user_id', user.id).maybeSingle();
    if (!watchlist) return NextResponse.json({ detail: 'Watchlist not found.' }, { status: 404 });

    const dbAssetId = await resolveAssetId(db, symbolOrId);
    if (!dbAssetId) return NextResponse.json({ detail: 'Asset could not be resolved.' }, { status: 400 });
    const { error } = await db.from('watchlist_items').insert({ watchlist_id: watchlistId, asset_id: dbAssetId });
    if (error && error.code !== '23505') throw error;

    return NextResponse.json({ success: true, asset_id: dbAssetId || symbolOrId });
  } catch (error: any) {
    console.error('Add watchlist item error:', error);
    return NextResponse.json({ detail: error?.message || 'Unable to add the watchlist item.' }, { status: 500 });
  }
}

// DELETE /api/market/watchlist/[watchlistId]/items — bulk remove
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ watchlistId: string }> }
) {
  try {
    const { user, error: authError } = await getUserFromRequest(request);
    if (authError || !user) return NextResponse.json({ detail: authError || 'Not authenticated' }, { status: 401 });
    const db = getSupabaseAdmin(request);

    const { watchlistId } = await context.params;
    const body = await request.json().catch(() => ({}));
    const { asset_id } = body;

    const { data: watchlist } = await db.from('watchlists').select('id').eq('id', watchlistId).eq('user_id', user.id).maybeSingle();
    if (!watchlist) return NextResponse.json({ detail: 'Watchlist not found.' }, { status: 404 });

    if (asset_id) {
      const dbAssetId = await resolveAssetId(db, asset_id);
      if (dbAssetId) {
        const { error } = await db
          .from('watchlist_items')
          .delete()
          .eq('watchlist_id', watchlistId)
          .eq('asset_id', dbAssetId);
        if (error) throw error;
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Remove watchlist item error:', error);
    return NextResponse.json({ detail: error?.message || 'Unable to remove the watchlist item.' }, { status: 500 });
  }
}
