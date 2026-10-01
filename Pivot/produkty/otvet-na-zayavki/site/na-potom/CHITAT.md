# na-potom — своя запись на звонок (ОТЛОЖЕНО 29.09.2026)

**В выкладку не входит.** Netlify берёт функции только из `netlify-functions/` и публикует только `web/`; правила `/zapis` в `netlify.toml` нет. Тест `tests/test-vykladka.js` падает, если живые функции потянут что-то отсюда или `zapis.js` вернётся в `netlify-functions/`.

## Почему отложено

Решение Андрея 29.09 ~18:05: «Оставляем просто календарь, сразу приходит календарь календли… Это двойная работа». У нас своя система записи есть — Calendly (`calendly.com/businessinteldna-support/30min`), живой путь даёт на неё ссылку. Код ниже нужен **клиентам без своей системы записи**: письмо с тремя временами в разные дни, страница с кнопкой, запись в Google-календарь с перепроверкой, подтверждение с `.ics`, письма владельцу «Записался» и «Запись НЕ прошла».

Код перенесён как был (до 29.09 ~18:05 прошёл ревью), поменялись только пути `require` и склейка паспорта.

## Что здесь

| Файл | Что |
|---|---|
| `netlify-functions/zapis.js` | страница `/zapis`: GET только показывает, POST записывает |
| `lib/gkal.js` | **побайтная копия** `Pivot/golos/site/kalendar-lib/gkal.js` — не править; обновлять `skripty/skopirovat-gkal.sh` |
| `lib/tekst-okna.js` | три окна в разные дни; проверка одного окна |
| `lib/tekst-zapis.js` | токены, замки, запись, перепроверка (уступаем Вере) |
| `lib/stranica.js` | страница подтверждения |
| `lib/pisma-zapis.js` | письмо с тремя окнами, подтверждение с `.ics`, владельцу «ответ ушёл» с окнами, «Записался», «Запись НЕ прошла». Общее (отправка, экранирование, имя) — из живого `lib/pisma.js` |
| `lib/okna-v-pismo.js` | то, что `zayavka-background` делал между потолками и отправкой: окна → токены |
| `lib/zdorovie-zapis.js` | календарная часть проверки после выкладки: календарь виден, календарь записей ЗАКРЫТ, `/zapis` открывает нашу страницу |
| `lib/kartochka-zapis.js` | склейка паспорта `kartochka/<клиент>.json` + `na-potom/kartochka/<клиент>-zapis.json`, настройки для gkal, проверка календарной части |
| `kartochka/bid-zapis.json` | часы, пояс (Лос-Анджелес), длина 30 мин, запас 15, встреча, тексты окон и подтверждения |
| `tests/` | 45 тестов: окна (11), запись (19), письмо с окнами (7), проверка после выкладки (4), паспорт и gkal (4) |

## Тесты

```
NODE_PATH=<папка вне Drive>/node_modules node --test "na-potom/tests/test-*.js"     # или npm run test:na-potom
```

В `vylozhit.sh` не входят (живой путь от них не зависит; иначе расхождение `gkal.js` с Верой блокировало бы выкладку того, что календарём не пользуется). Гонять при любой правке общих `lib/pisma.js`, `lib/kartochka.js`, `lib/hranilishche.js`, `tests/_feyki.js` — отложенный код их использует. Все проверки своей записи, что были до решения, сохранены: 30 тестов окон и страницы записи — без изменений по сути; 13 перенесены из тестов заявки, проверки после выкладки и паспорта (там теперь Calendly); 2 новых — склейка паспорта. Токены для страницы записи берутся из `lib/okna-v-pismo.js`, а не из письма `zayavka-background`.

## Как вернуть для клиента без своей записи

1. Дополнение паспорта `na-potom/kartochka/<клиент>-zapis.json` по образцу `bid-zapis.json`; строку в `DOPOLNENIYA` (`lib/kartochka-zapis.js`). `ssylka_zapisi` у такого клиента нет.
2. Файлы назад: `netlify-functions/zapis.js` → `netlify-functions/`, `lib/*` → `lib/`, тесты → `tests/`; в `require` заменить `../../lib/` на `./` (и `../../tests/_feyki` на `./_feyki`).
3. `zayavka-background`: если в паспорте нет `ssylka_zapisi` — `KZ.vzyat()`, `oknaDlyaPisma(k, lid)`, письмо `pismoOtvetSOknami(k, lid, ssylki, baza)`, владельцу `pismoVladelcuOtvetSOknami(k, lid, {otvet, ssylki, kalendar_oshibka, sekund, pismo, posledneeSegodnya})`. `K.proverit` потребует `ssylka_zapisi` — для такого клиента проверять `KZ.proveritZapis`.
4. `zdorovie`: добавить `proverkaZapisi(k)` и её `ok` в общий.
5. `netlify.toml`:
   ```
   [[redirects]]
     from = "/zapis"
     to = "/.netlify/functions/zapis"
     status = 200
     force = true
   ```
6. Переменные: `OTVET_KALENDAR_ID` (календарь записей — ОТДЕЛЬНЫЙ ЗАКРЫТЫЙ; «Вера-демо» публичный, проверка его отобьёт), `OTVET_KALENDAR_ZANYATOST` (основной календарь владельца, только занятость), `OTVET_BAZA_URL` (адрес сайта; домен клиента — только когда там есть прокси `/zapis`). Ключ служебного аккаунта — в Blobs сайта: `npx netlify-cli blobs:set kalendar-klyuch sa --input "$HOME/bidna-klyuchi/vera-kalendar.json"` (переменной не влезает: 4 КБ на все переменные).

Известные ограничения (как было): гостя в событие не ставим — служебный аккаунт не может приглашать (403), человек узнаёт о встрече только из нашего письма; ссылку на Zoom владелец шлёт сам.
