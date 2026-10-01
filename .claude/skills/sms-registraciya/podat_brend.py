#!/usr/bin/env python3
"""Шаги 2–3 скилла: A2P-профиль (TrustProduct, бесплатно) и бренд Low Volume Standard ($4.50).
Без --go — ПРИМЕРКА: только чтение. Повторный запуск безопасен: готовое не создаёт второй раз.

    python3 .claude/skills/sms-registraciya/podat_brend.py \
        --profil BU<профиль компании> \
        --imya "<Клиент> A2P Messaging Profile" \
        --email-uvedomleniy support@businessinteldna.com \
        --kontakt-email <имя>@<домен клиента> \
        [--tip private | --tip public --birzha NASDAQ --tiker XXXX] \
        [--a2p BU… [--dorabotat]] [--go] [--go --brend] [--bez-nashego-odobreniya]

--go          создать A2P-профиль (бесплатно) и отправить его на проверку. Для КЛИЕНТА это подача от его имени:
              только после VERIFIED нашей кампании (правило Андрея 25.09, скрипт проверяет сам) и слова Андрея.
--go --brend  плюс подать бренд LVS: STANDARD + SkipAutomaticSecVet=true = $4.50 (без skip — $46). СЛОВО АНДРЕЯ.
              Только на профиль компании в twilio-approved: плата берётся при создании, даже если бренд не пройдёт.
--a2p BU… --dorabotat   довести СВОЙ черновик A2P-профиля (draft после «не compliant»): показать, что внутри,
              с --go заново проверить по политике и отправить. Консольный черновик BUb8259bae… не брать.
--bez-nashego-odobreniya  снять правило 25.09 — только если Андрей сказал это сам.
Реквизиты и EIN скрипт не вводит и не видит: они уже в профиле компании (его заводит человек в консоли).
29.09 шаги подавали руками через curl; по этому шаблону прогонялась только примерка на нашем профиле,
и она выходит на «бренд УЖЕ ЕСТЬ» — ветка создания A2P-профиля не исполнялась ни разу."""
import argparse, json, os, sys

sys.dont_write_bytecode = True   # не оставлять __pycache__ в папке скилла на Drive
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _twilio import Twilio, MSG, TH, NASH_PROFIL, NASH_DOMEN  # noqa: E402

POLITIKA_A2P = 'RNb0d4771c2c98518d916a3d4cd70a8f8b'   # «A2P Messaging: Local - Business», принимает primary и secondary
ZHIVYE = ('twilio-approved', 'pending-review', 'in-review')
BESPLATNYE = ('gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'icloud.com', 'aol.com', 'mail.ru', 'yandex.ru',
              'proton.me', 'protonmail.com', 'live.com', 'msn.com', 'me.com', 'gmx.com')
# Ролевые и рассылочные ящики: регистратор отклоняет «email distribution addresses», ролевой может попасть туда же.
# У нас 29.09 support@ заменили на andrii@ (память reference-infrastruktura-domena).
ROLEVYE = {'support', 'info', 'hello', 'contact', 'contacts', 'admin', 'office', 'sales', 'team', 'mail', 'help',
           'billing', 'marketing', 'news', 'newsletter', 'noreply', 'no-reply', 'donotreply', 'service', 'hi'}

p = argparse.ArgumentParser()
p.add_argument('--env', default='~/.bidna-golos.env')
p.add_argument('--profil', required=True, help='BU… профиль компании (Customer Profile)')
p.add_argument('--imya', required=True, help='FriendlyName A2P-профиля')
p.add_argument('--email-uvedomleniy', required=True, help='куда Twilio пишет о статусе (наш ящик)')
p.add_argument('--kontakt-email', required=True, help='brand_contact_email: личный ящик на домене клиента')
p.add_argument('--tip', choices=['private', 'public'], default='private')
p.add_argument('--birzha')
p.add_argument('--tiker')
p.add_argument('--a2p', help='BU… уже созданного A2P-профиля')
p.add_argument('--dorabotat', action='store_true', help='с --a2p: довести свой черновик (draft) до проверки')
p.add_argument('--go', action='store_true')
p.add_argument('--brend', action='store_true', help='подать бренд ($4.50), только вместе с --go')
p.add_argument('--bez-nashego-odobreniya', action='store_true', help='снять правило 25.09 (только слово Андрея)')
a = p.parse_args()
if a.tip == 'public' and not (a.birzha and a.tiker):
    sys.exit('! для public нужны --birzha и --tiker')
