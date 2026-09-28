import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

const noStoreHeaders = { 'Cache-Control': 'no-store, max-age=0' };

export async function GET() {
  try {
    const db = getSupabaseAdmin();
    const { error } = await db.from('users').select('id', { head: true, count: 'exact' }).limit(1);
    if (error) throw error;

    return NextResponse.json({ status: 'healthy', backend: 'supabase' }, { headers: noStoreHeaders });
  } catch (error: unknown) {
    // Keep operational details in server logs. This endpoint is public and must
    // not disclose database errors or which deployment secrets are missing.
    console.error('Health check failed', error);
    return NextResponse.json(
      {
        status: 'unhealthy',
        backend: 'supabase',
      },
      { status: 503, headers: noStoreHeaders }
    );
  }
}
