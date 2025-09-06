// Chat Widget: page-scoped RAG using OpenRouter
// Note: Putting API keys in client-side code is insecure.
// Prefer using a serverless proxy. This demo uses a static config.


(function () {
  const CONFIG_URL = "/chat-widget/config.json";
  const REQUEST_TIMEOUT_MS = 25000; // 25s

  let config = null;
  let panel, toggleBtn, messagesEl, inputEl, sendBtn, modelSelect, newBtn;
  let selectedModel = "deepseek/deepseek-chat-v3.1:free";
  let editTarget = null;

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
    toggleBtn.innerHTML = "💬";

    panel = document.createElement("div");
    panel.className = "cw-panel";
    panel.innerHTML = `
      <div class="cw-header">
        <div class="cw-title">Ask about this page</div>
      </div>
      <div class="cw-messages" aria-live="polite"></div>
      <div class="cw-input">
        <input type="text" placeholder="Type your question..." />
        <button type="button" title="Send">🚀</button>
      </div>
      <div class="cw-controls-bottom">
        <label for="cw-model">Model</label>
        <select id="cw-model" class="cw-model"></select>
        <button type="button" class="cw-new" title="New conversation">🗨️</button>
      </div>
    `;

    document.body.appendChild(toggleBtn);
    document.body.appendChild(panel);

    messagesEl = panel.querySelector(".cw-messages");
    inputEl = panel.querySelector(".cw-input input");
    sendBtn = panel.querySelector(".cw-input button");
    modelSelect = panel.querySelector(".cw-model");
    newBtn = panel.querySelector(".cw-new");

    toggleBtn.addEventListener("click", () => {
      const open = panel.style.display === "flex";
      panel.style.display = open ? "none" : "flex";
      if (!open) inputEl.focus();
    });

    inputEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter") send();
    });
    sendBtn.addEventListener("click", send);

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
      // Skip loading placeholder
      if (el.querySelector('.cw-dots')) continue;
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
    loading.className = "cw-msg assistant";
    const loadingText = document.createElement("span");
    loadingText.className = 'cw-text';
    loadingText.textContent = "Reading documents";
    const dots = document.createElement("span");
    dots.className = "cw-dots";
    loading.appendChild(loadingText);
    loading.appendChild(dots);
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

    // Simple JS-based ellipsis animation for broad browser support
    let i = 0;
    const frames = ["", ".", "..", "..."];
    const dotsTimer = setInterval(() => {
      dots.textContent = frames[i % frames.length];
      i++;
    }, 350);

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

      let res;
      if (config.proxy_url) {
        res = await fetchWithTimeout(config.proxy_url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else if (config.openrouter_api_key) {
        // Fallback: direct call (not recommended for production)
        res = await fetchWithTimeout(`${config.api_base || "https://openrouter.ai/api/v1"}/chat/completions`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${config.openrouter_api_key}`,
            "Content-Type": "application/json",
            "HTTP-Referer": location.href,
            "X-Title": document.title,
          },
          body: JSON.stringify(payload),
        });
      } else {
        throw new Error("No proxy_url or API key provided in config");
      }

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const ct = (res.headers.get('content-type') || '').toLowerCase();
      const textNode = loading.querySelector('.cw-text');

      if (ct.includes('text/event-stream') && res.body && res.body.getReader) {
        // Stream SSE tokens and append
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        clearInterval(dotsTimer);
        dots.remove();
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
        clearInterval(dotsTimer);
        loading.remove();
        addMessage("assistant", reply);
        return;
      }
      // Done streaming: if nothing came through, show an error
      if (!textNode.textContent) textNode.innerHTML = renderMarkdown("Sorry, I couldn’t generate a response.");
      clearInterval(dotsTimer);
      // clear edit target after successful response
      editTarget = null;
    } catch (err) {
      console.error(err);
      clearInterval(dotsTimer);
      loading.remove();
      addMessage("assistant", "Sorry, We are having a problem");
    }
  }

  // Init once DOM is ready
  window.addEventListener("DOMContentLoaded", async () => {
    await loadConfig();
    createUI();
  });
})();
