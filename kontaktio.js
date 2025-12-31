(function () {
  if (window.KontaktioLoaded) return;
  window.KontaktioLoaded = true;

  console.log("Kontaktio PRO widget loaded");

  const script = document.currentScript;
  const CLIENT_ID = script.getAttribute("data-client") || "demo";
  const BACKEND_URL = "https://chatbot-backend-x2cy.onrender.com/chat";

  let sessionId = null;
  let isOpen = false;
  let isLoading = false;
  let theme = null;
  let darkMode = localStorage.getItem("kontaktio-dark") === "1";

  /* ===================== CSS ===================== */
  const style = document.createElement("style");
  style.textContent = `
  :root {
    --k-header-bg: #111;
    --k-header-text: #fff;

    --k-user-bg: #111;
    --k-user-text: #fff;

    --k-bot-bg: #e5e7eb;
    --k-bot-text: #111;

    --k-widget-bg: #f8fafc;
    --k-input-bg: #fff;
    --k-input-text: #111;

    --k-button-bg: #111;
    --k-button-text: #fff;

    --k-radius: 14px;
  }

  #k-launcher {
    position: fixed;
    bottom: 20px;
    right: 20px;
    width: 56px;
    height: 56px;
    border-radius: 50%;
    background: var(--k-button-bg);
    color: var(--k-button-text);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    z-index: 99999;
    box-shadow: 0 10px 30px rgba(0,0,0,.35);
  }

  #k-widget {
    position: fixed;
    bottom: 90px;
    right: 20px;
    width: 360px;
    height: 520px;
    background: var(--k-widget-bg);
    border-radius: var(--k-radius);
    display: none;
    flex-direction: column;
    overflow: hidden;
    box-shadow: 0 25px 60px rgba(0,0,0,.45);
    animation: kEnter .25s ease-out;
    font-family: -apple-system,BlinkMacSystemFont,Segoe UI,Arial,sans-serif;
  }

  @keyframes kEnter {
    from { transform: translateY(20px) scale(.98); opacity: 0; }
    to { transform: translateY(0) scale(1); opacity: 1; }
  }

  #k-header {
    background: var(--k-header-bg);
    color: var(--k-header-text);
    padding: 12px 14px;
    font-weight: 600;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  #k-header button {
    background: none;
    border: none;
    color: inherit;
    cursor: pointer;
    font-size: 14px;
    opacity: .8;
  }

  #k-messages {
    flex: 1;
    padding: 12px;
    overflow-y: auto;
    background: transparent;
  }

  .k-msg {
    max-width: 80%;
    padding: 10px 14px;
    border-radius: 14px;
    margin-bottom: 10px;
    font-size: 14px;
    line-height: 1.4;
    animation: msgIn .2s ease-out;
    opacity: 1 !important;
  }

  @keyframes msgIn {
    from { transform: translateY(6px); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
  }

  .k-user {
    background: var(--k-user-bg);
    color: var(--k-user-text);
    margin-left: auto;
  }

  .k-bot {
    background: var(--k-bot-bg);
    color: var(--k-bot-text);
    margin-right: auto;
  }

  .k-typing {
    opacity: .6;
    font-style: italic;
  }

  #k-input {
    display: flex;
    border-top: 1px solid rgba(0,0,0,.08);
  }

  #k-input input {
    flex: 1;
    padding: 12px;
    border: none;
    outline: none;
    background: var(--k-input-bg);
    color: var(--k-input-text);
    font-size: 14px;
  }

  #k-input button {
    border: none;
    padding: 0 16px;
    background: var(--k-button-bg);
    color: var(--k-button-text);
    cursor: pointer;
  }

  #k-input button:disabled {
    opacity: .6;
    cursor: not-allowed;
  }

  body.k-dark {
    --k-widget-bg: #0f172a;
    --k-input-bg: #020617;
    --k-input-text: #e5e7eb;
  }
  `;
  document.head.appendChild(style);

  /* ===================== HTML ===================== */
  const launcher = document.createElement("div");
  launcher.id = "k-launcher";
  launcher.textContent = "💬";

  const widget = document.createElement("div");
  widget.id = "k-widget";
  widget.innerHTML = `
    <div id="k-header">
      <span>Asystent</span>
      <div>
        <button id="k-theme">🌓</button>
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
  const button = widget.querySelector("button");
  const closeBtn = widget.querySelector("#k-close");
  const themeBtn = widget.querySelector("#k-theme");

  if (darkMode) document.body.classList.add("k-dark");

  /* ===================== FUNCTIONS ===================== */
  function applyTheme(t) {
    const r = document.documentElement.style;
    r.setProperty("--k-header-bg", t.headerBg);
    r.setProperty("--k-header-text", t.headerText);
    r.setProperty("--k-user-bg", t.userBubbleBg);
    r.setProperty("--k-user-text", t.userBubbleText);
    r.setProperty("--k-bot-bg", t.botBubbleBg);
    r.setProperty("--k-bot-text", t.botBubbleText);
    r.setProperty("--k-widget-bg", t.widgetBg);
    r.setProperty("--k-input-bg", t.inputBg);
    r.setProperty("--k-input-text", t.inputText);
    r.setProperty("--k-button-bg", t.buttonBg);
    r.setProperty("--k-button-text", t.buttonText);
    r.setProperty("--k-radius", t.radius + "px");
  }

  function add(text, cls) {
    const div = document.createElement("div");
    div.className = "k-msg " + cls;
    div.textContent = text;
    messages.appendChild(div);
    messages.scrollTop = messages.scrollHeight;
  }

  function showTyping() {
    const t = document.createElement("div");
    t.className = "k-msg k-bot k-typing";
    t.textContent = "Asystent pisze…";
    messages.appendChild(t);
    messages.scrollTop = messages.scrollHeight;
    return t;
  }

  async function send() {
    const text = input.value.trim();
    if (!text || isLoading) return;

    isLoading = true;
    button.disabled = true;

    add(text, "k-user");
    input.value = "";

    const typing = showTyping();

    try {
      const res = await fetch(BACKEND_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, sessionId, clientId: CLIENT_ID })
      });

      const data = await res.json();
      sessionId = data.sessionId;

      if (!theme && data.theme) {
        theme = data.theme;
        applyTheme(theme);
      }

      typing.remove();
      add(data.reply, "k-bot");
    } catch {
      typing.remove();
      add("Błąd połączenia z serwerem.", "k-bot");
    } finally {
      isLoading = false;
      button.disabled = false;
      input.focus();
    }
  }

  /* ===================== EVENTS ===================== */
  launcher.onclick = () => {
    isOpen = !isOpen;
    widget.style.display = isOpen ? "flex" : "none";
    if (isOpen) input.focus();
  };

  closeBtn.onclick = () => {
    isOpen = false;
    widget.style.display = "none";
  };

  themeBtn.onclick = () => {
    darkMode = !darkMode;
    document.body.classList.toggle("k-dark", darkMode);
    localStorage.setItem("kontaktio-dark", darkMode ? "1" : "0");
  };

  button.onclick = send;
  input.addEventListener("keydown", e => {
    if (e.key === "Enter") send();
  });
})();

