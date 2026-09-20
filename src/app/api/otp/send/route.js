import { sendEmail } from '../../../../lib/emailService';
import { supabaseAdmin } from '../../../../lib/supabase';
import { NextResponse } from 'next/server';

// Global in-memory fallback store in case Supabase connection is down/unreachable
global.__otpMemoryStore = global.__otpMemoryStore || new Map();

export async function POST(request) {
  try {
    const { email } = await request.json();

    if (!email || !email.includes('@')) {
      return NextResponse.json(
        { error: 'Please enter a valid email address.' },
        { status: 400 }
      );
    }

    const cleanEmail = email.trim().toLowerCase();

    // Check if email belongs to an existing verified customer (orders or verified OTP)
    try {
      const { data: existingOrders } = await supabaseAdmin
        .from('orders')
        .select('id')
        .ilike('email', cleanEmail)
        .limit(1);

      const { data: verifiedRows } = await supabaseAdmin
        .from('email_verifications')
        .select('id')
        .ilike('email', cleanEmail)
        .eq('verified', true)
        .limit(1);

      if ((existingOrders && existingOrders.length > 0) || (verifiedRows && verifiedRows.length > 0)) {
        return NextResponse.json({
          success: true,
          isVerified: true,
          message: 'You are a verified customer! Form unlocked.',
        });
      }
    } catch (checkErr) {
      console.warn('[OTP Send] Customer verification check warning:', checkErr);
    }

    // Generate 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes expiration

    // Save to in-memory store as fallback
    global.__otpMemoryStore.set(cleanEmail, {
      code,
      expiresAt: expiresAt.getTime(),
      verified: false,
    });

    // Save new verification code to Supabase
    try {
      await supabaseAdmin
        .from('email_verifications')
        .delete()
        .eq('email', cleanEmail);

      const { error: dbError } = await supabaseAdmin
        .from('email_verifications')
        .insert({
          email: cleanEmail,
          code,
          expires_at: expiresAt.toISOString(),
          verified: false,
        });

      if (dbError) {
        console.error('Database warning saving OTP to Supabase (using memory fallback):', dbError);
      }
    } catch (dbEx) {
      console.warn('Database exception saving OTP (using memory fallback):', dbEx);
    }

    // HTML Email Template
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; background-color: #faf6f0; padding: 40px; text-align: center; border-radius: 12px; color: #4a2c11; max-width: 600px; margin: 0 auto; border: 1px solid #e6d3c0;">
        <h2 style="color: #6d4c41; margin-bottom: 5px; font-size: 24px; letter-spacing: 0.5px;">Cafe Esero × Crumble Cookie</h2>
        <p style="color: #8d6e63; font-style: italic; margin-top: 0; margin-bottom: 25px;">Pre-booking Reservation Verification</p>
        
        <div style="background-color: #ffffff; border-radius: 8px; padding: 30px; box-shadow: 0 4px 6px rgba(109,76,65,0.05); border: 1px solid #f0e2d5; display: inline-block; width: 80%;">
          <p style="margin-top: 0; font-size: 16px; color: #4e342e;">Your 6-digit email verification code is:</p>
          <h1 style="font-size: 42px; font-weight: bold; letter-spacing: 6px; color: #3e2723; margin: 15px 0; background: #efebe9; padding: 10px; border-radius: 6px; display: inline-block;">${code}</h1>
          <p style="font-size: 14px; color: #8d6e63; margin-bottom: 0;">This code is temporary and will expire in <strong>10 minutes</strong>.</p>
        </div>
        
        <p style="font-size: 12px; color: #a1887f; margin-top: 30px; line-height: 1.5;">
          If you did not initiate this request, please ignore this email.<br/>
          &copy; 2026 Cafe Esero. All rights reserved.
        </p>
      </div>
    `;

    // Send email using Universal Email Service
    const emailResult = await sendEmail({
      to: cleanEmail,
      subject: '🔑 Your Verification Code - Cafe Esero Preorder',
      html: emailHtml,
      text: `Your Cafe Esero verification code is: ${code}. It expires in 10 minutes.`,
    });

    if (emailResult.success) {
      console.log(`[OTP Send] Verification code successfully sent to ${cleanEmail} via ${emailResult.provider}`);
      return NextResponse.json({
        success: true,
        message: 'Verification code sent to your email.',
        provider: emailResult.provider,
      });
    }

    // If email delivery failed:
    console.error('[OTP Error] Failed to send email:', emailResult.error || emailResult.details);

    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json(
        {
          error: `Email delivery failed: ${emailResult.error || 'Please check email service credentials.'}`,
          details: emailResult.details || null,
        },
        { status: 500 }
      );
    }

    // In local development, provide Sandbox fallback so devs can continue testing
    console.log(`\n==================================================`);
    console.log(`🔑 [EMAIL OTP SANDBOX LOG]`);
    console.log(`To Email: ${cleanEmail}`);
    console.log(`Verification Code: ${code}`);
    console.log(`Reason: ${emailResult.error || 'Local development fallback'}`);
    console.log(`==================================================\n`);

    return NextResponse.json({
      success: true,
      message: 'OTP generated in Sandbox mode.',
      devHint: `[Sandbox Mode] OTP code is: ${code} (Check server console too)`,
    });
  } catch (error) {
    console.error('OTP Send route error:', error);
    return NextResponse.json(
      { error: error.message || 'An unexpected error occurred while sending verification code.' },
      { status: 500 }
    );
  }
}
