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

function corsHeaders(origin) {
  const allow = ALLOWED_ORIGINS.has(origin) ? origin : 'https://voidtweaksapp.github.io';
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin'
  };
}

function json(body, status, cors) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
  });
}

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const cors = corsHeaders(request.headers.get('Origin') || '');

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }

    // Warm the Render instance. The site calls this on load and before buying.
    if (url.pathname === '/') {
      if (request.method === 'GET' || request.method === 'HEAD') {
        await fetch(UPSTREAM + '/', { method: 'GET' }).catch(() => {});
      }
      return new Response('ok', {
        status: 200,
        headers: { ...cors, 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' }
      });
    }

    if (!API_PATHS.has(url.pathname)) {
      return json({ error: 'not_found' }, 404, cors);
    }

    const headers = new Headers();
    const contentType = request.headers.get('Content-Type');
    if (contentType) headers.set('Content-Type', contentType);
    const authorization = request.headers.get('Authorization');
    if (authorization) headers.set('Authorization', authorization);

    const init = { method: request.method, headers, redirect: 'manual' };
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      init.body = await request.text();
    }

    let res;
    try {
      res = await fetch(UPSTREAM + url.pathname + url.search, init);
    } catch {
      return json({ error: 'upstream_unreachable' }, 502, cors);
    }

    const out = new Headers(res.headers);
    for (const key of [...out.keys()]) {
      if (key.toLowerCase().startsWith('access-control-')) out.delete(key);
    }
    for (const [key, value] of Object.entries(cors)) out.set(key, value);
    out.set('Cache-Control', 'no-store');

    return new Response(res.body, { status: res.status, headers: out });
  },

  // Cron Trigger: держим Render тёплым, чтобы кабинет и оплата
  // не ждали холодный старт free-тарифа.
  async scheduled(event, env, ctx) {
    ctx.waitUntil(fetch(UPSTREAM + '/', { method: 'GET' }).catch(() => {}));
  }
};
