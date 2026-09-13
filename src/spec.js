import path from 'node:path';
import YAML from 'yaml';
import { exists, readText } from './util.js';

export const DEFAULT_THRESHOLDS = {
  pass_rate: 0.8,          // ACTIVE requires >= 80% assertions passed (with skill)
  degraded_drop: 0.1,      // pass rate drop vs snapshot >= 10 pp => DEGRADED
  min_uplift: 0.1,         // with-skill minus baseline < 10 pp (and baseline already passes) => OBSOLETE
  trigger_rate: 0.8,       // positive triggers must activate >= 80%; negatives must NOT activate >= 80%
  judge_pass_score: 0.7,   // LLM judge score threshold
};

export const DEFAULT_RUN = {
  models: [],
  judge: null,
  baseline: true,
  triggers: true,
  guard: true,
  concurrency: 4,
  temperature: 0,
  max_tokens: 2000,
  budget_usd: 5,
  include_files: [],
  repeats: 1,
};

export const SPEC_FILENAMES = ['spec.yaml', 'spec.yml', 'evals/spec.yaml', 'evals/spec.yml', 'skilltest.yaml', 'skilltest.yml'];

export function findSpecPath(skillDir) {
  return SPEC_FILENAMES.map((n) => path.join(skillDir, n)).find(exists) || null;
}

/** Load spec.yaml (behaviour contract). Returns normalized spec; missing spec => defaults. */
export function loadSpec(skillDir) {
  const p = findSpecPath(skillDir);
  let raw = {};
  if (p) {
    try {
      raw = YAML.parse(readText(p)) || {};
    } catch (e) {
      throw new Error(`spec parse error in ${p}: ${e.message}`);
    }
  }
  const errors = [];
  const assertions = normalizeAssertions(raw.assertions, errors, 'spec');
  const triggers = {
    positive: toStringList(raw.triggers?.positive),
    negative: toStringList(raw.triggers?.negative),
  };
  const thresholds = { ...DEFAULT_THRESHOLDS, ...(raw.thresholds || {}) };
  const run = { ...DEFAULT_RUN, ...(raw.run || {}) };
  if (raw.models) run.models = toStringList(raw.models);
  if (raw.judge) run.judge = String(raw.judge);
  if (raw.include_files) run.include_files = toStringList(raw.include_files);
  return {
    path: p,
    version: raw.version ?? 1,
    skill: raw.skill ?? raw.name ?? null,
    language: toStringList(raw.language ?? raw.languages ?? ['ru', 'en']),
    context: raw.context ?? null,
    task: raw.task ?? null,
    boundaries: toStringList(raw.boundaries),
    triggers,
    assertions,
    thresholds,
    run,
    errors,
    raw,
  };
}

export const ASSERTION_TYPES = [
  'contains', 'not_contains', 'regex', 'not_regex', 'language', 'json', 'max_chars', 'min_chars',
  'one_of', 'expected_output', 'llm_judge', 'refuses', 'no_secret_leak', 'no_injection_compliance',
  'starts_with', 'ends_with', 'word_count',
];

export function normalizeAssertions(list, errors = [], source = 'spec') {
  if (!list) return [];
  if (!Array.isArray(list)) { errors.push(`${source}: assertions must be a list`); return []; }
  return list.map((a, i) => {
    if (typeof a === 'string') a = { type: 'llm_judge', rubric: a };
    const type = String(a.type || 'llm_judge').trim();
    const id = a.id || `${source === 'spec' ? 'A' : 'C'}${i + 1}`;
    if (!ASSERTION_TYPES.includes(type)) errors.push(`${source}: unknown assertion type "${type}" (${id})`);
    const norm = { ...a, id, type };
    if (norm.values && norm.value === undefined) norm.value = norm.values;
    if (norm.value !== undefined && !Array.isArray(norm.value) && ['contains', 'not_contains', 'one_of'].includes(type)) {
      norm.value = [norm.value];
    }
    norm.severity = norm.severity || 'error';
    return norm;
  });
}

export function toStringList(v) {
  if (v == null) return [];
  if (Array.isArray(v)) return v.map((x) => String(x));
  if (typeof v === 'string') return v.split(',').map((s) => s.trim()).filter(Boolean);
  return [String(v)];
}

/** Does an assertion apply to this case? `when` supports {tag, not_tag, lang, case}. */
export function assertionApplies(assertion, testCase) {
  const w = assertion.when;
  if (!w) return true;
  const tags = testCase.tags || [];
  const list = (v) => (Array.isArray(v) ? v.map(String) : [String(v)]);
  if (w.tag && !list(w.tag).some((t) => tags.includes(t))) return false;
  if (w.not_tag && list(w.not_tag).some((t) => tags.includes(t))) return false;
  if (w.lang && testCase.lang && testCase.lang !== w.lang) return false;
  if (w.case != null) {
    const ids = Array.isArray(w.case) ? w.case.map(String) : [String(w.case)];
    if (!ids.includes(String(testCase.id))) return false;
  }
  return true;
}
