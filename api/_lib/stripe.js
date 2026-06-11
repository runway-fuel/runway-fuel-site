import Stripe from 'stripe';

import { getEnv } from './env.js';
import { buildCancelUrl, buildSuccessUrl } from './offers.js';
import { createHttpError } from './http.js';

let stripeClient;

export function getStripeClient() {
  if (!stripeClient) {
    const env = getEnv();

    stripeClient = new Stripe(env.STRIPE_SECRET_KEY, {
      appInfo: {
        name: 'Runway Fuel Backend',
        version: '1.0.0',
      },
    });
  }

  return stripeClient;
}

export async function createOfferCheckoutSession({ offer, buyer, correlationKey, orderToken }) {
  const stripe = getStripeClient();

  return stripe.checkout.sessions.create({
    mode: 'payment',
    success_url: buildSuccessUrl({ orderToken }),
    cancel_url: buildCancelUrl(),
    customer_creation: 'always',
    customer_email: buyer.email,
    billing_address_collection: 'auto',
    payment_method_types: ['card'],
    line_items: [
      {
        price: offer.priceId,
        quantity: 1,
      },
    ],
    metadata: {
      offer_code: offer.code,
      offer_label: offer.label,
      buyer_email: buyer.email,
      buyer_name: buyer.name,
      organization: buyer.organization,
      correlation_key: correlationKey,
    },
  });
}

export function verifyWebhookSignature(rawBody, stripeSignature) {
  if (!stripeSignature) {
    throw createHttpError(400, 'missing_stripe_signature', 'Missing Stripe signature header.');
  }

  const env = getEnv();
  const stripe = getStripeClient();

  try {
    return stripe.webhooks.constructEvent(rawBody, stripeSignature, env.STRIPE_WEBHOOK_SECRET);
  } catch (error) {
    throw createHttpError(400, 'invalid_stripe_signature', 'Stripe webhook signature verification failed.');
  }
}
