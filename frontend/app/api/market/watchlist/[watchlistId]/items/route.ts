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
  const local = SUPPORTED_ASSETS.find(
    a => a.id === symbolOrId || a.symbol.toUpperCase() === symbolOrId.toUpperCase()
  );
  if (local) {
    const { data } = await supabaseAdmin
      .from('assets')
      .select('id')
      .eq('symbol', local.symbol)
      .single();
    if (data) return data.id;
  }
  const { data } = await supabaseAdmin
    .from('assets')
    .select('id')
    .or(`id.eq.${symbolOrId},symbol.eq.${symbolOrId.toUpperCase()}`)
    .single();
  return data?.id || null;
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

    let dbAssetId = await resolveAssetId(symbolOrId);

    if (!dbAssetId) {
      const local = SUPPORTED_ASSETS.find(
        a => a.symbol.toUpperCase() === symbolOrId.toUpperCase()
      );
      if (local) {
        const { data: upserted } = await supabaseAdmin
          .from('assets')
          .upsert({
            symbol: local.symbol,
            name: local.name,
            asset_type: local.asset_type,
            description: local.description,
            is_active: true,
          }, { onConflict: 'symbol' })
          .select('id')
          .single();
        dbAssetId = upserted?.id || null;
      }
    }

    if (!dbAssetId) {
      return NextResponse.json({ detail: 'Asset not found' }, { status: 404 });
    }

    const { error } = await supabaseAdmin
      .from('watchlist_items')
      .insert({ watchlist_id: watchlistId, asset_id: dbAssetId });

    if (error && error.code !== '23505') throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Add watchlist item error:', error);
    return NextResponse.json(
      { error: 'Failed to add item', detail: error?.message },
      { status: 500 }
    );
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
