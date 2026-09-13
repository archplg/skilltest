import path from 'node:path';
import { loadSkill, buildSkillSystemPrompt, baselineSystemPrompt } from './skill.js';
import { loadSpec, assertionApplies } from './spec.js';
import { loadEvals, buildUserMessage } from './evals.js';
import { chat, Spend, BudgetExceeded, availableProviders, catalog, parseModelRef } from './providers/index.js';
import { createJudge } from './judge.js';
import { evaluateAll } from './assertions/index.js';
import { runTriggerTest } from './triggers.js';
import { scanSkill } from './guard/scan.js';
import { lintSkill } from './lint.js';
import { computeStatus, STATUS } from './status.js';
import { createLimiter, estimateTokens, exists, readJson, writeJson, nowIso, EXIT } from './util.js';
import { writeReports } from './report/index.js';
import { reviewContent } from './review.js';
import { VERSION } from './version.js';

export const DEFAULT_OPENROUTER_MODEL = 'openrouter:anthropic/claude-sonnet-4.6';

/** Resolve which models to run: CLI > env > spec > auto. */
export function resolveModels(opts, spec) {
  if (opts.mock) return ['mock'];
  const fromCli = opts.models && opts.models.length ? opts.models : null;
  const fromEnv = process.env.SKILLTEST_MODELS ? process.env.SKILLTEST_MODELS.split(',').map((s) => s.trim()).filter(Boolean) : null;
  const fromSpec = spec.run.models && spec.run.models.length ? spec.run.models : null;
  const list = fromCli || fromEnv || fromSpec;
  if (list) return list;
  const avail = availableProviders();
  if (avail.includes('openrouter')) return [DEFAULT_OPENROUTER_MODEL];
  return [];
}

export function resolveJudge(opts, spec, models) {
  if (opts.mock) return 'mock';
  return opts.judge || process.env.SKILLTEST_JUDGE || spec.run.judge || models[0] || null;
}

/** Build the effective assertion list for a case: spec assertions (filtered by `when`) + case assertions + implicit expected_output. */
export function assertionsFor(spec, testCase) {
  const list = [];
  for (const a of spec.assertions) if (assertionApplies(a, testCase)) list.push(a);
  for (const a of testCase.assertions) list.push(a);
  const hasExpected = list.some((a) => a.type === 'expected_output');
  if (testCase.expected_output && !hasExpected && testCase.raw?.judge !== false) {
    list.push({ id: 'EXPECTED', type: 'expected_output', description: 'Matches expected_output (LLM judge)', severity: 'error', implicit: true });
  }
  return list;
}

