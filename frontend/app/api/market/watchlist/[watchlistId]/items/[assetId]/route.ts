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

// DELETE /api/market/watchlist/[watchlistId]/items/[assetId]
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ watchlistId: string; assetId: string }> }
) {
  try {
    const user = await getUser(request);
    if (!user) return NextResponse.json({ success: true });

    const { assetId, watchlistId } = await context.params;

    const local = SUPPORTED_ASSETS.find(
      a => a.id === assetId || a.symbol.toUpperCase() === assetId.toUpperCase()
    );

    let dbAssetId: string | null = null;

    if (local) {
      const { data } = await supabaseAdmin
        .from('assets')
        .select('id')
        .eq('symbol', local.symbol)
        .single();
      dbAssetId = data?.id || null;
    }

    if (!dbAssetId) {
      const { data } = await supabaseAdmin
        .from('assets')
        .select('id')
        .or(`id.eq.${assetId},symbol.eq.${assetId.toUpperCase()}`)
        .single();
      dbAssetId = data?.id || null;
    }

    if (dbAssetId) {
      await supabaseAdmin
        .from('watchlist_items')
        .delete()
        .eq('watchlist_id', watchlistId)
        .eq('asset_id', dbAssetId);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Remove watchlist item error:', error);
    return NextResponse.json({ success: true });
  }
}
