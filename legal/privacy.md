# Privacy policy

## Purpose

This document describes the data handling posture implied by the current backend implementation. It is operationally coherent with the repository, but it should still be reviewed by legal counsel before being treated as final public policy.

## Data collected through the backend

The backend stores only the information required to sell one-time offers, confirm payment, coordinate fulfillment, and operate internal reporting.

| Data category | Typical fields |
| --- | --- |
| Buyer identity | Name, email address, organization |
| Commercial order data | Offer code, offer label, Stripe session ID, payment intent ID, paid amount, currency, payment status |
| Fulfillment intake | Project background, current stack, goals, priorities, constraints, links, delivery notes |
| Operational logging | Event type, event source, timestamps, correlation keys, structured payload fragments |

## Data processors

| Processor | Role |
| --- | --- |
| Stripe | Checkout and payment event processing |
| Supabase | Persistence for customers, orders, intakes, and event logs |
| Resend | Transactional email delivery |
| Vercel | Hosting of the public site and serverless API routes |

## Why the data is processed

Buyer identity is required to create checkout sessions, associate payments with a real customer, and coordinate fulfillment. Payment and order data are processed to maintain an authoritative commercial record. Intake data is processed to deliver the purchased work. Operational event data is processed to diagnose failures, confirm state transitions, and support internal operations.

## Access posture

The database tables created for this backend are not intended for direct public client access. Row-level security is enabled, and the backend uses a Supabase service-role key server-side for controlled access. Internal reporting is protected behind a Bearer token.

## Retention posture

This implementation retains commercial and operational records as durable business records unless the business adopts a narrower retention policy. Because revenue records, fulfillment state, and payment events may be required for accounting, support, and dispute handling, deletion should be handled intentionally rather than automatically.

## Operational caution

The service-role key, webhook secret, and admin token must remain server-side only. They must never be embedded into frontend JavaScript or exposed through client-readable configuration.
