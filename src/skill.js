import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import { exists, readText, estimateTokens } from './util.js';

/** Limits from the Agent Skills spec (agentskills.io / Anthropic docs). */
export const LIMITS = {
  nameMax: 64,
  descriptionMax: 1024,
  bodyRecommendedTokens: 5000,
  // Claude Code default budget for ALL skill/command descriptions in the system prompt.
  descriptionBudgetChars: 15000,
};

export function resolveSkillDir(input) {
  const p = path.resolve(input || '.');
  if (fs.existsSync(p) && fs.statSync(p).isFile()) return path.dirname(p);
  return p;
}

/** Parse YAML frontmatter + body from a SKILL.md string. */
/** Last-resort frontmatter reader: `key: value` per line, first colon wins, lists as comma or dash separated. */
function recoverFrontmatter(block) {
  const out = {};
  let lastKey = null;
  for (const raw of String(block).split(/\r?\n/)) {
    const line = raw.replace(/\s+$/, '');
    if (!line.trim() || /^\s*#/.test(line)) continue;
    const item = line.match(/^\s*-\s+(.*)$/);
    if (item && lastKey) {
      const v = item[1].trim().replace(/^["']|["']$/g, '');
      out[lastKey] = Array.isArray(out[lastKey]) ? [...out[lastKey], v] : (out[lastKey] ? [out[lastKey], v] : [v]);
      continue;
    }
    const kv = line.match(/^([A-Za-z][\w.-]{0,40})\s*:\s*(.*)$/);
    if (!kv) continue;
    lastKey = kv[1];
    const value = kv[2].trim().replace(/^["']|["']$/g, '');
    if (!value) { out[lastKey] = ''; continue; }
    if (/^\[.*\]$/.test(value)) out[lastKey] = value.slice(1, -1).split(',').map((x) => x.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
    else out[lastKey] = value;
  }
  for (const k of Object.keys(out)) if (out[k] === '') delete out[k];
  return out;
}

export function parseSkillMd(text) {
  const src = text.replace(/^﻿/, '');
  const m = src.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return { frontmatter: null, body: src, raw: src, frontmatterError: 'no YAML frontmatter block found' };
  let frontmatter = null;
  let frontmatterError = null;
  let frontmatterRecovered = false;
  try {
    frontmatter = YAML.parse(m[1]) || {};
  } catch (e) {
    frontmatterError = `YAML parse error: ${e.message}`;
    // The usual cause is a colon inside an unquoted value ("use the tool: send a message"), which is invalid YAML but
    // still perfectly readable. Recover the scalar fields rather than pretend the skill has no name at all.
    frontmatter = recoverFrontmatter(m[1]);
    frontmatterRecovered = Object.keys(frontmatter).length > 0;
  }
  return { frontmatter, body: m[2], raw: src, frontmatterError, frontmatterRecovered };
}

/** Load a skill from a directory containing SKILL.md. */
export function loadSkill(dir) {
  const skillDir = resolveSkillDir(dir);
  const mdPath = ['SKILL.md', 'skill.md', 'Skill.md'].map((n) => path.join(skillDir, n)).find(exists);
  if (!mdPath) {
    throw new Error(`SKILL.md not found in ${skillDir}`);
  }
  const raw = readText(mdPath);
  const parsed = parseSkillMd(raw);
  const fm = parsed.frontmatter || {};
  const name = typeof fm.name === 'string' ? fm.name.trim() : path.basename(skillDir);
  const description = typeof fm.description === 'string' ? fm.description.trim() : '';
  const files = listSkillFiles(skillDir);
  const whenToUse = extractSection(parsed.body, /^#{1,4}\s*(?:when\s+to\s+use|когда\s+(?:использовать|применять)|use\s+(?:this\s+skill\s+)?when)\b.*$/im);
  // Hermes skills declare metadata.hermes (official hub) or carry both category and tags; a "When to use" section alone is
  // ordinary Agent Skills style and must not flip the dialect (it used to penalise Anthropic's own skills for description length).
  // Four families in the wild: the plain Agent Skills format, the Hermes dialect, Claude Code commands and plugins,
  // and the agent-team style that assigns a role inside a squad.
  const fmKeys = new Set(Object.keys(fm || {}).map((k) => k.toLowerCase()));
  const anyKey = (...names) => names.some((n) => fmKeys.has(n));
  const dialect = fm.metadata?.hermes || (fm.category && fm.tags) ? 'hermes'
    : anyKey('argument-hint', 'user-invokable', 'disable-model-invocation', 'plugin') ? 'command'
      : (fmKeys.has('role') && anyKey('squad', 'reports-to', 'phase')) ? 'team'
        : 'anthropic';
  return {
    dir: skillDir,
    mdPath,
    name,
    description,
    dialect,
    whenToUse,
    frontmatter: fm,
    frontmatterError: parsed.frontmatterError,
    frontmatterRecovered: Boolean(parsed.frontmatterRecovered),
    body: parsed.body,
    raw: parsed.raw,
    bodyTokens: estimateTokens(parsed.body),
    files,
  };
}

/**
 * List files in the skill folder (relative posix paths), skipping noise.
 * Nested folders that contain their own SKILL.md are separate skills and are NOT part of this one
 * (a repo-root SKILL.md must not "own" every skill in the monorepo).
 */
/** Return the text of the markdown section whose heading matches `headingRe` (up to the next heading of the same or higher level), or ''. */
export function extractSection(body, headingRe) {
  const lines = String(body || '').split(/\r?\n/);
  const start = lines.findIndex((l) => headingRe.test(l));
  if (start < 0) return '';
  const level = (lines[start].match(/^#+/) || ['#'])[0].length;
  const out = [];
  for (let i = start + 1; i < lines.length; i++) {
    const m = lines[i].match(/^(#+)\s/);
    if (m && m[1].length <= level) break;
    out.push(lines[i]);
  }
  return out.join('\n').trim();
}

export function listSkillFiles(dir, opts = {}) {
  const skip = new Set(['node_modules', '.git', '.skilltest', '.skilltest-audit', '__pycache__', '.venv', 'venv', '.DS_Store']);
  const maxBytes = opts.maxBytes ?? 2 * 1024 * 1024;
  const out = [];
  const walk = (d, rel) => {
    let entries = [];
    try { entries = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    if (rel && entries.some((e) => e.isFile() && /^skill\.md$/i.test(e.name))) return;
    for (const e of entries) {
      if (skip.has(e.name)) continue;
      const full = path.join(d, e.name);
      const r = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) walk(full, r);
      else if (e.isFile()) {
        let size = 0;
        try { size = fs.statSync(full).size; } catch { /* ignore */ }
        out.push({ path: r, full, size, tooBig: size > maxBytes });
      }
    }
  };
  walk(dir, '');
  return out;
}

const TEXT_EXT = new Set(['.md', '.txt', '.json', '.yaml', '.yml', '.py', '.js', '.ts', '.sh', '.bat', '.ps1', '.cmd', '.command', '.csv', '.toml', '.ini', '.cfg', '.html', '.htm', '.xml', '.env', '.mjs', '.cjs', '.rb', '.go', '.rs', '.java', '.sql', '.jsx', '.tsx']);

export function isTextFile(p) {
  const ext = path.extname(p).toLowerCase();
  if (TEXT_EXT.has(ext)) return true;
  if (!ext) {
    const base = path.basename(p).toLowerCase();
    return ['dockerfile', 'makefile', 'license', 'readme'].includes(base);
  }
  return false;
}

/**
 * A script that carries no extension — scripts/run, bin/deploy — announces itself on its first line instead.
 * Skipping such files by name meant a payload placed in one was never scanned and got a clean grade.
 */
export function looksLikeScript(full) {
  if (path.extname(full)) return false;
  try {
    const fd = fs.openSync(full, 'r');
    try { const b = Buffer.alloc(2); const n = fs.readSync(fd, b, 0, 2, 0); return n === 2 && b[0] === 0x23 && b[1] === 0x21; }
    finally { fs.closeSync(fd); }
  } catch { return false; }
}

/** Build the system prompt that "loads" the skill for a single-turn eval. */
export function buildSkillSystemPrompt(skill, opts = {}) {
  const wanted = expandIncludes(skill, opts.includeFiles || [], { budget: opts.includeBudget });
  const extra = wanted.map((rel) => {
    const full = path.join(skill.dir, rel);
    if (!exists(full)) return `<file path="${rel}">(missing)</file>`;
    return `<file path="${rel}">\n${readText(full)}\n</file>`;
  }).join('\n\n');
  const lead = opts.lead ?? (
    'You are an AI assistant with the following Agent Skill loaded. ' +
    'Follow the skill instructions precisely when they apply to the user request. ' +
    'Reference files bundled with the skill are provided inline where available.'
  );
  return [
    lead,
    `<skill name="${skill.name}">`,
    `<description>${skill.description}</description>`,
    skill.body.trim(),
    extra ? `\n<references>\n${extra}\n</references>` : '',
    '</skill>',
  ].filter(Boolean).join('\n');
}

/**
 * Expand include patterns against the skill's file list.
 *  - plain paths pass through;
 *  - globs (`rules/*.md`, `references/**`) match files;
 *  - `auto` = files referenced from the SKILL.md body (links, backtick paths) plus markdown under
 *    rules/, references/, reference/, docs/ — in that order, cut at `budget` estimated tokens (default 24k).
 */
export function expandIncludes(skill, patterns, { budget = 24000 } = {}) {
  const out = [];
  const usable = (f) => f && !f.tooBig && isTextFile(f.path) && !/^skill\.md$/i.test(f.path);
  for (const pat of patterns) {
    if (pat === 'auto') {
      const byPath = new Map(skill.files.map((f) => [f.path.toLowerCase(), f]));
      const refs = [];
      for (const m of skill.body.matchAll(/\]\(([^)\s#]+)\)/g)) refs.push(m[1]);
      for (const m of skill.body.matchAll(/`([\w./-]+\/[\w.-]+\.(?:md|txt|yaml|yml|json))`/gi)) refs.push(m[1]);
      for (const m of skill.body.matchAll(/(?<![\w/])((?:rules|references?|docs|guides?|templates?|assets)\/[\w./-]+\.(?:md|txt))(?![\w/])/gi)) refs.push(m[1]);
      const ordered = [];
      for (const r of refs) { const f = byPath.get(r.replace(/^\.\//, '').toLowerCase()); if (usable(f)) ordered.push(f); }
      for (const f of skill.files) if (/^(?:rules|references?|docs)\/[^/]+\.md$/i.test(f.path) && usable(f)) ordered.push(f);
      let used = 0;
      for (const f of ordered) {
        if (out.includes(f.path)) continue;
        const est = Math.ceil(f.size / 4);
        if (used + est > budget) continue;
        used += est; out.push(f.path);
      }
      continue;
    }
    if (!/[*?]/.test(pat)) { out.push(pat); continue; }
    const re = new RegExp(`^${pat.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*\*/g, '§§').replace(/\*/g, '[^/]*').replace(/§§/g, '.*').replace(/\?/g, '.')}$`, 'i');
    for (const f of skill.files) if (re.test(f.path) && usable(f)) out.push(f.path);
  }
  return [...new Set(out)];
}

export function baselineSystemPrompt() {
  return 'You are a helpful AI assistant. Answer the user request as well as you can.';
}

/**
 * One line that says what the skill does, for a card or a listing.
 *
 * Descriptions in the wild mix the trigger ("Use when the user asks to…") with the substance, and often run for a
 * paragraph. The trigger belongs to discovery, not to a preview, so it is dropped and the first real sentence kept.
 */
export function summarize(skill, { max = 160 } = {}) {
  const clean = (t) => String(t || '')
    .replace(/\s+/g, ' ')
    .replace(/[*_`#]+/g, '')
    .trim();
  let text = clean(skill.description);
  // Drop a leading trigger clause: "Use when …, " / "Используйте, когда …, " up to the first sentence break.
  text = text.replace(/^(?:use\s+(?:this\s+)?(?:skill\s+)?when[^.;]{0,160}[.;]\s*|используйте?,?\s+когда[^.;]{0,160}[.;]\s*|применяйте[^.;]{0,160}[.;]\s*)/i, '');
  if (!text) {
    const body = clean(String(skill.body || '').split('\n').filter((l) => l.trim() && !/^#{1,6}\s/.test(l) && !/^[-*+|>]/.test(l)).slice(0, 2).join(' '));
    text = body;
  }
  const sentence = text.match(/^[^.!?]{20,}?[.!?](?=\s|$)/);
  let out = (sentence ? sentence[0] : text).trim();
  if (out.length > max) out = `${out.slice(0, max - 1).replace(/[\s,;:]+\S*$/, '')}…`;
  return out;
}
