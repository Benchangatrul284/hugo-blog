// Netlify Function: /api/chat
// Proxies chat requests to the Gemini (Google Generative Language) API using a server-side key

const GEMINI_API_KEY = process.env.GOOGLE_API_KEY || process.env.OPENROUTER_API_KEY || '';
const GEMINI_BASE = process.env.GOOGLE_API_BASE || process.env.OPENROUTER_API_BASE || 'https://generativelanguage.googleapis.com/v1beta/openai';
const ALLOW_ORIGIN = process.env.CORS_ORIGIN || '*';

const baseHeaders = {
  'Access-Control-Allow-Origin': ALLOW_ORIGIN,
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const REQUEST_TIMEOUT_MS = 20000;
exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: baseHeaders };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: baseHeaders, body: 'Method Not Allowed' };
  }

  if (!GEMINI_API_KEY) {
    return {
      statusCode: 500,
      headers: baseHeaders,
      body: JSON.stringify({ error: 'missing_api_key', message: 'GOOGLE_API_KEY is not configured' }),
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
      'Authorization': `Bearer ${GEMINI_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': toAscii(referer || event.headers['referer'] || ''),
      'X-Title': toAscii(title || ''),
    };

    // Timeout wrapper using AbortController
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    console.log('[chat] calling Gemini', { model, temperature, len: JSON.stringify(messages).length });
    const resp = await fetch(`${GEMINI_BASE}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: typeof model === 'string' && model.trim() ? model : 'gemini-2.0-flash',
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
