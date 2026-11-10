/**
 * VOIDTWEAKS API relay.
 *
 * The Render backend is blocked for some Russian ISPs, so the site talks to
 * this Worker instead. Only the API routes used by the site are exposed.
 */

const UPSTREAM = 'https://voidtweaks.onrender.com';
const ALLOWED_ORIGINS = new Set([
  'https://voidtweaksapp.github.io',
  'https://disxrm.github.io'
]);
const API_PATHS = new Set([
  '/api/checkout',
  '/api/order',
  '/api/account/keys',
  '/api/account/claim',
  '/api/admin/data',
  '/api/admin/license'
]);
const ALLOWED_METHODS = new Set(['GET', 'HEAD', 'POST']);
const MAX_BODY_BYTES = 16 * 1024;

function isAllowedOrigin(origin) {
  return ALLOWED_ORIGINS.has(origin);
}

function corsHeaders(origin) {
  const headers = {
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin'
  };
  if (isAllowedOrigin(origin)) headers['Access-Control-Allow-Origin'] = origin;
  return headers;
}

function securityHeaders(headers = {}) {
  return {
    ...headers,
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'X-Frame-Options': 'DENY',
    'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
    'Strict-Transport-Security': 'max-age=31536000'
  };
}

function json(body, status, cors) {
  return new Response(JSON.stringify(body), {
    status,
    headers: securityHeaders({
      ...cors,
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store'
    })
  });
}

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin') || '';
    const cors = corsHeaders(origin);

    if (request.method === 'OPTIONS') {
      if (!isAllowedOrigin(origin)) {
        return new Response(null, { status: 403, headers: securityHeaders() });
      }
      return new Response(null, { status: 204, headers: securityHeaders(cors) });
    }

    // Warm the Render instance. The site calls this on load and before buying.
    if (url.pathname === '/') {
      if (request.method === 'GET' || request.method === 'HEAD') {
        await fetch(UPSTREAM + '/', { method: 'GET' }).catch(() => {});
      }
      return new Response('ok', {
        status: 200,
        headers: securityHeaders({
          ...cors,
          'Content-Type': 'text/plain',
          'Cache-Control': 'no-store'
        })
      });
    }

    if (!API_PATHS.has(url.pathname)) {
      return json({ error: 'not_found' }, 404, cors);
    }

    // API используется только сайтом: запросы с чужим Origin не пускаем.
    if (!isAllowedOrigin(origin)) {
      return json({ error: 'forbidden_origin' }, 403, cors);
    }

    if (!ALLOWED_METHODS.has(request.method)) {
      return json({ error: 'method_not_allowed' }, 405, cors);
    }

    const declaredLength = Number(request.headers.get('Content-Length') || 0);
    if (declaredLength > MAX_BODY_BYTES) {
      return json({ error: 'payload_too_large' }, 413, cors);
    }

    const headers = new Headers();
    const contentType = request.headers.get('Content-Type');
    if (contentType) headers.set('Content-Type', contentType);
    const authorization = request.headers.get('Authorization');
    if (authorization) headers.set('Authorization', authorization);

    // Передаём реальный IP клиента, иначе backend видит только IP Worker
    // и rate-limit бесполезен. Заголовок перезаписываем, а не дополняем:
    // подделанный клиентом X-Forwarded-For не должен проходить.
    const clientIp = request.headers.get('CF-Connecting-IP');
    if (clientIp) headers.set('X-Forwarded-For', clientIp);

    const init = { method: request.method, headers, redirect: 'manual' };
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      const raw = await request.text();
      if (new TextEncoder().encode(raw).length > MAX_BODY_BYTES) {
        return json({ error: 'payload_too_large' }, 413, cors);
      }
      init.body = raw;
    }

    let res;
    try {
      res = await fetch(UPSTREAM + url.pathname + url.search, init);
    } catch {
      return json({ error: 'upstream_unreachable' }, 502, cors);
    }

    const out = new Headers(res.headers);
    for (const key of [...out.keys()]) {
      const lower = key.toLowerCase();
      if (lower.startsWith('access-control-') || lower === 'server' || lower === 'x-powered-by') {
        out.delete(key);
      }
    }
    for (const [key, value] of Object.entries(cors)) out.set(key, value);
    for (const [key, value] of Object.entries(securityHeaders())) out.set(key, value);
    out.set('Cache-Control', 'no-store');

    return new Response(res.body, { status: res.status, headers: out });
  },

  // Cron Trigger: держим Render тёплым, чтобы кабинет и оплата
  // не ждали холодный старт free-тарифа.
  async scheduled(event, env, ctx) {
    ctx.waitUntil(fetch(UPSTREAM + '/', { method: 'GET' }).catch(() => {}));
  }
};
