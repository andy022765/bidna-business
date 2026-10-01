#!/usr/bin/env python3
"""Шаг 7 скилла: сервис сообщений + номера + кампания A2P. Шаг 8: переподача FAILED правкой на месте.
Без --go — ПРИМЕРКА (только чтение + проверка полей и адресов).
Шаблон из scratchpad-скрипта, которым 29.09 21:40 PDT подали нашу кампанию QE2c6890…; зашитое вынесено в аргументы.

    python3 .claude/skills/sms-registraciya/podat_kampaniyu.py \
        --kampaniya Pivot/sms-kampaniya/kampaniya.json \
        --nomer +14247811913 --nomer +14247244202 \
        --imya "BIDNA A2P" --domen businessinteldna.com \
        --brend-imya "Business Intelligence DNA" --yurlico "Wealthboosterpro LLC" \
        [--nomera-posle] [--go]

    … --pravka QE…  [--go]     кампания в FAILED: правка на месте по kampaniya.json (без новых $15)

--go            СОЗДАЁТ сервис, ставит номера, ПОДАЁТ кампанию: $15 разово + $1.50 в месяц. СЛОВО АНДРЕЯ.
                Для клиента ещё и правило 25.09: наша кампания должна быть VERIFIED (скрипт проверяет сам).
--domen         домен сайта бренда. Все https-адреса и почты заявки — только на нём; для клиента скрипт падает
                на наших следах (домен, бренд, юрлицо, номера 781-1913 и 724-4202): это отказы 30926/30927/30881.
--nomera-posle  номера в сервис не ставить (поставить после одобрения тем же запуском без этого флага).
                Кампания без номеров вживую не подавалась — у нас 29.09 номера стояли ДО подачи.
--pravka QE…    переподать FAILED-кампанию правкой (POST …/Usa2p/{QE}): 7 полей из kampaniya.json. По документации
                Twilio плата за проверку берётся один раз на кампанию; удалять и подавать заново — новые $15.
                Вживую не делали.
--avtopopolnenie-vklyucheno  баланс меньше $15, но Андрей подтвердил, что автопополнение включено.
--tolko-servis  с --go: создать сервис и поставить номера, кампанию НЕ подавать (бесплатно). Чтобы до подачи
                включить Advanced Opt-Out со своими STOP/HELP: без него Twilio кладёт в кампанию свои тексты
                без бренда (у нас 29.09). Поможет ли — не проверено.
Повторный --go при уже поданной кампании только доставит недостающие номера (если нет --nomera-posle).
Номера холодного прозвона (TCPA) не передавать никогда: 29.09 номер Маши 275-6121 исключён."""
import argparse, json, os, re, sys, urllib.parse, urllib.request

sys.dont_write_bytecode = True   # не оставлять __pycache__ в папке скилла на Drive
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _twilio import Twilio, MSG, CTX, NASH_DOMEN  # noqa: E402

p = argparse.ArgumentParser()
p.add_argument('--env', default='~/.bidna-golos.env')
p.add_argument('--kampaniya', required=True, help='json заявки в именах API; ключи с «_» не отправляются')
p.add_argument('--nomer', action='append', default=[], help='+1XXXXXXXXXX, повторяемый (не нужен с --pravka)')
p.add_argument('--imya', required=True, help='FriendlyName сервиса, «<Клиент> A2P»')
p.add_argument('--domen', required=True, help='домен сайта бренда, например acme.com')
p.add_argument('--brend-imya', required=True, help='бренд (DBA): в каждом примере и в OptIn/OptOut/Help')
p.add_argument('--yurlico', required=True, help='юрлицо: в Description, OptIn/OptOut/Help и хотя бы в одном примере')
p.add_argument('--nomera-posle', action='store_true')
p.add_argument('--pravka', help='QE… кампании в FAILED — переподать правкой на месте')
p.add_argument('--avtopopolnenie-vklyucheno', action='store_true')
p.add_argument('--tolko-servis', action='store_true', help='с --go: сервис и номера без подачи кампании')
p.add_argument('--bez-nashego-odobreniya', action='store_true', help='снять правило 25.09 (только слово Андрея)')
p.add_argument('--go', action='store_true')
a = p.parse_args()
if not a.pravka and not a.nomer:
    sys.exit('! нужен хотя бы один --nomer')
