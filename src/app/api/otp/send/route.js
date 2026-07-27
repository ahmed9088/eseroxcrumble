import { sendPhoneOTP } from '../../../../lib/otpService';
import { supabaseAdmin } from '../../../../lib/supabase';
import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const { phone } = await request.json();

    if (!phone) {
      return NextResponse.json(
        { error: 'Please enter a valid mobile or WhatsApp number.' },
        { status: 400 }
      );
    }

    // Clean phone number (keep only digits)
    const cleanPhone = phone.replace(/\D/g, '');

    // Validate length (typical phone numbers are 10 to 15 digits)
    if (cleanPhone.length < 10 || cleanPhone.length > 15) {
      return NextResponse.json(
        { error: 'Please enter a valid mobile or WhatsApp number with 10-15 digits.' },
        { status: 400 }
      );
    }

    // Generate 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes expiration

    // Delete any old OTPs for this phone to prevent database bloat
    await supabaseAdmin
      .from('phone_verifications')
      .delete()
      .eq('phone', cleanPhone);

    // Save new verification code
    const { error: dbError } = await supabaseAdmin
      .from('phone_verifications')
      .insert({
        phone: cleanPhone,
        code,
        expires_at: expiresAt.toISOString(),
        verified: false,
      });

    if (dbError) {
      console.error('Database error saving phone OTP:', dbError);
      return NextResponse.json(
        { error: 'Failed to generate verification code. Please try again.' },
        { status: 500 }
      );
    }

    // Send OTP using the OTP service (console sandbox by default, or WhatsApp/SMS if keys are configured)
    const sendResult = await sendPhoneOTP(phone, code);

    if (!sendResult.success) {
      return NextResponse.json(
        { error: sendResult.error || 'Failed to send verification code. Please try again.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Verification code sent successfully.',
      // In development sandbox mode, output a devHint to make testing easy
      ...(process.env.NODE_ENV !== 'production' && sendResult.provider === 'sandbox'
        ? { devHint: `[Sandbox Mode] OTP code is: ${code} (also printed in terminal console)` }
        : {})
    });
  } catch (error) {
    console.error('OTP Send route error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred while sending OTP.' },
      { status: 500 }
    );
  }
}
