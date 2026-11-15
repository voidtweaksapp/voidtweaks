# VOIDTWEAKS API relay

Cloudflare Worker that proxies the site's checkout requests to Render:

```
site -> voidtweaks-api.<subdomain>.workers.dev -> voidtweaks.onrender.com
```

Only the API routes used by the site are proxied (`/api/checkout`, `/api/order`,
`/api/account/keys`, `/api/account/claim`, `/api/admin/data`,
`/api/admin/license`). `GET /` wakes the Render instance and is used by the site
as a pre-warm request. Other paths return 404, so the Worker cannot be used as
an open proxy.

Desktop clients have no `Origin` header, so `/api/license/check` is exposed
separately: `POST` only, without the origin check. The backend rate-limits it
per client IP (the Worker forwards `CF-Connecting-IP`).

## Deploy

```powershell
cd worker
npx wrangler login
npx wrangler deploy
```

The first deploy asks to register a `workers.dev` subdomain. After deploying,
put the printed URL into `docs/index.html`:

```js
const API = 'https://voidtweaks-api.<subdomain>.workers.dev';
```

## CORS

Allowed origins:

- `https://voidtweaksapp.github.io`
- `https://disxrm.github.io`

Requests from other origins get the GitHub Pages origin in
`Access-Control-Allow-Origin`.
