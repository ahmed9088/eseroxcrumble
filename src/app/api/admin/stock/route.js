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
  classic_chocolate_chip: { available: 200, initial: 200, price: 580, is_active: true },
  double_chocolate: { available: 200, initial: 200, price: 580, is_active: true },
  chocolate_chip_walnut: { available: 100, initial: 100, price: 580, is_active: true },
  cookies_cream: { available: 150, initial: 150, price: 620, is_active: true },
  kunafa_chocolate: { available: 100, initial: 100, price: 620, is_active: true },
  hazelnut_filled: { available: 150, initial: 150, price: 620, is_active: true },
  lotus_lava: { available: 100, initial: 100, price: 620, is_active: true },
  classic_bundle: { is_active: true, price: 2200 },
  premium_bundle: { is_active: true, price: 2400 },
};

export async function GET() {
  try {
    const { data: stockItems, error } = await supabaseAdmin
      .from('cookie_stock')
      .select('*')
      .order('flavor_key');

    if (error) {
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        console.warn('cookie_stock table not found. Returning default fallback stock.');
        return NextResponse.json({ stock: defaultStock });
      }
      console.error('Error loading stock from db:', error);
      return NextResponse.json({ error: 'Failed to load stock.' }, { status: 500 });
    }

    const stockMap = {};
    stockItems.forEach(item => {
      stockMap[item.flavor_key] = {
        available: item.available_stock,
        initial: item.initial_stock,
        price: item.price,
        is_active: item.is_active
      };
    });

    const hasClassicActive = stockItems.some(i => (i.flavor_key.startsWith('classic') || i.flavor_key === 'chocolate_chip_walnut') && i.is_active);
    const hasPremiumActive = stockItems.some(i => (!i.flavor_key.startsWith('classic') && i.flavor_key !== 'chocolate_chip_walnut') && i.is_active);

    stockMap['classic_bundle'] = {
      is_active: hasClassicActive,
      price: 2200
    };
    stockMap['premium_bundle'] = {
      is_active: hasPremiumActive,
      price: 2400
    };

    return NextResponse.json({ stock: stockMap });
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

    const body = await request.json();
    const { flavorKey, availableStock, initialStock, price, isActive, bulkStock } = body;

    // Support bulk stock update
    if (bulkStock) {
      for (const [key, val] of Object.entries(bulkStock)) {
        if (key === 'classic_bundle' || key === 'premium_bundle') continue;
        await supabaseAdmin
          .from('cookie_stock')
          .update({
            available_stock: val.available,
            initial_stock: val.initial,
            price: val.price,
            is_active: val.is_active,
            updated_at: new Date().toISOString(),
          })
          .eq('flavor_key', key);
      }
      return NextResponse.json({ success: true });
    }

    // Support toggle/active updates for backward compatibility (single field changes)
    if (flavorKey) {
      const updates = {};
      if (availableStock !== undefined) updates.available_stock = availableStock;
      if (initialStock !== undefined) updates.initial_stock = initialStock;
      if (price !== undefined) updates.price = price;
      if (isActive !== undefined) updates.is_active = isActive;
      updates.updated_at = new Date().toISOString();

      const { error } = await supabaseAdmin
        .from('cookie_stock')
        .update(updates)
        .eq('flavor_key', flavorKey);

      if (error) {
        console.error('Error updating stock row:', error);
        return NextResponse.json({ error: 'Failed to update stock.' }, { status: 500 });
      }

      return NextResponse.json({ success: true });
    }

    // Support full compatibility with old boolean toggle structure
    // If body contains stock object, e.g. { stock: { classic_chocolate_chip: false } }
    if (body.stock) {
      for (const [key, isAct] of Object.entries(body.stock)) {
        if (key === 'classic_bundle' || key === 'premium_bundle') continue;
        await supabaseAdmin
          .from('cookie_stock')
          .update({
            is_active: isAct,
            updated_at: new Date().toISOString(),
          })
          .eq('flavor_key', key);
      }
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid payload.' }, { status: 400 });
  } catch (error) {
    console.error('Stock PUT Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