/** Plan: count calls and estimate cost. */
export async function planRun({ skill, spec, cases, models, judgeModel, opts }) {
  const systemTokens = estimateTokens(buildSkillSystemPrompt(skill, { includeFiles: opts.includeFiles ?? spec.run.include_files, includeBudget: opts.includeBudget ?? spec.run.include_budget }));
  const repeats = opts.repeats ?? spec.run.repeats ?? 1;
  const baseline = opts.baseline ?? spec.run.baseline;
  let answerCalls = 0; let judgeCalls = 0; let inputTok = 0;
  for (const c of cases) {
    if (c.skip) continue;
    const modes = baseline && c.baseline !== false ? 2 : 1;
    const asserts = assertionsFor(spec, c);
    const judgeAsserts = asserts.filter((a) => ['expected_output', 'llm_judge', 'refuses'].includes(a.type) || (a.type === 'no_injection_compliance' && a.use_judge)).length;
    const userTok = estimateTokens(buildUserMessage(c));
    const n = models.length * modes * (c.repeats ?? repeats);
    answerCalls += n;
    judgeCalls += n * judgeAsserts;
    inputTok += n * (systemTokens / modes + userTok) + n * judgeAsserts * (userTok + 600);
  }
  const triggerCalls = (opts.triggers ?? spec.run.triggers) ? models.length * ((spec.triggers.positive?.length || 0) + (spec.triggers.negative?.length || 0)) : 0;
  inputTok += triggerCalls * 500;
  const outputTok = answerCalls * Math.min(spec.run.max_tokens, 800) + judgeCalls * 150 + triggerCalls * 30;
  let estUsd = null;
  try {
    if (!opts.mock && models.some((m) => parseModelRef(m).provider === 'openrouter')) {
      const cat = await catalog('openrouter');
      const price = (ref) => { const { provider, model } = parseModelRef(ref); if (provider !== 'openrouter') return null; return cat.get(model) || null; };
      const prices = models.map(price);
      const jp = price(judgeModel);
      if (prices.every(Boolean)) {
        estUsd = 0;
        const perModelIn = inputTok / models.length; const perModelOut = outputTok / models.length;
        for (const pr of prices) estUsd += (perModelIn * pr.promptUsdPerM + perModelOut * pr.completionUsdPerM) / 1e6;
        if (jp) estUsd += (judgeCalls * 700 * jp.promptUsdPerM + judgeCalls * 150 * jp.completionUsdPerM) / 1e6;
      }
      const missing = models.filter((m) => parseModelRef(m).provider === 'openrouter' && !cat.get(parseModelRef(m).model));
      if (missing.length) return { answerCalls, judgeCalls, triggerCalls, inputTok, outputTok, estUsd, systemTokens, missingModels: missing };
    }
  } catch { /* offline: no estimate */ }
  return { answerCalls, judgeCalls, triggerCalls, inputTok, outputTok, estUsd, systemTokens, missingModels: [] };
}

/**
 * Main entry: run the full barrier for a skill directory.
 * Returns the summary (also written to <skill>/.skilltest/results.json).
 */
