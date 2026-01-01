(function () {
  if (window.KontaktioLoaded) return;
  window.KontaktioLoaded = true;

  const script = document.currentScript;
  const CLIENT_ID = script?.getAttribute("data-client") || "demo";
  const BACKEND_URL = "https://chatbot-backend-x2cy.onrender.com/chat";

  let sessionId = null;
  let isOpen = false;
  let isLoading = false;
  let isDragging = false;
  let dragOffsetX = 0;
  let dragOffsetY = 0;
  let fullscreen = false;
  let themeAppliedFromServer = false;

  const POS_KEY = `kontaktio-pos-${CLIENT_ID}`;
  const DARK_KEY = `kontaktio-dark-${CLIENT_ID}`;
  const HISTORY_KEY = `kontaktio-history-${CLIENT_ID}`;

  const savedPos = JSON.parse(localStorage.getItem(POS_KEY) || "null");
  let darkMode = localStorage.getItem(DARK_KEY) === "1";

  /* =========================
     Layouty / osobowości UI
     ========================= */
  const LAYOUTS = {
    demo: {
      id: "demo",
      name: "Kontaktio Demo",
      subtitle: "Uniwersalny Asystent AI",
      logoType: "emoji",
      logo: "💬",
      style: "neoglass",
      avatarBot: "🤖",
      avatarUser: "🧑",
      quick: [
        "Co potrafi ten asystent?",
        "Jak wygląda wdrożenie?",
        "Czy to działa 24/7?"
      ],
      defaults: {
        bg: "#020617",
        primary: "#2563eb",
        accent: "#22d3ee",
        text: "#e5e7eb"
      },
      openAnimationClass: "k-open-demo"
    },
    amico: {
      id: "amico",
      name: "AMICO",
      subtitle: "Pracownia Kamieniarska",
      logoType: "text",
      logo: "AMICO",
      style: "friendly",
      avatarBot: "🪨",
      avatarUser: "🧑",
      quick: [
        "Jakie wykonujecie blaty?",
        "Z jakich materiałów pracujecie?",
        "Jak wygląda proces od wyceny do montażu?"
      ],
      defaults: {
        bg: "#f7f7f5",
        primary: "#111827",
        accent: "#c9a24d",
        text: "#111827"
      },
      openAnimationClass: "k-open-amico"
    },
    premium: {
      id: "premium",
      name: "Kontaktio Premium",
      subtitle: "Asystent klasy premium",
      logoType: "emoji",
      logo: "✨",
      style: "premium",
      avatarBot: "🕴️",
      avatarUser: "🧑‍💼",
      quick: [
        "Czym różni się wersja Premium?",
        "Jak dopasowujecie asystenta do marki?",
        "Czy wspieracie złożone procesy?"
      ],
      defaults: {
        bg: "#020617",
        primary: "#7c3aed",
        accent: "#a855f7",
        text: "#e5e7eb"
      },
      openAnimationClass: "k-open-premium"
    }
  };

  const L = LAYOUTS[CLIENT_ID] || LAYOUTS.demo;

  /* =========================
     Audio – delikatne dźwięki (Web Audio API)
     ========================= */
  let audioCtx = null;
  function ensureAudioContext() {
    if (!audioCtx) {
      try {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      } catch {
        audioCtx = null;
      }
    }
  }

  function playTone({ freq = 440, duration = 0.12, type = "sine", gain = 0.06 } = {}) {
    ensureAudioContext();
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gainNode.gain.value = gain;

    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    const now = audioCtx.currentTime;
    osc.start(now);
    gainNode.gain.setValueAtTime(gain, now);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.stop(now + duration + 0.02);
  }

  function playSound(kind) {
    // subtelne, profesjonalne dźwięki, bez przesady
    if (kind === "open-demo") {
      playTone({ freq: 880, duration: 0.16, type: "sine", gain: 0.05 });
      playTone({ freq: 1320, duration: 0.18, type: "sine", gain: 0.04 });
    } else if (kind === "open-amico") {
      playTone({ freq: 660, duration: 0.14, type: "triangle", gain: 0.05 });
    } else if (kind === "open-premium") {
      playTone({ freq: 520, duration: 0.22, type: "sine", gain: 0.045 });
      playTone({ freq: 1040, duration: 0.26, type: "sine", gain: 0.035 });
    } else if (kind === "send") {
      playTone({ freq: 740, duration: 0.08, type: "triangle", gain: 0.045 });
    } else if (kind === "receive") {
      playTone({ freq: 980, duration: 0.12, type: "sine", gain: 0.05 });
    } else if (kind === "error") {
      playTone({ freq: 260, duration: 0.18, type: "sawtooth", gain: 0.035 });
    }
  }

  /* =========================
     CSS
     ========================= */
  const style = document.createElement("style");
  style.textContent = `
  :root {
    --k-bg:${L.defaults.bg};
    --k-primary:${L.defaults.primary};
    --k-accent:${L.defaults.accent};
    --k-text:${L.defaults.text};
    --k-radius:18px;
    --k-radius-lg:24px;
    --k-widget-bg:${L.defaults.bg};
    --k-header-bg:${L.defaults.primary};
    --k-header-text:#ffffff;
    --k-user-bg:${L.defaults.primary};
    --k-user-text:#ffffff;
    --k-bot-bg:#1f2937;
    --k-bot-text:#e5e7eb;
    --k-input-bg:#020617;
    --k-input-text:var(--k-text);
    --k-button-bg:var(--k-primary);
    --k-button-text:#ffffff;
  }
  .k-dark {
    --k-bg:#020617;
    --k-text:#e5e7eb;
  }

  /* Animacje */
  @keyframes k-msg-in-bot {
    from { opacity:0; transform:translateY(4px) translateX(-2px); }
    to { opacity:1; transform:translateY(0) translateX(0); }
  }
  @keyframes k-msg-in-user {
    from { opacity:0; transform:translateY(4px) translateX(2px); }
    to { opacity:1; transform:translateY(0) translateX(0); }
  }
  @keyframes k-quick-pulse {
    0% { transform:translateY(0); box-shadow:none; }
    50% { transform:translateY(-1px); box-shadow:0 6px 16px rgba(15,23,42,.25); }
    100% { transform:translateY(0); box-shadow:none; }
  }
  @keyframes k-open-demo-key {
    0% { opacity:0; transform:translateY(20px) scale(.94); box-shadow:0 0 0 rgba(59,130,246,0); }
    60% { opacity:1; transform:translateY(0) scale(1); box-shadow:0 20px 80px rgba(59,130,246,.45); }
    100% { box-shadow:0 35px 120px rgba(15,23,42,.9); }
  }
  @keyframes k-open-amico-key {
    0% { opacity:0; transform:translateY(18px) scale(.94); }
    50% { opacity:1; transform:translateY(-4px) scale(1.01); }
    100% { transform:translateY(0) scale(1); }
  }
  @keyframes k-open-premium-key {
    0% { opacity:0; transform:translateY(28px) scale(.96); filter:blur(4px); }
    60% { opacity:1; transform:translateY(0) scale(1); filter:blur(0); }
    100% { transform:translateY(0) scale(1); }
  }

  /* Launcher */
  #k-launcher {
    position:fixed;right:24px;bottom:24px;
    width:60px;height:60px;border-radius:50%;
    background:linear-gradient(135deg,var(--k-primary),var(--k-accent));
    color:#fff;
    display:flex;align-items:center;justify-content:center;
    cursor:pointer;z-index:99999;
    box-shadow:0 18px 50px rgba(15,23,42,.6);
    transition:transform .2s ease, box-shadow .2s ease, opacity .2s ease;
    opacity:0;transform:translateY(10px) scale(.95);
    font-size:26px;
    will-change:transform,opacity;
  }
  #k-launcher.k-visible {
    opacity:1;
    transform:translateY(0) scale(1);
  }
  #k-launcher:hover {
    transform:translateY(-2px) scale(1.03);
    box-shadow:0 25px 70px rgba(15,23,42,.85);
  }

  /* Widget */
  #k-widget {
    position:fixed;right:24px;bottom:96px;
    width:400px;height:600px;
    background:var(--k-widget-bg);
    border-radius:var(--k-radius-lg);
    display:flex;flex-direction:column;
    box-shadow:0 40px 140px rgba(15,23,42,.9);
    opacity:0;pointer-events:none;
    transform:translateY(20px) scale(.97);
    transition:opacity .25s ease, transform .25s ease;
    z-index:99999;
    color:var(--k-text);
    overflow:hidden;
    font-family:system-ui,-apple-system,BlinkMacSystemFont,"SF Pro Text","Segoe UI",sans-serif;
    will-change:transform,opacity;
  }
  #k-widget.open {
    opacity:1;pointer-events:auto;
  }
  #k-widget.k-open-demo {
    animation:k-open-demo-key .32s ease-out forwards;
  }
  #k-widget.k-open-amico {
    animation:k-open-amico-key .34s cubic-bezier(.18,.89,.32,1.28) forwards;
  }
  #k-widget.k-open-premium {
    animation:k-open-premium-key .4s ease-out forwards;
  }

  /* Style variants */
  #k-widget.k-style-neoglass {
    background:radial-gradient(circle at top left,#0b1120 0,#020617 42%,#020617 100%);
    border:1px solid rgba(148,163,184,.4);
    backdrop-filter:blur(24px);
  }
  #k-widget.k-style-neoglass #k-header {
    background:linear-gradient(120deg,rgba(37,99,235,.98),rgba(56,189,248,.95));
  }
  #k-widget.k-style-friendly {
    background:linear-gradient(180deg,#faf5f0,#f6f4ef);
  }
  #k-widget.k-style-friendly #k-header {
    background:linear-gradient(120deg,#111827,#4b5563);
  }
  #k-widget.k-style-premium {
    background:radial-gradient(circle at top,#020617,#020617 45%,#020617 100%);
  }
  #k-widget.k-style-premium #k-header {
    background:linear-gradient(120deg,#020617,#111827);
    border-bottom:1px solid rgba(148,163,184,.4);
  }

  #k-header {
    display:flex;align-items:center;gap:10px;
    padding:12px 14px;
    color:var(--k-header-text);
    cursor:move;user-select:none;
  }
  #k-header-logo {
    width:30px;height:30px;border-radius:999px;
    display:flex;align-items:center;justify-content:center;
    background:rgba(15,23,42,.2);
    font-weight:600;font-size:15px;
    color:var(--k-header-text);
  }
  #k-header main {
    display:flex;flex-direction:column;line-height:1.2;
  }
  #k-header main strong {
    font-size:13px;
  }
  #k-header main small {
    font-size:11px;opacity:.8;
  }
  #k-controls {
    margin-left:auto;display:flex;gap:6px;align-items:center;
  }
  #k-controls button {
    background:rgba(15,23,42,.3);border:none;color:#e5e7eb;
    cursor:pointer;font-size:13px;border-radius:999px;
    width:26px;height:26px;display:flex;align-items:center;justify-content:center;
    transition:background .15s ease, transform .1s ease;
  }
  #k-controls button:hover {
    background:rgba(15,23,42,.5);
    transform:translateY(-1px);
  }
  #k-controls button:active {
    transform:translateY(0);
  }

  #k-status-bar {
    display:flex;align-items:center;gap:8px;
    padding:7px 13px;
    font-size:11px;
    border-bottom:1px solid rgba(148,163,184,.3);
    background:rgba(15,23,42,.04);
  }
  #k-status-indicator {
    width:8px;height:8px;border-radius:999px;
    background:#22c55e;
    box-shadow:0 0 0 4px rgba(34,197,94,.3);
  }
  #k-status-text {
    color:#64748b;
  }
  #k-status-actions {
    margin-left:auto;display:flex;gap:6px;
  }
  #k-status-actions button {
    border:none;background:none;font-size:11px;cursor:pointer;
    color:#64748b;padding:2px 6px;border-radius:999px;
    transition:background .15s ease, transform .1s ease;
  }
  #k-status-actions button:hover {
    background:rgba(148,163,184,.2);
    transform:translateY(-1px);
  }

  #k-quick {
    display:flex;gap:8px;padding:8px 12px 2px;
    flex-wrap:wrap;
  }
  .k-q {
    padding:6px 10px;border-radius:999px;border:1px solid rgba(148,163,184,.4);
    cursor:pointer;background:rgba(15,23,42,.02);
    color:#64748b;font-size:11px;
    display:inline-flex;align-items:center;gap:6px;
    transition:background .15s ease,border-color .15s ease, color .15s ease, transform .1s ease, box-shadow .1s ease;
  }
  .k-q::before {
    content:"⚡";font-size:11px;
  }
  .k-q:hover {
    background:rgba(15,23,42,.06);
    border-color:var(--k-accent);
    color:#0f172a;
    transform:translateY(-1px);
    box-shadow:0 6px 16px rgba(15,23,42,.25);
  }

  #k-messages-wrapper {
    position:relative;
    flex:1;
    padding:2px 12px 8px;
    overflow:hidden;
  }
  #k-messages {
    height:100%;
    overflow-y:auto;
    padding-right:6px;
  }
  #k-messages::-webkit-scrollbar {
    width:6px;
  }
  #k-messages::-webkit-scrollbar-thumb {
    background:rgba(148,163,184,.7);
    border-radius:999px;
  }

  .k-msg-row {
    display:flex;gap:8px;margin-bottom:9px;
    align-items:flex-end;
  }
  .k-msg-row.k-user {
    justify-content:flex-end;
  }
  .k-avatar {
    width:22px;height:22px;border-radius:999px;
    display:flex;align-items:center;justify-content:center;
    font-size:13px;
    background:rgba(148,163,184,.3);
    flex-shrink:0;
  }
  .k-msg {
    max-width:78%;
    padding:8px 11px;
    border-radius:13px;
    font-size:13px;
    line-height:1.45;
    position:relative;
    white-space:pre-wrap;
    word-wrap:break-word;
  }
  .k-msg.k-user {
    background:var(--k-user-bg);
    color:var(--k-user-text);
    border-bottom-right-radius:4px;
    animation:k-msg-in-user .16s ease-out;
  }
  .k-msg.k-bot {
    background:var(--k-bot-bg);
    color:var(--k-bot-text);
    border-bottom-left-radius:4px;
    animation:k-msg-in-bot .16s ease-out;
  }
  .k-msg .k-meta {
    margin-top:3px;
    font-size:10px;
    opacity:.7;
  }
  .k-msg a {
    color:var(--k-accent);
    text-decoration:none;
  }
  .k-msg a:hover {text-decoration:underline;}

  .k-typing {
    opacity:.7;font-style:italic;
  }

  #k-footer {
    border-top:1px solid rgba(148,163,184,.35);
    padding:8px 11px 10px;
    background:linear-gradient(to top,rgba(15,23,42,.06),transparent);
  }
  #k-input-top {
    display:flex;align-items:center;justify-content:space-between;
    font-size:11px;color:#6b7280;
    margin-bottom:4px;
  }
  #k-input-top span {
    display:flex;align-items:center;gap:6px;
  }
  #k-input-top span::before {
    content:"✨";
  }
  #k-input {
    display:flex;gap:8px;align-items:flex-end;
  }
  #k-text {
    flex:1;padding:9px 10px;
    border-radius:11px;
    border:1px solid rgba(148,163,184,.7);
    font-size:13px;
    outline:none;
    resize:none;
    max-height:80px;
    min-height:34px;
    line-height:1.35;
    font-family:inherit;
    background:var(--k-input-bg);
    color:var(--k-input-text);
  }
  #k-text:focus {
    border-color:var(--k-accent);
    box-shadow:0 0 0 1px rgba(56,189,248,.4);
  }
  #k-send {
    padding:0 14px;border-radius:999px;border:none;
    background:var(--k-button-bg);color:var(--k-button-text);cursor:pointer;
    height:34px;min-width:34px;
    display:flex;align-items:center;justify-content:center;
    font-size:12px;
    box-shadow:0 12px 25px rgba(37,99,235,.45);
    transition:background .15s ease, transform .12s ease, box-shadow .12s ease, opacity .12s ease;
  }
  #k-send span {margin-left:4px;}
  #k-send[disabled] {
    opacity:.6;cursor:default;box-shadow:none;
  }
  #k-send:not([disabled]):hover {
    transform:translateY(-1px);
    box-shadow:0 16px 30px rgba(37,99,235,.55);
  }
  #k-send:not([disabled]):active {
    transform:translateY(0);
    box-shadow:0 10px 22px rgba(37,99,235,.4);
  }

  .k-badge {
    padding:2px 8px;border-radius:999px;
    font-size:10px;
    border:1px solid rgba(148,163,184,.6);
    color:#64748b;
  }

  @media (max-width: 640px) {
    #k-widget {
      width:100%;
      height:100%;
      right:0;bottom:0;
      border-radius:0;
    }
    #k-launcher {
      right:16px;bottom:16px;
    }
  }
  `;
  document.head.appendChild(style);

  /* =========================
     HTML
     ========================= */
  const launcher = document.createElement("div");
  launcher.id = "k-launcher";
  launcher.textContent = L.logoType === "emoji" ? L.logo : "💬";

  const widget = document.createElement("div");
  widget.id = "k-widget";
  widget.classList.add(`k-style-${L.style}`);
  if (darkMode) widget.classList.add("k-dark");

  const logoContent = L.logoType === "emoji"
    ? `<span>${L.logo}</span>`
    : `<span style="font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;">${L.logo}</span>`;

  widget.innerHTML = `
    <div id="k-header">
      <div id="k-header-logo">${logoContent}</div>
      <main>
        <strong>${L.name}</strong>
        <small>${L.subtitle}</small>
      </main>
      <div id="k-controls">
        <button id="k-history" title="Wyczyść historię">🧹</button>
        <button id="k-theme" title="Przełącz motyw">🌓</button>
        <button id="k-close" title="Zamknij">✕</button>
      </div>
    </div>
    <div id="k-status-bar">
      <div id="k-status-indicator"></div>
      <div id="k-status-text">Online – gotowy do rozmowy</div>
      <div id="k-status-actions">
        <button id="k-expand-toggle">Pełny widok</button>
      </div>
    </div>
    <div id="k-quick"></div>
    <div id="k-messages-wrapper">
      <div id="k-messages"></div>
    </div>
    <div id="k-footer">
      <div id="k-input-top">
        <span>Rozumie naturalny język i kontekst</span>
        <div class="k-badge">Enter – wyślij • Shift+Enter – nowa linia</div>
      </div>
      <div id="k-input">
        <textarea id="k-text" placeholder="Napisz wiadomość…" rows="1"></textarea>
        <button id="k-send"><span>➤</span></button>
      </div>
    </div>
  `;

  document.body.appendChild(launcher);
  document.body.appendChild(widget);

  requestAnimationFrame(() => launcher.classList.add("k-visible"));

  if (savedPos) {
    widget.style.left = savedPos.x + "px";
    widget.style.top = savedPos.y + "px";
    widget.style.right = "auto";
    widget.style.bottom = "auto";
  }

  const header = widget.querySelector("#k-header");
  const messages = widget.querySelector("#k-messages");
  const input = widget.querySelector("#k-text");
  const sendBtn = widget.querySelector("#k-send");
  const themeBtn = widget.querySelector("#k-theme");
  const closeBtn = widget.querySelector("#k-close");
  const quick = widget.querySelector("#k-quick");
  const historyBtn = widget.querySelector("#k-history");
  const expandBtn = widget.querySelector("#k-expand-toggle");
  const statusIndicator = widget.querySelector("#k-status-indicator");
  const statusText = widget.querySelector("#k-status-text");

  /* =========================
     Markdown-lite
     ========================= */
  function renderMarkdown(text) {
    if (!text) return "";
    let t = text;
    t = t.replace(/</g, "&lt;").replace(/>/g, "&gt;");
    t = t.replace(/

\[([^\]

]+)\]

\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
    t = t.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    t = t.replace(/\*([^*]+)\*/g, "<em>$1</em>");
    t = t.replace(/\n/g, "<br>");
    return t;
  }

  /* =========================
     Quick actions
     ========================= */
  L.quick.forEach(q => {
    const b = document.createElement("button");
    b.className = "k-q";
    b.textContent = q;
    b.onclick = () => {
      input.value = q;
      autoResizeInput();
      send();
    };
    quick.appendChild(b);
  });

  /* =========================
     Dragging
     ========================= */
  header.addEventListener("mousedown", e => {
    if (e.target.closest("#k-controls")) return;
    isDragging = true;
    const r = widget.getBoundingClientRect();
    dragOffsetX = e.clientX - r.left;
    dragOffsetY = e.clientY - r.top;
  });

  document.addEventListener("mousemove", e => {
    if (!isDragging) return;
    widget.style.left = Math.max(0, e.clientX - dragOffsetX) + "px";
    widget.style.top = Math.max(0, e.clientY - dragOffsetY) + "px";
    widget.style.right = "auto";
    widget.style.bottom = "auto";
  });

  document.addEventListener("mouseup", () => {
    if (!isDragging) return;
    isDragging = false;
    localStorage.setItem(POS_KEY, JSON.stringify({
      x: widget.offsetLeft,
      y: widget.offsetTop
    }));
  });

  /* =========================
     Historia
     ========================= */
  function loadHistory() {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    try { return JSON.parse(raw) || []; } catch { return []; }
  }

  function saveHistory(history) {
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(history)); } catch {}
  }

  let history = loadHistory();

  function scrollToBottom() {
    messages.scrollTop = messages.scrollHeight + 999;
  }

  function addMessageElement(html, clsRow, clsMsg, avatar, metaText) {
    const row = document.createElement("div");
    row.className = `k-msg-row ${clsRow}`;

    const avatarDiv = document.createElement("div");
    avatarDiv.className = "k-avatar";
    avatarDiv.textContent = avatar || "";

    const msg = document.createElement("div");
    msg.className = `k-msg ${clsMsg}`;
    msg.innerHTML = html;

    if (metaText) {
      const meta = document.createElement("div");
      meta.className = "k-meta";
      meta.textContent = metaText;
      msg.appendChild(meta);
    }

    if (clsRow === "k-user") {
      row.appendChild(msg);
      row.appendChild(avatarDiv);
    } else {
      row.appendChild(avatarDiv);
      row.appendChild(msg);
    }

    messages.appendChild(row);
    scrollToBottom();
    return row;
  }

  function addUser(text, opts = {}) {
    const meta = opts.meta || "Ty";
    const html = renderMarkdown(text);
    addMessageElement(html, "k-user", "k-user", L.avatarUser, meta);
    if (opts.store !== false) {
      history.push({ role: "user", content: text, meta });
      saveHistory(history);
    }
  }

  function addBot(text, opts = {}) {
    const meta = opts.meta || "Asystent";
    const html = renderMarkdown(text);
    addMessageElement(html, "k-bot-row", "k-bot", L.avatarBot, meta);
    if (opts.store !== false) {
      history.push({ role: "assistant", content: text, meta });
      saveHistory(history);
    }
  }

  function addTyping() {
    const row = document.createElement("div");
    row.className = "k-msg-row k-bot-row";
    const avatarDiv = document.createElement("div");
    avatarDiv.className = "k-avatar";
    avatarDiv.textContent = L.avatarBot;

    const msg = document.createElement("div");
    msg.className = "k-msg k-bot k-typing";
    msg.textContent = "Asystent pisze…";

    row.appendChild(avatarDiv);
    row.appendChild(msg);
    messages.appendChild(row);
    scrollToBottom();
    return row;
  }

  function renderHistory() {
    messages.innerHTML = "";
    if (!history.length) {
      let welcome = "W czym mogę pomóc?";
      if (CLIENT_ID === "amico") {
        welcome = "Cześć, tu asystent AMICO. Zapytaj o blaty, materiały lub realizacje.";
      } else if (CLIENT_ID === "premium") {
        welcome = "Dzień dobry, jestem asystentem wersji Premium. Jak mogę pomóc?";
      }
      addBot(welcome, { store: false, meta: "Start sesji" });
      return;
    }
    history.forEach(item => {
      if (item.role === "user") {
        addUser(item.content, { store: false, meta: item.meta });
      } else if (item.role === "assistant") {
        addBot(item.content, { store: false, meta: item.meta });
      }
    });
  }

  /* =========================
     Input
     ========================= */
  function autoResizeInput() {
    input.style.height = "auto";
    input.style.height = Math.min(input.scrollHeight, 80) + "px";
  }
  input.addEventListener("input", autoResizeInput);

  /* =========================
     Theme z backendu
     ========================= */
  function applyThemeFromServer(theme) {
    if (!theme || themeAppliedFromServer) return;
    themeAppliedFromServer = true;
    const root = document.documentElement;

    if (theme.widgetBg) root.style.setProperty("--k-widget-bg", theme.widgetBg);
    if (theme.headerBg) root.style.setProperty("--k-header-bg", theme.headerBg);
    if (theme.headerText) root.style.setProperty("--k-header-text", theme.headerText);
    if (theme.userBubbleBg) root.style.setProperty("--k-user-bg", theme.userBubbleBg);
    if (theme.userBubbleText) root.style.setProperty("--k-user-text", theme.userBubbleText);
    if (theme.botBubbleBg) root.style.setProperty("--k-bot-bg", theme.botBubbleBg);
    if (theme.botBubbleText) root.style.setProperty("--k-bot-text", theme.botBubbleText);
    if (theme.inputBg) root.style.setProperty("--k-input-bg", theme.inputBg);
    if (theme.inputText) root.style.setProperty("--k-input-text", theme.inputText);
    if (theme.buttonBg) root.style.setProperty("--k-button-bg", theme.buttonBg);
    if (theme.buttonText) root.style.setProperty("--k-button-text", theme.buttonText);

    if (typeof theme.radius === "number") {
      root.style.setProperty("--k-radius", `${theme.radius}px`);
      root.style.setProperty("--k-radius-lg", `${theme.radius + 4}px`);
    }
  }

  /* =========================
     Wysyłanie
     ========================= */
  async function send() {
    const text = input.value.trim();
    if (!text || isLoading) return;

    isLoading = true;
    sendBtn.disabled = true;
    statusIndicator.style.background = "#eab308";
    statusText.textContent = "Wysyłanie…";

    addUser(text);
    input.value = "";
    autoResizeInput();
    playSound("send");

    const typingRow = addTyping();

    try {
      const res = await fetch(BACKEND_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, sessionId, clientId: CLIENT_ID })
      });
      if (!res.ok) throw new Error("Network error");
      const data = await res.json();
      sessionId = data.sessionId || sessionId;

      typingRow.remove();
      addBot(data.reply || "Brak odpowiedzi z serwera.");
      playSound("receive");

      if (data.theme) {
        applyThemeFromServer(data.theme);
      }

      statusIndicator.style.background = "#22c55e";
      statusText.textContent = "Online – odpowiedź odebrana";
    } catch (err) {
      typingRow.remove();
      addBot("Wystąpił błąd połączenia. Spróbuj ponownie za chwilę.");
      statusIndicator.style.background = "#ef4444";
      statusText.textContent = "Offline – problem z połączeniem";
      playSound("error");
    } finally {
      isLoading = false;
      sendBtn.disabled = false;
    }
  }

  /* =========================
     Zdarzenia
     ========================= */
  launcher.onclick = () => {
    isOpen = !isOpen;
    if (isOpen) {
      widget.classList.add("open");
      widget.classList.remove("k-open-demo","k-open-amico","k-open-premium");
      widget.classList.add(L.openAnimationClass);
      playSound(`open-${CLIENT_ID}`); // różne otwarcia dźwiękowe
      setTimeout(scrollToBottom, 80);
    } else {
      widget.classList.remove("open","k-open-demo","k-open-amico","k-open-premium");
    }
  };

  closeBtn.onclick = e => {
    e.stopPropagation();
    widget.classList.remove("open","k-open-demo","k-open-amico","k-open-premium");
    isOpen = false;
  };

  ["click","mousedown","mouseup"].forEach(ev => {
    themeBtn.addEventListener(ev, e => e.stopPropagation());
    historyBtn.addEventListener(ev, e => e.stopPropagation());
    closeBtn.addEventListener(ev, e => e.stopPropagation());
    expandBtn.addEventListener(ev, e => e.stopPropagation());
  });

  themeBtn.onclick = e => {
    e.preventDefault();
    darkMode = !darkMode;
    widget.classList.toggle("k-dark", darkMode);
    localStorage.setItem(DARK_KEY, darkMode ? "1" : "0");
  };

  historyBtn.onclick = e => {
    e.preventDefault();
    if (!confirm("Czy na pewno chcesz wyczyścić historię rozmowy dla tego asystenta?")) return;
    history = [];
    saveHistory(history);
    renderHistory();
  };

  expandBtn.onclick = e => {
    e.preventDefault();
    fullscreen = !fullscreen;
    if (fullscreen) {
      widget.style.left = "0";
      widget.style.top = "0";
      widget.style.right = "0";
      widget.style.bottom = "0";
      widget.style.width = "100%";
      widget.style.height = "100%";
      widget.style.borderRadius = "0";
      expandBtn.textContent = "Zwiń widok";
    } else {
      widget.removeAttribute("style");
      widget.classList.add(`k-style-${L.style}`);
      if (darkMode) widget.classList.add("k-dark");
      if (savedPos) {
        widget.style.left = savedPos.x + "px";
        widget.style.top = savedPos.y + "px";
        widget.style.right = "auto";
        widget.style.bottom = "auto";
      }
      expandBtn.textContent = "Pełny widok";
      if (isOpen) {
        widget.classList.add(L.openAnimationClass);
      }
    }
  };

  sendBtn.onclick = send;

  input.addEventListener("keydown", e => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  });

  widget.addEventListener("click", e => {
    e.stopPropagation();
  });

  // start
  renderHistory();
})();


