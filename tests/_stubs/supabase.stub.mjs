// Deterministic stand-in for api/_lib/supabase.js used by the C1 tests.
// Returns one known paid order carrying buyer PII so the access-control
// gating in get-order can be asserted precisely.

export const KNOWN_ORDER = {
  id: '00000000-0000-0000-0000-000000000001',
  order_number: 'rford_deadbeefdeadbeef0001',
  correlation_key: 'rfck_known1234567890abcdef',
  customer_id: 'c1',
  offer_code: 'rf_blueprint',
  offer_label: 'Runway Fuel Execution Blueprint',
  currency: 'eur',
  amount_subtotal_cents: 195000,
  amount_total_cents: 195000,
  stripe_session_id: 'cs_test_SECRET_SESSION_123',
  payment_status: 'paid',
  fulfillment_status: 'paid',
  fulfillment_due_at: '2026-06-19T09:00:00.000Z',
  paid_at: '2026-06-12T09:00:00.000Z',
  buyer_email: 'jane.doe@acme-corp.com',
  buyer_name: 'Jane Doe',
  organization: 'ACME Corporation',
  order_metadata: {},
  intake_submitted_at: null,
};

export async function findOrderByReference() {
  return KNOWN_ORDER;
}

export async function getOrderIntake() {
  return null;
}
