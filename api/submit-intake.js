import { getEnv } from './_lib/env.js';
import {
  createHttpError,
  getRequestId,
  methodNotAllowed,
  normalizeEmail,
  optionalString,
  readJsonBody,
  sendError,
  sendJson,
} from './_lib/http.js';
import { logError, logInfo } from './_lib/logging.js';
import {
  findOrderByReference,
  insertOrderEvent,
  markOrderIntakeReceived,
  upsertOrderIntake,
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
    getEnv();

    if (req.method !== 'POST') {
      return methodNotAllowed(res, ['POST']);
    }

    const body = await readJsonBody(req, { maxBytes: 128 * 1024 });
    const orderNumber = String(body.orderNumber ?? body.order_number ?? '').trim();
    const sessionId = String(body.sessionId ?? body.session_id ?? '').trim();
    const buyerEmail = normalizeEmail(body.email ?? body.buyerEmail ?? body.buyer_email);

    const projectBackground = optionalString(body.projectBackground ?? body.project_background, {
      maxLength: 10000,
    });
    const currentStack = optionalString(body.currentStack ?? body.current_stack, {
      maxLength: 8000,
    });
    const constraints = optionalString(body.constraints, { maxLength: 8000 });
    const goals = optionalString(body.goals, { maxLength: 10000 });
    const priorities = optionalString(body.priorities, { maxLength: 8000 });
    const deliveryNotes = optionalString(body.deliveryNotes ?? body.delivery_notes, {
      maxLength: 8000,
    });
    const links = normalizeLinks(body.links);

    if (!orderNumber && !sessionId) {
      throw createHttpError(400, 'missing_order_reference', 'Provide orderNumber or sessionId.');
    }

    const hasMeaningfulContent = [
      projectBackground,
      currentStack,
      constraints,
      goals,
      priorities,
      deliveryNotes,
      ...links,
    ].some(Boolean);

    if (!hasMeaningfulContent) {
      throw createHttpError(400, 'empty_intake', 'Provide at least one intake field.');
    }

    const order = await findOrderByReference({ orderNumber, sessionId });

    if (!order) {
      throw createHttpError(404, 'order_not_found', 'Order not found.');
    }

    if (buyerEmail && buyerEmail !== order.buyer_email) {
      throw createHttpError(403, 'order_email_mismatch', 'Buyer email does not match the order record.');
    }

    if (order.payment_status !== 'paid') {
      throw createHttpError(409, 'order_not_paid', 'Intake is only available for paid orders.');
    }

    const intake = await upsertOrderIntake({
      orderId: order.id,
      submittedByEmail: buyerEmail || order.buyer_email,
      projectBackground,
      currentStack,
      constraints,
      goals,
      priorities,
      links,
      deliveryNotes,
      rawPayload: {
        orderNumber,
        sessionId,
        projectBackground,
        currentStack,
        constraints,
        goals,
        priorities,
        links,
        deliveryNotes,
      },
    });

    const updatedOrder = await markOrderIntakeReceived(order.id);

    await insertOrderEvent({
      orderId: updatedOrder.id,
      customerId: updatedOrder.customer_id,
      eventKind: 'order_intake_submitted',
      eventSource: 'api',
      stripeSessionId: updatedOrder.stripe_session_id,
      correlationKey: updatedOrder.correlation_key,
      payload: {
        intake_id: intake.id,
        submitted_by_email: buyerEmail || order.buyer_email,
        link_count: links.length,
      },
    });

    logInfo('Order intake submitted.', {
      requestId,
      orderNumber: updatedOrder.order_number,
      intakeId: intake.id,
    });

    return sendJson(res, 200, {
      order: {
        orderNumber: updatedOrder.order_number,
        offerCode: updatedOrder.offer_code,
        offerLabel: updatedOrder.offer_label,
        paymentStatus: updatedOrder.payment_status,
        fulfillmentStatus: updatedOrder.fulfillment_status,
        fulfillmentDueAt: updatedOrder.fulfillment_due_at,
        intakeSubmittedAt: updatedOrder.intake_submitted_at,
      },
      intake: {
        id: intake.id,
        submittedAt: intake.submitted_at,
        updatedAt: intake.updated_at,
        links: intake.links,
      },
      requestId,
    });
  } catch (error) {
    logError('Intake submission failed.', error, { requestId });
    return sendError(res, error, requestId);
  }
}
