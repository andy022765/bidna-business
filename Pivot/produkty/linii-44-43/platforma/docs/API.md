# API пульта CareLine (№44): функции `pult` и `evv`

*30.09.2026. Пишет сборщик пульта. Функции `netlify-functions/pult.js`, `evv.js`, `svodka.js` пишет сборщик функций — по этому описанию и `KONTRAKT.md`; к 13:10 все три уже собраны на `lib/shablony/snimok.js` и `svodka.js`, разделы ниже сверены с их кодом. Меняешь формат — меняй здесь, в `lib/shablony/snimok.js` и сообщи сборщику пульта.*

*01.10 ночью: файл переехал из `web/pult/API.md` в `platforma/docs/API.md` — `web/` публикуется целиком, а описание функций наружу не нужно (проверка перед выкладкой, PROVERKA-PERED-VYKLADKOY.md).*

Страница: `web/pult/` → на стенде `/pult/`. Два режима:

| Адрес | Откуда данные | Загрузка CSV |
|---|---|---|
| `/pult/?k=<ключ>` | `GET /.netlify/functions/pult?k=<ключ>` | `POST /.netlify/functions/evv?k=<ключ>…` |
| `/pult/?demo=1` | `web/pult/demo.json` (статический файл) | не отправляется: файл читается в браузере, пульт честно пишет, что никуда не ушёл |
| `/pult/` без ключа | — | экран «Open your dashboard link» со ссылкой на демо (если ключа нет и в `sessionStorage` вкладки) |

Если в адресе есть и `k`, и `demo=1`, побеждает ключ.

**Ключ не остаётся в адресе (с 01.10).** Пульт читает `k` один раз, кладёт его в `sessionStorage` вкладки (`careline-pult-k`) и убирает из адреса через `history.replaceState`: ключ не виден через плечо, не попадает в закладку и историю навигации. Перезагрузка вкладки берёт ключ из `sessionStorage`; новая вкладка без `?k=` ключа не знает. `?demo=1` без `k` — всегда демо, даже если ключ в вкладке есть. Ответ 401 — ключ из `sessionStorage` стирается.

---

## 1. `GET /.netlify/functions/pult?k=<ключ>`

**Ключ → клиент.** Для каждого клиента из `nastroyki.json` берём `process.env[<pult_klyuch_env>]` (у brightside — `PULT_KLYUCH_BRIGHTSIDE`) и сравниваем с `k` за постоянное время. Пустая переменная или ключ короче 16 знаков — клиент закрыт. Ключ не писать в журнал и в ответ. Сделано в `lib/pult-dannye.js` (`klientPoKlyuchuPulta`; ключ принимается и заголовком `x-pult-klyuch`).

**Ответы.**

| Код | Когда | Тело |
|---|---|---|
| 200 | ключ подошёл | снимок (раздел 2) |
| 401 | ключа нет или не подошёл | `{"ok":false,"oshibka":"klyuch","soobshchenie":"…"}` — пульт покажет «This link does not open a dashboard» |
| 405 | не GET | `{"ok":false,"oshibka":"metod","soobshchenie":"GET only"}` |
| 503 | хранилище недоступно | `{"ok":false,"oshibka":"hranilishche","soobshchenie":"…"}` |
| 500 | код упал | `{"ok":false,"oshibka":"server","soobshchenie":"<коротко, по-английски>"}` — на 5xx пульт показывает «Could not load the dashboard» и текст после «Details:» |

Заголовки: `Content-Type: application/json; charset=utf-8`, `Cache-Control: no-store`, `X-Robots-Tag: noindex`. CORS не нужен: страница и функция на одном сайте (`connect-src 'self'` в `netlify.toml`).

**Как собрать ответ — готовая функция.** `lib/shablony/snimok.js` → `sobratSnimok({ klient, seychas, zapisi })` — эталон этого формата, покрыт `test/snimok.test.js`. Функции остаётся прочитать записи хранилища клиента и отдать результат:

```js
const { sobratSnimok } = require('../lib/shablony/snimok');
const NASTROYKI = require('../nastroyki.json');
// … ключ → klientId (см. выше)
const zapisi = {};
for (const vid of ['kandidaty', 'sidelki', 'klienty', 'smeny', 'otkazy', 'evv', 'zvonki', 'soglasiya']) {
  zapisi[vid] = await prochitatVse(`k-${klientId}`, `${vid}/`); // массив значений по префиксу ключа
}
const snimok = sobratSnimok({
  klient: { id: klientId, ...NASTROYKI[klientId] },   // nazvanie, demo, shtat, poyas, yazyki, zamena
  seychas: new Date(),
  zapisi,
});
return { statusCode: 200, headers: {...}, body: JSON.stringify(snimok) };
```

