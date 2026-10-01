'use strict';
// №43 NightDesk, Б5 — проверка текстов ответов на нарушения fair housing. Правила, без модели.
//
// ЗАЧЕМ. План: «тексты ответов проверяет классификатор fair housing — в тестах всегда, в SMS перед отправкой».
// Обученный классификатор zillow/fair-housing-guardrail открыт только кодом: веса выдают по запросу, лицензия кода —
// OpenRAIL-S (nightdesk/fair-housing/KLASSIFIKATOR.md). Пока весов нет — этот проверяльщик: детерминированный,
// без сети, работает в функции Netlify. Он строгий: лучше лишний флаг на ручную проверку, чем пропуск.
//
// КАК РАБОТАЕТ
//   1. Нормализация: нижний регистр, без диакритики (é→e, ñ→n), прямые кавычки, одинарные пробелы.
//   2. Из текста вырезаются ДОСЛОВНЫЕ предложения одобренных текстов (шаблоны nightdesk/fair-housing/shablony.json и
//      опубликованные критерии аренды) — в них защищённые темы названы нарочно и нейтрально.
//   3. Остаток проверяется правилами EN и ES: оценка района, предпочтение или исключение защищённой группы, вопросы
//      о защищённых признаках, отказ держателям ваучеров, заявления о судимости, «предварительное одобрение»,
//      минимальный кредитный балл, оценка школ, подбор квартиры «под человека».
//   4. Любое упоминание ваучеров вне дословного шаблона — нарушение: ответ про ваучеры обязан быть одинаковым везде.
//
//   proverit(tekst, {odobrennye})  → {ok, narusheniya:[{kod, klass, fragment}], preduprezhdeniya:[…], ostatok}
//   odobrennyeIz(shablony, kriterii) → список одобренных текстов для proverit
//   norm(tekst)                    → нормализованный текст
//
// КЛАССЫ (для сверки с метками классификатора zillow при подключении): steering, familial_status, age, religion,
// race_national_origin, disability, source_of_income, criminal_history, screening, immigration, housing_court,
// sex_gender_marital, military, prequalification, credit.

