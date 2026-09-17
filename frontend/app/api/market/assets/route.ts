import { NextResponse } from 'next/server';
import { SUPPORTED_ASSETS } from '@/lib/server/marketService';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('asset_type');

  let filtered = SUPPORTED_ASSETS;
  if (type) {
    filtered = SUPPORTED_ASSETS.filter((a) => a.asset_type === type);
  }

  return NextResponse.json(filtered, {
    headers: {
      'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
    },
  });
}
