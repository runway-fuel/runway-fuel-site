// Stand-in for api/_lib/email.js used by the C2 loop tests.
// Records every send so tests can assert the loop fired the right notifications.

export const sent = [];

export function resetSent() {
  sent.length = 0;
}

export async function sendBuyerOrderConfirmationEmail(order) {
  sent.push({ kind: 'buyer_confirmation', to: order.buyer_email });
  return { id: 'mock' };
}

export async function sendInternalOrderNotificationEmail(order) {
  sent.push({ kind: 'internal_notification', orderNumber: order.order_number });
  return { id: 'mock' };
}

export async function sendOperatorIntakeNotificationEmail(order) {
  sent.push({ kind: 'operator_intake_notification', orderNumber: order.order_number });
  return { id: 'mock' };
}

export async function sendBuyerIntakeAckEmail(order) {
  sent.push({ kind: 'buyer_intake_ack', to: order.buyer_email });
  return { id: 'mock' };
}

export async function sendBuyerDeliveryEmail(order, delivery) {
  sent.push({ kind: 'buyer_delivery', to: order.buyer_email, summary: delivery.summary });
  return { id: 'mock' };
}
