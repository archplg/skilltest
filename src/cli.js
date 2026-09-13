import path from 'node:path';
import { runSkill } from './runner.js';
import { loadSkill } from './skill.js';
import { loadSpec } from './spec.js';
import { loadEvals } from './evals.js';
import { lintSkill } from './lint.js';
import { scanSkill } from './guard/scan.js';
import { initSkill } from './init.js';
import { auditRoots, writeAudit } from './audit.js';
import { Spend } from './providers/index.js';
import { resolveModels } from './runner.js';
import { printSummary, printPlan } from './report/console.js';
import { renderHtml } from './report/html.js';
import { availableProviders, catalog, parseModelRef } from './providers/index.js';
import { setLang, t, getLang } from './i18n.js';
import { color, EXIT, parseList, readJson, writeText, exists } from './util.js';
import { VERSION, PACKAGE_NAME } from './version.js';

const HELP = `
${color.bold('skilltest')} v${VERSION} — test framework & CI gate for AI agent skills (SKILL.md)
                        тесты и CI-барьер для скиллов AI-агентов

Usage / Использование:
  skilltest init [dir] [--draft]  create spec.yaml + evals/evals.json (--draft: filled in by a model) / создать шаблоны
  skilltest audit <root...>       lint + guard every SKILL.md under the roots, audit.md/json / аудит каталога
  skilltest lint [dir]            static checks (frontmatter, limits, evals)      / статические проверки
  skilltest guard [dir]           security scan RU+EN (injection, exfil, secrets) / сканер безопасности
  skilltest run  [dir]            full barrier: guard → cases → triggers → report / полный прогон
  skilltest ci   [dir]            same as run --strict (OBSOLETE also fails)      / для CI
  skilltest triggers [dir]        trigger test only                               / только триггеры
  skilltest report [dir]          re-render report.html from last results.json   / пересобрать отчёт
  skilltest models [--check a,b]  show configured providers / check model ids     / провайдеры и модели

Options / Опции:
  --models a,b        model refs: openrouter:vendor/model | anthropic:model | openai:model | litellm:model | ollama:model | mock
  --judge m           judge model (default: first model)
  --budget usd        hard spend cap for the run (default: spec run.budget_usd or 5)
  --mock              offline run with the built-in mock provider (no keys, $0)
  --dry-run           plan + cost estimate, no calls
  --no-baseline       skip the no-skill baseline run
  --no-triggers       skip the trigger test
  --no-guard          skip the security scan
  --fail-on lvl       guard block level: critical (default) | high | medium | none
  --filter id1,id2    run only these case ids
  --include-files a,b skill files inlined into the system prompt (globs ok: rules/*.md; "auto" = files referenced from SKILL.md)
  --include-budget n  token budget for --include-files auto (default 24000)
  --top n             audit: rows in the console/markdown top list (default 25)
  --repeats n         run each case n times (flakiness)
  --concurrency n     parallel calls (default 4)
  --snapshot save|compare|none   save evals/snapshot.json as the new reference (default compare)
  --strict            OBSOLETE returns exit 1
  --review            a model reads the text for contradictions and leftovers of old versions (judge model)
  --out dir           reports dir (default <skill>/.skilltest)
  --lang ru|en        language of the HTML report (default en)
  --report json,html,junit,sarif
  --lang ru|en        console language (default en; SKILLTEST_LANG)
  --quiet / --verbose / --json (print results.json to stdout)

Exit codes / Коды выхода:
  0 ACTIVE (or OBSOLETE without --strict)   1 DEGRADED / lint errors   2 config or runtime error   3 guard BLOCKED

Env: OPENROUTER_API_KEY, ANTHROPIC_API_KEY, OPENAI_API_KEY, LITELLM_BASE_URL, OLLAMA_BASE_URL, GIGACHAT_BASE_URL, YANDEX_BASE_URL,
     SKILLTEST_MODELS, SKILLTEST_JUDGE, SKILLTEST_BUDGET_USD, SKILLTEST_LANG
`;

export function parseArgs(argv) {
  const opts = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--') { opts._.push(...argv.slice(i + 1)); break; }
    if (a.startsWith('--')) {
      let key = a.slice(2); let val;
      const eq = key.indexOf('=');
      if (eq >= 0) { val = key.slice(eq + 1); key = key.slice(0, eq); }
      if (key.startsWith('no-')) { opts[camel(key.slice(3))] = false; continue; }
      if (val === undefined) {
        const next = argv[i + 1];
        if (next !== undefined && !next.startsWith('--')) { val = next; i++; } else val = true;
      }
      opts[camel(key)] = val;
    } else if (a.startsWith('-') && a.length > 1) {
      const map = { h: 'help', v: 'version', q: 'quiet', m: 'models', j: 'judge', b: 'budget' };
      const key = map[a.slice(1)] || a.slice(1);
      const next = argv[i + 1];
      if (['models', 'judge', 'budget'].includes(key) && next && !next.startsWith('-')) { opts[key] = next; i++; } else opts[key] = true;
    } else opts._.push(a);
  }
  return opts;
}

