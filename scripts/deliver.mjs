#!/usr/bin/env node
// Operator delivery tool. Issues a deliverable for a paid order, advances its
// fulfillment status, and emails the buyer.
//
// Usage:
//   ADMIN_API_TOKEN=... node scripts/deliver.mjs \
//     --order rford_xxx \
//     --summary "Diagnostic complete — findings and next steps attached." \
//     --link https://drive.google.com/... \
//     --link https://www.notion.so/... \
//     [--message "Optional longer note"] \
//     [--complete] \
//     [--base-url https://your-domain.com]
//
// ADMIN_API_TOKEN is read from the environment (or .env.local).

import { readFileSync } from 'node:fs';

function loadDotEnvLocal() {
  try {
    const text = readFileSync(new URL('../.env.local', import.meta.url), 'utf8');
    for (const line of text.split('\n')) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (match && process.env[match[1]] === undefined) {
        process.env[match[1]] = match[2].replace(/^["']|["']$/g, '');
      }
    }
  } catch {
    // no .env.local — rely on the process environment
  }
}

function parseArgs(argv) {
  const args = { links: [], complete: false };
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    const next = () => argv[(i += 1)];
    if (key === '--order') args.order = next();
    else if (key === '--session') args.session = next();
    else if (key === '--summary') args.summary = next();
    else if (key === '--message') args.message = next();
    else if (key === '--link') args.links.push(next());
    else if (key === '--by') args.deliveredBy = next();
    else if (key === '--base-url') args.baseUrl = next();
    else if (key === '--complete') args.complete = true;
    else if (key === '--help' || key === '-h') args.help = true;
  }
  return args;
}

const HELP = `Issue a deliverable for an order.

Required:  --order <order_number>  (or --session <stripe_session_id>)
           --summary "<short summary shown to the buyer>"
Optional:  --link <url>        (repeatable)
           --message "<longer note>"
           --by "<your name>"
           --complete          (mark the order completed, not just delivery_sent)
           --base-url <url>     (defaults to APP_BASE_URL)

Env:       ADMIN_API_TOKEN must be set (or present in .env.local).`;

async function main() {
  loadDotEnvLocal();
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    console.log(HELP);
    return;
  }

  const token = process.env.ADMIN_API_TOKEN;
  const baseUrl = (args.baseUrl || process.env.APP_BASE_URL || '').replace(/\/+$/, '');

  const problems = [];
  if (!token) problems.push('ADMIN_API_TOKEN is not set (env or .env.local).');
  if (!baseUrl) problems.push('No base URL: pass --base-url or set APP_BASE_URL.');
  if (!args.order && !args.session) problems.push('Provide --order or --session.');
  if (!args.summary) problems.push('Provide --summary.');
  if (problems.length) {
    console.error('Cannot deliver:\n - ' + problems.join('\n - ') + '\n\n' + HELP);
    process.exit(1);
  }

  const payload = {
    orderNumber: args.order,
    sessionId: args.session,
    summary: args.summary,
    message: args.message,
    links: args.links,
    deliveredBy: args.deliveredBy,
    complete: args.complete,
  };

  const response = await fetch(`${baseUrl}/api/deliver-order`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  const result = await response.json().catch(() => ({}));

  if (!response.ok) {
    console.error(`Delivery failed (HTTP ${response.status}): ${result?.error?.message || 'unknown error'}`);
    process.exit(1);
  }

  console.log('Delivered.');
  console.log(`  Order:       ${result.order?.orderNumber}`);
  console.log(`  Status:      ${result.order?.fulfillmentStatus}`);
  console.log(`  Buyer email: ${result.buyerNotified ? 'sent' : 'NOT sent (check logs)'}`);
  if (result.delivery?.links?.length) {
    console.log(`  Links:       ${result.delivery.links.join(', ')}`);
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
