import { NextResponse } from 'next/server';

export async function GET() {
  const timestamp = new Date().toISOString();

  const posts = [
    {
      id: 'post-1',
      user_id: 'user-allex',
      user: {
        id: 'user-allex',
        username: 'AlexTrader',
        full_name: 'Alex Rivera',
        avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=250&q=80',
        badge: 'PRO Trader',
      },
      content: 'NVIDIA (NVDA) breaking out above $135 resistance with high volume backing. Google AI sentiment aligns bullish. Target $145 short term. 🚀📈',
      media_type: 'none',
      symbol: 'NVDA',
      likes_count: 42,
      comments_count: 8,
      reposts_count: 5,
      created_at: timestamp,
    },
    {
      id: 'post-2',
      user_id: 'user-sarah',
      user: {
        id: 'user-sarah',
        username: 'SarahFX',
        full_name: 'Sarah Chen',
        avatar_url: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=250&q=80',
        badge: 'Forex Analyst',
      },
      content: 'EUR/USD holding steady near key monetary support level. Watching ECB central bank press conference for interest rate direction.',
      media_type: 'none',
      symbol: 'EURUSD',
      likes_count: 28,
      comments_count: 3,
      reposts_count: 2,
      created_at: timestamp,
    },
  ];

  return NextResponse.json(posts);
}
