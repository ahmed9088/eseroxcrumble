import { resend } from '../../../../lib/resend';
import { supabaseAdmin } from '../../../../lib/supabase';
import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const formData = await request.formData();

    // Extract customer information
    const firstName = formData.get('firstName');
    const lastName = formData.get('lastName');
    const email = formData.get('email');
    const phone = formData.get('phone');
    const orderType = formData.get('orderType');

    // Extract address information
    const deliveryStreet = formData.get('deliveryStreet') || null;
    const deliveryStreet2 = formData.get('deliveryStreet2') || null;
    const deliveryCity = formData.get('deliveryCity') || null;
    const deliveryState = formData.get('deliveryState') || null;
    const deliveryZip = formData.get('deliveryZip') || null;
    const deliveryLandmark = formData.get('deliveryLandmark') || null;

    // Extract quantities for standard cookies
    const classicChocolateChipQty = parseInt(formData.get('classicChocolateChipQty') || '0', 10);
    const doubleChocolateQty = parseInt(formData.get('doubleChocolateQty') || '0', 10);
    const chocolateChipWalnutQty = parseInt(formData.get('chocolateChipWalnutQty') || '0', 10);
    const cookiesCreamQty = parseInt(formData.get('cookiesCreamQty') || '0', 10);
    const kunafaChocolateQty = parseInt(formData.get('kunafaChocolateQty') || '0', 10);
    const hazelnutFilledQty = parseInt(formData.get('hazelnutFilledQty') || '0', 10);
    const lotusLavaQty = parseInt(formData.get('lotusLavaQty') || '0', 10);
    const classicBundleQty = parseInt(formData.get('classicBundleQty') || '0', 10);
    const classicBundleFlavours = formData.get('classicBundleFlavours') || null;
    const premiumBundleQty = parseInt(formData.get('premiumBundleQty') || '0', 10);
    const premiumBundleFlavours = formData.get('premiumBundleFlavours') || null;

    // Extract dynamic items JSON if provided
    let dynamicItems = {};
    const itemsJsonRaw = formData.get('itemsJson');
    if (itemsJsonRaw) {
      try {
        dynamicItems = JSON.parse(itemsJsonRaw);
      } catch (e) {
        console.warn('Failed to parse itemsJson:', e);
      }
    }

    // Extract total amount & payment proof file
    const totalAmount = parseFloat(formData.get('totalAmount') || '0');
    const paymentProof = formData.get('paymentProof');

    // 1. Basic validation
    if (!firstName || !lastName || !email || !phone || !orderType || !paymentProof) {
      return NextResponse.json(
        { error: 'Required fields are missing. Please complete the form and upload payment proof.' },
        { status: 400 }
      );
    }

    if (orderType === 'delivery' && (!deliveryStreet || !deliveryCity || !deliveryState)) {
      return NextResponse.json(
        { error: 'Please enter a complete delivery address.' },
        { status: 400 }
      );
    }

    // Check if selected order type (delivery / takeaway) is currently allowed by admin
    const { data: settingsRow } = await supabaseAdmin
      .from('settings')
      .select('value')
      .eq('key', 'order_settings')
      .single();

    const isDeliveryEnabled = settingsRow?.value?.isDeliveryEnabled ?? true;
    const isPickupEnabled = settingsRow?.value?.isPickupEnabled ?? true;

    if (orderType === 'delivery' && !isDeliveryEnabled) {
      return NextResponse.json(
        { error: 'Delivery preorders are currently closed by admin. Please select Takeaway or try again later.' },
        { status: 400 }
      );
    }

    if (orderType === 'takeaway' && !isPickupEnabled) {
      return NextResponse.json(
        { error: 'Pickup / Takeaway preorders are currently closed by admin. Please select Delivery or try again later.' },
        { status: 400 }
      );
    }

    // 2. Email verification check
    const cleanEmail = email.trim().toLowerCase();

    const { data: existingOrders } = await supabaseAdmin
      .from('orders')
      .select('id')
      .ilike('email', cleanEmail)
      .limit(1);

    const { data: verification } = await supabaseAdmin
      .from('email_verifications')
      .select('id')
      .ilike('email', cleanEmail)
      .eq('verified', true)
      .limit(1);

    const isVerifiedCustomer = (existingOrders && existingOrders.length > 0) || (verification && verification.length > 0);

    if (!isVerifiedCustomer) {
      return NextResponse.json(
        { error: 'Email verification is required. Please verify your email first.' },
        { status: 400 }
      );
    }

    // Fetch active batch name
    let activeBatchName = 'Pre-Order 1';
    try {
      const { data: bData } = await supabaseAdmin
        .from('settings')
        .select('value')
        .eq('key', 'preorder_batches')
        .single();
      if (bData && bData.value) {
        const active = (bData.value.batches || []).find((b) => b.id === bData.value.activeBatchId);
        if (active) activeBatchName = active.name;
      }
    } catch (bErr) {
      // default to Pre-Order 1
    }

    // 3. Calculate stock deductions
    const deductions = {
      classic_chocolate_chip: classicChocolateChipQty,
      double_chocolate: doubleChocolateQty,
      chocolate_chip_walnut: chocolateChipWalnutQty,
      cookies_cream: cookiesCreamQty,
      kunafa_chocolate: kunafaChocolateQty,
      hazelnut_filled: hazelnutFilledQty,
      lotus_lava: lotusLavaQty,
      ...dynamicItems,
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

    if (classicBundleQty > 0 && classicBundleFlavours) {
      classicBundleFlavours.split(',').forEach((flv) => {
        const key = mapFriendlyToKey(flv);
        if (key) deductions[key] = (deductions[key] || 0) + classicBundleQty;
      });
    }

    if (premiumBundleQty > 0 && premiumBundleFlavours) {
      premiumBundleFlavours.split(',').forEach((flv) => {
        const key = mapFriendlyToKey(flv);
        if (key) deductions[key] = (deductions[key] || 0) + premiumBundleQty;
      });
    }

    // 4. Upload payment proof to Supabase Storage
    const fileExtension = paymentProof.name.split('.').pop() || 'png';
    const timestamp = Date.now();
    const safeEmailFilename = email.replace(/[^a-zA-Z0-9]/g, '_');
    const fileName = `${timestamp}_${safeEmailFilename}.${fileExtension}`;
    const fileBuffer = Buffer.from(await paymentProof.arrayBuffer());

    const { error: uploadError } = await supabaseAdmin.storage
      .from('payment-proofs')
      .upload(fileName, fileBuffer, {
        contentType: paymentProof.type,
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) {
      console.error('File upload error to Supabase:', uploadError);
      return NextResponse.json(
        { error: 'Failed to upload payment proof. Please try again.' },
        { status: 500 }
      );
    }

    const { data: publicUrlData } = supabaseAdmin.storage
      .from('payment-proofs')
      .getPublicUrl(fileName);

    const paymentProofUrl = publicUrlData.publicUrl;

    // 5. Save order details in DB and deduct stock inside a transaction or direct fallback
    let rpcResult = null;
    let orderError = null;

    try {
      const res = await supabaseAdmin.rpc('place_order_with_stock', {
        p_first_name: firstName,
        p_last_name: lastName,
        p_email: email,
        p_phone: phone,
        p_order_type: orderType,
        p_delivery_street: orderType === 'delivery' ? deliveryStreet : null,
        p_delivery_street2: orderType === 'delivery' ? deliveryStreet2 : null,
        p_delivery_city: orderType === 'delivery' ? deliveryCity : null,
        p_delivery_state: orderType === 'delivery' ? deliveryState : null,
        p_delivery_zip: orderType === 'delivery' ? deliveryZip : null,
        p_delivery_landmark: orderType === 'delivery' ? deliveryLandmark : null,
        p_classic_chocolate_chip_qty: classicChocolateChipQty,
        p_double_chocolate_qty: doubleChocolateQty,
        p_chocolate_chip_walnut_qty: chocolateChipWalnutQty,
        p_cookies_cream_qty: cookiesCreamQty,
        p_kunafa_chocolate_qty: kunafaChocolateQty,
        p_hazelnut_filled_qty: hazelnutFilledQty,
        p_lotus_lava_qty: lotusLavaQty,
        p_classic_bundle_qty: classicBundleQty,
        p_classic_bundle_flavours: classicBundleQty > 0 ? classicBundleFlavours : null,
        p_premium_bundle_qty: premiumBundleQty,
        p_premium_bundle_flavours: premiumBundleQty > 0 ? premiumBundleFlavours : null,
        p_total_amount: totalAmount,
        p_payment_proof_url: paymentProofUrl,
        p_deductions: deductions,
      });
      rpcResult = res.data;
      orderError = res.error;
    } catch (e) {
      orderError = e;
    }

    let orderId = rpcResult?.order_id;

    // Direct fallback if RPC failed (e.g. if custom menu items are present or RPC not installed)
    if (!orderId || orderError || !rpcResult?.success) {
      // Validate and deduct stock directly
      for (const [key, qty] of Object.entries(deductions)) {
        if (qty > 0) {
          const { data: stockRow } = await supabaseAdmin
            .from('cookie_stock')
            .select('available_stock, flavor_name')
            .eq('flavor_key', key)
            .single();

          if (stockRow && stockRow.available_stock < qty) {
            return NextResponse.json(
              { error: `Sorry, we are out of stock for ${stockRow.flavor_name}! (Requested ${qty}, only ${stockRow.available_stock} left)` },
              { status: 400 }
            );
          }
        }
      }

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

      const orderData = {
        first_name: firstName,
        last_name: lastName,
        email,
        phone,
        order_type: orderType,
        delivery_street: orderType === 'delivery' ? deliveryStreet : null,
        delivery_street2: orderType === 'delivery' ? deliveryStreet2 : null,
        delivery_city: orderType === 'delivery' ? deliveryCity : null,
        delivery_state: orderType === 'delivery' ? deliveryState : null,
        delivery_zip: orderType === 'delivery' ? deliveryZip : null,
        delivery_landmark: orderType === 'delivery' ? deliveryLandmark : null,
        classic_chocolate_chip_qty: classicChocolateChipQty,
        double_chocolate_qty: doubleChocolateQty,
        chocolate_chip_walnut_qty: chocolateChipWalnutQty,
        cookies_cream_qty: cookiesCreamQty,
        kunafa_chocolate_qty: kunafaChocolateQty,
        hazelnut_filled_qty: hazelnutFilledQty,
        lotus_lava_qty: lotusLavaQty,
        classic_bundle_qty: classicBundleQty,
        classic_bundle_flavours: classicBundleQty > 0 ? classicBundleFlavours : null,
        premium_bundle_qty: premiumBundleQty,
        premium_bundle_flavours: premiumBundleQty > 0 ? premiumBundleFlavours : null,
        total_amount: totalAmount,
        payment_proof_url: paymentProofUrl,
        payment_status: 'pending',
        order_status: 'received',
      };

      let insRes = await supabaseAdmin.from('orders').insert({ ...orderData, batch_name: activeBatchName }).select('id').single();
      if (insRes.error && insRes.error.message?.includes('batch_name')) {
        insRes = await supabaseAdmin.from('orders').insert(orderData).select('id').single();
      }

      if (insRes.error) {
        console.error('Direct order insert error:', insRes.error);
        return NextResponse.json({ error: 'Failed to submit preorder. Database error.' }, { status: 500 });
      }
      orderId = insRes.data?.id;
    } else {
      // Update batch_name if RPC succeeded
      try {
        await supabaseAdmin.from('orders').update({ batch_name: activeBatchName }).eq('id', orderId);
      } catch (err) {
        // ignore
      }
    }

    // 6. Ensure email verification record is kept
    await supabaseAdmin
      .from('email_verifications')
      .update({ verified: true })
      .ilike('email', email);

    // 7. Send "Order Received" confirmation email to user
    const itemsList = [];
    if (classicChocolateChipQty > 0) itemsList.push(`<li>Classic Chocolate Chip x ${classicChocolateChipQty} (${classicChocolateChipQty * 580} PKR)</li>`);
    if (doubleChocolateQty > 0) itemsList.push(`<li>Double Chocolate x ${doubleChocolateQty} (${doubleChocolateQty * 580} PKR)</li>`);
    if (chocolateChipWalnutQty > 0) itemsList.push(`<li>Chocolate Chip Walnut x ${chocolateChipWalnutQty} (${chocolateChipWalnutQty * 580} PKR)</li>`);
    if (cookiesCreamQty > 0) itemsList.push(`<li>Cookies & Cream x ${cookiesCreamQty} (${cookiesCreamQty * 620} PKR)</li>`);
    if (kunafaChocolateQty > 0) itemsList.push(`<li>Kunafa Chocolate x ${kunafaChocolateQty} (${kunafaChocolateQty * 620} PKR)</li>`);
    if (hazelnutFilledQty > 0) itemsList.push(`<li>Hazelnut Filled x ${hazelnutFilledQty} (${hazelnutFilledQty * 620} PKR)</li>`);
    if (lotusLavaQty > 0) itemsList.push(`<li>Lotus Lava x ${lotusLavaQty} (${lotusLavaQty * 620} PKR)</li>`);

    // Add any dynamic items
    for (const [dKey, dQty] of Object.entries(dynamicItems)) {
      if (dQty > 0 && !['classic_chocolate_chip', 'double_chocolate', 'chocolate_chip_walnut', 'cookies_cream', 'kunafa_chocolate', 'hazelnut_filled', 'lotus_lava', 'classic_bundle', 'premium_bundle'].includes(dKey)) {
        itemsList.push(`<li>${dKey.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())} x ${dQty}</li>`);
      }
    }

    if (classicBundleQty > 0) itemsList.push(`<li>Classic Bundle (pack of 4) x ${classicBundleQty} (${classicBundleQty * 2200} PKR)<br/><small style="color: #666;">Flavours: ${classicBundleFlavours}</small></li>`);
    if (premiumBundleQty > 0) itemsList.push(`<li>Premium Bundle (pack of 4) x ${premiumBundleQty} (${premiumBundleQty * 2400} PKR)<br/><small style="color: #666;">Flavours: ${premiumBundleFlavours}</small></li>`);

    try {
      await resend.emails.send({
        from: 'Cafe Esero <noreply@itsahmed.tech>',
        to: email,
        subject: `🍪 Preorder Received! - Ref: #${orderId.substring(0, 8)} (${activeBatchName})`,
        html: `
          <div style="font-family: Arial, sans-serif; background-color: #faf6f0; padding: 40px; color: #4a2c11; max-width: 600px; margin: 0 auto; border: 1px solid #e6d3c0; border-radius: 12px;">
            <h2 style="color: #6d4c41; text-align: center; margin-bottom: 5px;">Cafe Esero × Crumble Cookie</h2>
            <p style="color: #8d6e63; font-style: italic; text-align: center; margin-top: 0;">Your preorder has been recorded for <strong>${activeBatchName}</strong>!</p>
            <hr style="border: 0; border-top: 1px solid #e6d3c0; margin: 20px 0;"/>
            
            <p>Hi ${firstName} ${lastName},</p>
            <p>Thank you for placing your Crumble Cookie preorder with Cafe Esero! We have received your preorder details and your payment receipt.</p>
            
            <div style="background-color: #ffffff; border: 1px solid #f0e2d5; border-radius: 8px; padding: 20px; margin: 20px 0;">
              <h3 style="color: #5d4037; margin-top: 0;">Order Summary</h3>
              <p style="font-size: 14px; margin: 5px 0;"><strong>Order ID:</strong> #${orderId.substring(0, 8).toUpperCase()}</p>
              <p style="font-size: 14px; margin: 5px 0;"><strong>Preorder Round:</strong> ${activeBatchName}</p>
              <p style="font-size: 14px; margin: 5px 0;"><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
              <p style="font-size: 14px; margin: 5px 0;"><strong>Delivery Mode:</strong> ${orderType.toUpperCase()}</p>
              ${orderType === 'delivery' ? `<p style="font-size: 14px; margin: 5px 0;"><strong>Address:</strong> ${deliveryStreet}, ${deliveryCity}</p>` : ''}
              
              <h4 style="color: #5d4037; border-bottom: 1px dashed #e6d3c0; padding-bottom: 5px; margin-bottom: 10px;">Items Ordered</h4>
              <ul style="padding-left: 20px; font-size: 14px; line-height: 1.6; margin: 0;">
                ${itemsList.join('')}
              </ul>
              <p style="font-size: 16px; font-weight: bold; margin-top: 15px; margin-bottom: 0; text-align: right; color: #3e2723;">
                Total Paid: ${totalAmount.toLocaleString()} PKR
              </p>
            </div>

            <div style="background-color: #efebe9; border-radius: 8px; padding: 15px; border-left: 4px solid #8d6e63; font-size: 14px;">
              <p style="margin: 0; font-weight: bold; color: #4e342e;">Payment Status: PENDING VERIFICATION</p>
              <p style="margin: 5px 0 0 0; color: #5d4037;">Our admin team is currently verifying your payment transfer screenshot. You will receive another email as soon as your preorder is officially approved and confirmed!</p>
            </div>

            <p style="font-size: 14px; margin-top: 25px; line-height: 1.5;">
              Warm regards,<br/>
              <strong>Cafe Esero Team</strong>
            </p>
          </div>
        `,
      });
    } catch (mailError) {
      console.warn('Confirmation email sending warning:', mailError);
    }

    return NextResponse.json({ success: true, orderId: orderId }, { status: 201 });
  } catch (error) {
    console.error('Preorder Submit route error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred while placing your preorder.' },
      { status: 500 }
    );
  }
}
