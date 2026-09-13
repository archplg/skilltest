import fs from 'node:fs';
import path from 'node:path';

export const EXIT = { OK: 0, FAIL: 1, ERROR: 2, GUARD: 3 };

const isTTY = process.stdout.isTTY && !process.env.NO_COLOR;
const c = (code) => (s) => (isTTY ? `\x1b[${code}m${s}\x1b[0m` : String(s));
export const color = {
  red: c(31), green: c(32), yellow: c(33), blue: c(34), magenta: c(35), cyan: c(36),
  gray: c(90), bold: c(1), dim: c(2),
};

export function readText(p) {
  return fs.readFileSync(p, 'utf8');
}

export function exists(p) {
  try { fs.accessSync(p); return true; } catch { return false; }
}

export function readJson(p) {
  return JSON.parse(readText(p));
}

export function writeJson(p, obj) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(obj, null, 2) + '\n', 'utf8');
}

export function writeText(p, text) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, text, 'utf8');
}

/** Rough token estimate: ~4 chars/token for Latin, ~2.5 chars/token for Cyrillic. */
export function estimateTokens(text) {
  if (!text) return 0;
  const cyr = (text.match(/[Ѐ-ӿ]/g) || []).length;
  const other = text.length - cyr;
  return Math.ceil(other / 4 + cyr / 2.5);
}

export function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Minimal concurrency limiter. */
export function createLimiter(n) {
  let active = 0;
  const queue = [];
  const next = () => {
    if (active >= n || queue.length === 0) return;
    active++;
    const { fn, resolve, reject } = queue.shift();
    Promise.resolve()
      .then(fn)
      .then(resolve, reject)
      .finally(() => { active--; next(); });
  };
  return (fn) => new Promise((resolve, reject) => { queue.push({ fn, resolve, reject }); next(); });
}

export function pct(x, digits = 0) {
  if (x == null || Number.isNaN(x)) return '—';
  return (x * 100).toFixed(digits) + '%';
}

export function nowIso() {
  return new Date().toISOString();
}

export function truncate(s, n = 400) {
  if (!s) return '';
  s = String(s);
  return s.length > n ? s.slice(0, n) + '…' : s;
}

/**
 * Detect dominant script language: 'ru' | 'en' | 'mixed' | 'unknown'.
 * Ignores code blocks and URLs. For JSON outputs only free-text string values are considered
 * (keys and short enum-like labels such as "billing" would otherwise skew the ratio).
 */
export function detectLang(text) {
  if (!text) return 'unknown';
  let src = String(text);
  const jsonText = extractJsonFreeText(src);
  if (jsonText != null) src = jsonText;
  const cleaned = src
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/https?:\/\/\S+/g, ' ');
  const cyr = (cleaned.match(/[Ѐ-ӿ]/g) || []).length;
  const lat = (cleaned.match(/[A-Za-z]/g) || []).length;
  const total = cyr + lat;
  if (total < 5) return 'unknown';
  const r = cyr / total;
  if (r >= 0.65) return 'ru';
  if (r <= 0.35) return 'en';
  return 'mixed';
}

function extractJsonFreeText(s) {
  const t = s.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  if (!/^[[{]/.test(t)) return null;
  let obj;
  try { obj = JSON.parse(t); } catch { return null; }
  const strings = [];
  const walk = (v) => {
    if (typeof v === 'string') strings.push(v);
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === 'object') Object.values(v).forEach(walk);
  };
  walk(obj);
  const long = strings.filter((x) => x.length > 20);
  return (long.length ? long : strings).join(' ');
}

export function i18n(lang) {
  const ru = lang === 'ru';
  return (ruText, enText) => (ru ? ruText : enText);
}

/** Escape HTML. */
export function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export function parseList(v) {
  if (!v) return [];
  if (Array.isArray(v)) return v.flatMap(parseList);
  return String(v).split(',').map((s) => s.trim()).filter(Boolean);
}

export function relative(from, to) {
  const r = path.relative(from, to);
  return r.split(path.sep).join('/');
}
