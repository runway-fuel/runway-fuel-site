const REQUIRED_ENV_KEYS = [
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
];

let cachedEnv;

function normalizeAppBaseUrl(value) {
  return value.replace(/\/+$/, '');
}

export function getEnv() {
  if (cachedEnv) {
    return cachedEnv;
  }

  const missingKeys = [];
  const collected = {};

  for (const key of REQUIRED_ENV_KEYS) {
    const value = process.env[key]?.trim();

    if (!value) {
      missingKeys.push(key);
      continue;
    }

    collected[key] = key === 'APP_BASE_URL' ? normalizeAppBaseUrl(value) : value;
  }

  if (missingKeys.length > 0) {
    const error = new Error(`Missing required environment variables: ${missingKeys.join(', ')}`);
    error.statusCode = 500;
    error.code = 'CONFIG_ERROR';
    throw error;
  }

  cachedEnv = Object.freeze(collected);
  return cachedEnv;
}

export function assertEnv() {
  return getEnv();
}

export { REQUIRED_ENV_KEYS };
