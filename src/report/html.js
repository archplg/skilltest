import { esc, pct } from '../util.js';

/**
 * Two people read this report. The one who wrote the skill wants the matrix: every case, every model, every
 * assertion, the raw answer. The one deciding whether to install it wants a paragraph: does it help, what is
 * wrong, what to do about it. The first screen answers the second person in their own language; everything
 * under "the detail" is for the first.
 */

/** 1 обращение, 2 обращения, 5 обращений — иначе отчёт спотыкается на собственных цифрах. */
function plural(n, one, few, many) {
  const a = Math.abs(n) % 100;
  const b = a % 10;
  if (a > 10 && a < 20) return many;
  if (b > 1 && b < 5) return few;
  if (b === 1) return one;
  return many;
}

const STATUS_COLOR = { ACTIVE: '#16a34a', DEGRADED: '#d97706', OBSOLETE: '#dc2626', BLOCKED: '#dc2626', DRAFT: '#6b7280', ERROR: '#dc2626' };

const T = {
  ru: {
    status: 'Статус',
    review: 'Смысл текста: противоречия и следы правок',
    reviewNote: 'Модель прочитала SKILL.md и приложенные файлы как редактор. Это прочтение, а не измерение: на оценку не влияет.',
    reviewClean: 'Противоречий и устаревших указаний не найдено.',
    reviewFailed: 'Смысловой разбор не удался',
    reviewCut: 'текст был обрезан для чтения',
    contradictions: 'Противоречия',
    stale: 'Следы прошлых версий',
    withSkill: 'Выполнено со скиллом',
    withoutSkill: 'Без скилла',
    difference: 'разница',
    triggering: 'Срабатывание',
    safety: 'Безопасность',
    cost: 'Стоимость проверки',
    snapshot: 'Прошлый прогон',
    meaning: 'Что это значит',
    toFix: 'Что поправить',
    numbers: 'Откуда цифры',
    details: 'Подробности',
    models: 'Модели',
    cases: 'Задания и модели',
    assertions: 'Отдельные требования',
    triggers: 'Срабатывание на фразы',
    guard: 'Безопасность',
    lint: 'Замечания к оформлению',
    glossary: 'Словарик: что тут за слова',
    caseCol: 'Задание',
    withSkillCol: 'со скиллом',
    baselineCol: 'без скилла',
    noCases: 'заданий нет',
    notRun: 'не запускались',
    noFindings: (n) => `Ничего не нашли; ${plural(n, 'просмотрен', 'просмотрено', 'просмотрено')} ${n} ${plural(n, 'файл', 'файла', 'файлов')}`,
    guardOff: 'проверка безопасности отключена',
    output: 'Ответ модели',
    reason: 'Причина',
    perModel: ['Модель', 'Со скиллом', 'Без скилла', 'Разница', 'Заданий пройдено', 'Ошибок', 'Среднее время', 'Стоимость'],
    calls: (n, t) => `${n} ${plural(n, 'обращение', 'обращения', 'обращений')} к модели · ${t} ${plural(t, 'токен', 'токена', 'токенов')}`,
    fullyPassed: (p) => `целиком пройдено заданий: ${p}`,
    posNeg: 'включился где нужно / промолчал где не нужно',
    guardSub: (c, h, m) => `критических ${c} · высоких ${h} · средних ${m}`,
    generated: 'Отчёт сделан SkillTest',
    footSpec: 'настройки теста',
    footEvals: 'задания',
    pp: 'п.п.',
    description: 'Описание',
    kind: 'Вид',
    phrase: 'Фраза',
    severity: 'Важность',
    rule: 'Правило',
    fileLine: 'Файл:строка',
    found: 'Что нашли',
    snippet: 'Фрагмент',
  },
  en: {
    status: 'Status',
    review: 'The text itself: contradictions and leftovers',
    reviewNote: 'A model read SKILL.md and the bundled files as an editor would. A reading, not a measurement: no part of the grade.',
    reviewClean: 'No contradictions or outdated instructions found.',
    reviewFailed: 'The content review failed',
    reviewCut: 'the text was cut for reading',
    contradictions: 'Contradictions',
    stale: 'Leftovers of earlier versions',
    withSkill: 'Met with the skill',
    withoutSkill: 'Without the skill',
    difference: 'difference',
    triggering: 'Triggering',
    safety: 'Safety',
    cost: 'Cost of this check',
    snapshot: 'Previous run',
    meaning: 'What this means',
    toFix: 'What to fix',
    numbers: 'Where the numbers come from',
    details: 'The detail',
    models: 'Models',
    cases: 'Tasks and models',
    assertions: 'Individual requirements',
    triggers: 'Triggering on phrases',
    guard: 'Safety',
    lint: 'Notes on the write-up',
    glossary: 'Glossary: the words used here',
    caseCol: 'Task',
    withSkillCol: 'with skill',
    baselineCol: 'without skill',
    noCases: 'no tasks',
    notRun: 'not run',
    noFindings: (n) => `Nothing found; ${n} file(s) read`,
    guardOff: 'safety scan disabled',
    output: 'Model answer',
    reason: 'Reason',
    perModel: ['Model', 'With skill', 'Without', 'Difference', 'Tasks passed', 'Errors', 'Avg time', 'Cost'],
    calls: (n, t) => `${n} model calls · ${t} tokens`,
    fullyPassed: (p) => `whole tasks passed: ${p}`,
    posNeg: 'fired where it should / stayed quiet where it should',
    guardSub: (c, h, m) => `critical ${c} · high ${h} · medium ${m}`,
    generated: 'Report produced by SkillTest',
    footSpec: 'test settings',
    footEvals: 'tasks',
    pp: 'pp',
    description: 'Description',
    kind: 'Kind',
    phrase: 'Phrase',
    severity: 'Severity',
    rule: 'Rule',
    fileLine: 'File:line',
    found: 'What was found',
    snippet: 'Snippet',
  },
};

