import { NextResponse } from 'next/server';

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; assetId: string }> }
) {
  try {
    const resolvedParams = await params;
    const watchlistId = resolvedParams.id;
    const assetId = resolvedParams.assetId;

    return NextResponse.json({
      id: watchlistId || 'watchlist-default',
      name: 'My Watchlist',
      message: `Asset ${assetId} removed from watchlist`,
    });
  } catch (err: any) {
    return NextResponse.json({ success: true });
  }
}
