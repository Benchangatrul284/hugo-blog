// Chat Widget: page-scoped RAG using OpenRouter
// Note: Putting API keys in client-side code is insecure.
// Prefer using a serverless proxy. This demo uses a static config.

(function () {
  const CONFIG_URL = "/chat-widget/config.json";

  let config = null;
  let panel, toggleBtn, messagesEl, inputEl, sendBtn;

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
      <div class="cw-header">Ask about this page</div>
      <div class="cw-messages" aria-live="polite"></div>
      <div class="cw-input">
        <input type="text" placeholder="Type your question..." />
        <button type="button">Send</button>
      </div>
    `;

    document.body.appendChild(toggleBtn);
    document.body.appendChild(panel);

    messagesEl = panel.querySelector(".cw-messages");
    inputEl = panel.querySelector("input");
    sendBtn = panel.querySelector("button");

    toggleBtn.addEventListener("click", () => {
      const open = panel.style.display === "flex";
      panel.style.display = open ? "none" : "flex";
      if (!open) inputEl.focus();
    });

    inputEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter") send();
    });
    sendBtn.addEventListener("click", send);
  }

  function scrollToBottom() {
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function addMessage(role, text, extraClass = "") {
    const el = document.createElement("div");
    el.className = `cw-msg ${role} ${extraClass}`.trim();
    el.textContent = text;
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

    // Show user message (left)
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

    // Simple JS-based ellipsis animation for broad browser support
    let i = 0;
    const frames = ["", ".", "..", "..."];
    const dotsTimer = setInterval(() => {
      dots.textContent = frames[i % frames.length];
      i++;
    }, 350);

    try {
      const payload = {
        model: config.model,
        temperature: config.temperature ?? 0.2,
        messages: [
          {
            role: "system",
            content:
              "You answer questions strictly using the provided page content. If the answer is not present, say you don’t have enough information from this page.",
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
        res = await fetch(config.proxy_url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else if (config.openrouter_api_key) {
        // Fallback: direct call (not recommended for production)
        res = await fetch(`${config.api_base || "https://openrouter.ai/api/v1"}/chat/completions`, {
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
      addMessage("assistant", `Error while calling model: ${err.message}`);
    }
  }

  // Init once DOM is ready
  window.addEventListener("DOMContentLoaded", async () => {
    await loadConfig();
    createUI();
  });
})();
