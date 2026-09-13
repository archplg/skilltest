import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scoreSkill, TEST_SUITE_CODES } from '../src/score.js';
import { lintSkill } from '../src/lint.js';

// Four medium findings: safety 80, so the grade sits at 88 and has room to move either way.
const clean = { guard: { counts: { critical: 0, high: 0, medium: 4, low: 0 }, blocked: false }, lint: { errors: [], warnings: [], info: [] } };

test('the grade does not reward our own test format', () => {
  const bare = scoreSkill({ ...clean });
  const withFiles = scoreSkill({ ...clean, hasEvals: true, hasSpec: true, cases: 8 });
  assert.equal(withFiles.overall, bare.overall, 'evals.json and spec.yaml add nothing to the grade');
  assert.equal(withFiles.tests, 0, 'and the "tests" scale stays empty until something was actually run');
  const ran = scoreSkill({ ...clean, verified: { status: 'ACTIVE', passRate: 0.9 } });
  assert.ok(ran.overall > bare.overall, 'a run on models, being measured behaviour, still moves it');
  assert.equal(ran.tests, 98);
  const failed = scoreSkill({ ...clean, verified: { status: 'OBSOLETE', passRate: 0.5 } });
  assert.ok(failed.overall <= 49, 'and a run that showed no difference still caps it');
});

test('harness notes are marked apart from spec remarks and cost nothing', () => {
  const skill = { dir: '/tmp/x', name: 'x', description: 'Use when the user asks for x. Do not use for y.', body: '# x\n\n1. Do it.', files: [], frontmatter: { name: 'x', description: 'Use when the user asks for x.' }, dialect: 'anthropic', bodyTokens: 20 };
  const spec = { path: null, errors: [], assertions: [], triggers: { positive: [], negative: [] }, language: ['en'], raw: {}, run: {}, thresholds: {} };
  const evals = { path: null, errors: [], cases: [] };
  const lint = lintSkill(skill, spec, evals);
  const harness = lint.info.filter((i) => i.harness);
  assert.ok(harness.some((i) => i.code === 'spec-missing') && harness.some((i) => i.code === 'evals-missing'), 'missing harness files are notes for the run');
  assert.ok(!lint.warnings.some((w) => ['spec-missing', 'evals-missing', 'triggers-missing'].includes(w.code)), 'and no longer warnings beside the spec');
  for (const i of harness) assert.ok(TEST_SUITE_CODES.has(i.code), `${i.code} is exempt from the quality penalty`);
  const scored = scoreSkill({ ...clean, lint });
  const harnessCodes = new Set(harness.map((i) => i.code));
  assert.ok(scored.penalties.every((p) => !harnessCodes.has(p.code) && !TEST_SUITE_CODES.has(p.code)), `no harness note costs a point (charged: ${scored.penalties.map((p) => p.code).join(', ') || 'none'})`);
});
