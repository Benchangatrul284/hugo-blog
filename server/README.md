Minimal Node proxy for the chat widget.

Setup
- Node 18+ is required (uses global fetch).
- Copy `.env.example` to `.env` and set `OPENROUTER_API_KEY`.

Run
- Install deps: `npm install` (inside the `server` folder).
- Start: `npm start` (defaults to port 8787).

Client config
- The widget is configured to call `/api/chat` by default via `static/chat-widget/config.json`.
- If serving the proxy on a different origin, update `proxy_url` accordingly and set `CORS_ORIGIN` in the server environment.

Production
- Place this proxy behind your main site domain (e.g., reverse proxy `/api/` to this service).
- Keep the API key on the server; never expose it in client-side code.

