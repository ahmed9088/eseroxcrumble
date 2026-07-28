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

    // Extract quantities
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

    // 2. Email verification check
    // Query if this email was verified in the email_verifications table
    const { data: verification, error: verifyError } = await supabaseAdmin
      .from('email_verifications')
      .select('*')
      .eq('email', email)
      .eq('verified', true)
      .limit(1);

    if (verifyError || !verification || verification.length === 0) {
      return NextResponse.json(
        { error: 'Email verification is required. Please verify your email first.' },
        { status: 400 }
      );
    }

    // 3. Calculate stock deductions (combining individual and bundle cookie selections)
    const deductions = {
      classic_chocolate_chip: classicChocolateChipQty,
      double_chocolate: doubleChocolateQty,
      chocolate_chip_walnut: chocolateChipWalnutQty,
      cookies_cream: cookiesCreamQty,
      kunafa_chocolate: kunafaChocolateQty,
      hazelnut_filled: hazelnutFilledQty,
      lotus_lava: lotusLavaQty
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
      classicBundleFlavours.split(',').forEach(flv => {
        const key = mapFriendlyToKey(flv);
        if (key) deductions[key] = (deductions[key] || 0) + classicBundleQty;
      });
    }

    if (premiumBundleQty > 0 && premiumBundleFlavours) {
      premiumBundleFlavours.split(',').forEach(flv => {
        const key = mapFriendlyToKey(flv);
        if (key) deductions[key] = (deductions[key] || 0) + premiumBundleQty;
      });
    }

    // 4. Upload payment proof to Supabase Storage
    const fileExtension = paymentProof.name.split('.').pop() || 'png';
    const timestamp = Date.now();
    const cleanEmail = email.replace(/[^a-zA-Z0-9]/g, '_');
    const fileName = `${timestamp}_${cleanEmail}.${fileExtension}`;
    const fileBuffer = Buffer.from(await paymentProof.arrayBuffer());

    // Upload to 'payment-proofs' bucket
    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
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

    // Get Public URL
    const { data: publicUrlData } = supabaseAdmin.storage
      .from('payment-proofs')
      .getPublicUrl(fileName);

    const paymentProofUrl = publicUrlData.publicUrl;

    // 5. Save order details in DB and deduct stock inside a transaction
    const { data: rpcResult, error: orderError } = await supabaseAdmin.rpc('place_order_with_stock', {
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
      p_deductions: deductions
    });

    if (orderError || !rpcResult || !rpcResult.success) {
      const errMsg = orderError?.message || rpcResult?.error || 'Database error processing order.';
      console.error('Order creation via RPC error:', orderError, rpcResult);
      return NextResponse.json(
        { error: errMsg.includes('out of stock') ? errMsg : 'Failed to submit preorder. Stock validation failed or database error.' },
        { status: 500 }
      );
    }

    const orderId = rpcResult.order_id;

    // 6. Delete the OTP verification row now that the preorder is successfully submitted
    await supabaseAdmin
      .from('email_verifications')
      .delete()
      .eq('email', email);

    // 7. Send "Order Received" confirmation email to user
    const itemsList = [];
    if (classicChocolateChipQty > 0) itemsList.push(`<li>Classic Chocolate Chip x ${classicChocolateChipQty} (${classicChocolateChipQty * 580} PKR)</li>`);
    if (doubleChocolateQty > 0) itemsList.push(`<li>Double Chocolate x ${doubleChocolateQty} (${doubleChocolateQty * 580} PKR)</li>`);
    if (chocolateChipWalnutQty > 0) itemsList.push(`<li>Chocolate Chip Walnut x ${chocolateChipWalnutQty} (${chocolateChipWalnutQty * 580} PKR)</li>`);
    if (cookiesCreamQty > 0) itemsList.push(`<li>Cookies & Cream x ${cookiesCreamQty} (${cookiesCreamQty * 620} PKR)</li>`);
    if (kunafaChocolateQty > 0) itemsList.push(`<li>Kunafa Chocolate x ${kunafaChocolateQty} (${kunafaChocolateQty * 620} PKR)</li>`);
    if (hazelnutFilledQty > 0) itemsList.push(`<li>Hazelnut Filled x ${hazelnutFilledQty} (${hazelnutFilledQty * 620} PKR)</li>`);
    if (lotusLavaQty > 0) itemsList.push(`<li>Lotus Lava x ${lotusLavaQty} (${lotusLavaQty * 620} PKR)</li>`);
    if (classicBundleQty > 0) itemsList.push(`<li>Classic Bundle (pack of 4) x ${classicBundleQty} (${classicBundleQty * 2200} PKR)<br/><small style="color: #666;">Flavours: ${classicBundleFlavours}</small></li>`);
    if (premiumBundleQty > 0) itemsList.push(`<li>Premium Bundle (pack of 4) x ${premiumBundleQty} (${premiumBundleQty * 2400} PKR)<br/><small style="color: #666;">Flavours: ${premiumBundleFlavours}</small></li>`);

    const { error: mailError } = await resend.emails.send({
      from: 'Cafe Esero <noreply@itsahmed.tech>',
      to: email,
      subject: `🍪 Preorder Received! - Ref: #${orderId.substring(0, 8)}`,
      html: `
        <div style="font-family: Arial, sans-serif; background-color: #faf6f0; padding: 40px; color: #4a2c11; max-width: 600px; margin: 0 auto; border: 1px solid #e6d3c0; border-radius: 12px;">
          <h2 style="color: #6d4c41; text-align: center; margin-bottom: 5px;">Cafe Esero × Crumble Cookie</h2>
          <p style="color: #8d6e63; font-style: italic; text-align: center; margin-top: 0;">Your preorder has been recorded!</p>
          <hr style="border: 0; border-top: 1px solid #e6d3c0; margin: 20px 0;"/>
          
          <p>Hi ${firstName} ${lastName},</p>
          <p>Thank you for placing your Crumble Cookie preorder with Cafe Esero! We have received your preorder details and your payment receipt.</p>
          
          <div style="background-color: #ffffff; border: 1px solid #f0e2d5; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <h3 style="color: #5d4037; margin-top: 0;">Order Summary</h3>
            <p style="font-size: 14px; margin: 5px 0;"><strong>Order ID:</strong> #${orderId.substring(0, 8).toUpperCase()}</p>
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

    if (mailError) {
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
