// C1 — order-access token + get-order gating tests.
// Run: node tests/c1_order_access.test.mjs
//
// No test framework: asserts via a tiny harness and exits non-zero on failure.

import { register } from 'node:module';
import { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// --- Dummy env (must be set before any module reads it). ---
const REQUIRED = [
  'APP_BASE_URL', 'STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'VITE_STRIPE_PUBLISHABLE_KEY',
  'RUNWAY_FUEL_DIAGNOSTIC_PRICE_ID', 'RUNWAY_FUEL_BLUEPRINT_PRICE_ID', 'RUNWAY_FUEL_DEPOSIT_PRICE_ID',
  'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'RESEND_API_KEY', 'RUNWAY_FUEL_FROM_EMAIL',
  'RUNWAY_FUEL_NOTIFICATION_EMAIL', 'ADMIN_API_TOKEN', 'ORDER_ACCESS_TOKEN_SECRET',
];
for (const k of REQUIRED) {
  process.env[k] = process.env[k] || (k === 'APP_BASE_URL' ? 'https://x.test' : `dummy_${k.toLowerCase()}`);
}
process.env.ORDER_ACCESS_TOKEN_SECRET = 'test-hmac-secret-please-rotate';

// Swap the Supabase layer for the stub for all subsequent imports.
const here = path.dirname(fileURLToPath(import.meta.url));
register(new URL('./_stubs/loader.mjs', import.meta.url));

const apiDir = path.join(here, '..', 'api');
const libDir = path.join(apiDir, '_lib');

const { mintOrderAccessToken, verifyOrderAccessToken, EMAIL_LINK_TTL_SECONDS } =
  await import(path.join(libDir, 'order-access.js'));
const getOrder = (await import(path.join(apiDir, 'get-order.js'))).default;
const { KNOWN_ORDER } = await import('./_stubs/supabase.stub.mjs');

// --- Tiny assert harness ---
let passed = 0;
const failures = [];
function check(name, condition, detail = '') {
  if (condition) { passed += 1; console.log(`  ok   ${name}`); }
  else { failures.push(`${name}${detail ? ' — ' + detail : ''}`); console.log(`  FAIL ${name}${detail ? ' — ' + detail : ''}`); }
}

function mkReq(query) {
  const r = Readable.from([]);
  r.method = 'GET';
  r.url = `/api/get-order?${query}`;
  r.headers = {};
  return r;
}
function mkRes() {
  const res = { statusCode: 200, _h: {}, body: '' };
  res.setHeader = (k, v) => { res._h[k] = v; };
  res.end = (c) => { res.body = c ?? ''; };
  return res;
}
async function callGetOrder(query) {
  const res = mkRes();
  await getOrder(mkReq(query), res);
  return { status: res.statusCode, json: JSON.parse(res.body || '{}') };
}

const SESSION = KNOWN_ORDER.stripe_session_id;
const CK = KNOWN_ORDER.correlation_key;
const EMAIL = KNOWN_ORDER.buyer_email;

const IDENTIFYING = ['orderNumber', 'offerCode', 'offerLabel', 'amountTotalCents', 'organization', 'buyerName', 'buyerEmailMasked', 'stripeSessionId'];

// ============ 1. Token lifecycle ============
console.log('\n[1] token lifecycle');
{
  const good = mintOrderAccessToken({ correlationKey: CK, email: EMAIL });
  const v = verifyOrderAccessToken(good);
  check('valid token verifies', v.valid === true && v.correlationKey === CK && v.email === EMAIL, JSON.stringify(v));

  const expired = mintOrderAccessToken({ correlationKey: CK, email: EMAIL, ttlSeconds: 60, now: Date.now() - 3600_000 });
  check('expired token rejected', verifyOrderAccessToken(expired).reason === 'expired');

  // Tamper: change ck in payload but keep original signature.
  const [p, sig] = good.split('.');
  const decoded = JSON.parse(Buffer.from(p.replaceAll('-', '+').replaceAll('_', '/'), 'base64').toString('utf8'));
  decoded.ck = 'rfck_attacker';
  const forgedP = Buffer.from(JSON.stringify(decoded)).toString('base64').replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
  check('tampered payload rejected', verifyOrderAccessToken(`${forgedP}.${sig}`).reason === 'bad_signature');

  check('garbage token rejected', verifyOrderAccessToken('not-a-token').reason === 'malformed');
  check('wrong-scope token rejected', verifyOrderAccessToken(mintOrderAccessToken({ correlationKey: CK, email: EMAIL, scope: 'other' })).reason === 'scope_mismatch');
  check('email-link TTL is long', EMAIL_LINK_TTL_SECONDS >= 7 * 24 * 3600);
}

// ============ 2. get-order gating ============
console.log('\n[2] get-order gating');
{
  // A) unverified: no token, no email -> minimal, NO identifying fields
  const a = await callGetOrder(`session_id=${SESSION}`);
  check('A unverified returns 200', a.status === 200);
  check('A unverified verified=false', a.json.order?.verified === false);
  check('A unverified exposes NO identifying fields',
    IDENTIFYING.every((f) => a.json.order?.[f] === undefined),
    'leaked: ' + IDENTIFYING.filter((f) => a.json.order?.[f] !== undefined).join(','));
  check('A unverified still gives operational status', a.json.order?.paymentStatus === 'paid' && a.json.order?.fulfillmentStatus === 'paid');
  check('A unverified intake is null', a.json.intake === null);

  // B) valid token -> full, but email stays masked on the token path
  const token = mintOrderAccessToken({ correlationKey: CK, email: EMAIL });
  const b = await callGetOrder(`session_id=${SESSION}&order_token=${encodeURIComponent(token)}`);
  check('B token verified=true', b.json.order?.verified === true);
  check('B token exposes identifying fields', b.json.order?.buyerName === 'Jane Doe' && b.json.order?.organization === 'ACME Corporation' && b.json.order?.amountTotalCents === 195000);
  check('B token masks email (no full address)', b.json.order?.buyerEmail === undefined && typeof b.json.order?.buyerEmailMasked === 'string');

  // C) token bound to a DIFFERENT correlation key -> minimal
  const wrongToken = mintOrderAccessToken({ correlationKey: 'rfck_someone_else', email: EMAIL });
  const c = await callGetOrder(`session_id=${SESSION}&order_token=${encodeURIComponent(wrongToken)}`);
  check('C wrong-binding token stays unverified', c.json.order?.verified === false);
  check('C wrong-binding exposes NO identifying fields', IDENTIFYING.every((f) => c.json.order?.[f] === undefined));

  // D) expired token -> minimal
  const expired = mintOrderAccessToken({ correlationKey: CK, email: EMAIL, ttlSeconds: 60, now: Date.now() - 3600_000 });
  const d = await callGetOrder(`session_id=${SESSION}&order_token=${encodeURIComponent(expired)}`);
  check('D expired token stays unverified', d.json.order?.verified === false);

  // E) correct email -> verified AND full email echoed (caller already knows it)
  const e = await callGetOrder(`session_id=${SESSION}&email=${encodeURIComponent(EMAIL)}`);
  check('E correct email verified=true', e.json.order?.verified === true);
  check('E correct email echoes full address', e.json.order?.buyerEmail === EMAIL);

  // F) wrong email -> 403, no body leak
  const f = await callGetOrder(`session_id=${SESSION}&email=${encodeURIComponent('intruder@evil.test')}`);
  check('F wrong email rejected 403', f.status === 403 && f.json.error?.code === 'order_email_mismatch');
  check('F wrong email leaks no order object', f.json.order === undefined);
}

// ============ summary ============
console.log(`\n${failures.length === 0 ? 'PASS' : 'FAIL'} — ${passed} checks passed, ${failures.length} failed`);
if (failures.length) { console.error('\nFailures:\n - ' + failures.join('\n - ')); process.exit(1); }
