# -*- coding: utf-8 -*-
"""DNS для bizzinteldna.com через REST-интерфейс Dynadot. Один домен, один вызов.

ПОЧЕМУ REST, А НЕ СТАРЫЙ api3.xml. В журнале Dynadot отмена белого списка IP оговорена
как «RESTful API only» — старому интерфейсу адрес в белом списке по-прежнему нужен, а наш
домашний адрес меняется. Значит гонять Андрея в кабинет второй раз пришлось бы именно из-за
старого пути.

ПОЧЕМУ ЧИТАЕМ ПЕРЕД ЗАПИСЬЮ. Схему тела POST документация отдаёт только скриптом, наружу
её не видно. Угадывать имена полей нельзя — молча уедет не то. Поэтому `pokazat` сначала
читает GET, и по форме ответа собирается тело записи.

ЗАТИРАНИЕ. Запись DNS у Dynadot по умолчанию сносит все записи домена целиком. У
bizzinteldna.com сейчас только парковка, поэтому так и надо — но вызов обязан быть полным
за один раз: забыл строку, потерял запись.

ГЛАВНОЕ ОГРАНИЧЕНИЕ. Ключ даёт доступ ко ВСЕМУ аккаунту, а на businessinteldna.com живут
почта Google и боевой сайт. Домен здесь зашит константой, и каждый вызов перед отправкой
проверяется: чужой домен в адресе — падаем, ничего не отправив.

    python3 shtab/dns/bizz_dns.py pokazat   — прочитать, что стоит сейчас
    python3 shtab/dns/bizz_dns.py postavit  — поставить записи (нужен BIZZ_DNS_DA=da)
    python3 shtab/dns/bizz_dns.py proverit  — сверить по живому DNS, а не по ответу API
"""
import base64
import hashlib
import hmac
import json
import os
import ssl
import subprocess
import sys
import urllib.error
import urllib.parse
import urllib.request

DOMEN = "bizzinteldna.com"
NELZYA = "businessinteldna.com"          # основной домен: ни одним вызовом
BAZA = "https://api.dynadot.com"
VERSIYA = "/restful/v2"
CTX = ssl.create_default_context()
CTX.check_hostname = False
CTX.verify_mode = ssl.CERT_NONE

DKIM = ("p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDhxuqlBakHvTLtG7rvZZwGqpRWJ7eKmeO1h+54pZzJ"
        "HIqZEimNfnJzig06GoXOZc2eD5CBt1N85IYIUcg3TSxnVEZRuw85nsaS3m572c3FTlMuXcE1O89ZOmqoAyo/"
        "7hEcOwR79F54Gza6bBSak0RMGp+5X4r86InpvBNdM5rb1QIDAQAB")
NA_OSNOVNOY = "https://" + NELZYA
DMARC = "v=DMARC1; p=none; rua=mailto:support@%s; fo=1" % NELZYA

# Записи самого домена. Два набора: пересылкой Dynadot (https она НЕ умеет — сертификата
# на наш домен у них нет) и через свой сайт на Netlify, который сертификат выписывает сам.
# Переключается переменной окружения BIZZ_CHEREZ=netlify.
NETLIFY_IP = "75.2.60.5"          # адрес балансировщика Netlify для корня домена
NETLIFY_SAIT = os.environ.get("BIZZ_NETLIFY_SAIT", "bizz-redirect.netlify.app")

def glavnye():
    if os.environ.get("BIZZ_CHEREZ") == "netlify":
        return [("a", NETLIFY_IP, None),
                ("email", "support@%s" % NELZYA, "andrii")]
    return [("forward", NA_OSNOVNOY, "1"),               # 1 = 301, не 302 и не рамка
            ("email", "support@%s" % NELZYA, "andrii")]

