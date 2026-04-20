import { Resend } from 'resend';

import { getEnv } from './env.js';
import { createHttpError } from './http.js';

let resendClient;

function getResendClient() {
  if (!resendClient) {
    const env = getEnv();
    resendClient = new Resend(env.RESEND_API_KEY);
  }

  return resendClient;
}

function formatCurrency(amountInCents, currency) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: String(currency || 'USD').toUpperCase(),
  }).format((amountInCents || 0) / 100);
}

export async function sendBuyerOrderConfirmationEmail(order) {
  const env = getEnv();
  const resend = getResendClient();
  const amount = formatCurrency(order.amount_total_cents, order.currency);

  const { data, error } = await resend.emails.send({
    from: env.RUNWAY_FUEL_FROM_EMAIL,
    to: order.buyer_email,
    replyTo: env.RUNWAY_FUEL_NOTIFICATION_EMAIL,
    subject: `${order.offer_label} — payment received`,
    text: [
      `Hello ${order.buyer_name || 'there'},`,
      '',
      `Your payment for ${order.offer_label} has been received.`,
      `Order number: ${order.order_number}`,
      `Amount: ${amount}`,
      `Fulfillment status: ${order.fulfillment_status}`,
      `Operational deadline: ${order.fulfillment_due_at}`,
      '',
      'Reply to this email if you need to add context before intake submission.',
      '',
      'Runway Fuel',
    ].join('\n'),
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111827;">
        <p>Hello ${order.buyer_name || 'there'},</p>
        <p>Your payment for <strong>${order.offer_label}</strong> has been received.</p>
        <table style="border-collapse: collapse; margin: 16px 0;">
          <tr><td style="padding: 4px 12px 4px 0;"><strong>Order number</strong></td><td>${order.order_number}</td></tr>
          <tr><td style="padding: 4px 12px 4px 0;"><strong>Amount</strong></td><td>${amount}</td></tr>
          <tr><td style="padding: 4px 12px 4px 0;"><strong>Fulfillment status</strong></td><td>${order.fulfillment_status}</td></tr>
          <tr><td style="padding: 4px 12px 4px 0;"><strong>Operational deadline</strong></td><td>${order.fulfillment_due_at}</td></tr>
        </table>
        <p>Reply to this email if you need to add context before intake submission.</p>
        <p>Runway Fuel</p>
      </div>
    `,
  });

  if (error) {
    throw createHttpError(502, 'resend_buyer_email_failed', error.message);
  }

  return data;
}

export async function sendInternalOrderNotificationEmail(order) {
  const env = getEnv();
  const resend = getResendClient();
  const amount = formatCurrency(order.amount_total_cents, order.currency);

  const { data, error } = await resend.emails.send({
    from: env.RUNWAY_FUEL_FROM_EMAIL,
    to: env.RUNWAY_FUEL_NOTIFICATION_EMAIL,
    subject: `New paid order: ${order.offer_label} (${order.order_number})`,
    text: [
      'A new paid order has been recorded.',
      '',
      `Order number: ${order.order_number}`,
      `Offer: ${order.offer_label}`,
      `Buyer: ${order.buyer_name || 'N/A'} <${order.buyer_email}>`,
      `Organization: ${order.organization || 'N/A'}`,
      `Amount: ${amount}`,
      `Fulfillment due at: ${order.fulfillment_due_at}`,
      `Stripe session ID: ${order.stripe_session_id}`,
    ].join('\n'),
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111827;">
        <p>A new paid order has been recorded.</p>
        <table style="border-collapse: collapse; margin: 16px 0;">
          <tr><td style="padding: 4px 12px 4px 0;"><strong>Order number</strong></td><td>${order.order_number}</td></tr>
          <tr><td style="padding: 4px 12px 4px 0;"><strong>Offer</strong></td><td>${order.offer_label}</td></tr>
          <tr><td style="padding: 4px 12px 4px 0;"><strong>Buyer</strong></td><td>${order.buyer_name || 'N/A'} &lt;${order.buyer_email}&gt;</td></tr>
          <tr><td style="padding: 4px 12px 4px 0;"><strong>Organization</strong></td><td>${order.organization || 'N/A'}</td></tr>
          <tr><td style="padding: 4px 12px 4px 0;"><strong>Amount</strong></td><td>${amount}</td></tr>
          <tr><td style="padding: 4px 12px 4px 0;"><strong>Fulfillment due at</strong></td><td>${order.fulfillment_due_at}</td></tr>
          <tr><td style="padding: 4px 12px 4px 0;"><strong>Stripe session ID</strong></td><td>${order.stripe_session_id}</td></tr>
        </table>
      </div>
    `,
  });

  if (error) {
    throw createHttpError(502, 'resend_notification_email_failed', error.message);
  }

  return data;
}
