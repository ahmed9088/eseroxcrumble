import { cookies } from 'next/headers';
import { resend } from '../../../../lib/resend';
import { supabaseAdmin } from '../../../../lib/supabase';
import { NextResponse } from 'next/server';

// Helper to check authentication
async function isAuthenticated() {
  const cookieStore = await cookies();
  const session = cookieStore.get('admin_session');
  const adminPassword = process.env.ADMIN_PASSWORD || 'EseroAdmin2026!';
  return session && session.value === adminPassword;
}

export async function GET(request) {
  try {
    if (!(await isAuthenticated())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const paymentStatus = searchParams.get('paymentStatus') || '';
    const orderType = searchParams.get('orderType') || '';

    let query = supabaseAdmin
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false });

    // Apply filters
    if (paymentStatus) {
      query = query.eq('payment_status', paymentStatus);
    }
    if (orderType) {
      query = query.eq('order_type', orderType);
    }

    const { data: orders, error } = await query;

    if (error) {
      console.error('Error fetching orders:', error);
      return NextResponse.json({ error: 'Failed to fetch orders.' }, { status: 500 });
    }

    // Client-side text search (safely handles null/missing fields)
    let filteredOrders = orders;
    if (search) {
      const term = search.toLowerCase();
      filteredOrders = orders.filter(
        (o) =>
          (o.first_name || '').toLowerCase().includes(term) ||
          (o.last_name || '').toLowerCase().includes(term) ||
          (o.email || '').toLowerCase().includes(term) ||
          (o.phone || '').includes(term) ||
          (o.id || '').toLowerCase().includes(term)
      );
    }

    return NextResponse.json({ orders: filteredOrders });
  } catch (error) {
    console.error('Admin Orders GET Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    if (!(await isAuthenticated())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { orderId, paymentStatus, orderStatus } = await request.json();

    if (!orderId) {
      return NextResponse.json({ error: 'Order ID is required.' }, { status: 400 });
    }

    // Get current order data first
    const { data: order, error: fetchError } = await supabaseAdmin
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single();

    if (fetchError || !order) {
      return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
    }

    // Calculate Active states to see if we need to adjust stock
    // An order is active (takes stock) if it is not rejected and not cancelled
    const isOldActive = order.payment_status !== 'rejected' && order.order_status !== 'cancelled';
    const newPayStatus = paymentStatus || order.payment_status;
    const newOrdStatus = orderStatus || order.order_status;
    const isNewActive = newPayStatus !== 'rejected' && newOrdStatus !== 'cancelled';

    if (isOldActive && !isNewActive) {
      // Transition from active to inactive: Restore stock
      const deductions = getOrderCookieDeductions(order);
      for (const [key, qty] of Object.entries(deductions)) {
        if (qty > 0) {
          const { data: stockRow } = await supabaseAdmin
            .from('cookie_stock')
            .select('available_stock')
            .eq('flavor_key', key)
            .single();
          if (stockRow) {
            await supabaseAdmin
              .from('cookie_stock')
              .update({ available_stock: stockRow.available_stock + qty })
              .eq('flavor_key', key);
          }
        }
      }
    } else if (!isOldActive && isNewActive) {
      // Transition from inactive to active: Deduct stock after verification
      const deductions = getOrderCookieDeductions(order);
      
      // Verify stock availability first
      for (const [key, qty] of Object.entries(deductions)) {
        if (qty > 0) {
          const { data: stockRow } = await supabaseAdmin
            .from('cookie_stock')
            .select('available_stock, flavor_name')
            .eq('flavor_key', key)
            .single();
            
          if (!stockRow || stockRow.available_stock < qty) {
            return NextResponse.json(
              { error: `Insufficient stock for ${stockRow?.flavor_name || key} to reactivate this order. (Only ${stockRow?.available_stock || 0} left)` },
              { status: 400 }
            );
          }
        }
      }

      // Deduct stock
      for (const [key, qty] of Object.entries(deductions)) {
        if (qty > 0) {
          const { data: stockRow } = await supabaseAdmin
            .from('cookie_stock')
            .select('available_stock')
            .eq('flavor_key', key)
            .single();
          if (stockRow) {
            await supabaseAdmin
              .from('cookie_stock')
              .update({ available_stock: Math.max(0, stockRow.available_stock - qty) })
              .eq('flavor_key', key);
          }
        }
      }
    }

    const updates = {};
    if (paymentStatus) updates.payment_status = paymentStatus;
    if (orderStatus) updates.order_status = orderStatus;

    const { data: updatedOrder, error: updateError } = await supabaseAdmin
      .from('orders')
      .update(updates)
      .eq('id', orderId)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating order:', updateError);
      return NextResponse.json({ error: 'Failed to update order.' }, { status: 500 });
    }

    // Handle Email Notifications based on paymentStatus updates
    if (paymentStatus && paymentStatus !== order.payment_status) {
      const refId = orderId.substring(0, 8);
      
      if (paymentStatus === 'approved') {
        // Send payment approval confirmation
        await resend.emails.send({
          from: 'Cafe Esero <noreply@itsahmed.tech>',
          to: order.email,
          subject: `✅ Preorder Confirmed! - Ref: #${refId}`,
          html: `
            <div style="font-family: Arial, sans-serif; background-color: #faf6f0; padding: 40px; color: #4a2c11; max-width: 600px; margin: 0 auto; border: 1px solid #e6d3c0; border-radius: 12px;">
              <h2 style="color: #2e7d32; text-align: center; margin-bottom: 5px;">Payment Confirmed!</h2>
              <h3 style="color: #6d4c41; text-align: center; margin-top: 0; font-weight: normal;">Cafe Esero × Crumble Cookie</h3>
              <hr style="border: 0; border-top: 1px solid #e6d3c0; margin: 20px 0;"/>
              
              <p>Hi ${order.first_name},</p>
              <p>Great news! We have successfully verified your bank transfer payment of <strong>${order.total_amount.toLocaleString()} PKR</strong>.</p>
              <p>Your Crumble Cookie preorder is now <strong>officially confirmed</strong>! We are preparing the freshly baked cookies for you.</p>
              
              <div style="background-color: #ffffff; border: 1px solid #f0e2d5; border-radius: 8px; padding: 20px; margin: 20px 0;">
                <h4 style="color: #5d4037; margin-top: 0; margin-bottom: 10px; border-bottom: 1px dashed #e6d3c0; padding-bottom: 5px;">Preorder Reference Details</h4>
                <p style="font-size: 14px; margin: 5px 0;"><strong>Order ID:</strong> #${order.id}</p>
                <p style="font-size: 14px; margin: 5px 0;"><strong>Delivery Method:</strong> ${order.order_type.toUpperCase()}</p>
                <p style="font-size: 14px; margin: 5px 0;"><strong>Amount Paid:</strong> ${order.total_amount.toLocaleString()} PKR</p>
              </div>

              <div style="background-color: #e8f5e9; border-radius: 8px; padding: 15px; border-left: 4px solid #2e7d32; font-size: 14px; color: #1b5e20;">
                <p style="margin: 0; font-weight: bold;">What's Next?</p>
                <p style="margin: 5px 0 0 0;">For <strong>Dine-in/Takeaway</strong>, visit Cafe Esero and show this confirmation email to collect your cookies. For <strong>Delivery</strong>, sit back and relax—our rider will be on the way soon!</p>
              </div>

              <p style="font-size: 14px; margin-top: 25px; line-height: 1.5;">
                Thank you for choosing Cafe Esero!<br/>
                <strong>Cafe Esero Team</strong>
              </p>
            </div>
          `,
        });
      } else if (paymentStatus === 'rejected') {
        // Send payment rejection notification
        await resend.emails.send({
          from: 'Cafe Esero <noreply@itsahmed.tech>',
          to: order.email,
          subject: `❌ Preorder Payment Declined - Ref: #${refId}`,
          html: `
            <div style="font-family: Arial, sans-serif; background-color: #faf6f0; padding: 40px; color: #4a2c11; max-width: 600px; margin: 0 auto; border: 1px solid #e6d3c0; border-radius: 12px;">
              <h2 style="color: #c62828; text-align: center; margin-bottom: 5px;">Payment Verification Failed</h2>
              <h3 style="color: #6d4c41; text-align: center; margin-top: 0; font-weight: normal;">Cafe Esero × Crumble Cookie</h3>
              <hr style="border: 0; border-top: 1px solid #e6d3c0; margin: 20px 0;"/>
              
              <p>Hi ${order.first_name},</p>
              <p>We were unable to verify your bank transfer payment of <strong>${order.total_amount.toLocaleString()} PKR</strong> for your cookie preorder (Ref: #${refId}).</p>
              
              <div style="background-color: #ffebee; border-radius: 8px; padding: 15px; border-left: 4px solid #c62828; font-size: 14px; color: #b71c1c; margin: 20px 0;">
                <p style="margin: 0; font-weight: bold;">Reason for Decline:</p>
                <p style="margin: 5px 0 0 0;">The transfer screenshot uploaded could not be verified on our bank account statements, or the image was blurry or incomplete.</p>
              </div>

              <p style="font-weight: bold; color: #4e342e;">How to resolve this:</p>
              <ol style="font-size: 14px; line-height: 1.6; color: #4e342e;">
                <li>Verify that you transferred the exact amount (<strong>${order.total_amount.toLocaleString()} PKR</strong>) to the correct account:
                  <ul style="margin: 5px 0;">
                    <li>Bank: United Bank Limited</li>
                    <li>Account Title: Shahrez Naeem Memon</li>
                    <li>Account Number: 1284358920124</li>
                  </ul>
                </li>
                <li>Please reply directly to this email with a clear, full screenshot of your successful transaction slip showing the date, amount, and reference number.</li>
              </ol>

              <p style="font-size: 14px; margin-top: 25px; line-height: 1.5;">
                If you have any questions or need support, feel free to contact us.<br/>
                <strong>Cafe Esero Team</strong>
              </p>
            </div>
          `,
        });
      }
    }

    return NextResponse.json({ success: true, order: updatedOrder });
  } catch (error) {
    console.error('Admin Orders PUT Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// Helper function to extract individual cookie counts from an order (including bundles)
function getOrderCookieDeductions(o) {
  const deductions = {
    classic_chocolate_chip: o.classic_chocolate_chip_qty || 0,
    double_chocolate: o.double_chocolate_qty || 0,
    chocolate_chip_walnut: o.chocolate_chip_walnut_qty || 0,
    cookies_cream: o.cookies_cream_qty || 0,
    kunafa_chocolate: o.kunafa_chocolate_qty || 0,
    hazelnut_filled: o.hazelnut_filled_qty || 0,
    lotus_lava: o.lotus_lava_qty || 0,
  };

  const mapFriendlyToKey = (name) => {
    const n = name.trim().toLowerCase();
    if (n.includes('walnut')) return 'chocolate_chip_walnut';
    if (n.includes('classic') || n.includes('chip')) return 'classic_chocolate_chip';
    if (n.includes('double')) return 'double_chocolate';
    if (n.includes('cream')) return 'cookies_cream';
    if (n.includes('kunafa')) return 'kunafa_chocolate';
    if (n.includes('hazelnut')) return 'hazelnut_filled';
    if (n.includes('lotus') || n.includes('lava')) return 'lotus_lava';
    return null;
  };

  if (o.classic_bundle_qty > 0 && o.classic_bundle_flavours) {
    o.classic_bundle_flavours.split(',').forEach((flv) => {
      const key = mapFriendlyToKey(flv);
      if (key) deductions[key] = (deductions[key] || 0) + o.classic_bundle_qty;
    });
  }

  if (o.premium_bundle_qty > 0 && o.premium_bundle_flavours) {
    o.premium_bundle_flavours.split(',').forEach((flv) => {
      const key = mapFriendlyToKey(flv);
      if (key) deductions[key] = (deductions[key] || 0) + o.premium_bundle_qty;
    });
  }

  return deductions;
}