if a.brend and not a.go:
    sys.exit('! --brend только вместе с --go')
if a.dorabotat and not a.a2p:
    sys.exit('! --dorabotat только с --a2p BU… (черновик называешь сам, по имени не ищу)')
klient = a.profil != NASH_PROFIL
lok, dom = a.kontakt_email.lower().rsplit('@', 1)
if dom in BESPLATNYE:
    sys.exit(f'! brand_contact_email на бесплатном ящике ({dom}) — регистратор отклонит; нужен домен клиента')
if lok in ROLEVYE:
    sys.exit(f'! {a.kontakt_email}: ролевой ящик — может уйти в отказ как рассылочный (30881). Нужен личный: как andrii@ у нас')
if klient and (dom == NASH_DOMEN or dom.endswith('.' + NASH_DOMEN)):
    sys.exit('! контакт бренда клиента на НАШЕМ домене — ISV свою почту подставлять не может (30881)')

t = Twilio(a.env)


def razobrat_chernovik(sid):
    """Что привязано к A2P-профилю и что ответила последняя проверка политики. Только чтение."""
    naz = t.vse(f'{TH}/TrustProducts/{sid}/EntityAssignments?PageSize=50', 'results')
    print('  привязано:', ', '.join(x['object_sid'] for x in naz) or 'ничего',
          '(нужны оба: IT… EndUser и BU профиля компании)')
    ev = t.vse(f'{TH}/TrustProducts/{sid}/Evaluations?PageSize=20', 'results')
    if not ev:
        print('  проверок политики не было')
        return
    last = max(ev, key=lambda e: e.get('date_created') or '')
    print(f"  последняя проверка политики {last.get('date_created')}: {last.get('status')}")
    if last.get('status') != 'compliant':
        print('  ', json.dumps(last.get('results'), ensure_ascii=False)[:1500])


# 1. Профиль компании
prof = t.zapros('GET', f'{TH}/CustomerProfiles/{a.profil}')
print(f"профиль компании {a.profil} «{prof.get('friendly_name')}»: {prof.get('status')}"
      + (' (клиент)' if klient else ' (наш Primary)'))
if prof.get('status') not in ZHIVYE:
    sys.exit('! профиль не одобрен и не на проверке — сначала шаг 1 (консоль, руки Андрея)')

# 2. Бренд уже есть? Двойной бренд — двойная плата.
for b in t.vse(f'{MSG}/a2p/BrandRegistrations?PageSize=50', 'data'):
    if b.get('customer_profile_bundle_sid') == a.profil:
        print(f"бренд УЖЕ ЕСТЬ: {b['sid']} {b['status']} TCR {b.get('tcr_id')} — ничего не делаю")
        sys.exit(0)
print('бренда на этот профиль нет')
mozhno_brend = prof.get('status') == 'twilio-approved'
print('бренд ($4.50) подавать можно:', 'да, профиль одобрен' if mozhno_brend else
      'НЕТ — профиль компании ещё не twilio-approved; $4.50 сгорят, если профиль отклонят')

# 3. A2P-профиль: заданный, или найденный по имени, или новый
a2p = None
if a.a2p:
    a2p = t.zapros('GET', f'{TH}/TrustProducts/{a.a2p}')
