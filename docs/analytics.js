/* Cloudflare Web Analytics – обезличенная статистика без cookie.
   Токен: dash.cloudflare.com → Analytics → Web Analytics → Add a site (voidtweaksapp.github.io).
   Пока токен пуст, скрипт ничего не загружает. */
(function () {
  var token = 'c3a1790ce1e04afd97eb039edd1dcee9';
  if (!token) return;
  var s = document.createElement('script');
  s.defer = true;
  s.src = 'https://static.cloudflareinsights.com/beacon.min.js';
  s.setAttribute('data-cf-beacon', JSON.stringify({ token: token }));
  document.head.appendChild(s);
})();