export async function runSkill(skillDir, opts = {}) {
  const log = opts.quiet ? () => {} : (opts.log || ((m) => console.log(m)));
  const startedAt = Date.now();
  const skill = loadSkill(skillDir);
  const spec = loadSpec(skill.dir);
  const evals = loadEvals(skill.dir);
  const outDir = path.resolve(skill.dir, opts.out || '.skilltest');
  const lint = lintSkill(skill, spec, evals);
  const summary = {
    tool: 'skilltest', version: VERSION, timestamp: nowIso(), skill: { name: skill.name, dir: skill.dir, description: skill.description, bodyTokens: skill.bodyTokens },
    spec: { path: spec.path, thresholds: spec.thresholds, assertions: spec.assertions.length, triggers: spec.triggers },
    evals: { path: evals.path, cases: evals.cases.length },
    lint,
    guard: null, models: [], judge: null, mode: opts.mock ? 'mock' : 'live', results: [], triggers: { ran: false }, review: null, spend: null,
    passRate: null, baselinePassRate: null, uplift: null, perModel: {}, perCase: [], perAssertion: [],
    snapshot: null, status: null, reasons: [], exitCode: EXIT.OK, durationMs: 0, incomplete: false,
  };

  // ---- 1. Guard (static) ----------------------------------------------------------------
  const guardEnabled = opts.guard ?? spec.run.guard;
  if (guardEnabled) {
    const g = spec.raw.guard || {};
    summary.guard = scanSkill(skill, { allow: g.allow || [], ignorePaths: g.ignore_paths || g.ignore || [], scanEvals: Boolean(g.scan_evals), failOn: opts.failOn || g.fail_on || 'critical', maxHigh: g.max_high });
    log(`guard: ${summary.guard.findings.length} finding(s) — critical ${summary.guard.counts.critical}, high ${summary.guard.counts.high}, medium ${summary.guard.counts.medium}${summary.guard.blocked ? '  ⛔ BLOCKED' : ''}`);
    if (summary.guard.blocked && !opts.guardOnlyReport) {
      finish(summary, startedAt, opts, outDir, log);
      return summary;
    }
  }

  // ---- 2. Models ----------------------------------------------------------------------------
  const models = resolveModels(opts, spec);
  if (!models.length) {
    summary.incomplete = true;
    summary.incompleteReason = 'No models configured. Set OPENROUTER_API_KEY, or pass --models, or add `models:` to spec.yaml, or use --mock.';
    finish(summary, startedAt, opts, outDir, log);
    return summary;
  }
  const judgeModel = resolveJudge(opts, spec, models);
  summary.models = models;
  summary.judge = judgeModel;
  const cases = evals.cases.filter((c) => !c.skip).filter((c) => !opts.filter?.length || opts.filter.includes(String(c.id)));

  // ---- 3. Plan / dry run --------------------------------------------------------------------
  const plan = await planRun({ skill, spec, cases, models, judgeModel, opts });
  summary.plan = plan;
  if (plan.missingModels?.length) log(`warning: not found in OpenRouter catalog: ${plan.missingModels.join(', ')}`);
  if (opts.dryRun) {
    summary.status = STATUS.DRAFT;
    summary.reasons = [{ code: 'dry_run', ru: 'Dry run: вызовы не выполнялись', en: 'Dry run: no calls made' }];
    summary.durationMs = Date.now() - startedAt;
    return summary;
  }

  // ---- 4. Execute ----------------------------------------------------------------------------
  const budget = opts.budget ?? (process.env.SKILLTEST_BUDGET_USD ? Number(process.env.SKILLTEST_BUDGET_USD) : spec.run.budget_usd);
  const spend = new Spend(opts.mock ? Infinity : budget);
  const limit = createLimiter(opts.concurrency ?? spec.run.concurrency ?? 4);
  const judge = judgeModel ? createJudge({ model: judgeModel, spend, threshold: spec.thresholds.judge_pass_score, log: opts.verbose ? log : undefined }) : null;
  const systemSkill = buildSkillSystemPrompt(skill, { includeFiles: opts.includeFiles ?? spec.run.include_files, includeBudget: opts.includeBudget ?? spec.run.include_budget });
  const systemBase = baselineSystemPrompt();
  const repeats = opts.repeats ?? spec.run.repeats ?? 1;
  const baselineEnabled = opts.baseline ?? spec.run.baseline;
  const jobs = [];
  for (const c of cases) {
    const n = c.repeats ?? repeats;
    for (const model of models) {
      for (let r = 0; r < n; r++) {
        jobs.push({ c, model, mode: 'skill', repeat: r });
        if (baselineEnabled && c.baseline !== false) jobs.push({ c, model, mode: 'baseline', repeat: r });
      }
    }
  }
  log(`run: ${cases.length} case(s) × ${models.length} model(s)${baselineEnabled ? ' × {skill, baseline}' : ''}${repeats > 1 ? ` × ${repeats} repeats` : ''} → ${jobs.length} answer call(s), ~${plan.judgeCalls} judge call(s)${plan.estUsd != null ? `, est. $${plan.estUsd.toFixed(3)}` : ''}, budget $${Number.isFinite(spend.cap) ? spend.cap : '∞'}`);

  let budgetHit = null;
  const results = await Promise.all(jobs.map((job) => limit(async () => {
    if (budgetHit) return errorResult(job, 'skipped: budget exhausted');
    const user = buildUserMessage(job.c);
    const rec = { caseId: job.c.id, lang: job.c.lang, tags: job.c.tags, model: job.model, mode: job.mode, repeat: job.repeat, output: null, usage: null, latencyMs: null, error: null, assertions: [], pass: false };
    try {
      const res = await chat(job.model, {
        system: job.mode === 'skill' ? systemSkill : systemBase,
        user,
        temperature: opts.temperature ?? spec.run.temperature,
        maxTokens: opts.maxTokens ?? spec.run.max_tokens,
        spend,
        mockCtx: { role: 'answer', mode: job.mode, testCase: job.c },
        log: opts.verbose ? log : undefined,
      });
      rec.output = res.text; rec.usage = res.usage; rec.latencyMs = res.latencyMs; rec.finishReason = res.finishReason;
      const asserts = assertionsFor(spec, job.c);
      rec.assertions = await evaluateAll(asserts, { output: res.text, testCase: job.c, userMessage: user, judge, thresholds: spec.thresholds, mode: job.mode });
      rec.pass = rec.assertions.every((a) => a.status !== 'FAIL' && a.status !== 'ERROR' || a.severity === 'warn');
      const passed = rec.assertions.filter((a) => a.status === 'PASS').length;
      const counted = rec.assertions.filter((a) => a.status !== 'SKIP').length;
      log(`  ${rec.pass ? '✓' : '✗'} ${String(job.c.id).padEnd(12)} ${job.mode.padEnd(8)} ${job.model}  ${passed}/${counted}${res.latencyMs != null ? `  ${(res.latencyMs / 1000).toFixed(1)}s` : ''}`);
    } catch (e) {
      if (e instanceof BudgetExceeded || e.name === 'BudgetExceeded') { budgetHit = e.message; return errorResult(job, e.message); }
      rec.error = e.message;
      log(`  ! ${String(job.c.id).padEnd(12)} ${job.mode.padEnd(8)} ${job.model}  ERROR: ${e.message}`);
    }
    return rec;
  })));
  summary.results = results;

  // ---- 5. Triggers ---------------------------------------------------------------------------
  const triggersEnabled = opts.triggers ?? spec.run.triggers;
  if (triggersEnabled && !budgetHit) {
    try {
      summary.triggers = await runTriggerTest({ skill, spec, models, spend, limit, log: opts.verbose ? log : undefined });
      if (summary.triggers.ran) log(`triggers: positive ${fmtPct(summary.triggers.positiveRate)}, negative ${fmtPct(summary.triggers.negativeRate)} (${summary.triggers.results.length} checks)`);
    } catch (e) {
      if (e instanceof BudgetExceeded || e.name === 'BudgetExceeded') budgetHit = e.message; else throw e;
    }
  }
  // ---- 5b. Content review: a model reads the text for contradictions and leftovers of old versions -----------
  const reviewModel = opts.review ? (opts.reviewModel || (opts.mock ? 'mock' : judgeModel)) : null;
  if (reviewModel && !budgetHit) {
    try {
      summary.review = await reviewContent(skill, { model: reviewModel, spend, lang: opts.lang || 'en', log: opts.verbose ? log : undefined });
      log(`review (${reviewModel}): ${summary.review.contradictions.length} contradiction(s), ${summary.review.stale.length} leftover(s)`);
    } catch (e) {
      if (e instanceof BudgetExceeded || e.name === 'BudgetExceeded') budgetHit = e.message;
      else summary.review = { error: String(e.message).slice(0, 300) };
    }
  }
  summary.spend = spend.toJSON();
  if (budgetHit) { summary.incomplete = true; summary.incompleteReason = budgetHit; }

  // ---- 6. Aggregate ---------------------------------------------------------------------------
  aggregate(summary, cases, models);

  // ---- 7. Snapshot ----------------------------------------------------------------------------
  const snapPath = path.join(skill.dir, 'evals', 'snapshot.json');
  const snapMode = opts.snapshot || 'compare';
  if (snapMode !== 'none' && exists(snapPath)) {
    try {
      const snap = readJson(snapPath);
      summary.snapshot = { path: snapPath, timestamp: snap.timestamp, passRate: snap.passRate, baselinePassRate: snap.baselinePassRate, models: snap.models, perCase: snap.perCase || [] };
    } catch (e) { log(`warning: cannot read snapshot: ${e.message}`); }
  }

  finish(summary, startedAt, opts, outDir, log);

  if (snapMode === 'save' && !summary.incomplete && summary.status !== STATUS.BLOCKED) {
    writeJson(snapPath, { tool: 'skilltest', version: VERSION, timestamp: summary.timestamp, models, passRate: summary.passRate, baselinePassRate: summary.baselinePassRate, perCase: summary.perCase.map((c) => ({ id: c.id, passRate: c.passRate })) });
    log(`snapshot saved → ${snapPath}`);
  }
  return summary;
}