const VERDICT = {
  ru: {
    ACTIVE: 'Скилл работает: с ним модель делает работу правильно заметно чаще, чем без него.',
    DEGRADED: 'Скилл помогает, но до готового не дотягивает — есть что поправить.',
    OBSOLETE: 'Скилл можно не ставить: модель справляется с этими задачами и без него.',
    BLOCKED: 'Скилл ставить нельзя: внутри найдены опасные инструкции.',
    DRAFT: 'Проверять было нечего: у скилла нет ни заданий, ни фраз-триггеров.',
    ERROR: 'Проверка не довелась до конца, выводы делать рано.',
  },
  en: {
    ACTIVE: 'The skill works: with it the model gets the job right markedly more often than without it.',
    DEGRADED: 'The skill helps, but it is not finished — there is something to fix.',
    OBSOLETE: 'You can skip this skill: the model handles these tasks without it.',
    BLOCKED: 'Do not install this skill: it contains dangerous instructions.',
    DRAFT: 'There was nothing to test: the skill ships neither tasks nor trigger phrases.',
    ERROR: 'The run did not finish, so there is nothing to conclude yet.',
  },
};

const SHORT = {
  ru: { ACTIVE: 'работает', DEGRADED: 'требует внимания', OBSOLETE: 'не нужен', BLOCKED: 'небезопасен', DRAFT: 'не протестирован', ERROR: 'прогон не завершён' },
  en: { ACTIVE: 'works', DEGRADED: 'needs attention', OBSOLETE: 'not needed', BLOCKED: 'unsafe', DRAFT: 'untested', ERROR: 'run unfinished' },
};

