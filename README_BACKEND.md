# Runway Fuel Backend

## Overview

This backend adds a production-oriented commercial layer to the existing **Runway Fuel** Vite site without replatforming the frontend. The runtime model stays deliberately simple: the public site is built by Vite, the backend is exposed through Vercel serverless API routes, **Stripe** owns checkout and webhook authenticity, **Supabase** owns persistence, and **Resend** owns transactional delivery.

The commercial model is intentionally narrow. Runway Fuel sells **one-time offers only**, and the server is the sole authority for offer identity and price mapping. Client requests may ask for an offer code, but they are never allowed to choose an amount, a Stripe price, or any other commercial value.

## Backend surface

| Path | Responsibility |
| --- | --- |
| `api/_lib/env.js` | Validates the full environment contract and fails fast on missing configuration |
| `api/_lib/http.js` | Request parsing, JSON boundary checks, auth helpers, and response utilities |
| `api/_lib/offers.js` | Canonical Runway Fuel offers, Stripe price mapping, and SLA calculation |
| `api/_lib/stripe.js` | Stripe client initialization, checkout session creation, and webhook verification |
| `api/_lib/supabase.js` | Supabase service-role access for customers, orders, intakes, and event logs |
| `api/_lib/email.js` | Buyer confirmations and internal notification delivery through Resend |
| `api/_lib/logging.js` | Structured logging for requests, failures, and operational events |
| `api/create-checkout-session.js` | Secure Stripe Checkout session creation |
| `api/stripe-webhook.js` | Idempotent Stripe payment event ingestion |
| `api/submit-intake.js` | Structured post-purchase intake submission |
| `api/get-order.js` | Safe order lookup for success and fulfillment flows |
| `api/get-usage.js` | Admin-only reporting surface |
| `supabase/001_runway_fuel_core.sql` | Core schema, constraints, triggers, and indexes |
| `supabase/002_runway_fuel_policies.sql` | Row-level security and direct-access restrictions |

## Canonical offers

| Offer code | Label | Server-owned Stripe env key | Default operational SLA |
| --- | --- | --- | --- |
| `rf_diagnostic` | Runway Fuel Diagnostic | `RUNWAY_FUEL_DIAGNOSTIC_PRICE_ID` | 3 business days |
| `rf_blueprint` | Runway Fuel Execution Blueprint | `RUNWAY_FUEL_BLUEPRINT_PRICE_ID` | 5 business days |
| `rf_deposit` | Runway Fuel Implementation Deposit | `RUNWAY_FUEL_DEPOSIT_PRICE_ID` | 2 business days |

These SLA values are stored in `api/_lib/offers.js` as backend-owned operational defaults. They control the `fulfillment_due_at` value written to each paid order.

## Environment contract

Every route imports the same environment helper and will fail clearly if any required key is missing.

| Variable | Purpose |
| --- | --- |
| `APP_BASE_URL` | Canonical public origin used for checkout success and cancel redirects |
| `STRIPE_SECRET_KEY` | Stripe secret key used for Checkout API calls |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret used for raw-body verification |
| `VITE_STRIPE_PUBLISHABLE_KEY` | Frontend publishable key for future checkout client integration |
| `RUNWAY_FUEL_DIAGNOSTIC_PRICE_ID` | Stripe price ID for `rf_diagnostic` |
| `RUNWAY_FUEL_BLUEPRINT_PRICE_ID` | Stripe price ID for `rf_blueprint` |
| `RUNWAY_FUEL_DEPOSIT_PRICE_ID` | Stripe price ID for `rf_deposit` |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service-role key for server-only persistence |
| `RESEND_API_KEY` | Resend API key for transactional email |
| `RUNWAY_FUEL_FROM_EMAIL` | Verified sender used for transactional email |
| `RUNWAY_FUEL_NOTIFICATION_EMAIL` | Internal notification recipient |
| `ADMIN_API_TOKEN` | Bearer token required by `/api/get-usage` |

## Data model

The persistence layer is intentionally boring. Buyers are stored in `rf_customers`, commercial orders are stored in `rf_orders`, structured fulfillment intake is stored in `rf_order_intakes`, and immutable operational history is stored in `rf_order_events`.

| Table | Key guarantees |
| --- | --- |
| `rf_customers` | One normalized buyer email per customer row, optional unique Stripe customer ID |
| `rf_orders` | Unique `order_number`, `correlation_key`, and `stripe_session_id` |
| `rf_order_intakes` | One upsertable intake record per order |
| `rf_order_events` | Immutable event entries with unique `stripe_event_id` when present |

## Route contract summary

| Route | Method | Public or private | Primary job |
| --- | --- | --- | --- |
| `/api/create-checkout-session` | `POST` | Public | Validates request shape and creates a Stripe Checkout session for a canonical offer |
| `/api/stripe-webhook` | `POST` | Stripe-only | Verifies the raw signed payload, persists the paid order, and logs operational events |
| `/api/submit-intake` | `POST` | Buyer flow | Stores structured intake on an existing paid order |
| `/api/get-order` | `GET` | Buyer flow | Returns a single order summary without exposing unrelated records |
| `/api/get-usage` | `GET` | Admin only | Returns revenue and status summaries behind Bearer token auth |

## Order lifecycle

A checkout request starts with a canonical offer code and buyer identity. Stripe then owns payment collection. When the signed webhook confirms a completed paid checkout, the backend upserts the buyer, creates the order, records an event, calculates a fulfillment deadline, and attempts transactional email delivery. Intake submission moves the order from `paid` to `intake_received`, which gives operations a clear handoff point.

## Validation expectation

A backend change is not considered complete until the repository passes installation, frontend build, and deterministic syntax checks for every backend JavaScript file. The final validation commands are documented in `docs/backend-deployment.md` and mirrored in the delivery report.
