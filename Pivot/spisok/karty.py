#!/usr/bin/env python3
"""Карточка профиля нашим честным UA: подписчики, био, живость ссылки."""
import json, re, html, subprocess, socket, sys
from concurrent.futures import ThreadPoolExecutor
from urllib.parse import urlparse

UA = "BusinessIntelDNA-LinkPreview/1.0 (+https://businessinteldna.com)"

def meta(body, prop):
    for pat in (rf'<meta[^>]+property=["\']{prop}["\'][^>]+content=["\']([^"\']*)["\']',
                rf'<meta[^>]+content=["\']([^"\']*)["\'][^>]+property=["\']{prop}["\']',
                rf'<meta[^>]+name=["\']{prop}["\'][^>]+content=["\']([^"\']*)["\']'):
        m = re.search(pat, body, re.I)
        if m: return html.unescape(m.group(1)).strip()
    return None

def grab(url):
    host = urlparse(url).hostname or ''
    out = {'url': url, 'host': host}
    try:
        socket.getaddrinfo(host, 443); out['dns'] = True
    except Exception as e:
        return {**out, 'dns': False, 'err': str(e)[:60]}
    r = subprocess.run(['curl','-sL','--max-time','30','-A',UA,'-w','\n@@%{http_code}',url],
                       capture_output=True, text=True, errors='replace')
    b = r.stdout
    out['http'] = b.rsplit('@@',1)[-1].strip() if '@@' in b else '?'
    out['bytes'] = len(b)
    for k in ('og:title','og:description','og:site_name'):
        v = meta(b,k)
        if v: out[k] = v
    m = re.search(r'<title[^>]*>(.*?)</title>', b, re.S|re.I)
    if m: out['title'] = ' '.join(html.unescape(m.group(1)).split())
    d = out.get('og:description','') or ''
    n = re.search(r'([\d,.KMkm]+)\s*[Ff]ollowers?', d)
    if n: out['podpischikov'] = n.group(1)
    p = re.search(r'([\d,.KMkm]+)\s*[Pp]osts?', d)
    if p: out['postov'] = p.group(1)
    bio = re.sub(r'^.*?[Ff]ollowing,?\s*[\d,.KMkm]+\s*[Pp]osts?\s*[-–—]\s*', '', d)
    out['bio'] = bio[:400]
    return out

people = json.load(open('/tmp/spisok/lyudi.json'))
jobs = []
for p in people:
    for key in ('ig','sait'):
        if p.get(key): jobs.append((p['id'], key, p[key]))
with ThreadPoolExecutor(max_workers=6) as ex:
    res = list(ex.map(lambda j: (j[0], j[1], grab(j[2])), jobs))
by = {}
for pid, key, card in res: by.setdefault(pid, {})[key] = card
for p in people: p['karty'] = by.get(p['id'], {})
json.dump(people, open('/tmp/spisok/lyudi_plus.json','w'), ensure_ascii=False, indent=1)

for p in people:
    ig = p['karty'].get('ig', {})
    print(f"{p['imya'][:26]:28} http={ig.get('http','—'):4} "
          f"подп={ig.get('podpischikov','?'):>7} постов={ig.get('postov','?'):>6}  "
          f"{(ig.get('bio') or '')[:70]}")
