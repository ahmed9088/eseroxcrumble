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

const defaultStockList = [
  { key: 'classic_chocolate_chip', name: 'Classic Chocolate Chip', available: 200, initial: 200, price: 580, is_active: true, category: 'classic' },
  { key: 'double_chocolate', name: 'Double Chocolate', available: 200, initial: 200, price: 580, is_active: true, category: 'classic' },
  { key: 'chocolate_chip_walnut', name: 'Chocolate Chip Walnut', available: 100, initial: 100, price: 580, is_active: true, category: 'classic' },
  { key: 'cookies_cream', name: 'Cookies & Cream', available: 150, initial: 150, price: 620, is_active: true, category: 'premium' },
  { key: 'kunafa_chocolate', name: 'Kunafa Chocolate', available: 100, initial: 100, price: 620, is_active: true, category: 'premium' },
  { key: 'hazelnut_filled', name: 'Hazelnut Filled', available: 150, initial: 150, price: 620, is_active: true, category: 'premium' },
  { key: 'lotus_lava', name: 'Lotus Lava', available: 100, initial: 100, price: 620, is_active: true, category: 'premium' },
  { key: 'dot_cake_cookie', name: 'Dot Cake Cookie', available: 100, initial: 100, price: 650, is_active: true, category: 'special' },
  { key: 'crumble_pot', name: 'Crumble Pot', available: 50, initial: 50, price: 3500, is_active: true, category: 'special' },
];