function camel(s) { return s.replace(/-([a-z])/g, (_, c) => c.toUpperCase()); }

function num(v, def) { if (v === undefined || v === true) return def; const n = Number(v); return Number.isFinite(n) ? n : def; }

export async function main(argv) {
  const o = parseArgs(argv);
  setLang(o.lang || process.env.SKILLTEST_LANG || 'en');
  if (o.version) { console.log(`${PACKAGE_NAME} ${VERSION}`); return EXIT.OK; }
  const cmd = o._[0] && !o._[0].includes('/') && !o._[0].includes('\\') && !exists(path.join(o._[0], 'SKILL.md')) ? o._[0] : null;
  const dirArg = cmd ? o._[1] : o._[0];
  const dir = dirArg || '.';
  if (o.help || !cmd) { if (!cmd && dirArg === undefined && !o.help) { console.log(HELP); return EXIT.OK; } if (o.help) { console.log(HELP); return EXIT.OK; } }

  switch (cmd || 'run') {
    case 'help': console.log(HELP); return EXIT.OK;
    case 'init': return cmdInit(dir, o);
    case 'audit': return cmdAudit(o._.slice(1).length ? o._.slice(1) : ['.'], o);
    case 'lint': return cmdLint(dir, o);
    case 'guard': return cmdGuard(dir, o);
    case 'triggers': return cmdRun(dir, { ...o, baseline: false, filter: '__none__', guard: o.guard ?? true, triggers: true });
    case 'ci': return cmdRun(dir, { ...o, strict: true });
    case 'run': return cmdRun(dir, o);
    case 'report': return cmdReport(dir, o);
    case 'models': return cmdModels(o);
    default:
      console.error(`unknown command "${cmd}"\n${HELP}`);
      return EXIT.ERROR;
  }
}

async function cmdInit(dir, o) {
  let draft = null;
  if (o.draft) {
    const models = o.mock ? ['mock'] : resolveModels({ models: parseList(o.models) }, { run: { models: [] } });
    if (!models.length) { console.error('init --draft needs a model: set OPENROUTER_API_KEY or pass --models, or use --mock'); return EXIT.ERROR; }
    draft = { model: models[0], spend: new Spend(o.budget !== undefined ? num(o.budget, 0.5) : 0.5), log: o.verbose ? console.log : undefined };
    console.log(color.dim(`drafting spec.yaml and evals.json with ${draft.model} …`));
  }
  const { skill, created, skipped, drafted } = await initSkill(dir, { force: Boolean(o.force), draft, log: console.log });
  console.log(`${color.bold('skilltest init')} · ${skill.name}${drafted ? color.dim(`  (drafted by ${drafted.model}: ${drafted.triggers.positive.length}+${drafted.triggers.negative.length} triggers, ${drafted.assertions.length} assertions, ${drafted.cases.length} cases${draft?.spend ? `, $${draft.spend.usd.toFixed(4)}` : ''})`) : ''}`);
  for (const f of created) console.log(`  ${color.green('created')} ${f}`);
  for (const f of skipped) console.log(`  ${color.dim('exists ')} ${f} ${color.dim('(use --force to overwrite)')}`);
  console.log('');
  console.log(drafted ? t('Дальше: проверьте черновик (модель могла ошибиться), затем:', 'Next: review the draft (the model can be wrong), then:') : t('Дальше: заполните TODO в spec.yaml и evals/evals.json, затем:', 'Next: fill in the TODOs in spec.yaml and evals/evals.json, then:'));
  console.log(`  skilltest run ${dir} --mock        ${color.dim(t('офлайн-проверка формата, $0', 'offline format check, $0'))}`);
  console.log(`  skilltest run ${dir} --dry-run     ${color.dim(t('план и оценка стоимости', 'plan and cost estimate'))}`);
  console.log(`  skilltest run ${dir}               ${color.dim(t('реальный прогон', 'real run'))}`);
  return EXIT.OK;
}

