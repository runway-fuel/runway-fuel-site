# Webhook operations

## Purpose

The Stripe webhook is the system of record for paid-order creation. If checkout succeeds in Stripe but the webhook is not delivered, the backend will not create the corresponding order row. For that reason, webhook health is a first-class operational concern rather than an optional integration detail.

## Endpoint

| Environment | Endpoint |
| --- | --- |
| Production | `https://YOUR_DOMAIN/api/stripe-webhook` |
| Local or temporary testing | Use a Stripe-forwarded local tunnel that targets the same route path |

## Supported event handling

| Event type | Current behavior |
| --- | --- |
| `checkout.session.completed` | Verifies the signature, checks for paid status, upserts the customer, creates the order, records events, and attempts email delivery |
| Any other event | Returns a successful receipt and logs the event as ignored |

## Idempotency model

The webhook route protects against double-processing in two ways. First, `rf_orders.stripe_session_id` is unique, which prevents duplicate order creation for the same checkout session. Second, `rf_order_events.stripe_event_id` is unique when present, which prevents the same Stripe event from being recorded multiple times. Replayed deliveries therefore remain safe.

## What to inspect when something goes wrong

| Symptom | First place to inspect | Likely issue |
| --- | --- | --- |
| Stripe shows repeated webhook retries | Vercel function logs for `/api/stripe-webhook` | Signature mismatch, runtime error, or missing environment variable |
| Checkout completed but no order exists | `rf_order_events` and `rf_orders` | Webhook delivery failure or invalid webhook secret |
| Order exists but buyer email was not sent | `rf_order_events` rows with `event_kind` ending in `_email_failed` | Resend API failure or sender configuration problem |
| Same order appears twice in operator UI | `rf_orders` uniqueness guarantees should prevent this | Investigate any external mirror or manual duplication, not the core webhook route |

## Replay procedure

If Stripe marks a delivery as failed, fix the underlying cause first. Then replay the event from the Stripe dashboard. Because the backend is idempotent, replaying a completed checkout should either create the missing order exactly once or return a duplicate-safe success if the order already exists.

## Required invariants

| Invariant | Why it matters |
| --- | --- |
| `STRIPE_WEBHOOK_SECRET` must match the exact deployed endpoint secret | Signature verification depends on it |
| The webhook route must receive the raw request body | Stripe signatures break if the body is parsed or mutated first |
| `checkout.session.completed` must remain subscribed in Stripe | Without it, paid orders never enter the database |
| `stripe_session_id` must stay unique in `rf_orders` | This is the main duplicate-order safety rail |

## Safe operating practice

Do not create paid orders from the browser redirect alone. The browser success page is for presentation and confirmation only. The authoritative state change happens in the signed webhook flow.
