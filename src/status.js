import { EXIT } from './util.js';

export const STATUS = {
  ACTIVE: 'ACTIVE',       // pass rate above threshold, no regression, skill adds value
  DEGRADED: 'DEGRADED',   // below threshold, regressed vs snapshot, or triggers failing
  OBSOLETE: 'OBSOLETE',   // baseline (no skill) already passes; skill adds < min_uplift
  BLOCKED: 'BLOCKED',     // guard found critical security findings
  DRAFT: 'DRAFT',         // nothing ran (no cases / no triggers)
  ERROR: 'ERROR',         // run could not complete (budget, provider errors)
};

/**
 * Pure status computation. Input summary fields:
 *  passRate (0..1|null), baselinePassRate (0..1|null), snapshotPassRate (0..1|null),
 *  triggers: {ran, positiveRate, negativeRate}, guard: {blocked}, thresholds, errors: {count, total}, incomplete: bool
 */
export function computeStatus(s) {
  const th = s.thresholds;
  const reasons = [];
  if (s.guard?.blocked) {
    reasons.push({ code: 'guard_blocked', ru: 'Guard: найдены критические проблемы безопасности', en: 'Guard: critical security findings' });
    return { status: STATUS.BLOCKED, reasons, exitCode: EXIT.GUARD };
  }
  if (s.incomplete) {
    reasons.push({ code: 'incomplete', ru: s.incompleteReason || 'Прогон не завершён', en: s.incompleteReason || 'Run did not complete' });
    return { status: STATUS.ERROR, reasons, exitCode: EXIT.ERROR };
  }
  const ranCases = s.passRate != null;
  const ranTriggers = Boolean(s.triggers?.ran);
  if (!ranCases && !ranTriggers) {
    reasons.push({ code: 'nothing_ran', ru: 'Нет тест-кейсов и триггеров: запустите `skilltest init`', en: 'No cases and no triggers: run `skilltest init`' });
    return { status: STATUS.DRAFT, reasons, exitCode: EXIT.ERROR };
  }
  if (s.errors?.count && s.errors.count === s.errors.total) {
    reasons.push({ code: 'all_errors', ru: 'Все вызовы модели завершились ошибкой', en: 'All model calls failed' });
    return { status: STATUS.ERROR, reasons, exitCode: EXIT.ERROR };
  }
  let degraded = false;
  if (ranCases && s.passRate < th.pass_rate) {
    degraded = true;
    reasons.push({ code: 'below_threshold', ru: `Pass rate ${pct(s.passRate)} ниже порога ${pct(th.pass_rate)}`, en: `Pass rate ${pct(s.passRate)} is below threshold ${pct(th.pass_rate)}` });
  }
  if (ranCases && s.snapshotPassRate != null) {
    const drop = s.snapshotPassRate - s.passRate;
    if (drop >= th.degraded_drop - 1e-9) {
      degraded = true;
      reasons.push({ code: 'regression', ru: `Pass rate упал с ${pct(s.snapshotPassRate)} до ${pct(s.passRate)} относительно снапшота`, en: `Pass rate fell from ${pct(s.snapshotPassRate)} to ${pct(s.passRate)} vs snapshot` });
    }
  }
  if (ranTriggers) {
    if (s.triggers.positiveRate != null && s.triggers.positiveRate < th.trigger_rate) {
      degraded = true;
      reasons.push({ code: 'triggers_positive', ru: `Позитивные триггеры срабатывают в ${pct(s.triggers.positiveRate)} случаев (порог ${pct(th.trigger_rate)})`, en: `Positive triggers activate in ${pct(s.triggers.positiveRate)} of cases (threshold ${pct(th.trigger_rate)})` });
    }
    if (s.triggers.negativeRate != null && s.triggers.negativeRate < th.trigger_rate) {
      degraded = true;
      reasons.push({ code: 'triggers_negative', ru: `Скилл ложно срабатывает на негативные фразы: корректно только ${pct(s.triggers.negativeRate)}`, en: `Skill fires on negative phrases: only ${pct(s.triggers.negativeRate)} handled correctly` });
    }
  }
  if (degraded) return { status: STATUS.DEGRADED, reasons, exitCode: EXIT.FAIL };
  if (ranCases && s.baselinePassRate != null && s.baselinePassRate >= th.pass_rate && (s.passRate - s.baselinePassRate) < th.min_uplift) {
    reasons.push({ code: 'obsolete', ru: `Модель справляется и без скилла: baseline ${pct(s.baselinePassRate)}, со скиллом ${pct(s.passRate)} (прирост < ${pct(th.min_uplift)})`, en: `Model passes without the skill: baseline ${pct(s.baselinePassRate)}, with skill ${pct(s.passRate)} (uplift < ${pct(th.min_uplift)})` });
    return { status: STATUS.OBSOLETE, reasons, exitCode: s.strict ? EXIT.FAIL : EXIT.OK };
  }
  reasons.push({ code: 'ok', ru: 'Все пороги выполнены', en: 'All thresholds met' });
  return { status: STATUS.ACTIVE, reasons, exitCode: EXIT.OK };
}

function pct(x) { return x == null ? '—' : `${Math.round(x * 100)}%`; }
