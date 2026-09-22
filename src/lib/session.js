import crypto from 'crypto';

const SESSION_COOKIE_NAME = 'customer_session';
const SESSION_SECRET = process.env.SESSION_SECRET || process.env.ADMIN_PASSWORD || 'EseroSecretKey2026-CookiePreorderSalt!';
const SESSION_MAX_AGE_SECONDS = 14 * 24 * 60 * 60; // 14 days

/**
 * Creates an HMAC-SHA256 signature for data string
 */
function signData(data) {
  return crypto.createHmac('sha256', SESSION_SECRET).update(data).digest('base64url');
}

/**
 * Generates a signed token: base64url(payload).signature
 */
export function createCustomerSessionToken(email) {
  const cleanEmail = email.trim().toLowerCase();
  const payload = {
    email: cleanEmail,
    iat: Date.now(),
    exp: Date.now() + SESSION_MAX_AGE_SECONDS * 1000,
  };
  const payloadStr = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = signData(payloadStr);
  return `${payloadStr}.${signature}`;
}

/**
 * Verifies a signed session token. Returns { valid: boolean, email?: string }
 */
export function verifyCustomerSessionToken(token) {
  if (!token || typeof token !== 'string') {
    return { valid: false };
  }

  const parts = token.split('.');
  if (parts.length !== 2) {
    return { valid: false };
  }

  const [payloadStr, signature] = parts;
  const expectedSig = signData(payloadStr);

  try {
    const sigA = Buffer.from(signature);
    const sigB = Buffer.from(expectedSig);
    if (sigA.length !== sigB.length || !crypto.timingSafeEqual(sigA, sigB)) {
      return { valid: false };
    }

    const payload = JSON.parse(Buffer.from(payloadStr, 'base64url').toString('utf8'));
    if (!payload.email || !payload.exp || Date.now() > payload.exp) {
      return { valid: false };
    }

    return { valid: true, email: payload.email };
  } catch (err) {
    return { valid: false };
  }
}

/**
 * Sets an HTTP-only secure cookie for the customer session
 */
export async function setCustomerSessionCookie(cookieStore, email) {
  const token = createCustomerSessionToken(email);
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
  return token;
}

/**
 * Extracts and verifies the customer session from cookieStore
 */
export async function getCustomerSession(cookieStore) {
  try {
    const cookie = cookieStore.get(SESSION_COOKIE_NAME);
    if (!cookie || !cookie.value) {
      return null;
    }
    const result = verifyCustomerSessionToken(cookie.value);
    if (result.valid && result.email) {
      return { email: result.email };
    }
    return null;
  } catch (err) {
    return null;
  }
}

/**
 * Clears the customer session cookie
 */
export async function clearCustomerSessionCookie(cookieStore) {
  cookieStore.delete(SESSION_COOKIE_NAME);
}
