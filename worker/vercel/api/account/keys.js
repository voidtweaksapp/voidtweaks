const { relay } = require('../../lib/relay');

module.exports = (req, res) => relay(req, res, '/api/account/keys');
