import { supabaseAdmin } from '../../../../lib/supabase';
import { NextResponse } from 'next/server';

// GET /api/otp/check?email=...
// Checks if an email is already verified (either placed a previous order OR verified via OTP)
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');

    if (!email || !email.includes('@')) {
      return NextResponse.json({ isVerified: false, error: 'Valid email required' }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();

    // 1. Check if customer placed a previous order
    const { data: existingOrders, error: orderError } = await supabaseAdmin
      .from('orders')
      .select('id')
      .ilike('email', cleanEmail)
      .limit(1);

    if (existingOrders && existingOrders.length > 0) {
      return NextResponse.json({
        isVerified: true,
        isExistingCustomer: true,
        message: 'You are a verified returning customer! Form unlocked.',
      });
    }

    // 2. Check if email was verified in email_verifications table
    const { data: verifications, error: verifyError } = await supabaseAdmin
      .from('email_verifications')
      .select('id')
      .ilike('email', cleanEmail)
      .eq('verified', true)
      .limit(1);

    if (verifications && verifications.length > 0) {
      return NextResponse.json({
        isVerified: true,
        isExistingCustomer: false,
        message: 'Your email is already verified! Form unlocked.',
      });
    }

    return NextResponse.json({
      isVerified: false,
      isExistingCustomer: false,
      message: 'Email verification is required.',
    });
  } catch (err) {
    console.error('OTP Check error:', err);
    return NextResponse.json({ isVerified: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
