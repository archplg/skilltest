import fs from 'node:fs';
import path from 'node:path';
import { loadSkill } from './skill.js';
import { loadSpec } from './spec.js';
import { loadEvals } from './evals.js';
import { lintSkill } from './lint.js';
import { scanSkill } from './guard/scan.js';
import { SEVERITY_ORDER } from './guard/patterns.js';
import { detectLang, writeJson, writeText, nowIso, esc } from './util.js';
import { VERSION } from './version.js';

const SKIP_DIRS = new Set(['node_modules', '.git', '.skilltest', '__pycache__', '.venv', 'venv', 'dist', 'build']);

/** Find every directory containing a SKILL.md under the given roots (deduplicated by real path). */
export function discoverSkills(roots, { maxDepth = 14 } = {}) {
  const seen = new Set();
  const out = [];
  const walk = (d, root, depth) => {
    if (depth > maxDepth) return;
    let ents = [];
    try { ents = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    if (ents.some((e) => e.isFile() && /^skill\.md$/i.test(e.name))) {
      let real = d;
      try { real = fs.realpathSync(d); } catch { /* ignore */ }
      if (!seen.has(real)) { seen.add(real); out.push({ dir: d, root }); }
    }
    for (const e of ents) {
      if (!e.isDirectory() || SKIP_DIRS.has(e.name)) continue;
      walk(path.join(d, e.name), root, depth + 1);
    }
  };
  for (const r of roots) walk(path.resolve(r), path.resolve(r), 0);
  return out;
}

/** Lint + guard every skill under roots. No model calls. */
export function auditRoots(roots, opts = {}) {
  const found = discoverSkills(roots);
  const rows = [];
  const ruleCounts = {}; const lintCounts = {}; const categoryCounts = {};
  for (const { dir, root } of found) {
    const rel = path.relative(root, dir).split(path.sep).join('/') || '.';
    let skill;
    try { skill = loadSkill(dir); } catch (e) { rows.push({ dir, root, rel, name: path.basename(dir), error: e.message, score: 0, blocked: false, counts: { critical: 0, high: 0, medium: 0, low: 0 }, findings: [], lint: { errors: [{ code: 'load', en: e.message, ru: e.message }], warnings: [], info: [] } }); continue; }
    let spec;
    try { spec = loadSpec(dir); } catch (e) { spec = { path: null, errors: [e.message], assertions: [], triggers: { positive: [], negative: [] }, language: ['en'], raw: {}, run: {}, thresholds: {} }; }
    const evals = loadEvals(dir);
    const lint = lintSkill(skill, spec, evals);
    const g = spec.raw?.guard || {};
    const guard = scanSkill(skill, { allow: g.allow || [], ignorePaths: g.ignore_paths || [], scanEvals: Boolean(g.scan_evals), failOn: opts.failOn || g.fail_on || 'critical' });
    for (const f of guard.findings) { ruleCounts[f.id] = (ruleCounts[f.id] || 0) + 1; categoryCounts[f.category] = (categoryCounts[f.category] || 0) + 1; }
    for (const e of lint.errors) lintCounts[`error:${e.code}`] = (lintCounts[`error:${e.code}`] || 0) + 1;
    for (const w of lint.warnings) lintCounts[`warn:${w.code}`] = (lintCounts[`warn:${w.code}`] || 0) + 1;
    const fixture = /(?:^|\/)(?:tests?|__tests__|fixtures?|test-fixtures|test[_-]scenarios|testdata|samples?\/(?:malicious|evil|bad)|examples?\/(?:malicious|evil|bad))(?:\/|$)/i.test(rel);
    rows.push({
      dir, root, rel, fixture, name: skill.name, descriptionLength: skill.description.length, descriptionLang: detectLang(skill.description), bodyTokens: skill.bodyTokens, files: skill.files.length,
      scriptFiles: guard.scriptFiles.length, hasEvals: Boolean(evals.path), hasSpec: Boolean(spec.path), cases: evals.cases.length,
      score: guard.score, blocked: guard.blocked, counts: guard.counts,
      findings: guard.findings.map((f) => ({ id: f.id, category: f.category, severity: f.severity, file: f.file, line: f.line, snippet: f.snippet, message: f.message, quoted: Boolean(f.quoted) })),
      lint: { errors: lint.errors, warnings: lint.warnings, info: lint.info },
    });
  }
  // Test fixtures (a scanner's own malicious sample) are reported but never count as blocked.
  for (const r of rows) if (r.fixture && r.blocked) { r.blockedAsFixture = true; r.blocked = false; }
  rows.sort((a, b) => Number(b.blocked) - Number(a.blocked) || b.score - a.score || a.rel.localeCompare(b.rel));
  const descs = rows.filter((r) => r.descriptionLength != null).map((r) => r.descriptionLength).sort((a, b) => a - b);
  const q = (p) => (descs.length ? descs[Math.min(descs.length - 1, Math.floor(descs.length * p))] : null);
  const bodies = rows.filter((r) => r.bodyTokens != null).map((r) => r.bodyTokens).sort((a, b) => a - b);
  const summary = {
    tool: 'skilltest-audit', version: VERSION, timestamp: nowIso(), roots: roots.map((r) => path.resolve(r)),
    total: rows.length,
    blocked: rows.filter((r) => r.blocked).length,
    fixtures: rows.filter((r) => r.fixture).length,
    blockedFixtures: rows.filter((r) => r.blockedAsFixture).length,
    withFindings: rows.filter((r) => r.findings.length).length,
    withHighOrCritical: rows.filter((r) => r.counts.critical || r.counts.high).length,
    findingsBySeverity: rows.reduce((acc, r) => { for (const s of SEVERITY_ORDER) acc[s] += r.counts[s] || 0; return acc; }, { critical: 0, high: 0, medium: 0, low: 0 }),
    ruleCounts: sortObj(ruleCounts), categoryCounts: sortObj(categoryCounts), lintCounts: sortObj(lintCounts),
    lintErrors: rows.filter((r) => r.lint.errors.length).length,
    withEvals: rows.filter((r) => r.hasEvals).length,
    withSpec: rows.filter((r) => r.hasSpec).length,
    descriptionLength: descs.length ? { min: descs[0], p25: q(0.25), median: q(0.5), p75: q(0.75), max: descs[descs.length - 1], over1024: descs.filter((d) => d > 1024).length, under40: descs.filter((d) => d < 40).length } : null,
    bodyTokens: bodies.length ? { median: bodies[Math.floor(bodies.length / 2)], over5000: bodies.filter((b) => b > 5000).length, max: bodies[bodies.length - 1] } : null,
    descriptionLangs: rows.reduce((acc, r) => { acc[r.descriptionLang || 'unknown'] = (acc[r.descriptionLang || 'unknown'] || 0) + 1; return acc; }, {}),
    noWhen: rows.filter((r) => r.lint.warnings.some((w) => w.code === 'description-no-when')).length,
    skills: rows,
  };
  return summary;
}

function sortObj(o) { return Object.fromEntries(Object.entries(o).sort((a, b) => b[1] - a[1])); }

const pctOf = (n, t) => (t ? `${Math.round((n / t) * 100)}%` : '—');

/** Markdown report of an audit summary. */
export function renderAuditMarkdown(s, { top = 25, lang = 'en' } = {}) {
  const ru = lang === 'ru';
  const L = (r, e) => (ru ? r : e);
  const lines = [];
  lines.push(`# SkillTest audit · ${s.total} ${L('скиллов', 'skills')} · ${s.timestamp.slice(0, 10)}`);
  lines.push('');
  lines.push(`${L('Корни', 'Roots')}: ${s.roots.map((r) => `\`${r}\``).join(', ')}`);
  lines.push('');
  lines.push(`| ${L('Метрика', 'Metric')} | ${L('Значение', 'Value')} |`);
  lines.push('|---|---|');
  lines.push(`| ${L('Заблокировано guard (exit 3)', 'Blocked by guard (exit 3)')} | ${s.blocked} (${pctOf(s.blocked, s.total)}) |`);
  lines.push(`| ${L('Скиллов с critical/high', 'Skills with critical/high')} | ${s.withHighOrCritical} (${pctOf(s.withHighOrCritical, s.total)}) |`);
  lines.push(`| ${L('Скиллов хотя бы с одной находкой', 'Skills with any finding')} | ${s.withFindings} (${pctOf(s.withFindings, s.total)}) |`);
  lines.push(`| ${L('Находок critical / high / medium / low', 'Findings critical / high / medium / low')} | ${s.findingsBySeverity.critical} / ${s.findingsBySeverity.high} / ${s.findingsBySeverity.medium} / ${s.findingsBySeverity.low} |`);
  lines.push(`| ${L('Ошибки lint', 'Lint errors')} | ${s.lintErrors} (${pctOf(s.lintErrors, s.total)}) |`);
  lines.push(`| ${L('С тестами (evals)', 'With evals')} | ${s.withEvals} (${pctOf(s.withEvals, s.total)}) |`);
  lines.push(`| ${L('С контрактом (spec.yaml)', 'With spec.yaml')} | ${s.withSpec} (${pctOf(s.withSpec, s.total)}) |`);
  lines.push(`| ${L('description не говорит, когда применять', 'description without "when to use"')} | ${s.noWhen} (${pctOf(s.noWhen, s.total)}) |`);
  if (s.descriptionLength) lines.push(`| ${L('Длина description (медиана / > 1024 / < 40)', 'description length (median / > 1024 / < 40)')} | ${s.descriptionLength.median} / ${s.descriptionLength.over1024} / ${s.descriptionLength.under40} |`);
  if (s.bodyTokens) lines.push(`| ${L('Тело SKILL.md, токены (медиана / > 5000 / max)', 'SKILL.md body tokens (median / > 5000 / max)')} | ${s.bodyTokens.median} / ${s.bodyTokens.over5000} / ${s.bodyTokens.max} |`);
  lines.push(`| ${L('Языки description', 'description languages')} | ${Object.entries(s.descriptionLangs).map(([k, v]) => `${k} ${v}`).join(', ')} |`);
  lines.push('');
  lines.push(`## ${L('Топ по риску', 'Top by risk')} (${Math.min(top, s.skills.length)})`);
  lines.push('');
  lines.push(`| # | ${L('Скилл', 'Skill')} | ${L('Путь', 'Path')} | score | crit | high | med | low | ${L('Главные находки', 'Top findings')} |`);
  lines.push('|---|---|---|---|---|---|---|---|---|');
  s.skills.slice(0, top).forEach((r, i) => {
    const tops = r.findings.filter((f) => f.severity === 'critical' || f.severity === 'high').slice(0, 4).map((f) => `${f.id} (${f.file}:${f.line})`).join('<br>');
    lines.push(`| ${i + 1} | ${r.blocked ? '⛔ ' : ''}${esc(r.name)} | \`${esc(r.rel)}\` | ${r.score} | ${r.counts.critical} | ${r.counts.high} | ${r.counts.medium} | ${r.counts.low} | ${tops || '—'} |`);
  });
  lines.push('');
  lines.push(`## ${L('Правила guard по частоте', 'Guard rules by frequency')}`);
  lines.push('');
  lines.push(`| ${L('Правило', 'Rule')} | ${L('Скиллов', 'Skills')} |`);
  lines.push('|---|---|');
  for (const [k, v] of Object.entries(s.ruleCounts)) lines.push(`| \`${k}\` | ${v} |`);
  lines.push('');
  lines.push(`## Lint`);
  lines.push('');
  lines.push(`| ${L('Код', 'Code')} | ${L('Скиллов', 'Skills')} |`);
  lines.push('|---|---|');
  for (const [k, v] of Object.entries(s.lintCounts)) lines.push(`| \`${k}\` | ${v} |`);
  lines.push('');
  const blocked = s.skills.filter((r) => r.blocked);
  if (blocked.length) {
    lines.push(`## ${L('Заблокированные скиллы', 'Blocked skills')}`);
    lines.push('');
    for (const r of blocked) {
      lines.push(`### ⛔ ${esc(r.name)} · \`${esc(r.rel)}\` · score ${r.score}`);
      lines.push('');
      for (const f of r.findings.filter((x) => x.severity === 'critical' || x.severity === 'high').slice(0, 12)) {
        lines.push(`- **${f.severity}** \`${f.id}\` ${f.file}:${f.line} — ${ru ? f.message.ru : f.message.en}`);
        lines.push(`  \`${esc(f.snippet).slice(0, 180)}\``);
      }
      lines.push('');
    }
  }
  lines.push(`_Generated by skilltest v${s.version}_`);
  return lines.join('\n') + '\n';
}

export function writeAudit(summary, outDir, { lang = 'en', top = 25 } = {}) {
  const jsonPath = path.join(outDir, 'audit.json');
  const mdPath = path.join(outDir, 'audit.md');
  writeJson(jsonPath, summary);
  writeText(mdPath, renderAuditMarkdown(summary, { lang, top }));
  return { json: jsonPath, md: mdPath };
}