async function cmdAudit(roots, o) {
  const lang = getLang();
  const t0 = Date.now();
  const s = auditRoots(roots, { failOn: o.failOn });
  const outDir = path.resolve(o.out === true || !o.out ? '.skilltest-audit' : o.out);
  const written = writeAudit(s, outDir, { lang, top: o.top !== undefined ? num(o.top, 25) : 25 });
  if (o.json) { console.log(JSON.stringify({ ...s, skills: s.skills.map(({ findings, lint, ...rest }) => rest) }, null, 2)); return s.blocked ? EXIT.GUARD : EXIT.OK; }
  console.log(`${color.bold('skilltest audit')} · ${s.total} ${t('скиллов', 'skills')} · ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  console.log(`  ${t('заблокировано', 'blocked').padEnd(26)} ${s.blocked ? color.red(String(s.blocked)) : color.green('0')}`);
  console.log(`  ${t('с critical/high', 'with critical/high').padEnd(26)} ${s.withHighOrCritical}`);
  console.log(`  ${t('с находками', 'with findings').padEnd(26)} ${s.withFindings}   (critical ${s.findingsBySeverity.critical} · high ${s.findingsBySeverity.high} · medium ${s.findingsBySeverity.medium} · low ${s.findingsBySeverity.low})`);
  console.log(`  ${t('ошибки lint', 'lint errors').padEnd(26)} ${s.lintErrors}`);
  console.log(`  ${t('с evals / spec', 'with evals / spec').padEnd(26)} ${s.withEvals} / ${s.withSpec}`);
  console.log(`  ${t('description без "когда"', 'description without "when"').padEnd(26)} ${s.noWhen}`);
  if (s.descriptionLength) console.log(`  ${t('description: медиана/>1024', 'description: median/>1024').padEnd(26)} ${s.descriptionLength.median} / ${s.descriptionLength.over1024}`);
  const top = s.skills.slice(0, o.top !== undefined ? num(o.top, 25) : 25).filter((r) => r.score > 0 || r.blocked);
  if (top.length) {
    console.log('');
    console.log(color.bold(t('Топ по риску:', 'Top by risk:')));
    for (const r of top) {
      const tops = r.findings.filter((f) => f.severity === 'critical' || f.severity === 'high').slice(0, 3).map((f) => f.id).join(', ');
      console.log(`  ${(r.blocked ? color.red('⛔') : ' ')} ${String(r.score).padStart(4)}  ${color.bold(r.name).padEnd(40)} ${color.dim(r.rel)}${tops ? `\n         ${color.dim(tops)}` : ''}`);
    }
  }
  console.log('');
  console.log(color.dim(`${t('Отчёты', 'Reports')}: ${written.md}  ·  ${written.json}`));
  return s.blocked ? EXIT.GUARD : EXIT.OK;
}

async function cmdLint(dir, o) {
  const skill = loadSkill(dir);
  const spec = loadSpec(skill.dir);
  const evals = loadEvals(skill.dir);
  const r = lintSkill(skill, spec, evals);
  const lang = getLang();
  console.log(`${color.bold('skilltest lint')} · ${skill.name} · ${r.ok ? color.green('OK') : color.red(`${r.errors.length} error(s)`)}`);
  for (const e of r.errors) console.log(`  ${color.red('error')}  ${lang === 'ru' ? e.ru : e.en}`);
  for (const w of r.warnings) console.log(`  ${color.yellow('warn')}   ${lang === 'ru' ? w.ru : w.en}`);
  if (!o.quiet) for (const i of r.info) console.log(`  ${color.dim('info')}   ${color.dim(lang === 'ru' ? i.ru : i.en)}`);
  console.log(`  ${color.dim(`name ${skill.name.length}/64 · description ${skill.description.length}/1024 chars · body ≈ ${skill.bodyTokens} tokens · files ${skill.files.length} · cases ${evals.cases.length} · assertions ${spec.assertions.length} · triggers ${spec.triggers.positive.length}+${spec.triggers.negative.length}`)}`);
  if (o.json) console.log(JSON.stringify(r, null, 2));
  return r.ok ? EXIT.OK : EXIT.FAIL;
}

async function cmdGuard(dir, o) {
  const skill = loadSkill(dir);
  const spec = loadSpec(skill.dir);
  const g = spec.raw.guard || {};
  const r = scanSkill(skill, { allow: g.allow || [], ignorePaths: g.ignore_paths || g.ignore || [], scanEvals: Boolean(o.scanEvals || g.scan_evals), failOn: o.failOn || g.fail_on || 'critical', maxHigh: g.max_high });
  const lang = getLang();
  console.log(`${color.bold('skilltest guard')} · ${skill.name} · ${r.blocked ? color.red('BLOCKED') : r.findings.length ? color.yellow(`${r.findings.length} finding(s)`) : color.green('clean')} · ${r.scannedFiles.length} file(s) · risk score ${r.score}`);
  for (const f of r.findings) {
    const sev = f.severity === 'critical' ? color.red(f.severity) : f.severity === 'high' ? color.yellow(f.severity) : color.dim(f.severity);
    console.log(`  ${sev.padEnd(18)} ${color.bold(f.id)}  ${f.file}:${f.line}`);
    console.log(`  ${''.padEnd(9)} ${lang === 'ru' ? f.message.ru : f.message.en}`);
    console.log(`  ${''.padEnd(9)} ${color.dim(f.snippet)}`);
  }
  if (o.sarif) { const { renderSarif } = await import('./report/sarif.js'); writeText(String(o.sarif), JSON.stringify(renderSarif({ guard: r, version: VERSION, skill: { name: skill.name } }), null, 2)); console.log(color.dim(`  sarif → ${o.sarif}`)); }
  if (o.json) console.log(JSON.stringify(r, null, 2));
  return r.blocked ? EXIT.GUARD : EXIT.OK;
}

async function cmdRun(dir, o) {
  const opts = {
    models: parseList(o.models),
    judge: o.judge === true ? undefined : o.judge,
    budget: o.budget !== undefined ? num(o.budget, undefined) : undefined,
    mock: Boolean(o.mock),
    dryRun: Boolean(o.dryRun),
    baseline: o.baseline === false ? false : undefined,
    triggers: o.triggers === false ? false : (o.triggers === true ? true : undefined),
    guard: o.guard === false ? false : undefined,
    failOn: o.failOn,
    filter: o.filter === '__none__' ? ['__none__'] : parseList(o.filter),
    repeats: o.repeats !== undefined ? num(o.repeats, 1) : undefined,
    concurrency: o.concurrency !== undefined ? num(o.concurrency, 4) : undefined,
    snapshot: o.snapshot === true ? 'save' : (o.snapshot || 'compare'),
    strict: Boolean(o.strict),
    review: o.review ? true : undefined,
    out: o.out === true ? undefined : o.out,
    lang: o.lang === 'ru' ? 'ru' : 'en',
    report: o.report ? parseList(o.report) : undefined,
    quiet: Boolean(o.quiet),
    verbose: Boolean(o.verbose),
    includeFiles: o.includeFiles ? parseList(o.includeFiles) : undefined,
    includeBudget: o.includeBudget !== undefined ? num(o.includeBudget, 24000) : undefined,
    temperature: o.temperature !== undefined ? num(o.temperature, 0) : undefined,
    maxTokens: o.maxTokens !== undefined ? num(o.maxTokens, 2000) : undefined,
  };
  const summary = await runSkill(dir, opts);
  if (opts.dryRun) { printPlan(summary); return EXIT.OK; }
  if (o.json) console.log(JSON.stringify(summary, null, 2)); else printSummary(summary);
  return summary.exitCode;
}

async function cmdReport(dir, o) {
  const skill = loadSkill(dir);
  const outDir = path.resolve(skill.dir, o.out === true || !o.out ? '.skilltest' : o.out);
  const p = path.join(outDir, 'results.json');
  if (!exists(p)) { console.error(`no results at ${p}; run \`skilltest run\` first`); return EXIT.ERROR; }
  const s = readJson(p);
  const html = path.join(outDir, 'report.html');
  writeText(html, renderHtml(s));
  printSummary({ ...s, reports: { html } });
  return EXIT.OK;
}

