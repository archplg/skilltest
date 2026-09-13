/**
 * Process maturity: will this skill actually run to the end, and is it shaped for production use.
 *
 * Guard answers "will it harm", lint and craft signals answer "is it written decently", a live run answers "does it
 * help the model". None of them answers the installer's real question: does the process finish. This module is the
 * free, deterministic layer of that answer — ten parameters from docs/PROCESS-CHECK.ru.md plus the code-measurable
 * half of the business axes from docs/BUSINESS-REVIEW.ru.md. Everything here is countable; judgement stays for the
 * paid review, so a finding from this module is a fact, not an opinion.
 */

const FENCE_RE = /```[\s\S]*?```/g;
const HEAD_RE = /^#{1,4}\s+(.+)$/gm;
const H2_RE = /^#{2}\s+\S/gm;
const STEP_RE = /^\s{0,3}(?:\d{1,3}[.)]\s+|[-*+]\s+(?:\[[ xX]\]\s*)?)\S/gm;

const TRIGGER_RE = /(?<![\p{L}\p{N}_])(?:use\s+(?:this|it)\s+when|when\s+the\s+user|whenever|trigger(?:s|ed)?\s+(?:on|when)|apply\s+when)(?![\p{L}\p{N}_])|(?<![\p{L}\p{N}_])(?:когда|если)\s+(?:пользователь|нужно|требуется|просят?)/iu;
const NEGATIVE_SCOPE_RE = /(?<![\p{L}\p{N}_])(?:do\s+not\s+use|don'?t\s+use|not\s+for|never\s+use|not\s+intended|out\s+of\s+scope|not\s+when)(?![\p{L}\p{N}_])|не\s+(?:используй|применяй|подходит|предназначен)/iu;
const INPUT_RE = /^#{1,4}\s*(?:inputs?|prerequisites?|requirements?|before\s+you\s+start|вход(?:ные|)\s*(?:данные)?|предусловия|что\s+нужно)(?![\p{L}\p{N}_])|(?<![\p{L}\p{N}_])(?:you\s+will\s+need|required\s+inputs?|prerequisites?)(?![\p{L}\p{N}_])|(?<![\p{L}\p{N}_])(?:на\s+входе|потребуется|необходимы?)(?![\p{L}\p{N}_])/imu;
const VAGUE_RE = /(?<![\p{L}\p{N}_])(?:if\s+(?:appropriate|needed|necessary|possible)|as\s+(?:needed|appropriate|usual)|where\s+possible|use\s+your\s+judg?ement|etc\.)(?![\p{L}\p{N}_])|(?<![\p{L}\p{N}_])(?:по\s+возможности|при\s+необходимости|как\s+обычно|на\s+ваше\s+усмотрение|и\s+так\s+далее)(?![\p{L}\p{N}_])/giu;
const BRANCH_RE = /\bif\s+[^.\n]{3,60}(?<![\p{L}\p{N}_])(?:then|,)\s|\bif\s+(?:the\s+)?(?:file|command|request|response|api|user)(?![\p{L}\p{N}_])|\bif\s+(?:it|that|this)\s+fails\b|(?<![\p{L}\p{N}_])если\s+[^.\n]{3,60}(?:,|:|\s+то)\s|(?<![\p{L}\p{N}_])(?:не\s+читается|не\s+совпал|отсутствует|нет\s+данных|остановитесь)/giu;
const ERROR_RE = /^#{1,4}\s*(?:errors?|failures?|troubleshooting|edge\s+cases?|what\s+can\s+go\s+wrong|ошибки|сбои|крайние\s+случаи|если\s+что-то\s+пошло|при\s+сбо|обработка\s+ошибок)(?![\p{L}\p{N}_])|(?<![\p{L}\p{N}_])(?:on\s+(?:error|failure)|if\s+(?:it\s+)?fails|fall\s?back|retr(?:y|ies|ied)|rollback)|(?<![\p{L}\p{N}_])(?:в\s+случае\s+ошибки|при\s+сбое|откат)(?![\p{L}\p{N}_])/imu;
const OUTPUT_RE = /^#{1,4}\s*(?:output|response|format|deliverable|результат|формат|ответ)(?![\p{L}\p{N}_])|(?<![\p{L}\p{N}_])(?:output\s+format|response\s+format|формат\s+(?:ответа|вывода|результата))(?![\p{L}\p{N}_])/imu;
const DONE_RE = /(?<![\p{L}\p{N}_])(?:definition\s+of\s+done|done\s+when|success\s+criteria|complete\s+when|finished\s+when|acceptance)(?![\p{L}\p{N}_])|(?<![\p{L}\p{N}_])(?:готово,?\s+когда|критерий\s+(?:готовности|успеха)|считается\s+завершённ)/iu;
const MUTATE_RE = /(?<!\bnot\s)(?<!\bnever\s)(?<!\bdoes\snot\s)(?<![\p{L}\p{N}_])(?:append|overwrite|delete|remove|drop|publish|deploy|commit|push|send|charge|refund|create)\w*|(?<!не\s)(?<!нельзя\s)(?<![\p{L}\p{N}_])(?:допиш|перезапиш|удали|опубликуй|разошли|отправ|спиши|верни\s+деньги|создай)/giu;
const IDEMPOTENT_RE = /(?<![\p{L}\p{N}_])(?:if\s+(?:it\s+)?(?:does\s+not|doesn'?t)\s+exist|already\s+(?:exists|present|there)|idempotent|check\s+(?:first|whether|if)|skip\s+if)(?![\p{L}\p{N}_])|(?<![\p{L}\p{N}_])(?:если\s+ещё\s+нет|уже\s+есть|проверь,?\s+что|повторн)/iu;
const OBSERVE_RE = /(?<![\p{L}\p{N}_])(?:report\s+(?:progress|back|the\s+result)|log\b|tell\s+the\s+user|summar(?:ise|ize)\s+what|write\s+a\s+report|save\s+the\s+(?:output|artifact))\w*|(?<![\p{L}\p{N}_])(?:сообщ|отчёт|журнал|логир|покажи,?\s+что\s+сделано)/iu;
const ABSOLUTE_RE = /(?<![\p{L}\p{N}_])(?:always|never|must\s+(?:not\s+)?|under\s+no\s+circumstances)(?![\p{L}\p{N}_])|(?<![\p{L}\p{N}_])(?:всегда|никогда|ни\s+при\s+каких|обязательно)(?![\p{L}\p{N}_])/giu;
const SAFETY_SECTION_RE = /^#{1,4}\s*(?:safety|security|compliance|legal|privacy|brand|guardrails?|безопасность|соответствие|юридическ|приватность|бренд)(?![\p{L}\p{N}_])/imu;
const IRREVERSIBLE_RE = /(?<![\p{L}\p{N}_])(?:place\s+the\s+order|complete\s+the\s+(?:purchase|checkout)|charge\s+the\s+(?:card|customer)|issue\s+(?:a\s+)?refund|apply\s+the\s+(?:discount|price)|publish\s+(?:it|the)|send\s+the\s+(?:email|campaign)|delete\s+the)(?![\p{L}\p{N}_])|(?<![\p{L}\p{N}_])(?:оформи\s+заказ|проведи\s+оплату|верни\s+деньги|примени\s+скидку|опубликуй|разошли\s+письм|удали\s+навсегда)/iu;
const CONFIRM_RE = /(?<![\p{L}\p{N}_])(?:ask\s+(?:the\s+user\s+)?(?:for\s+)?confirm|confirm\s+with\s+the\s+user|await\s+approval|propose|stage\s+the\s+change|dry[- ]run|preview\s+the\s+change|requires?\s+approval|human\s+approval)|(?<![\p{L}\p{N}_])(?:подтвержден|спроси\s+пользоват|предлож|на\s+согласован|черновик)/iu;
const RANKING_RE = /(?<![\p{L}\p{N}_])(?:sort\s+(?:them|the\s+results)|rank\s+(?:them|the\s+results)|re-?rank|order\s+them\s+by)(?![\p{L}\p{N}_])|(?<![\p{L}\p{N}_])(?:отсортируй\s+(?:их|результаты)|ранжируй)/iu;
const CUSTOM_TAG_RE = /<\/?(?!br|b|i|em|strong|code|pre|p|ul|ol|li|a|img|h[1-6]|hr|div|span|table|tr|td|th|thead|tbody|details|summary|blockquote)[a-z][\w-]{2,30}(?:\s[^>]{0,120})?>/gi;
const TOOL_WORDS = [
  ['bash', /(?<![\p{L}\p{N}_])(?:bash|shell|terminal|command\s+line|run\s+`|\$\s)/i], ['read', /\bread\s+the\s+file\b|\bопредели\s+файл\b/i],
  ['write', /\bwrite\s+(?:the\s+)?file\b|\bсоздай\s+файл\b/i], ['web', /(?<![\p{L}\p{N}_])(?:curl|fetch|http\s+request|web\s*search|webfetch|api\s+call)(?![\p{L}\p{N}_])/i],
  ['git', /\bgit\s+(?:clone|commit|push|checkout)(?![\p{L}\p{N}_])/i], ['python', /\bpython3?\s+\S|\bpip\s+install\b/i], ['node', /\bnode\s+\S|\bnpm\s+(?:run|install)(?![\p{L}\p{N}_])/i],
];

function count(re, s) { return (String(s || '').match(re) || []).length; }

/**
 * @param {object} skill loadSkill() result
 * @param {object} [extra] { evals, spec, missingRefs } from analyzeDir: the reference list comes from lint so that
 *   both the lint warning and the will-not-run mark speak about exactly the same files
 * @returns {{ score:number, params:Array, flags:Array, broken:Array }}
 */
export function processSignals(skill, { evals = null, spec = null, missingRefs = [] } = {}) {
  const body = String(skill.body || '');
  const text = body.replace(FENCE_RE, ' ');
  const desc = String(skill.description || '');
  const whenToUse = String(skill.whenToUse || '');
  const files = (skill.files || []).map((f) => (typeof f === 'string' ? f : f.path)).filter(Boolean);
  const filesLower = files.map((f) => f.toLowerCase());
  const params = [];
  const flags = [];
  const broken = [];
  /** score 0..1 per parameter with the weight from the design doc */
  const P = (id, weight, value, ru, en, evidence = null) => {
    const v = Math.max(0, Math.min(1, value));
    params.push({ id, weight, value: Math.round(v * 100) / 100, ru, en, evidence });
    return v;
  };
  const F = (id, severity, ru, en) => flags.push({ id, severity, ru, en });

  // П1. Триггер и границы применения
  const hasTrigger = TRIGGER_RE.test(desc) || TRIGGER_RE.test(whenToUse) || TRIGGER_RE.test(text.slice(0, 1200));
  const hasNegative = NEGATIVE_SCOPE_RE.test(desc) || NEGATIVE_SCOPE_RE.test(whenToUse) || NEGATIVE_SCOPE_RE.test(text);
  const descOk = desc.length >= 40;
  P('trigger', 12, (hasTrigger ? 0.5 : 0) + (hasNegative ? 0.3 : 0) + (descOk ? 0.2 : 0),
    hasTrigger ? (hasNegative ? 'Сказано, когда применять и когда не применять' : 'Сказано, когда применять, но не сказано, когда не стоит') : 'Не сказано, при каком запросе скилл включается',
    hasTrigger ? (hasNegative ? 'States when to use and when not to' : 'States when to use, but not when not to') : 'No condition that starts the skill');

  // П2. Входы и предусловия
  const hasInputs = INPUT_RE.test(text);
  const missingInputHandled = /\bif\s+(?:the\s+)?\w+\s+is\s+(?:missing|absent|empty)|если\s+(?:нет|отсутствует|не\s+указан)/iu.test(text);
  P('inputs', 11, (hasInputs ? 0.7 : 0) + (missingInputHandled ? 0.3 : 0),
    hasInputs ? 'Входные данные и предусловия перечислены' : 'Не сказано, что нужно иметь на входе',
    hasInputs ? 'Inputs and preconditions are listed' : 'Does not say what the process needs to start');

  // П3. Шаги
  const steps = count(STEP_RE, text);
  const vague = count(VAGUE_RE, text);
  const stepScore = Math.min(1, steps / 4) * (vague > 3 ? 0.6 : vague > 0 ? 0.85 : 1);
  P('steps', 15, stepScore,
    steps ? `Шагов: ${steps}${vague ? `, расплывчатых формулировок: ${vague}` : ''}` : 'Инструкция сплошным текстом, шаги не выделены',
    steps ? `${steps} steps${vague ? `, ${vague} vague phrases` : ''}` : 'Prose only: no discrete steps', { steps, vague });

  // П4. Инструменты и зависимости — единственный параметр, который может пометить скилл как неработоспособный
  const missing = missingRefs || [];
  const declared = skill.frontmatter?.['allowed-tools'] || skill.frontmatter?.allowedTools || skill.frontmatter?.tools;
  const declaredList = Array.isArray(declared) ? declared.map((t) => String(t).toLowerCase()) : String(declared || '').toLowerCase();
  const usedTools = TOOL_WORDS.filter(([, re]) => re.test(text)).map(([id]) => id);
  const undeclared = declared ? usedTools.filter((t) => !declaredList.includes(t)) : [];
  if (missing.length) {
    broken.push({ id: 'missing-file', ru: `Скилл ссылается на файлы, которых нет в архиве: ${missing.slice(0, 3).join(', ')}`, en: `References files that are not bundled: ${missing.slice(0, 3).join(', ')}` });
  }
  P('tools', 18, missing.length ? 0 : (usedTools.length && !declared ? 0.6 : 1),
    missing.length ? `Не хватает ${missing.length} файла(ов): ${missing.slice(0, 3).join(', ')}` : declared ? 'Инструменты объявлены во frontmatter' : usedTools.length ? `Используются инструменты (${usedTools.join(', ')}), но во frontmatter они не объявлены` : 'Внешние инструменты не нужны',
    missing.length ? `${missing.length} referenced file(s) missing: ${missing.slice(0, 3).join(', ')}` : declared ? 'Tools declared in frontmatter' : usedTools.length ? `Uses tools (${usedTools.join(', ')}) that frontmatter does not declare` : 'No external tools needed',
    { missing, usedTools, undeclared });

  // П5. Ветвления и ошибки
  const branches = count(BRANCH_RE, text);
  const errorSection = ERROR_RE.test(text);
  P('branching', 10, Math.min(1, (branches ? 0.5 : 0) + (errorSection ? 0.5 : 0) + Math.min(0.2, branches / 20)),
    errorSection || branches ? `Развилок: ${branches}${errorSection ? ', есть раздел про ошибки' : ''}` : 'Линейный процесс без обработки сбоев',
    errorSection || branches ? `${branches} branches${errorSection ? ', has a failure section' : ''}` : 'Linear process with no failure handling');

  // П6. Критерий готовности и формат результата
  const hasOutput = OUTPUT_RE.test(text);
  const hasDone = DONE_RE.test(text);
  P('done', 14, (hasOutput ? 0.6 : 0) + (hasDone ? 0.4 : 0),
    hasOutput ? (hasDone ? 'Формат результата и критерий готовности описаны' : 'Формат результата описан, критерия завершения нет') : 'Не сказано, что считать результатом',
    hasOutput ? (hasDone ? 'Output format and completion criterion are stated' : 'Output format stated, no completion criterion') : 'Does not say what the result is');

  // П7. Повторяемость
  const mutations = count(MUTATE_RE, text);
  const guarded = IDEMPOTENT_RE.test(text);
  P('repeatable', 4, mutations === 0 ? 1 : guarded ? 1 : 0.3,
    mutations === 0 ? 'Изменяющих операций нет' : guarded ? 'Изменяющие операции проверяют текущее состояние' : `Изменяющих операций: ${mutations}, без проверки текущего состояния`,
    mutations === 0 ? 'No mutating operations' : guarded ? 'Mutating operations check current state' : `${mutations} mutating operations with no state check`);

  // П8. Стоимость исполнения
  const tokens = skill.bodyTokens || 0;
  const costScore = tokens <= 4000 ? 1 : tokens <= 8000 ? 0.7 : tokens <= 16000 ? 0.4 : 0.1;
  P('cost', 6, costScore,
    `Тело инструкции ${tokens} токенов${tokens > 8000 ? ': вытесняет саму задачу из окна' : ''}`,
    `Instruction body is ${tokens} tokens${tokens > 8000 ? ': crowds the task out of the window' : ''}`, { tokens });

  // П9. Внутренняя согласованность
  const dirName = String(skill.dir || '').split(/[\\/]/).filter(Boolean).pop() || '';
  const nameMatches = !dirName || !skill.name || dirName.toLowerCase() === String(skill.name).toLowerCase();
  const hermesOk = skill.dialect !== 'hermes' || Boolean(skill.frontmatter?.category && skill.frontmatter?.tags);
  P('consistent', 8, (nameMatches ? 0.6 : 0) + (hermesOk ? 0.4 : 0),
    nameMatches ? (hermesOk ? 'Имя и обязательные поля на месте' : 'Диалект Hermes требует category и tags') : `Имя во frontmatter (${skill.name}) не совпадает с папкой (${dirName})`,
    nameMatches ? (hermesOk ? 'Name and required fields are in place' : 'The Hermes dialect needs category and tags') : `Frontmatter name (${skill.name}) differs from the folder (${dirName})`);

  // П10. Наблюдаемость
  const observable = OBSERVE_RE.test(text);
  P('observable', 2, observable ? 1 : 0,
    observable ? 'Скилл сообщает о ходе работы' : 'Скилл ничего не сообщает по ходу работы',
    observable ? 'Reports progress' : 'Says nothing while it works');

  // --- бизнес-оси, кодовая половина ---
  const absolutes = count(ABSOLUTE_RE, text);
  if (SAFETY_SECTION_RE.test(text) || absolutes >= 6) {
    F('placement', 'medium', 'Правила безопасности и запреты внутри скилла: их место в системном промпте, здесь они не защищают', 'Safety rules and hard prohibitions inside a skill: they belong in the system prompt, here they protect nothing');
  }
  const h2 = count(H2_RE, text);
  if (h2 >= 10) F('boundaries', 'low', `Разделов верхнего уровня: ${h2}. Похоже на несколько доменов в одном скилле`, `${h2} top-level sections: this looks like several domains in one skill`);
  if (RANKING_RE.test(text)) F('tools', 'low', 'Скилл сам сортирует и ранжирует выдачу: это работа системы на той стороне, а не модели', 'The skill ranks results itself: that belongs to the system behind the tool, not the model');
  if (IRREVERSIBLE_RE.test(text) && !CONFIRM_RE.test(text)) {
    F('authority', 'high', 'Скилл велит модели самой совершать необратимое действие, без подтверждения человеком', 'The skill tells the model to perform an irreversible action with no human approval');
  }
  const tags = count(CUSTOM_TAG_RE, text);
  if (tags >= 3) F('output', 'low', `Ответ описан самодельной разметкой (${tags} тегов): типизированный вызов надёжнее`, `The response is described with custom markup (${tags} tags): a typed call is more reliable`);
  if (evals) {
    const cases = evals.cases || [];
    const negatives = cases.filter((c) => /refus|reject|should\s+not|must\s+not|deny|ask\s+(?:first|the\s+user)|отказ|не\s+должен|переспрос/i.test(JSON.stringify(c))).length;
    if (cases.length && negatives === 0) F('testability', 'medium', `Тестов ${cases.length}, и все положительные: нет ни одного случая «должен отказать» или «должен переспросить»`, `${cases.length} test cases, all positive: not one "should refuse" or "should ask first"`);
    const injection = cases.filter((c) => /inject|ignore\s+previous|prompt\s+injection|инъекц/i.test(JSON.stringify(c))).length;
    if (cases.length >= 4 && injection === 0) F('testability', 'low', 'Среди тестов нет случая на инъекцию через данные', 'No test case covers injection arriving through data');
  }

  const total = params.reduce((s, p) => s + p.weight, 0);
  const score = Math.round(params.reduce((s, p) => s + p.weight * p.value, 0) / (total || 1) * 100);
  return { score, params, flags, broken, grade: processGrade(score, broken.length > 0) };
}

/**
 * The letter for process maturity. Bands sit where the reviews page already draws its lines (under 35 is "an
 * unfinished process", under 45 is worth a look) and stop short of the technical grade's 90 for an A: a text
 * that states its trigger, inputs, steps, tools, failure handling and completion criterion is at 80 already
 * as good as prose gets. A missing file is an F whatever else is written — the process cannot start.
 */
export const PROCESS_GRADE_LABEL = {
  A: { ru: 'Дойдёт до конца', en: 'Runs to the end' },
  B: { ru: 'Почти готов', en: 'Nearly there' },
  C: { ru: 'Есть пробелы', en: 'Has gaps' },
  D: { ru: 'Процесс не доведён', en: 'Unfinished process' },
  F: { ru: 'Не запустится', en: 'Will not run' },
};
export function processGrade(score, broken = false) {
  if (broken) return 'F';
  if (score == null) return null;
  return score >= 80 ? 'A' : score >= 65 ? 'B' : score >= 50 ? 'C' : score >= 35 ? 'D' : 'F';
}
