# -*- coding: utf-8 -*-
"""Встроить SMS-согласие в основной сайт — одной командой, ПОСЛЕ вечерней выкладки.

    python3 Pivot/sms-kampaniya/vstroit.py            — только проверить: всё ли встанет (ничего не меняет)
    python3 Pivot/sms-kampaniya/vstroit.py --primenit — применить
    python3 Pivot/sms-kampaniya/vstroit.py --otkat    — вернуть файлы как было до --primenit
    … --bez-glavnoy   — не добавлять ссылку на /sms в подвал главной (merge_site.py)

Что делает --primenit (и ничего сверх этого):
  1. собирает и проверяет страницы (sobrat.py) и гоняет тест функции (test/test.js);
  2. примеряет все правки через `patch --dry-run -F 0` (контекст строго, без «примерно»),
     сверяет sha256 docs/pravo/sms.md с тем, что было 29.09 (файл заменяется целиком — чужие
     правки в нём пропали бы молча), и ищет якоря точечной правки merge_site.py (каждый ровно
     один раз) — не сошлось хоть что-то, не меняет НИЧЕГО;
  3. кладёт копии исходных файлов в _bylo/<время>/ (для --otkat);
  4. docs/pravo/sms.md       ← pravo/sms.md (новая программа: согласие на сайте);
     docs/pravo/privacy.md   ← pravo/privacy.patch;
     docs/pravo/contacts.md  ← pravo/contacts.patch;
     deploy.sh               ← patchi/deploy.patch (шаг sobrat.py + проверка двух адресов и функции);
     landings/_src/merge_site.py ← ссылка «Сообщения» / «Messaging» на /sms в подвал главной
                               (/ и /en/): проверяющий сравнивает сайт бренда с заявкой. Имя то же,
                               что в подвалах лендингов (sborka.py, PRAVO): одно имя одному документу,
                               и слово SMS в видимом тексте не пишем;
     netlify-functions/sms-soglasie.js ← sms-soglasie.js;
  5. подставляет дату вступления в силу ({{DATA_VYKLADKI}}) — сегодняшнюю или из --data.

submission-created.js НЕ трогает: форма согласия не форма Netlify, тот обработчик о ней
не узнает. Защитная строка на случай, если кто-то повесит data-netlify, лежит в
patchi/submission-created.patch — ставится флагом --s-zashchitoy, по желанию.

Ничего не выкатывает. Выкладка — обычный ./deploy.sh в окно дня, потом proverit.py.
"""
import datetime
import hashlib
import os
import shutil
import subprocess
import sys

KAMP = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(KAMP))
BYLO = os.path.join(KAMP, '_bylo')

PATCHI = [  # (патч, файл, признак «уже стоит»)
    ('pravo/privacy.patch', 'docs/pravo/privacy.md', 'sms-consent'),
    ('pravo/contacts.patch', 'docs/pravo/contacts.md', 'sms-consent'),
    ('patchi/deploy.patch', 'deploy.sh', 'sms-kampaniya/sobrat.py'),
]
ZASHCHITA = ('patchi/submission-created.patch', 'netlify-functions/submission-created.js', 'sms-soglasie.js')
KOPII = [('pravo/sms.md', 'docs/pravo/sms.md'), ('sms-soglasie.js', 'netlify-functions/sms-soglasie.js')]
# docs/pravo/sms.md заменяется целиком. Его отпечаток на 29.09 (версия 1.0, «устно в звонке»):
# если к выкладке он другой, кто-то его правил — копия затёрла бы эти правки молча.
SMS_MD_BYLO = '34d2bf0f6a858a3c28f014cbf10d23d55933f9332fbb8a7c20188be446a1e2b1'
# Подвал главной: merge_site.py в эти дни правят часто, контекстный патч там ломается от любой
# соседней строки. Поэтому точечно: каждый якорь обязан встретиться ровно один раз.
GLAVNAYA = 'landings/_src/merge_site.py'
SSYLKA = ('<a style="display:inline-block;min-height:44px;min-width:44px;line-height:44px;'
          'text-align:center" href="/contacts">%s</a>')
