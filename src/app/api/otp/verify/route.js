import { supabaseAdmin } from '../../../../lib/supabase';
import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const { email, code } = await request.json();

    if (!email || !code) {
      return NextResponse.json(
        { error: 'Email and verification code are required.' },
        { status: 400 }
      );
    }

    // Lookup code in database
    const { data: verifications, error: dbError } = await supabaseAdmin
      .from('email_verifications')
      .select('*')
      .eq('email', email)
      .eq('code', code)
      .order('created_at', { ascending: false })
      .limit(1);

    if (dbError) {
      console.error('Database query error on OTP verify:', dbError);
      return NextResponse.json(
        { error: 'Verification failed. Database error.' },
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
      .from('email_verifications')
      .update({ verified: true })
      .eq('id', verification.id);

    if (updateError) {
      console.error('Error marking code as verified:', updateError);
      return NextResponse.json(
        { error: 'Failed to complete verification. Please try again.' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, message: 'Email verified successfully.' });
  } catch (error) {
    console.error('OTP Verify route error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred.' },
      { status: 500 }
    );
  }
}
