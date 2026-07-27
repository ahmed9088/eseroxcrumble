import { supabaseAdmin } from '../../../../lib/supabase';
import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const { phone, code } = await request.json();

    if (!phone || !code) {
      return NextResponse.json(
        { error: 'Mobile/WhatsApp number and verification code are required.' },
        { status: 400 }
      );
    }

    // Clean phone number (keep only digits)
    const cleanPhone = phone.replace(/\D/g, '');

    // Lookup code in database
    const { data: verifications, error: dbError } = await supabaseAdmin
      .from('phone_verifications')
      .select('*')
      .eq('phone', cleanPhone)
      .eq('code', code)
      .order('created_at', { ascending: false })
      .limit(1);

    if (dbError) {
      console.error('Database query error on phone OTP verify:', dbError);
      return NextResponse.json(
        { error: 'Verification failed due to database error.' },
        { status: 500 }
      );
    }

    if (!verifications || verifications.length === 0) {
      return NextResponse.json(
        { error: 'Invalid verification code. Please check and try again.' },
        { status: 400 }
      );
    }

    const verification = verifications[0];

    // Check expiration
    const expiry = new Date(verification.expires_at);
    if (expiry < new Date()) {
      return NextResponse.json(
        { error: 'Verification code has expired. Please request a new code.' },
        { status: 400 }
      );
    }

    // Mark as verified
    const { error: updateError } = await supabaseAdmin
      .from('phone_verifications')
      .update({ verified: true })
      .eq('id', verification.id);

    if (updateError) {
      console.error('Error marking phone as verified:', updateError);
      return NextResponse.json(
        { error: 'Failed to complete verification. Please try again.' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, message: 'Phone number verified successfully.' });
  } catch (error) {
    console.error('OTP Verify route error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred during verification.' },
      { status: 500 }
    );
  }
}
