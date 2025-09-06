// Netlify Function: /api/chat
// Proxies chat requests to OpenRouter using a server-side API key

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '';
const OPENROUTER_BASE = process.env.OPENROUTER_API_BASE || 'https://openrouter.ai/api/v1';
const ALLOW_ORIGIN = process.env.CORS_ORIGIN || '*';

const baseHeaders = {
  'Access-Control-Allow-Origin': ALLOW_ORIGIN,
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: baseHeaders };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: baseHeaders, body: 'Method Not Allowed' };
  }

  if (!OPENROUTER_API_KEY) {
    return {
      statusCode: 500,
      headers: baseHeaders,
      body: JSON.stringify({ error: 'missing_api_key', message: 'OPENROUTER_API_KEY is not configured' }),
    };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const { messages, model, temperature, referer, title } = body;
    if (!Array.isArray(messages) || messages.length === 0) {
      return { statusCode: 400, headers: baseHeaders, body: JSON.stringify({ error: 'messages[] required' }) };
    }

    // Ensure header values are ASCII per undici ByteString requirement
    const toAscii = (v) => String(v || '').replace(/[^\x00-\x7F]/g, '');

    const headers = {
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': toAscii(referer || event.headers['referer'] || ''),
      'X-Title': toAscii(title || ''),
    };

    const resp = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: typeof model === 'string' && model.trim() ? model : 'deepseek/deepseek-chat-v3.1:free',
        temperature: typeof temperature === 'number' ? temperature : 0.2,
        messages,
      }),
    });

    const text = await resp.text();
    // Pass through body; try JSON first
    try {
      const json = JSON.parse(text);
      return { statusCode: resp.status, headers: { ...baseHeaders, 'Content-Type': 'application/json' }, body: JSON.stringify(json) };
    } catch {
      return { statusCode: resp.status, headers: { ...baseHeaders, 'Content-Type': 'text/plain' }, body: text };
    }
  } catch (err) {
    return { statusCode: 500, headers: baseHeaders, body: JSON.stringify({ error: 'proxy_error', message: err?.message || 'Unknown error' }) };
  }
};

