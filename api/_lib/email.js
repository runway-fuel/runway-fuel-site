import { Resend } from 'resend';

import { getEnv } from './env.js';
import { createHttpError } from './http.js';
import { EMAIL_LINK_TTL_SECONDS, mintOrderAccessToken } from './order-access.js';

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

  // A longer-lived, signed link that lets the buyer return to view their order
  // without re-entering their email. Bound to this order's correlation key.
  const orderToken = mintOrderAccessToken({
    correlationKey: order.correlation_key,
    email: order.buyer_email,
    ttlSeconds: EMAIL_LINK_TTL_SECONDS,
  });
  const orderUrl =
    `${env.APP_BASE_URL}/?checkout=success` +
    `&session_id=${encodeURIComponent(order.stripe_session_id)}` +
    `&order_token=${encodeURIComponent(orderToken)}`;

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
      `View your order: ${orderUrl}`,
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
        <p><a href="${orderUrl}" style="display: inline-block; padding: 10px 18px; background: #111827; color: #ffffff; text-decoration: none; border-radius: 6px;">View your order</a></p>
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

function buildOrderUrl(env, order, ttlSeconds) {
  const orderToken = mintOrderAccessToken({
    correlationKey: order.correlation_key,
    email: order.buyer_email,
    ttlSeconds,
  });
  return (
    `${env.APP_BASE_URL}/?checkout=success` +
    `&session_id=${encodeURIComponent(order.stripe_session_id)}` +
    `&order_token=${encodeURIComponent(orderToken)}`
  );
}

export async function sendOperatorIntakeNotificationEmail(order, intake) {
  const env = getEnv();
  const resend = getResendClient();
  const links = Array.isArray(intake?.links) ? intake.links : [];

  const { data, error } = await resend.emails.send({
    from: env.RUNWAY_FUEL_FROM_EMAIL,
    to: env.RUNWAY_FUEL_NOTIFICATION_EMAIL,
    replyTo: order.buyer_email,
    subject: `Intake received: ${order.offer_label} (${order.order_number})`,
    text: [
      'A buyer has submitted their project intake. This order is ready for active handling.',
      '',
      `Order number: ${order.order_number}`,
      `Offer: ${order.offer_label}`,
      `Buyer: ${order.buyer_name || 'N/A'} <${order.buyer_email}>`,
      `Organization: ${order.organization || 'N/A'}`,
      `Fulfillment due at: ${order.fulfillment_due_at}`,
      '',
      `Project background: ${intake?.project_background || 'N/A'}`,
      `Current stack: ${intake?.current_stack || 'N/A'}`,
      `Constraints: ${intake?.constraints || 'N/A'}`,
      `Goals: ${intake?.goals || 'N/A'}`,
      `Priorities: ${intake?.priorities || 'N/A'}`,
      `Delivery notes: ${intake?.delivery_notes || 'N/A'}`,
      `Links: ${links.length ? links.join(', ') : 'N/A'}`,
      '',
      `Deliver with: node scripts/deliver.mjs --order ${order.order_number} --summary "..." --link https://...`,
    ].join('\n'),
  });

  if (error) {
    throw createHttpError(502, 'resend_intake_notification_failed', error.message);
  }

  return data;
}

export async function sendBuyerIntakeAckEmail(order) {
  const env = getEnv();
  const resend = getResendClient();
  const orderUrl = buildOrderUrl(env, order, EMAIL_LINK_TTL_SECONDS);

  const { data, error } = await resend.emails.send({
    from: env.RUNWAY_FUEL_FROM_EMAIL,
    to: order.buyer_email,
    replyTo: env.RUNWAY_FUEL_NOTIFICATION_EMAIL,
    subject: `We received your brief — ${order.offer_label}`,
    text: [
      `Hello ${order.buyer_name || 'there'},`,
      '',
      'Thank you — your project intake has been received and your engagement is now in our queue for active handling.',
      `Target delivery: ${order.fulfillment_due_at}`,
      '',
      `Track your order: ${orderUrl}`,
      '',
      'Runway Fuel',
    ].join('\n'),
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111827;">
        <p>Hello ${order.buyer_name || 'there'},</p>
        <p>Thank you — your project intake has been received and your engagement is now in our queue for active handling.</p>
        <p><strong>Target delivery:</strong> ${order.fulfillment_due_at}</p>
        <p><a href="${orderUrl}" style="display: inline-block; padding: 10px 18px; background: #111827; color: #ffffff; text-decoration: none; border-radius: 6px;">Track your order</a></p>
        <p>Runway Fuel</p>
      </div>
    `,
  });

  if (error) {
    throw createHttpError(502, 'resend_intake_ack_failed', error.message);
  }

  return data;
}

export async function sendBuyerDeliveryEmail(order, delivery) {
  const env = getEnv();
  const resend = getResendClient();
  const orderUrl = buildOrderUrl(env, order, EMAIL_LINK_TTL_SECONDS);
  const links = Array.isArray(delivery?.links) ? delivery.links : [];
  const linkLines = links.length ? links.map((l) => `- ${l}`).join('\n') : '(see your order page)';
  const linkHtml = links.length
    ? `<ul>${links.map((l) => `<li><a href="${l}">${l}</a></li>`).join('')}</ul>`
    : '';

  const { data, error } = await resend.emails.send({
    from: env.RUNWAY_FUEL_FROM_EMAIL,
    to: order.buyer_email,
    replyTo: env.RUNWAY_FUEL_NOTIFICATION_EMAIL,
    subject: `Your deliverable is ready — ${order.offer_label}`,
    text: [
      `Hello ${order.buyer_name || 'there'},`,
      '',
      `Your ${order.offer_label} deliverable is ready.`,
      '',
      delivery?.summary || '',
      delivery?.message ? `\n${delivery.message}` : '',
      '',
      'Deliverable links:',
      linkLines,
      '',
      `View everything on your order page: ${orderUrl}`,
      '',
      'Runway Fuel',
    ].join('\n'),
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111827;">
        <p>Hello ${order.buyer_name || 'there'},</p>
        <p>Your <strong>${order.offer_label}</strong> deliverable is ready.</p>
        <p>${delivery?.summary || ''}</p>
        ${delivery?.message ? `<p>${delivery.message}</p>` : ''}
        ${linkHtml}
        <p><a href="${orderUrl}" style="display: inline-block; padding: 10px 18px; background: #111827; color: #ffffff; text-decoration: none; border-radius: 6px;">View on your order page</a></p>
        <p>Runway Fuel</p>
      </div>
    `,
  });

  if (error) {
    throw createHttpError(502, 'resend_delivery_email_failed', error.message);
  }

  return data;
}
