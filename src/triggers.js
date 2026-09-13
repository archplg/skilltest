import { chat } from './providers/index.js';
import { parseJsonLoose } from './judge.js';

/** Decoy skills used to make the trigger test realistic (bilingual descriptions). */
export const DECOY_SKILLS = [
  { name: 'pdf-tools', description: 'Read, merge, split PDF files and extract text or tables from them. Use when the user mentions a .pdf file. / Работа с PDF: чтение, объединение, извлечение текста и таблиц.' },
  { name: 'spreadsheet-editor', description: 'Create or edit Excel/CSV spreadsheets: formulas, formatting, charts, cleaning tabular data. / Создание и правка таблиц Excel/CSV, формулы, графики.' },
  { name: 'git-commit-writer', description: 'Write conventional commit messages and pull request descriptions from a diff. / Пишет сообщения коммитов и описания PR по диффу.' },
  { name: 'calendar-manager', description: 'Create, update, move and find calendar events and meetings. / Создание, перенос и поиск встреч и событий в календаре.' },
  { name: 'translator', description: 'Translate text between languages while preserving formatting and terminology. / Перевод текста между языками с сохранением форматирования.' },
  { name: 'sql-helper', description: 'Write, optimise and explain SQL queries for the user\'s database schema. / Пишет и объясняет SQL-запросы под схему базы пользователя.' },
  { name: 'image-resizer', description: 'Resize, crop, compress and convert images between formats. / Изменение размера, обрезка и конвертация изображений.' },
  { name: 'meeting-notes', description: 'Summarise meeting transcripts into decisions, action items and owners. / Резюме встречи: решения, задачи, ответственные.' },
];

const TRIGGER_SYSTEM = [
  'You are the skill router of an AI agent. A list of installed skills (name + description) is provided.',
  'Given the user message, decide which SINGLE skill should be activated. If no skill clearly applies, answer null.',
  'Respond ONLY with JSON: {"skill": "<skill-name>" | null}.',
].join(' ');

/** Catalog entry text: the description, plus (Hermes dialect) the "When to Use" section the router would also see. */
export function catalogDescription(skill) {
  const when = skill.whenToUse ? ` When to use: ${skill.whenToUse.replace(/\s+/g, ' ').slice(0, 400)}` : '';
  return `${skill.description}${when}`;
}

export function buildCatalog(skill, decoys = DECOY_SKILLS) {
  const mid = Math.floor(decoys.length / 2);
  return [...decoys.slice(0, mid), { name: skill.name, description: catalogDescription(skill) }, ...decoys.slice(mid)];
}

export function buildTriggerPrompt(catalog, message) {
  const list = catalog.map((s) => `- name: ${s.name}\n  description: ${s.description.replace(/\s+/g, ' ')}`).join('\n');
  return `<skills>\n${list}\n</skills>\n\n<user_message>\n${message}\n</user_message>`;
}

/**
 * Run the trigger test: for each phrase and model, ask the router which skill activates.
 * Returns { ran, results: [{phrase, kind, model, chosen, pass, error}], positiveRate, negativeRate, perModel }
 */
export async function runTriggerTest({ skill, spec, models, spend, limit, log, decoys }) {
  const isTodo = (s) => /^\s*todo\b/i.test(String(s));
  const positive = (spec.triggers?.positive || []).filter((s) => !isTodo(s));
  const negative = (spec.triggers?.negative || []).filter((s) => !isTodo(s));
  const skippedTodo = (spec.triggers?.positive || []).length + (spec.triggers?.negative || []).length - positive.length - negative.length;
  if (skippedTodo) log?.(`  triggers: ${skippedTodo} TODO placeholder phrase(s) skipped — fill them in spec.yaml`);
  if (!positive.length && !negative.length) return { ran: false, results: [], positiveRate: null, negativeRate: null, perModel: {}, skippedTodo };
  const catalog = buildCatalog(skill, decoys);
  const jobs = [];
  for (const model of models) {
    for (const phrase of positive) jobs.push({ phrase, kind: 'positive', model });
    for (const phrase of negative) jobs.push({ phrase, kind: 'negative', model });
  }
  const results = await Promise.all(jobs.map((job) => limit(async () => {
    try {
      const res = await chat(job.model, {
        system: TRIGGER_SYSTEM,
        user: buildTriggerPrompt(catalog, job.phrase),
        temperature: 0,
        maxTokens: 400,
        json: true,
        spend,
        mockCtx: { role: 'trigger', skills: catalog },
        log,
      });
      const parsed = parseJsonLoose(res.text) || {};
      const chosen = parsed.skill == null ? null : String(parsed.skill);
      const activated = chosen === skill.name;
      const pass = job.kind === 'positive' ? activated : !activated;
      log?.(`  trigger ${pass ? '✓' : '✗'} [${job.kind}] ${job.model} → ${chosen ?? 'null'} :: ${job.phrase}`);
      return { ...job, chosen, activated, pass, usage: res.usage, latencyMs: res.latencyMs };
    } catch (e) {
      if (e.name === 'BudgetExceeded') throw e;
      log?.(`  trigger ERROR [${job.kind}] ${job.model}: ${e.message}`);
      return { ...job, chosen: null, activated: false, pass: false, error: e.message };
    }
  })));
  const rate = (kind) => { const r = results.filter((x) => x.kind === kind); return r.length ? r.filter((x) => x.pass).length / r.length : null; };
  const perModel = {};
  for (const m of models) {
    const r = results.filter((x) => x.model === m);
    perModel[m] = {
      positive: (() => { const p = r.filter((x) => x.kind === 'positive'); return p.length ? p.filter((x) => x.pass).length / p.length : null; })(),
      negative: (() => { const p = r.filter((x) => x.kind === 'negative'); return p.length ? p.filter((x) => x.pass).length / p.length : null; })(),
    };
  }
  return { ran: true, results, positiveRate: rate('positive'), negativeRate: rate('negative'), perModel, catalogSize: catalog.length, skippedTodo };
}
