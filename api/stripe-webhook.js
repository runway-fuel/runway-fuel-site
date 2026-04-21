import { sendBuyerOrderConfirmationEmail, sendInternalOrderNotificationEmail } from './_lib/email.js';
import { getEnv } from './_lib/env.js';
import {
  createHttpError,
  getRequestId,
  methodNotAllowed,
  readRawBody,
  sendError,
  sendJson,
} from './_lib/http.js';
import { logError, logInfo, logWarn } from './_lib/logging.js';
import { resolveOffer } from './_lib/offers.js';
import { verifyWebhookSignature } from './_lib/stripe.js';
import {
  createPaidOrderFromCheckoutSession,
  findOrderByStripeSessionId,
  insertOrderEvent,
  upsertCustomer,
} from './_lib/supabase.js';

export default async function handler(req, res) {
  const requestId = getRequestId(req);

  try {
    getEnv();

    if (req.method !== 'POST') {
      return methodNotAllowed(res, ['POST']);
    }

    const rawBody = await readRawBody(req, { maxBytes: 512 * 1024 });
    const stripeSignature = req.headers['stripe-signature'];
    const event = verifyWebhookSignature(rawBody, stripeSignature);

    if (event.type !== 'checkout.session.completed') {
      logInfo('Stripe webhook ignored.', {
        requestId,
        stripeEventId: event.id,
        eventType: event.type,
      });

      return sendJson(res, 200, {
        received: true,
        ignored: true,
        eventType: event.type,
        requestId,
      });
    }

    const session = event.data.object;

    if (!session?.id) {
      throw createHttpError(400, 'invalid_stripe_event', 'Stripe event is missing checkout session data.');
    }

    if (session.payment_status !== 'paid') {
      logWarn('Stripe checkout session completed without paid status.', {
        requestId,
        stripeEventId: event.id,
        sessionId: session.id,
        paymentStatus: session.payment_status,
      });

      await insertOrderEvent({
        eventKind: 'stripe_checkout_completed_unpaid',
        eventSource: 'stripe',
        stripeEventId: event.id,
        stripeEventType: event.type,
        stripeSessionId: session.id,
        correlationKey: session.metadata?.correlation_key || null,
        payload: {
          payment_status: session.payment_status,
          checkout_status: session.status,
        },
      });

      return sendJson(res, 200, {
        received: true,
        ignored: true,
        reason: 'session_not_paid',
        requestId,
      });
    }

    const offer = resolveOffer(session.metadata?.offer_code);
    const existingOrder = await findOrderByStripeSessionId(session.id);

    if (existingOrder) {
      await insertOrderEvent({
        orderId: existingOrder.id,
        customerId: existingOrder.customer_id,
        eventKind: 'stripe_checkout_replayed',
        eventSource: 'stripe',
        stripeEventId: event.id,
        stripeEventType: event.type,
        stripeSessionId: session.id,
        correlationKey: existingOrder.correlation_key,
        eventStatus: 'duplicate',
        payload: {
          replayDetected: true,
          order_number: existingOrder.order_number,
        },
      });

      logInfo('Stripe checkout session already processed.', {
        requestId,
        stripeEventId: event.id,
        sessionId: session.id,
        orderNumber: existingOrder.order_number,
      });

      return sendJson(res, 200, {
        received: true,
        processed: true,
        duplicate: true,
        orderNumber: existingOrder.order_number,
        requestId,
      });
    }

    const customer = await upsertCustomer({
      email: session.metadata?.buyer_email ?? session.customer_details?.email,
      name: session.metadata?.buyer_name ?? session.customer_details?.name ?? '',
      organization: session.metadata?.organization ?? '',
      stripeCustomerId:
        typeof session.customer === 'string' ? session.customer : session.customer?.id ?? null,
    });

    const paidAt = new Date((event.created ?? Math.floor(Date.now() / 1000)) * 1000);
    const { order, created } = await createPaidOrderFromCheckoutSession({
      session,
      customer,
      offer,
      paidAt,
    });

    await insertOrderEvent({
      orderId: order.id,
      customerId: order.customer_id,
      eventKind: created ? 'stripe_checkout_completed' : 'stripe_checkout_duplicate_session',
      eventSource: 'stripe',
      stripeEventId: event.id,
      stripeEventType: event.type,
      stripeSessionId: session.id,
      correlationKey: order.correlation_key,
      eventStatus: created ? 'recorded' : 'duplicate',
      payload: {
        offer_code: order.offer_code,
        amount_total_cents: order.amount_total_cents,
        payment_status: order.payment_status,
      },
    });

    let buyerEmailSent = false;
    let notificationEmailSent = false;

    if (created) {
      try {
        await sendBuyerOrderConfirmationEmail(order);
        buyerEmailSent = true;

        await insertOrderEvent({
          orderId: order.id,
          customerId: order.customer_id,
          eventKind: 'buyer_confirmation_email_sent',
          eventSource: 'resend',
          stripeSessionId: order.stripe_session_id,
          correlationKey: order.correlation_key,
          payload: {
            to: order.buyer_email,
          },
        });
      } catch (error) {
        logError('Buyer confirmation email failed.', error, {
          requestId,
          orderNumber: order.order_number,
        });

        await insertOrderEvent({
          orderId: order.id,
          customerId: order.customer_id,
          eventKind: 'buyer_confirmation_email_failed',
          eventSource: 'resend',
          stripeSessionId: order.stripe_session_id,
          correlationKey: order.correlation_key,
          eventStatus: 'failed',
          payload: {
            to: order.buyer_email,
            message: error.message,
          },
        });
      }

      try {
        await sendInternalOrderNotificationEmail(order);
        notificationEmailSent = true;

        await insertOrderEvent({
          orderId: order.id,
          customerId: order.customer_id,
          eventKind: 'internal_notification_email_sent',
          eventSource: 'resend',
          stripeSessionId: order.stripe_session_id,
          correlationKey: order.correlation_key,
          payload: {
            to: 'RUNWAY_FUEL_NOTIFICATION_EMAIL',
          },
        });
      } catch (error) {
        logError('Internal notification email failed.', error, {
          requestId,
          orderNumber: order.order_number,
        });

        await insertOrderEvent({
          orderId: order.id,
          customerId: order.customer_id,
          eventKind: 'internal_notification_email_failed',
          eventSource: 'resend',
          stripeSessionId: order.stripe_session_id,
          correlationKey: order.correlation_key,
          eventStatus: 'failed',
          payload: {
            to: 'RUNWAY_FUEL_NOTIFICATION_EMAIL',
            message: error.message,
          },
        });
      }
    }

    logInfo('Stripe checkout session processed.', {
      requestId,
      stripeEventId: event.id,
      sessionId: session.id,
      orderNumber: order.order_number,
      created,
      buyerEmailSent,
      notificationEmailSent,
    });

    return sendJson(res, 200, {
      received: true,
      processed: true,
      duplicate: !created,
      orderNumber: order.order_number,
      buyerEmailSent,
      notificationEmailSent,
      requestId,
    });
  } catch (error) {
    logError('Stripe webhook processing failed.', error, { requestId });
    return sendError(res, error, requestId);
  }
}
