# -*- coding: utf-8 -*-
"""Почта и имя клиента уезжали в отправку склеенными в строку contact.
Для автоматической отправки документов адрес нужен отдельным полем — иначе
его пришлось бы выковыривать разбором текста и однажды ошибиться адресом."""
import os, re, time
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FILES = {"anketa-b-7k3m9x.html": "intake-business", "anketa-e-4q8v2n.html": "intake-expert"}

for f, form in FILES.items():
    p = os.path.join(HERE, f)
    s = open(p, encoding="utf-8").read()
    before = s

    # 1. скрытая статическая форма — Netlify детектит поля именно по ней
    s = s.replace(
        f'<form name="{form}" data-netlify="true" netlify-honeypot="bot-field" hidden>\n  <input type="text" name="contact" />',
        f'<form name="{form}" data-netlify="true" netlify-honeypot="bot-field" hidden>\n'
        '  <input type="text" name="contact" />\n'
        '  <input type="text" name="client_name" />\n'
        '  <input type="email" name="client_email" />\n'
        '  <input type="text" name="client_tg" />')

    # 2. отправка — те же значения, но отдельными полями
    s = s.replace(
        "  fd.append('contact',contact);",
        "  fd.append('contact',contact);\n"
        "  fd.append('client_name',(cName.value||'').trim());\n"
        "  fd.append('client_email',(cEmail.value||'').trim());\n"
        "  fd.append('client_tg',(cTg.value||'').trim());")

    assert s != before, f
    assert 'name="client_email"' in s and "fd.append('client_email'" in s, f
    open(p, "w", encoding="utf-8").write(s)
    time.sleep(1)
    chk = open(p, encoding="utf-8").read()
    print(f"  ✓ {f}: скрытых полей +{chk.count('name=\"client_')}, в отправке +{chk.count('fd.append(&#39;client_') + chk.count(chr(39).join(['fd.append(','client_']))}")
