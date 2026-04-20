# Backend integration contract

## Integration posture

The existing frontend remains the source of presentation and interaction, while the backend becomes the source of commercial truth, order state, and operational persistence. The frontend must never compute prices, choose Stripe price IDs, or infer entitlement from UI state alone.

## Canonical offer contract

The frontend may request only one of the following server-owned offer codes.

| Offer code | Meaning |
| --- | --- |
| `rf_diagnostic` | Runway Fuel Diagnostic |
| `rf_blueprint` | Runway Fuel Execution Blueprint |
| `rf_deposit` | Runway Fuel Implementation Deposit |

Any other code is rejected by the backend.

## 1. Checkout creation

### Request

**Endpoint**

```text
POST /api/create-checkout-session
```

**Headers**

```text
Content-Type: application/json
```

**Body**

```json
{
  "offerCode": "rf_diagnostic",
  "email": "buyer@example.com",
  "name": "Buyer Name",
  "organization": "Buyer Organization"
}
```

### Response

```json
{
  "checkoutUrl": "https://checkout.stripe.com/c/pay/...",
  "sessionId": "cs_test_...",
  "offerCode": "rf_diagnostic",
  "offerLabel": "Runway Fuel Diagnostic",
  "correlationKey": "rfck_...",
  "requestId": "..."
}
```

### Frontend behavior

The frontend should collect the buyer identity fields, call this endpoint, and immediately redirect the browser to `checkoutUrl`. The frontend must not send any price, amount, currency, or Stripe price ID.

## 2. Success-page order lookup

### Request

**Endpoint**

```text
GET /api/get-order?session_id=cs_test_...
```

An optional `email` query parameter may be supplied if the frontend wants the backend to return verified intake details for the same buyer.

### Response

```json
{
  "order": {
    "orderNumber": "rford_...",
    "offerCode": "rf_diagnostic",
    "offerLabel": "Runway Fuel Diagnostic",
    "currency": "usd",
    "amountTotalCents": 50000,
    "paymentStatus": "paid",
    "fulfillmentStatus": "paid",
    "fulfillmentDueAt": "2026-04-24T12:00:00.000Z",
    "paidAt": "2026-04-21T12:00:00.000Z",
    "organization": "Buyer Organization",
    "buyerName": "Buyer Name",
    "buyerEmailMasked": "bu***@example.com",
    "stripeSessionId": "cs_test_..."
  },
  "intake": null,
  "requestId": "..."
}
```

### Frontend behavior

After Stripe redirects the user back to `/?checkout=success&session_id={CHECKOUT_SESSION_ID}`, the frontend should read `session_id` from the URL and call `GET /api/get-order`. The response can then drive a success state, confirmation panel, or intake handoff.

## 3. Structured intake submission

### Request

**Endpoint**

```text
POST /api/submit-intake
```

**Headers**

```text
Content-Type: application/json
```

**Body**

```json
{
  "sessionId": "cs_test_...",
  "email": "buyer@example.com",
  "projectBackground": "Current environment and operating problem.",
  "currentStack": "Current software, tooling, and integrations.",
  "constraints": "Security, compliance, or resource constraints.",
  "goals": "What success must look like.",
  "priorities": "What matters first.",
  "links": [
    "https://example.com/spec",
    "https://example.com/repo"
  ],
  "deliveryNotes": "Anything delivery-critical."
}
```

### Response

```json
{
  "order": {
    "orderNumber": "rford_...",
    "offerCode": "rf_diagnostic",
    "offerLabel": "Runway Fuel Diagnostic",
    "paymentStatus": "paid",
    "fulfillmentStatus": "intake_received",
    "fulfillmentDueAt": "2026-04-24T12:00:00.000Z",
    "intakeSubmittedAt": "2026-04-21T13:00:00.000Z"
  },
  "intake": {
    "id": "...",
    "submittedAt": "2026-04-21T13:00:00.000Z",
    "updatedAt": "2026-04-21T13:00:00.000Z",
    "links": [
      "https://example.com/spec",
      "https://example.com/repo"
    ]
  },
  "requestId": "..."
}
```

### Frontend behavior

The frontend should present intake only after a paid order exists. It should keep the `sessionId` from the Stripe redirect URL or the `orderNumber` from `/api/get-order`, then submit intake against that stable reference.

## 4. Admin reporting

### Request

**Endpoint**

```text
GET /api/get-usage
```

**Headers**

```text
Authorization: Bearer YOUR_ADMIN_API_TOKEN
```

### Response shape

The response contains a top-level `summary`, `revenueByOffer`, `statusDistribution`, and `recentOrders` object set. This route is for internal operations only and must never be called from public browser code.

## Error contract

Every route returns JSON. Failures follow a consistent shape.

```json
{
  "error": {
    "code": "invalid_json",
    "message": "Malformed JSON request body."
  },
  "requestId": "..."
}
```

## Frontend implementation notes

| Concern | Required frontend behavior |
| --- | --- |
| Offer selection | Send only the canonical offer code |
| Price display | Treat any displayed amount as informational only; the server remains authoritative |
| Redirect after checkout creation | Use `window.location.assign(checkoutUrl)` |
| Success lookup | Read `session_id` from the URL query string |
| Intake security | Include the buyer email if the frontend wants verified intake detail reads |
| Admin reporting | Keep Bearer token use strictly server-side or operator-only |
