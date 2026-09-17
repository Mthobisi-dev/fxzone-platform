import { NextResponse } from 'next/server';

export async function GET() {
  const timestamp = new Date().toISOString();
  return NextResponse.json([
    {
      id: 'notif-1',
      title: 'Real-Time Price Alert',
      message: 'NVDA reached your technical breakout target above $135.00.',
      type: 'price_alert',
      is_read: false,
      created_at: timestamp,
    },
    {
      id: 'notif-2',
      title: 'Google AI Intelligence Update',
      message: 'New bullish sentiment consensus detected for BTCUSD.',
      type: 'ai_signal',
      is_read: true,
      created_at: timestamp,
    },
  ]);
}

export async function PUT() {
  return NextResponse.json({ success: true });
}
