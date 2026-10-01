// «Ящик медиа» для облачного таргетолога (30.09.2026, вечер; Netlify Functions 2.0).
// Облако собирает ролик, но Meta (ads_creative_upload_media) берёт только публичный адрес, а публичного адреса у облачной
// машины нет. Поэтому:
//   PUT  /m/<имя>   тело = байты файла (mp4 | png | jpg), заголовок x-bidna: targetolog
//        → кладём в Netlify Blobs, отвечаем {"ok":true,"url":"https://<id выкладки>--<сайт>.netlify.app/m/<имя>","bytes":N}
//   GET  /m/<имя>   → отдаём байты с правильным content-type (это и есть публичная ссылка)
// Почему адрес ВЫКЛАДКИ, а не боевой хост: Meta кэширует robots.txt по хосту — 30.09 боевой хост остался у неё «запрещённым»
// после старого «Disallow: /», а по свежему хосту выкладки та же картинка скачалась сразу. Хост выкладки меняется с каждой
// выкладкой, и у него тот же код, те же файлы и тот же robots.txt (теперь с Allow: /m/).
// Ключа нет (облачным задачам секреты не передаём — как у trevoga.js); рамки вместо ключа: имя только [a-z0-9_-]{3,60}.(mp4|png|jpg),
// сигнатура файла (ftyp / PNG / JPEG), не больше 4 МБ, не больше 40 загрузок в сутки на весь ящик, файл живёт 48 часов,
// заголовок x-bidna: targetolog обязателен (тот же принцип «префикс», что у тревог).
// Хранилище: @netlify/blobs — в функциях 2.0 контекст Blobs приходит сам, токен не нужен (у функций 1.0 приходилось
// connectLambda; голый getStore там молча не работал — урок 26.09).
import { getStore } from '@netlify/blobs';

const MAX = 4 * 1024 * 1024;
const TTL = 48 * 3600 * 1000;
const V_SUTKI = 40;
const IMYA = /^[a-z0-9_-]{3,60}\.(mp4|png|jpg)$/;
const TIPY = { mp4: 'video/mp4', png: 'image/png', jpg: 'image/jpeg' };

function signaturaOk(buf, ext) {
  if (buf.length < 12) return false;
  if (ext === 'png') return buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (ext === 'jpg') return buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
  if (ext === 'mp4') return buf.subarray(4, 8).toString('ascii') === 'ftyp';
  return false;
}

export default async (request, context) => {
  const u = new URL(request.url);
  const name = decodeURIComponent(u.pathname.split('/').pop() || '').toLowerCase();
  if (!IMYA.test(name)) return new Response('name', { status: 400 });
  const ext = name.split('.').pop();
  let s;
  try { s = getStore({ name: 'media', consistency: 'strong' }); } catch (e) { console.log('[media] store:', e.message); return new Response('store', { status: 500 }); }

  if (request.method === 'GET' || request.method === 'HEAD') {
    let zapis;
    try { zapis = await s.getWithMetadata(name, { type: 'arrayBuffer' }); } catch (e) { console.log('[media] get:', e.message); zapis = null; }
    if (!zapis || !zapis.data || !zapis.metadata || Number(zapis.metadata.do) < Date.now()) return new Response('no', { status: 404 });
    const headers = { 'content-type': TIPY[ext], 'content-length': String(zapis.data.byteLength), 'cache-control': 'public, max-age=3600',
      'content-disposition': 'inline; filename="' + name + '"' };
    return new Response(request.method === 'HEAD' ? null : zapis.data, { status: 200, headers });
  }

  if (request.method !== 'PUT' && request.method !== 'POST') return new Response('PUT', { status: 405 });
  if (request.headers.get('x-bidna') !== 'targetolog') return new Response('prefix', { status: 403 });
  const buf = Buffer.from(await request.arrayBuffer());
  if (!buf.length || buf.length > MAX) return new Response('size', { status: 413 });
  if (!signaturaOk(buf, ext)) return new Response('signature', { status: 415 });

  // потолок за сутки — счётчик в том же хранилище
  const den = new Date().toISOString().slice(0, 10);
  let schet = 0;
  try { schet = Number(await s.get('_schet_' + den)) || 0; } catch (e) { schet = 0; }
  if (schet >= V_SUTKI) return new Response('daily cap', { status: 429 });
  try {
    await s.set('_schet_' + den, String(schet + 1));
    await s.set(name, buf, { metadata: { do: String(Date.now() + TTL), bytes: String(buf.length) } });
  } catch (e) { console.log('[media] set:', e.message); return new Response('store write', { status: 500 }); }

  const dep = context && context.deploy && context.deploy.id;
  const site = context && context.site && context.site.name;
  const baza = (dep && site) ? `https://${dep}--${site}.netlify.app` : u.origin;
  const url = baza + '/m/' + name;
  return new Response(JSON.stringify({ ok: true, url, bytes: buf.length, otkuda: (dep && site) ? 'deploy' : 'origin' }),
    { status: 200, headers: { 'content-type': 'application/json' } });
};

export const config = { path: '/m/:name', method: ['GET', 'HEAD', 'PUT', 'POST'] };