function errorResult(job, msg) {
  return { caseId: job.c.id, lang: job.c.lang, tags: job.c.tags, model: job.model, mode: job.mode, repeat: job.repeat, output: null, usage: null, latencyMs: null, error: msg, assertions: [], pass: false };
}

function fmtPct(x) { return x == null ? '—' : `${Math.round(x * 100)}%`; }

/** Compute pass rates. Assertion-level pass rate (PASS / (PASS+FAIL+ERROR)); errored calls count as failed. */
export function aggregate(summary, cases, models) {
  const res = summary.results;
  const rate = (list) => {
    let pass = 0; let total = 0;
    for (const r of list) {
      if (r.error) { total += Math.max(1, r.assertions.length); continue; }
      for (const a of r.assertions) { if (a.status === 'SKIP') continue; if (a.severity === 'warn') continue; total++; if (a.status === 'PASS') pass++; }
    }
    return total ? pass / total : null;
  };
  const skillRes = res.filter((r) => r.mode === 'skill');
  const baseRes = res.filter((r) => r.mode === 'baseline');
  summary.passRate = rate(skillRes);
  summary.baselinePassRate = baseRes.length ? rate(baseRes) : null;
  summary.uplift = summary.passRate != null && summary.baselinePassRate != null ? summary.passRate - summary.baselinePassRate : null;
  summary.casePassRate = skillRes.length ? skillRes.filter((r) => r.pass && !r.error).length / skillRes.length : null;
  for (const m of models) {
    summary.perModel[m] = {
      passRate: rate(skillRes.filter((r) => r.model === m)),
      baselinePassRate: baseRes.length ? rate(baseRes.filter((r) => r.model === m)) : null,
      casesPassed: skillRes.filter((r) => r.model === m && r.pass && !r.error).length,
      cases: skillRes.filter((r) => r.model === m).length,
      errors: res.filter((r) => r.model === m && r.error).length,
      latencyAvgMs: avg(res.filter((r) => r.model === m && r.latencyMs != null).map((r) => r.latencyMs)),
      cost: res.filter((r) => r.model === m).reduce((s, r) => s + (r.usage?.cost || 0), 0),
    };
  }
  summary.perCase = cases.map((c) => {
    const mine = skillRes.filter((r) => r.caseId === c.id);
    const base = baseRes.filter((r) => r.caseId === c.id);
    return { id: c.id, lang: c.lang, tags: c.tags, prompt: c.prompt, passRate: rate(mine), baselinePassRate: base.length ? rate(base) : null, pass: mine.length > 0 && mine.every((r) => r.pass && !r.error) };
  });
  const byAssertion = new Map();
  for (const r of skillRes) for (const a of r.assertions) {
    const k = a.id;
    if (!byAssertion.has(k)) byAssertion.set(k, { id: a.id, type: a.type, description: a.description, pass: 0, fail: 0, skip: 0, error: 0 });
    const e = byAssertion.get(k);
    if (a.status === 'PASS') e.pass++; else if (a.status === 'FAIL') e.fail++; else if (a.status === 'SKIP') e.skip++; else e.error++;
  }
  summary.perAssertion = [...byAssertion.values()];
  summary.errors = { count: res.filter((r) => r.error).length, total: res.length };
}

function avg(xs) { return xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null; }

function finish(summary, startedAt, opts, outDir, log) {
  summary.durationMs = Date.now() - startedAt;
  const st = computeStatus({
    passRate: summary.passRate, baselinePassRate: summary.baselinePassRate, snapshotPassRate: summary.snapshot?.passRate ?? null,
    triggers: summary.triggers, guard: summary.guard, thresholds: summary.spec.thresholds, errors: summary.errors, incomplete: summary.incomplete, incompleteReason: summary.incompleteReason, strict: opts.strict,
  });
  summary.status = st.status;
  summary.reasons = st.reasons;
  summary.exitCode = st.exitCode;
  if (!opts.noWrite) {
    const written = writeReports(summary, outDir, opts.report || ['json', 'html', 'junit', 'sarif'], { lang: opts.lang || 'en' });
    summary.reports = written;
  }
}
