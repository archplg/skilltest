/**
 * What kind of thing a skill is, and what it is about.
 *
 * A catalog of a hundred thousand skills is unusable without this: "safety" and "quality" tell you whether to trust a
 * skill, not whether it is the one you were looking for. Two independent axes:
 *   type  — the shape of the artifact (a procedure, a reference, a generator, …), exactly one per skill;
 *   topics — the domain it serves (development, data, support, …), up to three.
 *
 * Frontmatter wins where the author stated it (the Hermes dialect carries category and tags); otherwise the label is
 * derived from the name, the description and the headings. Both are cheap, deterministic, and honest about their
 * source, so a listing can say "по нашей разметке" where the author said nothing.
 */

export const SKILL_TYPES = {
  workflow: { ru: 'Процедура', en: 'Procedure', hint: { ru: 'Пошаговый процесс с началом и концом', en: 'A step-by-step process with a beginning and an end' } },
  generator: { ru: 'Генератор', en: 'Generator', hint: { ru: 'Создаёт артефакт: текст, код, документ, план', en: 'Produces an artifact: text, code, a document, a plan' } },
  analyzer: { ru: 'Анализатор', en: 'Analyzer', hint: { ru: 'Проверяет, оценивает, находит проблемы', en: 'Reviews, grades, finds problems' } },
  reference: { ru: 'Справочник', en: 'Reference', hint: { ru: 'Знания и правила, к которым агент обращается', en: 'Knowledge and rules the agent consults' } },
  integration: { ru: 'Интеграция', en: 'Integration', hint: { ru: 'Работа с внешним сервисом или API', en: 'Works against an external service or API' } },
  template: { ru: 'Шаблон', en: 'Template', hint: { ru: 'Заготовка, которую заполняют', en: 'A skeleton to fill in' } },
  persona: { ru: 'Роль и тон', en: 'Persona', hint: { ru: 'Задаёт манеру ответа, а не действия', en: 'Sets the voice rather than the actions' } },
};

export const TOPICS = {
  dev: { ru: 'Разработка', en: 'Software development' },
  devops: { ru: 'Инфраструктура', en: 'Infrastructure' },
  data: { ru: 'Данные и аналитика', en: 'Data and analytics' },
  ai: { ru: 'ИИ и агенты', en: 'AI and agents' },
  security: { ru: 'Безопасность', en: 'Security' },
  docs: { ru: 'Тексты и документы', en: 'Writing and documents' },
  marketing: { ru: 'Маркетинг', en: 'Marketing' },
  sales: { ru: 'Продажи и CRM', en: 'Sales and CRM' },
  ecommerce: { ru: 'Торговля', en: 'Commerce' },
  finance: { ru: 'Финансы', en: 'Finance' },
  legal: { ru: 'Право', en: 'Legal' },
  support: { ru: 'Поддержка клиентов', en: 'Customer support' },
  hr: { ru: 'Люди и найм', en: 'People and hiring' },
  design: { ru: 'Дизайн', en: 'Design' },
  media: { ru: 'Медиа и видео', en: 'Media and video' },
  research: { ru: 'Исследования', en: 'Research' },
  education: { ru: 'Обучение', en: 'Learning' },
  productivity: { ru: 'Личная продуктивность', en: 'Personal productivity' },
  ops: { ru: 'Операции и проекты', en: 'Operations and projects' },
  manufacturing: { ru: 'Производство', en: 'Manufacturing' },
  logistics: { ru: 'Логистика и склад', en: 'Logistics and warehouse' },
  procurement: { ru: 'Закупки и снабжение', en: 'Procurement' },
  quality: { ru: 'Качество и контроль', en: 'Quality control' },
  callcenter: { ru: 'Контакт-центр', en: 'Contact centre' },
  fieldwork: { ru: 'Выездные работы', en: 'Field service' },
};

