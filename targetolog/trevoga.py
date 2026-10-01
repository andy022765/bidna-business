#!/usr/bin/env python3
"""Тревога Андрею в Telegram от бота @business_int_dna_bot. Вызов: python3 trevoga.py "текст одной-двумя строками".
Токен и чат — из ~/.bidna-golos.env (TG_BOT_TOKEN, TG_ANDREY_CHAT_ID), в Drive не лежат. Печатает OK или ОШИБКА."""
import json, os, ssl, sys, urllib.parse, urllib.request
try:
    import certifi; CTX = ssl.create_default_context(cafile=certifi.where())
except ImportError:
    CTX = ssl.create_default_context()
env = {}
for l in open(os.path.expanduser('~/.bidna-golos.env')):
    l = l.strip().removeprefix('export ')
    if '=' in l and not l.startswith('#'):
        k, v = l.split('=', 1); env[k] = v.strip().strip('"').strip("'")
text = ' '.join(sys.argv[1:]).strip()
if not text:
    print('ОШИБКА: пустой текст'); sys.exit(1)
data = urllib.parse.urlencode({'chat_id': env['TG_ANDREY_CHAT_ID'], 'text': text[:3500],
                               'disable_web_page_preview': 'true'}).encode()
try:
    with urllib.request.urlopen(urllib.request.Request(
            f"https://api.telegram.org/bot{env['TG_BOT_TOKEN']}/sendMessage", data=data), timeout=20, context=CTX) as r:
        print('OK' if json.load(r).get('ok') else 'ОШИБКА')
except Exception as e:
    print('ОШИБКА', type(e).__name__)