const GLOSSARY = {
  ru: [
    ['Задание', 'Один пример работы, на котором проверяют скилл: текст запроса и список требований к ответу. В отчёте они называются C1, C2 и так далее.'],
    ['Требование', 'Одно проверяемое условие внутри задания — например «ответ короче 200 слов» или «в ответе нет канцелярита». Задание считается пройденным, только если выполнены все его требования; поэтому доля выполненных требований всегда выше доли пройденных заданий.'],
    ['Со скиллом и без скилла', 'Каждое задание прогоняется дважды: один раз модель видит скилл, второй — нет. Разница показывает вклад именно скилла, а не самой модели.'],
    ['Срабатывание', 'Отдельная проверка: модели дают фразу и несколько посторонних скиллов и смотрят, возьмёт ли она нужный. И наоборот — не возьмётся ли за то, о чём не просили.'],
    ['Безопасность', 'Чтение текста скилла в поиске инструкций, которые могут навредить: увести данные, выполнить чужой код, обойти ограничения. Ничего при этом не запускается.'],
    ['Токены', 'Единицы, которыми считают объём текста для модели. Нужны только чтобы понимать стоимость прогона.'],
  ],
  en: [
    ['Task', 'One worked example the skill is tested on: a prompt plus the requirements its answer must meet. They are named C1, C2 and so on here.'],
    ['Requirement', 'One checkable condition inside a task — "under 200 words", "no boilerplate". A task counts as passed only when every requirement holds, which is why the share of requirements met is always higher than the share of tasks passed.'],
    ['With and without the skill', 'Every task runs twice: once with the skill in front of the model, once without. The gap is what the skill itself adds.'],
    ['Triggering', 'A separate test: the model is offered a phrase and several unrelated skills, to see whether it picks the right one — and whether it grabs work nobody asked it for.'],
    ['Safety', 'A read of the skill text for instructions that could do harm: leak data, run someone else\'s code, work around limits. Nothing is executed.'],
    ['Tokens', 'The unit text is measured in for a model. They matter here only to explain the cost.'],
  ],
};

const CSS = `
:root{--bg:#f8fafc;--card:#fff;--ink:#0f172a;--muted:#64748b;--line:#e2e8f0;--ok:#16a34a;--bad:#dc2626;--warn:#d97706;--info:#2563eb;--code:#f1f5f9}
@media (prefers-color-scheme:dark){:root{--bg:#0b1220;--card:#111a2e;--ink:#e5e7eb;--muted:#94a3b8;--line:#1f2a44;--code:#0f172a}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:14px/1.55 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif}
.wrap{max-width:1180px;margin:0 auto;padding:24px}
h1{font-size:22px;margin:0 0 4px}h2{font-size:17px;margin:28px 0 10px}h3{font-size:14px;margin:20px 0 6px}
.sub{color:var(--muted);font-size:13px}
.badge{display:inline-block;padding:3px 10px;border-radius:999px;color:#fff;font-weight:700;font-size:12px;letter-spacing:.04em;vertical-align:middle}
.verdict{background:var(--card);border:1px solid var(--line);border-left:4px solid var(--warn);border-radius:10px;padding:16px 18px;margin:18px 0}
.verdict.ok{border-left-color:var(--ok)}.verdict.bad{border-left-color:var(--bad)}
.verdict .lead{font-size:17px;line-height:1.45;margin:0 0 14px;max-width:64ch}
.verdict ul,.verdict ol{margin:6px 0 0;padding-left:22px;max-width:74ch}
.verdict li{margin:5px 0}
.verdict h3{margin:16px 0 4px;color:var(--muted);font-size:12px;text-transform:uppercase;letter-spacing:.06em}
.num{font-weight:700;font-variant-numeric:tabular-nums}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px;margin:16px 0}
.kpi{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:12px 14px}
.kpi .l{color:var(--muted);font-size:12px}.kpi .v{font-size:22px;font-weight:700;margin-top:2px;font-variant-numeric:tabular-nums}.kpi .s{font-size:12px;color:var(--muted)}
.alert{border-left:4px solid var(--warn);background:var(--card);border-radius:8px;padding:10px 14px;margin:12px 0}
.alert.ok{border-color:var(--ok)}.alert.bad{border-color:var(--bad)}
table{width:100%;border-collapse:collapse;background:var(--card);border:1px solid var(--line);border-radius:10px;overflow:hidden}
th,td{padding:8px 10px;border-bottom:1px solid var(--line);text-align:left;vertical-align:top}th{font-size:12px;color:var(--muted);font-weight:600;background:var(--code)}
tr:last-child td{border-bottom:0}
.pass{color:var(--ok);font-weight:700}.fail{color:var(--bad);font-weight:700}.skip{color:var(--warn)}.err{color:var(--bad)}
.tag{display:inline-block;font-size:11px;padding:1px 6px;border-radius:6px;background:var(--code);color:var(--muted);margin-right:4px}
details{margin:6px 0}summary{cursor:pointer;color:var(--info)}
pre{background:var(--code);padding:10px;border-radius:8px;overflow:auto;white-space:pre-wrap;word-break:break-word;font-size:12px;max-height:360px}
.cell{white-space:nowrap}.mono{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:12px}
.sev-critical{color:#fff;background:#dc2626;padding:1px 6px;border-radius:6px;font-size:11px}.sev-high{color:#fff;background:#ea580c;padding:1px 6px;border-radius:6px;font-size:11px}.sev-medium{color:#fff;background:#d97706;padding:1px 6px;border-radius:6px;font-size:11px}.sev-low{color:#fff;background:#6b7280;padding:1px 6px;border-radius:6px;font-size:11px}
.foot{color:var(--muted);font-size:12px;margin-top:32px}
.scroll{overflow-x:auto}
.gloss dt{font-weight:600;margin-top:10px}.gloss dd{margin:2px 0 0;color:var(--muted);max-width:80ch}
`;

