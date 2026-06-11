// C2 — delivery loop tests (intake auth + notifications, delivery, visibility).
// Run: node tests/c2_delivery_loop.test.mjs

import { register } from 'node:module';
import { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

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
process.env.ADMIN_API_TOKEN = 'admin-token-xyz';

const here = path.dirname(fileURLToPath(import.meta.url));
register(new URL('./_stubs/loader2.mjs', import.meta.url));

const apiDir = path.join(here, '..', 'api');
const libDir = path.join(apiDir, '_lib');

const { mintOrderAccessToken } = await import(path.join(libDir, 'order-access.js'));
const submitIntake = (await import(path.join(apiDir, 'submit-intake.js'))).default;
const deliverOrder = (await import(path.join(apiDir, 'deliver-order.js'))).default;
const getOrder = (await import(path.join(apiDir, 'get-order.js'))).default;
const { state, resetState } = await import('./_stubs/supabase.stateful.mjs');
const { sent, resetSent } = await import('./_stubs/email.stub.mjs');

let passed = 0;
const failures = [];
function check(name, cond, detail = '') {
  if (cond) { passed += 1; console.log(`  ok   ${name}`); }
  else { failures.push(`${name}${detail ? ' — ' + detail : ''}`); console.log(`  FAIL ${name}${detail ? ' — ' + detail : ''}`); }
}

function mkRes() {
  const res = { statusCode: 200, _h: {}, body: '' };
  res.setHeader = (k, v) => { res._h[k] = v; };
  res.end = (c) => { res.body = c ?? ''; };
  return res;
}
function mkGet(query, headers = {}) {
  const r = Readable.from([]);
  r.method = 'GET';
  r.url = `/api?${query}`;
  r.headers = Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]));
  return r;
}
function mkPost(bodyObj, headers = {}) {
  const body = JSON.stringify(bodyObj);
  const r = Readable.from([Buffer.from(body)]);
  r.method = 'POST';
  r.url = '/api';
  r.headers = { 'content-type': 'application/json', ...Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v])) };
  return r;
}
async function call(handler, req) {
  const res = mkRes();
  await handler(req, res);
  return { status: res.statusCode, json: JSON.parse(res.body || '{}') };
}

const SESSION = 'cs_test_SECRET_SESSION_123';
const CK = 'rfck_known1234567890abcdef';
const EMAIL = 'jane.doe@acme-corp.com';
const token = mintOrderAccessToken({ correlationKey: CK, email: EMAIL });

// ============ 1. submit-intake auth ============
console.log('\n[1] submit-intake authentication');
{
  resetState(); resetSent();
  // No token, no email -> rejected
  const unauth = await call(submitIntake, mkPost({ sessionId: SESSION, projectBackground: 'x', goals: 'y' }));
  check('unauthenticated intake rejected 401', unauth.status === 401 && unauth.json.error?.code === 'intake_unverified');
  check('rejected intake recorded nothing', state.intake === null);

  // Wrong token -> rejected
  const badToken = mintOrderAccessToken({ correlationKey: 'rfck_wrong', email: EMAIL });
  const wrong = await call(submitIntake, mkPost({ sessionId: SESSION, orderToken: badToken, projectBackground: 'x', goals: 'y' }));
  check('wrong-binding token rejected 401', wrong.status === 401);
}

// ============ 2. intake closes the loop ============
console.log('\n[2] intake submission + notifications');
{
  resetState(); resetSent();
  const ok = await call(submitIntake, mkPost({
    sessionId: SESSION, orderToken: token,
    projectBackground: 'Migrating ops to a new stack', goals: 'Cut cycle time in half',
    links: 'https://repo.example\nhttps://docs.example',
  }));
  check('valid intake accepted 200', ok.status === 200);
  check('order moved to intake_received', state.order.fulfillment_status === 'intake_received');
  check('operator was notified', sent.some((m) => m.kind === 'operator_intake_notification'));
  check('buyer was acknowledged', sent.some((m) => m.kind === 'buyer_intake_ack'));
  check('response reports notifications', ok.json.operatorNotified === true && ok.json.buyerAcknowledged === true);
}

// ============ 3. delivery endpoint ============
console.log('\n[3] deliver-order');
{
  resetState(); resetSent();
  // No admin token -> 401
  const noAuth = await call(deliverOrder, mkPost({ orderNumber: 'rford_deadbeefdeadbeef0001', summary: 's' }));
  check('delivery without admin token rejected', noAuth.status === 401 || noAuth.status === 403);

  // Missing summary -> 400
  const noSummary = await call(deliverOrder, mkPost({ orderNumber: 'rford_deadbeefdeadbeef0001' }, { authorization: 'Bearer admin-token-xyz' }));
  check('delivery requires summary 400', noSummary.status === 400);

  // Valid delivery
  const del = await call(deliverOrder, mkPost({
    orderNumber: 'rford_deadbeefdeadbeef0001',
    summary: 'Findings + execution plan attached.',
    links: ['https://drive.example/deliverable'],
    deliveredBy: 'Operator',
  }, { authorization: 'Bearer admin-token-xyz' }));
  check('valid delivery accepted 200', del.status === 200);
  check('order moved to delivery_sent', state.order.fulfillment_status === 'delivery_sent');
  check('delivery persisted', state.delivery?.summary === 'Findings + execution plan attached.');
  check('buyer got the deliverable email', sent.some((m) => m.kind === 'buyer_delivery'));
  check('response reports buyerNotified', del.json.buyerNotified === true);

  // --complete moves to completed
  const done = await call(deliverOrder, mkPost({
    orderNumber: 'rford_deadbeefdeadbeef0001', summary: 'Wrapped up.', complete: true,
  }, { authorization: 'Bearer admin-token-xyz' }));
  check('complete flag moves to completed', done.status === 200 && state.order.fulfillment_status === 'completed');
}

// ============ 4. buyer visibility of delivery ============
console.log('\n[4] get-order delivery visibility');
{
  resetState(); resetSent();
  // seed a delivery
  state.delivery = { id: 'd', summary: 'Done', message: null, links: ['https://x'], delivered_at: '2026-06-15T09:00:00.000Z' };

  // unverified -> no delivery
  const anon = await call(getOrder, mkGet(`session_id=${SESSION}`));
  check('unverified sees no delivery', anon.json.delivery === null && anon.json.order?.verified === false);

  // verified by token -> delivery present
  const ver = await call(getOrder, mkGet(`session_id=${SESSION}&order_token=${encodeURIComponent(token)}`));
  check('verified sees delivery', ver.json.delivery?.summary === 'Done' && Array.isArray(ver.json.delivery?.links));
}

console.log(`\n${failures.length === 0 ? 'PASS' : 'FAIL'} — ${passed} checks passed, ${failures.length} failed`);
if (failures.length) { console.error('\nFailures:\n - ' + failures.join('\n - ')); process.exit(1); }
