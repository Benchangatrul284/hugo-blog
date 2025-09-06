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
        <button type="button">Send</button>
      </div>
      <div class="cw-controls-bottom">
        <label for="cw-model">Model</label>
        <select id="cw-model" class="cw-model"></select>
        <button type="button" class="cw-new">New</button>
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
    el.textContent = text;
    if (role === 'user') {
      const editBtn = document.createElement('button');
      editBtn.type = 'button';
      editBtn.className = 'cw-edit';
      editBtn.textContent = 'Edit';
      editBtn.addEventListener('click', () => {
        inputEl.value = text;
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

  async function send() {
    const userText = (inputEl.value || "").trim();
    if (!userText) return;
    inputEl.value = "";

    // If editing, remove the original user message and its immediate assistant reply
    if (editTarget) {
      const next = editTarget.nextElementSibling;
      if (next && next.classList.contains('assistant')) next.remove();
      editTarget.remove();
      editTarget = null;
    }
    // Show user message (right)
    addMessage("user", userText);

    // Loading bubble on the right
    const loading = document.createElement("div");
    loading.className = "cw-msg assistant";
    const loadingText = document.createElement("span");
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
      const payload = {
        model: selectedModel || config.model,
        temperature: config.temperature ?? 0.2,
        messages: [
          {
            role: "system",
            content:
              `You answer questions strictly using the provided page content. If the answer is not present, say you don’t have enough information from this page. Current date/time: ${nowStr} ${tz}.`,
          },
          {
            role: "user",
            content: `Page content (for grounding):\n${pageContext}\n\nQuestion: ${userText}`,
          },
        ],
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
      const data = await res.json();
      const reply = data?.choices?.[0]?.message?.content?.trim() || "Sorry, I couldn’t generate a response.";
      clearInterval(dotsTimer);
      loading.remove();
      addMessage("assistant", reply);
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
