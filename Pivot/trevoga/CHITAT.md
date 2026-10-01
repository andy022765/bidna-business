# Тревоги в Telegram (30.09)
Отдельный маленький сайт Netlify с одной функцией `trevoga`: принимает POST {key, text} и пишет Андрею в Telegram
от бота @business_int_dna_bot. Нужен облачному таргетологу (Claude Routines), у которого нет доступа к нашим ключам.
Переменные сайта: TG_BOT_TOKEN, TG_ANDREY_CHAT_ID, TREVOGA_KEY (значения — только в ~/.bidna-golos.env и в Netlify).
Выкладка: `NETLIFY_SITE_ID=<id> netlify deploy --prod --dir=public --functions=functions` из этой папки.

## Ящик медиа (30.09 вечер) — функция `media.mjs` (Netlify Functions 2.0), адрес `/m/<имя>`
Для облачного таргетолога: `PUT https://bidna-trevoga-56f336.netlify.app/m/<имя>` (тело — байты mp4/png/jpg, заголовок
`x-bidna: targetolog`) → Netlify Blobs (в функциях 2.0 контекст Blobs приходит сам, токен не нужен) → ответ
`{"ok":true,"url":"https://<id выкладки>--bidna-trevoga-56f336.netlify.app/m/<имя>","bytes":N,"otkuda":"deploy"}`;
`GET` по этому адресу отдаёт файл — его и даём `ads_creative_upload_media` (upload_source URL).
Почему в ответе хост ВЫКЛАДКИ, а не боевой: Meta кэширует robots.txt по хосту — боевой хост остался у неё «запрещённым» после
старого `Disallow: /` (ошибка «couldn't be downloaded… blocked by a robots.txt»), а по свежему хосту выкладки та же картинка
скачалась сразу (проверено 30.09 ~17:10, image hash 9c2c80ee…). robots.txt теперь: facebookexternalhit — Allow: /, остальным —
Allow: /m/, Disallow: /. Рамки: имя `[a-z0-9_-]{3,60}.(mp4|png|jpg)`, сигнатура файла, ≤ 4 МБ, ≤ 40 загрузок в сутки, живёт
48 часов. Ключа нет (как у тревог). Облачный клиент — `tools/zalit.py` в репозитории таргетолога (печатает адрес из ответа).
Выкладка этого сайта: папка копируется в scratchpad (там `node_modules` с `@netlify/blobs` 11.x), оттуда
`NETLIFY_SITE_ID=cca5b5ad-2097-421e-9f11-49fcce195d7a netlify deploy --prod --dir=public --functions=functions --skip-functions-cache`.
Старая версия на функциях 1.0 (connectLambda) — `functions/media.v1-lambda.js.bak-2026-09-30`, в выкладку не идёт.
