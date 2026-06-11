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
import { verifyOrderAccessToken } from './_lib/order-access.js';
import { findOrderByReference, getOrderDelivery, getOrderIntake } from './_lib/supabase.js';

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
    const orderToken = getQueryParam(req, 'order_token') || getQueryParam(req, 'orderToken');

    if (!orderNumber && !sessionId) {
      throw createHttpError(400, 'missing_order_reference', 'Provide order_number or session_id.');
    }

    const order = await findOrderByReference({ orderNumber, sessionId });

    if (!order) {
      throw createHttpError(404, 'order_not_found', 'Order not found.');
    }

    // A caller who explicitly supplies the wrong email is rejected outright,
    // exactly as before. A caller who supplies the correct email is verified.
    if (buyerEmail && buyerEmail !== order.buyer_email) {
      throw createHttpError(403, 'order_email_mismatch', 'Buyer email does not match the order record.');
    }

    let verifiedVia = null;

    if (buyerEmail && buyerEmail === order.buyer_email) {
      verifiedVia = 'email';
    }

    // A signed order-access token (from the success redirect or the
    // confirmation email) proves the holder originated this checkout. It is
    // accepted only when its signature is valid, it has not expired, and it is
    // bound to THIS order's correlation key.
    if (!verifiedVia && orderToken) {
      const tokenResult = verifyOrderAccessToken(orderToken);
      const correlationMatches =
        tokenResult.valid &&
        Boolean(tokenResult.correlationKey) &&
        tokenResult.correlationKey === order.correlation_key;
      const emailBindingMatches = !tokenResult.email || tokenResult.email === order.buyer_email;

      if (correlationMatches && emailBindingMatches) {
        verifiedVia = 'token';
      }
    }

    const verified = verifiedVia !== null;

    // Always-safe operational status. Contains no buyer-identifying data
    // (no name, organization, offer, amount, email — masked or otherwise).
    const safeOrder = {
      paymentStatus: order.payment_status,
      fulfillmentStatus: order.fulfillment_status,
      fulfillmentDueAt: order.fulfillment_due_at,
      verified,
    };

    if (!verified) {
      logInfo('Order status returned to unverified caller.', {
        requestId,
        sessionId: order.stripe_session_id,
      });

      return sendJson(res, 200, {
        order: safeOrder,
        intake: null,
        delivery: null,
        requestId,
      });
    }

    const [intake, delivery] = await Promise.all([
      getOrderIntake(order.id),
      getOrderDelivery(order.id),
    ]);

    logInfo('Order retrieved.', {
      requestId,
      orderNumber: order.order_number,
      sessionId: order.stripe_session_id,
      verifiedVia,
    });

    return sendJson(res, 200, {
      order: {
        ...safeOrder,
        orderNumber: order.order_number,
        offerCode: order.offer_code,
        offerLabel: order.offer_label,
        currency: order.currency,
        amountTotalCents: order.amount_total_cents,
        paidAt: order.paid_at,
        intakeSubmittedAt: order.intake_submitted_at,
        organization: order.organization,
        buyerName: order.buyer_name,
        // The full address is only echoed to a caller who already typed it.
        buyerEmail: verifiedVia === 'email' ? order.buyer_email : undefined,
        buyerEmailMasked: maskEmail(order.buyer_email),
        stripeSessionId: order.stripe_session_id,
      },
      intake: intake
        ? {
            submittedAt: intake.submitted_at,
            updatedAt: intake.updated_at,
            links: intake.links,
            projectBackground: intake.project_background,
            currentStack: intake.current_stack,
            constraints: intake.constraints,
            goals: intake.goals,
            priorities: intake.priorities,
            deliveryNotes: intake.delivery_notes,
          }
        : null,
      delivery: delivery
        ? {
            summary: delivery.summary,
            message: delivery.message,
            links: delivery.links,
            deliveredAt: delivery.delivered_at,
          }
        : null,
      requestId,
    });
  } catch (error) {
    logError('Order retrieval failed.', error, { requestId });
    return sendError(res, error, requestId);
  }
}
