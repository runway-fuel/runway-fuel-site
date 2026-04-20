import { randomUUID } from 'node:crypto';

import { getEnv } from './env.js';
import { createHttpError } from './http.js';

const OFFER_CATALOG = Object.freeze({
  rf_diagnostic: Object.freeze({
    code: 'rf_diagnostic',
    label: 'Runway Fuel Diagnostic',
    description: 'Paid analysis package',
    priceIdEnvKey: 'RUNWAY_FUEL_DIAGNOSTIC_PRICE_ID',
    slaBusinessDays: 3,
  }),
  rf_blueprint: Object.freeze({
    code: 'rf_blueprint',
    label: 'Runway Fuel Execution Blueprint',
    description: 'Deeper structured deliverable',
    priceIdEnvKey: 'RUNWAY_FUEL_BLUEPRINT_PRICE_ID',
    slaBusinessDays: 5,
  }),
  rf_deposit: Object.freeze({
    code: 'rf_deposit',
    label: 'Runway Fuel Implementation Deposit',
    description: 'Deposit toward a heavier execution engagement',
    priceIdEnvKey: 'RUNWAY_FUEL_DEPOSIT_PRICE_ID',
    slaBusinessDays: 2,
  }),
});

const FORBIDDEN_CLIENT_PRICE_FIELDS = Object.freeze([
  'amount',
  'amount_total',
  'amountSubtotal',
  'amountTotal',
  'currency',
  'line_items',
  'lineItems',
  'price',
  'price_id',
  'priceId',
  'unit_amount',
  'unitAmount',
]);

export function getOfferCatalog() {
  return OFFER_CATALOG;
}

export function assertNoClientPricingFields(payload) {
  const forbiddenFields = FORBIDDEN_CLIENT_PRICE_FIELDS.filter((field) =>
    Object.prototype.hasOwnProperty.call(payload, field),
  );

  if (forbiddenFields.length > 0) {
    throw createHttpError(
      400,
      'client_pricing_rejected',
      `Client pricing input is not allowed: ${forbiddenFields.join(', ')}.`,
    );
  }
}

export function resolveOffer(offerCode) {
  const normalizedCode = String(offerCode ?? '').trim();
  const offer = OFFER_CATALOG[normalizedCode];

  if (!offer) {
    throw createHttpError(400, 'unknown_offer', 'Unknown offer code.');
  }

  const env = getEnv();
  const priceId = env[offer.priceIdEnvKey];

  if (!priceId) {
    throw createHttpError(
      500,
      'CONFIG_ERROR',
      `Missing Stripe price ID for offer ${offer.code}. Expected ${offer.priceIdEnvKey}.`,
    );
  }

  return {
    ...offer,
    priceId,
  };
}

export function generateCorrelationKey() {
  return `rfck_${randomUUID().replaceAll('-', '')}`;
}

export function generateOrderNumber() {
  return `rford_${randomUUID().replaceAll('-', '').slice(0, 20)}`;
}

function addBusinessDays(startDate, businessDays) {
  const date = new Date(startDate);
  let remaining = businessDays;

  while (remaining > 0) {
    date.setUTCDate(date.getUTCDate() + 1);
    const dayOfWeek = date.getUTCDay();

    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      remaining -= 1;
    }
  }

  return date;
}

export function calculateFulfillmentDueAt(offerCode, paidAt = new Date()) {
  const offer = OFFER_CATALOG[offerCode];

  if (!offer) {
    throw createHttpError(400, 'unknown_offer', 'Unknown offer code.');
  }

  return addBusinessDays(paidAt, offer.slaBusinessDays).toISOString();
}

export function buildSuccessUrl() {
  const env = getEnv();
  return `${env.APP_BASE_URL}/?checkout=success&session_id={CHECKOUT_SESSION_ID}`;
}

export function buildCancelUrl() {
  const env = getEnv();
  return `${env.APP_BASE_URL}/?checkout=cancelled`;
}
