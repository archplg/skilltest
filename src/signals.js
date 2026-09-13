/**
 * Fine-grained quality signals for a skill, beyond the lint rules. Each signal is a small, explainable check on
 * the SKILL.md text and bundled files; together they spread the quality score so that "no lint errors" alone is a C,
 * and an A needs real craft: example phrases in the description, a stated non-scope, structure, examples, references
 * that are actually used, documented scripts.
 *
 * quality = clamp(QUALITY_BASE − lint penalties + bonuses − penalties)
 */

export const QUALITY_BASE = 70;

const HEADING_RE = /^#{1,4}\s+\S/gm;
const STEP_RE = /^\s{0,3}(?:\d{1,3}[.)]\s+|[-*+]\s+(?:\[[ xX]\]\s*)?)\S/gm;
const FENCE_RE = /```[\s\S]*?```/g;
const QUOTED_PHRASE_RE = /["«“][^"»”\n]{6,80}["»”]/g;
const NEGATIVE_SCOPE_RE = /\b(?:do\s+not\s+use|don'?t\s+use|not\s+for|never\s+use|not\s+intended|out\s+of\s+scope|not\s+when)\b|не\s+(?:используй|применяй|подходит|для)\b|не\s+использовать|вне\s+(?:области|задач)/iu;
const OUTPUT_FORMAT_RE = /^#{1,4}\s*(?:output|response|format|результат|формат|ответ)\b|\b(?:output\s+format|response\s+format|формат\s+(?:ответа|вывода|результата))\b|\bstrict(?:ly)?\s+json\b|\breturn\s+(?:only\s+)?json\b/imu;
const EXAMPLE_RE = /^#{1,4}\s*(?:examples?|примеры?|пример)\b|\b(?:for\s+example|example\s+(?:input|output|request|response)|например|пример\s+(?:запроса|ответа))\b/imu;
const TODO_RE = /\b(?:TODO|TBD|FIXME|lorem\s+ipsum|coming\s+soon|заглушк|дописать)\b/iu;
const ABS_PATH_RE = /(?:^|[\s"'`(])(?:[A-Z]:\\Users\\|\/Users\/[\w.-]+\/|\/home\/[\w.-]+\/)/m;
const LOCALHOST_RE = /https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?\b/i;
const GENERIC_NAME_RE = /^(?:skill|skills|test|tests?-skill|new-skill|my-skill|untitled|example|sample|demo|template|skill-\d+)$/i;
const EMOJI_RE = /\p{Extended_Pictographic}/gu;

function count(re, s) { return (String(s || '').match(re) || []).length; }

/**
 * @param {object} skill  loadSkill() result: { name, description, body, bodyTokens, files, frontmatter, dialect }
 * @returns {{ signals: Array<{id, ok, points, ru, en}>, bonus: number, penalty: number, delta: number }}
 */
export function qualitySignals(skill) {
  const desc = String(skill.description || '');
  const body = String(skill.body || '');
  const bodyNoCode = body.replace(FENCE_RE, ' ');
  const files = skill.files || [];
  const filePaths = files.map((f) => f.path.toLowerCase());
  const out = [];
  const S = (id, ok, points, ru, en) => out.push({ id, ok: Boolean(ok), points: ok ? points : 0, max: points, ru, en });

  // --- description craft
  const quoted = count(QUOTED_PHRASE_RE, desc);
  S('desc-examples', quoted >= 2, 5, quoted >= 2 ? `В description ${quoted} примера фраз-триггеров в кавычках` : 'В description нет примеров фраз, по которым скилл должен срабатывать', quoted >= 2 ? `Description quotes ${quoted} example trigger phrases` : 'Description has no quoted example phrases that should trigger the skill');
  const negScope = NEGATIVE_SCOPE_RE.test(desc) || NEGATIVE_SCOPE_RE.test(skill.whenToUse || '');
  S('desc-negative-scope', negScope, 4, negScope ? 'Описание говорит, когда скилл НЕ применять' : 'Описание не говорит, когда скилл НЕ применять (ложные срабатывания)', negScope ? 'Description says when NOT to use the skill' : 'Description does not say when NOT to use the skill (false activations)');
  const sweet = desc.length >= 120 && desc.length <= 800;
  S('desc-length-sweet', sweet, 3, sweet ? `Длина description ${desc.length} символов: достаточно сигнала, не съедает бюджет` : `Длина description ${desc.length}: рекомендуется 120–800 символов`, sweet ? `Description length ${desc.length}: enough signal without eating the budget` : `Description length ${desc.length}: 120–800 characters recommended`);

  // --- body craft
  const headings = count(HEADING_RE, bodyNoCode);
  S('body-structure', headings >= 3, 4, headings >= 3 ? `Структура: ${headings} заголовков` : `Структура: ${headings} заголовков, инструкции сложно сканировать`, headings >= 3 ? `Structure: ${headings} headings` : `Structure: ${headings} headings, hard to scan`);
  const steps = count(STEP_RE, bodyNoCode);
  S('body-steps', steps >= 3, 3, steps >= 3 ? `Пошаговые инструкции: ${steps} пунктов` : 'Нет пошаговых инструкций или чек-листа', steps >= 3 ? `Step-by-step instructions: ${steps} items` : 'No numbered steps or checklist');
  const outputFmt = OUTPUT_FORMAT_RE.test(bodyNoCode);
  S('body-output-format', outputFmt, 3, outputFmt ? 'Формат ответа описан явно' : 'Формат ответа не описан: модель каждый раз решает сама', outputFmt ? 'Output format is stated explicitly' : 'Output format is not stated: the model decides each time');
  const fences = count(FENCE_RE, body);
  const examples = EXAMPLE_RE.test(bodyNoCode) || fences >= 1;
  S('body-examples', examples, 4, examples ? `Есть примеры (${fences} блоков кода)` : 'Нет примеров входа/выхода', examples ? `Has examples (${fences} code blocks)` : 'No input/output examples');
  const thin = body.trim().length < 300;
  S('body-substance', !thin, 0, thin ? 'Тело SKILL.md короче 300 символов: скилл почти пустой' : 'Тело содержательное', thin ? 'SKILL.md body under 300 characters: nearly empty' : 'Body has substance');
  const longNoStructure = (skill.bodyTokens || 0) > 1500 && headings < 2;
  S('body-long-unstructured', !longNoStructure, 0, longNoStructure ? 'Длинный текст без заголовков' : 'Длина и структура в норме', longNoStructure ? 'Long text without headings' : 'Length and structure fine');
  const todo = TODO_RE.test(bodyNoCode) || TODO_RE.test(desc);
  S('no-todo', !todo, 0, todo ? 'В тексте остались TODO / заглушки' : 'Заглушек нет', todo ? 'TODO / placeholder text left in the skill' : 'No placeholders');
  const absPath = ABS_PATH_RE.test(bodyNoCode) || ABS_PATH_RE.test(body);
  S('no-absolute-paths', !absPath, 0, absPath ? 'Абсолютные локальные пути (C:\\Users, /home/…): скилл не переносим' : 'Локальных путей нет', absPath ? 'Absolute local paths (C:\\Users, /home/…): not portable' : 'No local paths');
  const localhost = LOCALHOST_RE.test(body);
  S('no-localhost', !localhost, 0, localhost ? 'Ссылки на localhost: у другого пользователя не заработает' : 'Нет ссылок на localhost', localhost ? 'localhost URLs: will not work for another user' : 'No localhost URLs');
  const genericName = GENERIC_NAME_RE.test(String(skill.name || ''));
  S('name-specific', !genericName, 0, genericName ? `Имя "${skill.name}" ничего не говорит о задаче` : 'Имя говорящее', genericName ? `Name "${skill.name}" says nothing about the task` : 'Name is specific');
  const emoji = count(EMOJI_RE, bodyNoCode);
  S('emoji-restraint', emoji < 12, 0, emoji < 12 ? 'Эмодзи в меру' : `${emoji} эмодзи в инструкциях: шум для модели`, emoji < 12 ? 'Emoji in moderation' : `${emoji} emoji in the instructions: noise for the model`);

  // --- bundled files
  const refFiles = filePaths.filter((p) => /^(?:references?|rules|docs|reference)\/[^/]+\.(?:md|txt)$/.test(p));
  const bodyLower = body.toLowerCase();
  const refsUsed = refFiles.filter((p) => bodyLower.includes(p) || bodyLower.includes(p.split('/').pop()));
  if (refFiles.length) S('references-used', refsUsed.length > 0, 4, refsUsed.length ? `Справочные файлы упоминаются в инструкциях (${refsUsed.length} из ${refFiles.length})` : `${refFiles.length} справочных файлов, но SKILL.md на них не ссылается: модель их не откроет`, refsUsed.length ? `Reference files are cited in the instructions (${refsUsed.length} of ${refFiles.length})` : `${refFiles.length} reference files, but SKILL.md never points to them: the model will not open them`);
  const scripts = filePaths.filter((p) => /^scripts?\/[^/]+\.(?:py|js|mjs|ts|sh|ps1|bat|cmd|rb|go)$/.test(p));
  if (scripts.length) {
    const mentioned = scripts.filter((p) => bodyLower.includes(p) || bodyLower.includes(p.split('/').pop()));
    S('scripts-documented', mentioned.length === scripts.length, 3, mentioned.length === scripts.length ? `Все ${scripts.length} скриптов описаны в инструкциях` : `${scripts.length - mentioned.length} из ${scripts.length} скриптов не упомянуты в SKILL.md`, mentioned.length === scripts.length ? `All ${scripts.length} scripts are documented` : `${scripts.length - mentioned.length} of ${scripts.length} scripts are never mentioned in SKILL.md`);
  }
  const hasLicense = Boolean(skill.frontmatter?.license) || filePaths.some((p) => /^license(?:\.\w+)?$/.test(p));
  S('license', hasLicense, 1, hasLicense ? 'Лицензия указана' : 'Лицензия не указана', hasLicense ? 'License stated' : 'No license');
  const cyr = (desc + body).match(/[Ѐ-ӿ]/g)?.length || 0; const lat = (desc + body).match(/[A-Za-z]/g)?.length || 0;
  const bilingual = cyr > 200 && lat > 200;
  S('bilingual', bilingual, 2, bilingual ? 'Инструкции двуязычные (RU + EN)' : 'Инструкции на одном языке', bilingual ? 'Bilingual instructions (RU + EN)' : 'Single-language instructions');

  // --- penalties (negative signals with fixed cost)
  const PENALTY = { 'body-substance': 15, 'body-long-unstructured': 5, 'no-todo': 5, 'no-absolute-paths': 4, 'no-localhost': 2, 'name-specific': 5, 'emoji-restraint': 2, 'references-used': 4, 'scripts-documented': 3 };
  let bonus = 0; let penalty = 0;
  for (const s of out) {
    if (s.ok) bonus += s.points;
    else if (PENALTY[s.id]) { s.points = -PENALTY[s.id]; penalty += PENALTY[s.id]; }
  }
  return { signals: out, bonus, penalty, delta: bonus - penalty };
}
