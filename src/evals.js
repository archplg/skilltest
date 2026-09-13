import path from 'node:path';
import { exists, readJson, readText, detectLang } from './util.js';
import { normalizeAssertions } from './spec.js';

export const EVALS_FILENAMES = ['evals/evals.json', 'evals.json', 'tests/evals.json', 'evals/cases.json'];

export function findEvalsPath(skillDir) {
  return EVALS_FILENAMES.map((n) => path.join(skillDir, n)).find(exists) || null;
}

/**
 * Load evals.json. Compatible with the Anthropic skill-creator format:
 * { "skill_name": "...", "evals": [ { "id", "prompt", "expected_output", "files": [] } ] }
 * Extensions per case: lang, tags, assertions, baseline (bool), skip, mock: {skill, baseline}, repeats.
 */
export function loadEvals(skillDir) {
  const p = findEvalsPath(skillDir);
  if (!p) return { path: null, skillName: null, cases: [], errors: ['evals.json not found (expected evals/evals.json)'] };
  let raw;
  try { raw = readJson(p); } catch (e) { return { path: p, skillName: null, cases: [], errors: [`evals parse error: ${e.message}`] }; }
  const list = Array.isArray(raw) ? raw : (raw.evals || raw.cases || raw.tests || []);
  const errors = [];
  const evalsDir = path.dirname(p);
  const cases = list.map((c, i) => normalizeCase(c, i, evalsDir, skillDir, errors));
  const ids = new Set();
  for (const c of cases) {
    if (ids.has(c.id)) errors.push(`duplicate case id "${c.id}"`);
    ids.add(c.id);
  }
  return { path: p, skillName: raw.skill_name || raw.skill || null, cases, errors, raw };
}

function normalizeCase(c, i, evalsDir, skillDir, errors) {
  if (typeof c === 'string') c = { prompt: c };
  const id = c.id != null ? String(c.id) : `case-${i}`;
  const prompt = c.prompt ?? c.input ?? c.user ?? '';
  if (!prompt) errors.push(`case ${id}: empty prompt`);
  const files = (c.files || []).map((f) => resolveCaseFile(f, evalsDir, skillDir, id, errors));
  const detected = c.lang || c.language || detectLang(prompt);
  const tags = Array.isArray(c.tags) ? c.tags.map(String) : (c.tags ? [String(c.tags)] : []);
  const assertions = normalizeAssertions(c.assertions || c.assert, errors, `case ${id}`);
  // OpenAI Codex eval-skills format: "expectations": ["…", "…"] — each becomes an LLM-judge rubric.
  if (Array.isArray(c.expectations)) {
    c.expectations.forEach((text, k) => {
      const rubric = typeof text === 'string' ? text : (text?.text || text?.expectation || JSON.stringify(text));
      assertions.push({ id: `EXP${k + 1}`, type: 'llm_judge', rubric, description: rubric, severity: 'error' });
    });
  }
  return {
    id,
    prompt: String(prompt),
    expected_output: c.expected_output ?? c.expected ?? null,
    files,
    lang: detected === 'mixed' || detected === 'unknown' ? 'en' : detected,
    tags,
    assertions,
    baseline: c.baseline,
    skip: Boolean(c.skip),
    mock: c.mock || null,
    repeats: c.repeats,
    raw: c,
  };
}

function resolveCaseFile(f, evalsDir, skillDir, id, errors) {
  const rel = typeof f === 'string' ? f : f?.path;
  if (!rel) { errors.push(`case ${id}: invalid file entry`); return { path: '', full: null, content: null, missing: true }; }
  const candidates = [path.join(evalsDir, rel), path.join(skillDir, rel), path.resolve(rel)];
  const full = candidates.find(exists);
  if (!full) return { path: rel, full: null, content: null, missing: true };
  let content = null;
  try { content = readText(full); } catch { content = null; }
  return { path: rel, full, content, missing: false };
}

/** Compose the user message: prompt + attached files inline. */
export function buildUserMessage(testCase) {
  const parts = [testCase.prompt];
  for (const f of testCase.files || []) {
    if (f.missing) parts.push(`<file name="${f.path}">(file missing)</file>`);
    else parts.push(`<file name="${path.basename(f.path)}">\n${f.content}\n</file>`);
  }
  return parts.join('\n\n');
}
