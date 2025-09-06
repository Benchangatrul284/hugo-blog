import express from 'express';
import fs from 'node:fs';
import path from 'node:path';

// Minimal .env loader (no external dependency)
try {
  const envPath = path.resolve(path.dirname(new URL(import.meta.url).pathname), '.env');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      const value = trimmed.slice(eq + 1).trim();
      if (!(key in process.env)) process.env[key] = value;
    }
  }
} catch {}

const app = express();
const PORT = process.env.PORT || 8787;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '';
const OPENROUTER_BASE = process.env.OPENROUTER_API_BASE || 'https://openrouter.ai/api/v1';
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';

if (!OPENROUTER_API_KEY) {
  console.warn('[warn] OPENROUTER_API_KEY is not set. Requests will fail until it is configured.');
}

// Basic CORS (no external dep)
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', CORS_ORIGIN);
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.use(express.json({ limit: '1mb' }));

app.get('/healthz', (_req, res) => {
  res.json({ ok: true, hasKey: Boolean(OPENROUTER_API_KEY) });
});

app.post('/api/chat', async (req, res) => {
  try {
    const { messages, model, temperature, referer, title } = req.body || {};
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'messages[] required' });
    }
    const m = typeof model === 'string' && model.trim() ? model : 'openrouter/anthropic/claude-3.5-sonnet';
    const temp = typeof temperature === 'number' ? temperature : 0.2;

    const headers = {
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
    };
    // OpenRouter recommends these headers for attribution
    headers['HTTP-Referer'] = referer || req.headers['referer'] || '';
    headers['X-Title'] = title || '';

    const orRes = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ model: m, temperature: temp, messages }),
    });

    const text = await orRes.text();
    res.status(orRes.status);
    // Proxy through the JSON/text from OpenRouter unchanged
    try {
      res.type('application/json').send(JSON.parse(text));
    } catch {
      res.type('text/plain').send(text);
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'proxy_error', message: err?.message || 'Unknown error' });
  }
});

app.listen(PORT, () => {
  console.log(`[chat-proxy] listening on :${PORT}`);
});
