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
const GEMINI_API_KEY = process.env.GOOGLE_API_KEY || process.env.OPENROUTER_API_KEY || '';
const GEMINI_BASE = process.env.GOOGLE_API_BASE || process.env.OPENROUTER_API_BASE || 'https://generativelanguage.googleapis.com/v1beta/openai';
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';

if (!GEMINI_API_KEY) {
  console.warn('[warn] GOOGLE_API_KEY is not set. Requests will fail until it is configured.');
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
  res.json({ ok: true, hasKey: Boolean(GEMINI_API_KEY) });
});

app.post('/api/chat', async (req, res) => {
  try {
    const { messages, model, temperature, referer, title } = req.body || {};
    const wantStream = Boolean(req.body && req.body.stream);
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'messages[] required' });
    }
    const m = typeof model === 'string' && model.trim() ? model : 'gemini-2.0-flash';
    const temp = typeof temperature === 'number' ? temperature : 0.2;

    // Ensure header values are ASCII to satisfy undici ByteString requirement
    const toAscii = (v) => String(v || '').replace(/[^\x00-\x7F]/g, '');
    const headers = {
      'Authorization': `Bearer ${GEMINI_API_KEY}`,
      'Content-Type': 'application/json',
      // Pass through attribution/context headers for upstream logging
      'HTTP-Referer': toAscii(referer || req.headers['referer'] || ''),
      'X-Title': toAscii(title || ''),
    };

    const orRes = await fetch(`${GEMINI_BASE}/chat/completions`, {
      method: 'POST',
      headers: wantStream ? { ...headers, 'Accept': 'text/event-stream' } : headers,
      body: JSON.stringify({ model: m, temperature: temp, messages, stream: wantStream }),
    });
    if (!orRes.ok) {
      const clone = orRes.clone();
      const txt = await clone.text().catch(() => '');
      console.error(`[proxy] upstream ${orRes.status} ${orRes.statusText} body:`, txt.slice(0, 400));
    }

    if (wantStream && orRes.ok && (orRes.headers.get('content-type') || '').includes('text/event-stream')) {
      res.status(200);
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.flushHeaders && res.flushHeaders();
      try {
        for await (const chunk of orRes.body) {
          res.write(chunk);
        }
      } catch (e) {
        console.error('stream error', e?.message);
      } finally {
        res.end();
      }
      return;
    }

    const text = await orRes.text();
    res.status(orRes.status);
    // Proxy through the JSON/text from the upstream API unchanged
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