KAMP = json.load(open(a.kampaniya))
dannye = {k: v for k, v in KAMP.items() if not k.startswith('_')}
DOM = a.domen.lower().removeprefix('https://').removeprefix('http://').removeprefix('www.').strip('/')
KLIENT = DOM != NASH_DOMEN
# Наши следы в заявке клиента: проверяющий увидит другую компанию (30926/30927) или почту ISV (30881, 30907).
NASHI_SLEDY = {'businessinteldna': 'наш домен', 'business intelligence dna': 'наш бренд',
               'wealthboosterpro': 'наше юрлицо', 'bizzinteldna': 'наша почта',
               '4247811913': 'наш номер 781-1913', '4247244202': 'наш номер 724-4202'}


def stroki(d):
    for k, v in d.items():
        for s in (v if isinstance(v, list) else [v]):
            if isinstance(s, str):
                yield k, s


def na_domene(host):
    host = (host or '').lower()
    return host == DOM or host.endswith('.' + DOM)


# ── проверка полей (коды — отказы Twilio, см. oshibki.md) ──
def proverit_polya(d):
    bedy = []
    kir = re.compile('[А-Яа-яЁё]')
    for k, s in stroki(d):
        if kir.search(s):
            bedy.append(f'{k}: кириллица (30910)')
    dl = lambda k, lo, hi: lo <= len(d.get(k) or '') <= hi or bedy.append(f'{k}: длина {len(d.get(k) or "")}, надо {lo}–{hi}')
    dl('Description', 40, 4096)
    dl('MessageFlow', 40, 2048)
    for k in ('OptInMessage', 'OptOutMessage', 'HelpMessage'):
        dl(k, 20, 320)
    pr = d.get('MessageSamples') or []
    if not 2 <= len(pr) <= 5:
        bedy.append(f'MessageSamples: {len(pr)} шт., надо 2–5')
    if len(set(pr)) != len(pr):
        bedy.append('MessageSamples: повторы (30911)')
    b, y = a.brend_imya.lower(), a.yurlico.lower()
    for i, s in enumerate(pr, 1):
        if not 20 <= len(s) <= 1024:
            bedy.append(f'пример {i}: длина {len(s)}, надо 20–1024')
        if 'STOP' not in s:
            bedy.append(f'пример {i}: нет STOP')
        if b not in s.lower():
            bedy.append(f'пример {i}: нет бренда «{a.brend_imya}» (30927)')
    for k in ('OptInMessage', 'OptOutMessage', 'HelpMessage'):
        if b not in (d.get(k) or '').lower():
            bedy.append(f'{k}: нет бренда «{a.brend_imya}» (30927, 30890)')
    for k in ('Description', 'OptInMessage', 'OptOutMessage', 'HelpMessage'):
        if y not in (d.get(k) or '').lower():
            bedy.append(f'{k}: нет юрлица (30918/30907)')
    if not any(y in s.lower() for s in pr):
        bedy.append('ни в одном примере нет юрлица (30918)')
    if 'START' in (d.get('OptInKeywords') or []) and 'START' not in (d.get('MessageFlow') or ''):
        bedy.append('MessageFlow не описывает START (30917)')
    for k, kod in (('PrivacyPolicyUrl', 30933), ('TermsAndConditionsUrl', 30934)):
        if not str(d.get(k, '')).startswith('https://'):
            bedy.append(f'{k}: нет https-адреса ({kod})')
    if (d.get('PrivacyPolicyUrl') or '#') not in (d.get('MessageFlow') or ''):
        bedy.append('MessageFlow не ссылается на privacy (30932, 30909)')
    if not str(d.get('BrandRegistrationSid', '')).startswith('BN'):
        bedy.append('BrandRegistrationSid: нет BN…')
    if not d.get('UsAppToPersonUsecase'):
        bedy.append('UsAppToPersonUsecase пуст')
    # адреса и почты — только на домене бренда
    for k, s in stroki(d):
        for u in re.findall(r'https?://[^\s,;)"\'<>]+', s):
            if not na_domene(urllib.parse.urlsplit(u).hostname):
                bedy.append(f'{k}: адрес {u} не на домене {DOM} (30907)')
        for pochta_dom in re.findall(r'[\w.+-]+@([\w-]+(?:\.[\w-]+)+)', s):
            if not na_domene(pochta_dom):
                bedy.append(f'{k}: почта на {pochta_dom}, не на {DOM} (30881)')
    if KLIENT:
        for k, s in stroki(d):
            nizh, cifry = s.lower(), re.sub(r'\D', '', s)
            for sled, chto in NASHI_SLEDY.items():
                if (sled in cifry) if sled.isdigit() else (sled in nizh):
                    bedy.append(f'{k}: {chto} в заявке клиента (30926/30927/30881)')
    return bedy


