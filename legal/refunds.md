# Refund policy

## Policy posture

This backend is built for one-time service offers, not subscriptions or metered access. Refund handling therefore needs to be explicit and tied to the fulfillment status of each order.

## Operational policy summary

| Order stage | Refund posture |
| --- | --- |
| Paid, intake not yet submitted | Reviewable on a case-by-case basis |
| Intake submitted and work not yet started | Partial or discretionary review may apply |
| Work in progress or delivery already sent | Generally non-refundable except where required by law or explicit written agreement |
| Duplicate payment caused by technical error | Correct in full after verification |

## Backend interaction

The current backend records `payment_status`, `fulfillment_status`, and order events, but it does not execute automated refund decisions. Refund execution should happen in Stripe under operator control, with the resulting outcome reflected operationally in the order record and event log if refund workflows are added later.

## Buyer communication

If a refund is granted, the operator should communicate the scope, timing, and amount clearly to the buyer. Backend reporting should then be updated or extended so the internal revenue view remains truthful.

## Review requirement

This document is an operational placeholder suitable for deployment hardening, but it should be reviewed by legal counsel and adjusted to the jurisdiction, offer scope, and actual delivery terms used by the business.
