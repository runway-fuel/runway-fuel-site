import { createHmac, timingSafeEqual } from 'node:crypto';

import { getEnv } from './env.js';
import { createHttpError, normalizeEmail } from './http.js';

/**
 * Stateless, signed order-access tokens.
 *
 * A token proves that its holder originated a specific checkout (it is bound to
 * the server-generated `correlation_key`, which only ever reaches the genuine
 * buyer via their success redirect and confirmation email) without requiring a
 * database lookup to validate. It is HMAC-SHA256 signed with a dedicated secret
 * and is verified in constant time.
 *
 * Token shape (URL-safe):  base64url(payloadJson).base64url(hmac)
 * Payload:                 { v, scope, ck, email, exp }
 */

const TOKEN_VERSION = 1;
const ORDER_READ_SCOPE = 'order_read';

// Short-lived token embedded in the post-payment success redirect.
const REDIRECT_TTL_SECONDS = 30 * 60; // 30 minutes
// Longer-lived token embedded in the confirmation email so the buyer can
// return to view their order (and, once C2 lands, submit intake) later.
const EMAIL_LINK_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days

function base64UrlEncode(input) {
  return Buffer.from(input)
    .toString('base64')
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/u, '');
}

function base64UrlDecodeToString(value) {
  const padded = value.replaceAll('-', '+').replaceAll('_', '/');
  return Buffer.from(padded, 'base64').toString('utf8');
}

function sign(payloadB64) {
  const env = getEnv();
  return base64UrlEncode(
    createHmac('sha256', env.ORDER_ACCESS_TOKEN_SECRET).update(payloadB64).digest(),
  );
}

function constantTimeEquals(left, right) {
  const leftBuffer = Buffer.from(String(left));
  const rightBuffer = Buffer.from(String(right));

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

export function mintOrderAccessToken({
  correlationKey,
  email,
  scope = ORDER_READ_SCOPE,
  ttlSeconds = REDIRECT_TTL_SECONDS,
  now = Date.now(),
}) {
  const normalizedCorrelationKey = String(correlationKey ?? '').trim();

  if (!normalizedCorrelationKey) {
    throw createHttpError(
      500,
      'order_token_mint_failed',
      'A correlation key is required to mint an order access token.',
    );
  }

  const payload = {
    v: TOKEN_VERSION,
    scope,
    ck: normalizedCorrelationKey,
    email: normalizeEmail(email),
    exp: Math.floor(now / 1000) + ttlSeconds,
  };

  const payloadB64 = base64UrlEncode(Buffer.from(JSON.stringify(payload), 'utf8'));
  return `${payloadB64}.${sign(payloadB64)}`;
}

export function verifyOrderAccessToken(token, { now = Date.now(), expectedScope = ORDER_READ_SCOPE } = {}) {
  if (typeof token !== 'string' || !token.includes('.')) {
    return { valid: false, reason: 'malformed' };
  }

  const [payloadB64, providedSignature] = token.split('.', 2);

  if (!payloadB64 || !providedSignature) {
    return { valid: false, reason: 'malformed' };
  }

  let expectedSignature;
  try {
    expectedSignature = sign(payloadB64);
  } catch {
    return { valid: false, reason: 'config_error' };
  }

  // Verify the signature before trusting any byte of the payload.
  if (!constantTimeEquals(providedSignature, expectedSignature)) {
    return { valid: false, reason: 'bad_signature' };
  }

  let payload;
  try {
    payload = JSON.parse(base64UrlDecodeToString(payloadB64));
  } catch {
    return { valid: false, reason: 'malformed_payload' };
  }

  if (payload?.v !== TOKEN_VERSION) {
    return { valid: false, reason: 'version_mismatch' };
  }

  if (payload?.scope !== expectedScope) {
    return { valid: false, reason: 'scope_mismatch' };
  }

  if (typeof payload?.exp !== 'number' || payload.exp * 1000 < now) {
    return { valid: false, reason: 'expired' };
  }

  return {
    valid: true,
    correlationKey: String(payload.ck ?? ''),
    email: normalizeEmail(payload.email),
    scope: payload.scope,
    exp: payload.exp,
  };
}

export { ORDER_READ_SCOPE, REDIRECT_TTL_SECONDS, EMAIL_LINK_TTL_SECONDS };