Так и сделано: записи читает `zapisiKlienta` из `lib/pult-dannye.js`. Сверх снимка функция добавляет `semi` (обращения семей, до 50) и `zhurnal` (журнал действий за сегодня, до 100) — пульт их пока не показывает, место под них есть. Сборщик сам режет окна и лимиты (раздел 3), поэтому хранилище можно отдавать целиком. Если записей станет много (тысячи кандидатов), читать по префиксу только нужные дни — формат ответа от этого не меняется.

---

## 2. Формат ответа (versiya 1)

Все времена — ISO 8601 со смещением пояса клиента (`2026-09-30T14:05:00-04:00`), как в контракте. Даты дня — `YYYY-MM-DD` в поясе клиента. Телефоны — E.164. Записи хранилища отдаются **как есть** (поля контракта), к ним только добавляются производные поля — они помечены ниже «(выводится)».

```jsonc
{
  "ok": true,
  "versiya": 1,
  "demo": true,                                  // из nastroyki.json; пульт показывает плашку DEMO
  "sformirovano": "2026-09-30T14:05:00-04:00",   // момент снимка
  "klient": { "id": "brightside", "nazvanie": "Brightside Home Care (DEMO)", "shtat": "NY",
              "poyas": "America/New_York", "yazyki": ["en","es","ru","zh","ht"], "opisanie": null },
  "nastroyki_zameny": { "volna": 3, "ozhidanie_min": 15, "eskalaciya_za_chasov": 2 },  // из nastroyki.json, или null
  "segodnya": Den,       // день снимка
  "vchera":   Den,       // предыдущий календарный день
  "voronka":  Voronka,   // 30 дней
  "kandidaty": [ ... ],       // 14 дней, новые сверху, ≤ 60
  "sobesedovaniya": [ ... ],  // с сегодняшнего дня и дальше, по времени, ≤ 20
  "otkazy": [ ... ],          // 7 дней по soobshcheno, новые сверху, ≤ 50
  "evv": { "posledniy": Progon | null, "progony": [ SvodkaProgona ] },  // ≤ 10 прогонов, новые сверху
  "soglasiya": [ ... ],       // новые сверху, ≤ 100
  "zvonki": [ ... ]           // 7 дней, новые сверху, ≤ 100
}
```

### Den — итоги одного дня

```jsonc
{
  "data": "2026-09-30",
  "zvonki": { "vsego": 6, "minut": 33,
              "po_yazykam": {"en":2,"es":2,"ru":2}, "po_liniyam": {"care-hiring":6},
              "po_namereniyam": {"rabota":5,"semya":1}, "po_itogam": {"zapisan":3,"perezvon":1} },
  "kandidaty": { "novyh": 6, "podhodyat": 5, "ne_podhodyat": 1, "po_yazykam": {"es":2,"ru":1,"en":3} },
  "sobesedovaniya": { "zapisano": 4, "naznacheno": 4, "prishli": 2, "ne_prishli": 1 },
  "otkazy": { "vsego": 2, "zakryto": 1, "eskalaciya": 1, "ne_zakryto": 0, "v_rabote": 0, "mediana_min": 12 },
  "evv": { "progonov": 0, "strok": 0, "isklyucheniy": 0, "kritichnyh": 0 }
}
```

| Поле | Что считается |
|---|---|
| `zvonki.*` | звонки, у которых `nachalo` в этот день; `minut` — сумма `dlitelnost_s` / 60, округлённо |
| `kandidaty.novyh` | `created_at` в этот день; `podhodyat`/`ne_podhodyat` — по `podhodit` |
| `sobesedovaniya.zapisano` | у кандидата есть `sobesedovanie`, и запись сделана в этот день: `sobesedovanie.zapisano_v`, если поле есть, иначе `created_at` |
| `sobesedovaniya.naznacheno` | `sobesedovanie.start` в этот день; `prishli` — из них `status = attended`, `ne_prishli` — `no_show` |
| `otkazy.*` | отказы с `soobshcheno` в этот день, по выведенному `status` (ниже); `mediana_min` — медиана `zakryta_za_min` закрытых, `null` если закрытых нет |
| `evv.*` | прогоны с `zagruzheno` в этот день; `kritichnyh` — исключения с «исправить до счёта» (раздел 4) |

