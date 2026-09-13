const BASE = () => (process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1').replace(/\/$/, '');

let catalogCache = null;

export async function openrouterChat({ model, system, user, temperature, maxTokens, json, signal }) {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error('OPENROUTER_API_KEY is not set');
  const messages = [];
  if (system) messages.push({ role: 'system', content: system });
  messages.push({ role: 'user', content: user });
  const body = {
    model,
    messages,
    temperature,
    max_tokens: maxTokens,
    usage: { include: true },
  };
  if (json) body.response_format = { type: 'json_object' };
  const res = await fetch(`${BASE()}/chat/completions`, {
    method: 'POST',
    signal,
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://github.com/archplg/skilltest',
      'X-Title': 'SkillTest',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    const err = new Error(`openrouter ${res.status}: ${txt.slice(0, 300)}`);
    err.retryable = res.status === 429 || res.status >= 500;
    throw err;
  }
  const data = await res.json();
  if (data.error) {
    const err = new Error(`openrouter error: ${data.error.message || JSON.stringify(data.error)}`);
    err.retryable = /rate|overload|timeout|busy/i.test(err.message);
    throw err;
  }
  const choice = data.choices?.[0];
  const text = extractText(choice?.message?.content);
  const usage = data.usage || {};
  return {
    text,
    finishReason: choice?.finish_reason,
    usage: {
      input: usage.prompt_tokens ?? 0,
      output: usage.completion_tokens ?? 0,
      cost: typeof usage.cost === 'number' ? usage.cost : undefined,
    },
    raw: data,
  };
}

function extractText(content) {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) return content.map((p) => (typeof p === 'string' ? p : p?.text || '')).join('');
  return '';
}

export async function openrouterCatalog() {
  if (catalogCache) return catalogCache;
  const res = await fetch(`${BASE()}/models`);
  if (!res.ok) throw new Error(`openrouter catalog ${res.status}`);
  const data = await res.json();
  const map = new Map();
  for (const m of data.data || []) {
    map.set(m.id, {
      id: m.id,
      name: m.name,
      context: m.context_length,
      promptUsdPerM: Math.max(0, Number(m.pricing?.prompt || 0) * 1e6),
      completionUsdPerM: Math.max(0, Number(m.pricing?.completion || 0) * 1e6),
    });
  }
  catalogCache = map;
  return map;
}
