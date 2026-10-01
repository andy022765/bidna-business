/*
 * CareLine: пульт агентства.
 * Данные: /.netlify/functions/pult?k=<ключ> (живой режим) или demo.json рядом со страницей (?demo=1).
 * Формат данных — platforma/docs/API.md (не публикуется: в web/ его нет). Всё из данных вставляется через textContent: без innerHTML.
 */
(function () {
  'use strict';

  // ---------- подписи для владельца (английский) ----------

  var YAZYK = { en: 'English', es: 'Spanish', ru: 'Russian', zh: 'Chinese', ht: 'Haitian Creole' };
  var LINIYA = { 'care-hiring': 'Hiring line', 'care-caregivers': 'Caregiver line' };
  var NAMERENIE = {
    rabota: 'Job applicant', kandidat: 'Job applicant', semya: 'Family asking about care', otkaz: 'Shift call-off',
    smena_seychas: 'Caregiver on a shift now', soobshchenie: 'Message for staff', spam: 'Spam or wrong number', drugoe: 'Other'
  };
  // причины отказа от смены: коды инструмента otkaz_ot_smeny
  var PRICHINA_SMENY = { bolezn: 'illness', semya: 'family reasons', transport: 'transportation', drugoe: 'other reason' };
  var ITOG = {
    zapisan: ['Interview booked', 'ok'],
    ocenka: ['Home assessment booked', 'ok'],
    ne_podhodit: ['Did not qualify', 'neutral'],
    list_ozhidaniya: ['Added to waitlist', 'neutral'],
    perezvon: ['Callback requested', 'warn'],
    otkaz_prinyat: ['Call-off recorded', 'info'],
    soobshchenie: ['Message for staff', 'info'],
    perevod: ['Transferred to staff', 'info'],
    net_soglasiya: ['Declined recorded AI call', 'neutral'],
    sbros: ['Hung up', 'neutral'],
    oshibka: ['Technical error', 'bad']
  };
  var STATUS_KAND = {
    'new': ['New', 'info'],
    booked: ['Booked', 'info'],
    reminded: ['Reminded', 'info'],
    attended: ['Attended', 'ok'],
    no_show: ['No-show', 'warn'],
    rejected: ['Did not qualify', 'neutral'],
    waitlist: ['Waitlist', 'neutral']
  };
  var SERT = { hha: 'HHA', pca: 'PCA', cna: 'CNA', net: 'None' };
  var PRICHINA = {
    net_sertifikata: 'No HHA or PCA certificate',
    tolko_cna: 'CNA only; HHA or PCA required',
    vne_rayona: 'Lives outside the service area',
    grafik: 'Availability does not match open shifts',
    net_transporta: 'No way to reach clients',
    pravo_na_rabotu: 'Not authorized to work in the US',
    opyt: 'Less experience than required',
    yazyk: 'Language requirement not met',
    drugoe: 'Other reason'
  };
  // подписи правил EVV; движок lib/care/evv.js сам шлёт pravilo_tekst, словарь — запасной
  var PRAVILO = {
    NET_USLUGI: 'Missing service type', NET_POLUCHATELYA: 'Missing member', NET_DATY: 'Missing date of service',
    NET_MESTA: 'Missing location', NET_ISPOLNITELYA: 'Missing caregiver', NET_PRIHODA: 'No clock-in', NET_UHODA: 'No clock-out',
    UHOD_RANSHE_PRIHODA: 'Clock-out before clock-in', PRAVKA_BEZ_PRICHINY: 'Manual edit without reason',
    MESTO_NE_SOVPADAET: 'Location does not match', EDINICY_BOLSHE_VREMENI: 'Billed units exceed EVV time',
    PREVYSHENIE_AVTORIZACII: 'Over authorized units', KOD_NE_AVTORIZOVAN: 'Service not authorized',
    VNE_DAT_AVTORIZACII: 'Outside authorization dates', PERESECHENIE: 'Overlapping visits',
    VNE_RASPISANIYA: 'Visit not on the schedule', NE_TA_SIDELKA: 'Different caregiver than scheduled',
    net_otmetki_prihoda: 'No clock-in',
    net_otmetki_uhoda: 'No clock-out',
    mesto: 'Location does not match',
    dlitelnost: 'More hours than authorized',
    peresechenie: 'Overlapping visits',
    avtorizaciya_daty: 'Outside authorization dates',
    avtorizaciya_kod: 'Service not on authorization',
    ruchnaya_otmetka: 'Manual entry without reason',
    net_polya: 'Missing EVV field',
    korotkiy_vizit: 'Shorter than scheduled'
  };
  var VAZH = { krit: ['Fix before billing', 'bad'], pred: ['Review', 'warn'], info: ['Note', 'info'] };
  var OTKAZ = {
    zakryta: ['Filled', 'ok'],
    eskalaciya: ['Escalated to on-call', 'warn'],
    ne_zakryta: ['Not filled', 'bad'],
    v_rabote: ['Offers out', 'info']
  };
  // обращения семей (semi): коды инструмента sohranit_semyu
  var OPLATA = { 'private': 'Private pay', medicaid: 'Medicaid', ltc: 'Long-term care insurance', unknown: 'Not decided yet' };
  var SROCHNOST = {
    srochno: ['Within a few days', 'warn'], nedelya: ['Within 1 to 2 weeks', 'info'],
    pozzhe: ['Later', 'neutral'], ne_znayu: ['Not decided', 'neutral']
  };
  // журнал действий (zhurnal): кто и что — коды lib/zhurnal.js и функций стенда
  var KTO = {
    agent: 'AI assistant', itog: 'Call summary', vhod: 'Phone line', sms: 'Texts', zamena: 'Replacement',
    dezhurnyy: 'On-call', svodka: 'Morning summary', pult: 'Dashboard', napominaniya: 'Reminders', sistema: 'System',
    chistka: 'Data retention'
  };
  var GRUPPY = [['zvonki', 'Calls'], ['naym', 'Applicants and families'], ['otkazy', 'Call-offs'],
    ['svyaz', 'Texts and emails'], ['soglasiya', 'Consent'], ['prochee', 'Other']];
  // chto → [подпись, группа, тон (только для необычного)]
  var ZH = {
    zvonok_vhod: ['Incoming call', 'zvonki'],
    zvonok_predel: ['Daily call limit reached', 'zvonki', 'bad'],
    zvonok_itog: ['Call summary saved', 'zvonki'],
    perevod: ['Transferred to staff', 'zvonki'],
    perevod_vne_chasov: ['Transfer asked after hours', 'zvonki', 'warn'],
    perevod_nekomu: ['No staff number for transfers', 'zvonki', 'bad'],
    perevod_dry_run: ['Test mode: transfer not placed', 'zvonki', 'info'],
    kandidat_novyy: ['New applicant card', 'naym'],
    kandidat_obnovlen: ['Applicant card updated', 'naym'],
    kandidat_bez_imeni: ['Card not saved: name missing', 'naym', 'warn'],
    kandidat_bez_otbora: ['Card not saved: screening not done', 'naym', 'warn'],
    semya_novaya: ['New family inquiry', 'naym'],
    semya_obnovlena: ['Family inquiry updated', 'naym'],
    semya_bez_imeni: ['Family inquiry not saved: name missing', 'naym', 'warn'],
    zapis: ['Booked', 'naym'],
    zapis_perenesena: ['Booking moved', 'naym'],
    zapis_povtor: ['Same booking asked again', 'naym'],
    zapis_zanyato: ['Time was just taken', 'naym', 'warn'],
    zapis_net_v_raspisanii: ['Time no longer free', 'naym', 'warn'],
    zapis_net_kalendarya: ['Calendar not connected', 'naym', 'bad'],
    okna_net_kalendarya: ['Calendar not connected', 'naym', 'bad'],
    zapis_oshibka_kalendarya: ['Calendar error, nothing booked', 'naym', 'bad'],
    zapis_konflikt_otkat: ['Double booking prevented', 'naym', 'warn'],
    napominanie: ['Reminder sent', 'naym'],
    napominanie_net: ['Reminder not sent', 'naym', 'warn'],
    otkaz_ot_smeny: ['Call-off recorded', 'otkazy'],
    otkaz_bez_prichiny: ['Call-off waiting for a reason', 'otkazy', 'info'],
    otkaz_neizvestnyy_nomer: ['Call-off from an unknown number', 'otkazy', 'warn'],
    otkaz_sms_neodnoznachno: ['Unclear call-off text', 'otkazy', 'warn'],
    volna_pervaya: ['Shift offered', 'otkazy'],
    volna_sleduyushchaya: ['Shift offered to more caregivers', 'otkazy'],
    otvet_da: ['Caregiver replied yes', 'otkazy'],
    otvet_net: ['Caregiver replied no', 'otkazy'],
    smena_zakreplena: ['Shift filled', 'otkazy', 'ok'],
    smena_ne_zakryta: ['Shift not filled', 'otkazy', 'bad'],
    podbor_oshibka: ['Replacement search failed', 'otkazy', 'bad'],
    eskalaciya_zvonok: ['On-call coordinator called', 'otkazy', 'warn'],
    eskalaciya_prinyata: ['On-call coordinator took over', 'otkazy'],
    eskalaciya_nekogo_budit: ['No on-call number set', 'otkazy', 'bad'],
    eskalaciya_cepochka_konchilas: ['Nobody on call answered', 'otkazy', 'bad'],
    sms_vhod: ['Text received', 'svyaz'],
    sms_neizvestno: ['Text not understood', 'svyaz', 'warn'],
    sms_otpravleno: ['Text sent', 'svyaz'],
    sms_dry_run: ['Test mode: text not sent', 'svyaz', 'info'],
    sms_blok_otpiska: ['Text held: opted out', 'svyaz', 'neutral'],
    sms_blok_net_soglasiya: ['Text held: no consent', 'svyaz', 'neutral'],
    sms_potolok: ['Daily text limit reached', 'svyaz', 'bad'],
    sms_oshibka: ['Text failed', 'svyaz', 'bad'],
    sms_ne_nastroeno: ['Texting not set up', 'svyaz', 'bad'],
    pismo_otpravleno: ['Email sent', 'svyaz'],
    pismo_dry_run: ['Test mode: email not sent', 'svyaz', 'info'],
    pismo_dubl_propushcheno: ['Duplicate email skipped', 'svyaz', 'neutral'],
    pismo_potolok: ['Daily email limit reached', 'svyaz', 'bad'],
    pismo_oshibka: ['Email failed', 'svyaz', 'bad'],
    pismo_ne_nastroeno: ['Email not set up', 'svyaz', 'bad'],
    zvonok_nachat: ['Call placed', 'svyaz'],
    zvonok_dry_run: ['Test mode: call not placed', 'svyaz', 'info'],
    zvonok_oshibka: ['Call failed', 'svyaz', 'bad'],
    zvonok_potolok: ['Daily outgoing call limit reached', 'svyaz', 'bad'],
    soglasie: ['Consent updated', 'soglasiya'],
    evv_progon: ['EVV check run', 'prochee'],
    svodka: ['Morning summary sent', 'prochee'],
    svodka_nekomu: ['Morning summary built, no recipients', 'prochee', 'warn'],
    chistka: ['Old call records removed', 'prochee', 'neutral']
  };
  var ESKALACIYA = {
    malo_vremeni: 'less than two hours before the shift', nikto_ne_otvetil: 'nobody said yes', vse_otkazali: 'everyone said no',
    net_kandidatov: 'no available caregivers', smena_nachalas: 'the shift started', net_smeny: 'shift not found',
    net_dannyh: 'data problem', oshibka_dvizhka: 'replacement search error'
  };
  var OTVET_DA = {
    zakreplena: 'got the shift', uzhe_vasha: 'was already confirmed', zanyato: 'was told the shift is taken',
    pozdno: 'replied too late', peredumala: 'changed her mind', ne_podhodit: 'does not fit this shift',
    ne_predlagalos: 'had no offer for this shift', ne_ponyal: 'reply not understood', kakaya_smena: 'asked which shift'
  };

  // ---------- DOM ----------

  function $(id) { return document.getElementById(id); }

  function h(tag, attrs) {
    var el = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        var v = attrs[k];
        if (v === null || v === undefined || v === false) return;
        if (k === 'class') el.className = v;
        else if (k === 'text') el.textContent = v;
        else if (k.indexOf('on') === 0) el.addEventListener(k.slice(2), v);
        else el.setAttribute(k, v === true ? '' : String(v));
      });
    }
    for (var i = 2; i < arguments.length; i += 1) dobavit(el, arguments[i]);
    return el;
  }
  function dobavit(el, c) {
    if (c === null || c === undefined || c === false) return;
    if (Array.isArray(c)) { c.forEach(function (x) { dobavit(el, x); }); return; }
    el.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  function zamenit(el) {
    var deti = Array.prototype.slice.call(arguments, 1);
    while (el.firstChild) el.removeChild(el.firstChild);
    deti.forEach(function (c) { dobavit(el, c); });
  }
  function st(ton, tekst, dop) { return h('span', { class: 'st st--' + ton + (dop ? ' ' + dop : '') }, tekst); }
  function pusto(tekst) { return h('p', { class: 'empty' }, tekst); }

  // ---------- числа и время ----------

  function n0(x) { var n = Number(x); return isFinite(n) ? n : 0; }
  function pl(n, odno, mnogo) { return n === 1 ? odno : mnogo; }
  function chislo(n, odno, mnogo) { return n + ' ' + pl(n, odno, mnogo); }
  function spisok(a) {
    a = a.filter(Boolean);
    if (a.length <= 1) return a.join('');
    if (a.length === 2) return a[0] + ' and ' + a[1];
    return a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1];
  }
  function procent(a, b) { return b ? Math.round((a / b) * 100) + '%' : '0%'; }
  function dlit(sek) {
    sek = Math.max(0, Math.round(n0(sek)));
    return Math.floor(sek / 60) + ':' + String(sek % 60).padStart(2, '0');
  }
  function chasy(sek) {
    var m = Math.round(n0(sek) / 60);
    if (m < 60) return m + ' min';
    return Math.floor(m / 60) + ' h ' + (m % 60) + ' min';
  }
  function telefon(t) {
    var m = /^\+1(\d{3})(\d{3})(\d{4})$/.exec(t || '');
    return m ? '(' + m[1] + ') ' + m[2] + '-' + m[3] : (t || '');
  }
  function yazyk(k) { return YAZYK[k] || (k ? String(k).toUpperCase() : ''); }
  // стенд хранит HHA/PCA/CNA/net, демо — строчными: подпись без учёта регистра
  function sertPodpis(s) { return s ? (SERT[String(s).toLowerCase()] || String(s)) : ''; }
  // фраза с одной точкой в конце: имена вида «Olga S.» не дают «..»
  function fraza(s) {
    s = String(s || '').replace(/\s+/g, ' ').trim();
    if (!s) return '';
    s = s.charAt(0).toUpperCase() + s.slice(1);
    return /[.!?…]["”»']?$/.test(s) ? s : s + '.';
  }
  function obrezat(s, n) { s = String(s || ''); return s.length > n ? s.slice(0, n - 1).trim() + '…' : s; }
  function vazhnost(v) {
    var s = String(v || '').toLowerCase();
    if (['kritichno', 'critical', 'high', 'vysokaya', 'blokiruet'].indexOf(s) >= 0) return 'krit';
    if (['preduprezhdenie', 'warning', 'medium', 'srednyaya', 'vazhno'].indexOf(s) >= 0) return 'pred';
    return 'info';
  }
  function podpisKoda(kod, karta) {
    if (!kod) return '';
    return karta[kod] || String(kod).replace(/_/g, ' ').replace(/^./, function (c) { return c.toUpperCase(); });
  }

  var F = null; // форматы времени в поясе агентства
  var SEG = null;
  var VCH = null;
  var ZAV = null;
  var SPRAVKA = null; // имена по id и телефону — для журнала действий

  function formaty(poyas) {
    function mk(o) { o.timeZone = poyas; return new Intl.DateTimeFormat('en-US', o); }
    var fV = mk({ hour: 'numeric', minute: '2-digit' });
    var fD = mk({ weekday: 'short', month: 'short', day: 'numeric' });
    var fDL = mk({ weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    var fY = mk({ year: 'numeric', month: '2-digit', day: '2-digit' });
    var fZ = mk({ timeZoneName: 'short' });
    function ok(iso) { return !!iso && !isNaN(new Date(iso)); }
    return {
      ok: ok,
      ymd: function (iso) {
        if (!ok(iso)) return '';
        var p = {};
        fY.formatToParts(new Date(iso)).forEach(function (x) { p[x.type] = x.value; });
        return p.year + '-' + p.month + '-' + p.day;
      },
      vremya: function (iso) { return ok(iso) ? fV.format(new Date(iso)) : ''; },
      den: function (iso) { return ok(iso) ? fD.format(new Date(iso)) : ''; },
      denDlinno: function (iso) { return ok(iso) ? fDL.format(new Date(iso)) : ''; },
      zona: function (iso) {
        if (!ok(iso)) return '';
        var z = fZ.formatToParts(new Date(iso)).filter(function (x) { return x.type === 'timeZoneName'; })[0];
        return z ? z.value : '';
      },
      ymdDen: function (s) {
        var p = String(s || '').split('-').map(Number);
        if (p.length !== 3) return s || '';
        return new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric' })
          .format(new Date(Date.UTC(p[0], p[1] - 1, p[2], 12)));
      },
      ymdDlinno: function (s) {
        var p = String(s || '').split('-').map(Number);
        if (p.length !== 3) return s || '';
        return new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', weekday: 'long', month: 'long', day: 'numeric' })
          .format(new Date(Date.UTC(p[0], p[1] - 1, p[2], 12)));
      }
    };
  }
  function sdvigDaty(ymd, n) {
    var p = ymd.split('-').map(Number);
    return new Date(Date.UTC(p[0], p[1] - 1, p[2] + n)).toISOString().slice(0, 10);
  }
  /** «Today, 5:02 AM» / «Yesterday, 3:52 PM» / «Mon, Sep 28, 6:50 AM». */
  function kogda(iso) {
    if (!F.ok(iso)) return '';
    var d = F.ymd(iso);
    var den = d === SEG ? 'Today' : d === VCH ? 'Yesterday' : d === ZAV ? 'Tomorrow' : F.den(iso);
    return den + ', ' + F.vremya(iso);
  }
  /** В середине фразы: «today at 5:02 AM» / «on Mon, Sep 28 at 6:50 AM». */
  function kogdaVTekste(iso) {
    if (!F.ok(iso)) return '';
    var d = F.ymd(iso);
    var den = d === SEG ? 'today' : d === VCH ? 'yesterday' : d === ZAV ? 'tomorrow' : 'on ' + F.den(iso);
    return den + ' at ' + F.vremya(iso);
  }
  function smena(sm) {
    if (!sm || !F.ok(sm.start)) return 'Shift time not found';
    var d = F.ymd(sm.start);
    var den = d === SEG ? 'Today' : d === VCH ? 'Yesterday' : d === ZAV ? 'Tomorrow' : F.den(sm.start);
    return den + ', ' + F.vremya(sm.start) + (F.ok(sm.end) ? ' to ' + F.vremya(sm.end) : '');
  }
  function gdeSmena(sm) {
    if (!sm) return '';
    return ['Client ' + (sm.klient_kod || 'not set'), sm.rayon || (sm.zip ? 'ZIP ' + sm.zip : null)].filter(Boolean).join(', ');
  }

  // ---------- состояние страницы ----------

  // Ключ пульта берём из адреса один раз: дальше он живёт в sessionStorage вкладки, а из адреса убирается
  // (проверка 30.09: ключ оставался в адресной строке, истории и закладках). docs/API.md, «Ключ не остаётся в адресе».
  var MESTO_KLYUCHA = 'careline-pult-k';
  function sessiya(fn) {
    try { return fn(window.sessionStorage); } catch (e) { return null; }   // приватное окно или запрет хранилища
  }
  var params = new URLSearchParams(location.search);
  var kIzAdresa = (params.get('k') || '').trim();
  var DEMO = !kIzAdresa && params.get('demo') === '1';
  if (kIzAdresa) {
    sessiya(function (s) { s.setItem(MESTO_KLYUCHA, kIzAdresa); });
    params.delete('k');
    try {
      var ostatok = params.toString();
      history.replaceState(history.state, '', location.pathname + (ostatok ? '?' + ostatok : '') + location.hash);
    } catch (e) { /* страница из файла или старый браузер: адрес остаётся как был, пульт работает */ }
  }
  var KLYUCH = kIzAdresa || (DEMO ? '' : String(sessiya(function (s) { return s.getItem(MESTO_KLYUCHA); }) || '').trim());
  function zabytKlyuch() { sessiya(function (s) { s.removeItem(MESTO_KLYUCHA); }); }
  var D = null;
  var filtr = { otkazy: 'all', evv: 'all', zvonki: 'all', semi: 'all', zhurnal: 'all' };
  var vse = { kandidaty: false, zvonki: false, soglasiya: false, sobesedovaniya: false, semi: false, zhurnal: false };
  var poisk = '';
  var avto = null;

  // ---------- тема ----------

  var knopkaTemy = $('theme');
  function tekushchayaTema() {
    var a = document.documentElement.getAttribute('data-theme');
    if (a === 'light' || a === 'dark') return a;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  function pokazatTemu() {
    var t = tekushchayaTema();
    knopkaTemy.textContent = t === 'dark' ? 'Light theme' : 'Dark theme';
    knopkaTemy.setAttribute('aria-pressed', t === 'dark' ? 'true' : 'false');
  }
  knopkaTemy.addEventListener('click', function () {
    var t = tekushchayaTema() === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', t);
    try { localStorage.setItem('careline-theme', t); } catch (e) { /* приватное окно: тема живёт до перезагрузки */ }
    pokazatTemu();
  });
  if (window.matchMedia) {
    var mq = window.matchMedia('(prefers-color-scheme: dark)');
    if (mq.addEventListener) mq.addEventListener('change', pokazatTemu);
  }
  pokazatTemu();

  // ---------- загрузка ----------

  function Oshibka(vid, soobshchenie) { this.vid = vid; this.soobshchenie = soobshchenie || ''; }

  function zagruzit(tiho) {
    if (!tiho) pokazatZagruzku();
    var zapros;
    if (KLYUCH) {
      zapros = fetch('/.netlify/functions/pult?k=' + encodeURIComponent(KLYUCH), {
        headers: { accept: 'application/json' }, cache: 'no-store', credentials: 'same-origin', referrerPolicy: 'no-referrer'
      }).then(function (r) {
        if (r.status === 401 || r.status === 403) { zabytKlyuch(); throw new Oshibka('klyuch'); }
        return r.json().catch(function () { throw new Oshibka('server', 'HTTP ' + r.status); }).then(function (d) {
          if (!r.ok || !d || d.ok === false) {
            if (d && d.oshibka === 'klyuch') zabytKlyuch();
            throw new Oshibka(d && d.oshibka === 'klyuch' ? 'klyuch' : 'server', (d && d.soobshchenie) || ('HTTP ' + r.status));
          }
          return d;
        });
      });
    } else if (DEMO) {
      zapros = fetch('demo.json', { cache: 'no-store' }).then(function (r) {
        if (!r.ok) throw new Oshibka('demo', 'HTTP ' + r.status);
        return r.json();
      });
    } else {
      pokazatBezKlyucha();
      return Promise.resolve();
    }
    return zapros.then(function (d) {
      if (d.versiya !== 1 && window.console) console.warn('CareLine: data version ' + d.versiya + ', this page expects 1');
      D = d;
      narisovat();
    }).catch(function (e) {
      if (tiho && D) { $('updated').textContent = 'Could not refresh. Showing earlier data.'; return; }
      pokazatOshibku(e instanceof Oshibka ? e : new Oshibka(location.protocol === 'file:' ? 'fayl' : 'set', e && e.message));
    });
  }

  function pokazatZagruzku() {
    $('state').hidden = false;
    $('content').hidden = true;
  }

  function panelSostoyaniya(zagolovok, abzacy, knopka) {
    var st8 = $('state');
    zamenit(st8, h('div', { class: 'state-panel' },
      h('h2', null, zagolovok),
      abzacy.map(function (a) { return h('p', null, a); }),
      knopka || null));
    st8.hidden = false;
    $('content').hidden = true;
    $('nav').hidden = true;
  }

  function pokazatBezKlyucha() {
    $('agency').textContent = 'Dashboard';
    panelSostoyaniya('Open your dashboard link', [
      'This dashboard opens from the private link your agency received. The link ends with a key, like /pult/?k=…',
      h('span', null, 'To look around first, ', h('a', { href: '?demo=1' }, 'open the demo dashboard'), '. It uses fictional data.')
    ]);
  }

  function pokazatOshibku(e) {
    var povtor = h('button', { class: 'btn btn--primary', type: 'button', onclick: function () { zagruzit(); } }, 'Try again');
    if (e.vid === 'klyuch') {
      panelSostoyaniya('This link does not open a dashboard', [
        'The key in the link is not valid or was replaced. Ask your CareLine contact for a new link.'
      ]);
    } else if (e.vid === 'fayl') {
      panelSostoyaniya('Open this page through a web server', [
        'Browsers do not let a page opened from a file read its data. Serve the web folder over http and open /pult/?demo=1.'
      ]);
    } else if (e.vid === 'demo') {
      panelSostoyaniya('Demo data did not load', ['The demo data file is missing next to this page (' + e.soobshchenie + ').'], povtor);
    } else {
      panelSostoyaniya('Could not load the dashboard', [
        'Check your connection and try again. If it keeps failing, write to your CareLine contact.',
        e.soobshchenie ? 'Details: ' + e.soobshchenie : ''
      ].filter(Boolean), povtor);
    }
  }

  // ---------- отрисовка ----------

  function narisovat() {
    var poyas = (D.klient && D.klient.poyas) || 'America/New_York';
    F = formaty(poyas);
    SEG = (D.segodnya && D.segodnya.data) || F.ymd(D.sformirovano || new Date().toISOString());
    VCH = (D.vchera && D.vchera.data) || sdvigDaty(SEG, -1);
    ZAV = sdvigDaty(SEG, 1);

    SPRAVKA = spravochnik();
    shapka();
    segodnya();
    naym();
    semi();
    otkazy();
    evv();
    soglasiya();
    zvonki();
    zhurnal();

    $('state').hidden = true;
    $('content').hidden = false;
    $('nav').hidden = false;
    podsvetkaRazdelov();
  }

  function shapka() {
    var k = D.klient || {};
    var demo = !!D.demo || DEMO;
    // Пульт стенда по ключу у демо-клиента: кроме вымышленных записей там проверочные звонки на демо-линию
    // с настоящих номеров — «всё вымышлено» было бы неправдой (проверка 30.09, index.html:54).
    var stend = demo && !DEMO;
    $('agency').textContent = k.nazvanie || 'Your agency';
    document.title = (k.nazvanie ? k.nazvanie + ': ' : '') + 'CareLine dashboard';
    $('demo-tag').hidden = !demo;
    $('demo-bar').hidden = !demo;
    var plashka = $('demo-bar').querySelector('.wrap');
    if (plashka && stend) plashka.textContent = 'Demo stand. Records come from fictional demo data and from test calls to the demo line.';
    var kogdaSnyato = D.sformirovano ? F.denDlinno(D.sformirovano) + ', ' + F.vremya(D.sformirovano) + ' ' + F.zona(D.sformirovano) : '';
    $('updated').textContent = DEMO ? 'Demo snapshot: ' + kogdaSnyato : 'Updated ' + (D.sformirovano ? F.vremya(D.sformirovano) + ' ' + F.zona(D.sformirovano) : '');
    $('refresh').hidden = false;
    $('foot-tz').textContent = 'Times are shown in the agency’s time zone (' + ((D.klient && D.klient.poyas) || 'America/New_York') + ').'
      + (stend ? ' Demo stand: fictional demo data plus test calls to the demo line.' : demo ? ' Demo data: all names and phone numbers are fictional.' : '');
  }

  // --- сегодня

  function yazykiStroka(po) {
    var e = Object.keys(po || {}).map(function (k) { return [k, po[k]]; }).sort(function (a, b) { return b[1] - a[1]; });
    return e.map(function (x) { return yazyk(x[0]) + ' ' + x[1]; }).join(', ');
  }

  function kpi(podpis, chisloV, stroka, sravnenie) {
    return h('div', { class: 'kpi' },
      h('p', { class: 'kpi__label' }, podpis),
      h('p', { class: 'kpi__num' }, String(chisloV)),
      h('p', { class: 'kpi__line' }, stroka),
      h('p', { class: 'kpi__cmp' }, sravnenie));
  }

  function krit(posl) {
    return posl ? (posl.isklyucheniya || []).filter(function (x) { return vazhnost(x.vazhnost) === 'krit'; }).length : 0;
  }

  function segodnya() {
    var s = D.segodnya || {};
    var v = D.vchera || {};
    var sz = s.zvonki || {};
    var sk = s.kandidaty || {};
    var ss = s.sobesedovaniya || {};
    var so = s.otkazy || {};
    var posl = D.evv && D.evv.posledniy;

    $('today-sub').textContent = F.ymdDlinno(SEG) + (D.sformirovano ? ', as of ' + F.vremya(D.sformirovano) : '');

    // что требует внимания
    var punkty = [];
    (D.otkazy || []).forEach(function (o) {
      if (o.status === 'eskalaciya' || o.status === 'v_rabote') {
        punkty.push({
          ton: o.status === 'eskalaciya' ? 'warn' : 'info',
          metka: o.status === 'eskalaciya' ? 'Open shift' : 'Offers out',
          tekst: smena(o.smena) + ', ' + gdeSmena(o.smena) + '. ' + ((o.sidelka && o.sidelka.imya) || 'A caregiver') + ' called off ' + kogdaVTekste(o.soobshcheno) + '.' +
            (o.eskalaciya_v ? ' The on-call coordinator was called ' + kogdaVTekste(o.eskalaciya_v) + '.' : ' Waiting for replies.'),
          ssylka: '#calloffs', ssylkaTekst: 'See call-offs'
        });
      }
    });
    (D.otkazy || []).forEach(function (o) {
      if (o.status === 'ne_zakryta' && F.ymd(o.soobshcheno) >= VCH) {
        punkty.push({
          ton: 'bad', metka: 'Unfilled',
          tekst: smena(o.smena) + ', ' + gdeSmena(o.smena) + '. Nobody covered this shift.',
          ssylka: '#calloffs', ssylkaTekst: 'See call-offs'
        });
      }
    });
    var k = krit(posl);
    if (k) {
      punkty.push({
        ton: 'bad', metka: 'EVV',
        tekst: chislo(k, 'issue', 'issues') + ' to fix before billing, from the check of ' + kogdaVTekste(posl.zagruzheno) + '.',
        ssylka: '#evv', ssylkaTekst: 'See EVV'
      });
    }
    var zhdut = (D.kandidaty || []).filter(function (x) {
      return x.status === 'new' && x.podhodit === true && !x.sobesedovanie && F.ymd(x.created_at) >= VCH;
    });
    if (zhdut.length) {
      punkty.push({
        ton: 'warn', metka: 'Callback',
        tekst: spisok(zhdut.map(function (x) { return x.imya || 'An applicant'; })) + ' met your requirements and ' + pl(zhdut.length, 'is', 'are') + ' waiting for a callback.',
        ssylka: '#hiring', ssylkaTekst: 'See applicants'
      });
    }
    // семья просит начать в ближайшие дни, а оценка не назначена
    (Array.isArray(D.semi) ? D.semi : []).forEach(function (s) {
      if (!zhdetZvonka(s) || s.srochnost !== 'srochno' || F.ymd(s.created_at) < VCH) return;
      var kto = (s.kontakt && s.kontakt.imya) || 'A family';
      punkty.push({
        ton: 'warn', metka: 'Family',
        tekst: fraza(kto + ' called ' + kogdaVTekste(s.created_at) + ' about care' + (s.rayon ? ' in ' + s.rayon : '') +
          ', needed within a few days') + ' No home assessment is booked yet.',
        ssylka: '#families', ssylkaTekst: 'See families'
      });
    });
    // сбои за сегодня в журнале: письмо или SMS не ушли, календарь не подключён (отказы — своими пунктами выше)
    var sboi = (Array.isArray(D.zhurnal) ? D.zhurnal : []).filter(function (z) { var x = ZH[z.chto]; return x && x[2] === 'bad' && x[1] !== 'otkazy'; });
    if (sboi.length) {
      var vidy = [];
      sboi.forEach(function (z) { var p = ZH[z.chto][0]; if (vidy.indexOf(p) < 0) vidy.push(p); });
      punkty.push({
        ton: 'bad', metka: 'Problems',
        tekst: chislo(sboi.length, 'problem', 'problems') + ' in today’s activity: ' + spisok(vidy.slice(0, 3).map(function (v) { return v.toLowerCase(); })) + '.',
        ssylka: '#activity', ssylkaTekst: 'See activity'
      });
    }
    var att = $('attention');
    att.className = 'attention' + (punkty.length ? '' : ' attention--calm');
    zamenit(att, punkty.length
      ? h('ul', { class: 'attention__list', 'aria-label': 'Needs attention' }, punkty.map(function (p) {
        return h('li', { class: 'attention__item' }, st(p.ton, p.metka), h('p', null, p.tekst), h('a', { href: p.ssylka }, p.ssylkaTekst));
      }))
      : h('ul', { class: 'attention__list' }, h('li', { class: 'attention__item' }, st('ok', 'All clear'), h('p', null, 'Nothing needs attention right now.'))));

    var otkChasti = [
      n0(so.zakryto) ? n0(so.zakryto) + ' filled' : null,
      n0(so.eskalaciya) ? n0(so.eskalaciya) + ' escalated' : null,
      n0(so.ne_zakryto) ? n0(so.ne_zakryto) + ' not filled' : null,
      n0(so.v_rabote) ? n0(so.v_rabote) + ' offers out' : null
    ].filter(Boolean);

    zamenit($('kpis'),
      kpi('Calls', n0(sz.vsego), n0(sz.vsego) ? yazykiStroka(sz.po_yazykam) : 'No calls yet today', 'Yesterday: ' + n0((v.zvonki || {}).vsego)),
      kpi('New applicants', n0(sk.novyh), n0(sk.novyh) ? n0(sk.podhodyat) + ' met requirements, ' + n0(sk.ne_podhodyat) + ' did not' : 'None yet today', 'Yesterday: ' + n0((v.kandidaty || {}).novyh)),
      kpi('Interviews booked', n0(ss.zapisano), n0(ss.naznacheno) ? 'On today’s calendar: ' + n0(ss.naznacheno) + '. Attended ' + n0(ss.prishli) + ', no-show ' + n0(ss.ne_prishli) + '.' : 'None on today’s calendar', 'Yesterday: ' + n0((v.sobesedovaniya || {}).zapisano)),
      kpi('Call-offs', n0(so.vsego), otkChasti.length ? otkChasti.join(', ') : 'None today', 'Yesterday: ' + n0((v.otkazy || {}).vsego)),
      kpi('EVV issues open', posl ? (posl.isklyucheniya || []).length : 0, posl ? k + ' to fix before billing' : 'No checks yet', posl ? 'Last check: ' + kogda(posl.zagruzheno) : 'Upload a visit export')
    );
  }

  // --- найм

  function naym() {
    var vf = D.voronka || {};
    $('hiring-sub').textContent = vf.s ? 'Last ' + (vf.dney || 30) + ' days, ' + F.ymdDen(vf.s) + ' to ' + F.ymdDen(vf.po) : '';
    var et = {};
    (vf.etapy || []).forEach(function (e) { et[e.kod] = n0(e.n); });
    var nov = et['new'] || 0;
    var zap = et.booked || 0;
    var pri = et.attended || 0;
    var s = vf.statusy || {};

    if (!nov) {
      zamenit($('funnel'), pusto('No applicants in this period yet. Applicants appear here after their first call.'));
    } else {
      var stroka = function (podpis, n, dolya, pod) {
        return h('li', null,
          h('div', { class: 'bar__top' }, h('span', { class: 'bar__label' }, podpis), h('span', { class: 'bar__num' }, String(n), pod ? h('small', null, pod) : null)),
          h('div', { class: 'bar__fill', style: 'width:' + Math.max(1, Math.round(dolya * 100)) + '%', 'aria-hidden': 'true' }));
      };
      zamenit($('funnel'),
        h('ol', { class: 'bars', 'aria-label': 'Hiring funnel' },
          stroka('New applicants', nov, 1, null),
          stroka('Booked an interview', zap, zap / nov, procent(zap, nov) + ' of new'),
          stroka('Attended the interview', pri, pri / nov, procent(pri, zap) + ' of booked')),
        h('p', { class: 'funnel__note' },
          'Waiting for their interview: ' + (n0(s.booked) + n0(s.reminded)) + '. No-shows: ' + n0(s.no_show) +
          '. Waitlist: ' + n0(s.waitlist) + '. Met requirements, waiting for a callback: ' + n0(s['new']) + '.'));
    }

    var pr = vf.otkazy_po_prichinam || [];
    var maks = pr.reduce(function (m, p) { return Math.max(m, n0(p.n)); }, 0);
    zamenit($('reasons'), pr.length
      ? h('ol', { class: 'bars bars--reasons', 'aria-label': 'Reasons applicants did not qualify' }, pr.map(function (p) {
        return h('li', null,
          h('div', { class: 'bar__top' }, h('span', { class: 'bar__label' }, p.tekst || podpisKoda(p.kod, PRICHINA)), h('span', { class: 'bar__num' }, String(n0(p.n)))),
          h('div', { class: 'bar__fill', style: 'width:' + Math.max(1, Math.round((n0(p.n) / (maks || 1)) * 100)) + '%', 'aria-hidden': 'true' }));
      }))
      : pusto('Nobody was turned away in this period.'));

    // собеседования
    var sob = D.sobesedovaniya || [];
    zamenit($('interviews'), sob.length
      ? tablica('Upcoming interviews', ['When', 'Applicant', 'Language', 'Certificate', 'Status'], (vse.sobesedovaniya ? sob : sob.slice(0, 8)).map(function (x) {
        var s8 = STATUS_KAND[x.status] || [podpisKoda(x.status, {}), 'info'];
        return [
          { v: kogda(x.start), cls: 'nowrap strong' },
          x.imya || 'Name not given',
          yazyk(x.yazyk),
          sertPodpis(x.sertifikat),
          st(s8[1], s8[0])
        ];
      }))
      : pusto('No interviews on the calendar.'), knopkaVse('sobesedovaniya', sob.length, 8, naym));

    // кандидаты
    var ka = D.kandidaty || [];
    var pokaz = vse.kandidaty ? ka : ka.slice(0, 12);
    var tab = ka.length ? tablica('Recent applicants', ['Came in', 'Applicant', 'Language', 'Certificate', 'Area', 'Result', 'Source'], pokaz.map(function (x) {
      var rez;
      if (x.podhodit === false) {
        var s9 = STATUS_KAND[x.status] || STATUS_KAND.rejected;
        rez = h('span', null, st(s9[1], s9[0]), ' ', h('span', { class: 'muted' }, podpisKoda(x.prichina_otkaza, PRICHINA)));
      } else if (x.sobesedovanie && x.sobesedovanie.start) {
        var s10 = STATUS_KAND[x.status] || STATUS_KAND.booked;
        rez = h('span', null, st(s10[1], s10[0]), ' ', h('span', { class: 'muted' }, 'Interview ' + kogda(x.sobesedovanie.start)));
      } else {
        rez = st('warn', 'Waiting for callback');
      }
      return [
        { v: kogda(x.created_at), cls: 'nowrap' },
        { v: x.imya || 'Name not given', cls: 'strong' },
        yazyk(x.yazyk),
        sertPodpis(x.sertifikat),
        [x.rayon, x.zip].filter(Boolean).join(', '),
        { v: rez, cls: 'wide' },
        x.istochnik === 'sms' ? 'Text' : 'Call'
      ];
    })) : pusto('No applicants in the last two weeks.');
    zamenit($('applicants'), tab, knopkaVse('kandidaty', ka.length, 12, naym));
  }

  // --- отказы от смен

  function otkazy() {
    var ot = D.otkazy || [];
    $('calloffs-sub').textContent = 'Last 7 days';
    var po = { zakryta: 0, eskalaciya: 0, ne_zakryta: 0, v_rabote: 0 };
    var minuty = [];
    ot.forEach(function (o) {
      po[o.status] = (po[o.status] || 0) + 1;
      if (o.status === 'zakryta' && o.zakryta_za_min !== null && o.zakryta_za_min !== undefined) minuty.push(n0(o.zakryta_za_min));
    });
    minuty.sort(function (a, b) { return a - b; });
    var med = minuty.length ? (minuty.length % 2 ? minuty[(minuty.length - 1) / 2] : Math.round((minuty[minuty.length / 2 - 1] + minuty[minuty.length / 2]) / 2)) : null;
    $('calloffs-summary').textContent = ot.length
      ? chislo(ot.length, 'call-off', 'call-offs') + ': ' + spisok([
        po.zakryta ? po.zakryta + ' filled' + (med !== null ? ' (median ' + med + ' min from call-off to a yes)' : '') : null,
        po.eskalaciya ? po.eskalaciya + ' escalated to on-call' : null,
        po.ne_zakryta ? po.ne_zakryta + ' not filled' : null,
        po.v_rabote ? po.v_rabote + ' with offers out' : null
      ]) + '.'
      : '';

    fishki($('calloffs-filters'), 'otkazy', [
      ['all', 'All', ot.length], ['zakryta', 'Filled', po.zakryta], ['eskalaciya', 'Escalated', po.eskalaciya],
      ['ne_zakryta', 'Not filled', po.ne_zakryta], ['v_rabote', 'Offers out', po.v_rabote]
    ], otkazy);

    var vidny = ot.filter(function (o) { return filtr.otkazy === 'all' || o.status === filtr.otkazy; });
    var feed = $('feed');
    zamenit(feed, vidny.length ? vidny.map(punktOtkaza) : h('li', null, pusto(ot.length ? 'No call-offs with this status.' : 'No call-offs in the last 7 days.')));

    var nz = D.nastroyki_zameny;
    $('rules-note').textContent = nz
      ? 'Your rules: offers go to ' + n0(nz.volna) + ' caregivers at a time, each wave waits ' + n0(nz.ozhidanie_min) +
        ' minutes, and the on-call coordinator is called when less than ' + chislo(n0(nz.eskalaciya_za_chasov), 'hour', 'hours') +
        ' remain before the shift. The first caregiver to reply yes gets the shift; later replies are told it is taken.'
      : '';
  }

  function vremyaChislo(iso) { var t = new Date(iso).getTime(); return isNaN(t) ? Infinity : t; }

  function punktOtkaza(o) {
    var s = OTKAZ[o.status] || OTKAZ.v_rabote;
    var metka = s[0];
    if (o.status === 'zakryta' && o.zakryta_za_min !== null && o.zakryta_za_min !== undefined) metka = 'Filled in ' + o.zakryta_za_min + ' min';
    var sobytiya = [];
    var volny = o.volny || [];
    if (volny.length) {
      sobytiya.push([vremyaChislo(volny[0].at), chislo(volny.length, 'wave', 'waves') + ' of offers, ' + chislo(n0(o.predlozheno), 'caregiver', 'caregivers') + ' asked; the first went out ' + kogdaVTekste(volny[0].at) + '.']);
    }
    if (o.eskalaciya_v) sobytiya.push([vremyaChislo(o.eskalaciya_v), 'On-call coordinator called ' + kogdaVTekste(o.eskalaciya_v) + '.']);
    if (o.zakreplena_v) sobytiya.push([vremyaChislo(o.zakreplena_v), ((o.zamena && o.zamena.imya) || 'A caregiver') + ' took the shift ' + kogdaVTekste(o.zakreplena_v) + '.']);
    var pozdnie = (o.otvety || []).filter(function (x) {
      return x.otvet === 'da' && o.zakreplena_v && x.sidelka_id !== o.zakreplena_za && new Date(x.at) >= new Date(o.zakreplena_v);
    });
    if (pozdnie.length) {
      sobytiya.push([vremyaChislo(pozdnie[0].at), pozdnie.length === 1
        ? 'Another caregiver also said yes ' + kogdaVTekste(pozdnie[0].at) + ' and was told the shift is taken.'
        : pozdnie.length + ' more caregivers said yes later and were told the shift is taken.']);
    }
    if (o.status === 'ne_zakryta') sobytiya.push([Infinity, 'Nobody covered the shift.']);
    if (o.status === 'v_rabote') sobytiya.push([Infinity, 'Waiting for replies.']);
    sobytiya.sort(function (a, b) { return a[0] - b[0]; });

    return h('li', { class: 'feed__item', 'data-ton': s[1] },
      h('div', null, st(s[1], metka), h('p', { class: 'feed__when' }, 'Reported ' + kogdaVTekste(o.soobshcheno))),
      h('div', null,
        h('p', { class: 'feed__title' }, smena(o.smena) + '. ' + gdeSmena(o.smena)),
        h('p', { class: 'feed__meta' }, ((o.sidelka && o.sidelka.imya) || 'A caregiver') + ' called off by ' + (o.kanal === 'sms' ? 'text' : 'phone') + (o.prichina ? '. Reason given: ' + (PRICHINA_SMENY[o.prichina] || String(o.prichina).toLowerCase()) : '') + '.'),
        h('p', { class: 'feed__detail' }, sobytiya.map(function (x) { return x[1]; }).join(' '))));
  }

  // --- EVV

  function evv() {
    var e = D.evv || {};
    var posl = e.posledniy;
    var demoStend = !!D.demo;
    $('evv-sub').textContent = posl
      ? 'Latest check ' + kogdaVTekste(posl.zagruzheno) + ', ' + (posl.shtat || '') + ' rules, ' + chislo(n0(posl.strok), 'visit', 'visits')
      : 'No checks yet';

    var bez = $('evv-safety');
    if (DEMO) {
      bez.hidden = false;
      bez.textContent = 'Demo mode: a file you choose is read in your browser and is not uploaded anywhere. Use only files without real client information.';
    } else if (demoStend) {
      bez.hidden = false;
      bez.textContent = 'Demo stand: upload only demo files, never real client information.';
    } else {
      bez.hidden = true;
    }
    var shtat = $('evv-state');
    if (D.klient && D.klient.shtat && !shtat.dataset.vybran) shtat.value = D.klient.shtat === 'NC' ? 'NC' : 'NY';

    var isk = (posl && posl.isklyucheniya) || [];
    var po = { krit: 0, pred: 0, info: 0 };
    var poPravilu = {};
    isk.forEach(function (x) {
      po[vazhnost(x.vazhnost)] += 1;
      var p = x.pravilo_tekst || podpisKoda(x.pravilo, PRAVILO);
      poPravilu[p] = (poPravilu[p] || 0) + 1;
    });

    if (!posl) {
      zamenit($('evv-summary'), pusto('No EVV checks yet. Upload a visit export to see what to fix before billing.'));
    } else {
      zamenit($('evv-summary'),
        h('ul', { class: 'sev', 'aria-label': 'Issues by severity' },
          ['krit', 'pred', 'info'].filter(function (k) { return k !== 'info' || po.info > 0; }).map(function (k) {
            return h('li', null, st(VAZH[k][1], VAZH[k][0], 'st--plain'), h('span', { class: 'mono' }, String(po[k])));
          })),
        h('p', { class: 'muted', style: 'margin-bottom:8px;font-size:14px' },
          chislo(isk.length, 'issue', 'issues') + ' in ' + chislo(n0(posl.strok), 'visit', 'visits') + (posl.fayl ? ', file ' + posl.fayl : '') + '.'),
        h('ul', { class: 'rules', 'aria-label': 'Issues by rule' }, Object.keys(poPravilu).sort(function (a, b) { return poPravilu[b] - poPravilu[a]; }).map(function (p) {
          return h('li', null, h('span', null, p), h('span', null, String(poPravilu[p])));
        })));
    }

    fishki($('evv-filters'), 'evv', [
      ['all', 'All', isk.length], ['krit', 'Fix before billing', po.krit], ['pred', 'Review', po.pred], ['info', 'Note', po.info]
    ], evv);

    var poryadok = { krit: 0, pred: 1, info: 2 };
    var vidny = isk.filter(function (x) { return filtr.evv === 'all' || vazhnost(x.vazhnost) === filtr.evv; })
      .slice().sort(function (a, b) { return poryadok[vazhnost(a.vazhnost)] - poryadok[vazhnost(b.vazhnost)]; });
    zamenit($('issues'), vidny.length ? vidny.map(function (x) {
      var v = VAZH[vazhnost(x.vazhnost)];
      var vz = x.vizit || {};
      var gde = ['Visit ' + (x.vizit_id || 'without ID'), vz.data ? F.ymdDen(vz.data) : null, vz.klient_kod ? 'client ' + vz.klient_kod : null,
        (vz.sidelka || vz.sidelka_id) ? 'caregiver ' + (vz.sidelka || vz.sidelka_id) : null, vz.kod_uslugi ? 'service ' + vz.kod_uslugi : null,
        vz.stroka ? 'row ' + vz.stroka + ' of the file' : null].filter(Boolean).join(', ');
      return h('li', { class: 'issue' },
        h('div', { class: 'issue__head' }, st(v[1], v[0]), h('span', { class: 'issue__rule' }, x.pravilo_tekst || podpisKoda(x.pravilo, PRAVILO))),
        h('p', { class: 'issue__visit' }, gde),
        h('dl', null,
          h('dt', null, 'What is wrong'), h('dd', null, x.chto_ne_tak || ''),
          h('dt', null, 'How to fix'), h('dd', { class: 'fix' }, x.kak_ispravit || '')));
    }) : (posl ? h('li', null, pusto(isk.length ? 'No issues with this severity.' : 'No issues in the latest check.')) : null));

    var pr = e.progony || [];
    $('runs-panel').hidden = pr.length < 2;
    zamenit($('runs'), pr.length ? tablica('Previous EVV checks', ['Checked', 'State', 'Visits', 'Issues', 'Fix before billing', 'File'], pr.map(function (r) {
      return [{ v: kogda(r.zagruzheno), cls: 'nowrap' }, r.shtat || '', { v: String(n0(r.strok)), cls: 'num' }, { v: String(n0(r.isklyucheniy)), cls: 'num' }, { v: String(n0(r.kritichnyh)), cls: 'num' }, r.fayl || ''];
    })) : null);
  }

  var forma = $('evv-form');
  var soobsh = $('evv-msg');
  function skazat(tekst, ton) { soobsh.textContent = tekst; soobsh.setAttribute('data-ton', ton || 'info'); }
  $('evv-state').addEventListener('change', function () { this.dataset.vybran = '1'; });
  forma.addEventListener('submit', function (ev) {
    ev.preventDefault();
    var fayl = $('evv-file').files && $('evv-file').files[0];
    var shtat = $('evv-state').value;
    if (!fayl) { skazat('Choose a CSV file first.', 'bad'); $('evv-file').focus(); return; }
    if (!/\.csv$/i.test(fayl.name) && fayl.type !== 'text/csv') { skazat('This is not a CSV file. Export the visits as CSV and try again.', 'bad'); return; }
    if (fayl.size > 5 * 1024 * 1024) { skazat('The file is larger than 5 MB. Export a shorter date range and try again.', 'bad'); return; }
    var knopka = $('evv-submit');
    knopka.disabled = true;
    skazat('Reading the file…', 'info');
    fayl.text().then(function (tekst) {
      var strok = tekst.split(/\r?\n/).filter(function (s) { return s.trim(); }).length - 1;
      if (strok < 1) throw new Error('The file has no visit rows under the header.');
      if (DEMO) {
        skazat('Demo mode: ' + fayl.name + ' was read in your browser and not uploaded. It has ' + chislo(strok, 'visit row', 'visit rows') +
          '. On a live dashboard link, the check runs on the server and its list replaces the one below.', 'info');
        return null;
      }
      skazat('Checking ' + chislo(strok, 'visit', 'visits') + ' against ' + (shtat === 'NC' ? 'North Carolina' : 'New York') + ' rules…', 'info');
      return fetch('/.netlify/functions/evv?k=' + encodeURIComponent(KLYUCH) + '&shtat=' + encodeURIComponent(shtat) + '&fayl=' + encodeURIComponent(fayl.name), {
        method: 'POST',
        headers: { 'content-type': 'text/csv; charset=utf-8', accept: 'application/json' },
        body: tekst,
        cache: 'no-store',
        credentials: 'same-origin',
        referrerPolicy: 'no-referrer'
      }).then(function (r) {
        return r.json().catch(function () { return null; }).then(function (d) {
          if (r.status === 401 || r.status === 403) throw new Error('This link cannot upload files. Ask your CareLine contact for a new link.');
          if (!r.ok || !d || d.ok === false || !d.progon) throw new Error((d && d.soobshchenie) || 'The check did not finish (HTTP ' + r.status + '). Try again in a minute.');
          var p = d.progon;
          var k = (p.isklyucheniya || []).filter(function (x) { return vazhnost(x.vazhnost) === 'krit'; }).length;
          skazat('Checked ' + chislo(n0(p.strok), 'visit', 'visits') + ': ' + chislo((p.isklyucheniya || []).length, 'issue', 'issues') + ', ' + k + ' to fix before billing.', 'ok');
          D.evv = D.evv || {};
          D.evv.posledniy = p;
          filtr.evv = 'all';
          evv();
          segodnya();
          return zagruzit(true);
        });
      });
    }).catch(function (err) {
      skazat(err && err.message ? err.message : 'The check did not finish. Try again.', 'bad');
    }).then(function () { knopka.disabled = false; });
  });

  // --- согласия

  function soglasie(v, da, net, nichego) {
    if (v === true) return st('ok', da);
    if (v === false) return st('neutral', net);
    return h('span', { class: 'muted' }, nichego);
  }
  var ISTOCHNIK = { call: 'Call', sms: 'Text', sms_stop: 'Text: STOP', sms_start: 'Text: START' };

  function soglasiya() {
    var vseS = D.soglasiya || [];
    $('consent-sub').textContent = chislo(vseS.length, 'phone number', 'phone numbers') + ', newest first';
    var cifry = poisk.replace(/\D/g, '');
    var vidny = vseS.filter(function (s) { return !cifry || String(s.telefon || '').replace(/\D/g, '').indexOf(cifry) >= 0; });
    var pokaz = (vse.soglasiya || cifry) ? vidny : vidny.slice(0, 25);
    zamenit($('consent-table'),
      vidny.length ? tablica('Consent log', ['Phone', 'Who', 'Recording', 'Talking to AI', 'Texts', 'Source', 'Updated'], pokaz.map(function (s) {
        var kto = s.kto && s.kto.imya ? (s.kto.tip === 'sidelka' ? 'Caregiver: ' : s.kto.tip === 'kandidat' ? 'Applicant: ' : '') + s.kto.imya : null;
        var sms = s.istochnik === 'sms_stop' && s.sms === false ? st('neutral', 'Opted out (STOP)') : soglasie(s.sms, 'Opted in', 'No', 'Not asked');
        return [
          { v: telefon(s.telefon), cls: 'num strong' },
          kto ? kto : h('span', { class: 'muted' }, 'Caller not on file'),
          soglasie(s.zapis, 'Agreed', 'Declined', s.istochnik && s.istochnik.indexOf('sms') === 0 ? 'Text only' : 'Not asked'),
          soglasie(s.ii, 'Agreed', 'Declined', 'Not asked'),
          sms,
          ISTOCHNIK[s.istochnik] || podpisKoda(s.istochnik, {}),
          { v: kogda(s.at), cls: 'nowrap' }
        ];
      })) : pusto(vseS.length ? 'No phone number matches ' + poisk + '.' : 'No consent records yet.'),
      cifry ? null : knopkaVse('soglasiya', vidny.length, 25, soglasiya));
  }
  $('consent-q').addEventListener('input', function () { poisk = this.value; soglasiya(); });

  // --- звонки

  function zvonki() {
    var z = D.zvonki || [];
    $('calls-sub').textContent = 'Last 7 days, newest first';
    var sek = z.reduce(function (s, x) { return s + n0(x.dlitelnost_s); }, 0);
    var poYaz = {};
    z.forEach(function (x) { if (x.yazyk) poYaz[x.yazyk] = (poYaz[x.yazyk] || 0) + 1; });
    $('calls-summary').textContent = z.length
      ? chislo(z.length, 'call', 'calls') + ', ' + chasy(sek) + ' in total. ' + yazykiStroka(poYaz) + '. Average length ' + dlit(sek / z.length) + '.'
      : '';
    var poLinii = {};
    z.forEach(function (x) { poLinii[x.liniya] = (poLinii[x.liniya] || 0) + 1; });
    fishki($('calls-filters'), 'zvonki', [['all', 'All lines', z.length]].concat(Object.keys(poLinii).sort(function (a, b) { return poLinii[b] - poLinii[a]; }).map(function (l) {
      return [l, LINIYA[l] || l, poLinii[l]];
    })), zvonki);

    var vidny = z.filter(function (x) { return filtr.zvonki === 'all' || x.liniya === filtr.zvonki; });
    var pokaz = vse.zvonki ? vidny : vidny.slice(0, 20);
    zamenit($('calls-table'),
      vidny.length ? tablica('Calls', ['When', 'Line', 'Language', 'Caller wanted', 'Outcome', 'Length', 'Summary'], pokaz.map(function (x) {
        var it = ITOG[x.itog] || [podpisKoda(x.itog, {}), 'neutral'];
        return [
          { v: kogda(x.nachalo), cls: 'nowrap' },
          LINIYA[x.liniya] || x.liniya || '',
          yazyk(x.yazyk),
          NAMERENIE[x.namerenie] || podpisKoda(x.namerenie, {}),
          st(it[1], it[0]),
          { v: dlit(x.dlitelnost_s), cls: 'num' },
          { v: x.kratko || '', cls: 'wide' }
        ];
      })) : pusto('No calls in the last 7 days.'),
      knopkaVse('zvonki', vidny.length, 20, zvonki));
  }

  // --- обращения семей (semi)

  function zhdetZvonka(s) { return !(s.ocenka && s.ocenka.start) && (!s.status || s.status === 'new'); }

  function statusSemi(s) {
    var oc = s.ocenka && s.ocenka.start;
    if (oc) {
      return new Date(oc) <= new Date(D.sformirovano || Date.now()) ? ['Assessment date passed', 'neutral'] : ['Assessment booked', 'info'];
    }
    if (zhdetZvonka(s)) return ['Waiting for callback', 'warn'];
    return [podpisKoda(s.status, {}), 'neutral'];
  }

  // как дойдёт напоминание об оценке: SMS по согласию, иначе письмо, иначе никак (функция napominaniya стенда)
  function napominanie(s) {
    if (!(s.ocenka && s.ocenka.start)) return null;
    var sms = s.soglasiya && s.soglasiya.sms === true;
    var pochta = s.kontakt && s.kontakt.email;
    if (sms) return 'Reminder by text';
    if (pochta) return 'Reminder by email';
    return 'No reminder: no text consent or email';
  }

  function semi() {
    var vseS = Array.isArray(D.semi) ? D.semi : null;
    var sub = $('families-sub');
    if (!vseS) {
      sub.textContent = '';
      $('families-summary').textContent = '';
      $('families-filters').hidden = true;
      zamenit($('families-table'), pusto('Family inquiries are not in this dashboard data yet.'));
      return;
    }
    sub.textContent = 'Newest first' + (vseS.length >= 50 ? ', latest 50' : '');
    var po = { ocenka: 0, zhdut: 0, srochno: 0 };
    vseS.forEach(function (s) {
      if (s.ocenka && s.ocenka.start) po.ocenka += 1;
      if (zhdetZvonka(s)) po.zhdut += 1;
      if (s.srochnost === 'srochno') po.srochno += 1;
    });
    $('families-summary').textContent = vseS.length
      ? chislo(vseS.length, 'inquiry', 'inquiries') + ': ' + spisok([
        po.ocenka ? po.ocenka + ' with a home assessment booked' : null,
        po.zhdut ? po.zhdut + ' waiting for a callback' : null,
        po.srochno ? po.srochno + ' need care within a few days' : null
      ]) + '.'
      : '';
    fishki($('families-filters'), 'semi', [
      ['all', 'All', vseS.length], ['ocenka', 'Assessment booked', po.ocenka], ['zhdut', 'Waiting for callback', po.zhdut],
      ['srochno', 'Within a few days', po.srochno]
    ], semi);
    var vidny = vseS.filter(function (s) {
      if (filtr.semi === 'ocenka') return !!(s.ocenka && s.ocenka.start);
      if (filtr.semi === 'zhdut') return zhdetZvonka(s);
      if (filtr.semi === 'srochno') return s.srochnost === 'srochno';
      return true;
    });
    var pokaz = vse.semi ? vidny : vidny.slice(0, 12);
    zamenit($('families-table'),
      vidny.length ? tablica('Family inquiries', ['Came in', 'Contact', 'Area', 'Hours a week', 'Payment', 'Start', 'Assessment', 'Status'], pokaz.map(function (s) {
        var k = s.kontakt || {};
        var sr = SROCHNOST[s.srochnost];
        var oc = s.ocenka && s.ocenka.start;
        var sts = statusSemi(s);
        var nap = napominanie(s);
        return [
          { v: kogda(s.created_at), cls: 'nowrap' },
          { v: h('span', { class: 'stack' },
            h('span', { class: 'strong' }, k.imya || 'Name not given'),
            h('span', { class: 'muted' }, [telefon(k.telefon), yazyk(s.yazyk)].filter(Boolean).join(', ')),
            k.email ? h('span', { class: 'muted' }, k.email) : null) },
          [s.rayon, s.zip].filter(Boolean).join(', ') || h('span', { class: 'muted' }, 'Not given'),
          s.chasy_v_nedelyu !== null && s.chasy_v_nedelyu !== undefined && s.chasy_v_nedelyu !== '' ? { v: String(s.chasy_v_nedelyu), cls: 'num' } : h('span', { class: 'muted' }, 'Not given'),
          OPLATA[s.oplata] || (s.oplata ? podpisKoda(s.oplata, {}) : h('span', { class: 'muted' }, 'Not given')),
          sr ? st(sr[1], sr[0]) : (s.srochnost ? podpisKoda(s.srochnost, {}) : h('span', { class: 'muted' }, 'Not given')),
          { v: oc ? h('span', { class: 'stack' }, h('span', null, kogda(oc)), nap ? h('span', { class: 'muted' }, nap) : null) : h('span', { class: 'muted' }, 'Not booked'), cls: 'nowrap-first' },
          st(sts[1], sts[0])
        ];
      })) : pusto(vseS.length ? 'No inquiries match this filter.' : 'No family inquiries yet. They appear here after a family calls the hiring line.'),
      knopkaVse('semi', vidny.length, 12, semi));
  }

  // --- журнал действий (zhurnal)

  // Имена по id карточек и по телефонам — из того, что уже есть в снимке (сиделок целиком в снимке нет).
  function spravochnik() {
    var s = { kand: {}, semya: {}, otkaz: {}, sidelka: {}, tel: {}, zvonok: {} };
    (D.kandidaty || []).forEach(function (k) { if (k.id) s.kand[k.id] = k; if (k.telefon && k.imya) s.tel[k.telefon] = k.imya; });
    (Array.isArray(D.semi) ? D.semi : []).forEach(function (x) {
      if (x.id) s.semya[x.id] = x;
      if (x.kontakt && x.kontakt.telefon && x.kontakt.imya) s.tel[x.kontakt.telefon] = x.kontakt.imya;
    });
    (D.otkazy || []).forEach(function (o) {
      if (o.id) s.otkaz[o.id] = o;
      if (o.sidelka && o.sidelka.id && o.sidelka.imya) s.sidelka[o.sidelka.id] = o.sidelka.imya;
      if (o.zamena && o.zamena.id && o.zamena.imya) s.sidelka[o.zamena.id] = o.zamena.imya;
    });
    (D.soglasiya || []).forEach(function (x) { if (x.telefon && x.kto && x.kto.imya && !s.tel[x.telefon]) s.tel[x.telefon] = x.kto.imya; });
    (D.zvonki || []).forEach(function (z) { if (z.conversation_id) s.zvonok[z.conversation_id] = z; });
    return s;
  }

  function ktoPoTelefonu(t) {
    if (!t) return '';
    var imya = SPRAVKA.tel[t];
    return imya ? imya + ' (' + telefon(t) + ')' : telefon(t);
  }
  function imyaSidelki(id) { return (id && SPRAVKA.sidelka[id]) || (id ? 'caregiver ' + id : 'a caregiver'); }
  function chastObekta(obekt) {
    var p = String(obekt || '').split('/');
    return { vid: p[0], id: p.slice(1).join('/') };
  }
  function opisatObekt(obekt) {
    var o = chastObekta(obekt);
    if (o.vid === 'kandidaty') { var k = SPRAVKA.kand[o.id]; return k ? (k.imya || 'An applicant') : ''; }
    if (o.vid === 'semi') { var s = SPRAVKA.semya[o.id]; return s ? ((s.kontakt && s.kontakt.imya) || 'A family') : ''; }
    if (o.vid === 'sidelki') return imyaSidelki(o.id);
    if (o.vid === 'soglasiya') return ktoPoTelefonu(o.id);
    if (o.vid === 'zvonki') {
      var zv = SPRAVKA.zvonok[o.id];
      if (!zv) return '';
      if (zv.telefon) return zv.imya && !SPRAVKA.tel[zv.telefon] ? zv.imya + ' (' + telefon(zv.telefon) + ')' : ktoPoTelefonu(zv.telefon);
      return zv.imya || 'Caller at ' + F.vremya(zv.nachalo);
    }
    return '';
  }
  function opisatOtkaz(obekt) {
    var o = SPRAVKA.otkaz[chastObekta(obekt).id];
    if (!o) return '';
    return [(o.sidelka && o.sidelka.imya) || 'A caregiver', smena(o.smena), o.smena && o.smena.klient_kod ? 'client ' + o.smena.klient_kod : null].filter(Boolean).join(', ');
  }
  function soglasieSlovami(stalo, istochnik) {
    stalo = stalo || {};
    var ch = [];
    if (stalo.zapis === true) ch.push('agreed to recording'); else if (stalo.zapis === false) ch.push('declined recording');
    if (stalo.ii === true) ch.push('agreed to talk to the AI assistant'); else if (stalo.ii === false) ch.push('declined the AI assistant');
    if (stalo.sms === true) ch.push('opted in to texts'); else if (stalo.sms === false) ch.push(istochnik === 'sms_stop' ? 'opted out of texts (STOP)' : 'declined texts');
    return ch.join(', ');
  }

  function podrobnosti(z) {
    var d = z.detali && typeof z.detali === 'object' ? z.detali : {};
    var liniya = d.liniya ? (LINIYA[d.liniya] || d.liniya) : '';
    var kto = opisatObekt(z.obekt);
    switch (z.chto) {
      case 'zvonok_vhod': return fraza(liniya);
      case 'zvonok_predel': return fraza([liniya, d.limit ? 'limit ' + d.limit + ' calls a day' : null].filter(Boolean).join(', '));
      case 'zvonok_itog': {
        var it = ITOG[d.itog];
        return fraza([kto || null, liniya, NAMERENIE[d.namerenie] || (d.namerenie ? podpisKoda(d.namerenie, {}) : null),
          it ? it[0].toLowerCase() : (d.itog ? podpisKoda(d.itog, {}).toLowerCase() : null),
          d.dlitelnost_s !== undefined && d.dlitelnost_s !== null ? dlit(d.dlitelnost_s) : null].filter(Boolean).join(', ')) +
          (d.soobshchenie ? ' Message for staff.' : '');
      }
      case 'perevod': case 'perevod_dry_run': case 'perevod_vne_chasov': case 'perevod_nekomu':
        return fraza(liniya);
      case 'kandidat_novyy': case 'kandidat_obnovlen': case 'kandidat_bez_imeni': case 'kandidat_bez_otbora':
      case 'semya_novaya': case 'semya_obnovlena': case 'semya_bez_imeni':
        return fraza([kto, d.oplata ? OPLATA[d.oplata] || d.oplata : null].filter(Boolean).join(', '));
      case 'zapis': case 'zapis_perenesena': {
        var chtoZ = d.tip === 'ocenka' ? 'Home assessment' : d.tip === 'sobesedovanie' ? 'Interview' : 'Appointment';
        var dop = [d.pismo === 'otpravleno' ? 'confirmation email sent' : d.pismo === 'dry_run' ? 'email in test mode' : null,
          d.sms === 'otpravleno' ? 'text sent' : d.sms === 'dry_run' ? 'text in test mode' : null].filter(Boolean);
        return fraza([kto, chtoZ + (d.start ? ' ' + kogdaVTekste(d.start) : '')].filter(Boolean).join(': ') + (dop.length ? '; ' + dop.join(', ') : ''));
      }
      case 'napominanie': case 'napominanie_net': {
        // lib/napominaniya.js: {chasov, tip, kanal, rezultat, start}
        var chtoN = d.tip === 'ocenka' ? 'Home assessment' : d.tip === 'sobesedovanie' ? 'Interview' : null;
        var rez = { otpravleno: null, dry_run: 'test mode', uzhe: 'already sent', net_kanala: 'no text consent or email' }[d.rezultat];
        return fraza([kto, chtoN ? chtoN + (d.start ? ' ' + kogdaVTekste(d.start) : '') : null,
          d.chasov ? d.chasov + ' h before' : null,
          d.kanal === 'sms' ? 'by text' : d.kanal === 'email' ? 'by email' : null,
          rez === undefined ? (d.rezultat ? podpisKoda(d.rezultat, {}).toLowerCase() : null) : rez].filter(Boolean).join(', '));
      }
      case 'otkaz_ot_smeny':
        return fraza(opisatOtkaz(z.obekt) + (d.prichina ? '. Reason: ' + (PRICHINA_SMENY[d.prichina] || d.prichina) : ''));
      case 'otkaz_bez_prichiny': return fraza(imyaSidelki(d.sidelka_id));
      case 'otkaz_neizvestnyy_nomer': return fraza(d.telefon || d.ot ? 'From ' + telefon(d.telefon || d.ot) : '');
      case 'otkaz_sms_neodnoznachno': return fraza([kto, d.smen ? d.smen + ' upcoming shifts' : null].filter(Boolean).join(', '));
      case 'volna_pervaya': case 'volna_sleduyushchaya': {
        var n = Array.isArray(d.sidelki) ? d.sidelki.length : n0(d.otpravleno);
        return fraza(opisatOtkaz(z.obekt) + '. Offer texted to ' + chislo(n, 'caregiver', 'caregivers'));
      }
      case 'otvet_da': return fraza(imyaSidelki(d.sidelka_id) + ' ' + (OTVET_DA[d.rezultat] || (d.rezultat ? podpisKoda(d.rezultat, {}).toLowerCase() : 'said yes')));
      case 'otvet_net': return fraza(imyaSidelki(d.sidelka_id));
      case 'smena_zakreplena': return fraza(imyaSidelki(d.sidelka_id) + ' took the shift');
      case 'smena_ne_zakryta': case 'podbor_oshibka': case 'eskalaciya_nekogo_budit': case 'eskalaciya_cepochka_konchilas':
        return fraza(opisatOtkaz(z.obekt));
      case 'eskalaciya_zvonok':
        return fraza((d.prichina ? 'Reason: ' + (ESKALACIYA[d.prichina] || podpisKoda(d.prichina, {}).toLowerCase()) : '') + (d.dry_run ? ' (test mode)' : '')
          + (d.pochemu === 'potolok' ? '. Not placed: daily call limit reached, coordinator emailed instead' : ''));
      case 'zvonok_potolok':
        return fraza([d.komu ? 'To ' + ktoPoTelefonu(d.komu) : null, d.limit ? 'limit ' + d.limit + ' calls a day' : null].filter(Boolean).join(', '));
      case 'chistka': {
        var udaleno = 0;
        Object.keys(d.udaleno || {}).forEach(function (k) { udaleno += n0(d.udaleno[k]); });
        return fraza((d.dney ? 'Call records are kept ' + d.dney + ' days; ' : '') + (udaleno ? chislo(udaleno, 'older record', 'older records') + ' removed' : 'nothing older to remove'));
      }
      case 'eskalaciya_prinyata': return fraza(opisatOtkaz(z.obekt));
      case 'sms_vhod': case 'sms_neizvestno':
        return fraza('From ' + (kto || ktoPoTelefonu(d.ot)) + (d.tekst ? ': “' + obrezat(d.tekst, 140) + '”' : ''));
      case 'sms_dry_run':
        return fraza('To ' + ktoPoTelefonu(d.komu) + (d.tekst ? ': “' + obrezat(d.tekst, 140) + '”' : ''));
      case 'sms_otpravleno': case 'sms_blok_otpiska': case 'sms_blok_net_soglasiya': case 'sms_oshibka':
      case 'zvonok_nachat': case 'zvonok_dry_run': case 'zvonok_oshibka':
        return fraza(d.komu ? 'To ' + ktoPoTelefonu(d.komu) : kto);
      case 'pismo_otpravleno': case 'pismo_dry_run': case 'pismo_oshibka': case 'pismo_potolok': case 'pismo_ne_nastroeno':
        return fraza(d.tema ? '“' + obrezat(d.tema, 140) + '”' : '');
      case 'soglasie':
        return fraza([kto, soglasieSlovami(d.stalo, d.istochnik)].filter(Boolean).join(': '));
      case 'evv_progon':
        return fraza([d.fayl || null, d.strok !== undefined ? chislo(n0(d.strok), 'visit', 'visits') : null,
          d.isklyucheniy !== undefined ? chislo(n0(d.isklyucheniy), 'issue', 'issues') : null, d.shtat ? d.shtat + ' rules' : null].filter(Boolean).join(', '));
      case 'svodka': case 'svodka_nekomu':
        return fraza([d.tema ? '“' + obrezat(d.tema, 140) + '”' : null, d.komu ? 'to ' + chislo(n0(d.komu), 'recipient', 'recipients') : null].filter(Boolean).join(', '));
      default:
        return fraza(kto);
    }
  }

  function zhurnal() {
    var vseZ = Array.isArray(D.zhurnal) ? D.zhurnal : null;
    var sub = $('activity-sub');
    if (!vseZ) {
      sub.textContent = '';
      $('activity-filters').hidden = true;
      zamenit($('activity-table'), pusto('The activity log is not in this dashboard data yet.'));
      return;
    }
    sub.textContent = 'Today, newest first' + (vseZ.length >= 100 ? ', latest 100' : '');
    var poGruppe = {};
    vseZ.forEach(function (z) { var g = (ZH[z.chto] || [null, 'prochee'])[1]; poGruppe[g] = (poGruppe[g] || 0) + 1; });
    fishki($('activity-filters'), 'zhurnal', [['all', 'All', vseZ.length]].concat(GRUPPY.map(function (g) { return [g[0], g[1], poGruppe[g[0]] || 0]; })), zhurnal);
    var vidny = vseZ.filter(function (z) { return filtr.zhurnal === 'all' || (ZH[z.chto] || [null, 'prochee'])[1] === filtr.zhurnal; });
    var pokaz = vse.zhurnal ? vidny : vidny.slice(0, 30);
    zamenit($('activity-table'),
      vidny.length ? tablica('Activity log', ['Time', 'Source', 'What happened', 'Details'], pokaz.map(function (z) {
        var x = ZH[z.chto];
        var podpis = x ? x[0] : podpisKoda(z.chto, {});
        return [
          { v: F.ymd(z.at) === SEG ? F.vremya(z.at) : kogda(z.at), cls: 'nowrap' },
          KTO[z.kto] || podpisKoda(z.kto, {}),
          x && x[2] ? st(x[2], podpis) : { v: podpis, cls: 'strong' },
          { v: podrobnosti(z), cls: 'wide' }
        ];
      })) : pusto(vseZ.length ? 'No entries of this kind today.' : 'Nothing has happened yet today.'),
      knopkaVse('zhurnal', vidny.length, 30, zhurnal));
  }

  // ---------- общие куски ----------

  function tablica(podpis, kolonki, stroki) {
    return h('table', { class: 'table' },
      h('caption', { class: 'vh' }, podpis),
      h('thead', null, h('tr', null, kolonki.map(function (k) { return h('th', { scope: 'col' }, k); }))),
      h('tbody', null, stroki.map(function (r) {
        return h('tr', null, r.map(function (c, i) {
          var obj = c && typeof c === 'object' && !(c instanceof Node) && 'v' in c;
          return h('td', { 'data-label': kolonki[i], class: obj ? c.cls : null }, obj ? c.v : c);
        }));
      })));
  }

  function fishki(el, klyuch, varianty, perersovat) {
    zamenit(el, varianty.filter(function (v) { return v[0] === 'all' || v[2] > 0; }).map(function (v) {
      return h('button', {
        class: 'chip', type: 'button', 'aria-pressed': filtr[klyuch] === v[0] ? 'true' : 'false',
        onclick: function () { filtr[klyuch] = v[0]; perersovat(); }
      }, v[1], h('span', { class: 'mono' }, String(v[2])));
    }));
    el.hidden = varianty[0][2] === 0;
  }

  function knopkaVse(klyuch, vsego, porog, perersovat) {
    if (vsego <= porog) return null;
    return h('button', {
      class: 'btn btn--ghost more', type: 'button',
      onclick: function () { vse[klyuch] = !vse[klyuch]; perersovat(); }
    }, vse[klyuch] ? 'Show fewer' : 'Show all ' + vsego);
  }

  // ---------- подсветка раздела в навигации ----------

  var nablyudatel = null;
  function podsvetkaRazdelov() {
    if (nablyudatel || !('IntersectionObserver' in window)) return;
    var ssylki = {};
    Array.prototype.forEach.call(document.querySelectorAll('.sections__list a'), function (a) { ssylki[a.getAttribute('href').slice(1)] = a; });
    nablyudatel = new IntersectionObserver(function (zapisi) {
      zapisi.forEach(function (z) {
        if (!z.isIntersecting) return;
        Object.keys(ssylki).forEach(function (id) { ssylki[id].removeAttribute('aria-current'); });
        if (ssylki[z.target.id]) ssylki[z.target.id].setAttribute('aria-current', 'true');
      });
    }, { rootMargin: '-40% 0px -55% 0px' });
    Object.keys(ssylki).forEach(function (id) { var s = $(id); if (s) nablyudatel.observe(s); });
  }

  // ---------- кнопки и автообновление ----------

  $('refresh').addEventListener('click', function () { zagruzit(true); });
  if (KLYUCH) {
    avto = setInterval(function () { if (document.visibilityState === 'visible') zagruzit(true); }, 5 * 60 * 1000);
  }

  zagruzit();
})();
