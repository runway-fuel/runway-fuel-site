import { getEnv } from './_lib/env.js';
import {
  createHttpError,
  getRequestId,
  methodNotAllowed,
  optionalString,
  readJsonBody,
  requireAdminToken,
  requireNonEmptyString,
  sendError,
  sendJson,
} from './_lib/http.js';
import { logError, logInfo } from './_lib/logging.js';
import { sendBuyerDeliveryEmail } from './_lib/email.js';
import {
  findOrderByReference,
  getOrderDelivery,
  insertOrderEvent,
  markOrderDelivered,
  upsertOrderDelivery,
} from './_lib/supabase.js';

function normalizeLinks(value) {
  if (value === undefined || value === null || value === '') {
    return [];
  }

  const inputValues = Array.isArray(value) ? value : String(value).split(/[\n,]/g);
  const normalized = inputValues
    .map((item) => String(item).trim())
    .filter(Boolean)
    .slice(0, 25);

  return [...new Set(normalized)];
}

export default async function handler(req, res) {
  const requestId = getRequestId(req);

  try {
    const env = getEnv();

    if (req.method !== 'POST') {
      return methodNotAllowed(res, ['POST']);
    }

    requireAdminToken(req, env.ADMIN_API_TOKEN);

    const body = await readJsonBody(req, { maxBytes: 256 * 1024 });
    const orderNumber = String(body.orderNumber ?? body.order_number ?? '').trim();
    const sessionId = String(body.sessionId ?? body.session_id ?? '').trim();
    const summary = requireNonEmptyString(body.summary, 'summary', { maxLength: 5000 });
    const message = optionalString(body.message, { maxLength: 20000 });
    const deliveredBy = optionalString(body.deliveredBy ?? body.delivered_by, { maxLength: 200 });
    const links = normalizeLinks(body.links);
    const complete = body.complete === true || body.complete === 'true';

    if (!orderNumber && !sessionId) {
      throw createHttpError(400, 'missing_order_reference', 'Provide orderNumber or sessionId.');
    }

    const order = await findOrderByReference({ orderNumber, sessionId });

    if (!order) {
      throw createHttpError(404, 'order_not_found', 'Order not found.');
    }

    if (order.payment_status !== 'paid') {
      throw createHttpError(409, 'order_not_paid', 'Delivery is only available for paid orders.');
    }

    const delivery = await upsertOrderDelivery({
      orderId: order.id,
      deliveredBy,
      summary,
      message,
      links,
      rawPayload: { orderNumber, sessionId, complete },
    });

    const updatedOrder = await markOrderDelivered(order.id, { complete });

    await insertOrderEvent({
      orderId: updatedOrder.id,
      customerId: updatedOrder.customer_id,
      eventKind: complete ? 'order_completed' : 'order_delivery_sent',
      eventSource: 'api',
      stripeSessionId: updatedOrder.stripe_session_id,
      correlationKey: updatedOrder.correlation_key,
      payload: {
        delivery_id: delivery.id,
        delivered_by: deliveredBy || null,
        link_count: links.length,
      },
    });

    let buyerNotified = false;
    try {
      await sendBuyerDeliveryEmail(updatedOrder, delivery);
      buyerNotified = true;
      await insertOrderEvent({
        orderId: updatedOrder.id,
        customerId: updatedOrder.customer_id,
        eventKind: 'delivery_email_sent',
        eventSource: 'resend',
        stripeSessionId: updatedOrder.stripe_session_id,
        correlationKey: updatedOrder.correlation_key,
        payload: { to: updatedOrder.buyer_email },
      });
    } catch (error) {
      logError('Delivery email failed.', error, {
        requestId,
        orderNumber: updatedOrder.order_number,
      });
      await insertOrderEvent({
        orderId: updatedOrder.id,
        customerId: updatedOrder.customer_id,
        eventKind: 'delivery_email_failed',
        eventSource: 'resend',
        stripeSessionId: updatedOrder.stripe_session_id,
        correlationKey: updatedOrder.correlation_key,
        eventStatus: 'failed',
        payload: { to: updatedOrder.buyer_email, message: error.message },
      });
    }

    logInfo('Order delivery issued.', {
      requestId,
      orderNumber: updatedOrder.order_number,
      fulfillmentStatus: updatedOrder.fulfillment_status,
      buyerNotified,
    });

    return sendJson(res, 200, {
      order: {
        orderNumber: updatedOrder.order_number,
        offerCode: updatedOrder.offer_code,
        offerLabel: updatedOrder.offer_label,
        fulfillmentStatus: updatedOrder.fulfillment_status,
        fulfillmentDueAt: updatedOrder.fulfillment_due_at,
      },
      delivery: {
        id: delivery.id,
        summary: delivery.summary,
        message: delivery.message,
        links: delivery.links,
        deliveredAt: delivery.delivered_at,
      },
      buyerNotified,
      requestId,
    });
  } catch (error) {
    logError('Order delivery failed.', error, { requestId });
    return sendError(res, error, requestId);
  }
}
