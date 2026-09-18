import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { SUPPORTED_ASSETS } from '@/lib/server/marketService';



async function getUser(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const token = authHeader?.replace('Bearer ', '');
  if (!token) return null;
  try {
    const { data: { user } } = await supabaseAdmin.auth.getUser(token);
    return user;
  } catch {
    return null;
  }
}

// GET /api/market/watchlist — fetch user's watchlists with assets
export async function GET(request: NextRequest) {
  try {
    const user = await getUser(request);

    if (!user) {
      // Return default watchlist with popular assets for unauthenticated users
      const defaults = ['NVDA', 'BTCUSD', 'EURUSD', 'XAUUSD'];
      return NextResponse.json([{
        id: 'watchlist-default',
        name: 'My Watchlist',
        items: SUPPORTED_ASSETS.filter(a => defaults.includes(a.symbol)),
      }]);
    }

    // Get user's watchlists
    const { data: watchlists, error } = await supabaseAdmin
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

    if (error) throw error;

    if (!watchlists || watchlists.length === 0) {
      // Create default watchlist for new user
      const { data: newWl } = await supabaseAdmin
        .from('watchlists')
        .insert({ user_id: user.id, name: 'My Watchlist' })
        .select()
        .single();

      return NextResponse.json([{
        id: newWl?.id || 'watchlist-default',
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
            // Fallback: look up from SUPPORTED_ASSETS by id
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
    // Fallback to defaults on error
    return NextResponse.json([{
      id: 'watchlist-default',
      name: 'My Watchlist',
      items: SUPPORTED_ASSETS.slice(0, 4),
    }]);
  }
}

// POST /api/market/watchlist — create a new watchlist
export async function POST(request: NextRequest) {
  try {
    const user = await getUser(request);
    const body = await request.json();

    if (!user) {
      return NextResponse.json({ id: 'watchlist-default', name: body.name || 'My Watchlist', items: [] });
    }

    const { name } = body;

    const { data, error } = await supabaseAdmin
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
