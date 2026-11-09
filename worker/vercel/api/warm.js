const { corsHeaders, send } = require('../lib/relay');

const UPSTREAM = 'https://voidtweaks.onrender.com';

module.exports = async (req, res) => {
  // Wake the Render instance while the page is loading. The site ignores this
  // response, so a slow cold start doesn't block the UI.
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 25000);
    await fetch(UPSTREAM + '/', { method: 'GET', signal: controller.signal }).catch(() => {});
    clearTimeout(timer);
  } catch {}

  send(res, 200, {
    ...corsHeaders(req.headers.origin || ''),
    'Content-Type': 'text/plain',
    'Cache-Control': 'no-store'
  }, 'ok');
};
