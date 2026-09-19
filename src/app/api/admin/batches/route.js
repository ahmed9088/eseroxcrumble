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

const DEFAULT_BATCHES = {
  activeBatchId: 'batch_1',
  batches: [
    {
      id: 'batch_1',
      name: 'Pre-Order 1',
      status: 'active',
      createdAt: '2026-09-15T00:00:00.000Z',
      notes: 'Initial pre-order launch round',
    },
  ],
};

async function getStoredBatches() {
  const { data, error } = await supabaseAdmin
    .from('settings')
    .select('value')
    .eq('key', 'preorder_batches')
    .single();

  if (error || !data || !data.value) {
    return DEFAULT_BATCHES;
  }
  return data.value;
}

async function saveStoredBatches(batchesData) {
  const { error } = await supabaseAdmin
    .from('settings')
    .upsert(
      {
        key: 'preorder_batches',
        value: batchesData,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'key' }
    );

  if (error) {
    console.error('Error saving preorder batches to settings:', error);
    throw error;
  }
}

// GET: Retrieve batches, active batch, and aggregated order statistics per batch
export async function GET() {
  try {
    const batchesData = await getStoredBatches();

    // Fetch order counts and revenues per batch
    let batchStats = {};
    try {
      const { data: orders, error: ordErr } = await supabaseAdmin
        .from('orders')
        .select('id, batch_name, total_amount, payment_status, order_status');

      if (!ordErr && orders) {
        orders.forEach((o) => {
          const bName = o.batch_name || 'Pre-Order 1';
          if (!batchStats[bName]) {
            batchStats[bName] = {
              totalOrders: 0,
              approvedRevenue: 0,
              pendingOrders: 0,
              completedOrders: 0,
            };
          }
          batchStats[bName].totalOrders += 1;
          if (o.payment_status === 'approved') {
            batchStats[bName].approvedRevenue += parseFloat(o.total_amount || 0);
          }
          if (o.payment_status === 'pending') {
            batchStats[bName].pendingOrders += 1;
          }
          if (o.order_status === 'completed') {
            batchStats[bName].completedOrders += 1;
          }
        });
      }
    } catch (e) {
      console.warn('Orders query in batches GET failed or batch_name missing:', e);
    }

    const activeBatch =
      batchesData.batches.find((b) => b.id === batchesData.activeBatchId) ||
      batchesData.batches[0];

    return NextResponse.json({
      batches: batchesData.batches,
      activeBatchId: batchesData.activeBatchId,
      activeBatch,
      stats: batchStats,
    });
  } catch (error) {
    console.error('Batches GET Error:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve batches' },
      { status: 500 }
    );
  }
}

// POST: Create a new pre-order batch / round (e.g. "Pre-Order 2")
export async function POST(request) {
  try {
    if (!(await isAuthenticated())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, notes = '', resetStock = true, setActive = true } = body;

    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: 'Batch name is required.' },
        { status: 400 }
      );
    }

    const batchesData = await getStoredBatches();
    const cleanName = name.trim();

    // Check if name already exists
    const exists = batchesData.batches.some(
      (b) => b.name.toLowerCase() === cleanName.toLowerCase()
    );
    if (exists) {
      return NextResponse.json(
        { error: `A batch named "${cleanName}" already exists.` },
        { status: 400 }
      );
    }

    const newBatchId = `batch_${Date.now()}`;
    const newBatch = {
      id: newBatchId,
      name: cleanName,
      status: 'active',
      createdAt: new Date().toISOString(),
      notes,
    };

    // If setting as active, update existing batches
    let updatedBatches = [...batchesData.batches, newBatch];
    let newActiveId = batchesData.activeBatchId;

    if (setActive) {
      newActiveId = newBatchId;
      // Mark previous active batch as closed or keep as is
      updatedBatches = updatedBatches.map((b) =>
        b.id === batchesData.activeBatchId && b.id !== newBatchId
          ? { ...b, status: 'closed' }
          : b
      );
    }

    await saveStoredBatches({
      activeBatchId: newActiveId,
      batches: updatedBatches,
    });

    // If resetStock is requested, reset all cookie available_stock to initial_stock
    if (resetStock) {
      try {
        const { data: stockItems } = await supabaseAdmin
          .from('cookie_stock')
          .select('flavor_key, initial_stock');

        if (stockItems && stockItems.length > 0) {
          for (const item of stockItems) {
            await supabaseAdmin
              .from('cookie_stock')
              .update({
                available_stock: item.initial_stock,
                updated_at: new Date().toISOString(),
              })
              .eq('flavor_key', item.flavor_key);
          }
        }
      } catch (stockErr) {
        console.warn('Could not reset cookie_stock in database:', stockErr);
      }
    }

    return NextResponse.json({
      success: true,
      batch: newBatch,
      batches: updatedBatches,
      activeBatchId: newActiveId,
    });
  } catch (error) {
    console.error('Batches POST Error:', error);
    return NextResponse.json(
      { error: 'Failed to create new batch' },
      { status: 500 }
    );
  }
}