const TOPIC_RULES = [
  ['dev', /(?<![\p{L}\p{N}_])(?:code|coding|refactor|debug|pull\s*request|typescript|javascript|python|java\b|golang|rust|api\s+client|unit\s+test|compil|repository|git\b|frontend|backend|sql\s+query)\w*|(?<![\p{L}\p{N}_])(?:код|программир|рефактор|отладк|репозитор|фронтенд|бэкенд|тесты\s+кода)/iu],
  ['devops', /(?<![\p{L}\p{N}_])(?:kubernetes|k8s|docker|terraform|ansible|ci\/cd|pipeline|deploy|helm|nginx|aws|gcp|azure|observability|incident|sre|monitoring|infrastructure)\w*|(?<![\p{L}\p{N}_])(?:деплой|инфраструктур|мониторинг|разверт)/iu],
  ['data', /(?<![\p{L}\p{N}_])(?:dataset|dataframe|pandas|etl|warehouse|bigquery|analytics|dashboard|metric|kpi|report(?:ing)?|statistic|regression|forecast|spreadsheet|excel|csv)\w*|(?<![\p{L}\p{N}_])(?:данн|аналитик|дашборд|метрик|отчётност|прогноз|таблиц)/iu],
  ['ai', /(?<![\p{L}\p{N}_])(?:prompt|llm|agent|rag\b|embedding|fine-?tun|model\s+(?:call|output)|claude|gpt|openai|anthropic|token\s+budget|skill\.md|mcp\b)\w*|(?<![\p{L}\p{N}_])(?:промпт|модел[ьи]\s+ии|агент|нейросет)/iu],
  ['security', /(?<![\p{L}\p{N}_])(?:vulnerab|owasp|pentest|threat\s+model|cve\b|encryption|secret\s+scan|malware|phishing|compliance|audit\s+log|zero\s+trust)\w*|(?<![\p{L}\p{N}_])(?:уязвим|безопасн|шифров|фишинг|вредонос|аудит\s+безопас)/iu],
  ['docs', /(?<![\p{L}\p{N}_])(?:blog\s+post|article|copywrit|editing|proofread|summar(?:y|ise|ize)|documentation|readme|changelog|translat|newsletter|essay|note-?taking)\w*|(?<![\p{L}\p{N}_])(?:текст|стать|редактур|коррект|документац|перевод|конспект|резюме\s+текста)/iu],
  ['marketing', /(?<![\p{L}\p{N}_])(?:seo\b|campaign|ad\s+copy|landing\s+page|funnel|brand|social\s+media|instagram|tiktok|audience|positioning|content\s+plan)\w*|(?<![\p{L}\p{N}_])(?:маркетинг|реклам|бренд|воронк|контент-?план|соцсет)/iu],
  ['sales', /(?<![\p{L}\p{N}_])(?:crm\b|sales\s+lead|lead\s+(?:generation|qualification|scoring|nurtur)|prospect|outreach|cold\s+email|pipeline\s+deal|(?:sales|commercial|client)\s+proposal|quota|salesforce|hubspot|negotiat)\w*|(?<![\p{L}\p{N}_])(?:продаж|лид[аы]?|клиентск.{0,12}баз|коммерческое\s+предложен|переговор)/iu],
  ['ecommerce', /(?<![\p{L}\p{N}_])(?:product\s+catalog|catalog\s+(?:item|listing|sku)|sku\b|shopping\s+cart|checkout|inventory\s+(?:management|level|count|turnover|stock)|merchandis|pricing\s+(?:strategy|page|table|tier|rule)|product\s+pricing|marketplace|order\s+(?:status|history)|shipping|refund)\w*|(?<![\p{L}\p{N}_])(?:каталог\s+товар|корзин|склад|ассортимент|ценообразован|маркетплейс|заказ)/iu],
  ['finance', /(?<![\p{L}\p{N}_])(?:invoice|accounting|(?<!token\s)(?<!context\s)budget\s+(?:plan|report|variance|forecast|line|approval)|(?:annual|monthly|quarterly|marketing)\s+budget|p&l|cash\s?flow|tax\b|payroll|valuation|investment\s+portfolio|portfolio\s+(?:return|allocation|risk)|expense\s+(?:report|claim|policy)|reconcil)\w*|(?<![\p{L}\p{N}_])(?:бухгалтер|счёт-?фактур|бюджет|налог|финанс|расход|инвестиц)/iu],
  ['legal', /(?<![\p{L}\p{N}_])(?:contract\s+(?:law|clause|terms?|renewal|negotiation|management|obligation)|(?:sign|execute|terminate|draft|review)\s+(?:a\s+|the\s+)?contract|nda\b|contractual|gdpr|licens(?:e|ing)\s+terms|litigation|regulatory\s+(?:compliance|requirement|filing)|terms\s+of\s+service|privacy\s+policy)\w*|(?<![\p{L}\p{N}_])(?:договор|юридическ|правов|лиценз|регулир|персональн.{0,10}данн)/iu],
  ['support', /(?<![\p{L}\p{N}_])(?:support\s+ticket|helpdesk|customer\s+(?:support|care|service)|sla\b|(?<!privilege\s)(?<!privileges\s)escalation\s+(?:to|path|matrix|policy|procedure)|customer\s+escalation|faq\b|chatbot|complaint)\w*|(?<![\p{L}\p{N}_])(?:обращен|поддержк.{0,12}клиент|тикет|жалоб|служб.{0,8}заботы)/iu],
  ['hr', /(?<![\p{L}\p{N}_])(?:recruit|candidate\s+(?:screening|evaluation|pipeline)|resume\s+(?:screening|review|parsing|builder)|(?:résumés?|resumés?|résumes?)\b|cv\b|interview\s+(?:question|process)|employee\s+onboarding|new\s+hire|performance\s+review|job\s+description|hiring)\w*|(?<![\p{L}\p{N}_])(?:наём|найм|резюме\s+кандидат|собеседован|онбординг|ваканс|кадров)/iu],
  ['design', /(?<![\p{L}\p{N}_])(?:figma|ui\s+design|ux\b|wireframe|typography|colou?r\s+palette|design\s+system|mockup|illustration|logo)\w*|(?<![\p{L}\p{N}_])(?:дизайн|макет|типографик|палитр|иллюстрац|логотип)/iu],
  ['media', /(?<![\p{L}\p{N}_])(?:video|podcast|youtube|subtitle|thumbnail|storyboard|audio\s+edit|screenplay|photo\s+edit)\w*|(?<![\p{L}\p{N}_])(?:видео|подкаст|субтитр|раскадров|монтаж|фотограф)/iu],
  ['research', /(?<![\p{L}\p{N}_])(?:literature\s+review|citation|hypothesis|experiment\s+design|survey\s+data|academic|arxiv|meta-?analysis|methodolog)\w*|(?<![\p{L}\p{N}_])(?:исследован|гипотез|источник.{0,10}литератур|методолог|научн)/iu],
  ['education', /(?<![\p{L}\p{N}_])(?:lesson|curriculum|tutor|flashcard|quiz|study\s+plan|explain\s+like|teaching|course)\w*|(?<![\p{L}\p{N}_])(?:урок|учебн|обучен|курс|карточк.{0,8}для\s+запоминан|объясни\s+прост)/iu],
  ['productivity', /(?<![\p{L}\p{N}_])(?:todo|task\s+list|inbox\s+zero|habit|calendar|meeting\s+notes|journal|pomodoro|personal\s+knowledge)\w*|(?<![\p{L}\p{N}_])(?:задач.{0,6}на\s+день|привычк|календар|заметк|дневник|планировани.{0,10}дня)/iu],
  ['manufacturing', /(?<![\p{L}\p{N}_])(?:manufacturing\s+execution|manufacturing(?!\s+date)|(?<!content\s)(?<!video\s)production\s+line|shop\s?floor|cnc\b|machining|nesting\s+(?:of\s+parts|sheet|layout)|(?<!software\s)bill\s+of\s+materials|mes\s+system|overall\s+equipment\s+effectiveness|oee\s*(?:score|metric|%|\()|assembly\s+(?:line|shop|drawing)|tolerance\s+(?:of|±|\d)|cad\/cam|lathe|welding|production\s+(?:scheduling|order|batch)|(?<!content\s)(?<!video\s)production\s+planning|\bp?fmea\b|apqp|ppap|takt\s+time|just-?in-?time\s+(?:manufactur|production|inventory|delivery)|\bmfg\b|gerbers?|pcb\s+(?:fabrication|assembly|manufactur)|\bgmp\b|cleanroom\s+(?:class|grade|garment|gowning|iso)|洁净室|factory\s+(?:guide|directory|audit|tour|visit))\w*|(?<![\p{L}\p{N}_])(?:производств|цех|станок|станк|чпу|раскро|номенклатур|наряд-?заказ|сборочн|литьё|сварк|токарн|фрезер)|(?:生产车间|加工车间|装配车间|分割车间|车间管理|车间巡检|车间现场|车间主任|数控机床|数控加工)/iu],
  ['logistics', /(?<![\p{L}\p{N}_])(?:^(?!travel|trip|family|wedding|event|party|school|funeral|move|moving|baby|newborn)[\p{L}\p{N}_-]*logistics|(?:reverse|freight|inbound|outbound|multimodal|third[\s-]party|3pl|e-?commerce|supply[\s-]chain|cold[\s-]chain|transport|shipping|warehouse|cross-border|international|returns?)[\s-]logistics|logistics[\s-](?:provider|company|partner|network|operation|manager|coordinator|exception|tracking|tracker|cost|optimiz|planning|professional|industry|hub|chain|kpi|audit|data|platform)|warehouse\s+(?:management|operations|picking|stock|inventory)|freight|shipment|(?:driver|truck|vehicle|courier|order|shipment)\s+dispatch|dispatch\s+(?:a\s+)?(?:driver|truck|vehicle|courier|order)|(?:vehicles?|trucks?|vans?|drivers?|cars?|buses|transport|delivery)(?![\p{L}])[^.]{0,40}fleet\s+(?:management|operations|maintenance|utili[sz]ation|compliance|dispatch|safety)|fleet\s+(?:management|operations|maintenance|utili[sz]ation|compliance|dispatch|safety)[^.]{0,40}(?:vehicles?|trucks?|vans?|drivers?|cars?|buses|transport|delivery)(?![\p{L}])|motor[\s-]carrier|shipping\s+label|label\s+generation|multi-?carrier|rate\s+shopping|(?:delivery|freight|truck|courier)\s+rout|rout\w*\s+for\s+(?:delivery|freight|trucks?)|last[\s-]mile\s+(?:delivery|logistics|courier|carrier|shipping|fulfil)|third[\s-]party\s+logistics|3pl\s+(?:provider|partner|warehouse|vendor|contract|rate)|wms\b|palletiz|pallet\s+(?:jack|rack|load|position|truck|count)|(?:euro|wooden|shipping|full|per)\s+pallet|waybill|customs\s+(?:clearance|declaration|broker))\w*|(?<![\p{L}\p{N}_])(?:логистик|склад|отгрузк|перевозк|(?<!авиа)(?<!внутренн\p{L}{0,3}\s)рейс|маршрутн|путев.{0,4}лист|(?:товарн|транспортн|расходн|приходн)\p{L}*\s+накладн|ттн|таможн|паллет|экспедит)|(?<!、)(?:物流|快递|叉车|仓储|出入库|货位)/iu],
  ['procurement', /(?<![\p{L}\p{N}_])(?:procurement|purchase\s+order|supplier\s+(?:selection|scorecard|evaluation|qualification|management|onboarding|performance|audit)|(?:approved|preferred|shortlisted)\s+supplier|vendor\s+(?:selection|scorecard)|rfp\b|rfq\b|tenders\b|tendering|invitation\s+to\s+tender|(?:bid|public|government|open|competitive)[\s-]tender|tender[\s-](?:process|document|package|notice|submission|evaluation|opportunit|search|sourcing|data|bid|quick|express|miner|radar|board|portal)|(?<!talent\s)(?<!candidate\s)strategic\s+sourcing|(?:supplier\s+sourcing|sourcing\s+(?:of\s+)?suppliers?|sourcing\s+(?:guide|agent)|suppliers?\s+(?:guide|directory))|three-?way\s+match)\w*|(?<![\p{L}\p{N}_])(?:закупк|снабжен|поставщик|тендер|котировк|заявка\s+на\s+закупку|договор\s+поставк)|(?<!、)(?:招标|投标|招投标|(?:政府|国企|央企|集中|招标|非招标|物资|设备|跨境|海外|企业|医院|校园)采购|采购(?:单位|意向|寻源|管理|订单|方式|需求|评审|公告|合同|申请|流程|法|文件|代理|中心|部门|计划|策略|谈判|价格|成本|渠道|与招标)|供应商(?:管理|评估|考核|寻源|准入|审核|报价|筛选|背调|资质|对比|名单|档案|开发|关系))/iu],
  ['quality', /(?<![\p{L}\p{N}_])(?:quality\s+management\s+system|factory\s+acceptance\s+test|statistical\s+process\s+control|quality\s+control[^.]{0,45}(?:product|goods|part|material|supplier|production|manufactur|defect|inspect)|(?:products?|goods|parts|material|supplier|production|manufactur|incoming|factory)[^.]{0,45}quality\s+control|\bqms\b|non-?conformit|non-?conformance|defect\s+rate|iso\s?9001|capa\b|six\s+sigma|incoming\s+inspection)\w*|(?<![\p{L}\p{N}_])(?:отк(?![\p{L}])|контрол.{0,8}качеств|несоответстви|бракованн|производственн\p{L}*\s+брак(?![\p{L}])|дефектн|рекламац|корректирующ.{0,10}действ)|(?:来料检验|成品检验|质量管理体系|不合格品)/iu],
  ['callcenter', /(?<![\p{L}\p{N}_])(?:call\s?cent|contact\s?cent|ivr[\s-]?(?:menu|flow|tree|prompt|deflection)|phone\s+tree|\baht\b|first\s+call\s+resolution|call\s+queue)\w*|(?<![\p{L}\p{N}_])(?:колл-?центр|контакт-?центр|оператор.{0,10}лини|скрипт.{0,10}разговор|очеред.{0,8}звонк|ivr[\s-]?меню)|(?:呼叫中心|客服热线)/iu],
  ['fieldwork', /(?<![\p{L}\p{N}_])(?:field\s+service|permit\s+to\s+work|hot\s+work\s+permit|site\s+(?:visit|survey)|technician\s+dispatch|maintenance\s+order|shift\s+handover)\w*|(?<![\p{L}\p{N}_])(?:выездн|наряд-?допуск|обход\s+объект|техобслуживан|смена\s+бригад|вахт)/iu],
  ['ops', /(?<![\p{L}\p{N}_])(?:project\s+(?:plan|manage)|roadmap|sprint|backlog|jira|okr\b|stakeholder|status\s+update|retrospective|process\s+improvement)\w*|(?<![\p{L}\p{N}_])(?:проектн.{0,10}управлен|дорожн.{0,8}карт|спринт|бэклог|стейкхолдер|ретроспектив)/iu],
];

const TYPE_RULES = [
  ['integration', {
    head: /(?<![\p{L}\p{N}_])(?:api\b|cli\b|integrat|connect(?:s|ing)?\s+to|interact\s+with|work\s+with\s+[A-Z]|webhook|oauth|sdk\b|gateway|client\s+for|wrapper\s+for|automate\s+\w+\s+(?:via|through))|(?<![\p{L}\p{N}_])(?:интеграц|подключ|через\s+api|клиент\s+для)/iu,
    body: /(?<![\p{L}\p{N}_])(?:api\s+(?:key|endpoint|call|token)|rest\s+api|graphql|webhook|oauth|base_?url|curl\s+-|authorization:\s*bearer)/iu,
  }],
  ['analyzer', {
    head: /(?<![\p{L}\p{N}_])(?:review|audit|analyz|analys|evaluat|assess|lint|critique|validat|verif|detect|vetting|diagnos|find\s+(?:issues|problems|bugs))|(?<![\p{L}\p{N}_])(?:провер|разбор|аудит|оцен|анализ|валидац|диагност)/iu,
    body: /(?<![\p{L}\p{N}_])(?:findings?|severity|issues?\s+found|report\s+the\s+problems)/iu,
  }],
  ['generator', {
    head: /(?<![\p{L}\p{N}_])(?:generat|creat(?:e|es|ing)|writ(?:e|es|ing)|draft|compos|produc(?:e|es|ing)|build(?:s|ing)?\b|mak(?:e|es|ing)|edit(?:s|ing)?\b|convert|transform|render)|(?<![\p{L}\p{N}_])(?:сгенерир|создай|созда(?:ёт|ние)|напиш|составь|сформируй|подготов|преобразу)/iu,
    body: /(?<![\p{L}\p{N}_])(?:output\s+(?:the|a)\s+\w+|save\s+the\s+file|write\s+the\s+result)/iu,
  }],
  ['persona', {
    head: /(?<![\p{L}\p{N}_])(?:you\s+are\s+an?\s+\w+|act\s+as\s+an?\s+\w+|tone\s+of\s+voice|persona\b|speak\s+like|in\s+the\s+voice\s+of|writing\s+style\s+of)|(?<![\p{L}\p{N}_])(?:ты\s+—\s*\w+|веди\s+себя\s+как|тон\s+общения|манера\s+речи)/iu,
    body: /(?<![\p{L}\p{N}_])(?:tone\s+of\s+voice|never\s+say|speak\s+in\s+the\s+first\s+person)/iu,
  }],
  ['template', {
    head: /(?<![\p{L}\p{N}_])(?:template|boilerplate|skeleton|scaffold|starter\s+kit|checklist)|(?<![\p{L}\p{N}_])(?:шаблон|заготовк|болванк|чек-?лист)/iu,
    body: /(?<![\p{L}\p{N}_])(?:fill\s+in\s+the\s+blanks|placeholder\s+for|\{\{\s*\w+\s*\}\})/iu,
  }],
  ['reference', {
    head: /(?<![\p{L}\p{N}_])(?:reference|cheat\s?sheet|glossary|guidelines?|conventions?|standards?|rules\s+for|knowledge\s+base|handbook|documentation\s+of)|(?<![\p{L}\p{N}_])(?:справочник|шпаргалк|глоссар|правила\s+|стандарт|конвенц|база\s+знан)/iu,
    body: /(?<![\p{L}\p{N}_])(?:see\s+the\s+table\s+below|the\s+following\s+conventions)/iu,
  }],
  ['workflow', {
    head: /(?<![\p{L}\p{N}_])(?:workflow|process\b|procedure|pipeline|step-?by-?step|playbook|runbook|how\s+to\b)|(?<![\p{L}\p{N}_])(?:процедур|пошагов|регламент|процесс\b|инструкц)/iu,
    body: /(?<![\p{L}\p{N}_])(?:step\s+\d|first,\s|then,\s|finally,\s)/iu,
  }],
];

import { detectApps } from './apps.js';

/** Topics that describe an industry rather than a craft: these need evidence in the title, not in passing. */
export const INDUSTRY_TOPICS = new Set(['manufacturing', 'logistics', 'procurement', 'quality', 'callcenter', 'fieldwork']);

const ILLUSTRATION_RE = /(?:e\.g\.|i\.e\.|such as|for example|例如|比如|诸如)[^.。;；)）]{0,60}$/i;
// The term standing alone between two separators — "Zoom MCP, Phone, Contact Center" — is an item in a list of
// what a product covers. A term with its own words around it is a phrase the author wrote on purpose.
const ITEM_BEFORE_RE = /(?:[,/|]|,\s*(?:and|or))\s*$/i;
const ITEM_AFTER_RE = /^\s*(?:[,/|).;]|$)/i;
const RULED_OUT_RE = /(?:not for|excluding|except for|rather than|do not use|不用于|不包含|不含|不支持|不适用|不处理|独立于)[^.。;；]{0,28}$/i;

