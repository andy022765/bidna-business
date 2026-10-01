# -*- coding: utf-8 -*-
"""og-теги, JSON-LD и география. До этого разметки не было ни в одном из 16 файлов,
а слов «США» / «русскоязычные» не было на сайте вообще — при том, что видимость
у ассистентов мы продаём."""
import json, pathlib, re

D = pathlib.Path(__file__).resolve().parent.parent
SEG = {
 'biznes': dict(url='https://businessinteldna.com/business/', file='biznes.html',
   title='Очевидный выбор — Business Intelligence DNA',
   desc='Бесплатный лист работ: три строки о вашем деле — и видно, что в продажах, маркетинге и '
        'видимости берут на себя цифровые сотрудники, что пишем под вас мы и что остаётся вам. '
        'Без регистрации.',
   foot='Интеллект-система для владельцев бизнеса. Работаем под NDA.',
   foot2='Позиционирование и внедрение цифровых сотрудников для русскоязычных владельцев бизнеса '
         'в США — на месте и удалённо по стране. Работаем на русском и английском, под NDA.'),
 'ekspert': dict(url='https://businessinteldna.com/expert/', file='ekspert.html',
   title='Тот самый — Business Intelligence DNA',
   desc='Бесплатный лист практики: три строки о вашей работе — и видно, что пойдёт без вас, '
        'что пишем под вас мы и что останется только вам. Без регистрации.',
   foot='Интеллект-система для экспертов. Работаем под NDA.',
   foot2='Позиционирование и внедрение цифровых сотрудников для русскоязычных экспертов '
         'и практиков в США — на месте и удалённо по стране. Работаем на русском и английском, под NDA.'),
}

ORG = {
 "@type": "Organization", "@id": "https://businessinteldna.com/#org",
 "name": "Business Intelligence DNA", "url": "https://businessinteldna.com/",
 "description": "Сервис позиционирования и внедрения цифровых сотрудников для русскоязычных "
                "владельцев бизнеса и экспертов в США. Находим, чем вы отличаетесь, формулируем это "
                "в одно предложение и собираем под него оффер, сайт и цифровых сотрудников "
                "в маркетинг и продажи. Ведут двое: предприниматель и экс-CFO, под NDA, "
                "без доступа к счетам, CRM и базе клиентов.",
 "areaServed": {"@type": "Country", "name": "United States"},
 "knowsLanguage": ["ru", "en"],
 "founder": [{"@type": "Person", "name": "Андрей"}, {"@type": "Person", "name": "Маша"}],
}

def offers(seg):
    what = 'бизнеса' if seg == 'biznes' else 'практики'
    return [
      {"@type": "Offer", "name": "Лист работ", "price": "0", "priceCurrency": "USD",
       "description": "Три вопроса о вашем деле — и лист из одиннадцати работ, из которых состоят "
                      "продажи, маркетинг и видимость, с указанием, кто каждую делает: цифровой "
                      "сотрудник, ваш человек или вы. Без регистрации."},
      {"@type": "Offer", "name": "Глубокая диагностика", "price": "500", "priceCurrency": "USD",
       "description": "Три рабочих дня: разбор рынка и конкурентов, документ на руки и разбор "
                      "один на один. Сумма засчитывается во внедрение."},
      {"@type": "Offer", "name": "Внедрение", "priceCurrency": "USD",
       "priceSpecification": {"@type": "PriceSpecification", "minPrice": "5000", "priceCurrency": "USD"},
       "description": "ДНК " + what + ": продающий оффер, сайт, который продаёт, и внедрённые "
                      "цифровые сотрудники в маркетинг, продажи и видимость. Ядро — "
                      "до 10 рабочих дней, плюс 30 дней сопровождения."},
    ]

for seg, c in SEG.items():
    p = D / c['file']; s = p.read_text(encoding='utf-8')
    if 'og:type' in s:
        print(seg, '| og уже есть, пропускаю'); continue

    s = re.sub(r'<meta name="description" content="[^"]*">',
               '<meta name="description" content="%s">' % c['desc'], s, count=1)

    graph = [ORG, {"@type": "WebPage", "@id": c['url'] + "#page", "url": c['url'],
                   "name": c['title'], "description": c['desc'],
                   "inLanguage": "ru", "isPartOf": {"@id": "https://businessinteldna.com/#org"},
                   "about": {"@id": "https://businessinteldna.com/#org"}},
             {"@type": "Service", "provider": {"@id": "https://businessinteldna.com/#org"},
              "serviceType": "Позиционирование и внедрение цифровых сотрудников",
              "areaServed": {"@type": "Country", "name": "United States"},
              "hasOfferCatalog": {"@type": "OfferCatalog", "name": "Три шага",
                                  "itemListElement": offers(seg)}}]
    head = (
      '<meta property="og:type" content="website">\n'
      '<meta property="og:site_name" content="Business Intelligence DNA">\n'
      '<meta property="og:locale" content="ru_RU">\n'
      '<meta property="og:url" content="%s">\n'
      '<meta property="og:title" content="%s">\n'
      '<meta property="og:description" content="%s">\n'
      '<meta name="twitter:card" content="summary_large_image">\n'
      '<link rel="canonical" href="%s">\n'
      '<script type="application/ld+json">%s</script>\n'
    ) % (c['url'], c['title'], c['desc'], c['url'],
         json.dumps({"@context": "https://schema.org", "@graph": graph}, ensure_ascii=False))
    s = s.replace('</head>', head + '</head>', 1)

    s = s.replace('<div>%s</div>' % c['foot'],
                  '<div>%s</div>\n      <div style="margin-top:6px">%s</div>' % (c['foot'], c['foot2']), 1)
    p.write_text(s, encoding='utf-8')
    print(seg, '| og+JSON-LD добавлены, география в подвал')
