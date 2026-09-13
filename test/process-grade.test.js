import { test } from 'node:test';
import assert from 'node:assert/strict';
import { processGrade, processSignals } from '../src/process.js';

test('process maturity has a letter of its own, and a missing file is an F whatever else is written', () => {
  assert.equal(processGrade(92), 'A'); assert.equal(processGrade(80), 'A');
  assert.equal(processGrade(79), 'B'); assert.equal(processGrade(65), 'B');
  assert.equal(processGrade(64), 'C'); assert.equal(processGrade(50), 'C');
  assert.equal(processGrade(49), 'D'); assert.equal(processGrade(35), 'D');
  assert.equal(processGrade(34), 'F'); assert.equal(processGrade(0), 'F');
  assert.equal(processGrade(null), null);
  assert.equal(processGrade(95, true), 'F', 'a process that cannot start is an F at any score');

  const r = processSignals({ name: 'x', description: 'Use when the user asks for x. Do not use for y.', body: '## Inputs\n- a file\n\n## Steps\n1. Read\n2. Check\n3. Write\n4. Report\n\n## Output\nA JSON report. Done when the file exists.\n\n## If it fails\nRetry once.', files: [], frontmatter: {}, bodyTokens: 300 });
  assert.equal(r.grade, processGrade(r.score), 'the analysis carries the same letter the bands give');
  const broken = processSignals({ name: 'x', description: 'Use when.', body: 'See [rules](rules.md).', files: [], frontmatter: {}, bodyTokens: 20 }, { missingRefs: ['rules.md'] });
  assert.equal(broken.grade, 'F');
});