function kpi(label, value, sub = '') {
  return `<div class="kpi"><div class="l">${label}</div><div class="v">${value}</div>${sub ? `<div class="s">${sub}</div>` : ''}</div>`;
}

function statusClass(st) { return st === 'PASS' ? 'pass' : st === 'FAIL' ? 'fail' : st === 'SKIP' ? 'skip' : 'err'; }

function assertionCards(list, t) {
  if (!list?.length) return '<div class="sub">—</div>';
  return `<table><tr><th>ID</th><th>Type</th><th>Status</th><th>${t.reason}</th></tr>${list.map((a) => `<tr><td class="mono">${esc(a.id)}</td><td class="mono">${esc(a.type)}</td><td class="${statusClass(a.status)}">${esc(a.status)}</td><td>${esc(a.reason)}${a.description ? `<div class="sub">${esc(a.description)}</div>` : ''}</td></tr>`).join('')}</table>`;
}

function resultCell(rs) {
  if (!rs.length) return '<td class="cell sub">·</td>';
  if (rs.every((r) => r.error)) return `<td class="cell err" title="${esc(rs[0].error)}">ERR</td>`;
  const passed = rs.reduce((n, r) => n + r.assertions.filter((a) => a.status === 'PASS').length, 0);
  const total = rs.reduce((n, r) => n + r.assertions.filter((a) => a.status !== 'SKIP').length, 0);
  const ok = rs.every((r) => r.pass && !r.error);
  const lat = rs[0].latencyMs != null ? `${(rs[0].latencyMs / 1000).toFixed(1)}s` : '';
  return `<td class="cell ${ok ? 'pass' : 'fail'}">${ok ? '✓' : '✗'} ${passed}/${total} <span class="sub">${lat}</span></td>`;
}