GLAVNAYA_PRAVKI = [
    ('yur=("Условия", "Конфиденциальность", "Контакты"),',
     'yur=("Условия", "Конфиденциальность", "Контакты", "Сообщения"),'),
    ('yur=("Terms", "Privacy", "Contacts"),',
     'yur=("Terms", "Privacy", "Contacts", "Messaging"),'),
    (SSYLKA + '</div>',
     SSYLKA + ' · ' + SSYLKA.replace('href="/contacts"', 'href="/sms"') + '</div>'),
]
MESYACY = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа',
           'сентября', 'октября', 'ноября', 'декабря']


def sh(cmd, **kw):
    return subprocess.run(cmd, cwd=ROOT, capture_output=True, text=True, **kw)


def uzhe_stoit(fayl, priznak):
    return priznak in open(os.path.join(ROOT, fayl), encoding='utf-8').read()


def primerit(patchi):
    """Примерить патчи. Возвращает список (патч, файл) к применению; падает, если не ложится."""
    k_primeneniyu = []
    for patch, fayl, priznak in patchi:
        if uzhe_stoit(fayl, priznak):
            print('  · %-34s уже стоит — пропускаю' % fayl)
            continue
        r = sh(['patch', '-p0', '-F', '0', '--dry-run', '--silent', '-i', os.path.join(KAMP, patch)])
        if r.returncode != 0:
            raise SystemExit('  ! %s не ложится на %s — файл поменялся после 29.09.\n%s\n'
                             '    Ничего не изменено. Правку внести руками по тексту патча '
                             '(он короткий) или пересобрать патч.' % (patch, fayl, (r.stdout + r.stderr).strip()))
        print('  ✓ %-34s ложится' % fayl)
        k_primeneniyu.append((patch, fayl))
    return k_primeneniyu


def sverit_sms_md():
    """True — копировать pravo/sms.md; False — уже стоит; падает, если файл правили без нас."""
    p = os.path.join(ROOT, 'docs', 'pravo', 'sms.md')
    t = open(p, 'rb').read()
    if b'sms-consent' in t:
        print('  · %-34s уже стоит — пропускаю' % 'docs/pravo/sms.md')
        return False
    if hashlib.sha256(t).hexdigest() != SMS_MD_BYLO:
        raise SystemExit('  ! docs/pravo/sms.md поменялся после 29.09 (sha256 не тот) — замена целиком '
                         'затёрла бы эти правки.\n    Ничего не изменено. Перенесите их в '
                         'Pivot/sms-kampaniya/pravo/sms.md и обновите SMS_MD_BYLO в vstroit.py.')
    print('  ✓ %-34s как 29.09 — заменю целиком' % 'docs/pravo/sms.md')
    return True


def primerit_glavnuyu():
    """True — править подвал главной; False — уже стоит; падает, если якоря не нашлись."""
    t = open(os.path.join(ROOT, GLAVNAYA), encoding='utf-8').read()
    if 'href="/sms"' in t:
        print('  · %-34s ссылка на /sms уже стоит — пропускаю' % GLAVNAYA)
        return False
    for staroe, _ in GLAVNAYA_PRAVKI:
        n = t.count(staroe)
        if n != 1:
            raise SystemExit('  ! %s: якорь найден %d раз, ждали 1:\n    %s\n    Ничего не изменено. '
                             'Подвал главной поменялся — добавьте ссылку на /sms руками или запустите '
                             'с --bez-glavnoy.' % (GLAVNAYA, n, staroe[:90]))
    print('  ✓ %-34s якоря подвала на месте' % GLAVNAYA)
    return True


def data_rus(s):
    if s:
        return s
    d = datetime.date.today()
    return '%d %s %d года' % (d.day, MESYACY[d.month - 1], d.year)


