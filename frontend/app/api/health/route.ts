import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function GET() {
  try {
    const db = getSupabaseAdmin();
    const { error } = await db.from('users').select('id', { head: true, count: 'exact' }).limit(1);
    if (error) throw error;

    return NextResponse.json({ status: 'ok', backend: 'supabase' });
  } catch (error: any) {
    return NextResponse.json(
      { status: 'error', backend: 'supabase', detail: error?.message || 'Supabase is unavailable' },
      { status: 503 }
    );
  }
}