def adresa_otvechayut(d):
    """Проверяющий Twilio открывает ссылки руками: каждый https-адрес из заявки обязан отвечать 200."""
    urls = {d.get('PrivacyPolicyUrl'), d.get('TermsAndConditionsUrl')}
    for _, s in stroki(d):
        urls |= {u.rstrip('.,;:)!?') for u in re.findall(r'https://\S+', s)}
    bedy = []
    for u in sorted(x for x in urls if x):
        try:
            with urllib.request.urlopen(urllib.request.Request(u, headers={'User-Agent': 'Mozilla/5.0'}),
                                        timeout=20, context=CTX) as o:
                if o.status != 200:
                    bedy.append(f'{u} -> {o.status}')
        except Exception as e:  # noqa: BLE001
            bedy.append(f'{u} -> {e}')
    return bedy


bedy = proverit_polya(dannye) + adresa_otvechayut(dannye)
if bedy:
    sys.exit('! заявка не готова:\n  ' + '\n  '.join(bedy))
print(f"поля: ок ({len(dannye['MessageSamples'])} примеров, {dannye['UsAppToPersonUsecase']}), "
      f"адреса и почты на {DOM}, адреса отвечают 200" + (', наших следов нет' if KLIENT else ' (наша заявка)'))

t = Twilio(a.env)
brand = t.zapros('GET', f"{MSG}/a2p/BrandRegistrations/{dannye['BrandRegistrationSid']}")
print('бренд:', brand['status'], '| TCR', brand.get('tcr_id'))
if brand['status'] != 'APPROVED':
    sys.exit('! бренд не APPROVED — кампанию не подаём')

akk = t.nomera_akkaunta()
for n in a.nomer:
    if n not in akk:
        sys.exit(f'! номера {n} нет в аккаунте (покупка — шаг 0в, слово Андрея)')
servisy = t.servisy()
odnoimennye = [s for s in servisy if s['friendly_name'] == a.imya]
if len(odnoimennye) > 1:
    sys.exit(f"! сервисов «{a.imya}» несколько: {[s['sid'] for s in odnoimennye]} — разобрать руками, вслепую не выбираю")
ms = odnoimennye[0] if odnoimennye else None
gde = {}   # номер -> сервис: номер может стоять только в ОДНОМ сервисе сообщений
for s in servisy:
    for x in t.nomera_servisa(s['sid']):
        gde[x['phone_number']] = s
for n in a.nomer:
    if n in gde and (not ms or gde[n]['sid'] != ms['sid']):
        sys.exit(f"! {n} уже стоит в другом сервисе {gde[n]['sid']} «{gde[n]['friendly_name']}»")
print('сервис:', f"{ms['sid']} (входящие по вебхуку номера: {ms.get('use_inbound_webhook_on_number')})" if ms else 'нет — создам')
if ms and not ms.get('use_inbound_webhook_on_number'):
    sys.exit('! у сервиса UseInboundWebhookOnNumber=false — он перехватит входящие SMS с вебхуков номеров. Разобрать до подачи.')
uzhe_kamp = t.kampanii(ms['sid']) if ms else []
for k in uzhe_kamp:
    print(f"кампания УЖЕ ЕСТЬ: {k['sid']} {k.get('campaign_status')} — вторую не подаю")
bal = t.balans_usd()
print(f'баланс: {bal:.2f} USD')

# ── шаг 8: переподача FAILED правкой на месте ──
PRAVKA = [('Description', 'description'), ('MessageFlow', 'message_flow'), ('MessageSamples', 'message_samples'),
          ('HasEmbeddedLinks', 'has_embedded_links'), ('HasEmbeddedPhone', 'has_embedded_phone'),
          ('AgeGated', 'age_gated'), ('DirectLending', 'direct_lending')]
NE_PRAVYATSYA = [('OptInMessage', 'opt_in_message'), ('OptOutMessage', 'opt_out_message'),
                 ('HelpMessage', 'help_message'), ('OptInKeywords', 'opt_in_keywords'),
                 ('OptOutKeywords', 'opt_out_keywords'), ('HelpKeywords', 'help_keywords'),
                 ('UsAppToPersonUsecase', 'us_app_to_person_usecase'), ('BrandRegistrationSid', 'brand_registration_sid')]