/** The first screen: the verdict in one sentence, the numbers behind it, and what to do about them. */
function plainVerdict(s, lang) {
  const ru = lang === 'ru';
  const st = s.status || 'DRAFT';
  const t = T[lang];
  const th = s.spec?.thresholds || {};
  const codes = new Set((s.reasons || []).map((r) => r.code));
  const failing = (s.perCase || []).filter((c) => c.pass === false).map((c) => c.id);

  const numbers = [];
  if (s.passRate != null) {
    numbers.push(ru
      ? `<span class="num">${pct(s.passRate)}</span> — столько требований выполнено, когда модель работала со скиллом.`
      : `<span class="num">${pct(s.passRate)}</span> — the share of requirements met when the model had the skill.`);
  }
  if (s.baselinePassRate != null && s.passRate != null) {
    numbers.push(ru
      ? `<span class="num">${pct(s.baselinePassRate)}</span> — столько же выполняет та же модель сама, без скилла.`
      : `<span class="num">${pct(s.baselinePassRate)}</span> — what the same model manages on its own, without it.`);
    const up = s.passRate - s.baselinePassRate;
    numbers.push(ru
      ? `<span class="num">${up >= 0 ? '+' : ''}${Math.round(up * 100)} п.п.</span> — разница между первым и вторым. Это и есть вклад скилла.`
      : `<span class="num">${up >= 0 ? '+' : ''}${Math.round(up * 100)} pp</span> — the gap between the two. That is what the skill itself contributes.`);
  }
  if (s.casePassRate != null && s.passRate != null && s.casePassRate < s.passRate - 0.15) {
    numbers.push(ru
      ? `<span class="num">${pct(s.casePassRate)}</span> — столько заданий пройдено целиком. Это сильно меньше доли требований: значит, в большинстве заданий скилл делает почти всё верно и спотыкается на одном-двух пунктах.`
      : `<span class="num">${pct(s.casePassRate)}</span> — the share of whole tasks passed. Far below the share of requirements, which means the skill gets most of each task right and trips on one or two points.`);
  }

  const todo = [];
  if (codes.has('below_threshold')) {
    todo.push(ru
      ? `Выполнено ${pct(s.passRate)} требований, а чтобы скилл считался готовым, нужно ${pct(th.pass_rate || 0.8)}. Начните с заданий, которые не прошли${failing.length ? `: ${failing.map((x) => esc(String(x))).join(', ')}` : ''} — ниже, в разделе «${t.cases}», видно, какое требование не сработало и что именно ответила модель.`
      : `${pct(s.passRate)} of requirements were met; ${pct(th.pass_rate || 0.8)} is what counts as finished. Start with the tasks that failed${failing.length ? `: ${failing.map((x) => esc(String(x))).join(', ')}` : ''} — under "${t.cases}" below you can see which requirement broke and what the model actually answered.`);
  }
  if (codes.has('triggers_negative')) {
    todo.push(ru
      ? `Скилл берётся за работу, о которой его не просили: из посторонних запросов он правильно оставил без внимания только ${pct(s.triggers.negativeRate)}. Обычно лечится одной строкой в описании — прямо написать, для чего скилл НЕ предназначен.`
      : `The skill takes on work nobody asked it for: it correctly stayed out of only ${pct(s.triggers.negativeRate)} of unrelated requests. One line in the description usually fixes it — say plainly what the skill is not for.`);
  }
  if (codes.has('triggers_positive')) {
    todo.push(ru
      ? `Скилл не включается на части фраз, ради которых написан — сработал в ${pct(s.triggers.positiveRate)} случаев. Добавьте в описание те слова, которыми люди на самом деле формулируют эту задачу.`
      : `The skill does not fire on some of the phrases it exists for — it fired in ${pct(s.triggers.positiveRate)} of them. Put the words people actually use for this task into the description.`);
  }
  if (codes.has('regression')) {
    todo.push(ru
      ? 'Результат хуже, чем в прошлый раз. Стоит сравнить с предыдущим прогоном и посмотреть, что менялось в скилле между ними.'
      : 'This run came out worse than the last one. Compare it with the previous run and see what changed in between.');
  }
  if (codes.has('obsolete')) {
    todo.push(ru
      ? 'Модель делает эту работу и без скилла. Либо задания слишком простые, чтобы что-то показать, либо скилл повторяет то, что модель уже умеет — сузьте его до того, чего она сама не делает.'
      : 'The model does this work unaided. Either the tasks are too easy to show anything, or the skill repeats what the model already knows — narrow it to what it cannot do by itself.');
  }
  if (codes.has('guard_blocked')) {
    todo.push(ru
      ? `Проверка безопасности нашла критические места, и прогон на моделях не делался до их исправления. Список — в разделе «${t.guard}».`
      : `The safety scan found critical problems, so the model run was skipped until they are fixed. The list is under "${t.guard}".`);
  }
  if (codes.has('all_errors') || codes.has('incomplete')) {
    todo.push(ru
      ? 'Прогон оборвался — чаще всего это лимит или сбой у провайдера моделей. Проверку можно повторить: деньги за несостоявшийся прогон не списываются.'
      : 'The run broke off — usually a budget limit or a hiccup at the model provider. You can repeat the check: a run that did not happen is not charged.');
  }
  const g = s.guard;
  if (g && !g.blocked && (g.counts.critical || g.counts.high || g.counts.medium)) {
    todo.push(ru
      ? `Проверка безопасности отметила: ${t.guardSub(g.counts.critical, g.counts.high, g.counts.medium)}. Ставить не мешает, но раздел «${t.guard}» стоит просмотреть.`
      : `The safety scan noted: ${t.guardSub(g.counts.critical, g.counts.high, g.counts.medium)}. Not blocking, but "${t.guard}" is worth a look.`);
  }
  if (s.lint?.errors?.length) {
    todo.push(ru
      ? `Ошибок в оформлении: ${s.lint.errors.length}. Они не про качество ответов, но из-за них часть агентов вообще не увидит скилл — список в самом низу.`
      : `Problems in the write-up: ${s.lint.errors.length}. Not about answer quality, but some agents will not see the skill at all — the list is at the very bottom.`);
  }
  if (!todo.length) {
    todo.push(ru ? 'Ничего чинить не нужно: все пороги пройдены.' : 'Nothing to fix: every threshold was met.');
  }

  const tone = st === 'ACTIVE' ? 'ok' : (st === 'DEGRADED' || st === 'DRAFT') ? '' : 'bad';
  return `<section class="verdict ${tone}">
  <h2 style="margin:0 0 10px">${t.meaning}</h2>
  <p class="lead">${VERDICT[lang][st] || ''}</p>
  ${numbers.length ? `<h3>${t.numbers}</h3><ul>${numbers.map((x) => `<li>${x}</li>`).join('')}</ul>` : ''}
  <h3>${t.toFix}</h3><ol>${todo.map((x) => `<li>${x}</li>`).join('')}</ol>
</section>`;
}

