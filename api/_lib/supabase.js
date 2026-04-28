import { createClient } from '@supabase/supabase-js';

import { getEnv } from './env.js';
import {
  calculateFulfillmentDueAt,
  generateCorrelationKey,
  generateOrderNumber,
} from './offers.js';
import { createHttpError, normalizeEmail } from './http.js';

let supabaseAdmin;

const ORDER_SELECT = [
  'id',
  'created_at',
  'updated_at',
  'order_number',
  'correlation_key',
  'customer_id',
  'offer_code',
  'offer_label',
  'order_kind',
  'currency',
  'amount_subtotal_cents',
  'amount_total_cents',
  'stripe_session_id',
  'stripe_payment_intent_id',
  'stripe_customer_id',
  'checkout_status',
  'payment_status',
  'fulfillment_status',
  'fulfillment_due_at',
  'paid_at',
  'buyer_email',
  'buyer_name',
  'organization',
  'order_metadata',
  'intake_submitted_at',
].join(', ');

function isUniqueViolation(error) {
  return error?.code === '23505';
}

function normalizeZeroOrOneResult(data, error, { errorCode, multipleRowsCode }) {
  if (error) {
    throw createHttpError(500, errorCode, error.message);
  }

  const rows = Array.isArray(data) ? data : [];

  if (rows.length > 1) {
    throw createHttpError(500, multipleRowsCode, 'Expected at most one row but received multiple rows.');
  }

  return rows[0] ?? null;
}

export function getSupabaseAdmin() {
  if (!supabaseAdmin) {
    const env = getEnv();

    supabaseAdmin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  return supabaseAdmin;
}

export async function upsertCustomer({ email, name, organization, stripeCustomerId }) {
  const supabase = getSupabaseAdmin();
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail) {
    throw createHttpError(400, 'invalid_email', 'Buyer email is required.');
  }

  const payload = {
    buyer_email: normalizedEmail,
    buyer_name: name || null,
    organization: organization || null,
    stripe_customer_id: stripeCustomerId || null,
  };

  const { data, error } = await supabase
    .from('rf_customers')
    .upsert(payload, { onConflict: 'buyer_email' })
    .select('*')
    .single();

  if (error) {
    throw createHttpError(500, 'supabase_customer_upsert_failed', error.message);
  }

  return data;
}

export async function findOrderByStripeSessionId(stripeSessionId) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('rf_orders')
    .select(ORDER_SELECT)
    .eq('stripe_session_id', stripeSessionId)
    .limit(2);

  return normalizeZeroOrOneResult(data, error, {
    errorCode: 'supabase_order_lookup_failed',
    multipleRowsCode: 'supabase_order_lookup_multiple',
  });
}

export async function findOrderByReference({ orderNumber = '', sessionId = '' }) {
  const supabase = getSupabaseAdmin();

  if (orderNumber) {
    const { data, error } = await supabase
      .from('rf_orders')
      .select(ORDER_SELECT)
      .eq('order_number', orderNumber)
      .limit(2);

    return normalizeZeroOrOneResult(data, error, {
      errorCode: 'supabase_order_lookup_failed',
      multipleRowsCode: 'supabase_order_lookup_multiple',
    });
  }

  if (sessionId) {
    const { data, error } = await supabase
      .from('rf_orders')
      .select(ORDER_SELECT)
      .eq('stripe_session_id', sessionId)
      .limit(2);

    return normalizeZeroOrOneResult(data, error, {
      errorCode: 'supabase_order_lookup_failed',
      multipleRowsCode: 'supabase_order_lookup_multiple',
    });
  }

  throw createHttpError(400, 'missing_order_reference', 'Provide order_number or session_id.');
}

export async function getOrderIntake(orderId) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('rf_order_intakes')
    .select('*')
    .eq('order_id', orderId)
    .limit(2);

  return normalizeZeroOrOneResult(data, error, {
    errorCode: 'supabase_intake_lookup_failed',
    multipleRowsCode: 'supabase_intake_lookup_multiple',
  });
}

