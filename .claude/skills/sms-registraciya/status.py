#!/usr/bin/env python3
"""Статус регистрации SMS — ТОЛЬКО ЧТЕНИЕ, ничего не создаёт и не платит.

    python3 .claude/skills/sms-registraciya/status.py --kampaniya Pivot/sms-kampaniya/kampaniya.json --imya "BIDNA A2P"
    … --brend BN…            (вместо --kampaniya, если json ещё нет)
    … --env ~/.bidna-golos.env  (по умолчанию)

Печатает: бренд (status / identity / TCR), профиль компании и A2P-профиль, сервис сообщений и его флаг
входящих, номера сервиса, кампании (status / errors / rate_limits), вебхуки всех номеров аккаунта, баланс.
Опрос бренда — раз в минуту; кампании — раз в день (проверка 5–15 рабочих дней)."""
import argparse, json, os, sys, urllib.parse

sys.dont_write_bytecode = True   # не оставлять __pycache__ в папке скилла на Drive
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _twilio import Twilio, MSG, TH  # noqa: E402

p = argparse.ArgumentParser()
p.add_argument('--env', default='~/.bidna-golos.env')
p.add_argument('--kampaniya', help='json клиента с BrandRegistrationSid')
p.add_argument('--brend', help='BN… (если нет json)')
p.add_argument('--imya', help='FriendlyName сервиса сообщений, например "BIDNA A2P"')
a = p.parse_args()
t = Twilio(a.env)

bn = a.brend or (json.load(open(a.kampaniya))['BrandRegistrationSid'] if a.kampaniya else None)
if bn:
    b = t.zapros('GET', f'{MSG}/a2p/BrandRegistrations/{bn}')
    print(f"бренд {bn}: {b.get('status')} · identity {b.get('identity_status')} · TCR {b.get('tcr_id')} · "
          f"{b.get('brand_type')} · skip_sec_vet {b.get('skip_automatic_sec_vet')}")
    if b.get('failure_reason') or b.get('errors'):
        print('  ! причины:', b.get('failure_reason'), json.dumps(b.get('errors'), ensure_ascii=False)[:600])
    for nazv, url in (('профиль компании', f"{TH}/CustomerProfiles/{b.get('customer_profile_bundle_sid')}"),
                      ('A2P-профиль', f"{TH}/TrustProducts/{b.get('a2p_profile_bundle_sid')}")):
        j = t.zapros('GET', url, molcha=True)
        print(f"  {nazv} {url.rsplit('/', 1)[1]}: {j.get('status', j.get('_oshibka'))}")
else:
    print('бренд: не задан (--kampaniya или --brend). Все бренды аккаунта:')
    for b in t.vse(f'{MSG}/a2p/BrandRegistrations?PageSize=50', 'data'):
        print(f"  {b['sid']} {b['status']} TCR {b.get('tcr_id')} профиль {b.get('customer_profile_bundle_sid')}")

akk = t.nomera_akkaunta()
servisy = t.servisy()
if a.imya:
    servisy_vybor = [s for s in servisy if s['friendly_name'] == a.imya]
    if not servisy_vybor:
        print(f'сервис «{a.imya}»: нет')
else:
    servisy_vybor = servisy
for s in servisy_vybor:
    print(f"сервис {s['sid']} «{s['friendly_name']}»: входящие по вебхуку номера "
          f"{s.get('use_inbound_webhook_on_number')} · a2p_registered {s.get('us_app_to_person_registered')}")
    print('  номера:', ', '.join(n['phone_number'] for n in t.nomera_servisa(s['sid'])) or 'нет')
    for k in t.kampanii(s['sid']):
        print(f"  кампания {k['sid']}: {k.get('campaign_status')} · {k.get('us_app_to_person_usecase')} · "
              f"создана {k.get('date_created')} · изменена {k.get('date_updated')}")
        if k.get('errors'):
            print('    ! errors:', json.dumps(k['errors'], ensure_ascii=False)[:800])
        if k.get('rate_limits'):
            print('    rate_limits:', json.dumps(k['rate_limits'], ensure_ascii=False)[:300])
        if a.kampaniya:   # что лежит в кампании против того, что подавали
            j = json.load(open(a.kampaniya))
            for api, sn in (('OptInMessage', 'opt_in_message'), ('OptOutMessage', 'opt_out_message'),
                            ('HelpMessage', 'help_message'), ('Description', 'description'),
                            ('MessageFlow', 'message_flow'), ('MessageSamples', 'message_samples')):
                if api in j and j[api] != k.get(sn):
                    print(f'    ! {sn} в кампании не как в json: «{str(k.get(sn))[:90]}»'
                          + (' — похоже, подмена Twilio: Advanced Opt-Out на сервисе выключен (29.09)' if api in ('OptOutMessage', 'HelpMessage') else ''))

print('номера аккаунта (куда идут входящие):')
for n, d in akk.items():
    host = lambda u: (urllib.parse.urlsplit(u).netloc or '—') if u else '—'
    print(f"  {n}: sms_url {host(d.get('sms_url'))} · voice_url {host(d.get('voice_url'))}")
print('баланс:', t.balans())
