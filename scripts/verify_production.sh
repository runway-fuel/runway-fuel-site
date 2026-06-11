#!/usr/bin/env bash
set -euo pipefail

# Runway Fuel production verification script
#
# Purpose:
#   1. Pull current Vercel production env locally for audit
#   2. Validate core required env variables are present
#   3. Query Supabase REST tables using the service-role key
#   4. Verify the public get-order endpoint
#   5. Optionally verify Resend delivery status when email IDs are supplied
#
# Usage examples:
#   ./scripts/verify_production.sh
#   ORDER_NUMBER=rford_xxx STRIPE_SESSION_ID=cs_test_xxx STRIPE_EVENT_ID=evt_xxx ./scripts/verify_production.sh
#   RESEND_BUYER_EMAIL_ID=xxxxxxxx RESEND_INTERNAL_EMAIL_ID=yyyyyyyy ./scripts/verify_production.sh

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

AUDIT_ENV_FILE="${AUDIT_ENV_FILE:-.env.production.audit}"
ORDER_NUMBER="${ORDER_NUMBER:-rford_efd8e48d2f194d9b8cd8}"
STRIPE_SESSION_ID="${STRIPE_SESSION_ID:-cs_test_a1SRQKLA4S49ibDGfB94ys6EOcOVv19Pet1S98K65JazwBcITPd5y9qq5L}"
STRIPE_EVENT_ID="${STRIPE_EVENT_ID:-evt_1TOhTMFoWo8okexcXq5Vkdh7}"
APP_BASE_URL_DEFAULT="https://www.runwayfuel.io"
RESEND_BUYER_EMAIL_ID="${RESEND_BUYER_EMAIL_ID:-}"
RESEND_INTERNAL_EMAIL_ID="${RESEND_INTERNAL_EMAIL_ID:-}"

printf '\n==> Pulling Vercel production environment into %s\n' "$AUDIT_ENV_FILE"
vercel env pull "$AUDIT_ENV_FILE" --environment=production >/dev/null

printf '==> Running production verification checks\n\n'

python3 - <<'PY'
from pathlib import Path
from urllib.parse import quote
import json
import os
import sys

import requests


def load_env_file(path: str):
    data = {}
    for raw in Path(path).read_text().splitlines():
        line = raw.strip()
        if not line or line.startswith('#') or '=' not in line:
            continue
        key, value = line.split('=', 1)
        data[key] = value.strip().strip('"').strip("'")
    return data


def print_section(title: str):
    print(f"\n{'=' * 18} {title} {'=' * 18}")


env_path = os.environ.get('AUDIT_ENV_FILE', '.env.production.audit')
env = load_env_file(env_path)
required = [
    'APP_BASE_URL',
    'STRIPE_SECRET_KEY',
    'STRIPE_WEBHOOK_SECRET',
    'VITE_STRIPE_PUBLISHABLE_KEY',
    'RUNWAY_FUEL_DIAGNOSTIC_PRICE_ID',
    'RUNWAY_FUEL_BLUEPRINT_PRICE_ID',
    'RUNWAY_FUEL_DEPOSIT_PRICE_ID',
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'RESEND_API_KEY',
    'RUNWAY_FUEL_FROM_EMAIL',
    'RUNWAY_FUEL_NOTIFICATION_EMAIL',
    'ADMIN_API_TOKEN',
    'ORDER_ACCESS_TOKEN_SECRET',
]
sensitive_allowed_missing = {'STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET'}
missing = [k for k in required if not env.get(k) and k not in sensitive_allowed_missing]
print_section('ENVIRONMENT AUDIT')
print(json.dumps({
    'missing_keys': missing,
    'app_base_url': env.get('APP_BASE_URL'),
    'supabase_url': env.get('SUPABASE_URL'),
    'has_service_role_key': bool(env.get('SUPABASE_SERVICE_ROLE_KEY')),
    'service_role_key_prefix': env.get('SUPABASE_SERVICE_ROLE_KEY', '')[:12],
    'service_role_key_length': len(env.get('SUPABASE_SERVICE_ROLE_KEY', '')),
}, indent=2))
if missing:
    print('ERROR: Required environment keys are missing.')
    sys.exit(2)

