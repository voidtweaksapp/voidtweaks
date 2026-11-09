const UPSTREAM = 'https://voidtweaks.onrender.com';
const ALLOWED_ORIGINS = new Set([
  'https://voidtweaksapp.github.io',
  'https://disxrm.github.io'
]);

function corsHeaders(origin) {
  const allow = ALLOWED_ORIGINS.has(origin) ? origin : 'https://voidtweaksapp.github.io';
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin'
  };
}

function send(res, status, headers, body) {
  res.statusCode = status;
  for (const [key, value] of Object.entries(headers)) res.setHeader(key, value);
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    if (req.body !== undefined) {
      if (Buffer.isBuffer(req.body)) return resolve(req.body.toString('utf8'));
      return resolve(typeof req.body === 'string' ? req.body : JSON.stringify(req.body));
    }
    let data = '';
    req.on('data', chunk => { data += chunk; });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

async function relay(req, res, path) {
  const cors = corsHeaders(req.headers.origin || '');

  if (req.method === 'OPTIONS') {
    send(res, 204, cors, '');
    return;
  }

  const url = new URL(req.url, 'https://relay.local');
  const target = UPSTREAM + path + (url.search || '');
  const init = {
    method: req.method,
    headers: { 'Content-Type': 'application/json' },
    redirect: 'manual'
  };

  try {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      init.body = await readBody(req);
    }
    const upstream = await fetch(target, init);
    const text = await upstream.text();
    const contentType = upstream.headers.get('content-type') || 'application/json';
    send(res, upstream.status, {
      ...cors,
      'Content-Type': contentType,
      'Cache-Control': 'no-store'
    }, text);
  } catch {
    send(res, 502, {
      ...cors,
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store'
    }, JSON.stringify({ error: 'upstream_unreachable' }));
  }
}

module.exports = { corsHeaders, relay, send };
