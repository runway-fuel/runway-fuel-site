import { getEnv } from './_lib/env.js';
import {
  createHttpError,
  getQueryParam,
  getRequestId,
  methodNotAllowed,
  normalizeEmail,
  sendError,
  sendJson,
} from './_lib/http.js';
import { logError, logInfo } from './_lib/logging.js';
import { findOrderByReference, getOrderIntake } from './_lib/supabase.js';

function maskEmail(email) {
  const [localPart = '', domain = ''] = String(email || '').split('@');

  if (!localPart || !domain) {
    return '';
  }

  const visible = localPart.slice(0, 2);
  return `${visible}${'*'.repeat(Math.max(localPart.length - 2, 1))}@${domain}`;
}

export default async function handler(req, res) {
  const requestId = getRequestId(req);

  try {
    getEnv();

    if (req.method !== 'GET') {
      return methodNotAllowed(res, ['GET']);
    }

    const orderNumber = getQueryParam(req, 'order_number') || getQueryParam(req, 'orderNumber');
    const sessionId = getQueryParam(req, 'session_id') || getQueryParam(req, 'sessionId');
    const buyerEmail = normalizeEmail(getQueryParam(req, 'email') || getQueryParam(req, 'buyerEmail'));

    if (!orderNumber && !sessionId) {
      throw createHttpError(400, 'missing_order_reference', 'Provide order_number or session_id.');
    }

    const order = await findOrderByReference({ orderNumber, sessionId });

    if (!order) {
      throw createHttpError(404, 'order_not_found', 'Order not found.');
    }

    if (buyerEmail && buyerEmail !== order.buyer_email) {
      throw createHttpError(403, 'order_email_mismatch', 'Buyer email does not match the order record.');
    }

    const intake = await getOrderIntake(order.id);
    const emailVerified = Boolean(buyerEmail && buyerEmail === order.buyer_email);

    logInfo('Order retrieved.', {
      requestId,
      orderNumber: order.order_number,
      sessionId: order.stripe_session_id,
      emailVerified,
    });

    return sendJson(res, 200, {
      order: {
        orderNumber: order.order_number,
        offerCode: order.offer_code,
        offerLabel: order.offer_label,
        currency: order.currency,
        amountTotalCents: order.amount_total_cents,
        paymentStatus: order.payment_status,
        fulfillmentStatus: order.fulfillment_status,
        fulfillmentDueAt: order.fulfillment_due_at,
        paidAt: order.paid_at,
        intakeSubmittedAt: order.intake_submitted_at,
        organization: order.organization,
        buyerName: order.buyer_name,
        buyerEmail: emailVerified ? order.buyer_email : undefined,
        buyerEmailMasked: maskEmail(order.buyer_email),
        stripeSessionId: order.stripe_session_id,
      },
      intake: intake
        ? {
            submittedAt: intake.submitted_at,
            updatedAt: intake.updated_at,
            links: intake.links,
            projectBackground: emailVerified ? intake.project_background : undefined,
            currentStack: emailVerified ? intake.current_stack : undefined,
            constraints: emailVerified ? intake.constraints : undefined,
            goals: emailVerified ? intake.goals : undefined,
            priorities: emailVerified ? intake.priorities : undefined,
            deliveryNotes: emailVerified ? intake.delivery_notes : undefined,
          }
        : null,
      requestId,
    });
  } catch (error) {
    logError('Order retrieval failed.', error, { requestId });
    return sendError(res, error, requestId);
  }
}
