import { getEnv } from './_lib/env.js';
import {
  getRequestId,
  methodNotAllowed,
  requireAdminToken,
  sendError,
  sendJson,
} from './_lib/http.js';
import { logError, logInfo } from './_lib/logging.js';
import { getAllOrdersForUsage, getRecentOrders } from './_lib/supabase.js';

function formatCurrency(amountInCents, currency) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: String(currency || 'USD').toUpperCase(),
  }).format((amountInCents || 0) / 100);
}

export default async function handler(req, res) {
  const requestId = getRequestId(req);

  try {
    const env = getEnv();

    if (req.method !== 'GET') {
      return methodNotAllowed(res, ['GET']);
    }

    requireAdminToken(req, env.ADMIN_API_TOKEN);

    const [orders, recentOrders] = await Promise.all([getAllOrdersForUsage(), getRecentOrders(20)]);

    const paidOrders = orders.filter((order) => order.payment_status === 'paid');
    const grossRevenueCents = paidOrders.reduce(
      (total, order) => total + Number(order.amount_total_cents || 0),
      0,
    );
    const primaryCurrency = paidOrders[0]?.currency || 'usd';

    const revenueByOfferMap = new Map();
    for (const order of paidOrders) {
      const existing = revenueByOfferMap.get(order.offer_code) || {
        offerCode: order.offer_code,
        offerLabel: order.offer_label,
        orderCount: 0,
        revenueCents: 0,
        currency: order.currency,
      };

      existing.orderCount += 1;
      existing.revenueCents += Number(order.amount_total_cents || 0);
      revenueByOfferMap.set(order.offer_code, existing);
    }

    const statusDistributionMap = new Map();
    for (const order of orders) {
      const key = order.fulfillment_status || 'unknown';
      statusDistributionMap.set(key, (statusDistributionMap.get(key) || 0) + 1);
    }

    const response = {
      generatedAt: new Date().toISOString(),
      summary: {
        totalPaidOrders: paidOrders.length,
        grossRevenueCents,
        grossRevenueFormatted: formatCurrency(grossRevenueCents, primaryCurrency),
        currency: primaryCurrency,
      },
      revenueByOffer: [...revenueByOfferMap.values()]
        .sort((left, right) => right.revenueCents - left.revenueCents)
        .map((item) => ({
          ...item,
          revenueFormatted: formatCurrency(item.revenueCents, item.currency),
        })),
      statusDistribution: [...statusDistributionMap.entries()]
        .map(([status, count]) => ({ status, count }))
        .sort((left, right) => right.count - left.count),
      recentOrders: recentOrders.map((order) => ({
        orderNumber: order.order_number,
        createdAt: order.created_at,
        offerCode: order.offer_code,
        offerLabel: order.offer_label,
        amountTotalCents: order.amount_total_cents,
        currency: order.currency,
        paymentStatus: order.payment_status,
        fulfillmentStatus: order.fulfillment_status,
        fulfillmentDueAt: order.fulfillment_due_at,
        buyerName: order.buyer_name,
        buyerEmail: order.buyer_email,
        organization: order.organization,
      })),
      requestId,
    };

    logInfo('Admin usage summary generated.', {
      requestId,
      totalPaidOrders: response.summary.totalPaidOrders,
      grossRevenueCents,
    });

    return sendJson(res, 200, response);
  } catch (error) {
    logError('Admin usage summary failed.', error, { requestId });
    return sendError(res, error, requestId);
  }
}
