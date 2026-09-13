import path from 'node:path';
import { writeJson, writeText } from '../util.js';
import { renderHtml } from './html.js';
import { renderJunit } from './junit.js';
import { renderSarif } from './sarif.js';

/** Write the selected report formats into outDir. Returns { json, html, junit, sarif } paths. */
export function writeReports(summary, outDir, formats = ['json', 'html', 'junit', 'sarif'], { lang = 'en' } = {}) {
  const out = {};
  const clean = JSON.parse(JSON.stringify(summary, (k, v) => (k === 'raw' && typeof v === 'object' ? undefined : v)));
  if (formats.includes('json')) { out.json = path.join(outDir, 'results.json'); writeJson(out.json, clean); }
  if (formats.includes('html')) { out.html = path.join(outDir, 'report.html'); writeText(out.html, renderHtml(clean, { lang })); }
  if (formats.includes('junit')) { out.junit = path.join(outDir, 'junit.xml'); writeText(out.junit, renderJunit(clean)); }
  if (formats.includes('sarif') && summary.guard) { out.sarif = path.join(outDir, 'guard.sarif'); writeJson(out.sarif, renderSarif(clean)); }
  return out;
}
