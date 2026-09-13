import { esc } from '../util.js';

/** JUnit XML: one testsuite per model (with-skill results), one testcase per eval case; guard and triggers as extra suites. */
export function renderJunit(s) {
  const suites = [];
  for (const model of s.models || []) {
    const res = (s.results || []).filter((r) => r.model === model && r.mode === 'skill');
    const cases = res.map((r) => {
      const failed = r.assertions.filter((a) => a.status === 'FAIL' || a.status === 'ERROR');
      let body = '';
      if (r.error) body = `<error message="${esc(r.error)}"/>`;
      else if (failed.length) body = `<failure message="${esc(failed.map((a) => `${a.id}: ${a.reason}`).join('; '))}">${esc(failed.map((a) => `[${a.id} ${a.type}] ${a.reason}\n${a.evidence || ''}`).join('\n\n'))}</failure>`;
      return `    <testcase classname="${esc(s.skill.name)}.${esc(model)}" name="${esc(r.caseId)}" time="${((r.latencyMs || 0) / 1000).toFixed(3)}">${body}</testcase>`;
    });
    const failures = res.filter((r) => !r.pass && !r.error).length; const errors = res.filter((r) => r.error).length;
    suites.push(`  <testsuite name="${esc(s.skill.name)} @ ${esc(model)}" tests="${res.length}" failures="${failures}" errors="${errors}">\n${cases.join('\n')}\n  </testsuite>`);
  }
  if (s.triggers?.ran) {
    const tc = s.triggers.results.map((t) => `    <testcase classname="${esc(s.skill.name)}.triggers" name="[${t.kind}] ${esc(t.phrase)} @ ${esc(t.model)}">${t.pass ? '' : `<failure message="chose ${esc(t.chosen ?? 'null')}"/>`}</testcase>`);
    suites.push(`  <testsuite name="${esc(s.skill.name)} triggers" tests="${s.triggers.results.length}" failures="${s.triggers.results.filter((t) => !t.pass).length}" errors="0">\n${tc.join('\n')}\n  </testsuite>`);
  }
  if (s.guard) {
    const f = s.guard.findings;
    const tc = f.length ? f.map((x) => `    <testcase classname="${esc(s.skill.name)}.guard" name="${esc(x.id)} ${esc(x.file)}:${x.line}"><failure message="${esc(x.severity)}: ${esc(x.message.en)}">${esc(x.snippet)}</failure></testcase>`) : [`    <testcase classname="${esc(s.skill.name)}.guard" name="no findings"/>`];
    suites.push(`  <testsuite name="${esc(s.skill.name)} guard" tests="${Math.max(1, f.length)}" failures="${f.length}" errors="0">\n${tc.join('\n')}\n  </testsuite>`);
  }
  return `<?xml version="1.0" encoding="UTF-8"?>\n<testsuites name="skilltest ${esc(s.skill.name)}" status="${esc(s.status)}">\n${suites.join('\n')}\n</testsuites>\n`;
}
