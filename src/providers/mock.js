/**
 * Offline mock provider for demos and tests. No network, no cost.
 * Behaviour:
 *  - If the eval case defines `mock: { skill: "...", baseline: "..." }`, returns that text for the mode.
 *  - Judge calls (ctx.role === 'judge') return a deterministic JSON verdict based on simple heuristics.
 *  - Trigger calls (ctx.role === 'trigger') pick the skill whose description shares the most words with the message.
 *  - Otherwise returns a generic answer in the language of the prompt.
 */
import { detectLang } from '../util.js';

export async function mockChat({ model, system, user, ctx }) {
  const role = ctx?.role || 'answer';
  let text;
  if (role === 'judge') text = judge(ctx, user);
  else if (role === 'trigger') text = trigger(ctx, user);
  else if (role === 'draft') text = draft(user);
  else if (role === 'review') text = review(user);
  else text = answer(ctx, system, user);
  const inTok = Math.ceil(((system?.length || 0) + user.length) / 4);
  const outTok = Math.ceil(text.length / 4);
  return { text, finishReason: 'stop', usage: { input: inTok, output: outTok, cost: 0 }, raw: { mock: true, model } };
}

function answer(ctx, system, user) {
  const mode = ctx?.mode || 'skill';
  const c = ctx?.testCase;
  if (c?.mock && typeof c.mock === 'object' && c.mock[mode]) return String(c.mock[mode]);
  if (c?.mock && typeof c.mock === 'string' && mode === 'skill') return c.mock;
  const lang = detectLang(user);
  if (mode === 'baseline') {
    return lang === 'ru'
      ? 'Вот общий ответ на ваш запрос без специальных инструкций. Уточните, пожалуйста, детали задачи.'
      : 'Here is a general answer to your request without special instructions. Please clarify the task details.';
  }
  return lang === 'ru'
    ? `Выполняю по инструкциям скилла. Результат: ${(c?.expected_output || 'задача выполнена').slice(0, 200)}`
    : `Following the skill instructions. Result: ${(c?.expected_output || 'task completed').slice(0, 200)}`;
}

/**
 * Deterministic stand-in for an LLM judge:
 *  - refusal-looking openers fail;
 *  - if the expectation mentions JSON, the response must (or must NOT, when the expectation says "no JSON") contain an object;
 *  - otherwise pass when the response is substantive.
 */
function judge(ctx, user) {
  const m = user.match(/<response>\n?([\s\S]*?)\n?<\/response>/);
  const response = (m ? m[1] : user).trim();
  const expected = (user.match(/<expected_output>\n?([\s\S]*?)\n?<\/expected_output>/)?.[1] || user.match(/<rubric>\n?([\s\S]*?)\n?<\/rubric>/)?.[1] || '').trim();
  const refusing = /^(?:sorry|извините|к сожалению|i can(?:'t|not)|я не могу|as an ai)/i.test(response) || /general answer|общий ответ|уточните, пожалуйста/i.test(response);
  let pass = response.length > 20 && !refusing;
  let why = pass ? 'mock judge: response is substantive' : 'mock judge: response is generic or refusing';
  if (pass && /json/i.test(expected)) {
    // "NO JSON object", "not output JSON", "without JSON" — but not "No text outside the JSON".
    const wantsNoJson = /\b(?:no|not|without|never)\s+(?:\w+\s+){0,2}json\b/i.test(expected) || /json[^.]{0,20}\b(?:must not|should not|not allowed)\b/i.test(expected);
    const hasJson = /\{[\s\S]*"[^"]+"\s*:/.test(response);
    pass = wantsNoJson ? !hasJson : hasJson;
    why = pass ? 'mock judge: JSON expectation satisfied' : (wantsNoJson ? 'mock judge: JSON present but expectation says no JSON' : 'mock judge: expected JSON object, none found');
  }
  return JSON.stringify({ pass, score: pass ? 0.9 : 0.2, reason: why });
}

function draft(user) {
  const name = user.match(/^name:\s*(.+)$/m)?.[1]?.trim() || 'skill';
  const desc = user.match(/^description:\s*(.+)$/m)?.[1]?.trim() || '';
  const words = desc.split(/[^\p{L}]+/u).filter((w) => w.length > 4).slice(0, 3).join(' ');
  return JSON.stringify({
    triggers: { positive: [`помоги с ${name}: ${words}`, `use ${name} for ${words}`], negative: ['переведи этот текст на английский', 'merge these two PDF files'] },
    assertions: [{ id: 'A1', type: 'language', description: 'Answer in the user language' }],
    cases: [
      { id: 'ru-basic', lang: 'ru', tags: ['happy-path'], prompt: `Мне нужно: ${words}. Помоги.`, expected_output: 'Полезный ответ по теме скилла на русском.' },
      { id: 'en-basic', lang: 'en', tags: ['happy-path'], prompt: `I need help with ${words}.`, expected_output: 'A useful on-topic answer in English.' },
      { id: 'out-of-scope', lang: 'en', tags: ['negative', 'out-of-scope'], prompt: 'Write a haiku about autumn.', expected_output: 'Declines or answers as a plain assistant; no skill-specific format.' },
    ],
  });
}

function trigger(ctx, user) {
  const msg = (user.match(/<user_message>\n?([\s\S]*?)\n?<\/user_message>/)?.[1] || '').toLowerCase();
  const skills = ctx?.skills || [];
  const words = new Set(msg.split(/[^\p{L}\p{N}]+/u).filter((w) => w.length > 3));
  let best = null;
  let bestScore = 0;
  for (const s of skills) {
    const dwords = new Set(`${s.name} ${s.description}`.toLowerCase().split(/[^\p{L}\p{N}]+/u));
    let score = 0;
    for (const w of words) if (dwords.has(w)) score++;
    for (const w of words) for (const d of dwords) if (d.length > 4 && w.length > 4 && d.slice(0, 5) === w.slice(0, 5)) score += 0.5;
    if (score > bestScore) { bestScore = score; best = s.name; }
  }
  return JSON.stringify({ skill: bestScore >= 1 ? best : null, reason: 'mock trigger: lexical overlap' });
}

/**
 * Stand-in for the content reviewer: an "always …" line and a "never …" line about the same thing are a
 * contradiction; a line that calls something deprecated is a leftover.
 */
function review(user) {
  const lines = user.split('\n').map((l) => l.trim()).filter(Boolean);
  const words = (l) => l.toLowerCase().match(/[a-zа-я]{4,}/g) || [];
  const contradictions = [];
  for (const a of lines.filter((l) => /^(?:[-*]\s*)?(?:always|всегда)\b/i.test(l))) {
    for (const b of lines.filter((l) => /^(?:[-*]\s*)?(?:never|никогда)\b/i.test(l))) {
      const wa = new Set(words(a));
      const shared = words(b).filter((w) => wa.has(w) && !/^(?:always|never|всегда|никогда)$/.test(w));
      if (shared.length) contradictions.push({ a: a.slice(0, 160), b: b.slice(0, 160), why: `mock review: both rules speak of "${shared[0]}"` });
    }
  }
  const stale = lines.filter((l) => /deprecated|legacy|устарел|старая версия/i.test(l)).slice(0, 5).map((l) => ({ text: l.slice(0, 160), why: 'mock review: marked as outdated but still in the text' }));
  const summary = contradictions.length || stale.length ? 'mock review: the text carries conflicting or outdated rules' : 'mock review: the text is consistent';
  return JSON.stringify({ contradictions, stale, summary });
}