GLAVNYE = glavnye()
# Записи поддоменов. Порядок важен только для читаемости.
PODDOMENY = [
    (("www", "cname", NETLIFY_SAIT, None) if os.environ.get("BIZZ_CHEREZ") == "netlify"
     else ("www", "forward", NA_OSNOVNOY, "1")),
    ("resend._domainkey", "txt", DKIM, None),
    ("send", "mx", "feedback-smtp.us-east-1.amazonses.com", "10"),
    ("send", "txt", "v=spf1 include:amazonses.com ~all", None),
    ("rsend", "cname", "send.forge.rmta.net", None),
    ("_dmarc", "txt", DMARC, None),
]


def klyuchi():
    k = os.environ.get("DYNADOT_KLYUCH", "").strip()
    sek = os.environ.get("DYNADOT_SEKRET", "").strip()
    if not k or not sek:
        print("  нужны DYNADOT_KLYUCH и DYNADOT_SEKRET в ~/.bidna-golos.env")
        raise SystemExit(2)
    return k, sek


def zov(metod, put, telo=None):
    """Любой вызов к Dynadot. Пускаем только по нашему одному домену.

    Подпись: HMAC-SHA256 секретом от строки «ключ \\n путь с запросом \\n id \\n тело»,
    результат в base64 — как описано в документации REST.
    """
    if ("/domains/" + DOMEN) not in put:
        print("  ОСТАНОВЛЕНО: в адресе вызова нет нашего домена: %r" % put)
        raise SystemExit(3)
    if NELZYA in put:
        print("  ОСТАНОВЛЕНО: в адресе вызова основной домен: %r" % put)
        raise SystemExit(3)
    k, sek = klyuchi()
    telo_str = json.dumps(telo, ensure_ascii=False) if telo is not None else ""
    if telo is not None and NELZYA in telo_str:
        for kusok in (NA_OSNOVNOY, "support@" + NELZYA, "rua=mailto:support@" + NELZYA):
            telo_str_bez = telo_str.replace(kusok, "")
        if NELZYA in telo_str_bez:
            print("  ОСТАНОВЛЕНО: основной домен в теле не как цель пересылки")
            raise SystemExit(3)
    stroka = "\n".join([k, VERSIYA + put, "", telo_str])
    podpis = base64.b64encode(hmac.new(sek.encode(), stroka.encode(), hashlib.sha256).digest()).decode()
    zag = {"Authorization": "Bearer " + k, "X-Signature": podpis,
           "Accept": "application/json"}
    if telo is not None:
        zag["Content-Type"] = "application/json"
    r = urllib.request.Request(BAZA + VERSIYA + put, method=metod,
                               data=telo_str.encode() if telo is not None else None, headers=zag)
    try:
        with urllib.request.urlopen(r, timeout=60, context=CTX) as o:
            return o.status, o.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8", "replace")


def pokazat():
    """Читаем как есть: по форме ответа собирается тело записи, а не по догадке."""
    kod, telo = zov("GET", "/domains/%s/dns" % DOMEN)
    print("  код ответа:", kod)
    try:
        print(json.dumps(json.loads(telo), ensure_ascii=False, indent=1)[:3000])
    except Exception:
        print(telo[:2000])


def zov_stary(pary):
    """Старый api3.json. Проверено 27.09.2026: с нашего IP он работает без белого списка
    (`domain_info` прошёл), а REST команды DNS не знает вовсе — отвечает «command is not
    recognized». Поэтому пишем сюда, а имена полей взяты из документации дословно,
    не на глаз."""
    d = dict(pary)
    if d.get("domain") != DOMEN:
        print("  ОСТАНОВЛЕНО: в вызове домен %r, а разрешён только %s" % (d.get("domain"), DOMEN))
        raise SystemExit(3)
    for znach in d.values():
        z = str(znach)
        if NELZYA in z and z not in (NA_OSNOVNOY, "support@" + NELZYA, DMARC):
            print("  ОСТАНОВЛЕНО: основной домен в параметре не как цель: %r" % z)
            raise SystemExit(3)
    k, _ = klyuchi()
    d["key"] = k
    url = "https://api.dynadot.com/api3.json?" + urllib.parse.urlencode(d)
    with urllib.request.urlopen(url, timeout=90, context=CTX) as o:
        return o.read().decode("utf-8", "replace")


