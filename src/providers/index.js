import { openrouterChat, openrouterCatalog } from './openrouter.js';
import { anthropicChat } from './anthropic.js';
import { openaiCompatChat } from './openai-compat.js';
import { mockChat } from './mock.js';
import { sleep } from '../util.js';

const PREFIXES = ['openrouter', 'anthropic', 'openai', 'litellm', 'ollama', 'custom', 'gigachat', 'yandex'];

/**
 * Model reference format: "provider:model". Providers: openrouter, anthropic, openai, litellm, ollama,
 * gigachat, yandex, custom, mock.
 * Without a prefix: "vendor/model" => openrouter; "claude-*" => anthropic; "gpt-*"/"o*" => openai; else openrouter.
 */
export function parseModelRef(ref) {
  const s = String(ref).trim();
  if (s === 'mock' || s.startsWith('mock:')) {
    return { provider: 'mock', model: s.includes(':') ? (s.split(':')[1] || 'mock') : 'mock', ref: s };
  }
  const m = s.match(/^([a-z][a-z0-9_-]*):(.+)$/i);
  if (m && PREFIXES.includes(m[1].toLowerCase())) {
    return { provider: m[1].toLowerCase(), model: m[2], ref: s };
  }
  if (s.includes('/')) return { provider: 'openrouter', model: s, ref: s };
  if (/^claude/i.test(s)) return { provider: 'anthropic', model: s, ref: s };
  if (/^(gpt|o\d|chatgpt|text-)/i.test(s)) return { provider: 'openai', model: s, ref: s };
  return { provider: 'openrouter', model: s, ref: s };
}

export class BudgetExceeded extends Error {
  constructor(spent, cap) {
    super(`budget cap reached: spent $${spent.toFixed(4)} of $${cap}`);
    this.name = 'BudgetExceeded';
    this.spent = spent;
    this.cap = cap;
  }
}

/** Tracks spend across calls; throws when the cap is exceeded. */
export class Spend {
  constructor(capUsd) {
    this.cap = capUsd ?? Infinity;
    this.usd = 0;
    this.calls = 0;
    this.inputTokens = 0;
    this.outputTokens = 0;
    this.unknownCost = 0;
  }
  add(usage) {
    this.calls++;
    this.inputTokens += usage?.input || 0;
    this.outputTokens += usage?.output || 0;
    if (typeof usage?.cost === 'number') this.usd += usage.cost; else this.unknownCost++;
  }
  check() { if (this.usd > this.cap) throw new BudgetExceeded(this.usd, this.cap); }
  toJSON() {
    return { usd: Number(this.usd.toFixed(6)), cap: Number.isFinite(this.cap) ? this.cap : null, calls: this.calls, inputTokens: this.inputTokens, outputTokens: this.outputTokens, callsWithoutCost: this.unknownCost };
  }
}

const RETRY_BACKOFF_MS = [2000, 5000, 15000];

/**
 * Unified chat call. Returns { text, usage: {input, output, cost}, latencyMs, provider, model, ref }.
 * Retries on network/429/5xx/empty responses.
 */
export async function chat(modelRef, { system, user, temperature = 0, maxTokens = 2000, json = false, spend, mockCtx, signal, log } = {}) {
  const { provider, model, ref } = parseModelRef(modelRef);
  spend?.check();
  let lastErr;
  let tokens = maxTokens;
  for (let attempt = 0; attempt <= RETRY_BACKOFF_MS.length; attempt++) {
    const t0 = Date.now();
    try {
      let res;
      const args = { model, system, user, temperature, maxTokens: tokens, json, signal };
      switch (provider) {
        case 'openrouter': res = await openrouterChat(args); break;
        case 'anthropic': res = await anthropicChat(args); break;
        case 'openai': res = await openaiCompatChat({ ...args, kind: 'openai' }); break;
        case 'litellm': res = await openaiCompatChat({ ...args, kind: 'litellm' }); break;
        case 'ollama': res = await openaiCompatChat({ ...args, kind: 'ollama' }); break;
        case 'gigachat': res = await openaiCompatChat({ ...args, kind: 'gigachat' }); break;
        case 'yandex': res = await openaiCompatChat({ ...args, kind: 'yandex' }); break;
        case 'custom': res = await openaiCompatChat({ ...args, kind: 'custom' }); break;
        case 'mock': res = await mockChat({ ...args, ctx: mockCtx }); break;
        default: throw new Error(`unknown provider "${provider}" in model ref "${ref}"`);
      }
      const latencyMs = Date.now() - t0;
      if (!res.text || !res.text.trim()) {
        // Reasoning models can burn the whole budget on hidden reasoning (finish_reason=length, empty text):
        // retry with a larger output budget instead of failing the case.
        if (res.finishReason === 'length' || res.finishReason === 'max_tokens') tokens = Math.min(tokens * 4, 16000);
        throw Object.assign(new Error(`empty completion from ${ref} (finish_reason=${res.finishReason || 'unknown'})`), { retryable: true });
      }
      spend?.add(res.usage);
      return { ...res, latencyMs, provider, model, ref };
    } catch (e) {
      lastErr = e;
      const retryable = e.retryable || /429|5\d\d|ECONNRESET|ETIMEDOUT|fetch failed|socket|network|overloaded/i.test(String(e.message));
      if (!retryable || attempt === RETRY_BACKOFF_MS.length || e.name === 'AbortError') break;
      log?.(`retry ${attempt + 1}/${RETRY_BACKOFF_MS.length} for ${ref}: ${e.message}`);
      await sleep(RETRY_BACKOFF_MS[attempt]);
    }
  }
  throw lastErr;
}

export async function catalog(provider = 'openrouter') {
  if (provider === 'openrouter') return openrouterCatalog();
  return null;
}

/** Which providers have credentials configured in the environment. */
export function availableProviders(env = process.env) {
  const out = [];
  if (env.OPENROUTER_API_KEY) out.push('openrouter');
  if (env.ANTHROPIC_API_KEY || env.ANTHROPIC_AUTH_TOKEN) out.push('anthropic');
  if (env.OPENAI_API_KEY) out.push('openai');
  if (env.LITELLM_BASE_URL) out.push('litellm');
  if (env.OLLAMA_BASE_URL) out.push('ollama');
  if (env.GIGACHAT_BASE_URL) out.push('gigachat');
  if (env.YANDEX_BASE_URL) out.push('yandex');
  if (env.CUSTOM_LLM_BASE_URL) out.push('custom');
  return out;
}
