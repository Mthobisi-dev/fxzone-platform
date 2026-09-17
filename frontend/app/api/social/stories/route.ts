import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json([
    {
      id: 'story-1',
      user: {
        id: 'u-1',
        username: 'AlexTrader',
        avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=250&q=80',
      },
      has_unseen: true,
    },
    {
      id: 'story-2',
      user: {
        id: 'u-2',
        username: 'SarahFX',
        avatar_url: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=250&q=80',
      },
      has_unseen: false,
    },
  ]);
}
