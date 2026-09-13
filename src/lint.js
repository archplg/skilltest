import path from 'node:path';
import { LIMITS } from './skill.js';
import { exists } from './util.js';
import { ASSERTION_TYPES } from './spec.js';

const KNOWN_FM_KEYS = new Set(['name', 'description', 'license', 'allowed-tools', 'metadata', 'version', 'compatibility', 'author', 'tags', 'category', 'platforms', 'disable-model-invocation', 'user-invocable', 'model', 'context', 'agent', 'argument-hint', 'hooks', 'when_to_use', 'when-to-use']);

/**
 * Static lint of a skill (no network). Returns { errors, warnings, info } with bilingual messages {ru, en}.
 */
export function lintSkill(skill, spec, evals) {
  const errors = []; const warnings = []; const info = [];
  const E = (code, ru, en) => errors.push({ code, ru, en });
  const W = (code, ru, en) => warnings.push({ code, ru, en });
  const I = (code, ru, en) => info.push({ code, ru, en });
  // Harness notes: about running the skill through this tool, not about the skill. They never touch the grade and
  // are shown apart from spec remarks, so a reader can tell "your description is missing" from "we have no cases".
  const H = (code, ru, en) => info.push({ code, ru, en, harness: true });

  // --- frontmatter ---
  if (skill.frontmatterError && skill.frontmatterRecovered) {
    W('frontmatter-yaml', `SKILL.md: фронтматтер не разбирается как YAML (${skill.frontmatterError}); поля прочитаны построчно. Обычная причина — двоеточие в незакавыченном значении`,
      `SKILL.md: the frontmatter is not valid YAML (${skill.frontmatterError}); fields were read line by line. The usual cause is a colon inside an unquoted value`);
  } else if (skill.frontmatterError) E('frontmatter', `SKILL.md: ${skill.frontmatterError}`, `SKILL.md: ${skill.frontmatterError}`);
  const fm = skill.frontmatter || {};
  if (!fm.name) E('name-missing', 'SKILL.md: нет поля name во фронтматтере', 'SKILL.md: frontmatter has no `name`');
  else {
    if (String(fm.name).length > LIMITS.nameMax) E('name-long', `name длиннее ${LIMITS.nameMax} символов`, `name is longer than ${LIMITS.nameMax} chars`);
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(String(fm.name))) W('name-format', 'name должен быть в kebab-case (строчные буквы, цифры, дефисы)', 'name should be kebab-case (lowercase letters, digits, hyphens)');
    if (String(fm.name) !== path.basename(skill.dir)) W('name-dir', `name "${fm.name}" не совпадает с именем папки "${path.basename(skill.dir)}"`, `name "${fm.name}" does not match folder name "${path.basename(skill.dir)}"`);
  }
  const hermes = skill.dialect === 'hermes';
  if (hermes) I('dialect-hermes', 'диалект Hermes: description ≤ 60 символов, «когда применять» в разделе "## When to Use", метаданные в metadata.hermes', 'Hermes dialect: description ≤ 60 chars, "when to use" lives in a "## When to Use" section, metadata under metadata.hermes');
  if (!fm.description) E('description-missing', 'SKILL.md: нет description — скилл никогда не сработает', 'SKILL.md: no `description` — the skill can never trigger');
  else {
    const d = String(fm.description);
    if (d.length > LIMITS.descriptionMax) E('description-long', `description ${d.length} символов, лимит ${LIMITS.descriptionMax}`, `description is ${d.length} chars, limit ${LIMITS.descriptionMax}`);
    if (hermes && d.length > 60) W('description-long-hermes', `description ${d.length} символов, а стандарт Hermes требует ≤ 60 (одно предложение, с точкой)`, `description is ${d.length} chars; the Hermes authoring standard requires ≤ 60 (one sentence, ending with a period)`);
    if (!hermes && d.length < 40) W('description-short', 'description короче 40 символов: модели не хватит сигнала для срабатывания', 'description under 40 chars: too little signal for triggering');
    const saysWhen = /\b(use|when|trigger|whenever|if the user|используй|когда|если|при запросе|срабатыва)\b/iu.test(d);
    if (!saysWhen && !skill.whenToUse) W('description-no-when', hermes ? 'ни description, ни раздел "## When to Use" не говорят, когда применять скилл' : 'description не говорит, КОГДА применять скилл (нет "use when / используй когда")', hermes ? 'neither description nor a "## When to Use" section says when to use the skill' : 'description does not say WHEN to use the skill (no "use when")');
    if (!hermes && d.length > LIMITS.descriptionBudgetChars / 10) I('description-budget', `description занимает ${d.length} из общего бюджета ~${LIMITS.descriptionBudgetChars} символов на все скиллы`, `description takes ${d.length} of the ~${LIMITS.descriptionBudgetChars}-char shared budget for all skills`);
  }
  for (const k of Object.keys(fm)) if (!KNOWN_FM_KEYS.has(k)) I('frontmatter-key', `неизвестное поле фронтматтера "${k}"`, `unknown frontmatter key "${k}"`);

  // --- body ---
  if (!skill.body.trim()) E('body-empty', 'SKILL.md: пустое тело инструкций', 'SKILL.md: empty instructions body');
  if (skill.bodyTokens > LIMITS.bodyRecommendedTokens) W('body-long', `тело SKILL.md ≈ ${skill.bodyTokens} токенов (рекомендуется < ${LIMITS.bodyRecommendedTokens}); вынесите детали в references/`, `SKILL.md body ≈ ${skill.bodyTokens} tokens (recommended < ${LIMITS.bodyRecommendedTokens}); move details to references/`);
  for (const clean of missingRefs(skill)) W('missing-ref', `ссылка на отсутствующий файл: ${clean}`, `reference to a missing file: ${clean}`);
  // Words that call something outdated while it is still in the instructions: not a defect by themselves (so no
  // penalty), but the one thing a static read can say about old rules kept next to new ones.
  const residue = [];
  skill.body.split('\n').forEach((line, i) => { if (/(?<!\p{L})(?:deprecated|legacy|obsolete|no longer (?:used|valid|needed)|old (?:rules?|versions?|format|approach)|устарел\p{L}*|старая версия|старые правила|больше не (?:использу|нужн|актуальн)\p{L}*)(?!\p{L})/iu.test(line)) residue.push(i + 1); });
  if (residue.length) I('edit-residue', `в тексте есть пометки об устаревшем (строки ${residue.slice(0, 6).join(', ')}): проверьте, не остались ли старые правила рядом с новыми — полная проверка читает текст на противоречия`, `the text marks something as outdated (lines ${residue.slice(0, 6).join(', ')}): check that old rules are not kept next to new ones — the full check reads the text for contradictions`);

  const refDirs = skill.files.filter((f) => /^(?:rules|references?|docs)\/[^/]+\.md$/i.test(f.path)).length;
  if (refDirs && !(spec.run?.include_files?.length)) H('body-refs-not-included', `в скилле ${refDirs} справочных файлов (rules/ references/ docs/), которые одноходовый прогон не видит: добавьте run.include_files: [auto] или флаг --include-files auto`, `the skill has ${refDirs} reference files (rules/ references/ docs/) that a single-turn run does not see: add run.include_files: [auto] or --include-files auto`);

  // --- spec ---
  if (!spec.path) H('spec-missing', 'нет spec.yaml — прогон берёт триггеры и проверки по умолчанию; свой файл точнее (skilltest init создаст шаблон)', 'no spec.yaml — the run falls back to default triggers and checks; your own file is more precise (`skilltest init` writes a template)');
  for (const e of spec.errors) E('spec', e, e);
  for (const a of spec.assertions) {
    if (!ASSERTION_TYPES.includes(a.type)) continue;
    if (['contains', 'not_contains', 'one_of'].includes(a.type) && !(a.value && a.value.length)) E('assertion-value', `assertion ${a.id}: нет value`, `assertion ${a.id}: missing value`);
    if (['regex', 'not_regex'].includes(a.type)) { try { new RegExp(a.pattern || a.value, a.flags ?? 'iu'); } catch (e) { E('assertion-regex', `assertion ${a.id}: неверный regex (${e.message})`, `assertion ${a.id}: invalid regex (${e.message})`); } }
    if (a.type === 'llm_judge' && !a.rubric) E('assertion-rubric', `assertion ${a.id}: llm_judge без rubric`, `assertion ${a.id}: llm_judge without rubric`);
  }
  const todo = (s) => /^\s*todo\b/i.test(String(s ?? ''));
  const todoCount = [...spec.triggers.positive, ...spec.triggers.negative].filter(todo).length
    + spec.assertions.filter((a) => todo(a.rubric) || todo(a.description)).length
    + (evals.cases || []).filter((c) => todo(c.prompt) || todo(c.expected_output)).length;
  if (todoCount) H('todo-placeholders', `осталось ${todoCount} заглушек TODO из шаблона (spec.yaml / evals.json): такие триггеры пропускаются, а судья получает бессмысленную рубрику`, `${todoCount} TODO placeholder(s) left from the template (spec.yaml / evals.json): such triggers are skipped and the judge gets a meaningless rubric`);
  if (!spec.triggers.positive.length) H('triggers-missing', 'в spec.yaml нет triggers.positive — прогон не проверит, что скилл срабатывает на свои запросы', 'spec.yaml has no triggers.positive — the run cannot check that the skill activates on its own requests');
  if (spec.triggers.positive.length && !spec.triggers.negative.length) H('triggers-negative', 'добавьте triggers.negative, чтобы ловить ложные срабатывания', 'add triggers.negative to catch false activations');

  // --- evals ---
  if (!evals.path) H('evals-missing', 'нет evals/evals.json — без своих кейсов прогон идёт по черновику от модели (skilltest init создаст шаблон)', 'no evals/evals.json — without your own cases the run uses a model-drafted set (`skilltest init` writes a template)');
  if (evals.path) for (const e of evals.errors) E('evals', e, e);
  const cases = evals.cases || [];
  for (const c of cases) {
    for (const f of c.files || []) if (f.missing) E('case-file', `кейс ${c.id}: файл не найден: ${f.path}`, `case ${c.id}: file not found: ${f.path}`);
    if (!c.expected_output && !c.assertions.length && !spec.assertions.length) W('case-no-checks', `кейс ${c.id}: нет ни expected_output, ни assertions — проверять нечего`, `case ${c.id}: no expected_output and no assertions — nothing to check`);
  }
  if (evals.skillName && fm.name && evals.skillName !== fm.name) W('evals-name', `skill_name в evals.json ("${evals.skillName}") ≠ name в SKILL.md ("${fm.name}")`, `skill_name in evals.json ("${evals.skillName}") ≠ SKILL.md name ("${fm.name}")`);
  if (cases.length) {
    const langs = new Set(cases.map((c) => c.lang));
    if (spec.language.length > 1 && langs.size === 1) H('evals-monolingual', `все кейсы на одном языке (${[...langs][0]}), а spec.language = ${spec.language.join(', ')}`, `all cases are in one language (${[...langs][0]}) while spec.language = ${spec.language.join(', ')}`);
    if (!cases.some((c) => c.tags.includes('injection'))) H('evals-no-injection', 'нет кейса с тегом injection: устойчивость к prompt injection не проверяется', 'no case tagged `injection`: prompt-injection resistance is not tested');
    if (!cases.some((c) => c.tags.includes('negative') || c.tags.includes('out-of-scope'))) H('evals-no-negative', 'нет негативного кейса (tag negative/out-of-scope)', 'no negative case (tag negative/out-of-scope)');
  }
  return { errors, warnings, info, ok: errors.length === 0 };
}

/**
 * Bundled resources the instructions point at but the package does not carry: markdown links to relative paths and
 * backticked paths under the resource folders. Deliberately narrow — a mention of the user's own `src/app.ts` is not
 * a broken reference, and treating it as one would condemn most honest skills.
 */
export function missingRefs(skill) {
  const links = [...String(skill.body || '').matchAll(/\[[^\]]*\]\(([^)\s]+)\)/g)].map((m) => m[1]).filter((l) => !/^(https?:|mailto:|#)/i.test(l));
  const ticks = [...String(skill.body || '').matchAll(/`((?:scripts|references|assets|templates|examples)\/[^`\s]+)`/g)].map((m) => m[1]);
  const have = new Set((skill.files || []).map((f) => String(typeof f === 'string' ? f : f.path).toLowerCase()));
  const out = [];
  for (const l of new Set([...links, ...ticks])) {
    const clean = l.split('#')[0].replace(/^\.\//, '');
    if (!clean || /^[a-z]+:/i.test(clean)) continue;
    const known = have.has(clean.toLowerCase()) || (skill.dir && exists(path.join(skill.dir, clean)));
    if (!known) out.push(clean);
  }
  return out;
}