export function renderHtml(s, { lang = 'en' } = {}) {
  const L = T[lang] ? lang : 'en';
  const t = T[L];
  const st = s.status || 'DRAFT';
  const models = s.models || [];
  const results = s.results || [];
  const hasBaseline = results.some((r) => r.mode === 'baseline');

  const kpis = [
    kpi(t.status, `<span class="badge" style="background:${STATUS_COLOR[st]}">${st}</span>`, SHORT[L][st] || ''),
    s.passRate != null ? kpi(t.withSkill, pct(s.passRate), s.casePassRate != null ? t.fullyPassed(pct(s.casePassRate)) : '') : '',
    hasBaseline ? kpi(t.withoutSkill, pct(s.baselinePassRate), s.uplift != null ? `${t.difference} ${s.uplift >= 0 ? '+' : ''}${Math.round(s.uplift * 100)} ${t.pp}` : '') : '',
    s.triggers?.ran ? kpi(t.triggering, `${pct(s.triggers.positiveRate)} <span class="sub">/ ${pct(s.triggers.negativeRate)}</span>`, t.posNeg) : '',
    s.guard ? kpi(t.safety, `${s.guard.findings.length}`, t.guardSub(s.guard.counts.critical, s.guard.counts.high, s.guard.counts.medium)) : '',
    s.spend ? kpi(t.cost, `$${(s.spend.usd || 0).toFixed(3)}`, t.calls(s.spend.calls, (s.spend.inputTokens || 0) + (s.spend.outputTokens || 0))) : '',
    s.snapshot?.passRate != null ? kpi(t.snapshot, pct(s.snapshot.passRate), esc((s.snapshot.timestamp || '').slice(0, 10))) : '',
  ].filter(Boolean).join('');

  const head = models.map((m) => `<th>${esc(m)}<div class="sub">${t.withSkillCol}</div></th>${hasBaseline ? `<th class="sub">${esc(m)}<div class="sub">${t.baselineCol}</div></th>` : ''}`).join('');
  const rows = (s.perCase || []).map((c) => {
    const cells = models.map((m) => {
      const a = results.filter((r) => r.caseId === c.id && r.model === m && r.mode === 'skill');
      const b = results.filter((r) => r.caseId === c.id && r.model === m && r.mode === 'baseline');
      return resultCell(a) + (hasBaseline ? resultCell(b) : '');
    }).join('');
    const details = models.map((m) => {
      const rs = results.filter((r) => r.caseId === c.id && r.model === m);
      return rs.map((r) => `<details><summary>${esc(m)} · ${r.mode === 'baseline' ? t.baselineCol : t.withSkillCol}${r.repeat ? ` · repeat ${r.repeat + 1}` : ''} — ${r.error ? 'ERROR' : r.pass ? 'PASS' : 'FAIL'}</summary>${r.error ? `<pre>${esc(r.error)}</pre>` : `${assertionCards(r.assertions, t)}<div class="sub" style="margin-top:6px">${t.output}${r.usage ? ` · ${r.usage.input}→${r.usage.output} tok${typeof r.usage.cost === 'number' ? ` · $${r.usage.cost.toFixed(4)}` : ''}` : ''}</div><pre>${esc(r.output)}</pre>`}</details>`).join('');
    }).join('');
    return `<tr><td><b class="mono">${esc(c.id)}</b> <span class="tag">${esc(c.lang)}</span>${(c.tags || []).map((tg) => `<span class="tag">${esc(tg)}</span>`).join('')}<div class="sub">${esc(String(c.prompt).slice(0, 220))}${String(c.prompt).length > 220 ? '…' : ''}</div><details><summary>${t.details.toLowerCase()}</summary>${details}</details></td>${cells}</tr>`;
  }).join('');

  const assertionsTable = (s.perAssertion || []).length ? `<div class="scroll"><table><tr><th>ID</th><th>Type</th><th>${t.description}</th><th>PASS</th><th>FAIL</th><th>SKIP</th><th>ERR</th></tr>${s.perAssertion.map((a) => `<tr><td class="mono">${esc(a.id)}</td><td class="mono">${esc(a.type)}</td><td>${esc(a.description || '')}</td><td class="pass">${a.pass}</td><td class="${a.fail ? 'fail' : ''}">${a.fail}</td><td class="skip">${a.skip}</td><td class="${a.error ? 'err' : ''}">${a.error}</td></tr>`).join('')}</table></div>` : '';

  const triggersTable = s.triggers?.ran ? `<div class="scroll"><table><tr><th>${t.kind}</th><th>${t.phrase}</th>${models.map((m) => `<th>${esc(m)}</th>`).join('')}</tr>${[...new Map(s.triggers.results.map((r) => [`${r.kind}|${r.phrase}`, r])).values()].map((r) => `<tr><td><span class="tag">${r.kind}</span></td><td>${esc(r.phrase)}</td>${models.map((m) => { const x = s.triggers.results.find((y) => y.kind === r.kind && y.phrase === r.phrase && y.model === m); return x ? `<td class="${x.pass ? 'pass' : 'fail'}">${x.pass ? '✓' : '✗'} <span class="sub mono">${esc(x.chosen ?? 'null')}</span></td>` : '<td>·</td>'; }).join('')}</tr>`).join('')}</table></div>` : `<div class="sub">${t.notRun}</div>`;

  const guardTable = s.guard ? (s.guard.findings.length ? `<div class="scroll"><table><tr><th>${t.severity}</th><th>${t.rule}</th><th>${t.fileLine}</th><th>${t.found}</th><th>${t.snippet}</th></tr>${s.guard.findings.map((f) => `<tr><td><span class="sev-${f.severity}">${f.severity}</span></td><td class="mono">${esc(f.id)}</td><td class="mono">${esc(f.file)}:${f.line}</td><td>${esc(f.message[L] || f.message.en)}</td><td class="mono">${esc(f.snippet)}</td></tr>`).join('')}</table></div>` : `<div class="alert ok">${t.noFindings(s.guard.scannedFiles.length)}</div>`) : `<div class="sub">${t.guardOff}</div>`;

  const lintList = s.lint ? [...s.lint.errors.map((e) => `<li class="fail">${esc(e[L] || e.en)}</li>`), ...s.lint.warnings.map((e) => `<li class="skip">${esc(e[L] || e.en)}</li>`), ...s.lint.info.map((e) => `<li class="sub">${esc(e[L] || e.en)}</li>`)].join('') : '';

  const perModel = models.length ? `<div class="scroll"><table><tr>${t.perModel.filter((_, i) => hasBaseline || (i !== 2 && i !== 3)).map((h) => `<th>${h}</th>`).join('')}</tr>${models.map((m) => { const p = s.perModel[m] || {}; const up = p.passRate != null && p.baselinePassRate != null ? p.passRate - p.baselinePassRate : null; return `<tr><td class="mono">${esc(m)}</td><td>${pct(p.passRate)}</td>${hasBaseline ? `<td>${pct(p.baselinePassRate)}</td><td>${up == null ? '—' : `${up >= 0 ? '+' : ''}${Math.round(up * 100)} ${t.pp}`}</td>` : ''}<td>${p.casesPassed}/${p.cases}</td><td>${p.errors}</td><td>${p.latencyAvgMs != null ? `${(p.latencyAvgMs / 1000).toFixed(1)}s` : '—'}</td><td>$${(p.cost || 0).toFixed(4)}</td></tr>`; }).join('')}</table></div>` : '';

  const rv = s.review;
  const quote = (x) => `<q>${esc(x)}</q>`;
  const reviewHtml = !rv ? '' : rv.error
    ? `<h2>${t.review}</h2><div class="sub">${t.reviewFailed}: ${esc(rv.error)}</div>`
    : `<h2>${t.review}</h2><div class="sub">${t.reviewNote}${rv.truncated ? ` · ${t.reviewCut}` : ''}</div>${(rv.contradictions || []).length || (rv.stale || []).length
      ? `${(rv.contradictions || []).length ? `<h3>${t.contradictions}</h3><ul>${rv.contradictions.map((c) => `<li class="fail">${quote(c.a)} ↔ ${quote(c.b)}${c.why ? ` — ${esc(c.why)}` : ''}</li>`).join('')}</ul>` : ''}${(rv.stale || []).length ? `<h3>${t.stale}</h3><ul>${rv.stale.map((c) => `<li class="skip">${quote(c.text)}${c.why ? ` — ${esc(c.why)}` : ''}</li>`).join('')}</ul>` : ''}`
      : `<p>✓ ${t.reviewClean}</p>`}${rv.summary ? `<div class="sub">${esc(rv.summary)}</div>` : ''}`;

  const glossary = `<details class="gloss" style="margin-top:18px"><summary>${t.glossary}</summary><dl>${GLOSSARY[L].map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl></details>`;

  return `<!doctype html><html lang="${L}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>SkillTest · ${esc(s.skill.name)} · ${st}</title><style>${CSS}</style></head><body><div class="wrap">
<h1>${esc(s.skill.name)} <span class="badge" style="background:${STATUS_COLOR[st]}">${st}</span></h1>
<div class="sub">${esc(String(s.timestamp).slice(0, 19).replace('T', ' '))} · SkillTest v${esc(s.version)}</div>
${plainVerdict(s, L)}
<div class="grid">${kpis}</div>
${reviewHtml}
${glossary}
<h2>${t.details}</h2>
${models.length ? `<h3>${t.models}</h3>${perModel}` : ''}
<h3>${t.cases}</h3>
${rows ? `<div class="scroll"><table><tr><th>${t.caseCol}</th>${head}</tr>${rows}</table></div>` : `<div class="sub">${t.noCases}</div>`}
<h3>${t.assertions}</h3>${assertionsTable || '<div class="sub">—</div>'}
<h3>${t.triggers}</h3>${triggersTable}
<h3>${t.guard}</h3>${guardTable}
${lintList ? `<h3>${t.lint}</h3><ul>${lintList}</ul>` : ''}
<div class="foot">${t.generated} (npm: skilleval) · ${t.footSpec}: ${esc(s.spec?.path || '—')} · ${t.footEvals}: ${esc(s.evals?.path || '—')}</div>
</div></body></html>`;
}
