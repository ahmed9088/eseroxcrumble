/**
 * OTP Service for sending WhatsApp/SMS verification codes.
 * Supports sandbox console logging (default), Twilio WhatsApp API,
 * and generic SMS HTTP gateways.
 */
export async function sendPhoneOTP(phone, code) {
  // Clean phone number (keep only digits)
  const cleanPhone = phone.replace(/\D/g, '');

  console.log(`\n==================================================`);
  console.log(`🔑 [OTP SANDBOX LOG]`);
  console.log(`Phone Number: ${phone}`);
  console.log(`Cleaned Number: ${cleanPhone}`);
  console.log(`Verification Code: ${code}`);
  console.log(`Message: Your Cafe Esero verification code is ${code}. It expires in 10 minutes.`);
  console.log(`==================================================\n`);

  // 1. Twilio WhatsApp API Integration
  const twilioSid = process.env.TWILIO_ACCOUNT_SID;
  const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
  const twilioFrom = process.env.TWILIO_WHATSAPP_FROM; // e.g., "whatsapp:+14155238886"

  if (twilioSid && twilioAuthToken && twilioFrom) {
    try {
      // Form international format. E.g., if cleanPhone is 03001234567, map to +923001234567
      let formattedPhone = cleanPhone;
      if (formattedPhone.startsWith('0')) {
        formattedPhone = '92' + formattedPhone.substring(1);
      }
      if (!formattedPhone.startsWith('+')) {
        formattedPhone = '+' + formattedPhone;
      }

      console.log(`[Twilio OTP] Attempting to send to WhatsApp: ${formattedPhone}`);

      const response = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`,
        {
          method: 'POST',
          headers: {
            'Authorization': 'Basic ' + Buffer.from(`${twilioSid}:${twilioAuthToken}`).toString('base64'),
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            To: `whatsapp:${formattedPhone}`,
            From: twilioFrom,
            Body: `Your Cafe Esero verification code is ${code}. It expires in 10 minutes.`,
          }),
        }
      );

      const data = await response.json();
      if (!response.ok) {
        console.error('[Twilio OTP Error] Response failed:', data);
        return { success: false, error: data.message || 'Twilio send failed.' };
      }
      console.log('[Twilio OTP Success] Message SID:', data.sid);
      return { success: true, provider: 'twilio', sid: data.sid };
    } catch (err) {
      console.error('[Twilio OTP Exception]:', err);
      return { success: false, error: err.message };
    }
  }

  // 2. Textbee.dev Free Android SMS Gateway Integration
  const textbeeApiKey = process.env.TEXTBEE_API_KEY;
  const textbeeDeviceId = process.env.TEXTBEE_DEVICE_ID;

  if (textbeeApiKey && textbeeDeviceId) {
    try {
      console.log(`[Textbee OTP] Attempting to send SMS via Android Phone Gateway...`);
      let formattedPhone = cleanPhone;
      if (formattedPhone.startsWith('0')) {
        formattedPhone = '+92' + formattedPhone.substring(1);
      } else if (!formattedPhone.startsWith('+')) {
        formattedPhone = '+' + formattedPhone;
      }

      const response = await fetch(
        `https://api.textbee.dev/api/v1/gateway/devices/${textbeeDeviceId}/send-sms`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': textbeeApiKey,
          },
          body: JSON.stringify({
            recipients: [formattedPhone],
            message: `Your Cafe Esero verification code is ${code}. It expires in 10 minutes.`,
          }),
        }
      );

      const data = await response.json();
      if (!response.ok) {
        console.error('[Textbee OTP Error] Response failed:', data);
        return { success: false, error: data.message || 'Textbee send failed.' };
      }
      console.log('[Textbee OTP Success] SMS sent:', data);
      return { success: true, provider: 'textbee' };
    } catch (err) {
      console.error('[Textbee OTP Exception]:', err);
      return { success: false, error: err.message };
    }
  }

  // 3. Generic SMS / Custom Webhook Gateway Integration
  const smsUrl = process.env.SMS_API_URL;
  const smsKey = process.env.SMS_API_KEY;
  if (smsUrl) {
    try {
      console.log(`[Generic SMS OTP] Sending custom request to: ${smsUrl}`);
      // Default to POST with JSON payload. Customise this payload as per local API specifications
      const response = await fetch(smsUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(smsKey ? { 'Authorization': `Bearer ${smsKey}` } : {}),
        },
        body: JSON.stringify({
          to: cleanPhone,
          message: `Your Cafe Esero verification code is ${code}. It expires in 10 minutes.`,
          code: code
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        console.error('[Generic SMS OTP Error]:', text);
        return { success: false, error: `SMS gateway responded with status: ${response.status}` };
      }

      console.log('[Generic SMS OTP Success]');
      return { success: true, provider: 'generic' };
    } catch (err) {
      console.error('[Generic SMS OTP Exception]:', err);
      return { success: false, error: err.message };
    }
  }

  // If no API key is specified, default to local sandbox (logs to console only)
  console.log(`[OTP Sandbox Mode Active] No active API credentials found. Use OTP code ${code} printed above.`);
  return { success: true, provider: 'sandbox', code };
}
