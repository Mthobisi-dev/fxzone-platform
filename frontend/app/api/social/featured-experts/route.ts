import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// GET /api/social/featured-experts — fetch actual top active users from database
export async function GET() {
  try {
    const { data: users, error } = await supabaseAdmin
      .from('users')
      .select('id, username, display_name, avatar_url, role, win_rate, total_profit_pct')
      .order('created_at', { ascending: false })
      .limit(5);

    if (error) throw error;

    const experts = (users || []).map((u: any) => ({
      id: u.id,
      username: u.username,
      display_name: u.display_name || u.username,
      avatar_url: u.avatar_url || null,
      role: u.role || 'Trader',
      win_rate: u.win_rate || '0%',
      total_profit_pct: u.total_profit_pct || '0.0%',
    }));

    return NextResponse.json(experts);
  } catch (error: any) {
    console.error('Featured experts error:', error);
    return NextResponse.json([]);
  }
}
