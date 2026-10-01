"""Общее для скриптов скилла sms-registraciya: ключи из env-файла, запрос к Twilio, листание страниц.
Секреты не печатаем никогда. Python с python.org не видит сертификаты macOS — поэтому certifi (грабля 24.09 и 29.09).
Скрипты ставят sys.dont_write_bytecode = True ДО импорта этого файла: иначе __pycache__ ляжет в папку скилла на Drive."""
import base64, json, os, ssl, urllib.error, urllib.parse, urllib.request

try:
    import certifi
    CTX = ssl.create_default_context(cafile=certifi.where())
except ImportError:
    CTX = ssl.create_default_context()

API = 'https://api.twilio.com/2010-04-01'
MSG = 'https://messaging.twilio.com/v1'
TH = 'https://trusthub.twilio.com/v1'

# Наше (Wealthboosterpro LLC dba Business Intelligence DNA) — по ним скрипты отличают нашу подачу от клиентской.
NASH_PROFIL = 'BU64761052fe6d498b4e6e66fdb6d74d41'   # Primary Customer Profile, twilio-approved 15.09
NASH_SERVIS = 'MG2cc9baf6e7aa017fa470fc374d2a1124'   # «BIDNA A2P», кампания QE2c6890… подана 29.09
NASH_DOMEN = 'businessinteldna.com'
# Правило Андрея 25.09: клиенту ничего не подаём, пока НАША кампания не VERIFIED. Снимает только Андрей.
SNYAT_PRAVILO = '--bez-nashego-odobreniya'


class Twilio:
    def __init__(self, env_put='~/.bidna-golos.env'):
        env = {}
        for line in open(os.path.expanduser(env_put)):
            line = line.strip().removeprefix('export ')
            if '=' in line and not line.startswith('#'):
                k, v = line.split('=', 1)
                env[k.strip()] = v.strip().strip('"').strip("'")
        self.sid = env['TWILIO_ACCOUNT_SID']
        self._auth = 'Basic ' + base64.b64encode(f"{self.sid}:{env['TWILIO_AUTH_TOKEN']}".encode()).decode()

    def zapros(self, metod, url, dannye=None, molcha=False):
        """dannye — dict; списки уходят повторяющимися параметрами (doseq), bool — строками 'true'/'false'."""
        body = None
        if dannye is not None:
            d = {k: (('true' if v else 'false') if isinstance(v, bool) else v) for k, v in dannye.items()}
            body = urllib.parse.urlencode(d, doseq=True).encode()
        r = urllib.request.Request(url, data=body, method=metod, headers={'Authorization': self._auth})
        try:
            with urllib.request.urlopen(r, timeout=30, context=CTX) as o:
                return json.load(o)
        except urllib.error.HTTPError as e:
            tekst = e.read().decode()[:600]
            if molcha:
                return {'_oshibka': e.code, '_tekst': tekst}
            raise SystemExit(f'! {metod} {url} -> {e.code} {tekst}')

    def vse(self, url, klyuch):
        """Все страницы списка: у messaging/trusthub — meta.next_page_url, у 2010-04-01 — next_page_uri."""
        out = []
        while url:
            j = self.zapros('GET', url)
            out += j.get(klyuch, [])
            url = (j.get('meta') or {}).get('next_page_url') or (
                'https://api.twilio.com' + j['next_page_uri'] if j.get('next_page_uri') else None)
        return out

    def nomera_akkaunta(self):
        return {n['phone_number']: n for n in self.vse(
            f'{API}/Accounts/{self.sid}/IncomingPhoneNumbers.json?PageSize=100', 'incoming_phone_numbers')}

    def servisy(self):
        return self.vse(f'{MSG}/Services?PageSize=50', 'services')

    def nomera_servisa(self, mg):
        return self.vse(f'{MSG}/Services/{mg}/PhoneNumbers?PageSize=50', 'phone_numbers')

    def kampanii(self, mg):
        return self.zapros('GET', f'{MSG}/Services/{mg}/Compliance/Usa2p').get('compliance', [])

    def balans(self):
        b = self.zapros('GET', f'{API}/Accounts/{self.sid}/Balance.json')
        return f"{b.get('balance')} {b.get('currency')}"

    def balans_usd(self):
        return float(self.zapros('GET', f'{API}/Accounts/{self.sid}/Balance.json').get('balance') or 0)

    def nasha_kampaniya(self):
        """Статус НАШЕЙ кампании: 'VERIFIED', 'IN_PROGRESS', 'FAILED'… или 'нет'."""
        k = self.kampanii(NASH_SERVIS)
        return k[0].get('campaign_status') if k else 'нет'

    def pravilo_25_09(self, klient, snyato):
        """Для клиента: без VERIFIED нашей кампании — выход. snyato — флаг SNYAT_PRAVILO (только по слову Андрея)."""
        if not klient:
            return
        st = self.nasha_kampaniya()
        if st == 'VERIFIED':
            return
        if snyato:
            print(f'! правило 25.09 снято флагом {SNYAT_PRAVILO} (наша кампания: {st}) — только если Андрей сказал это сам')
            return
        raise SystemExit(f'! наша кампания {st}, не VERIFIED. Правило Андрея 25.09: клиенту не подаём, пока свою не одобрили.\n'
                         f'  Снять может только Андрей; тогда тот же запуск с {SNYAT_PRAVILO}.')