def primenit(zashchita, data):
    print('→ собираю и проверяю страницы')
    r = subprocess.run([sys.executable, os.path.join(KAMP, 'sobrat.py')], cwd=ROOT)
    if r.returncode:
        raise SystemExit('  ! sobrat.py упал — ничего не изменено')
    if shutil.which('node'):
        r = subprocess.run(['node', os.path.join(KAMP, 'test', 'test.js')], cwd=KAMP,
                           capture_output=True, text=True)
        print('  ' + (r.stdout.strip().splitlines() or ['?'])[-1].strip())
        if r.returncode:
            raise SystemExit('  ! тест функции упал — ничего не изменено\n' + r.stdout[-2000:])

    print('→ примеряю правки')
    patchi = PATCHI + ([ZASHCHITA] if zashchita else [])
    plan = primerit(patchi)
    kopii = [(src, dst) for src, dst in KOPII if dst != 'docs/pravo/sms.md' or sverit_sms_md()]
    glavnaya = '--bez-glavnoy' not in sys.argv and primerit_glavnuyu()

    if '--primenit' not in sys.argv:
        print('\nПроверка прошла. Применить: python3 Pivot/sms-kampaniya/vstroit.py --primenit')
        return

    metka = datetime.datetime.now().strftime('%Y%m%d-%H%M%S')
    kuda = os.path.join(BYLO, metka)
    os.makedirs(kuda)
    zatronuto = [f for _, f in plan] + [dst for _, dst in kopii] + ([GLAVNAYA] if glavnaya else [])
    for f in zatronuto:
        src = os.path.join(ROOT, f)
        if os.path.exists(src):
            dst = os.path.join(kuda, f)
            os.makedirs(os.path.dirname(dst), exist_ok=True)
            shutil.copy2(src, dst)
    open(os.path.join(kuda, 'SPISOK.txt'), 'w', encoding='utf-8').write('\n'.join(zatronuto) + '\n')
    print('→ копии до правки: %s' % os.path.relpath(kuda, ROOT))

    for patch, fayl in plan:
        r = sh(['patch', '-p0', '-F', '0', '-V', 'none', '--silent', '-i', os.path.join(KAMP, patch)])
        if r.returncode:
            raise SystemExit('  ! %s упал посреди применения: %s\n    Верните: vstroit.py --otkat'
                             % (patch, r.stdout + r.stderr))
        print('  ✓ %s' % fayl)
    for src, dst in kopii:
        shutil.copy2(os.path.join(KAMP, src), os.path.join(ROOT, dst))
        print('  ✓ %s' % dst)
    if glavnaya:
        p = os.path.join(ROOT, GLAVNAYA)
        t = open(p, encoding='utf-8').read()
        for staroe, novoe in GLAVNAYA_PRAVKI:
            t = t.replace(staroe, novoe, 1)
        open(p, 'w', encoding='utf-8').write(t)
        print('  ✓ %s: «Сообщения» / «Messaging» (/sms) в подвале главной' % GLAVNAYA)

    d = data_rus(data)
    for f in ('docs/pravo/sms.md', 'docs/pravo/privacy.md'):
        p = os.path.join(ROOT, f)
        t = open(p, encoding='utf-8').read()
        if '{{DATA_VYKLADKI}}' in t:
            open(p, 'w', encoding='utf-8').write(t.replace('{{DATA_VYKLADKI}}', d))
            print('  ✓ %s: дата «%s»' % (f, d))
    for f in ('docs/pravo/sms.md', 'docs/pravo/privacy.md', 'docs/pravo/contacts.md'):
        if '{{' in open(os.path.join(ROOT, f), encoding='utf-8').read():
            raise SystemExit('  ! в %s осталась заглушка {{…}}' % f)

    print('\nГотово. Дальше — ОБЫЧНАЯ выкладка в окно дня:  ./deploy.sh')
    print('После неё:  python3 Pivot/sms-kampaniya/proverit.py')


def otkat():
    if not os.path.isdir(BYLO) or not os.listdir(BYLO):
        raise SystemExit('  нечего откатывать: %s пуст' % BYLO)
    poslednyaya = sorted(os.listdir(BYLO))[-1]
    kuda = os.path.join(BYLO, poslednyaya)
    spisok = open(os.path.join(kuda, 'SPISOK.txt'), encoding='utf-8').read().split()
    for f in spisok:
        kopiya = os.path.join(kuda, f)
        if os.path.exists(kopiya):
            shutil.copy2(kopiya, os.path.join(ROOT, f))
            print('  ↩ %s' % f)
        elif os.path.exists(os.path.join(ROOT, f)):
            os.remove(os.path.join(ROOT, f))       # файла до правки не было (функция)
            print('  ✕ %s (до правки не было)' % f)
    print('Откат из %s. Живой сайт не тронут — на нём то, что выкатывали последним.' % poslednyaya)


if __name__ == '__main__':
    if '--otkat' in sys.argv:
        otkat()
    else:
        data = None
        if '--data' in sys.argv:
            data = sys.argv[sys.argv.index('--data') + 1]
        primenit('--s-zashchitoy' in sys.argv, data)
