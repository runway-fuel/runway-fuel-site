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
  assertNoClientPricingFields,
  generateCorrelationKey,
  resolveOffer,
} from './_lib/offers.js';
import { createOfferCheckoutSession } from './_lib/stripe.js';

export default async function handler(req, res) {
  const requestId = getRequestId(req);

  try {
    getEnv();

    if (req.method !== 'POST') {
      return methodNotAllowed(res, ['POST']);
    }

    const body = await readJsonBody(req, { maxBytes: 32 * 1024 });
    assertNoClientPricingFields(body);

    const offerCode = String(body.offerCode ?? body.offer_code ?? '').trim();
    const buyerEmail = normalizeEmail(body.email ?? body.buyerEmail ?? body.buyer_email);
    const buyerName = optionalString(body.name ?? body.buyerName ?? body.buyer_name, {
      maxLength: 200,
    });
    const organization = optionalString(body.organization, {
      maxLength: 200,
    });

    if (!offerCode) {
      throw createHttpError(400, 'missing_offer_code', 'offerCode is required.');
    }

    if (!buyerEmail) {
      throw createHttpError(400, 'invalid_email', 'A valid buyer email is required.');
    }

    const offer = resolveOffer(offerCode);
    const correlationKey = generateCorrelationKey();

    const session = await createOfferCheckoutSession({
      offer,
      correlationKey,
      buyer: {
        email: buyerEmail,
        name: buyerName,
        organization,
      },
    });

    logInfo('Checkout session created.', {
      requestId,
      sessionId: session.id,
      offerCode: offer.code,
      buyerEmail,
      correlationKey,
    });

    return sendJson(res, 200, {
      checkoutUrl: session.url,
      sessionId: session.id,
      offerCode: offer.code,
      offerLabel: offer.label,
      correlationKey,
      requestId,
    });
  } catch (error) {
    logError('Checkout session creation failed.', error, { requestId });
    return sendError(res, error, requestId);
  }
}
