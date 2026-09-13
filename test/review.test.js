import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { runSkill } from '../src/runner.js';
import { loadSkill, scoreSkill } from '../src/index.js';
import { reviewPrompt } from '../src/review.js';

/** A skill that carries a rule next to its opposite and a line it calls deprecated, plus one reference file. */
function makeSkill() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'skilltest-review-'));
  const skill = path.join(dir, 'brand-kit');
  fs.mkdirSync(path.join(skill, 'rules'), { recursive: true });
  fs.writeFileSync(path.join(skill, 'SKILL.md'), [
    '---',
    'name: brand-kit',
    'description: Use when the user asks for a branded slide, banner or social post for the institute; applies the brand rules to the layout.',
    '---',
    '# Brand kit',
    '',
    'Rules for every asset:',
    '- Always answer in JSON with the list of layers.',
    '- Never use JSON in answers; write plain prose.',
    '- Background: the blue gradient from rules/colors.md.',
    '',
    'Old rule (deprecated): the background text is "HH-4", keep it in the footer.',
    '',
    'See rules/colors.md for the palette.',
    '',
  ].join('\n'));
  fs.writeFileSync(path.join(skill, 'rules', 'colors.md'), '# Colors\n\nPrimary: #0044aa. Background gradient: blue to white.\n');
  return skill;
}

test('review: the mock reader finds the always/never pair and the deprecated line; the report shows them', async () => {
  const skill = makeSkill();
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'skilltest-review-out-'));
  const s = await runSkill(skill, { mock: true, quiet: true, out, review: true, lang: 'ru' });
  assert.ok(s.review, 'a review is attached to the summary');
  assert.equal(s.review.contradictions.length, 1);
  assert.match(s.review.contradictions[0].a, /Always answer in JSON/);
  assert.match(s.review.contradictions[0].b, /Never use JSON/);
  assert.equal(s.review.stale.length, 1);
  assert.match(s.review.stale[0].text, /deprecated/);
  assert.deepEqual(s.review.files, ['rules/colors.md'], 'the bundled reference file was read too');
  assert.equal(s.review.usd, 0);
  const html = fs.readFileSync(path.join(out, 'report.html'), 'utf8');
  assert.match(html, /Смысл текста: противоречия и следы правок/);
  assert.match(html, /Always answer in JSON/);
  assert.match(html, /на оценку не влияет/);
  const json = JSON.parse(fs.readFileSync(path.join(out, 'results.json'), 'utf8'));
  assert.equal(json.review.contradictions.length, 1);
});

test('review: off unless asked, and the static note about outdated words costs nothing', async () => {
  const skill = makeSkill();
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'skilltest-review-out-'));
  const s = await runSkill(skill, { mock: true, quiet: true, out });
  assert.equal(s.review, null);
  const note = s.lint.info.find((i) => i.code === 'edit-residue');
  assert.ok(note, 'the static lint points at the deprecated line');
  assert.match(note.ru, /строки \d+/);
  const score = scoreSkill({ guard: s.guard, lint: s.lint, hasEvals: false, hasSpec: false, cases: 0 });
  assert.ok(!score.penalties.some((p) => p.code === 'edit-residue'), 'no points off for a note');
});

test('review: the prompt fences the skill and its files with the mark', () => {
  const skill = loadSkill(makeSkill());
  const { text, files, truncated } = reviewPrompt(skill, 'm4rk');
  assert.match(text, /<skill_md_m4rk>[\s\S]*Always answer in JSON[\s\S]*<\/skill_md_m4rk>/);
  assert.match(text, /<file_m4rk>\npath: rules\/colors\.md\n/);
  assert.deepEqual(files, ['rules/colors.md']);
  assert.equal(truncated, false);
});