### Voronka

```jsonc
{ "s": "2026-09-01", "po": "2026-09-30", "dney": 30,
  "etapy": [ {"kod":"new","n":125}, {"kod":"booked","n":64}, {"kod":"attended","n":35} ],
  "statusy": { "rejected":45, "attended":35, "waitlist":13, "no_show":17, "new":3, "booked":6, "reminded":6 },
  "otkazy_po_prichinam": [ {"kod":"net_sertifikata","tekst":"No HHA, PCA or CNA certificate","n":38}, ... ] }
```

Кандидаты с `created_at` в окне. Этапы накопительные: `new` — все, `booked` — у кого есть `sobesedovanie` (или статус booked/reminded/attended/no_show), `attended` — `status = attended`. `otkazy_po_prichinam` — кандидаты с `podhodit = false` по `prichina_otkaza`, по убыванию; `tekst` — английская подпись (раздел 4), для неизвестного кода — сам код.

### kandidaty[]

Запись `kandidaty/<id>` из контракта без изменений: `id, created_at, istochnik, conversation_id, yazyk, imya, telefon, email, sertifikat, rayon, zip, transport, grafik, yazyki, opyt_let, pravo_na_rabotu, podhodit, prichina_otkaza, sobesedovanie, status, soglasiya`.

Пульт по ним рисует «Recent applicants» и пункт «waiting for a callback»: `status = new`, `podhodit = true`, `sobesedovanie = null`, пришёл вчера или сегодня.

### sobesedovaniya[]

`{ kandidat_id, imya, telefon, yazyk, sertifikat, start, end, status }` — из кандидатов с `sobesedovanie.start` не раньше сегодняшнего дня.

### otkazy[] — запись контракта + выводимые поля

```jsonc
{
  // как в хранилище:
  "id": "otk-10", "smena_id": "sm-0930-BK-114", "sidelka_id": "s-18", "prichina": "Fever",
  "soobshcheno": "2026-09-30T05:02:00-04:00", "kanal": "sms",
  "volny":  [ { "at": "…05:03…", "sidelki": ["s-19","s-02","s-27"] } ],
  "otvety": [ { "sidelka_id": "s-19", "otvet": "da", "at": "…05:14…" }, { "sidelka_id": "s-02", "otvet": "da", "at": "…05:16…" } ],
  "zakreplena_za": "s-19", "zakreplena_v": "…05:14…", "eskalaciya_v": null,
  // выводится:
  "smena":  { "id", "start", "end", "kod_uslugi", "status", "klient_kod", "rayon", "zip" },   // из smeny + klienty
  "sidelka": { "id": "s-18", "imya": "Nadia Petrenko" },      // кто отказался
  "zamena":  { "id": "s-19", "imya": "Lyudmila Belenko" },    // кто взял, или null
  "status": "zakryta",                                        // см. ниже
  "zakryta_za_min": 12,                                       // zakreplena_v − soobshcheno, только для zakryta
  "predlozheno": 3                                            // уникальные сиделки по всем волнам
}
```

**Статус отказа** (порядок проверок важен):

1. `zakreplena_v` есть → `zakryta` (замена нашлась; если была и `eskalaciya_v` — закрыл дежурный после побудки);
2. `smena.status = unfilled`, **или** стенд закрыл отказ без замены (`zakrit` / `ne_zakryta_v`, `lib/otkazy.js`), **или** смена уже началась, а замены нет → `ne_zakryta`;
3. `eskalaciya_v` есть → `eskalaciya` (дежурного разбудили, смена ещё впереди и открыта);
4. иначе → `v_rabote` (предложения ушли, ждём ответа).

`smena.rayon` — не поле контракта, берётся из `klienty/<id>.rayon`, если он там есть; иначе `null`, и пульт покажет ZIP. Второе и следующие «ДА» после закрепления пульт показывает как «Another caregiver also said yes … and was told the shift is taken» — по `otvety`, отдельного поля не нужно.

### evv

```jsonc
"evv": {
  "posledniy": { "run_id", "zagruzheno", "shtat", "strok", "fayl",   // fayl — имя файла, необязательно
                 "isklyucheniya": [ Isklyuchenie ] },
  "progony": [ { "run_id", "zagruzheno", "shtat", "strok", "fayl", "isklyucheniy": 13, "kritichnyh": 5 } ]
}
```