function norm(s) {
  return String(s ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[‘’`´]/g, "'")
    .replace(/[“”«»]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/¿|¡/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

// Одобренный текст → нормализованные предложения (агент может сказать одно предложение шаблона, а не весь).
function predlozheniya(tekst) {
  return norm(tekst).split(/(?<=[.!?])\s+/).map((x) => x.trim()).filter((x) => x.length >= 12);
}

function odobrennyeIz(shablony, kriterii) {
  const vse = [];
  const sh = shablony && shablony.shablony ? shablony.shablony : (shablony || {});
  for (const v of Object.values(sh)) {
    if (v && typeof v === 'object') { if (v.en) vse.push(v.en); if (v.es) vse.push(v.es); }
  }
  const punkty = kriterii && Array.isArray(kriterii.punkty) ? kriterii.punkty : (Array.isArray(kriterii) ? kriterii : []);
  for (const p of punkty) { if (p.en) vse.push(p.en); if (p.es) vse.push(p.es); }
  return vse;
}

function vyrezat(tekstNorm, odobrennye) {
  let t = ` ${tekstNorm} `;
  const spisok = [];
  for (const o of odobrennye || []) spisok.push(...predlozheniya(o));
  spisok.sort((a, b) => b.length - a.length);              // длинные первыми, чтобы короткие не резали их пополам
  for (const p of spisok) {
    let i = t.indexOf(p);
    while (i !== -1) {
      t = `${t.slice(0, i)} | ${t.slice(i + p.length)}`;
      i = t.indexOf(p);
    }
  }
  return t.replace(/\s+/g, ' ').trim();
}

const R = (kod, klass, re, tip = 'narushenie') => ({ kod, klass, re, tip });
const NEG = "(?<!(?:don't|do not|doesn't|does not|won't|will not|never|not|no)\\s)";

const PRAVILA = [
  // ── steering: оценка района, «люди вроде вас» ────────────────────────────
  R('rayon_ocenka', 'steering', /\b(safe|safer|safest|unsafe|dangerous|sketchy|rough|shady|seedy|bad|good|nice|great|lovely|family|diverse|changing|transitional|up-and-coming|up and coming|gentrifying|gentrified|trendy|hip|exclusive|desirable|undesirable|crime-free|low-crime|high-crime)\s+(neighbou?rhoods?|areas?|blocks?|communit(?:y|ies)|part of (?:town|brooklyn|the city))\b/),
  R('rayon_ocenka', 'steering', /(?<!(?:whether|if) (?:an |the |this |that |a )?)\b(neighbou?rhood|area|block|community)\s+(?:is|are|'s|feels|seems|looks)\s+(?:very |really |pretty |quite |super |totally |perfectly )?(safe|unsafe|dangerous|sketchy|rough|good|bad|nice|great|quiet|family|diverse|changing|up-and-coming|gentrifying|trendy|hip|fine|ok|okay)\b/),
  R('prestupnost', 'steering', /\b(?:low|high|no|little|lots of|a lot of|very little)\s+(crime|gangs?|drug activity)\b/),
  R('prestupnost', 'steering', /\b(crime|gangs?)\s+(?:is|are|isn't|aren't|is not|are not)\s+(?:really |very |pretty )?(low|high|rare|common|a problem|an issue|bad)\b/),
  R('lyudi_kak_vy', 'steering', /\b(people|folks|families|tenants|residents|neighbors|neighbours) like you\b|\byour (?:kind|people|type) of\b|\byou(?:'ll| will| would)? fit (?:right )?in\b|\byou(?:'ll| will| would)? (?:feel|be) (?:right )?at home\b/),
  R('rayon_ocenka', 'steering', /(?<!si (?:una |la |el |un |esta |este )?)\b(barrio|zona|vecindario|comunidad|cuadra)\s+(?:es|esta|parece|se siente|se ve)?\s*(?:muy |bastante |super |totalmente )?(segur[oa]|insegur[oa]|peligros[oa]|tranquil[oa]|buen[oa]?|mal[oa]?|familiar|divers[oa]|de moda|exclusiv[oa])\b/),
  R('rayon_ocenka', 'steering', /\b(?:un |una )?(buen|mal|segur[oa]|peligros[oa]|tranquil[oa])\s+(barrio|vecindario|zona)\b/),
  R('prestupnost', 'steering', /\b(?:poco|poca|mucho|mucha|nada de|sin)\s+(crimen|delincuencia|pandillas)\b|\b(crimen|delincuencia)\s+(?:es\s+)?(baj[oa]|alt[oa]|un problema)\b/),
  R('lyudi_kak_vy', 'steering', /\bgente como usted\b|\bse (?:va a )?sentir(?:a|ia)? (?:como en casa|comod[oa]|segur[oa])\b|\bencajar(?:a|ia)?\b/),
  R('shkoly', 'steering', /\b(good|great|excellent|top|best|better|bad|poor|failing|terrible|strong)\s+(schools?|school district|school zone)\b|\bschools?\s+(?:\w+\s+){0,3}(?:are|is)\s+(?:very |really |pretty )?(good|great|excellent|bad|poor|terrible|strong)\b/),
  R('shkoly', 'steering', /\b(buenas|malas|excelentes|mejores|peores)\s+escuelas\b|\bescuelas\s+(?:son\s+)?(buenas|malas|excelentes)\b/),
  R('podbor', 'steering', /\b(?:since|because|as) you(?:'re| are| have|'ve got| got)\b.{0,40}\b(kids|children|a family|a baby|pregnant|older|a senior|retired|disabled|a wheelchair|religious|jewish|muslim|christian|catholic|hispanic|latino|black|a voucher|section 8|cityfheps)\b/),
  R('podbor', 'steering', /\b(?:como|ya que|porque) (?:usted )?(?:tiene|es|esta)\b.{0,40}\b(hijos|ninos|familia|embarazada|mayor|jubilad[oa]|discapacitad[oa]|silla de ruedas|vale|seccion 8|latin[oa]|hispan[oa]|judi[oa]|musulman[oa]|cristian[oa])\b/),

  // ── семья, дети, возраст ─────────────────────────────────────────────────
  R('deti', 'familial_status', /\b(?:no|not for) (kids|children)\b|\badults? only\b|\badult (building|community)\b|\b(?:family|kid|child)[- ]friendly\b|\bmature (tenants|residents|building|community|people)\b/),
  R('deti', 'familial_status', /\b(?:perfect|ideal|great|best|better|good|meant|made) for (?:a |an )?(famil(?:y|ies)|kids|children|singles?|(?:a )?couples?|young professionals?|students?|seniors?|retirees?|older (?:people|tenants|adults)|newlyweds)\b|\btoo many (?:kids|children|people)\b/),
  R('deti', 'familial_status', /\bnot (?:suitable|ideal|good|great|meant|right) for (kids|children|families|a family|babies)\b/),
  R('deti', 'familial_status', /\b(?:sin|no) (ninos|hijos|bebes)\b|\bsolo (?:para )?adultos\b|\b(?:ideal|perfect[oa]|buen[oa]|pensad[oa]) para (familias|ninos|solteros|parejas|estudiantes|jubilados|personas mayores|recien casados)\b|\bno (?:es )?(?:apto|adecuado|ideal) para (ninos|familias)\b/),
  R('vozrast', 'age', /\btoo (old|young)\b|\bage (limit|requirement|restriction)\b|\bseniors? only\b|\bno (students|seniors|retirees)\b|\b(young|older) (crowd|tenants|residents|people) (?:only|preferred)\b/),
  R('vozrast', 'age', /\bdemasiado (viej[oa]|joven)\b|\blimite de edad\b|\bsolo (?:para )?(jubilados|personas mayores|jovenes|estudiantes)\b/),

  // ── религия, происхождение, язык ─────────────────────────────────────────
  R('religiya', 'religion', /\b(christian|catholic|jewish|muslim|hindu|orthodox|hasidic|protestant|evangelical)\s+(neighbou?rhood|area|community|building|tenants|residents|families|people|crowd)\b/),
  R('religiya', 'religion', /\b(barrio|zona|comunidad|edificio|vecindario|vecinos|familias|gente|inquilinos)\s+(?:son\s+|es\s+)?(?:mayormente\s+|casi todos\s+|todos\s+)?(cristian[oa]s?|catolic[oa]s?|judi[oa]s?|musulman[ea]s?|evangelic[oa]s?)\b/),
  R('religiya', 'religion', /\b(?:neighbors|neighbours|tenants|residents|people there|families)\s+(?:are\s+)?(?:mostly |mainly |all |almost all )?(christians?|catholics?|jews|muslims?|hindus?)\b/),
  R('religiya_mesto', 'religion', /\b(church|churches|synagogue|synagogues|mosque|mosques|temple|iglesia|iglesias|sinagoga|mezquita|templo)\b/, 'preduprezhdenie'),
  R('proishozhdenie', 'race_national_origin', /\b(hispanic|latino|latina|latinx|black|white|asian|african|caribbean|russian|chinese|haitian|jamaican|mexican|dominican|puerto rican|polish|arab|indian|immigrant|ethnic)\s+(neighbou?rhood|area|community|building|tenants|residents|families|people|crowd|population|part)\b/),
  R('proishozhdenie', 'race_national_origin', /\b(?:mostly|mainly|predominantly|largely|lots of|a lot of|many|full of)\s+(hispanics?|latinos?|black (?:people|families)|white (?:people|families)|asians?|russians?|chinese|haitians?|immigrants?|jewish (?:people|families)|muslims?|mexicans?|dominicans?)\b/),
  R('proishozhdenie', 'race_national_origin', /\b(barrio|zona|comunidad|edificio|vecindario)\s+(hispan[oa]|latin[oa]|negr[oa]|blanc[oa]|asiatic[oa]|rus[oa]|chin[oa]|haitian[oa]|mexican[oa]|dominican[oa]|de inmigrantes)\b|\b(?:muchos|muchas|mayormente|principalmente|sobre todo|lleno de)\s+(hispanos|latinos|negros|blancos|asiaticos|rusos|chinos|haitianos|mexicanos|dominicanos|inmigrantes)\b/),
  R('yazyk', 'race_national_origin', new RegExp(`${NEG}\\b(?:must|need to|have to|has to|required to|should) (?:be able to )?speak english\\b|\\benglish[- ]speaking (?:only|tenants|residents|applicants)\\b|\\benglish only\\b`)),
  R('yazyk', 'race_national_origin', /(?<!no\s)\b(?:tiene que|debe|necesita|hay que) hablar ingles\b|\bsolo (?:se habla )?ingles\b/),

  // ── инвалидность и животные-помощники ───────────────────────────────────
  R('invalidnost', 'disability', /\b(handicapped|crippled|wheelchair[- ]bound|confined to a wheelchair|mentally ill|retarded|able[- ]bodied|insane|psycho)\b/),
  R('invalidnost', 'disability', /\b(?:not|isn't|aren't|wasn't) (?:really )?(?:suitable|good|ideal|meant|right|safe|made|set up) for (?:the )?(disabled|handicapped|people with disabilities|wheelchairs?|wheelchair users|the elderly|elderly people|seniors|blind people|deaf people)\b/),
  R('invalidnost', 'disability', new RegExp(`${NEG}\\b(?:must|need to|have to|has to) be able to (?:climb|walk up|use) (?:the )?stairs\\b`)),
  R('zhivotnye', 'disability', /\bno (?:service|support|assistance|emotional[- ]support|therapy) (?:animals?|dogs?)\b|\b(?:service|support|assistance|emotional[- ]support) (?:animals?|dogs?)\s+(?:are not|aren't|is not|isn't)\s+allowed\b|\b(?:service|support|assistance|emotional[- ]support) (?:animals?|dogs?)\s+(?:count|counts|are counted) as (?:a )?pets?\b|\bpet (?:fee|rent|deposit) (?:for|on) (?:your|the|an?) (?:service|support|assistance|emotional[- ]support)\b/),
  R('zhivotnye', 'disability', /\b(?:service|support|assistance|emotional[- ]support) (?:animals?|dogs?)\b.{0,30}\b(?:must|need to|have to|will) pay\b|\b(?:service|support|assistance|emotional[- ]support) (?:animals?|dogs?)\s+(?:pay|are charged|get charged)\b/),
  R('invalidnost', 'disability', /\b(minusvalid[oa]s?|invalid[oa]s?|lisiad[oa]s?|retrasad[oa]s?)\b|\bno (?:es|son) (?:apto|adecuado|apta|adecuada)s? para (?:discapacitados|personas con discapacidad|sillas de ruedas|personas mayores)\b/),
  R('zhivotnye', 'disability', /\bno (?:se permiten|aceptamos|permitimos) (?:los )?(?:animales|perros) de (?:servicio|apoyo|asistencia)\b|\b(?:animales|perros) de (?:servicio|apoyo|asistencia)\b.{0,30}\b(?:pagan|deben pagar|tienen que pagar|cuentan como mascotas|no se permiten)\b/),

  // ── источник дохода (ваучеры) ────────────────────────────────────────────
  R('vauchery_otkaz', 'source_of_income', /\b(?:no|don't take|do not take|doesn't take|does not take|don't accept|do not accept|doesn't accept|does not accept|can't accept|cannot accept|can not accept|not accepting|won't accept|will not accept|don't do|do not do|doesn't do|does not do|don't work with|do not work with)\s+(?:any )?(section 8|vouchers?|programs?|cityfheps|fheps|hasa|subsid(?:y|ies)|rental assistance|government assistance|public assistance)\b/),
  R('vauchery_otkaz', 'source_of_income', /\bworking section 8\b|\b(?:voucher|section 8|program) (?:holders|tenants|applicants|people)\s+(?:must|need|needs|have to|has to|should|will need|are required)\b|\bonly (?:accept|take) (?:some|certain|specific) (?:vouchers|programs)\b|\bprefer\w*\b.{0,30}\b(?:working (?:tenants|applicants|people)|employed (?:tenants|applicants)|non[- ]voucher|private[- ]pay|no vouchers?)\b/),
  R('vauchery_otkaz', 'source_of_income', /\b(?:40|forty)\s*(?:x|times)\b.{0,60}\b(?:full|entire|whole|total)\s+rent\b/),
  R('vauchery_otkaz', 'source_of_income', /\bno (?:aceptamos|acepta|aceptan|tomamos|trabajamos con|recibimos)\s+(?:la )?(seccion 8|vales|vouchers?|programas?|cityfheps|hasa|subsidios|asistencia)\b|\bseccion 8 (?:que trabaje|trabajando)\b|\b(?:40|cuarenta) veces\b.{0,60}\b(?:alquiler completo|renta completa|todo el alquiler)\b/),
  R('vauchery_ne_po_shablonu', 'source_of_income', /\b(section 8|section eight|vouchers?|cityfheps|city fheps|fheps|hasa|rental assistance|housing assistance|subsid(?:y|ies|ized))\b/),
  R('vauchery_ne_po_shablonu', 'source_of_income', /\b(seccion 8|seccion ocho|vales|vale de (?:vivienda|alquiler|seccion 8)|voucher|cityfheps|hasa|asistencia de alquiler|asistencia de vivienda|subsidios?)\b/),

  // ── судимость (NYC Fair Chance Housing Law) ──────────────────────────────
  R('sudimost', 'criminal_history', /\bcriminal (?:background|record|records|history|check|checks|screening|convictions?)\b|\b(?:arrest|police) records?\b|\b(arrests?|convictions?|convicted|felony|felonies|felons?|misdemeanou?rs?|jail|prison|parole|probation|sex offenders?|incarcerat\w*)\b/),
  R('sudimost', 'criminal_history', /\bantecedentes (?:penales|criminales|policiales)\b|\b(arrestos?|condenas?|condenad[oa]s?|delitos? graves?|carcel|prision|libertad condicional|delincuentes? sexuales?|record criminal)\b/),

  // ── вопросы о защищённых признаках (скрининг) ────────────────────────────
  R('vopros', 'screening', /\bhow many (?:kids|children|people|persons|adults|occupants|family members)\b|\bwho (?:will|would|is going to) (?:be )?(?:living|live|move in) with you\b|\bare you (?:married|single|pregnant|disabled|a (?:us |u\.s\. )?citizen|employed|working|retired|a student|on (?:section 8|a voucher|disability|ssi|public assistance|welfare)|expecting)\b/),
  R('vopros', 'screening', /\bdo you have (?:any )?(?:kids|children|a (?:voucher|disability|criminal record|record|green card|visa|social security number|guarantor|job)|section 8|an? (?:ssn|itin))\b|\bwhat(?:'s| is) your (?:age|religion|nationality|national origin|ethnicity|race|income|salary|job|occupation|credit score|immigration status|date of birth|disability|diagnosis|condition|medical condition)\b|\bwhat(?:'s| is) (?:the|her|his) (?:disability|diagnosis)\b|\bwhere are you (?:originally )?from\b|\bwhere(?:'s| is) your (?:family|accent) from\b|\bwhat country\b|\bhow old are you\b|\bwhat language do you speak at home\b|\bdo you (?:go to|attend) (?:church|synagogue|mosque|temple)\b|\bhow much do you (?:make|earn)\b/),
  R('vopros', 'screening', /\bcuant[oa]s (?:hijos|ninos|ninas|personas|adultos|familiares)\b|\b(?:esta|es) (?:usted )?(?:casad[oa]|solter[oa]|embarazada|discapacitad[oa]|jubilad[oa]|ciudadan[oa])\b|\btiene (?:usted )?(?:hijos|ninos|un vale|vale|seccion 8|alguna discapacidad|discapacidad|antecedentes|green card|tarjeta verde|visa|numero de seguro social|garante|trabajo)\b|\bcual es su (?:edad|religion|nacionalidad|origen|raza|ingreso|salario|trabajo|ocupacion|puntaje de credito|estatus migratorio|fecha de nacimiento)\b|\bde donde es\b|\bde que pais\b|\bcuantos anos tiene\b|\bque idioma habla en casa\b|\bva a la iglesia\b|\bcuanto gana\b/),

  // ── доход, одобрение, кредит, суд, иммиграция ───────────────────────────
  // «whether you qualify» — нейтрально; нарушение — предсказание исхода: модальный глагол или наречие уверенности.
  R('odobrenie', 'prequalification', /\byou(?:'ll| will| would| should| definitely| probably| likely| easily| surely)\s+(?:definitely |probably |likely |easily |surely )?(qualify|be approved|get approved|get (?:it|the apartment|the place))\b|\byou (?:won't|will not|wouldn't|would not|don't|do not|probably won't|might not) (qualify|be approved|get approved|pass)\b/),
  R('odobrenie', 'prequalification', /(?<!(?:can't|cannot|can not|unable to|not able to|don't|do not|won't|will not|not|never)\s)\b(pre-?qualif\w*|pre-?approv\w*)\b/),
  R('odobrenie', 'prequalification', /\busted (?:si )?(califica|va a calificar|sera aprobad[oa]|lo va a conseguir)\b|\b(?:no califica|no va a calificar|no sera aprobad[oa])\b|(?<!(?:no puedo|no podemos|no se puede|nadie puede)\s)\bprecalific\w*\b/),
  R('kredit', 'credit', /(?<!(?:no|not a|not any|without a|without|there's no|there is no)\s)\b(?:minimum|at least a|at least an|at least)\s+(?:credit score|fico)\b|\bcredit score of (?:at least )?\d{3}\b|\b\d{3}\+? (?:credit score|fico)\b|\b(?:need|require|requires|must have)\b.{0,20}\b(?:good|excellent|great|perfect) credit\b/),
  R('kredit', 'credit', /(?<!(?:no hay un|no hay|sin|no pedimos un|no pedimos|no se requiere un|no se requiere|no se pide un)\s)\b(?:puntaje|puntuacion) (?:de credito )?minim[oa]\b|\bnecesita (?:un )?buen credito\b/),
  R('sud', 'housing_court', /\bdo you have (?:any )?(?:prior |past )?evictions?\b|\b(?:we|they) (?:check|look at|review|screen for|run) (?:for )?(?:evictions?|housing court)\b|\b(?:prior|past) evictions? (?:disqualif\w*|will disqualify|means|are a problem)\b|\bno (?:prior |past )?evictions? (?:allowed|accepted)\b/),
  R('sud', 'housing_court', /\btiene (?:algun )?desalojo\b|\b(?:revisamos|verificamos) (?:los )?(?:desalojos|la corte de vivienda)\b/),
  R('immigraciya', 'immigration', new RegExp(`${NEG}\\b(?:need|require|requires|required to have|must have|must show|bring) (?:an? |your )?(?:social security (?:number|card)|ssn|green card|u\\.?s\\.? passport|proof of (?:citizenship|legal status|immigration status)|(?:a )?valid visa|work visa|american id)\\b`)),
  R('immigraciya', 'immigration', /\b(citizenship|green card|immigration status|legal status|undocumented|illegal (?:aliens?|immigrants?)|visa status|social security (?:number|card))\b/, 'preduprezhdenie'),
  R('immigraciya', 'immigration', /(?<!no\s(?:se\s)?)\b(?:necesita|requiere|debe tener|tiene que traer|traiga) (?:su |un )?(?:numero de seguro social|seguro social|green card|tarjeta verde|pasaporte americano|prueba de (?:ciudadania|estatus legal)|papeles en regla)\b|\bpapeles en regla\b/),

  // ── пол, положение, военные ──────────────────────────────────────────────
  R('pol', 'sex_gender_marital', /\b(?:female|male|women|men|ladies|gentlemen|girls|guys)[- ]only\b|\bonly (?:women|men|females|males|ladies|couples|married couples)\b|\b(?:single|married) (?:women|men|woman|man|mothers?|fathers?|moms?|dads?|couples?) (?:only|preferred)\b|\bsolo (?:mujeres|hombres|parejas|matrimonios|senoritas|caballeros)\b/),
  R('pol', 'sex_gender_marital', /\b(gay|lesbian|straight|transgender|queer)\s+(?:neighbou?rhood|area|community|building|tenants|residents|couples?)\b/),
  R('voennye', 'military', /\bno (?:veterans|military)\b|\b(?:military|veterans?) (?:only|preferred)\b|\b(?:solo|preferimos) (?:veteranos|militares)\b/),

  // ── формулировки, которых нельзя по контракту (не fair housing, но запрет листа правды) ─
  R('garantiya', 'promise', /\bguarantee(?:d|s)?\b|\bgarantiz\w+\b|\bgarantia\b/, 'preduprezhdenie'),
];

function proverit(tekst, { odobrennye = [] } = {}) {
  const ishodnyy = norm(tekst);
  const ostatok = vyrezat(ishodnyy, odobrennye);
  const narusheniya = [];
  const preduprezhdeniya = [];
  const bylo = new Set();
  for (const p of PRAVILA) {
    const m = ostatok.match(p.re);
    if (!m) continue;
    const kluch = `${p.kod}|${m[0]}`;
    if (bylo.has(kluch)) continue;
    bylo.add(kluch);
    const zapis = { kod: p.kod, klass: p.klass, fragment: m[0] };
    (p.tip === 'preduprezhdenie' ? preduprezhdeniya : narusheniya).push(zapis);
  }
  return { ok: narusheniya.length === 0, narusheniya, preduprezhdeniya, ostatok };
}

// Пачка: [{id, tekst}] → [{id, ok, narusheniya, preduprezhdeniya}] — для прогонов и пульта.
function proveritMnogo(spisok, opcii = {}) {
  return (spisok || []).map((x) => Object.assign({ id: x.id }, proverit(x.tekst, opcii)));
}

module.exports = { proverit, proveritMnogo, odobrennyeIz, norm, predlozheniya, PRAVILA, _vnutri: { vyrezat } };
