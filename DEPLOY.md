# Deployment & Repo Overview

This repo is a Hugo site with a page-scoped chat widget that answers questions using the current page content (RAG). It supports multi-turn chat, streaming, basic Markdown rendering, model selection (free-only), editing a prior user turn, and mobile-friendly placement.

## Repository Structure

- `hugo.yaml` — Hugo site config
- `content/` — Site content
- `layouts/` — Hugo templates
  - `_default/baseof.html` — Injects the chat widget partial on content pages
  - `partials/chat-widget.html` — Loads widget assets
- `static/chat-widget/` — Client widget assets
  - `chat.css` — Widget styles (desktop/mobile), CSS variables for placement
  - `chat.js` — Widget logic (RAG, history, streaming, Markdown)
  - `config.json` — Client config (default model, proxy URL, models list)
- `server/` — Local Node proxy (for local dev streaming)
  - `index.js` — Express proxy that supports SSE streaming
  - `.env.example` — Example environment variables
  - `README.md` — Local usage notes
- `netlify.toml` — Netlify configuration
  - Redirect `/api/chat` to a function, declares Node version
  - Edge Function mapping for streaming
- `netlify/functions/chat.js` — Serverless function proxy (non-streaming fallback)
- `netlify/edge-functions/chat-edge.js` — Edge Function proxy (streaming on Netlify)

## Chat Widget Summary

- Scope: Uses only the current page’s text for context; trims to ~12k chars.
- UI: Floating toggle button; panel with messages, input, model dropdown, and “New” button.
- Alignment: Assistant on left; user on right; both share the same bubble style.
- Loading: Shows “Reading documents…” with animated dots.
- History: Includes the last ~8 bubbles (4 exchanges) plus page content each turn.
- Edit: Editing a user message clears all following turns and resends from that point.
- Markdown: Basic support for bold, italics, inline code, links, lists, fenced code blocks.
- Streaming: Incremental rendering when the proxy streams SSE.

## Configuration (static/chat-widget/config.json)

- `proxy_url`: API endpoint to call. In production keep `"/api/chat"` so Netlify routes to the function/edge.
- `model`: Default model (must end with `:free` to be accepted by the widget).
- `models`: Array of selectable models (labels hide `:free`).
- `temperature`: Optional sampling setting.

Example:

```
{
  "proxy_url": "/api/chat",
  "model": "deepseek/deepseek-chat-v3.1:free",
  "models": [
    "deepseek/deepseek-chat-v3.1:free",
    "openai/gpt-oss-20b:free"
  ],
  "temperature": 0.2
}
```

### Placement (CSS Variables)

You can move the toggle via CSS variables (optional — JS also clamps position on mobile):

- `--cw-right`, `--cw-left`, `--cw-bottom`

Example bottom-left:

```
html { --cw-left: 20px; --cw-right: auto; --cw-bottom: 20px; }
```

## Netlify Deployment Flow (Production)

1) Push to GitHub — Netlify CI builds with Hugo per `netlify.toml`.
2) Proxy endpoint at `/api/chat`:
   - Edge Function `netlify/edge-functions/chat-edge.js` handles streaming (SSE) to the browser.
   - Serverless Function `netlify/functions/chat.js` remains as a JSON fallback.
   - `netlify.toml` maps `/api/chat` to the Edge Function with serverless as fallback.
3) Client widget calls `config.proxy_url` (default `/api/chat`).

Environment variables (Netlify Site Settings → Build & deploy → Environment):

- `OPENROUTER_API_KEY` — Required. Server-side key used by Edge/Functions.
- `OPENROUTER_API_BASE` — Optional. Defaults to `https://openrouter.ai/api/v1`.
- Node version is pinned to 20 via `netlify.toml` for `fetch` support.

Logs and Troubleshooting:

- Functions logs: Netlify UI → Functions → `chat`.
- Edge logs: Netlify Observability/logging (varies by plan/features). If streaming fails, the client will fall back to non-streaming behavior (serverless/json) or show an error.

## Local Development Flow

Option A — Local Node Proxy (recommended for streaming):

1) `cd server && npm install`
2) Create `server/.env` from `.env.example`; set:
   - `OPENROUTER_API_KEY=sk-or-...`
   - `CORS_ORIGIN=http://localhost:1313`
3) Start proxy: `npm start` (listens on `http://localhost:8787`).
4) In `static/chat-widget/config.json`, set:
   - `"proxy_url": "http://localhost:8787/api/chat"`
5) Run Hugo dev: `hugo server` (default `http://localhost:1313`).

Option B — Netlify CLI (non-streaming typical):

- `netlify dev` or `netlify functions:serve` on your platform.
- Set `proxy_url` accordingly:
  - `http://localhost:9999/.netlify/functions/chat` (functions-only)
  - Note: CLI streaming support may vary by platform; for live token streaming, prefer Option A.

## Security Notes

- Do not put API keys in client assets. The widget uses a server-side proxy (Edge/Functions or local Node).
- If a key was ever exposed, rotate it in OpenRouter.

## Mobile Behavior & Positioning

- CSS pins the toggle/panel to the right; JS also measures viewport on open and resize to keep the panel fully visible, applying safe-area insets on mobile.
- You can still override with CSS variables to fine-tune positions.

## Multi-turn & Editing Behavior

- Each turn includes:
  - System: current date/time + instruction to only use this page.
  - System: page content (truncated).
  - Recent chat history (last ~8 bubbles).
- Editing a prior user turn:
  - Click “Edit” on the user bubble to load text back into the input.
  - On send, the widget updates that bubble, clears following messages, and resends.

## Streaming Details

- Client requests `stream: true`.
- Node proxy (`server/index.js`) streams SSE from OpenRouter to the browser.
- Netlify Edge Function streams when available; the serverless function returns buffered JSON as a fallback.
- The widget displays tokens incrementally; on non-streaming, it shows the final message when complete.

## Troubleshooting

- “Reading documents…” stuck:
  - Confirm `/api/chat` returns 200 (check browser Network tab).
  - Verify `OPENROUTER_API_KEY` is set on Netlify and a deploy occurred after setting it.
  - Ensure model slug is valid (and ends with `:free` in the widget UI).
- 404/401 errors:
  - 404: `/api/chat` not routed; verify `netlify.toml` and deploy logs.
  - 401: Invalid or missing API key on the server side.
- Payload too large/slow:
  - The page context is trimmed; you can further reduce `MAX_CHARS` in `chat.js` if needed.

