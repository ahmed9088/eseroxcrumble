import { cookies } from 'next/headers';
import { supabaseAdmin } from '../../../../lib/supabase';
import { NextResponse } from 'next/server';

// Helper to check authentication
async function isAuthenticated() {
  const cookieStore = await cookies();
  const session = cookieStore.get('admin_session');
  const adminPassword = process.env.ADMIN_PASSWORD || 'EseroAdmin2026!';
  return session && session.value === adminPassword;
}

const defaultStock = {
  classic_chocolate_chip: true,
  double_chocolate: true,
  chocolate_chip_walnut: true,
  cookies_cream: true,
  kunafa_chocolate: true,
  hazelnut_filled: true,
  lotus_lava: true,
  classic_bundle: true,
  premium_bundle: true,
};

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('settings')
      .select('value')
      .eq('key', 'cookie_stock')
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // Record not found, return default stock
        return NextResponse.json({ stock: defaultStock });
      }
      console.error('Error loading stock from db:', error);
      return NextResponse.json({ error: 'Failed to load stock.' }, { status: 500 });
    }

    return NextResponse.json({ stock: data.value });
  } catch (error) {
    console.error('Stock GET Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    if (!(await isAuthenticated())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { stock } = await request.json();

    if (!stock) {
      return NextResponse.json({ error: 'Stock configuration is required.' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('settings')
      .upsert({
        key: 'cookie_stock',
        value: stock,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('Error saving stock to db:', error);
      return NextResponse.json({ error: 'Failed to save stock.' }, { status: 500 });
    }

    return NextResponse.json({ success: true, stock: data.value });
  } catch (error) {
    console.error('Stock PUT Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