/**
 * The words each trade shares with ordinary business English. Every ERP connector lists Manufacturing among its
 * modules, every consultant has a vendor, every project has its logistics. On its own such a word is not a claim.
 */
const WEAK_TERM = {
  manufacturing: /^(?:manufacturing|production\s+lines?|assembly\s+(?:lines?|shops?|drawings?)|производств\p{L}*)$/iu,
  logistics: /^(?:logistics|logistics[\s-]planning|warehouse\s+(?:stock|inventory)|inventory\s+\w+)$/iu,
  procurement: /^(?:procurement|suppliers?\s+(?:performance|management|onboarding)|vendors?\s+(?:selections?|scorecards?)|sourcing\s+strategy)$/iu,
};

/**
 * Does the author claim this industry, or only mention it? An example ("e.g., manufacturing tolerances") and a
 * phrase the author rules out ("不用于物流索赔") are not claims. Neither is a word the trade shares with
 * everyone else — unless the skill is named after it, or a word of the trade's own stands beside it.
 */
// Recompiling the same twenty patterns for every skill in the catalog is most of the cost of classifying one.
const reCache = new Map();
const compiled = (source, flags) => {
  const key = `${flags}\u0000${source}`;
  let re = reCache.get(key);
  if (!re) { re = new RegExp(source, flags); reCache.set(key, re); }
  return re;
};

