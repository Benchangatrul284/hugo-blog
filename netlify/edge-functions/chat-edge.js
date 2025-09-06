// Netlify Edge Function: /api/chat (streaming)
// Proxies OpenRouter with server-side API key and streams SSE to the client

export default async (request, context) => {
  try {
    const body = await request.json();
    const { messages, model, temperature, referer, title } = body || {};
    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: 'messages[] required' }), {
        status: 400,
        headers: { 'content-type': 'application/json' },
      });
    }

    const toAscii = (v) => String(v || '').replace(/[^\x00-\x7F]/g, '');
    const OPENROUTER_BASE = (globalThis.Netlify?.env?.get?.('OPENROUTER_API_BASE')) || 'https://openrouter.ai/api/v1';
    const API_KEY = (globalThis.Netlify?.env?.get?.('OPENROUTER_API_KEY')) || (globalThis.Deno?.env?.get?.('OPENROUTER_API_KEY')) || '';
    if (!API_KEY) {
      return new Response(JSON.stringify({ error: 'missing_api_key' }), {
        status: 500,
        headers: { 'content-type': 'application/json' },
      });
    }

    const headers = {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
      'Accept': 'text/event-stream',
      'HTTP-Referer': toAscii(referer || request.headers.get('referer') || ''),
      'X-Title': toAscii(title || ''),
    };

    const resp = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: typeof model === 'string' && model.trim() ? model : 'deepseek/deepseek-chat-v3.1:free',
        temperature: typeof temperature === 'number' ? temperature : 0.2,
        messages,
        stream: true,
      }),
    });

    // If upstream didn’t stream, just pass through JSON/text
    const ct = (resp.headers.get('content-type') || '').toLowerCase();
    if (!ct.includes('text/event-stream')) {
      const text = await resp.text();
      const isJson = text.trim().startsWith('{');
      return new Response(text, {
        status: resp.status,
        headers: { 'content-type': isJson ? 'application/json' : 'text/plain' },
      });
    }

    // Stream SSE through
    return new Response(resp.body, {
      status: 200,
      headers: {
        'content-type': 'text/event-stream',
        'cache-control': 'no-cache',
        'connection': 'keep-alive',
      },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'proxy_error', message: err?.message || 'Unknown error' }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }
};