`Isklyuchenie` — поля контракта `vizit_id, pravilo, vazhnost, chto_ne_tak, kak_ispravit` и два необязательных:

- `pravilo_tekst` — подпись правила по-английски («No clock-out»); без неё пульт возьмёт подпись из своего словаря (раздел 4) или очеловечит код;
- `vizit: { data, klient_kod, sidelka }` — чтобы в карточке было «Visit V-10217, Fri, Sep 25, client QN-156, caregiver Marjorie S.» (пункт из `demo.json`).

**Тексты `chto_ne_tak` и `kak_ispravit` — на английском**: их читает владелец агентства в США. Пульт выводит их как есть.

### soglasiya[]

Запись `soglasiya/<telefon>` из контракта (`telefon, zapis, ii, sms, istochnik, at`) + выводимое `kto: { tip: "kandidat"|"sidelka", imya } | null` — по совпадению телефона с кандидатами и сиделками. `zapis`/`ii`/`sms`: `true` / `false` / `null` (не спрашивали; для SMS-источника запись разговора не применима).

`istochnik`: `call`, `sms`, `sms_stop`, `sms_start` (подписи «Call», «Text», «Text: STOP», «Text: START»; неизвестное значение пульт покажет как есть).

### zvonki[]

Запись `zvonki/<conversation_id>` из контракта без изменений: `conversation_id, liniya, nachalo, dlitelnost_s, yazyk, namerenie, itog, kratko, soglasiya`. `kratko` — одна-две фразы **по-английски**, пульт и сводка выводят их как есть.

---

## 3. Окна, лимиты, пояс

| Что | Окно | Лимит | Порядок |
|---|---|---|---|
| `voronka` | 30 дней, включая сегодня | — | — |
| `kandidaty` | 14 дней | 60 | новые сверху |
| `sobesedovaniya` | с сегодняшнего дня | 20 | по времени |
| `otkazy` | 7 дней по `soobshcheno` | 50 | новые сверху |
| `zvonki` | 7 дней | 100 | новые сверху |
| `soglasiya` | — | 100 | новые сверху |
| `evv.progony` | — | 10 | новые сверху |

«Сегодня», «вчера» и окна считаются по `klient.poyas`, а не по UTC сервера: звонок в 22:30 по Нью-Йорку — это тот же день, хотя в UTC уже завтра. Записи позже `seychas` в снимок не попадают (сводка в 7:00 не видит дневных событий). Окна и лимиты меняются параметрами `okna` / `limity` у `sobratSnimok`.

---

## 4. Коды и подписи (английский для владельца)

Пульт понимает эти коды; неизвестный код показывает как есть, с заглавной буквы и пробелами вместо `_`. Новый код — добавь подпись в `pult.js` (словари сверху файла) и `svodka.js`.

| Поле | Коды → подпись |
|---|---|
| `kandidat.prichina_otkaza` | `net_sertifikata` No HHA, PCA or CNA certificate · `vne_rayona` Lives outside the service area · `grafik` Availability does not match open shifts · `net_transporta` No way to reach clients · `pravo_na_rabotu` Not authorized to work in the US · `opyt` Less experience than required · `yazyk` Language requirement not met · `drugoe` Other reason |
| `kandidat.status` | `new` · `booked` · `reminded` · `attended` · `no_show` · `rejected` · `waitlist` (контракт) |
| `zvonok.liniya` | `care-hiring` Hiring line · `care-caregivers` Caregiver line |
| `zvonok.namerenie` | `rabota` Job applicant · `semya` Family asking about care · `otkaz` Shift call-off · `drugoe` Other |
| `zvonok.itog` | `zapisan` Interview booked · `ocenka` Home assessment booked · `ne_podhodit` Did not qualify · `list_ozhidaniya` Added to waitlist · `perezvon` Callback requested · `otkaz_prinyat` Call-off recorded · `soobshchenie` Message for staff · `perevod` Transferred to staff · `net_soglasiya` Declined recorded AI call · `sbros` Hung up · `oshibka` Technical error |
| `isklyuchenie.vazhnost` | «исправить до счёта»: `kritichno` (или `critical`, `high`, `vysokaya`, `blokiruet`) · «проверить»: `preduprezhdenie` (или `warning`, `medium`, `srednyaya`, `vazhno`) · остальное — «заметка» |
| `isklyuchenie.pravilo` (предложение движку EVV) | `net_otmetki_prihoda` No clock-in · `net_otmetki_uhoda` No clock-out · `mesto` Location does not match · `dlitelnost` More hours than authorized · `peresechenie` Overlapping visits · `avtorizaciya_daty` Outside authorization dates · `avtorizaciya_kod` Service not on authorization · `ruchnaya_otmetka` Manual entry without reason · `net_polya` Missing EVV field · `korotkiy_vizit` Shorter than scheduled |

