import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  context: { params: { id: string } | Promise<{ id: string }> }
) {
  try {
    const params = await Promise.resolve(context.params);
    const userId = params.id;

    // Return sample technical posts for trader
    const posts = [
      {
        id: `post-${userId}-1`,
        user_id: userId,
        user: {
          id: userId,
          username: userId.includes('@') ? userId.split('@')[0] : userId,
          display_name: userId,
          avatar_url: `https://api.dicebear.com/8.x/initials/svg?seed=${encodeURIComponent(userId)}`,
          role: 'trader',
        },
        content: `Analyzing ICT Order Block setup on ${userId.includes('Crypto') ? 'BTCUSD' : 'EURUSD'}. High liquidity zone identified near recent swing high. Risk-to-Reward ratio 1:3.2. 📈🎯`,
        media_type: 'none',
        asset_tags: userId.includes('Crypto') ? ['BTCUSD', 'ETHUSD'] : ['EURUSD', 'GBPUSD'],
        likes_count: 24,
        comments_count: 5,
        reposts_count: 2,
        created_at: new Date(Date.now() - 3600000 * 4).toISOString(),
      },
      {
        id: `post-${userId}-2`,
        user_id: userId,
        user: {
          id: userId,
          username: userId.includes('@') ? userId.split('@')[0] : userId,
          display_name: userId,
          avatar_url: `https://api.dicebear.com/8.x/initials/svg?seed=${encodeURIComponent(userId)}`,
          role: 'trader',
        },
        content: `Weekly macro breakdown: Watching central bank rate decisions and inflation prints for volatility expansion. Maintain strict risk management. 🛡️`,
        media_type: 'none',
        asset_tags: ['GOLD', 'US30'],
        likes_count: 19,
        comments_count: 3,
        reposts_count: 1,
        created_at: new Date(Date.now() - 3600000 * 24).toISOString(),
      },
    ];

    return NextResponse.json(posts);
  } catch (error: any) {
    console.error('Error fetching user posts:', error);
    return NextResponse.json([], { status: 200 });
  }
}