function claimsTopic(title, name, id, re) {
  const weak = WEAK_TERM[id];
  const named = compiled(re.source, 'iu').test(name || '');
  for (const m of title.matchAll(compiled(re.source, 'giu'))) {
    const before = title.slice(Math.max(0, m.index - 45), m.index);
    const after = title.slice(m.index + m[0].length, m.index + m[0].length + 12);
    if (ILLUSTRATION_RE.test(before) || RULED_OUT_RE.test(before)) continue;
    if (ITEM_BEFORE_RE.test(before) && ITEM_AFTER_RE.test(after)) continue;
    if (named || !weak || !weak.test(m[0])) return true;
  }
  return false;
}

/**
 * Subjects that borrow a trade's vocabulary wholesale. A trip has logistics, a wedding has vendors, an e-commerce
 * support script talks about delayed parcels all day long, and none of them is a skill for that industry.
 */
const TOPIC_VETO = {
  logistics: /(?:plan|planning|planner|itinerar\w*|book\w*|guide)[^.]{0,40}(?<![\p{L}\p{N}_])(?:trips?|travel|vacation)(?![\p{L}\p{N}_])|(?<![\p{L}\p{N}_])(?:trips?|travel|vacation)(?![\p{L}\p{N}_])[^.]{0,40}(?:plan|planner|planning|itinerar\w*|guide)|(?<![\p{L}\p{N}_])(?:tourist\w*|honeymoon|newborn|new-?baby|new-?parent)(?![\p{L}\p{N}_])|售后客服|电商客服|客服规范|投诉维权|消费维权|冰箱|菜谱|食材|保洁|二手助手|买二手|卖二手|闲置|回收估价|二手行情/iu,
  procurement: /(?<![\p{L}\p{N}_])(?:wedding|grocer\w*|nutrition|perler|crypto\w*|orderbook|swaps?|parlay|polymarket|finra|best\s+execution|prediction\s+market)(?![\p{L}\p{N}_])|拼豆|家庭营养|菜单/iu,
  callcenter: /(?<![\p{L}\p{N}_])(?:transcription|transcribes?|speech-to-text|text-to-speech|\bstt\b|\basr\b|subtitles?|live\s+captions?)(?![\p{L}\p{N}_])|navigate[^.]{0,24}(?:phone\s+trees?|ivr)/iu,
  quality: /(?<![\p{L}\p{N}_])(?:ai\s+act|ai\s+management\s+system|aims\b|iso\/?iec\s*42001)(?![\p{L}\p{N}_])/iu,
};