Статусы на экране — формой и цветом одновременно: круг = готово, треугольник = требует внимания, квадрат = проблема, кольцо = в работе/заметка, черта = действий не нужно. Слово рядом всегда есть.

---

## 5. `POST /.netlify/functions/evv` — загрузка выгрузки EVV

Пульт шлёт только в режиме с ключом:

```
POST /.netlify/functions/evv?k=<ключ>&shtat=NY&fayl=visits_2026-09-21_to_09-27.csv
Content-Type: text/csv; charset=utf-8
<тело — CSV как есть, UTF-8, не больше 5 МБ; пульт проверяет размер и расширение до отправки>
```

| Параметр | Что |
|---|---|
| `k` | тот же ключ пульта; проверка как в разделе 1 |
| `shtat` | `NY` или `NC` — чьи правила применять; по умолчанию пульт ставит `klient.shtat` |
| `fayl` | имя файла для истории прогонов (необязательно) |

**Ответ 200:** `{ "ok": true, "progon": { "run_id", "zagruzheno", "shtat", "strok", "fayl", "isklyucheniya": [ Isklyuchenie ] } }`. Функция сохраняет прогон в `evv/<run_id>` — следующий `GET pult` покажет его как `evv.posledniy`. Пульт сразу рисует присланный прогон, потом перечитывает снимок.

**Ошибки** — JSON `{ "ok": false, "soobshchenie": "<по-английски, её увидит владелец>" }`: 400 — нет строк под заголовком; 401 — ключ; 413 — больше 5 МБ; 422 — движок не смог прочитать файл; 503 — хранилище недоступно. Пульт показывает `soobshchenie` как есть.

Функция принимает и JSON `{ csv, shtat, fayl }` с `Content-Type: application/json`; прогон может нести поля движка `kolonki` и `svodka` — пульт их пропускает.

Стенд демо-клиента (`demo: true`) показывает над формой «Demo stand: upload only demo files, never real client information». До цепочки BAA настоящие выгрузки на стенд не загружаем.

---

## 6. Демо-режим и сводка

- `web/pult/demo.json` собирается генератором `node lib/shablony/demo-pult.js` (из `platforma/`): вымышленное агентство, телефоны 555-01xx, почта @example.com, снимок на 30.09.2026 14:05 ET. Тот же запуск пишет образец письма `web/demo/care/svodka.html`. `test/snimok.test.js` падает, если `demo.json` отстал от генератора.
- Утренняя сводка: функция `svodka` в 7:xx по поясу клиента собирает снимок тем же `sobratSnimok({ …, seychas: new Date() })`, добавляет `ssylka_pult` и зовёт `renderSvodka(snimok)` из `lib/shablony/svodka.js` → `{ tema, html, text }`. Цифры письма и пульта совпадают, потому что источник один.
- Кнопка «Open the dashboard» в письме ведёт на `/pult/` **без ключа** (решение сборщика функций: ключ в почте не лежит). Без ключа пульт показывает «Open your dashboard link» — владелец открывает пульт своей ссылкой с ключом. Если захотим, чтобы кнопка открывала пульт сразу, — два пути, оба решение Андрея: ключ в письме (кто получил письмо, тот видит пульт) или «запомнить ключ на этом устройстве» в самом пульте.

## 7. Проверка

```
cd platforma
node --test test/svodka.test.js test/snimok.test.js   # шаблон письма и снимок (сборщик пульта)
npm test                                               # весь стенд: node --test test/*.test.js
```

`test/svodka.test.js` — шаблон письма (`lib/shablony/svodka.js`), `test/snimok.test.js` — сборщик снимка и свежесть `demo.json`. Функцию `netlify-functions/svodka.js` (расписание, замок, отправка) проверяет `test/stend-svodka.test.js` сборщика стенда.