if a.pravka:
    k = next((x for x in uzhe_kamp if x['sid'] == a.pravka), None)
    if not k:
        sys.exit(f'! кампании {a.pravka} в сервисе «{a.imya}» нет')
    print(f"кампания {k['sid']}: {k.get('campaign_status')} · errors {json.dumps(k.get('errors'), ensure_ascii=False)[:600]}")
    norm = lambda v: sorted(v) if isinstance(v, list) and not isinstance(v, str) else v   # порядок слов Twilio меняет
    raznica = [api for api, sn in PRAVKA if sn in k and dannye.get(api) != k.get(sn)]
    ne_ta = [api for api, sn in NE_PRAVYATSYA if sn in k and norm(dannye.get(api)) != norm(k.get(sn))]
    print('правкой меняется:', ', '.join(raznica) or 'ничего — json совпадает с поданным')
    if ne_ta:
        print('! в кампании не то, что в json, и правкой это НЕ меняется:', ', '.join(ne_ta))
        if set(ne_ta) <= {'OptOutMessage', 'HelpMessage'}:
            print('  Похоже на подмену Twilio: без Advanced Opt-Out на сервисе он хранит свои тексты STOP/HELP'
                  ' (так у нас 29.09). Сами по себе не повод удалять кампанию.')
        else:
            print('  Правка по документации шлёт только 7 полей. Остальное — удаление и новая кампания:'
                  ' новые $15 и дни — СТОП, слово Андрея.')
    if not a.go:
        print('ПРИМЕРКА — ничего не отправлено. Переподать: тот же запуск с --go (только для FAILED).')
        sys.exit(0)
    if k.get('campaign_status') != 'FAILED':
        sys.exit(f"! правка только для FAILED, а статус {k.get('campaign_status')}")
    if not raznica:
        sys.exit('! менять нечего: поправь kampaniya.json по errors (oshibki.md)')
    r = t.zapros('POST', f"{MSG}/Services/{ms['sid']}/Compliance/Usa2p/{a.pravka}", {api: dannye[api] for api, _ in PRAVKA})
    print('ПЕРЕПОДАНО:', r.get('sid'), r.get('campaign_status'), '— новая проверка, снова 5–15 рабочих дней')
    sys.exit(0)

print('номера:', ', '.join(a.nomer), '| ставлю', 'ПОСЛЕ одобрения' if a.nomera_posle else 'сейчас')
if not a.go:
    print('ПРИМЕРКА — ничего не создано. ' + (
        'Кампания уже подана: --go только доставит недостающие номера.' if uzhe_kamp else
        'Подать ($15 + $1.50/мес, слово Андрея): тот же запуск с --go.'))
    sys.exit(0)

if not uzhe_kamp:
    t.pravilo_25_09(KLIENT, a.bez_nashego_odobreniya)
    if bal < 15 and not a.avtopopolnenie_vklyucheno and not a.tolko_servis:
        sys.exit(f'! баланс {bal:.2f} < $15 за проверку. Пополнить — слово Андрея; если Андрей подтвердил, что'
                 ' автопополнение включено, — тот же запуск с --avtopopolnenie-vklyucheno (у нас 29.09 так и было)')
do = {n: (akk[n].get('sms_url'), akk[n].get('voice_url')) for n in a.nomer}
if not ms:
    ms = t.zapros('POST', f'{MSG}/Services', {'FriendlyName': a.imya, 'UseInboundWebhookOnNumber': True})
    print('создан сервис', ms['sid'], '| входящие по вебхуку номера:', ms.get('use_inbound_webhook_on_number'))
    if not ms.get('use_inbound_webhook_on_number'):
        sys.exit('! флаг входящих не встал — номера не ставлю, кампанию не подаю')
MG = ms['sid']
if not a.nomera_posle:
    stoyat = {x['phone_number'] for x in t.nomera_servisa(MG)}
    for n in a.nomer:
        if n not in stoyat:
            t.zapros('POST', f'{MSG}/Services/{MG}/PhoneNumbers', {'PhoneNumberSid': akk[n]['sid']})
            print('номер добавлен', n)
    posle = t.nomera_akkaunta()
    for n in a.nomer:
        if (posle[n].get('sms_url'), posle[n].get('voice_url')) != do[n]:
            print(f'! у {n} поменялись sms_url/voice_url — проверить маршрутизацию')
if uzhe_kamp:
    sys.exit(0)
if a.tolko_servis:
    print(f'сервис {MG} готов, кампания НЕ подана (--tolko-servis). Дальше: Advanced Opt-Out в консоли (SKILL.md, шаг 9),'
          ' потом тот же запуск без --tolko-servis ($15, слово Андрея).')
    sys.exit(0)
k = t.zapros('POST', f'{MSG}/Services/{MG}/Compliance/Usa2p', dannye)
print('КАМПАНИЯ ПОДАНА:', k['sid'], k.get('campaign_status'), '| сервис', MG)
print('Статус: python3 .claude/skills/sms-registraciya/status.py --kampaniya', a.kampaniya, '--imya', f'"{a.imya}"')
