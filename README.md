# hugo-blog

## After cloning

1. **Install tooling** – Hugo Extended v0.125.7+ and Node 18+ (for the chat proxy) must be available on your path.
2. **Init the theme submodule** – `git submodule update --init --recursive` to pull PaperMod.
3. **Start the Hugo dev server** – run `hugo server` at the repo root. The site now includes a `layouts/shortcodes/rawhtml.html` passthrough so `{{< rawhtml >}}` blocks render correctly.
4. **Set up the chat proxy (optional)**:
   - `cd server`
   - `cp .env.example .env` and set `GOOGLE_API_KEY` (or compatible key).
   - `npm install`
   - `npm start` (listens on `:8787`, proxying `/api/chat`).

The client chat widget defaults to hitting `/api/chat`, so run the proxy alongside `hugo server` when developing conversational features.