const HEAD_RE = /^#{1,3}\s+(.+)$/gm;
const STEP_RE = /^\s{0,3}(?:\d{1,3}[.)]\s+|[-*+]\s+(?:\[[ xX]\]\s*)?)\S/gm;

function textOf(skill) {
  const body = String(skill.body || '');
  const heads = [...body.matchAll(HEAD_RE)].map((m) => m[1]).join(' ');
  return `${skill.name || ''} ${skill.description || ''} ${skill.whenToUse || ''} ${heads}`;
}

/**
 * @param {object} skill loadSkill() result
 * @returns {{ type: string, typeFrom: 'frontmatter'|'rules', topics: string[], topicsFrom: 'frontmatter'|'rules'|'none' }}
 */
export function classifySkill(skill) {
  const head = textOf(skill);
  // What the author put on the label, as opposed to anything a section heading happens to mention.
  const title = `${skill.name || ''} ${skill.description || ''} ${skill.whenToUse || ''}`;
  const body = String(skill.body || '');
  const full = `${head} ${body}`;

  // Topics: the author's own tags win when they map onto our list.
  const fm = skill.frontmatter || {};
  const stated = [fm.category, ...(Array.isArray(fm.tags) ? fm.tags : String(fm.tags || '').split(/[,;]/))]
    .map((t) => String(t || '').trim().toLowerCase()).filter(Boolean);
  const mapped = [...new Set(stated.map((t) => (TOPICS[t] ? t : Object.keys(TOPICS).find((k) => t.includes(k) || String(TOPICS[k].en).toLowerCase().includes(t)))).filter(Boolean))];

  let topics = mapped.slice(0, 3);
  let topicsFrom = topics.length ? 'frontmatter' : 'none';
  if (!topics.length) {
    // What the author calls the skill counts for more than what the body happens to mention in passing.
    const scored = TOPIC_RULES.map(([id, re]) => {
      // An industry is a claim about what the skill serves, so the author has to make it on the label — and mean
      // it. A mention buried in the body put guitar catalogues into manufacturing; a "## Logistics" heading did the
      // same for a game-night planner; an ERP's module list did it for every ERP connector in the catalog.
      // Settling that first also spares the body scan for every skill that makes no such claim, which is most.
      if (INDUSTRY_TOPICS.has(id) && (!claimsTopic(title, skill.name, id, re) || TOPIC_VETO[id]?.test(title))) return { id, score: 0 };
      const inHead = (head.match(compiled(re.source, 'giu')) || []).length;
      const inBody = (body.match(compiled(re.source, 'giu')) || []).length;
      return { id, score: inHead * 5 + Math.min(inBody, 3) };
    }).filter((x) => x.score > 0).sort((a, b) => b.score - a.score);
    // An industry label is the rarer and more useful of the two kinds — and the harder-won, since the trade word
    // only appears when the author meant it — so it is never dropped for scoring below a generic business topic.
    const strongest = scored[0]?.score || 0;
    const trade = scored.filter((x) => INDUSTRY_TOPICS.has(x.id));
    const generic = scored.filter((x) => !INDUSTRY_TOPICS.has(x.id) && x.score >= strongest / 2);
    topics = [...trade, ...generic].slice(0, 3).map((x) => x.id);
    topicsFrom = topics.length ? 'rules' : 'none';
  }

  // Type: exactly one label, chosen by weight rather than by the order of the rules. The name and the description
  // say what the author built; the body only mentions what the steps happen to touch, so it counts for far less.
  const steps = (body.match(STEP_RE) || []).length;
  // The opening of the description is the author's own answer to "what does it do"; the rest is context.
  const lead = `${skill.name || ''} ${String(skill.description || '').split(/[.;:]/)[0]}`.split(/\s+/).slice(0, 12).join(' ');
  const typeScores = TYPE_RULES.map(([id, re]) => {
    let score = 0;
    if (re.head.test(lead)) score += 8;
    else if (re.head.test(title)) score += 3;
    if (re.head.test(head) && !re.head.test(title)) score += 2;   // only in a heading
    if (re.body.test(body)) score += 1;
    if (id === 'workflow' && steps >= 5) score += 2;
    if (id === 'reference' && steps === 0 && (skill.bodyTokens || 0) > 600) score += 1;
    return { id, score };
  }).sort((a, b) => b.score - a.score);
  const best = typeScores[0];
  const type = best.score >= 3 ? best.id : (steps >= 3 ? 'workflow' : 'reference');
  const typeConfident = best.score >= 8;

  return { type, typeFrom: typeConfident ? 'rules' : 'weak', topics, topicsFrom, apps: detectApps(skill) };
}

export function typeLabel(id, lang) { const t = SKILL_TYPES[id]; return t ? (lang === 'ru' ? t.ru : t.en) : id; }
export function topicLabel(id, lang) { const t = TOPICS[id]; return t ? (lang === 'ru' ? t.ru : t.en) : id; }
