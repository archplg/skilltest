import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifySkill, INDUSTRY_TOPICS } from '../src/taxonomy.js';

/**
 * Industry labels are a promise to a buyer: "show me everything for a plant" must not return a guitar catalogue.
 * Every case below is a real skill from the catalog (or a close paraphrase) that was once labelled wrongly, with the
 * word that did it. They stay here so the mistake cannot come back quietly.
 */
const mk = (name, description, body = '') => ({ name, description, body, files: [], frontmatter: {}, bodyTokens: 200 });
const industryOf = (skill) => classifySkill(skill).topics.filter((t) => INDUSTRY_TOPICS.has(t));

const MUST_NOT = [
  ['BOM = byte order mark', mk('utf8-tools', 'Strip the BOM from files and normalise encodings')],
  ['supplier = a DDD team relationship', mk('domain-driven-design', 'Bounded contexts, aggregates and the Customer/Supplier relationship between teams')],
  ['root cause = debugging', mk('systematic-debugging', 'Find the root cause of a bug with a systematic protocol')],
  ['root cause = a postmortem', mk('incident-postmortem', 'Write a blameless postmortem with root cause analysis')],
  ['work permit = immigration', mk('immigration-checklist', 'Checklist of documents for a work permit application')],
  ['warehouse = data warehouse', mk('cdo-review', 'Review the data warehouse strategy of a CDO')],
  ['dispatch = opcode dispatch', mk('dsl-vm-reverse', 'Reverse a custom DSL/VM interpreter: identify switch-based opcode dispatch')],
  ['assembly = assembly language', mk('asm-primer', 'Assembly language basics and fault tolerance patterns')],
  ['sourcing = open sourcing', mk('oss-guide', 'Guide to open sourcing a library')],
  ['OEE = a brand prefix', mk('oee-content-humanizer', 'Make AI text sound human for the OEE content team')],
  ['travel logistics is not freight', mk('travel-manager', 'Comprehensive travel planning, booking and travel logistics')],
  ['transit routing is not delivery', mk('seoul-subway', 'Seoul subway assistant with real-time arrivals and route planning')],
  ['a body mention is not a claim', mk('fender-guitars', 'Look up guitar models and specifications', 'The factory manufacturing line produced this in 1962. assembly line.')],
  ['manufacturing date is not a plant', mk('apple-serial', 'Look up Apple device information from a serial number including manufacturing date')],
  ['agent script = Agentforce', mk('sf-ai-agentscript', 'Agent Script DSL for deterministic Agentforce agents')],
  ['a call script is not a call centre', mk('call-script-coach', 'Use before any difficult phone call — write the call script you are anxious about')],
  ['omnichannel = marketing', mk('integrated-marketing', 'Plan integrated omnichannel marketing across paid, owned and earned')],
  ['CSAT = an NPS survey', mk('csat-nps-analysis', 'Analyse CSAT / NPS / CES survey results and turn the score into actions')],
  ['IVR in a telephony SDK', mk('twilio', 'Add SMS, voice calls and WhatsApp with Twilio — an IVR system, recordings and numbers')],
  ['quality control of code', mk('code-qc', 'Run a structured quality control audit on any codebase')],
  ['quality control of images', mk('img-optimizer', 'Compress, resize and convert images with ImageMagick — batch process with quality control')],
  ['a home inspection report', mk('home-inspection-decoder', 'Make sense of a home-inspection report before you buy the house')],
  ['a database health inspection', mk('polardb-inspection', 'Health inspection report for Alibaba Cloud PolarDB MySQL instances')],
  ['work order = 工单 = support ticket', mk('qianwen-support', 'Create, track and manage support tickets (work orders) for QianWen')],
  ['3PL = the 3-parameter logistic model', mk('adaptive-testing', 'Design adaptive testing with Item Response Theory — 1PL, 2PL and 3PL models')],
  ['pallet = a Substrate module', mk('substrate-scanner', 'Scans Substrate/Polkadot pallets for 7 critical vulnerability classes')],
  ['fleet = a collector fleet', mk('alloy', 'Install, configure and manage Grafana Alloy collector fleet management')],
  ['SBOM is not a BOM', mk('sbom-generator', 'Generate a Software Bill of Materials (SBOM) in CycloneDX or SPDX format')],
  ['a content production line', mk('batch-content-factory', 'Multi-platform content production line that automates the whole pipeline')],
  ['tender = gentle', mk('the-year-of-firsts', 'Get through the first year after losing someone — the tender days and the ordinary ones')],
  ['tender offer = corporate finance', mk('corporate-actions', 'Process corporate actions from announcement through tender offer settlement')],
  ['talent sourcing is not procurement', mk('sourcing-strategy', 'Build a talent sourcing strategy for a hard-to-fill role')],
  ['авиарейсы — не грузовые рейсы', mk('china-flight-booking', 'Поиск авиабилетов в Китай и внутренних рейсов с ценами в реальном времени')],
  ['仓库 = a git repository', mk('repo-analyzer', '分析项目、分析仓库、分析 GitHub 源码，输出结构化报告')],
  ['质检 = proofreading a manuscript', mk('novel-writing-sop', '中文网文全流程写作引擎：选题、大纲、分章正文、去AI味、双视角质检')],
  ['a section heading is not a claim', mk('game-night-planner', 'Plan a game night that works for the people coming', '## Logistics\n\nWho brings what.\n')],
  ['a section heading is not a claim, 2', mk('sop-writer', 'Write a Standard Operating Procedure for any operational task', '## Quality control\n\nCheck the draft.\n')],
  ['the logistics of a hard conversation', mk('euthanasia-conversation', 'Guide a veterinary team through an end-of-life conversation, including the logistics')],
  ['household logistics', mk('family-os', 'Build a privacy-preserving household information system — family logistics and routines')],
  ['采购 in a shopping assistant', mk('shopify-buy2', '购物助手：在 Shopify 上挑选商品并下单，采购日常用品')],
  ['物流 as one department in a list', mk('zayn-request', '向采购、工程、财务、物流等内部角色提出背景充分、问题具体、截止时间明确的可执行请求')],
  ['仓储 as one fee among many', mk('linkfox-profit', '亚马逊商品利润核算专家。适用于核算 FBA 费用、头程到岸成本、佣金、仓储或弃置费用、广告假设')],
  ['an ERP module list', mk('odoo', 'Full-featured Odoo 17/18/19 ERP connector — Sales, CRM, Purchase, Inventory, Projects, HR, Fleet, Manufacturing (80+ operations)')],
  ['an office-chore list', mk('government', 'Use for government and public sector workflows — formal documents, meeting minutes, reporting, procurement, compliance')],
  ['a product list', mk('plan-zoom-product', 'Choose the right Zoom building surface: REST API, Webhooks, Meeting SDK, Video SDK, Zoom MCP, Phone, Contact Center')],
  ['kinds of engineer', mk('find-engineering-firm', 'Find and vet US engineering firms — civil, structural, MEP, mechanical, geotechnical, transportation, and manufacturing')],
  ['an illustration in brackets', mk('power-law-distribution', 'Use when a distribution is demonstrably Gaussian (e.g., manufacturing tolerances under statistical process control)')],
  ['ruled out in so many words', mk('gov-entity-admin', '政府、企事业单位通用行政辅助。本技能独立于招投标、政府采购等专业方向，仅做通用行政文书起草')],
  ['ruled out again', mk('amazon-packaging-improvement', '从 Amazon 评论中提炼包装改进任务与证据。仅用于包装问题分析；不用于物流索赔、供应商下单或库存执行')],
  ['采购商 is the buyer, and finding them is selling', mk('ora-customs', '海关数据分析专家：全球海关数据查询，国外采购商平台，找国外客户，国外采购商订单')],
  ['库存管理 in a fridge app', mk('bigfood', 'AI冰箱管家 — 拍食材图片识别，智能推荐菜谱，冰箱食材管理、采购提醒、冰箱库存管理')],
  ['专车间 is 专车 plus 间', mk('didi', '滴滴出行决策助手：按预算/时段/人数在快车/特惠/拼车/专车间选型并估算费用区间')],
  ['a warehouse club is not a warehouse', mk('costco-research', 'Researches Costco products, categories, warehouse stock/availability and reviews')],
  ['logistics planning in a travel planner', mk('travel-planner', 'Travel destination research and daily itinerary creation with logistics planning and budget tracking')],
  ['a cleanroom that is an AWS service', mk('aws-cleanrooms', 'Troubleshoots and debugs AWS Clean Rooms collaborations, memberships and configured tables')],
  ['a production run of a program', mk('flow-swarm', 'Proven on 7 consecutive production runs generating 430+ tests across a 50K+ line Elixir codebase')],
  ['video production planning', mk('tcm-video-factory', 'Automate health video production planning: topic research, script, character, image')],
  ['just-in-time compilation', mk('jits-builder', 'JITS Builder — a Just-In-Time Software Builder that compiles modules on demand')],
  ['仓库 is also a git repository', mk('github-helper', 'GitHub 助手：仓库管理、分支与 PR 操作、代码搜索与提交记录查询')],
  ['transcribing a call centre is speech tech', mk('gladia-live', 'Real-time speech-to-text streaming: live transcription, meeting recorder, call center integration, subtitles')],
  ['navigating someone else’s phone tree', mk('supercall', 'Make AI phone calls: confirm appointments, deliver messages, navigate phone trees, handle conversations')],
  ['an AI management system is not product quality', mk('iso42001-specialist', 'ISO/IEC 42001 AI Management System specialist — fitting AI systems into an existing ISMS (27001) / QMS (13485) program')],
];

