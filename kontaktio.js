(function () {
  if (window.KontaktioLoaded) return;
  window.KontaktioLoaded = true;

  /* ================= CONFIG ================= */
  const script = document.currentScript;
  const CLIENT_ID = script.getAttribute("data-client") || "demo";
  const AUTO_OPEN_DELAY = 4000; // ms
  const THROTTLE_MS = 2000;

  const BACKEND_BASE = "https://chatbot-backend-x2cy.onrender.com";
  const CHAT_URL = BACKEND_BASE + "/chat";
  const THEME_URL = BACKEND_BASE + "/theme/" + CLIENT_ID;

  let sessionId = null;
  let lastSend = 0;
  let theme = null;
  let isOpen = false;
  let darkMode = localStorage.getItem("kontaktio-dark") === "1";

  /* ================= FETCH THEME ================= */
  async function loadTheme() {
    try {
      const res = await fetch(THEME_URL);
      theme = await res.json();
    } catch {
      theme = null;
    }
  }

  /* ================= CSS ================= */
  const style = document.createElement("style");
  style.textContent = `
  :root {
    --k-bg: #fff;
    --k-text: #111;
    --k-primary: #111;
    --k-accent: #3b82f6;
    --k-bot: #e5e7eb;
    --k-user: #111;
    --k-radius: 14px;
  }

  #k-launcher {
    position: fixed;
    bottom: 20px;
    right: 20px;
    width: 56px;
    height: 56px;
    border-radius: 50%;
    background: var(--k-primary);
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    z-index: 99999;
    box-shadow: 0 10px 30px rgba(0,0,0,.3);
    transition: transform .3s;
  }
  #k-launcher:hover { transform: scale(1.1); }

  #k-widget {
    position: fixed;
    bottom: 90px;
    right: 20px;
    width: 360px;
    height: 520px;
    background: var(--k-bg);
    color: var(--k-text);
    border-radius: var(--k-radius);
    box-shadow: 0 20px 50px rgba(0,0,0,.35);
    display: none;
    flex-direction: column;
    font-family: system-ui, Arial, sans-serif;
    animation: k-enter .35s ease;
    z-index: 99999;
  }

  @keyframes k-enter {
    from { opacity: 0; transform: translateY(20px); }
    to { opacity: 1; transform: translateY(0); }
  }

  #k-header {
    background: var(--k-primary);
    color: #fff;
    padding: 12px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    cursor: move;
  }

  #k-header button {
    background: none;
    border: none;
    color: inherit;
    cursor: pointer;
    font-size: 14px;
  }

  #k-messages {
    flex: 1;
    padding: 12px;
    overflow-y: auto;
    background: var(--k-bg);
  }

  .k-msg {
    max-width: 80%;
    margin-bottom: 10px;
    padding: 10px 14px;
    border-radius: 16px;
    font-size: 14px;
    animation: k-msg .25s ease;
  }

  @keyframes k-msg {
    from { opacity: 0; transform: translateY(5px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .k-user {
    background: var(--k-user);
    color: #fff;
    margin-left: auto;
  }

  .k-bot {
    background: var(--k-bot);
    color: #111;
  }

  .k-typing {
    font-style: italic;
    opacity: .6;
  }

  #k-input {
    display: flex;
    border-top: 1px solid #ddd;
  }

  #k-input input {
    flex: 1;
    padding: 12px;
    border: none;
    outline: none;
    background: transparent;
    color: inherit;
  }

  #k-input button {
    background: var(--k-primary);
    color: #fff;
    border: none;
    padding: 0 16px;
    cursor: pointer;
  }

  body.k-dark {
    --k-bg: #0f172a;
    --k-text: #e5e7eb;
    --k-bot: #1e293b;
  }
  `;
  document.head.appendChild(style);

  /* ================= HTML ================= */
  const launcher = document.createElement("div");
  launcher.id = "k-launcher";
  launcher.textContent = "💬";

  const widget = document.createElement("div");
  widget.id = "k-widget";
  widget.innerHTML = `
    <div id="k-header">
      <span>Asystent</span>
      <div>
        <button id="k-dark">🌙</button>
        <button id="k-close">✕</button>
      </div>
    </div>
    <div id="k-messages">
      <div class="k-msg k-bot">Dzień dobry 👋 W czym mogę pomóc?</div>
    </div>
    <div id="k-input">
      <input placeholder="Napisz wiadomość…" />
      <button>Wyślij</button>
    </div>
  `;

  document.body.appendChild(launcher);
  document.body.appendChild(widget);

  const messages = widget.querySelector("#k-messages");
  const input = widget.querySelector("input");
  const sendBtn = widget.querySelector("button");
  const closeBtn = widget.querySelector("#k-close");
  const darkBtn = widget.querySelector("#k-dark");

  /* ================= HELPERS ================= */
  function add(text, cls) {
    const div = document.createElement("div");
    div.className = "k-msg " + cls;
    div.textContent = text;
    messages.appendChild(div);
    messages.scrollTop = messages.scrollHeight;
  }

  function typing(show) {
    let t = messages.querySelector(".k-typing");
    if (show && !t) {
      t = document.createElement("div");
      t.className = "k-msg k-bot k-typing";
      t.textContent = "Asystent pisze…";
      messages.appendChild(t);
      messages.scrollTop = messages.scrollHeight;
    }
    if (!show && t) t.remove();
  }

  async function send() {
    const now = Date.now();
    if (now - lastSend < THROTTLE_MS) return;
    lastSend = now;

    const text = input.value.trim();
    if (!text) return;

    add(text, "k-user");
    input.value = "";
    typing(true);

    try {
      const res = await fetch(CHAT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, sessionId, clientId: CLIENT_ID })
      });
      const data = await res.json();
      sessionId = data.sessionId;
      typing(false);
      add(data.reply, "k-bot");
    } catch {
      typing(false);
      add("Błąd połączenia z serwerem.", "k-bot");
    }
  }

  /* ================= EVENTS ================= */
  launcher.onclick = () => {
    isOpen = !isOpen;
    widget.style.display = isOpen ? "flex" : "none";
  };

  closeBtn.onclick = () => (widget.style.display = "none");
  sendBtn.onclick = send;
  input.addEventListener("keydown", e => e.key === "Enter" && send());

  darkBtn.onclick = () => {
    darkMode = !darkMode;
    document.body.classList.toggle("k-dark", darkMode);
    localStorage.setItem("kontaktio-dark", darkMode ? "1" : "0");
    darkBtn.textContent = darkMode ? "☀️" : "🌙";
  };

  /* ================= INIT ================= */
  loadTheme().then(() => {
    if (theme?.theme) {
      const t = theme.theme;
      document.documentElement.style.setProperty("--k-primary", t.primary || "#111");
      document.documentElement.style.setProperty("--k-accent", t.accent || "#3b82f6");
      document.documentElement.style.setProperty("--k-radius", (t.radius || 14) + "px");
    }
  });

  if (darkMode) document.body.classList.add("k-dark");

  setTimeout(() => {
    widget.style.display = "flex";
    isOpen = true;
  }, AUTO_OPEN_DELAY);
})();
