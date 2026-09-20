import { resend } from './resend.js';
import nodemailer from 'nodemailer';

/**
 * Universal Email Sender Service
 * Supports:
 * 1. Resend API (via RESEND_API_KEY)
 * 2. SMTP / Gmail (via SMTP_USER, SMTP_PASS / GMAIL_APP_PASSWORD)
 * 
 * Includes automatic sender domain fallback:
 * If a custom domain fails with "domain not verified", it automatically retries
 * using the verified Resend testing domain (onboarding@resend.dev) or SMTP.
 */

// Create reusable SMTP transporter if SMTP environment variables are present
function getSmtpTransporter() {
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : 587;
  const user = process.env.SMTP_USER || process.env.GMAIL_USER;
  const pass = process.env.SMTP_PASS || process.env.GMAIL_APP_PASSWORD;

  if (!user || !pass) {
    return null;
  }

  // If host is not provided but user is a Gmail address, default to Gmail service
  if (!host && user.includes('@gmail.com')) {
    return nodemailer.createTransport({
      service: 'gmail',
      auth: { user, pass },
    });
  }

  return nodemailer.createTransport({
    host: host || 'smtp.gmail.com',
    port: port,
    secure: port === 465,
    auth: { user, pass },
  });
}

export async function sendEmail({ to, subject, html, text }) {
  const smtpTransporter = getSmtpTransporter();

  // 1. If SMTP is configured, we can use it directly (or as primary)
  if (smtpTransporter) {
    try {
      const fromAddress = process.env.SMTP_FROM || process.env.SMTP_USER || process.env.GMAIL_USER || 'Cafe Esero <noreply@itsahmed.tech>';
      const info = await smtpTransporter.sendMail({
        from: fromAddress,
        to,
        subject,
        html,
        text: text || html.replace(/<[^>]+>/g, ''),
      });

      console.log(`[EmailService] Sent successfully via SMTP: ${info.messageId}`);
      return { success: true, provider: 'smtp', messageId: info.messageId };
    } catch (smtpErr) {
      console.error('[EmailService] SMTP send error:', smtpErr);
      // Fall through to try Resend if configured
    }
  }

  // 2. Check Resend configuration
  const resendKey = process.env.RESEND_API_KEY;
  const isResendKeyValid = resendKey && 
    resendKey !== 're_dummy_key' && 
    resendKey !== 're_your_api_key' && 
    resendKey !== 're_dummy_key_for_build';

  if (!isResendKeyValid) {
    const errorMsg = 'No valid email credentials found (RESEND_API_KEY is dummy/missing, and SMTP is not configured).';
    console.warn(`[EmailService] ${errorMsg}`);
    return {
      success: false,
      provider: 'none',
      error: errorMsg,
      needsConfig: true,
    };
  }

  // Determine sender for Resend
  // Priority: RESEND_FROM_EMAIL -> itsahmed.tech custom domain -> onboarding@resend.dev
  const configuredFrom = process.env.RESEND_FROM_EMAIL || 'Cafe Esero <noreply@itsahmed.tech>';

  try {
    console.log(`[EmailService] Attempting Resend send to ${to} from ${configuredFrom}...`);
    const { data, error } = await resend.emails.send({
      from: configuredFrom,
      to,
      subject,
      html,
      text: text || html.replace(/<[^>]+>/g, ''),
    });

    if (error) {
      console.warn(`[EmailService] Resend returned error with '${configuredFrom}':`, error);

      // Check if the error is due to an unverified custom domain
      const isDomainError = error.message && (
        error.message.toLowerCase().includes('not verified') ||
        error.message.toLowerCase().includes('domain') ||
        error.message.toLowerCase().includes('from address') ||
        error.name === 'validation_error'
      );

      // If custom domain failed and we weren't already using onboarding@resend.dev, try fallback
      if (isDomainError && !configuredFrom.includes('onboarding@resend.dev')) {
        const fallbackFrom = 'Cafe Esero <onboarding@resend.dev>';
        console.log(`[EmailService] Retrying send with Resend fallback domain '${fallbackFrom}'...`);
        
        const fallbackResult = await resend.emails.send({
          from: fallbackFrom,
          to,
          subject,
          html,
          text: text || html.replace(/<[^>]+>/g, ''),
        });

        if (!fallbackResult.error) {
          console.log(`[EmailService] Fallback Resend send succeeded! ID:`, fallbackResult.data?.id);
          return { success: true, provider: 'resend-fallback', id: fallbackResult.data?.id };
        } else {
          console.error(`[EmailService] Fallback Resend also failed:`, fallbackResult.error);
          return {
            success: false,
            provider: 'resend',
            error: fallbackResult.error.message || 'Resend fallback failed',
            details: `Original error: ${error.message}. Fallback error: ${fallbackResult.error.message}`,
          };
        }
      }

      return {
        success: false,
        provider: 'resend',
        error: error.message || 'Resend error',
      };
    }

    console.log(`[EmailService] Sent successfully via Resend: ${data?.id}`);
    return { success: true, provider: 'resend', id: data?.id };
  } catch (err) {
    console.error('[EmailService] Resend exception:', err);
    return {
      success: false,
      provider: 'resend',
      error: err.message,
    };
  }
}
