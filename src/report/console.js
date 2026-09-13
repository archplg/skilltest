import { color, pct } from '../util.js';
import { t, getLang } from '../i18n.js';

const BADGE = {
  ACTIVE: (s) => color.green(color.bold(s)),
  DEGRADED: (s) => color.yellow(color.bold(s)),
  OBSOLETE: (s) => color.red(color.bold(s)),
  BLOCKED: (s) => color.red(color.bold(s)),
  DRAFT: (s) => color.gray(color.bold(s)),
  ERROR: (s) => color.red(color.bold(s)),
};

export function printSummary(s) {
  const lang = getLang();
  const badge = (BADGE[s.status] || ((x) => x))(` ${s.status} `);
  console.log('');
  console.log(`${color.bold('SkillTest')} · ${s.skill.name} · ${badge}`);
  for (const r of s.reasons || []) console.log(`  ${color.dim('→')} ${lang === 'ru' ? r.ru : r.en}`);
  console.log('');
  if (s.models?.length) {
    const rows = [];
    rows.push([t('Модели', 'Models'), s.models.join(', ')]);
    if (s.judge) rows.push([t('Судья', 'Judge'), s.judge]);
    if (s.passRate != null) rows.push([t('Pass rate (со скиллом)', 'Pass rate (with skill)'), pct(s.passRate)]);
    if (s.baselinePassRate != null) rows.push([t('Pass rate (baseline, без скилла)', 'Pass rate (baseline, no skill)'), pct(s.baselinePassRate)]);
    if (s.uplift != null) rows.push([t('Прирост от скилла', 'Skill uplift'), (s.uplift >= 0 ? '+' : '') + pct(s.uplift)]);
    if (s.snapshot?.passRate != null) rows.push([t('Snapshot (предыдущий эталон)', 'Snapshot (previous reference)'), pct(s.snapshot.passRate)]);
    if (s.triggers?.ran) rows.push([t('Триггеры (позитивные / негативные)', 'Triggers (positive / negative)'), `${pct(s.triggers.positiveRate)} / ${pct(s.triggers.negativeRate)}`]);
    if (s.guard) rows.push([t('Guard', 'Guard'), `${s.guard.findings.length} ${t('находок', 'findings')} (critical ${s.guard.counts.critical}, high ${s.guard.counts.high}, medium ${s.guard.counts.medium}, low ${s.guard.counts.low})`]);
    if (s.spend) rows.push([t('Расход', 'Spend'), `$${s.spend.usd.toFixed(4)} · ${s.spend.calls} ${t('вызовов', 'calls')} · ${s.spend.inputTokens + s.spend.outputTokens} ${t('токенов', 'tokens')}${s.spend.callsWithoutCost ? ` (${s.spend.callsWithoutCost} ${t('без цены', 'without price')})` : ''}`]);
    rows.push([t('Время', 'Duration'), `${(s.durationMs / 1000).toFixed(1)}s`]);
    const w = Math.max(...rows.map((r) => r[0].length));
    for (const [k, v] of rows) console.log(`  ${k.padEnd(w)}  ${v}`);
    console.log('');
  }
  if (s.perCase?.length && s.models?.length) {
    console.log(color.bold(t('Кейсы × модели (со скиллом):', 'Cases × models (with skill):')));
    const idWidth = Math.max(8, ...s.perCase.map((c) => String(c.id).length));
    for (const c of s.perCase) {
      const cells = s.models.map((m) => {
        const r = (s.results || []).filter((x) => x.caseId === c.id && x.model === m && x.mode === 'skill');
        if (!r.length) return color.gray('  ·  ');
        if (r.every((x) => x.error)) return color.red(' ERR ');
        const passed = r.reduce((n, x) => n + x.assertions.filter((a) => a.status === 'PASS').length, 0);
        const total = r.reduce((n, x) => n + x.assertions.filter((a) => a.status !== 'SKIP').length, 0);
        const ok = r.every((x) => x.pass);
        return (ok ? color.green : color.red)(`${ok ? '✓' : '✗'} ${passed}/${total}`);
      });
      const base = c.baselinePassRate != null ? color.dim(`  baseline ${pct(c.baselinePassRate)}`) : '';
      console.log(`  ${String(c.id).padEnd(idWidth)} ${color.dim(c.lang)}  ${cells.join('  ')}${base}`);
    }
    console.log('');
  }
  const fails = (s.results || []).filter((r) => r.mode === 'skill').flatMap((r) => r.assertions.filter((a) => a.status === 'FAIL' || a.status === 'ERROR').map((a) => ({ ...a, caseId: r.caseId, model: r.model })));
  if (fails.length) {
    console.log(color.bold(t('Провалы (со скиллом):', 'Failures (with skill):')));
    for (const f of fails.slice(0, 20)) console.log(`  ${color.red('✗')} ${f.caseId} · ${f.id} (${f.type}) @ ${f.model}: ${f.reason}`);
    if (fails.length > 20) console.log(color.dim(`  … ${fails.length - 20} ${t('ещё', 'more')}`));
    console.log('');
  }
  if (s.guard?.findings?.length) {
    console.log(color.bold(t('Guard — находки:', 'Guard — findings:')));
    for (const f of s.guard.findings.slice(0, 15)) {
      const sev = f.severity === 'critical' ? color.red(f.severity) : f.severity === 'high' ? color.yellow(f.severity) : color.dim(f.severity);
      console.log(`  ${sev.padEnd(18)} ${f.file}:${f.line}  ${lang === 'ru' ? f.message.ru : f.message.en}`);
      console.log(`  ${''.padEnd(9)} ${color.dim(f.snippet)}`);
    }
    if (s.guard.findings.length > 15) console.log(color.dim(`  … ${s.guard.findings.length - 15} ${t('ещё', 'more')}`));
    console.log('');
  }
  if (s.lint && (s.lint.errors.length || s.lint.warnings.length)) {
    console.log(color.bold(t('Lint:', 'Lint:')));
    for (const e of s.lint.errors) console.log(`  ${color.red('error')}   ${lang === 'ru' ? e.ru : e.en}`);
    for (const w of s.lint.warnings) console.log(`  ${color.yellow('warn')}    ${lang === 'ru' ? w.ru : w.en}`);
    console.log('');
  }
  if (s.reports) {
    console.log(color.dim(t('Отчёты:', 'Reports:')));
    for (const [k, v] of Object.entries(s.reports)) console.log(color.dim(`  ${k.padEnd(6)} ${v}`));
    console.log('');
  }
}

