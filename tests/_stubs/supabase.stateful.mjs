// Stateful stand-in for api/_lib/supabase.js used by the C2 loop tests.
// Holds one order plus its intake/delivery in memory so the full
// pay -> intake -> deliver -> view loop can be exercised end to end.

export const state = {
  order: null,
  intake: null,
  delivery: null,
  events: [],
};

const BASE_ORDER = {
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

export function resetState() {
  state.order = { ...BASE_ORDER };
  state.intake = null;
  state.delivery = null;
  state.events = [];
}
resetState();

export async function findOrderByReference() {
  return state.order;
}

export async function getOrderIntake() {
  return state.intake;
}

export async function getOrderDelivery() {
  return state.delivery;
}

export async function upsertOrderIntake(fields) {
  state.intake = {
    id: 'intake_1',
    submitted_at: '2026-06-13T09:00:00.000Z',
    updated_at: '2026-06-13T09:00:00.000Z',
    project_background: fields.projectBackground,
    current_stack: fields.currentStack,
    constraints: fields.constraints,
    goals: fields.goals,
    priorities: fields.priorities,
    delivery_notes: fields.deliveryNotes,
    links: fields.links,
  };
  return state.intake;
}

export async function markOrderIntakeReceived() {
  state.order = {
    ...state.order,
    fulfillment_status: 'intake_received',
    intake_submitted_at: '2026-06-13T09:00:00.000Z',
  };
  return state.order;
}

export async function upsertOrderDelivery(fields) {
  state.delivery = {
    id: 'delivery_1',
    summary: fields.summary,
    message: fields.message,
    links: fields.links,
    delivered_at: '2026-06-15T09:00:00.000Z',
  };
  return state.delivery;
}

export async function markOrderDelivered(_orderId, { complete = false } = {}) {
  state.order = {
    ...state.order,
    fulfillment_status: complete ? 'completed' : 'delivery_sent',
  };
  return state.order;
}

export async function insertOrderEvent(event) {
  state.events.push(event);
  return { recorded: true, duplicate: false, event };
}
