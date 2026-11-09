const { corsHeaders, send } = require('../lib/relay');

module.exports = (req, res) => {
  send(res, 200, {
    ...corsHeaders(req.headers.origin || ''),
    'Content-Type': 'text/plain',
    'Cache-Control': 'no-store'
  }, 'ok');
};
