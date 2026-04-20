# Terms of service

## Scope

These terms describe how the Runway Fuel backend expects one-time commercial orders to operate. They are written as deployment-ready operating terms for the current backend model and should be reviewed by counsel before public publication.

Runway Fuel sells fixed-scope, one-time offers. The backend does not support subscriptions, rolling credits, or open-ended prepaid balances. A paid order represents the purchase of a single defined offer mapped to a server-owned Stripe price.

## Commercial model

| Offer code | Offer label | Commercial posture |
| --- | --- | --- |
| `rf_diagnostic` | Runway Fuel Diagnostic | One-time paid analysis package |
| `rf_blueprint` | Runway Fuel Execution Blueprint | One-time structured deliverable |
| `rf_deposit` | Runway Fuel Implementation Deposit | One-time deposit toward a heavier engagement |

Payment is collected through Stripe Checkout. Prices are server-owned and may not be altered by the buyer through the public interface.

## Order acceptance

An order is considered accepted when Stripe reports a successful completed checkout and the backend records the paid order. Until that point, a browser redirect, a submitted form, or a draft checkout does not constitute an accepted commercial order.

## Buyer obligations

The buyer is responsible for supplying accurate contact information and any intake information required for fulfillment. If the buyer withholds material information, delays intake submission, or provides conflicting requirements, fulfillment timing may be affected.

## Delivery posture

Runway Fuel operates against the fulfillment status and deadline recorded in the backend. Delivery timing is managed operationally, and intake completion is part of the fulfillment process where applicable.

## Limitation of surface commitment

The public site and backend expose only the current commercial and operational surfaces required to collect payment, capture intake, and manage delivery state. Nothing in the public implementation should be interpreted as a commitment to subscriptions, platform access, perpetual support, or unbounded implementation scope.

## Governing update process

These terms should be reviewed whenever the canonical offer set, refund logic, or fulfillment process changes. Backend changes that affect customer obligations or delivery posture should be reflected here before production rollout.
