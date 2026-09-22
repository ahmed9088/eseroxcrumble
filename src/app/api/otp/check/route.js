import { cookies } from 'next/headers';
import { supabaseAdmin } from '../../../../lib/supabase';
import { getCustomerSession } from '../../../../lib/session';
import { NextResponse } from 'next/server';

// GET /api/otp/check?email=...
// Checks if the CURRENT BROWSER has a verified customer session matching this email
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');

    if (!email || !email.includes('@')) {
      return NextResponse.json({ isVerified: false, error: 'Valid email required' }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();

    // 1. Check HTTP-only Customer Session Cookie for this browser
    const cookieStore = await cookies();
    const session = await getCustomerSession(cookieStore);

    if (session && session.email === cleanEmail) {
      return NextResponse.json({
        isVerified: true,
        email: session.email,
        isExistingCustomer: true,
        message: 'Active verified session! Form unlocked.',
      });
    }

    // 2. Check if this email has past orders to give friendly prompt
    let hasPastOrders = false;
    try {
      const { data: existingOrders } = await supabaseAdmin
        .from('orders')
        .select('id')
        .ilike('email', cleanEmail)
        .limit(1);

      if (existingOrders && existingOrders.length > 0) {
        hasPastOrders = true;
      }
    } catch (ordErr) {
      // Ignore
    }

    return NextResponse.json({
      isVerified: false,
      requiresOtp: true,
      isExistingCustomer: hasPastOrders,
      message: hasPastOrders
        ? 'Welcome back! For your security, please verify the 6-digit code sent to your email.'
        : 'Email verification is required.',
    });
  } catch (err) {
    console.error('OTP Check error:', err);
    return NextResponse.json({ isVerified: false, error: 'Internal Server Error' }, { status: 500 });
  }
}