def sobrat_parametry():
    """Один полный вызов: set_dns2 затирает записи домена целиком."""
    p = {"command": "set_dns2", "domain": DOMEN}
    for i, (tip, znach, dop) in enumerate(GLAVNYE):
        p["main_record_type%d" % i] = tip
        p["main_record%d" % i] = znach
        if dop is not None:
            p["main_recordx%d" % i] = dop
    for i, (pod, tip, znach, dop) in enumerate(PODDOMENY):
        p["subdomain%d" % i] = pod
        p["sub_record_type%d" % i] = tip
        p["sub_record%d" % i] = znach
        if dop is not None:
            p["sub_recordx%d" % i] = dop
    return p


def postavit():
    print("  домен: %s" % DOMEN)
    for tip, znach, dop in GLAVNYE:
        print("    %-8s %-46s %s" % (tip, znach[:46], dop or ""))
    for pod, tip, znach, dop in PODDOMENY:
        print("    %-18s %-6s %-46s %s" % (pod, tip, znach[:46], dop or ""))
    print("  ВНИМАНИЕ: set_dns2 затирает прежние записи ЭТОГО домена целиком.")
    if os.environ.get("BIZZ_DNS_DA") != "da":
        print("  для отправки запустите с BIZZ_DNS_DA=da")
        return
    print("  было:", (json.loads(zov_stary({"command": "domain_info", "domain": DOMEN}))
                      .get("DomainInfoResponse", {}).get("DomainInfo", {})
                      .get("NameServerSettings", {}).get("Type")))
    print(zov_stary(sobrat_parametry())[:1200])


def proverit():
    # Спрашиваем ЧУЖИЕ резолверы, а не домашний: он держит отрицательный ответ в кэше
    # и ещё долго отвечает «ничего нет» после того, как записи уже появились.
    # 27.09.2026 я на этом попался: dig @8.8.8.8 показывал DKIM, а моя же проверка — «нет».
    REZOLVERY = ["8.8.8.8", "1.1.1.1", "ns1.dyna-ns.net"]

    def dig(tip, imya):
        for rez in REZOLVERY:
            r = subprocess.run(["dig", "+short", tip, imya, "@" + rez],
                               capture_output=True, text=True)
            est = [x for x in r.stdout.strip().split("\n") if x]
            if est:
                return est
        return []

    proverki = [
        ("DKIM", "TXT", "resend._domainkey." + DOMEN, "p=MIGf"),
        ("SPF отбоя", "TXT", "send." + DOMEN, "v=spf1 include:amazonses.com"),
        ("MX отбоя", "MX", "send." + DOMEN, "feedback-smtp"),
        ("CNAME rsend", "CNAME", "rsend." + DOMEN, "send.forge.rmta.net"),
        ("DMARC", "TXT", "_dmarc." + DOMEN, "v=DMARC1"),
        ("MX домена (нужен для andrii@)", "MX", DOMEN, "."),
    ]
    for imya, tip, gde, zhdyom in proverki:
        est = dig(tip, gde)
        ok = any(zhdyom in x for x in est)
        print("  %-32s %s  %s" % (imya, "ЕСТЬ" if ok else "нет ", (est[:1] or [""])[0][:64]))
    for imya, adres in (("корень", "https://%s/" % DOMEN), ("www", "https://www.%s/" % DOMEN)):
        r = subprocess.run(["curl", "-s", "-o", "/dev/null", "-w", "%{http_code} %{redirect_url}",
                            "-m", "15", adres], capture_output=True, text=True)
        print("  редирект %-8s %s" % (imya, r.stdout.strip() or "нет ответа"))


if __name__ == "__main__":
    {"pokazat": pokazat, "postavit": postavit, "proverit": proverit}.get(
        (sys.argv[1:] or ["proverit"])[0], proverit)()
