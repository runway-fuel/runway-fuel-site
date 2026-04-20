# Fulfillment policy

## Fulfillment model

Runway Fuel fulfills one-time service offers through a structured operational workflow rather than instant digital entitlement. The backend reflects that model through explicit order statuses and intake capture.

## Backend status meanings

| Status | Operational meaning |
| --- | --- |
| `paid` | Payment is confirmed and the order is waiting for intake or operational kickoff |
| `intake_received` | Structured buyer intake has been submitted and the order is ready for active handling |
| `in_progress` | Delivery work is underway |
| `delivery_sent` | The primary deliverable or next delivery packet has been sent |
| `completed` | The order has been fulfilled |
| `blocked` | The order cannot proceed without additional input or a dependency resolution |
| `canceled` | The order has been closed without further fulfillment |

## Intake requirement

For delivery-sensitive work, the buyer may need to submit structured intake after payment. Until intake is received, the backend can truthfully record the order as paid without implying that active execution has already started.

## Delivery timing

The backend calculates a default operational deadline at the moment a paid order is recorded. That deadline is stored as `fulfillment_due_at` and is intended to guide internal operations. It is not a substitute for a custom statement of work where a more specific fulfillment plan has been agreed.

## Operational visibility

The internal reporting endpoint and event log are intended to support fulfillment oversight. Operators should update order status as work progresses so that the backend remains a truthful operational record instead of a stale payment ledger.
