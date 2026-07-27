import { Resend } from 'resend';

const resendApiKey = process.env.RESEND_API_KEY || 're_dummy_key_for_build';

if (!process.env.RESEND_API_KEY) {
  console.warn('RESEND_API_KEY environment variable is missing. Using dummy key for build compilation.');
}

export const resend = new Resend(resendApiKey);
