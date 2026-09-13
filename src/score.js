/**
 * Composite SkillTest score for a skill: safety (guard), quality (lint, by the Agent Skills spec), tests (a run on models).
 * Test-harness files (evals.json, spec.yaml) are reported but never scored: the grade must not reward our own format.
 * Pure function of already-computed guard/lint results, so the CLI, the hub and CI all rank skills the same way.
 */

import { qualitySignals, QUALITY_BASE } from './signals.js';

/** Bump when guard / lint / scoring rules change so that catalogs get rescanned. */
export const RULES_VERSION = 14;

/** Lint codes that describe the TEST SUITE rather than the skill itself; they feed the `tests` score, not `quality`. */
export const TEST_SUITE_CODES = new Set(['spec', 'evals', 'evals-name', 'case-file', 'assertion-value', 'assertion-regex', 'assertion-rubric', 'spec-missing', 'evals-missing', 'triggers-missing', 'triggers-negative', 'todo-placeholders', 'evals-monolingual', 'evals-no-injection', 'evals-no-negative', 'case-no-checks', 'body-refs-not-included', 'dialect-hermes', 'name-dir']);

/** Penalty per lint code (points off 100). Unknown errors cost 25, warnings 8, info 1. */
const LINT_WEIGHT = {
  'description-missing': 45, 'name-missing': 30, 'frontmatter': 30, 'body-empty': 40, 'description-long': 25, 'name-long': 15,
  'description-no-when': 12, 'description-short': 8, 'description-long-hermes': 6, 'body-long': 10, 'missing-ref': 6, 'name-format': 5,
  'description-budget': 3, 'frontmatter-key': 1, 'frontmatter-yaml': 10,
  'edit-residue': 0,
};

const SEVERITY_PENALTY = { critical: 45, high: 18, medium: 5, low: 1 };

export const GRADES = ['A', 'B', 'C', 'D', 'F'];

export function gradeFor(overall, blocked = false) {
  if (blocked) return 'F';
  if (overall >= 90) return 'A';
  if (overall >= 75) return 'B';
  if (overall >= 60) return 'C';
  if (overall >= 40) return 'D';
  return 'F';
}

/**
 * @param {object} input
 * @param {object} input.guard   scanSkill() result ({ counts, blocked, findings })
 * @param {object} input.lint    lintSkill() result ({ errors, warnings, info })
 * @param {boolean} input.hasEvals
 * @param {boolean} input.hasSpec
 * @param {number}  input.cases
 * @param {object}  [input.verified]  last live run summary: { status, passRate, baselinePassRate, uplift }
 * @param {object}  [input.skill]     loadSkill() result: enables the fine-grained quality signals
 * @param {object}  [input.signals]   precomputed qualitySignals() result (instead of skill)
 */
export function scoreSkill({ guard, lint, hasEvals = false, hasSpec = false, cases = 0, verified = null, skill = null, signals = null }) {
  const counts = guard?.counts || { critical: 0, high: 0, medium: 0, low: 0 };
  let safetyPenalty = 0;
  for (const sev of Object.keys(SEVERITY_PENALTY)) safetyPenalty += (counts[sev] || 0) * SEVERITY_PENALTY[sev];
  let safety = clamp(100 - safetyPenalty);
  if (guard?.blocked) safety = Math.min(safety, 10);

  let qualityPenalty = 0;
  const penalties = [];
  // The same complaint repeated is one defect, not many: seventeen missing references used to cost 102 points and
  // wipe the quality budget on its own. Each code is charged in full once, then at half, and stops after the third.
  const REPEAT_FACTOR = [1, 0.5, 0.5];
  const seen = new Map();
  const apply = (item, fallback) => {
    if (TEST_SUITE_CODES.has(item.code)) return;
    const w = LINT_WEIGHT[item.code] ?? fallback;
    if (!w) return;
    const n = seen.get(item.code) || 0;
    seen.set(item.code, n + 1);
    const factor = REPEAT_FACTOR[n] ?? 0;
    if (!factor) return;
    const points = Math.round(w * factor);
    qualityPenalty += points;
    penalties.push({ code: item.code, points, repeat: n + 1 });
  };
  for (const e of lint?.errors || []) apply(e, 25);
  for (const w of lint?.warnings || []) apply(w, 8);
  for (const i of lint?.info || []) apply(i, 1);
  // Fine-grained signals spread the score: with them the base is QUALITY_BASE and craft earns the rest.
  const sig = signals || (skill ? qualitySignals(skill) : null);
  const quality = sig ? clamp(QUALITY_BASE - qualityPenalty + sig.bonus - sig.penalty) : clamp(100 - qualityPenalty);

  // "Tests" is what a run on models showed — measured behaviour — and nothing else. Whether the author shipped
  // evals.json or spec.yaml is a fact about the test harness, not about the skill; it is reported, not scored.
  let tests = 0;
  if (verified?.status === 'ACTIVE') tests = 80 + Math.round((verified.passRate || 0) * 20);
  else if (verified?.status === 'DEGRADED') tests = 40 + Math.round((verified.passRate || 0) * 20);
  else if (verified?.status === 'OBSOLETE') tests = 35;
  tests = clamp(tests);

  // The grade is what the skill IS (safe and well formed, by the published spec) plus what it DID on models.
  // Files for our own runner add nothing: a skill is not better written for carrying our test format.
  const base = 0.6 * safety + 0.4 * quality;
  let bonus = 0;
  if (verified?.status === 'ACTIVE') bonus += 8;
  else if (verified?.status === 'DEGRADED') bonus += 2;
  else if (verified?.status === 'OBSOLETE') bonus -= 5;
  // A live run that failed its thresholds caps the grade: a skill cannot read "A" and "DEGRADED" at the same time.
  // A live run outranks tidiness. "Helps a little" caps the skill at C; "made no difference" caps it at D, because a
  // skill that changes nothing is not a B however well it is written.
  let cap = 100;
  if (verified?.status === 'DEGRADED') cap = (verified.uplift ?? 1) > 0.05 ? 74 : 59;
  else if (verified?.status === 'OBSOLETE') cap = 49;
  const overall = Math.min(cap, clamp(Math.round(base + bonus)));
  const grade = gradeFor(overall, Boolean(guard?.blocked));
  return { overall, safety, quality, tests, grade, blocked: Boolean(guard?.blocked), penalties, signals: sig ? sig.signals : null, signalDelta: sig ? sig.delta : null, rulesVersion: RULES_VERSION };
}

function clamp(x, lo = 0, hi = 100) { return Math.max(lo, Math.min(hi, Math.round(x))); }
