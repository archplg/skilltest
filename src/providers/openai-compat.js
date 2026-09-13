/**
 * Generic OpenAI-compatible chat completions. Used for OpenAI, LiteLLM proxy (GigaChat/YandexGPT/anything),
 * Ollama, and custom endpoints.
 *
 * Env per kind:
 *   openai:   OPENAI_API_KEY, OPENAI_BASE_URL (default https://api.openai.com/v1)
 *   litellm:  LITELLM_BASE_URL (e.g. http://localhost:4000), LITELLM_API_KEY
 *   ollama:   OLLAMA_BASE_URL (default http://localhost:11434/v1), no key
 *   gigachat: GIGACHAT_BASE_URL (OpenAI-compatible gateway/proxy), GIGACHAT_API_KEY
 *   yandex:   YANDEX_BASE_URL (OpenAI-compatible gateway/proxy), YANDEX_API_KEY
 *   custom:   CUSTOM_LLM_BASE_URL, CUSTOM_LLM_API_KEY
 */
const CONFIG = {
  openai: { base: 'OPENAI_BASE_URL', key: 'OPENAI_API_KEY', defaultBase: 'https://api.openai.com/v1', needsKey: true },
  litellm: { base: 'LITELLM_BASE_URL', key: 'LITELLM_API_KEY', defaultBase: 'http://localhost:4000', needsKey: false },
  ollama: { base: 'OLLAMA_BASE_URL', key: 'OLLAMA_API_KEY', defaultBase: 'http://localhost:11434/v1', needsKey: false },
  gigachat: { base: 'GIGACHAT_BASE_URL', key: 'GIGACHAT_API_KEY', defaultBase: null, needsKey: false },
  yandex: { base: 'YANDEX_BASE_URL', key: 'YANDEX_API_KEY', defaultBase: null, needsKey: false },
  custom: { base: 'CUSTOM_LLM_BASE_URL', key: 'CUSTOM_LLM_API_KEY', defaultBase: null, needsKey: false },
};

export async function openaiCompatChat({ kind, model, system, user, temperature, maxTokens, json, signal }) {
  const cfg = CONFIG[kind];
  if (!cfg) throw new Error(`unknown openai-compatible kind "${kind}"`);
  const base = (process.env[cfg.base] || cfg.defaultBase || '').replace(/\/$/, '');
  if (!base) throw new Error(`${cfg.base} is not set (provider "${kind}")`);
  const key = process.env[cfg.key];
  if (cfg.needsKey && !key) throw new Error(`${cfg.key} is not set`);
  const messages = [];
  if (system) messages.push({ role: 'system', content: system });
  messages.push({ role: 'user', content: user });
  const body = { model, messages, temperature, max_tokens: maxTokens };
  if (json && kind !== 'ollama') body.response_format = { type: 'json_object' };
  const headers = { 'Content-Type': 'application/json' };
  if (key) headers.Authorization = `Bearer ${key}`;
  const url = base.endsWith('/chat/completions') ? base : `${base}/chat/completions`;
  const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body), signal });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    const err = new Error(`${kind} ${res.status}: ${txt.slice(0, 300)}`);
    err.retryable = res.status === 429 || res.status >= 500;
    throw err;
  }
  const data = await res.json();
  const choice = data.choices?.[0];
  const content = choice?.message?.content;
  const text = typeof content === 'string' ? content : Array.isArray(content) ? content.map((p) => p?.text || '').join('') : '';
  const usage = data.usage || {};
  return {
    text,
    finishReason: choice?.finish_reason,
    usage: { input: usage.prompt_tokens ?? 0, output: usage.completion_tokens ?? 0, cost: typeof usage.cost === 'number' ? usage.cost : undefined },
    raw: data,
  };
}
