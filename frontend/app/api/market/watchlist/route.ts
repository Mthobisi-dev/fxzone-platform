import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin, getUserFromRequest } from '@/lib/supabase';
import { SUPPORTED_ASSETS } from '@/lib/server/marketService';

// GET /api/market/watchlist — fetch user's watchlists with assets
export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await getUserFromRequest(request);

    if (authError || !user) {
      // Return default guest watchlist for unauthenticated/hydrating requests without 401 error
      return NextResponse.json([{
        id: 'watchlist-default',
        name: 'My Watchlist',
        items: [],
      }], { status: 200 });
    }

    const db = getSupabaseAdmin(request);

    // Get user's watchlists
    const { data: watchlists, error } = await db
      .from('watchlists')
      .select(`
        id,
        name,
        created_at,
        watchlist_items (
          id,
          asset_id,
          assets (
            id,
            symbol,
            name,
            asset_type,
            description,
            is_active
          )
        )
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: true });

    if (error && error.code !== 'PGRST116') {
      console.warn('Watchlist DB query notice:', error.message);
    }

    if (!watchlists || watchlists.length === 0) {
      // Try creating default watchlist for new user
      try {
        const { data: newWl } = await db
          .from('watchlists')
          .insert({ user_id: user.id, name: 'My Watchlist' })
          .select()
          .maybeSingle();

        if (newWl) {
          return NextResponse.json([{
            id: newWl.id,
            name: 'My Watchlist',
            items: [],
          }]);
        }
      } catch (e) {
        console.warn('Could not auto-create watchlist row:', e);
      }

      // Return synthetic default watchlist structure for client UI
      return NextResponse.json([{
        id: `watchlist-${user.id.substring(0, 8)}`,
        name: 'My Watchlist',
        items: [],
      }]);
    }

    const formatted = watchlists.map((wl: any) => ({
      id: wl.id,
      name: wl.name,
      created_at: wl.created_at,
      items: (wl.watchlist_items || [])
        .map((item: any) => {
          const asset = item.assets;
          if (!asset) {
            const fallback = SUPPORTED_ASSETS.find(a => a.id === item.asset_id);
            return fallback || null;
          }
          return {
            id: asset.id,
            symbol: asset.symbol,
            name: asset.name,
            asset_type: asset.asset_type,
            description: asset.description,
            is_active: asset.is_active,
          };
        })
        .filter(Boolean),
    }));

    return NextResponse.json(formatted);
  } catch (error: any) {
    console.error('Watchlist GET error:', error);
    return NextResponse.json([{
      id: 'watchlist-default',
      name: 'My Watchlist',
      items: [],
    }], { status: 200 });
  }
}

// POST /api/market/watchlist — create a new watchlist
export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await getUserFromRequest(request);
    if (authError || !user) {
      return NextResponse.json({ detail: authError || 'Not authenticated' }, { status: 401 });
    }

    const body = await request.json();
    const { name } = body;
    const db = getSupabaseAdmin(request);

    const { data, error } = await db
      .from('watchlists')
      .insert({ user_id: user.id, name: name || 'My Watchlist' })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ ...data, items: [] }, { status: 201 });
  } catch (error: any) {
    console.error('Watchlist POST error:', error);
    return NextResponse.json(
      { error: 'Failed to create watchlist', detail: error?.message },
      { status: 500 }
    );
  }
}
