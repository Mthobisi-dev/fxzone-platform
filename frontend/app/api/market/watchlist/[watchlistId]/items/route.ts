import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { SUPPORTED_ASSETS } from '@/lib/server/marketService';



async function getUser(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return null;
  try {
    const { data: { user } } = await supabaseAdmin.auth.getUser(token);
    return user;
  } catch { return null; }
}

async function resolveAssetId(symbolOrId: string): Promise<string | null> {
  if (!symbolOrId) return null;
  const cleanSymbol = symbolOrId.replace(/^asset-/, '').toUpperCase();

  const local = SUPPORTED_ASSETS.find(
    a => a.id === symbolOrId || a.symbol.toUpperCase() === cleanSymbol
  );
  const targetSymbol = local ? local.symbol : cleanSymbol;

  // Query assets table in Supabase
  const { data } = await supabaseAdmin
    .from('assets')
    .select('id')
    .or(`id.eq.${symbolOrId},symbol.eq.${targetSymbol}`)
    .maybeSingle();

  if (data?.id) return data.id;

  // Auto-upsert into assets table so DB row always exists
  try {
    const { data: upserted } = await supabaseAdmin
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
    const user = await getUser(request);
    const body = await request.json();
    const { asset_id, symbol } = body;
    const { watchlistId } = await context.params;

    const symbolOrId = asset_id || symbol;
    if (!symbolOrId) {
      return NextResponse.json({ detail: 'asset_id or symbol required' }, { status: 400 });
    }

    if (!user) {
      return NextResponse.json({ success: true });
    }

    const dbAssetId = await resolveAssetId(symbolOrId);

    if (dbAssetId && watchlistId && !watchlistId.startsWith('watchlist-default')) {
      try {
        await supabaseAdmin
          .from('watchlist_items')
          .insert({ watchlist_id: watchlistId, asset_id: dbAssetId });
      } catch (_) {}
    }

    return NextResponse.json({ success: true, asset_id: dbAssetId || symbolOrId });
  } catch (error: any) {
    console.error('Add watchlist item error:', error);
    return NextResponse.json({ success: true, detail: error?.message });
  }
}

// DELETE /api/market/watchlist/[watchlistId]/items — bulk remove
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ watchlistId: string }> }
) {
  try {
    const user = await getUser(request);
    if (!user) return NextResponse.json({ success: true });

    const { watchlistId } = await context.params;
    const body = await request.json().catch(() => ({}));
    const { asset_id } = body;

    if (asset_id) {
      const dbAssetId = await resolveAssetId(asset_id);
      if (dbAssetId) {
        await supabaseAdmin
          .from('watchlist_items')
          .delete()
          .eq('watchlist_id', watchlistId)
          .eq('asset_id', dbAssetId);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: true });
  }
}