async function cmdModels(o) {
  const avail = availableProviders();
  console.log(`${color.bold('providers')}: ${avail.length ? avail.join(', ') : color.yellow('none configured')}`);
  console.log(color.dim('  openrouter: OPENROUTER_API_KEY · anthropic: ANTHROPIC_API_KEY · openai: OPENAI_API_KEY · litellm: LITELLM_BASE_URL · ollama: OLLAMA_BASE_URL · gigachat/yandex: *_BASE_URL (OpenAI-compatible gateway) · mock: always'));
  const check = parseList(o.check);
  if (check.length) {
    let cat = null;
    try { cat = await catalog('openrouter'); } catch (e) { console.log(color.yellow(`  cannot load OpenRouter catalog: ${e.message}`)); }
    for (const m of check) {
      const ref = parseModelRef(m);
      if (ref.provider === 'openrouter' && cat) {
        const e = cat.get(ref.model);
        console.log(`  ${e ? color.green('✓') : color.red('✗')} ${m}${e ? color.dim(`  $${e.promptUsdPerM.toFixed(2)}/M in · $${e.completionUsdPerM.toFixed(2)}/M out · ctx ${e.context}`) : color.dim('  not in catalog')}`);
      } else console.log(`  ${color.dim('?')} ${m}  ${color.dim(`provider ${ref.provider} (not verifiable offline)`)}`);
    }
  }
  return EXIT.OK;
}
