import { resend } from '../../../../lib/resend';
import { supabaseAdmin } from '../../../../lib/supabase';
import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const { email } = await request.json();

    if (!email || !email.includes('@')) {
      return NextResponse.json(
        { error: 'Please enter a valid email address.' },
        { status: 400 }
      );
    }

    // Generate 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes expiration

    // Delete any old OTPs for this email to prevent bloat
    await supabaseAdmin
      .from('email_verifications')
      .delete()
      .eq('email', email);

    // Save new verification code
    const { error: dbError } = await supabaseAdmin
      .from('email_verifications')
      .insert({
        email,
        code,
        expires_at: expiresAt.toISOString(),
        verified: false,
      });

    if (dbError) {
      console.error('Database error saving OTP:', dbError);
      return NextResponse.json(
        { error: 'Failed to generate verification code. Please try again.' },
        { status: 500 }
      );
    }

    // Send email using Resend
    let emailSent = false;
    let emailErrorMsg = '';

    if (process.env.RESEND_API_KEY && process.env.RESEND_API_KEY !== 're_your_api_key' && process.env.RESEND_API_KEY !== 're_dummy_key_for_build') {
      try {
        const { data: emailData, error: emailError } = await resend.emails.send({
          from: 'Cafe Esero <onboarding@resend.dev>', // Resend default domain for sandbox
          to: email,
          subject: '🔑 Your Verification Code - Cafe Esero Preorder',
          html: `
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
          `,
        });

        if (emailError) {
          console.error('Email sending error:', emailError);
          emailErrorMsg = emailError.message || 'Resend error';
        } else {
          emailSent = true;
        }
      } catch (err) {
        console.error('Resend exception:', err);
        emailErrorMsg = err.message;
      }
    }

    if (!emailSent) {
      console.log(`\n==================================================`);
      console.log(`🔑 [EMAIL OTP SANDBOX LOG]`);
      console.log(`To Email: ${email}`);
      console.log(`Verification Code: ${code}`);
      console.log(`Reason: Resend API key is missing or dummy. Using local Sandbox.`);
      console.log(`==================================================\n`);

      return NextResponse.json({
        success: true,
        message: 'OTP generated in Sandbox mode.',
        devHint: `[Sandbox Mode] OTP code is: ${code} (check terminal console too)`
      });
    }

    return NextResponse.json({ success: true, message: 'OTP sent successfully.' });
  } catch (error) {
    console.error('OTP Send route error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred.' },
      { status: 500 }
    );
  }
}
