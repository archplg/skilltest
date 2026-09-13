const BASE = () => (process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com').replace(/\/$/, '');

export async function anthropicChat({ model, system, user, temperature, maxTokens, signal }) {
  const key = process.env.ANTHROPIC_API_KEY;
  const token = process.env.ANTHROPIC_AUTH_TOKEN;
  if (!key && !token) throw new Error('ANTHROPIC_API_KEY (or ANTHROPIC_AUTH_TOKEN) is not set');
  const headers = {
    'Content-Type': 'application/json',
    'anthropic-version': '2023-06-01',
  };
  if (key) headers['x-api-key'] = key;
  if (token) headers.Authorization = `Bearer ${token}`;
  const body = {
    model,
    max_tokens: maxTokens,
    temperature,
    messages: [{ role: 'user', content: user }],
  };
  if (system) body.system = system;
  const res = await fetch(`${BASE()}/v1/messages`, { method: 'POST', headers, body: JSON.stringify(body), signal });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    const err = new Error(`anthropic ${res.status}: ${txt.slice(0, 300)}`);
    err.retryable = res.status === 429 || res.status === 529 || res.status >= 500;
    throw err;
  }
  const data = await res.json();
  const text = (data.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('');
  return {
    text,
    finishReason: data.stop_reason,
    usage: { input: data.usage?.input_tokens ?? 0, output: data.usage?.output_tokens ?? 0, cost: undefined },
    raw: data,
  };
}