// PUT: Update batch details, switch active batch, or trigger stock reset
export async function PUT(request) {
  try {
    if (!(await isAuthenticated())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { batchId, activeBatchId, name, status, notes, resetStock } = body;

    const batchesData = await getStoredBatches();

    // Switch active batch directly
    if (activeBatchId) {
      const targetBatch = batchesData.batches.find((b) => b.id === activeBatchId);
      if (!targetBatch) {
        return NextResponse.json({ error: 'Batch not found.' }, { status: 404 });
      }

      batchesData.activeBatchId = activeBatchId;
      await saveStoredBatches(batchesData);
      return NextResponse.json({
        success: true,
        activeBatchId,
        batches: batchesData.batches,
      });
    }

    // Reset stock for current or specific batch
    if (resetStock) {
      try {
        const { data: stockItems } = await supabaseAdmin
          .from('cookie_stock')
          .select('flavor_key, initial_stock');

        if (stockItems && stockItems.length > 0) {
          for (const item of stockItems) {
            await supabaseAdmin
              .from('cookie_stock')
              .update({
                available_stock: item.initial_stock,
                updated_at: new Date().toISOString(),
              })
              .eq('flavor_key', item.flavor_key);
          }
        }
      } catch (stockErr) {
        console.warn('Could not reset cookie_stock in database:', stockErr);
      }
      return NextResponse.json({ success: true, message: 'Stock reset to initial targets.' });
    }

    // Update existing batch properties
    if (batchId) {
      batchesData.batches = batchesData.batches.map((b) => {
        if (b.id === batchId) {
          return {
            ...b,
            name: name !== undefined ? name.trim() : b.name,
            status: status !== undefined ? status : b.status,
            notes: notes !== undefined ? notes : b.notes,
          };
        }
        return b;
      });

      await saveStoredBatches(batchesData);
      return NextResponse.json({
        success: true,
        batches: batchesData.batches,
        activeBatchId: batchesData.activeBatchId,
      });
    }

    return NextResponse.json({ error: 'Invalid update payload.' }, { status: 400 });
  } catch (error) {
    console.error('Batches PUT Error:', error);
    return NextResponse.json(
      { error: 'Failed to update batch' },
      { status: 500 }
    );
  }
}

// DELETE: Delete a pre-order batch
export async function DELETE(request) {
  try {
    if (!(await isAuthenticated())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const batchId = searchParams.get('batchId');

    if (!batchId) {
      return NextResponse.json({ error: 'Batch ID is required.' }, { status: 400 });
    }

    const batchesData = await getStoredBatches();

    if (batchesData.batches.length <= 1) {
      return NextResponse.json(
        { error: 'Cannot delete the only remaining batch. At least one batch must exist.' },
        { status: 400 }
      );
    }

    // If deleting active batch, set another as active
    let newActiveId = batchesData.activeBatchId;
    if (batchesData.activeBatchId === batchId) {
      const otherBatch = batchesData.batches.find((b) => b.id !== batchId);
      newActiveId = otherBatch ? otherBatch.id : '';
    }

    const updatedBatches = batchesData.batches.filter((b) => b.id !== batchId);

    await saveStoredBatches({
      activeBatchId: newActiveId,
      batches: updatedBatches,
    });

    return NextResponse.json({
      success: true,
      batches: updatedBatches,
      activeBatchId: newActiveId,
    });
  } catch (error) {
    console.error('Batches DELETE Error:', error);
    return NextResponse.json(
      { error: 'Failed to delete batch' },
      { status: 500 }
    );
  }
}
