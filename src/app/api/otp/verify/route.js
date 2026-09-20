import { supabaseAdmin } from '../../../../lib/supabase';
import { NextResponse } from 'next/server';

// In-memory fallback store
global.__otpMemoryStore = global.__otpMemoryStore || new Map();

export async function POST(request) {
  try {
    const { email, code } = await request.json();

    if (!email || !code) {
      return NextResponse.json(
        { error: 'Email and verification code are required.' },
        { status: 400 }
      );
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanCode = String(code).trim();

    // 1. Check in-memory store first
    const memEntry = global.__otpMemoryStore.get(cleanEmail);
    if (memEntry && memEntry.code === cleanCode) {
      if (Date.now() > memEntry.expiresAt) {
        global.__otpMemoryStore.delete(cleanEmail);
        return NextResponse.json(
          { error: 'Verification code has expired. Please request a new code.' },
          { status: 400 }
        );
      }
      memEntry.verified = true;
      global.__otpMemoryStore.set(cleanEmail, memEntry);

      // Also try to mark verified in Supabase in background
      try {
        await supabaseAdmin
          .from('email_verifications')
          .update({ verified: true })
          .ilike('email', cleanEmail)
          .eq('code', cleanCode);
      } catch (e) {
        // Silent
      }

      return NextResponse.json({ success: true, message: 'Email verified successfully.' });
    }

    // 2. Lookup code in Supabase database
    try {
      const { data: verifications, error: dbError } = await supabaseAdmin
        .from('email_verifications')
        .select('*')
        .ilike('email', cleanEmail)
        .eq('code', cleanCode)
        .order('created_at', { ascending: false })
        .limit(1);

      if (dbError) {
        console.error('Database query error on OTP verify:', dbError);
      } else if (verifications && verifications.length > 0) {
        const verification = verifications[0];

        // Check expiration
        const expiry = new Date(verification.expires_at);
        if (expiry < new Date()) {
          return NextResponse.json(
            { error: 'Verification code has expired. Please request a new code.' },
            { status: 400 }
          );
        }

        // Mark as verified in Supabase
        await supabaseAdmin
          .from('email_verifications')
          .update({ verified: true })
          .eq('id', verification.id);

        // Also mark in memory store
        global.__otpMemoryStore.set(cleanEmail, {
          code: cleanCode,
          expiresAt: expiry.getTime(),
          verified: true,
        });

        return NextResponse.json({ success: true, message: 'Email verified successfully.' });
      }
    } catch (dbEx) {
      console.warn('Database exception during OTP verify:', dbEx);
    }

    return NextResponse.json(
      { error: 'Invalid verification code. Please check and try again.' },
      { status: 400 }
    );
  } catch (error) {
    console.error('OTP Verify route error:', error);
    return NextResponse.json(
      { error: error.message || 'An unexpected error occurred during verification.' },
      { status: 500 }
    );
  }
}