export async function createPaidOrderFromCheckoutSession({ session, customer, offer, paidAt }) {
  const supabase = getSupabaseAdmin();
  const buyerEmail = normalizeEmail(
    session.metadata?.buyer_email ?? session.customer_details?.email ?? customer.buyer_email,
  );

  const payload = {
    order_number: generateOrderNumber(),
    correlation_key: session.metadata?.correlation_key || generateCorrelationKey(),
    customer_id: customer.id,
    offer_code: offer.code,
    offer_label: offer.label,
    order_kind: 'one_time',
    currency: String(session.currency || 'usd').toLowerCase(),
    amount_subtotal_cents: Number(session.amount_subtotal ?? session.amount_total ?? 0),
    amount_total_cents: Number(session.amount_total ?? 0),
    stripe_session_id: session.id,
    stripe_payment_intent_id:
      typeof session.payment_intent === 'string'
        ? session.payment_intent
        : session.payment_intent?.id ?? null,
    stripe_customer_id:
      typeof session.customer === 'string' ? session.customer : session.customer?.id ?? null,
    checkout_status: session.status ?? 'complete',
    payment_status: session.payment_status ?? 'unpaid',
    fulfillment_status: 'paid',
    fulfillment_due_at: calculateFulfillmentDueAt(offer.code, paidAt),
    paid_at: new Date(paidAt).toISOString(),
    buyer_email: buyerEmail,
    buyer_name: session.metadata?.buyer_name || session.customer_details?.name || customer.buyer_name || null,
    organization: session.metadata?.organization || customer.organization || null,
    order_metadata: {
      session_mode: session.mode,
      livemode: session.livemode,
      metadata: session.metadata ?? {},
      customer_details: session.customer_details ?? null,
    },
  };

  const { data, error } = await supabase
    .from('rf_orders')
    .insert(payload)
    .select(ORDER_SELECT)
    .single();

  if (!error) {
    return {
      order: data,
      created: true,
    };
  }

  if (isUniqueViolation(error)) {
    const existingOrder = await findOrderByStripeSessionId(session.id);

    if (existingOrder) {
      return {
        order: existingOrder,
        created: false,
      };
    }
  }

  throw createHttpError(500, 'supabase_order_insert_failed', error.message);
}

export async function insertOrderEvent({
  orderId = null,
  customerId = null,
  eventKind,
  eventSource,
  stripeEventId = null,
  stripeEventType = null,
  stripeSessionId = null,
  correlationKey = null,
  eventStatus = 'recorded',
  payload = {},
}) {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from('rf_order_events')
    .insert({
      order_id: orderId,
      customer_id: customerId,
      event_kind: eventKind,
      event_source: eventSource,
      stripe_event_id: stripeEventId,
      stripe_event_type: stripeEventType,
      stripe_session_id: stripeSessionId,
      correlation_key: correlationKey,
      event_status: eventStatus,
      payload,
    })
    .select('*')
    .single();

  if (!error) {
    return {
      recorded: true,
      duplicate: false,
      event: data,
    };
  }

  if (isUniqueViolation(error) && stripeEventId) {
    return {
      recorded: false,
      duplicate: true,
      event: null,
    };
  }

  throw createHttpError(500, 'supabase_event_insert_failed', error.message);
}

export async function upsertOrderIntake({
  orderId,
  submittedByEmail,
  projectBackground,
  currentStack,
  constraints,
  goals,
  priorities,
  links,
  deliveryNotes,
  rawPayload,
}) {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from('rf_order_intakes')
    .upsert(
      {
        order_id: orderId,
        submitted_by_email: submittedByEmail,
        project_background: projectBackground,
        current_stack: currentStack,
        constraints,
        goals,
        priorities,
        links,
        delivery_notes: deliveryNotes,
        intake_payload: rawPayload,
      },
      { onConflict: 'order_id' },
    )
    .select('*')
    .single();

  if (error) {
    throw createHttpError(500, 'supabase_intake_upsert_failed', error.message);
  }

  return data;
}

export async function markOrderIntakeReceived(orderId) {
  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from('rf_orders')
    .update({
      fulfillment_status: 'intake_received',
      intake_submitted_at: now,
    })
    .eq('id', orderId)
    .select(ORDER_SELECT)
    .single();

  if (error) {
    throw createHttpError(500, 'supabase_order_update_failed', error.message);
  }

  return data;
}

export async function getRecentOrders(limit = 10) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('rf_orders')
    .select(ORDER_SELECT)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw createHttpError(500, 'supabase_recent_orders_failed', error.message);
  }

  return data;
}

export async function getAllOrdersForUsage() {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('rf_orders')
    .select('offer_code, offer_label, amount_total_cents, currency, payment_status, fulfillment_status');

  if (error) {
    throw createHttpError(500, 'supabase_usage_query_failed', error.message);
  }

  return data;
}
