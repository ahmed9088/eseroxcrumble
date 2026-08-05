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

const DEFAULT_SETTINGS = {
  isDeliveryEnabled: true,
  isPickupEnabled: true,
};

// GET: Public fetch of delivery & pickup availability settings
export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('settings')
      .select('value')
      .eq('key', 'order_settings')
      .single();

    if (error || !data || !data.value) {
      // If not found in DB, return defaults (both enabled)
      return NextResponse.json(DEFAULT_SETTINGS);
    }

    return NextResponse.json({
      isDeliveryEnabled: data.value.isDeliveryEnabled ?? true,
      isPickupEnabled: data.value.isPickupEnabled ?? true,
    });
  } catch (err) {
    console.error('Fetch order settings error:', err);
    return NextResponse.json(DEFAULT_SETTINGS);
  }
}

// PUT: Admin update of delivery & pickup availability settings
export async function PUT(request) {
  try {
    if (!(await isAuthenticated())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const isDeliveryEnabled = body.isDeliveryEnabled ?? true;
    const isPickupEnabled = body.isPickupEnabled ?? true;

    const { error } = await supabaseAdmin
      .from('settings')
      .upsert({
        key: 'order_settings',
        value: { isDeliveryEnabled, isPickupEnabled },
        updated_at: new Date().toISOString(),
      }, { onConflict: 'key' });

    if (error) {
      console.error('Upsert order settings error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      isDeliveryEnabled,
      isPickupEnabled,
    });
  } catch (err) {
    console.error('Update order settings error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