export function printPlan(s) {
  const p = s.plan || {};
  console.log('');
  console.log(`${color.bold('SkillTest')} · ${s.skill.name} · ${t('план прогона (dry run)', 'run plan (dry run)')}`);
  console.log(`  ${t('Модели', 'Models').padEnd(22)} ${s.models.join(', ')}`);
  console.log(`  ${t('Судья', 'Judge').padEnd(22)} ${s.judge}`);
  console.log(`  ${t('Кейсов', 'Cases').padEnd(22)} ${s.evals.cases}`);
  console.log(`  ${t('Вызовов ответа', 'Answer calls').padEnd(22)} ${p.answerCalls}`);
  console.log(`  ${t('Вызовов судьи', 'Judge calls').padEnd(22)} ${p.judgeCalls}`);
  console.log(`  ${t('Вызовов триггеров', 'Trigger calls').padEnd(22)} ${p.triggerCalls}`);
  console.log(`  ${t('Токенов (оценка)', 'Tokens (estimate)').padEnd(22)} ~${p.inputTok} in / ~${p.outputTok} out`);
  console.log(`  ${t('Стоимость (оценка)', 'Cost (estimate)').padEnd(22)} ${p.estUsd != null ? `~$${p.estUsd.toFixed(3)}` : t('нет данных о ценах', 'no pricing data')}`);
  if (p.missingModels?.length) console.log(`  ${color.yellow(t('Не найдены в каталоге', 'Not in catalog').padEnd(22))} ${p.missingModels.join(', ')}`);
  console.log('');
}
