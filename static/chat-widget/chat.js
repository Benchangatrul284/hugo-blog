// Chat Widget: page-scoped RAG using OpenRouter
// Note: Putting API keys in client-side code is insecure.
// Prefer using a serverless proxy. This demo uses a static config.


(function () {
  const CONFIG_URL = "/chat-widget/config.json";
  const REQUEST_TIMEOUT_MS = 25000; // 25s

  let config = null;
  let panel, toggleBtn, messagesEl, inputEl, actionBtn, modelSelect, newBtn;
  let selectedModel = "deepseek/deepseek-chat-v3.1:free";
  let editTarget = null;
  let currentAbort = null;
  let userAborted = false;
  let isStreaming = false;

  function escapeHTML(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function sanitizeUrl(url) {
    try {
      const u = new URL(url, location.origin);
      const ok = ['http:', 'https:'].includes(u.protocol);
      return ok ? u.href : '#';
    } catch { return '#'; }
  }

  function renderMarkdown(src) {
    let s = escapeHTML(src);
    // Inline code: `code`
    s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
    // Bold: **text**
    s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    // Italic: *text* or _text_
    s = s.replace(/(^|\W)\*([^*]+)\*(?=\W|$)/g, '$1<em>$2</em>');
    s = s.replace(/(^|\W)_([^_]+)_(?=\W|$)/g, '$1<em>$2</em>');
    // Links: [text](url)
    s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (m, t, u) => `<a href="${sanitizeUrl(u)}" target="_blank" rel="noopener">${t}</a>`);
    // Line breaks
    s = s.replace(/\n/g, '<br/>');
    return s;
  }

  function fetchWithTimeout(resource, options = {}, timeout = REQUEST_TIMEOUT_MS) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    const opts = { ...options, signal: controller.signal };
    return fetch(resource, opts).finally(() => clearTimeout(id));
  }

  function humanizeHttpError(status, bodyText) {
    let hint = '';
    if (status === 401 || status === 403) hint = 'Invalid or missing API key on the proxy.';
    else if (status === 404) hint = 'Proxy URL not found. Is the server route correct?';
    else if (status >= 500) hint = 'Proxy or upstream error. Check server logs.';
    let detail = '';
    try {
      const j = JSON.parse(bodyText || '{}');
      if (typeof j === 'string') detail = j;
      else if (j.error) {
        if (typeof j.error === 'string') detail = j.error;
        else if (typeof j.error?.message === 'string') detail = j.error.message;
        else detail = JSON.stringify(j.error).slice(0, 300);
      } else if (j.message) {
        detail = String(j.message);
      } else if (Array.isArray(j.errors) && j.errors.length) {
        detail = String(j.errors[0]?.message || j.errors[0]);
      } else {
        detail = JSON.stringify(j).slice(0, 300);
      }
    } catch { detail = (bodyText || '').slice(0, 300); }
    const tail = detail ? `\nDetail: ${escapeHTML(detail)}` : '';
    const h = hint ? `\nHint: ${hint}` : '';
    return `Request failed (HTTP ${status}).${h}${tail}`;
  }

  async function loadConfig() {
    try {
      const res = await fetch(CONFIG_URL, { cache: "no-cache" });
      if (!res.ok) throw new Error("Failed to load config");
      config = await res.json();
    } catch (e) {
      console.error("Chat widget config error:", e);
      config = null;
    }
  }

  function createUI() {
    toggleBtn = document.createElement("button");
    toggleBtn.className = "cw-toggle";
    toggleBtn.title = "Chat about this page";
    // Use custom PNG icon inside the gray circle
    toggleBtn.innerHTML = `<img src="${location.origin ? new URL('/img/chat-bubble.png', location.origin).pathname : '/img/chat-bubble.png'}" alt="Open chat" aria-hidden="true" />`;

    panel = document.createElement("div");
    panel.className = "cw-panel";
    panel.innerHTML = `
      <div class="cw-header">
        <div class="cw-title">Ask about this page</div>
      </div>
      <div class="cw-messages" aria-live="polite"></div>
      <div class="cw-input">
        <input type="text" placeholder="Type your question..." />
        <div class="cw-actions">
          <button type="button" class="cw-btn cw-action" title="Send" aria-label="Send"><svg class="icon-up" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5M12 5l-6 6M12 5l6 6"/></svg><span class="icon-stop"></span></button>
          <button type="button" class="cw-btn cw-new" title="New conversation" aria-label="New conversation">＋</button>
        </div>
      </div>
      <div class="cw-controls-bottom">
        <label for="cw-model">Model</label>
        <select id="cw-model" class="cw-model"></select>
      </div>
    `;

    document.body.appendChild(toggleBtn);
    document.body.appendChild(panel);

    messagesEl = panel.querySelector(".cw-messages");
    inputEl = panel.querySelector(".cw-input input");
    actionBtn = panel.querySelector(".cw-action");
    modelSelect = panel.querySelector(".cw-model");
    newBtn = panel.querySelector(".cw-actions .cw-new");

    const placeWidget = () => {
      const vw = Math.max(document.documentElement.clientWidth, window.innerWidth || 0);
      if (vw <= 640) {
        panel.style.right = `calc(12px + env(safe-area-inset-right, 0px))`;
        panel.style.left = 'auto';
        panel.style.width = `min(95vw, 420px)`;
        toggleBtn.style.right = `calc(16px + env(safe-area-inset-right, 0px))`;
        toggleBtn.style.left = 'auto';
      } else {
        panel.style.right = '20px';
        panel.style.left = 'auto';
        panel.style.width = '400px';
        toggleBtn.style.right = '20px';
        toggleBtn.style.left = 'auto';
      }
    };

    toggleBtn.addEventListener("click", () => {
      const open = panel.style.display === "flex";
      if (open) {
        panel.style.display = "none";
      } else {
        panel.style.display = "flex";
        placeWidget();
        const rect = panel.getBoundingClientRect();
        const viewportW = window.innerWidth || document.documentElement.clientWidth;
        if (rect.right > viewportW) {
          const overflow = rect.right - viewportW;
          const currentRight = parseInt(getComputedStyle(panel).right) || 20;
          panel.style.right = Math.max(8, currentRight + overflow + 8) + 'px';
        }
      }
      if (!open) inputEl.focus();
    });
    window.addEventListener('resize', placeWidget);

    inputEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !isStreaming) send();
    });
    if (actionBtn) {
      actionBtn.addEventListener("click", () => {
        if (isStreaming) {
          if (currentAbort) { userAborted = true; try { currentAbort.abort(); } catch {} }
        } else {
          send();
        }
      });
    }

    // Populate model selector from config or fallback (hide :free in labels)
    const models = Array.isArray(config?.models) && config.models.length
      ? config.models
      : [config?.model || selectedModel];
    selectedModel = models[0] || selectedModel;
    models.forEach((m) => {
      const opt = document.createElement("option");
      opt.value = m;
      opt.textContent = String(m).replace(/:free$/, "");
      modelSelect.appendChild(opt);
    });
    modelSelect.value = selectedModel;
    modelSelect.addEventListener("change", () => {
      selectedModel = modelSelect.value;
    });

    // New conversation
    newBtn.addEventListener("click", () => {
      messagesEl.innerHTML = "";
      addMessage("assistant", "New conversation started.");
    });
  }

  function scrollToBottom() {
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function addMessage(role, text, extraClass = "") {
    const el = document.createElement("div");
    el.className = `cw-msg ${role} ${extraClass}`.trim();
    const textSpan = document.createElement('span');
    textSpan.className = 'cw-text';
    textSpan.innerHTML = renderMarkdown(text);
    el.dataset.raw = text;
    el.appendChild(textSpan);
    if (role === 'user') {
      const editBtn = document.createElement('button');
      editBtn.type = 'button';
      editBtn.className = 'cw-edit';
      editBtn.textContent = 'Edit';
      editBtn.addEventListener('click', () => {
        inputEl.value = el.dataset.raw || textSpan.textContent || '';
        inputEl.focus();
        editTarget = el;
      });
      el.appendChild(editBtn);
    }
    messagesEl.appendChild(el);
    scrollToBottom();
    return el;
  }

  function getPageContext() {
    const contentEl = document.querySelector(".post-content") || document.querySelector("main") || document.body;
    let text = contentEl ? contentEl.textContent || "" : document.body.textContent || "";
    // Normalize whitespace and clamp
    text = text.replace(/\s+/g, " ").trim();
    const MAX_CHARS = 12000; // keep request small-ish
    if (text.length > MAX_CHARS) text = text.slice(0, MAX_CHARS);
    return text;
  }

  function getHistoryTurns() {
    const nodes = Array.from(messagesEl.querySelectorAll('.cw-msg'));
    const turns = [];
    for (const el of nodes) {
      // Skip loading placeholders (new + legacy)
      if (el.classList.contains('loading')) continue;
      if (el.querySelector('.cw-dots')) continue; // legacy indicator
      if (el.querySelector('.cw-pulse') || el.querySelector('.cw-pulse-text')) continue; // current shimmer
      const role = el.classList.contains('user') ? 'user' : 'assistant';
      const textEl = el.querySelector('.cw-text');
      const content = (textEl ? textEl.textContent : el.textContent || '').trim();
      if (!content) continue;
      turns.push({ role, content });
    }
    // keep recent turns to avoid overly long prompts
    const MAX_TURNS = 8; // 4 exchanges
    return turns.length > MAX_TURNS ? turns.slice(-MAX_TURNS) : turns;
  }

  async function send() {
    if (isStreaming) return; // avoid overlapping streams
    const userText = (inputEl.value || "").trim();
    if (!userText) return;
    inputEl.value = "";

    // If editing: update the selected user message text and clear all messages after it
    if (editTarget) {
      // update text with markdown rendering
      const t = editTarget.querySelector('.cw-text');
      if (t) t.innerHTML = renderMarkdown(userText); else editTarget.textContent = userText;
      editTarget.dataset.raw = userText;
      // remove everything after the edited message
      while (editTarget.nextElementSibling) {
        editTarget.parentNode.removeChild(editTarget.nextElementSibling);
      }
    } else {
      // Show new user message (right)
      addMessage("user", userText);
    }

    // Create assistant bubble (will be filled incrementally if streaming)
    const loading = document.createElement("div");
    loading.className = "cw-msg assistant loading";
    const loadingText = document.createElement("span");
    loadingText.className = 'cw-text cw-pulse-text';
    // Whole label shimmers left-to-right
    loadingText.textContent = "Reading Documents...";
    loading.appendChild(loadingText);
    messagesEl.appendChild(loading);
    scrollToBottom();

    // Guard config
    if (!config) {
      loading.remove();
      addMessage("assistant", "Chat is not configured. Please ensure /chat-widget/config.json exists.");
      return;
    }

    const pageContext = getPageContext();
    // Free-model check before starting animation
    if (!String(selectedModel || "").endsWith(":free")) {
      loading.remove();
      addMessage("assistant", "Sorry model not supported");
      return;
    }

    const stopPulse = () => { try { loadingText.classList.remove('cw-pulse-text'); } catch {} };
    const updateActionButtonUI = () => {
      if (!actionBtn) return;
      if (isStreaming) {
        actionBtn.classList.add('is-pause');
        actionBtn.title = 'Pause';
        actionBtn.setAttribute('aria-label', 'Pause');
      } else {
        actionBtn.classList.remove('is-pause');
        actionBtn.title = 'Send';
        actionBtn.setAttribute('aria-label', 'Send');
      }
    };
    const setBusy = (b) => {
      isStreaming = b;
      updateActionButtonUI();
    };

    userAborted = false;
    try {
      const now = new Date();
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
      const nowStr = now.toLocaleString([], { hour12: false });
      const history = getHistoryTurns();
      const messages = [
        {
          role: "system",
          content:
            `You answer questions strictly using the provided page content. If the answer is not present, say you don’t have enough information from this page. Current date/time: ${nowStr} ${tz}.`,
        },
        {
          role: "system",
          content: `Page content (for grounding):\n${pageContext}`,
        },
        ...history,
      ];
      const payload = {
        model: selectedModel || config.model,
        temperature: config.temperature ?? 0.2,
        messages,
        stream: true,
        referer: location.href,
        title: document.title,
      };

      setBusy(true);
      let res;
      const hn = location.hostname || '';
      const isLocalHost = ['localhost', '127.0.0.1', '::1'].includes(hn) ||
        /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.)/.test(hn) ||
        /\.local$/.test(hn);
      const apiUrl = (isLocalHost && config.dev_proxy_url) ? config.dev_proxy_url : config.proxy_url;
      const ac = new AbortController();
      currentAbort = ac;
      const timerId = setTimeout(() => { try { ac.abort(); } catch {} }, REQUEST_TIMEOUT_MS);
      const fetchOpts = (headers) => ({ method: 'POST', headers, body: JSON.stringify(payload), signal: ac.signal });
      if (apiUrl) {
        res = await fetch(apiUrl, fetchOpts({ 'Content-Type': 'application/json' }));
      } else if (config.openrouter_api_key) {
        res = await fetch(`${config.api_base || 'https://openrouter.ai/api/v1'}/chat/completions`, fetchOpts({
          'Authorization': `Bearer ${config.openrouter_api_key}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': location.href,
          'X-Title': document.title,
        }));
      } else {
        clearTimeout(timerId);
        currentAbort = null;
        setBusy(false);
        throw new Error('No proxy_url or API key provided in config');
      }

      if (!res.ok) {
        const bodyText = await res.text().catch(() => '');
        const msg = humanizeHttpError(res.status, bodyText);
        stopPulse();
        loading.remove();
        addMessage('assistant', msg);
        clearTimeout(timerId);
        currentAbort = null;
        setBusy(false);
        return;
      }
      const ct = (res.headers.get('content-type') || '').toLowerCase();
      const textNode = loading.querySelector('.cw-text');

      if (ct.includes('text/event-stream') && res.body && res.body.getReader) {
        // Stream SSE tokens and append
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        stopPulse();
        textNode.innerHTML = '';
        let accum = '';
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split('\n\n');
          buffer = parts.pop();
          for (const part of parts) {
            const line = part.split('\n').find(l => l.startsWith('data: '));
            if (!line) continue;
            const data = line.slice(6).trim();
            if (data === '[DONE]') continue;
            try {
              const json = JSON.parse(data);
              const delta = json?.choices?.[0]?.delta?.content;
              if (delta) {
                accum += delta;
                textNode.innerHTML = renderMarkdown(accum);
              }
            } catch {}
          }
          scrollToBottom();
        }
        loading.classList.remove('loading');
      } else {
        // Fallback to JSON non-streaming mode
        const data = await res.json();
        const reply = data?.choices?.[0]?.message?.content?.trim() || "Sorry, I couldn’t generate a response.";
        stopPulse();
        loading.remove();
        addMessage("assistant", reply);
        clearTimeout(timerId);
        currentAbort = null;
        setBusy(false);
        return;
      }
      // Done streaming: if nothing came through, show an error
      if (!textNode.textContent) textNode.innerHTML = renderMarkdown("Sorry, I couldn’t generate a response.");
      stopPulse();
      // clear edit target after successful response
      editTarget = null;
      clearTimeout(timerId);
      currentAbort = null;
      setBusy(false);
    } catch (err) {
      console.error(err);
      stopPulse();
      const isAbort = err?.name === 'AbortError' || /aborted|timeout/i.test(String(err?.message || ''));
      if (isAbort && userAborted) {
        // Keep what we already rendered, mark paused
        loading.classList.remove('loading');
        const tn = loading.querySelector('.cw-text');
        if (tn && tn.textContent) tn.innerHTML = tn.innerHTML + renderMarkdown("\n\n(已暫停)");
      } else if (isAbort) {
        loading.remove();
        addMessage('assistant', 'Connection timed out. Is your proxy running and reachable?');
      } else if (err instanceof TypeError) {
        loading.remove();
        addMessage('assistant', 'Network error reaching the proxy. Check dev_proxy_url and CORS.');
      } else {
        loading.remove();
        addMessage('assistant', `Unexpected error: ${escapeHTML(err?.message || 'Unknown error')}`);
      }
      currentAbort = null;
      setBusy(false);
      try { if (typeof timerId !== 'undefined') clearTimeout(timerId); } catch {}
    }
  }

  // Init once DOM is ready
  window.addEventListener("DOMContentLoaded", async () => {
    await loadConfig();
    createUI();
  });
})();
