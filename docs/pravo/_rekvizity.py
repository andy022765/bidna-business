# -*- coding: utf-8 -*-
"""Реквизиты и подстановка заглушек в юридические документы.

Одно место правды. Если что-то поменяется (появится почта на домене, зарегистрируем
trade name, сменится адрес) — правим здесь и прогоняем по всем документам разом,
а не ищем руками по трём файлам на двух языках.
"""
import pathlib
import re

LLC = 'Wealthboosterpro LLC'
DBA = 'Business Intelligence DNA'
FULL = '%s (DBA %s)' % (LLC, DBA)
ADDRESS = '5830 E 2nd St Ste 7000, Casper, WY 82609, USA'
EMAIL = 'support@businessinteldna.com'   # с 14.09 одна почта везде — решение Андрея (была bizzinteldna@gmail.com)
STATE = 'Вайоминг'
SITE = 'businessinteldna.com'
TELEGRAM = 'https://t.me/business_int_dna'

# Добавлено 14.09.2026 под регистрацию в Twilio (Trust Hub и A2P 10DLC).
# Регистратор сверяет эти данные с базой IRS — писать надо буква в букву как в EIN-письме.
EIN = '99-4784634'                  # получен в 2024, старше 90 дней — по возрасту вопросов нет
REP_NAME = 'Andrii Zhyla'           # уполномоченное лицо
REP_TITLE = 'CEO'                   # должность, она же job position в заявке
REP_PHONE = '+15614516864'          # личный, в формате E.164 — требование регистратора
BUSINESS_TYPE = 'Limited Liability Company'
BUSINESS_INDUSTRY = 'PROFESSIONAL'  # консалтинг и профессиональные услуги

# Почта на домене. Бесплатные адреса (gmail и прочие) регистратор Twilio отклоняет:
# «Personal or free email addresses ... will result in a brand failure».
# Пока ящики не заведены — здесь стоит рабочий gmail, и это ЗНАЧИТ, что заявку подавать рано.
# Заведено 14.09.2026: Google Workspace на домене. Основной ящик support@,
# к нему алиасами andrii@ и hello@ (последний — тот, от которого шлёт Resend).
EMAIL_BRAND = 'andrii@businessinteldna.com'      # именной, для заявки в Twilio
EMAIL_SUPPORT = 'support@businessinteldna.com'   # публичный, в документах
POCHTA_NA_DOMENE = True

# Заглушки, которые могли поставить агенты, — все известные варианты написания.
FOUNDER_1 = 'Andrii Zhyla'
FOUNDER_2 = 'Maryna Zhyla'
MEET = 'Zoom'
MEET_POLICY = 'zoom.us/privacy'
COUNTY = 'округ Натрона (Natrona County)'   # Каспер находится в нём — следует из адреса
DATE = '8 сентября 2026 года'              # дата вступления документов в силу

# Пустые места, которые заполняются РУКОЙ под конкретного клиента при подписании NDA.
# Их не трогаем и на них не ругаемся — это бланк, а не недоделка.
BLANKS_OK = ('КЛИЕНТА', 'ПОДПИСАНТА', 'ФОРМА И ШТАТ')

SUB = [
    (r'Андрей\s*\[\s*ФАМИЛИЯ\s*\]', FOUNDER_1),
    (r'Мария\s*\[\s*ФАМИЛИЯ\s*\]', FOUNDER_2),
    (r'\[\s*ФАМИЛИЯ\s*\]', ''),
    (r'\[\s*СЕРВИС\s+ВИДЕОСВЯЗИ\s*\]', MEET),
    (r'\[\s*ССЫЛКА\s+НА\s+ЕГО\s+ПОЛИТИКУ\s*\]', MEET_POLICY),
    (r'\[\s*АДРЕС\s+LLC\s*\]', ADDRESS),
    (r'\[\s*ОКРУГ\s+ВАЙОМИНГА\s*\]', COUNTY),
    (r'\[\s*ДАТА\s+ВСТУПЛЕНИЯ\s+В\s+СИЛУ\s*\]', DATE),
    (r'\[\s*ССЫЛКА\s+НА\s+УСЛОВИЯ\s*\]', 'businessinteldna.com/terms'),
    (r'\[\s*ССЫЛКА\s+НА\s+ПОЛИТИКУ\s*\]', 'businessinteldna.com/privacy'),
    (r'\[\s*(ПОЛНОЕ\s+)?НАЗВАНИЕ\s+(ЮР\w*\s+ЛИЦА|LLC|КОМПАНИИ)\s*\]', FULL),
    (r'\[\s*НАЗВАНИЕ\s*\]', FULL),
    (r'\[\s*(ЮРИДИЧЕСКИЙ\s+)?АДРЕС\s*\]', ADDRESS),
    (r'\[\s*EMAIL[^\]]*\]', EMAIL),
    (r'\[\s*(ПОЧТА|E-MAIL)[^\]]*\]', EMAIL),
    (r'\[\s*САЙТ\s*\]', SITE),
    (r'\[\s*TELEGRAM\s*\]', TELEGRAM),
    (r'\[\s*ШТАТ\s*\]', STATE),
]


def fill(text):
    """Подставить реквизиты. Возвращает (текст, список оставшихся заглушек)."""
    for pat, val in SUB:
        text = re.sub(pat, val, text, flags=re.I)
    left = sorted(set(re.findall(r'\[[^\]\n]{2,80}\]', text)))
    left = [x for x in left if not any(k in x for k in BLANKS_OK)]
    return text, left


if __name__ == '__main__':
    import sys
    for f in sys.argv[1:]:
        p = pathlib.Path(f)
        t, left = fill(p.read_text(encoding='utf-8'))
        p.write_text(t, encoding='utf-8')
        print('%-40s осталось заглушек: %s' % (p.name, left or 'нет'))
