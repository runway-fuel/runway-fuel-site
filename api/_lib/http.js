import { randomUUID } from 'node:crypto';

export class HttpError extends Error {
  constructor(statusCode, code, message, details = undefined) {
    super(message);
    this.name = 'HttpError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export function createHttpError(statusCode, code, message, details = undefined) {
  return new HttpError(statusCode, code, message, details);
}

export function getRequestId(req) {
  const headerValue = req.headers['x-request-id'];

  if (typeof headerValue === 'string' && headerValue.trim()) {
    return headerValue.trim();
  }

  return randomUUID();
}

export function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

export function methodNotAllowed(res, allowedMethods) {
  res.setHeader('Allow', allowedMethods.join(', '));
  sendJson(res, 405, {
    error: {
      code: 'method_not_allowed',
      message: `Method not allowed. Allowed methods: ${allowedMethods.join(', ')}.`,
    },
  });
}

export async function readRawBody(req, { maxBytes = 1024 * 1024 } = {}) {
  const chunks = [];
  let totalBytes = 0;

  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    totalBytes += buffer.length;

    if (totalBytes > maxBytes) {
      throw createHttpError(413, 'payload_too_large', `Request body exceeds ${maxBytes} bytes.`);
    }

    chunks.push(buffer);
  }

  return Buffer.concat(chunks);
}

export async function readJsonBody(req, options = {}) {
  const contentType = req.headers['content-type'] ?? '';

  if (!String(contentType).toLowerCase().includes('application/json')) {
    throw createHttpError(415, 'unsupported_media_type', 'Content-Type must be application/json.');
  }

  const rawBody = await readRawBody(req, options);

  if (!rawBody.length) {
    throw createHttpError(400, 'empty_body', 'Request body is required.');
  }

  try {
    const parsed = JSON.parse(rawBody.toString('utf8'));

    if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
      throw createHttpError(400, 'invalid_json_shape', 'JSON body must be an object.');
    }

    return parsed;
  } catch (error) {
    if (error instanceof HttpError) {
      throw error;
    }

    throw createHttpError(400, 'invalid_json', 'Malformed JSON request body.');
  }
}

export function normalizeEmail(value) {
  if (typeof value !== 'string') {
    return '';
  }

  return value.trim().toLowerCase();
}

export function requireNonEmptyString(value, fieldName, { maxLength = 5000 } = {}) {
  if (typeof value !== 'string') {
    throw createHttpError(400, 'invalid_request', `${fieldName} must be a string.`);
  }

  const normalized = value.trim();

  if (!normalized) {
    throw createHttpError(400, 'invalid_request', `${fieldName} is required.`);
  }

  if (normalized.length > maxLength) {
    throw createHttpError(400, 'invalid_request', `${fieldName} exceeds the maximum length of ${maxLength}.`);
  }

  return normalized;
}

export function optionalString(value, { maxLength = 5000, defaultValue = '' } = {}) {
  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }

  if (typeof value !== 'string') {
    throw createHttpError(400, 'invalid_request', 'Expected a string value.');
  }

  const normalized = value.trim();

  if (normalized.length > maxLength) {
    throw createHttpError(400, 'invalid_request', `String exceeds the maximum length of ${maxLength}.`);
  }

  return normalized;
}

export function getQueryParam(req, key) {
  const requestUrl = new URL(req.url, 'http://localhost');
  const value = requestUrl.searchParams.get(key);
  return typeof value === 'string' ? value.trim() : '';
}

export function getBearerToken(req) {
  const header = req.headers.authorization ?? req.headers.Authorization ?? '';

  if (typeof header !== 'string') {
    return '';
  }

  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() ?? '';
}

export function requireAdminToken(req, expectedToken) {
  const providedToken = getBearerToken(req);

  if (!providedToken) {
    throw createHttpError(401, 'missing_admin_token', 'Missing Bearer token.');
  }

  if (providedToken !== expectedToken) {
    throw createHttpError(403, 'invalid_admin_token', 'Invalid admin token.');
  }
}

export function sendError(res, error, requestId) {
  const statusCode = error?.statusCode ?? 500;
  const code = error?.code ?? 'internal_error';
  const isConfigError = code === 'CONFIG_ERROR';
  const safeMessage =
    statusCode < 500 || isConfigError
      ? error.message
      : 'Internal server error.';

  sendJson(res, statusCode, {
    error: {
      code,
      message: safeMessage,
      ...(error?.details ? { details: error.details } : {}),
    },
    requestId,
  });
}
