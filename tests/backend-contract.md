# Backend contract test checklist

## Purpose

This file defines the contract-level verification checklist for the Runway Fuel backend. It is intentionally written as an operator test plan rather than an automated test suite, because the most important assertions here cross Stripe, Vercel, Supabase, and Resend.

## Contract checks

| Surface | Test input | Expected outcome |
| --- | --- | --- |
| `POST /api/create-checkout-session` | Valid canonical offer and buyer email | Returns `200` with `checkoutUrl`, `sessionId`, `offerCode`, and `offerLabel` |
| `POST /api/create-checkout-session` | Unknown `offerCode` | Returns `400` with `unknown_offer` |
| `POST /api/create-checkout-session` | Any client price field | Returns `400` with `client_pricing_rejected` |
| `POST /api/create-checkout-session` | Malformed JSON | Returns `400` with `invalid_json` |
| `POST /api/stripe-webhook` | Valid signed `checkout.session.completed` for a paid session | Creates one customer, one order, and one order event |
| `POST /api/stripe-webhook` replay | Same completed session delivered again | Returns success without creating a second order |
| `POST /api/submit-intake` | Valid paid order reference with structured intake | Stores intake and changes status to `intake_received` |
| `GET /api/get-order` | Valid `session_id` or `order_number` | Returns only that order |
| `GET /api/get-usage` | Missing or invalid Bearer token | Returns `401` or `403` |
| `GET /api/get-usage` | Valid Bearer token | Returns revenue, status distribution, and recent orders |

## Persistence checks

| Table | Assertion |
| --- | --- |
| `rf_customers` | Buyer email is normalized and unique |
| `rf_orders` | `stripe_session_id` is unique |
| `rf_order_intakes` | One intake record exists per order |
| `rf_order_events` | Stripe event IDs are unique when present |

## Validation commands

```bash
pnpm install
pnpm build
node --check api/_lib/env.js
node --check api/_lib/http.js
node --check api/_lib/offers.js
node --check api/_lib/stripe.js
node --check api/_lib/supabase.js
node --check api/_lib/email.js
node --check api/_lib/logging.js
node --check api/create-checkout-session.js
node --check api/stripe-webhook.js
node --check api/submit-intake.js
node --check api/get-order.js
node --check api/get-usage.js
```
