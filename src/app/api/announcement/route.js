import { cookies } from 'next/headers';
import { supabaseAdmin } from '../../../lib/supabase';
import { NextResponse } from 'next/server';

// Helper to check authentication
async function isAuthenticated() {
  const cookieStore = await cookies();
  const session = cookieStore.get('admin_session');
  const adminPassword = process.env.ADMIN_PASSWORD || 'EseroAdmin2026!';
  return session && session.value === adminPassword;
}

// GET: Public fetch of announcement/updates
export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('settings')
      .select('value')
      .eq('key', 'announcement')
      .single();

    if (error) {
      // If not found, return empty inactive announcement
      return NextResponse.json({ text: '', isActive: false });
    }

    return NextResponse.json(data.value || { text: '', isActive: false });
  } catch (err) {
    console.error('Fetch announcement error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// PUT: Admin update of announcement/updates
export async function PUT(request) {
  try {
    if (!(await isAuthenticated())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { text, isActive } = await request.json();

    const { error } = await supabaseAdmin
      .from('settings')
      .upsert({
        key: 'announcement',
        value: { text, isActive },
        updated_at: new Date().toISOString()
      }, { onConflict: 'key' });

    if (error) {
      console.error('Upsert announcement error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Update announcement error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