const MUST = [
  ['manufacturing', mk('production-scheduling', 'Production scheduling and job sequencing for a manufacturing plant with OEE score tracking')],
  ['manufacturing', mk('cnc-nesting', 'Раскрой листового металла и карта раскроя для станка ЧПУ')],
  ['logistics', mk('freight-router', 'Plan the delivery route for a truck fleet and print waybills')],
  ['logistics', mk('wms', 'Warehouse management: picking, pallets and waybills')],
  ['procurement', mk('rfp-responder', 'Respond to an RFP and build the vendor scorecard')],
  ['procurement', mk('three-way', 'Сверить счёт, заказ на закупку и акт приёмки')],
  ['quality', mk('qms-audit', 'ISO 13485 QMS internal audit and CAPA management')],
  ['quality', mk('otk', 'Оформить акт о несоответствии по результатам контроля ОТК')],
  ['callcenter', mk('call-qa', 'Score a contact centre call against the checklist and compute CSAT')],
  ['callcenter', mk('ivr-voice-pack', 'Build a labeled IVR voice pack for a phone tree: welcome, menu, hold')],
  ['fieldwork', mk('permit', 'Наряд-допуск на огневые работы и проверка готовности участка')],
  ['quality', mk('fat-report', 'Write a factory acceptance test (FAT) plan or report for the machine')],
  ['quality', mk('erpclaw-quality', 'Quality inspection, non-conformance tracking and quality goals')],
  ['logistics', mk('3pl-evaluator', 'Systematically evaluate and compare third-party logistics (3PL) providers')],
  ['logistics', mk('iaiops-warehouse', 'Warehouse edition — distribution centre conveyors, palletizers and sorters')],
  ['procurement', mk('tender-search', '全网招中标数据查询与分析助手：查询招标/中标公告、搜索标讯、商机预测')],
  ['logistics', mk('cn-express-tracker', '中国快递物流查询工具，查询顺丰、圆通、中通、韵达的物流信息')],
  ['manufacturing', mk('pork-cutting-spec', '依据 GB/T 40466-2021 标准提供猪肉分割技术指导，覆盖分割车间基本要求')],
  ['callcenter', mk('ai-call-center', '呼叫中心，来电管理 + 智能分配')],
  ['logistics', mk('logistics-tracking', 'Track international packages by tracking number across 3100+ carriers')],
  ['logistics', mk('returns-reverse', 'Optimise the e-commerce returns process — reverse logistics and restocking')],
  ['procurement', mk('gq-procurement-advisor', '国企采购合规实务助手：采购方式选择、招标文件审查、采购风险评估')],
  ['manufacturing', mk('mes', 'Manufacturing execution system tracker')],
  ['manufacturing', mk('jlcpcb', 'JLCPCB PCB fabrication and assembly — BOM/CPL generation, design rules, ordering workflow')],
  ['manufacturing', mk('iaiops-pharma', 'Pharmaceutical edition of iaiops — GMP drug plants, cleanroom BMS and EMS')],
  ['manufacturing', mk('china-lighting-factory', "Comprehensive lighting industry factory guide for international buyers — China's LED and outdoor lighting")],
  ['procurement', mk('china-beauty-sourcing', "Comprehensive beauty industry sourcing guide for international buyers — China's skincare and cosmetics")],
  ['logistics', mk('shippo-official', 'Ship packages with Shippo. Multi-carrier rate shopping, label generation, tracking, customs declarations')],
  ['logistics', mk('openclaw-skill-customs', '海关报关单据处理助手。当用户提到报关、海关、customs declaration、invoice、packing list、HS 编码时使用')],
  ['logistics', mk('dqf-audit', 'Use when a motor-carrier safety director or DOT compliance manager needs a Driver Qualification File review')],
  ['logistics', mk('trip-fuel', 'Сверить рейс с транспортным заказом и топливной картой: путевые листы, расход, перерасход')],
  ['logistics', mk('forklift-expert', '叉车(工业车辆)领域专家技能。覆盖品牌、参数、液压、电池、选型、维修、二手评估、国标/ISO 法规')],
];

