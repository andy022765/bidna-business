#!/usr/bin/env python3
"""Прототип шага `card` продукта «Карточка» — то, что уезжает вместе со ссылкой.

Полностью детерминированный и бесплатный: ни одного вызова модели.
UA — наш собственный, честно представленный. Спуфинг чужих краулеров не нужен:
проверено 05.09.2026, Instagram отдаёт og-теги на наш UA так же, как на facebookexternalhit.

Использование:  python3 kartochka.py <url> [<url> ...]
"""
import subprocess, re, html, sys, json, socket
from urllib.parse import urlparse

UA = "BusinessIntelDNA-LinkPreview/1.0 (+https://businessinteldna.com)"
TIMEOUT = 25

def _meta(body, prop):
    for pat in (rf'<meta[^>]+property=["\']{prop}["\'][^>]+content=["\']([^"\']*)["\']',
                rf'<meta[^>]+content=["\']([^"\']*)["\'][^>]+property=["\']{prop}["\']',
                rf'<meta[^>]+name=["\']{prop}["\'][^>]+content=["\']([^"\']*)["\']'):
        m = re.search(pat, body, re.I)
        if m: return html.unescape(m.group(1)).strip()
    return None

def visible_text(body):
    t = re.sub(r'<(script|style|noscript|template).*?</\1>', ' ', body, flags=re.S | re.I)
    t = re.sub(r'<[^>]+>', ' ', t)
    return ' '.join(html.unescape(t).split())

def card(url):
    if '//' not in url: url = 'https://' + url
    host = urlparse(url).hostname or ''
    out = {'url': url, 'host': host}

    # 1. DNS. Без этого вызова утверждать «домена не существует» запрещено.
    try:
        socket.getaddrinfo(host, 443)
        out['dns'] = True
    except Exception as e:
        return {**out, 'dns': False, 'branch': 'dns_dead', 'dns_error': str(e)[:80]}

    r = subprocess.run(['curl', '-sL', '--max-time', str(TIMEOUT), '-A', UA,
                        '-w', '\n@@%{http_code}', url],
                       capture_output=True, text=True, errors='replace')
    body = r.stdout
    out['http'] = body.rsplit('@@', 1)[-1].strip() if '@@' in body else '?'
    out['bytes'] = len(body)

    for k in ('og:title', 'og:description', 'og:image', 'og:site_name'):
        v = _meta(body, k)
        if v is not None: out[k] = v
    m = re.search(r'<title[^>]*>(.*?)</title>', body, re.S | re.I)
    if m: out['title'] = ' '.join(html.unescape(m.group(1)).split())
    out['meta_description'] = _meta(body, 'description')

    txt = visible_text(body)
    out['text_len'] = len(txt)
    out['text_head'] = txt[:1500]

    # Ветка результата — определяет, какой экран 1 показать человеку
    social = any(s in host for s in ('instagram.com', 'facebook.com', 'tiktok.com', 't.me', 'telegram'))
    if out['http'].startswith(('4', '5')):
        out['branch'] = 'blocked'
    elif not out.get('og:title'):
        out['branch'] = 'no_card'
    elif social:
        out['branch'] = 'social_card'
    elif not (out.get('og:description') or '').strip():
        out['branch'] = 'card_no_description'
    else:
        out['branch'] = 'site_card'
    return out

if __name__ == '__main__':
    res = [card(u) for u in sys.argv[1:]]
    print(json.dumps(res, ensure_ascii=False, indent=1))