base = env['SUPABASE_URL'].rstrip('/')
key = env['SUPABASE_SERVICE_ROLE_KEY']
headers = {
    'apikey': key,
    'Authorization': f'Bearer {key}',
}
order_number = os.environ.get('ORDER_NUMBER', 'rford_efd8e48d2f194d9b8cd8')
session_id = os.environ.get('STRIPE_SESSION_ID', 'cs_test_a1SRQKLA4S49ibDGfB94ys6EOcOVv19Pet1S98K65JazwBcITPd5y9qq5L')
stripe_event_id = os.environ.get('STRIPE_EVENT_ID', 'evt_1TOhTMFoWo8okexcXq5Vkdh7')

queries = {
    'RF_ORDERS_BY_ORDER_NUMBER': f"/rest/v1/rf_orders?select={quote('id,created_at,order_number,offer_code,offer_label,currency,amount_total_cents,payment_status,fulfillment_status,organization,buyer_name,buyer_email,stripe_session_id', safe=',')}&order_number=eq.{order_number}",
    'RF_ORDER_EVENTS_BY_SESSION': f"/rest/v1/rf_order_events?select={quote('id,created_at,event_kind,event_source,event_status,stripe_event_id,stripe_event_type,stripe_session_id,correlation_key,order_id,customer_id', safe=',')}&stripe_session_id=eq.{session_id}&order=created_at.desc",
    'RF_ORDER_EVENTS_BY_STRIPE_EVENT': f"/rest/v1/rf_order_events?select={quote('id,created_at,event_kind,event_source,event_status,stripe_event_id,stripe_event_type,stripe_session_id,correlation_key,order_id,customer_id', safe=',')}&stripe_event_id=eq.{stripe_event_id}&order=created_at.desc",
}

print_section('SUPABASE TABLE PROBES')
for label, path in queries.items():
    resp = requests.get(base + path, headers=headers, timeout=30)
    print(f"\n--- {label} ---")
    print(f"HTTP {resp.status_code}")
    try:
        payload = resp.json()
    except Exception:
        payload = {'raw_text': resp.text}
    print(json.dumps(payload, indent=2))
    if resp.status_code >= 400:
        print(f'ERROR: Probe failed for {label}')
        sys.exit(3)

public_base = env.get('APP_BASE_URL', 'https://www.runwayfuel.io').rstrip('/')
get_order_url = f"{public_base}/api/get-order?session_id={session_id}"
print_section('PUBLIC ORDER LOOKUP')
resp = requests.get(get_order_url, timeout=30)
print(f"GET {get_order_url}")
print(f"HTTP {resp.status_code}")
try:
    payload = resp.json()
except Exception:
    payload = {'raw_text': resp.text}
print(json.dumps(payload, indent=2))
if resp.status_code >= 500:
    print('ERROR: Public order lookup is unhealthy.')
    sys.exit(4)

resend_api_key = env.get('RESEND_API_KEY', '')
resend_email_ids = [
    ('buyer', os.environ.get('RESEND_BUYER_EMAIL_ID', '').strip()),
    ('internal', os.environ.get('RESEND_INTERNAL_EMAIL_ID', '').strip()),
]
provided_ids = [(label, email_id) for label, email_id in resend_email_ids if email_id]
print_section('RESEND DELIVERY VERIFICATION')
if not provided_ids:
    print(json.dumps({
        'status': 'skipped',
        'reason': 'No RESEND_BUYER_EMAIL_ID or RESEND_INTERNAL_EMAIL_ID provided.',
        'operational_note': 'If email IDs are not persisted in application logs, verify delivery in the Resend dashboard Emails page and in the target inboxes.'
    }, indent=2))
else:
    resend_headers = {'Authorization': f'Bearer {resend_api_key}'}
    results = []
    for label, email_id in provided_ids:
        url = f'https://api.resend.com/emails/{email_id}'
        r = requests.get(url, headers=resend_headers, timeout=30)
        try:
            payload = r.json()
        except Exception:
            payload = {'raw_text': r.text}
        results.append({
            'label': label,
            'email_id': email_id,
            'status_code': r.status_code,
            'payload': payload,
        })
    print(json.dumps(results, indent=2))
    if any(item['status_code'] >= 400 for item in results):
        print('ERROR: At least one Resend email retrieval request failed.')
        sys.exit(5)

print_section('FINAL VERDICT')
print(json.dumps({
    'result': 'ok',
    'message': 'Production verification checks completed successfully.'
}, indent=2))
PY