export async function GET() {
  try {
    const { data: stockItems, error } = await supabaseAdmin
      .from('cookie_stock')
      .select('*')
      .order('flavor_key');

    let items = [];
    if (error || !stockItems || stockItems.length === 0) {
      items = [...defaultStockList];
    } else {
      items = stockItems.map((item) => {
        const isClassic =
          item.category === 'classic' ||
          item.flavor_key.startsWith('classic') ||
          item.flavor_key === 'chocolate_chip_walnut';
        return {
          key: item.flavor_key,
          name: item.flavor_name || item.flavor_key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
          available: item.available_stock,
          initial: item.initial_stock,
          price:
            item.price !== null && item.price !== undefined && Number(item.price) > 0
              ? Number(item.price)
              : (isClassic ? 580 : 620),
          is_active: item.is_active,
          category: item.category || (isClassic ? 'classic' : 'premium'),
        };
      });

      // Ensure essential catalog items (Crumble Pot, Dot Cake Cookie) are always included
      const existingKeys = new Set(items.map((i) => i.key));
      if (!existingKeys.has('crumble_pot')) {
        items.push({
          key: 'crumble_pot',
          name: 'Crumble Pot',
          available: 50,
          initial: 50,
          price: 3500,
          is_active: true,
          category: 'special',
        });
      }
      if (!existingKeys.has('dot_cake_cookie')) {
        items.push({
          key: 'dot_cake_cookie',
          name: 'Dot Cake Cookie',
          available: 100,
          initial: 100,
          price: 650,
          is_active: true,
          category: 'special',
        });
      }
    }

    // Fetch bundle configurations from settings if available
    let bundleSettings = {
      classic_bundle: { price: 2200, is_active: true },
      premium_bundle: { price: 2400, is_active: true },
    };

    try {
      const { data: bData } = await supabaseAdmin
        .from('settings')
        .select('value')
        .eq('key', 'bundle_settings')
        .single();
      if (bData && bData.value) {
        bundleSettings = { ...bundleSettings, ...bData.value };
      }
    } catch (bErr) {
      // ignore
    }

    // Check if any classic or premium items are active
    const hasClassicActive = items.some((i) => i.category === 'classic' && i.is_active);
    const hasPremiumActive = items.some((i) => i.category === 'premium' && i.is_active);

    const stockMap = {};
    items.forEach((item) => {
      stockMap[item.key] = {
        flavor_name: item.name,
        name: item.name,
        available: item.available,
        initial: item.initial,
        price: item.price,
        is_active: item.is_active,
        category: item.category,
      };
    });

    stockMap['classic_bundle'] = {
      name: 'Classic Bundle (pack of 4)',
      is_active: Boolean(bundleSettings.classic_bundle?.is_active && hasClassicActive),
      price: Number(bundleSettings.classic_bundle?.price) > 0 ? Number(bundleSettings.classic_bundle.price) : 2200,
      isBundle: true,
      category: 'bundle',
    };

    stockMap['premium_bundle'] = {
      name: 'Premium Bundle (pack of 4)',
      is_active: Boolean(bundleSettings.premium_bundle?.is_active && hasPremiumActive),
      price: Number(bundleSettings.premium_bundle?.price) > 0 ? Number(bundleSettings.premium_bundle.price) : 2400,
      isBundle: true,
      category: 'bundle',
    };

    return NextResponse.json({
      stock: stockMap,
      items,
      bundles: bundleSettings,
    });
  } catch (error) {
    console.error('Stock GET Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// POST: Add a new menu item / cookie flavour
export async function POST(request) {
  try {
    if (!(await isAuthenticated())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      name,
      price = 600,
      initialStock = 100,
      availableStock = 100,
      category = 'classic',
      isActive = true,
      customKey,
    } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Item name is required.' }, { status: 400 });
    }

    // Generate slug/key
    const generatedKey = customKey
      ? customKey.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_')
      : name
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9]/g, '_')
          .replace(/_+/g, '_')
          .replace(/^_|_$/g, '');

    const key = generatedKey || `flavor_${Date.now()}`;

    // Insert into cookie_stock
    const insertPayload = {
      flavor_key: key,
      flavor_name: name.trim(),
      price: parseInt(price, 10) || 0,
      initial_stock: parseInt(initialStock, 10) || 0,
      available_stock: parseInt(availableStock, 10) || 0,
      is_active: Boolean(isActive),
      updated_at: new Date().toISOString(),
    };

    // Try inserting with category if column exists
    let insertErr = null;
    try {
      const { error } = await supabaseAdmin
        .from('cookie_stock')
        .insert({ ...insertPayload, category });
      insertErr = error;
    } catch (e) {
      insertErr = e;
    }

    if (insertErr) {
      // Fallback: try inserting without category column if not yet migrated
      const { error: fallbackErr } = await supabaseAdmin
        .from('cookie_stock')
        .insert(insertPayload);

      if (fallbackErr) {
        console.error('Error inserting new menu item:', fallbackErr);
        return NextResponse.json(
          { error: fallbackErr.message || 'Failed to add new menu item.' },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      item: {
        key,
        name: name.trim(),
        price: parseInt(price, 10) || 0,
        initial: parseInt(initialStock, 10) || 0,
        available: parseInt(availableStock, 10) || 0,
        category,
        is_active: Boolean(isActive),
      },
    });
  } catch (error) {
    console.error('Stock POST Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// PUT: Update item details, prices, stock levels, or bundles
export async function PUT(request) {
  try {
    if (!(await isAuthenticated())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      flavorKey,
      name,
      availableStock,
      initialStock,
      price,
      isActive,
      category,
      bulkStock,
      bundleSettings,
    } = body;

    // Support updating bundle settings
    if (bundleSettings) {
      await supabaseAdmin.from('settings').upsert({
        key: 'bundle_settings',
        value: bundleSettings,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'key' });
      return NextResponse.json({ success: true, message: 'Bundle settings updated.' });
    }

    // Support bulk stock update / reset
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

    // Single item update
    if (flavorKey) {
      // Handle bundle price/status update
      if (flavorKey === 'classic_bundle' || flavorKey === 'premium_bundle') {
        const { data: bData } = await supabaseAdmin
          .from('settings')
          .select('value')
          .eq('key', 'bundle_settings')
          .single();

        const currentBundles = bData?.value || {
          classic_bundle: { price: 2200, is_active: true },
          premium_bundle: { price: 2400, is_active: true },
        };

        if (price !== undefined) currentBundles[flavorKey].price = parseInt(price, 10);
        if (isActive !== undefined) currentBundles[flavorKey].is_active = Boolean(isActive);

        await supabaseAdmin.from('settings').upsert({
          key: 'bundle_settings',
          value: currentBundles,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'key' });

        return NextResponse.json({ success: true });
      }

      const updates = { updated_at: new Date().toISOString() };
      if (name !== undefined) updates.flavor_name = name.trim();
      if (availableStock !== undefined) updates.available_stock = parseInt(availableStock, 10);
      if (initialStock !== undefined) updates.initial_stock = parseInt(initialStock, 10);
      if (price !== undefined) updates.price = parseInt(price, 10);
      if (isActive !== undefined) updates.is_active = Boolean(isActive);
      if (category !== undefined) updates.category = category;

      let { error } = await supabaseAdmin
        .from('cookie_stock')
        .update(updates)
        .eq('flavor_key', flavorKey);

      // If category column does not exist yet, retry without category
      if (error && error.message?.includes('category')) {
        delete updates.category;
        const retry = await supabaseAdmin
          .from('cookie_stock')
          .update(updates)
          .eq('flavor_key', flavorKey);
        error = retry.error;
      }

      if (error) {
        console.error('Error updating stock row:', error);
        return NextResponse.json({ error: 'Failed to update stock.' }, { status: 500 });
      }

      return NextResponse.json({ success: true });
    }

    // Compatibility with old boolean toggle structure
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

// DELETE: Delete a menu item / cookie flavour permanently
export async function DELETE(request) {
  try {
    if (!(await isAuthenticated())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const flavorKey = searchParams.get('flavorKey');

    if (!flavorKey) {
      return NextResponse.json({ error: 'flavorKey is required.' }, { status: 400 });
    }

    if (flavorKey === 'classic_bundle' || flavorKey === 'premium_bundle') {
      return NextResponse.json(
        { error: 'Bundle offerings cannot be deleted. You can toggle them active/inactive.' },
        { status: 400 }
      );
    }

    const { error } = await supabaseAdmin
      .from('cookie_stock')
      .delete()
      .eq('flavor_key', flavorKey);

    if (error) {
      console.error('Error deleting menu item from cookie_stock:', error);
      return NextResponse.json({ error: error.message || 'Failed to delete item.' }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: `Item ${flavorKey} deleted successfully.` });
  } catch (error) {
    console.error('Stock DELETE Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
