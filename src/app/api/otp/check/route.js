import { supabaseAdmin } from '../../../../lib/supabase';
import { NextResponse } from 'next/server';

// In-memory fallback store
global.__otpMemoryStore = global.__otpMemoryStore || new Map();

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

    // 0. Check in-memory store
    const memEntry = global.__otpMemoryStore.get(cleanEmail);
    if (memEntry && memEntry.verified) {
      return NextResponse.json({
        isVerified: true,
        isExistingCustomer: false,
        message: 'Your email is verified! Form unlocked.',
      });
    }

    // 1. Check if customer placed a previous order
    try {
      const { data: existingOrders } = await supabaseAdmin
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
    } catch (ordErr) {
      console.warn('[OTP Check] Orders lookup warning:', ordErr);
    }

    // 2. Check if email was verified in email_verifications table
    try {
      const { data: verifications } = await supabaseAdmin
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
    } catch (verErr) {
      console.warn('[OTP Check] Verification lookup warning:', verErr);
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