test('taxonomy: words from other trades do not earn an industry label', () => {
  const wrong = MUST_NOT.filter(([, skill]) => industryOf(skill).length);
  const detail = wrong.map(([why, skill]) => `${skill.name} (${why}) → ${industryOf(skill).join(', ')}`).join('; ');
  assert.equal(wrong.length, 0, `mislabelled: ${detail}`);
});

test('taxonomy: a skill that really serves an industry gets its label', () => {
  const missed = MUST.filter(([topic, skill]) => !industryOf(skill).includes(topic));
  const detail = missed.map(([topic, skill]) => `${skill.name} should be ${topic}, got ${industryOf(skill).join(', ') || 'none'}`).join('; ');
  assert.equal(missed.length, 0, `missed: ${detail}`);
});

test('taxonomy: business topics keep their software namesakes out', () => {
  const cases = [
    ['legal', mk('sql-helper', 'Write a WHERE clause and optimise the query plan')],
    ['finance', mk('token-budget', 'Keep the agent inside its token budget and trim the context')],
    ['support', mk('privesc', 'Detect privilege escalation paths in a Linux host')],
    ['hr', mk('resume-task', 'Resume a long-running task after a restart')],
    ['hr', mk('user-onboarding', 'Design a user onboarding flow for a mobile app')],
    ['ecommerce', mk('data-catalog', 'Build a data catalog for the analytics team')],
    ['finance', mk('portfolio-site', 'Build a designer portfolio website')],
  ];
  const wrong = cases.filter(([topic, skill]) => classifySkill(skill).topics.includes(topic));
  assert.equal(wrong.length, 0, `mislabelled: ${wrong.map(([t, s]) => `${s.name} → ${t}`).join('; ')}`);
});