else:
    naydeny = [x for x in t.vse(f'{TH}/TrustProducts?PageSize=50', 'results') if x['friendly_name'] == a.imya]
    if len(naydeny) > 1:
        sys.exit(f"! A2P-профилей с именем «{a.imya}» несколько: {[x['sid'] + ' ' + x['status'] for x in naydeny]}"
                 ' — укажи нужный через --a2p')
    a2p = naydeny[0] if naydeny else None
if a2p:
    print(f"A2P-профиль {a2p['sid']}: {a2p['status']}")
    if a2p['status'] == 'draft':
        razobrat_chernovik(a2p['sid'])
        if not a.dorabotat:
            sys.exit(f"! A2P-профиль в draft. Поправь EndUser (api.md, шаг 2а), потом: --a2p {a2p['sid']} --dorabotat [--go]")
    elif a2p['status'] not in ZHIVYE:
        sys.exit('! A2P-профиль отклонён или в неизвестном статусе — разобрать руками (api.md, шаг 2а)')
else:
    print(f'A2P-профиля «{a.imya}» нет — создам: company_type={a.tip}, brand_contact_email={a.kontakt_email}')

print('баланс:', t.balans())
if not a.go:
    print('ПРИМЕРКА — ничего не создано. A2P-профиль: --go. Бренд ($4.50, слово Андрея): --go --brend.')
    sys.exit(0)

t.pravilo_25_09(klient, a.bez_nashego_odobreniya)
if a.brend and not mozhno_brend:
    sys.exit(f"! бренд только на twilio-approved профиль компании, сейчас {prof.get('status')}. "
             'Источник сборов: плата берётся при создании, даже если бренд не пройдёт.')

if not a2p:
    tp = t.zapros('POST', f'{TH}/TrustProducts', {
        'FriendlyName': a.imya, 'Email': a.email_uvedomleniy, 'PolicySid': POLITIKA_A2P})
    attrs = {'company_type': a.tip, 'brand_contact_email': a.kontakt_email}
    if a.tip == 'public':
        attrs.update(stock_exchange=a.birzha, stock_ticker=a.tiker)
    eu = t.zapros('POST', f'{TH}/EndUsers', {
        'FriendlyName': a.imya + ' info', 'Type': 'us_a2p_messaging_profile_information',
        'Attributes': json.dumps(attrs)})
    for obj in (eu['sid'], a.profil):
        t.zapros('POST', f"{TH}/TrustProducts/{tp['sid']}/EntityAssignments", {'ObjectSid': obj})
    print(f"создан A2P-профиль {tp['sid']} (EndUser {eu['sid']})")
    a2p = tp
    a2p['status'] = 'draft'

if a2p['status'] == 'draft':
    ev = t.zapros('POST', f"{TH}/TrustProducts/{a2p['sid']}/Evaluations", {'PolicySid': POLITIKA_A2P})
    print('проверка политики:', ev.get('status'))
    if ev.get('status') != 'compliant':
        sys.exit('! не compliant, на проверку не отправляю:\n' + json.dumps(ev.get('results'), ensure_ascii=False)[:1500]
                 + f"\n  Черновик {a2p['sid']} остался. Поправь EndUser (api.md, шаг 2а) и запусти"
                   f" --a2p {a2p['sid']} --dorabotat --go")
    a2p = t.zapros('POST', f"{TH}/TrustProducts/{a2p['sid']}", {'Status': 'pending-review'})
    print(f"A2P-профиль отправлен: {a2p.get('status')} (у нас 29.09 стал twilio-approved за ~6 минут)")

if not a.brend:
    print('Бренд не подан. Подать ($4.50, слово Андрея): тот же запуск с --go --brend')
    sys.exit(0)
b = t.zapros('POST', f'{MSG}/a2p/BrandRegistrations', {
    'CustomerProfileBundleSid': a.profil, 'A2PProfileBundleSid': a2p['sid'], 'SkipAutomaticSecVet': True})
print(f"БРЕНД ПОДАН: {b['sid']} {b.get('status')} {b.get('brand_type')}. "
      f"Опрос раз в минуту: status.py --brend {b['sid']}. BN… впиши в kampaniya.json клиента.")
