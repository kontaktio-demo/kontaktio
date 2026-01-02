(function () {
  if (window.KontaktioLoaded) return;
  window.KontaktioLoaded = true;

  /* ---------------- CONFIG & STATE ---------------- */

  const script =
    document.currentScript ||
    document.querySelector('script[data-client][data-kontaktio]');

  const CLIENT_ID = script?.getAttribute("data-client") || "demo";

  const BACKEND_URL =
    script?.getAttribute("data-backend") ||
    "https://chatbot-backend-x2cy.onrender.com/chat";

  // opcjonalny config JSON (np. do dodatkowego statusu) – backend i tak broni się sam
  const CONFIG_URL = script?.getAttribute("data-config") || null;

  const AUTO_OPEN = script?.getAttribute("data-auto-open") === "true";
  const AUTO_OPEN_DELAY =
    parseInt(script?.getAttribute("data-auto-open-delay"), 10) || 15000;

  const MAX_HISTORY_ITEMS = 50;
  const MAX_DOM_MESSAGES = 120;
  const MAX_USER_MESSAGE_LENGTH = 1200;

  const STORAGE_KEY_HISTORY = `kontaktio-history-${CLIENT_ID}`;
  const STORAGE_KEY_SESSION = `kontaktio-session-${CLIENT_ID}`;
  const STORAGE_KEY_OPEN = `kontaktio-open-${CLIENT_ID}`;

  let sessionId = null;
  let isOpen = false;
  let isSending = false;
  let clientActive = true;
  let clientStatusMessage = null;
  let launcherCreated = false;

  document.body.classList.add("k-theme-" + CLIENT_ID);

  /* ---------------- THEME ---------------- */

  const BASE_THEME = {
    accent: "#22d3ee",
    accent2: "#2563eb",
    accentSoft: "rgba(34,211,238,0.25)",
    name: "Asystent demo",
    subtitle: "Wyjaśnia, pokazuje, edukuje",
    launcherIcon: "💬",
    widgetRadius: "22px",
    widgetBorder: "1px solid rgba(148,163,184,.55)",
    widgetShadow: "0 26px 90px rgba(15,23,42,1)",
    headerStripe: "transparent",
    agentBubbleExtra: ""
  };

  const THEME =
    CLIENT_ID === "amico"
      ? {
          ...BASE_THEME,
          accent: "#f97316",
          accent2: "#ea580c",
          accentSoft: "rgba(249,115,22,0.25)",
          name: "Asystent branżowy",
          subtitle:
            "Konkretnie, warsztatowo, bez lania wody, Firma Kamieniarska",
          launcherIcon: "🛠️",
          widgetRadius: "18px",
          widgetBorder: "1px solid rgba(248,187,109,0.7)",
          widgetShadow: "0 24px 70px rgba(120,53,15,0.9)",
          headerStripe:
            "linear-gradient(90deg, rgba(249,115,22,0.45), transparent 60%)",
          agentBubbleExtra: "border-left: 2px solid rgba(249,115,22,0.7);"
        }
      : CLIENT_ID === "premium"
      ? {
          ...BASE_THEME,
          accent: "#a855f7",
          accent2: "#7c3aed",
          accentSoft: "rgba(168,85,247,0.25)",
          name: "Asystent premium",
          subtitle: "Elegancki, spokojny, ekskluzywny ton",
          launcherIcon: "✨",
          widgetRadius: "26px",
          widgetBorder: "1px solid rgba(209,213,219,0.65)",
          widgetShadow: "0 30px 90px rgba(15,23,42,0.98)",
          headerStripe:
            "linear-gradient(90deg, rgba(168,85,247,0.45), transparent 60%)",
          agentBubbleExtra:
            "box-shadow: 0 0 0 1px rgba(168,85,247,0.45);"
        }
      : BASE_THEME;

  /* ---------------- SOUNDS (hook pod przyszłość) ---------------- */

  const SOUNDS = {
    open: null,
    send: null,
    receive: null
  };

  function playSound(key) {
    const s = SOUNDS[key];
    if (!s) return;
    try {
      s.currentTime = 0;
      s.play();
    } catch {}
  }

  /* ---------------- HELPERS ---------------- */

  function dispatchEvent(name, detail) {
    try {
      window.dispatchEvent(
        new CustomEvent(`kontaktio:${name}`, { detail: detail || {} })
      );
    } catch {}
  }

  function formatTime(d) {
    try {
      const dt = typeof d === "string" ? new Date(d) : d;
      return dt.toLocaleTimeString("pl-PL", {
        hour: "2-digit",
        minute: "2-digit"
      });
    } catch {
      return "";
    }
  }

  function escapeHtml(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  // prosty parser: linki + nowe linie, minimalny markdown
  function renderMessageContent(text) {
    if (!text) return "";
    let safe = escapeHtml(text);

    // pogrubienie **tekst**
    safe = safe.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");

    // proste listy: linie zaczynające się od "- "
    if (safe.includes("- ")) {
      const lines = safe.split(/\n/);
      let inList = false;
      let out = "";
      for (const line of lines) {
        if (line.trim().startsWith("- ")) {
          if (!inList) {
            inList = true;
            out += "<ul>";
          }
          out += `<li>${line.trim().slice(2)}</li>`;
        } else {
          if (inList) {
            inList = false;
            out += "</ul>";
          }
          if (line.trim()) {
            out += `<p>${line}</p>`;
          } else {
            out += "<br/>";
          }
        }
      }
      if (inList) out += "</ul>";
      safe = out;
    } else {
      // zwykłe nowe linie
      safe = safe.replace(/\n/g, "<br/>");
    }

    // linki
    const urlRegex = /\b(https?:\/\/[^\s<]+[^\s<\.)])/gi;
    safe = safe.replace(
      urlRegex,
      '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>'
    );

    return safe;
  }

  function saveHistory(messages) {
    try {
      localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(messages));
    } catch {}
  }

  function loadHistory() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_HISTORY);
      if (!raw) return [];
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }

  function saveSessionId(id) {
    try {
      localStorage.setItem(STORAGE_KEY_SESSION, id);
    } catch {}
  }

  function loadSessionId() {
    try {
      return localStorage.getItem(STORAGE_KEY_SESSION);
    } catch {
      return null;
    }
  }

  function saveOpenState(open) {
    try {
      localStorage.setItem(STORAGE_KEY_OPEN, open ? "1" : "0");
    } catch {}
  }

  function loadOpenState() {
    try {
      return localStorage.getItem(STORAGE_KEY_OPEN) === "1";
    } catch {
      return false;
    }
  }

  function hasMessages() {
    const messages = document.getElementById("k-messages");
    if (!messages) return false;
    return messages.querySelector(".k-msg-row") !== null;
  }

  function trimDomMessages() {
    const messages = document.getElementById("k-messages");
    if (!messages) return;
    const rows = messages.querySelectorAll(".k-msg-row");
    if (rows.length <= MAX_DOM_MESSAGES) return;
    const toRemove = rows.length - MAX_DOM_MESSAGES;
    for (let i = 0; i < toRemove; i++) {
      const row = rows[i];
      const wrap = row.parentElement;
      if (wrap && wrap.parentElement === messages) {
        messages.removeChild(wrap);
      }
    }
  }

  function withTimeout(promise, ms) {
    return Promise.race([
      promise,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("timeout")), ms)
      )
    ]);
  }

  /* ---------------- CLIENT STATUS (opcjonalny frontend guard) ---------------- */

  async function checkClientStatus() {
    if (!CONFIG_URL) return; // główne sprawdzenie jest po stronie backendu

    try {
      const res = await fetch(CONFIG_URL, { cache: "no-store" });
      if (!res.ok) return;
      const cfg = await res.json();
      const client = cfg[CLIENT_ID];

      if (!client || client.status !== "active") {
        clientActive = false;
        clientStatusMessage =
          client?.statusMessage ||
          "Asystent jest obecnie niedostępny. Skontaktuj się bezpośrednio z firmą.";
      }
    } catch (e) {
      console.warn("[Kontaktio] Nie udało się pobrać statusu klienta:", e);
    }
  }

  /* ---------------- STYLE ---------------- */

  const style = document.createElement("style");
  style.textContent = `
  #k-launcher {
    position: fixed;
    right: 20px;
    bottom: 20px;
    width: 56px;
    height: 56px;
    border-radius: ${CLIENT_ID === "amico" ? "16px" : "999px"};
    border: 1px solid rgba(148,163,184,.65);
    background:
      radial-gradient(circle at 30% 0, ${THEME.accentSoft}, rgba(15,23,42,0.98)),
      linear-gradient(145deg, rgba(15,23,42,0.98), rgba(15,23,42,1));
    box-shadow:
      0 18px 55px rgba(15,23,42,0.98),
      0 0 0 1px rgba(15,23,42,1);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    z-index: 9999;
    color: #e5e7eb;
    transition: transform .18s ease, box-shadow .18s ease, background .22s ease, border-radius .22s ease, box-shadow .3s ease;
    backdrop-filter: blur(16px);
  }
  #k-launcher:hover {
    transform: translateY(-1px) scale(1.03);
    box-shadow:
      0 22px 65px rgba(15,23,42,1),
      0 0 0 1px ${THEME.accentSoft};
    background:
      radial-gradient(circle at 20% 0, ${THEME.accentSoft}, rgba(15,23,42,0.95)),
      linear-gradient(145deg, rgba(15,23,42,0.98), rgba(15,23,42,1));
  }
  #k-launcher.k-has-unread {
    box-shadow:
      0 0 0 0 rgba(56,189,248,0.8),
      0 18px 55px rgba(15,23,42,0.98);
    animation: k-pulse 1.8s infinite;
  }
  @keyframes k-pulse {
    0% { box-shadow: 0 0 0 0 rgba(56,189,248,0.7), 0 18px 55px rgba(15,23,42,0.98); }
    70% { box-shadow: 0 0 0 10px rgba(56,189,248,0), 0 18px 55px rgba(15,23,42,0.98); }
    100% { box-shadow: 0 0 0 0 rgba(56,189,248,0), 0 18px 55px rgba(15,23,42,0.98); }
  }
  #k-launcher-icon {
    font-size: 22px;
  }

  #k-widget {
    position: fixed;
    right: 20px;
    bottom: 86px;
    width: min(380px, calc(100vw - 24px));
    height: min(560px, calc(100vh - 120px));
    background:
      radial-gradient(circle at top left, rgba(15,23,42,0.96), rgba(15,23,42,1));
    border-radius: ${THEME.widgetRadius};
    box-shadow: ${THEME.widgetShadow};
    border: ${THEME.widgetBorder};
    display: flex;
    flex-direction: column;
    overflow: hidden;
    z-index: 9999;
    color: #e5e7eb;
    backdrop-filter: blur(22px);
    transform-origin: bottom right;
    animation: k-widget-in .22s ease-out;
  }
  @keyframes k-widget-in {
    from { opacity:0; transform: translateY(8px) scale(.97); }
    to   { opacity:1; transform: translateY(0)   scale(1); }
  }
  @media (max-width: 640px) {
    #k-widget {
      right: 10px;
      left: 10px;
      width: auto;
      bottom: 80px;
      height: min(520px, calc(100vh - 110px));
      border-radius: ${CLIENT_ID === "premium" ? "24px" : "18px"};
    }
    #k-launcher {
      right: 16px;
      bottom: 16px;
    }
  }

  #k-header {
    padding: 10px 14px 9px;
    display: flex;
    align-items: center;
    gap: 10px;
    border-bottom: 1px solid rgba(15,23,42,1);
    background:
      ${THEME.headerStripe},
      linear-gradient(135deg, rgba(15,23,42,0.95), rgba(15,23,42,1));
    position: relative;
    overflow: hidden;
  }
  #k-header::after {
    content:"";
    position:absolute;
    inset:-40%;
    background:
      radial-gradient(circle at 0 0, ${THEME.accentSoft}, transparent 55%);
    opacity:0.9;
    pointer-events:none;
  }
  #k-header-inner {
    position: relative;
    z-index: 1;
    display:flex;
    align-items:center;
    gap:10px;
    flex:1;
  }
  #k-avatar {
    width: ${CLIENT_ID === "premium" ? "32px" : "30px"};
    height: ${CLIENT_ID === "premium" ? "32px" : "30px"};
    border-radius: 999px;
    background:
      radial-gradient(circle at 30% 0, #ffffff, ${THEME.accent2});
    display: flex;
    align-items: center;
    justify-content: center;
    color: #020617;
    font-weight: 700;
    font-size: 15px;
    box-shadow:
      0 0 0 2px rgba(15,23,42,1),
      0 10px 26px rgba(15,23,42,0.9);
  }
  #k-header-text {
    display:flex;
    flex-direction:column;
  }
  #k-header-text strong {
    font-size: 13px;
  }
  #k-header-text span {
    font-size: 11px;
    opacity: 0.82;
  }
  #k-header-right {
    position: relative;
    z-index: 1;
    display:flex;
    align-items:center;
    gap:6px;
  }
  #k-pill {
    font-size: 10px;
    padding: 3px 7px;
    border-radius: 999px;
    border: 1px solid rgba(148,163,184,0.7);
    background: rgba(15,23,42,0.85);
    color: #cbd5e1;
  }
  #k-header-close {
    border: none;
    background: transparent;
    color: #9ca3af;
    cursor: pointer;
    padding: 4px;
    border-radius: 999px;
    display:flex;
    align-items:center;
    justify-content:center;
  }
  #k-header-close:hover {
    color: #e5e7eb;
    background: rgba(15,23,42,0.9);
  }

  #k-messages {
    flex: 1;
    padding: 10px 12px 8px;
    overflow-y: auto;
    scrollbar-width: thin;
  }
  #k-messages::-webkit-scrollbar {
    width: 6px;
  }
  #k-messages::-webkit-scrollbar-thumb {
    background: rgba(148,163,184,0.5);
    border-radius: 999px;
  }

  .k-msg-row {
    margin-bottom: 8px;
    display: flex;
    animation: k-bubble-in .18s ease-out;
  }
  @keyframes k-bubble-in {
    from { opacity: 0; transform: translateY(4px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  .k-msg-user {
    justify-content: flex-end;
  }
  .k-msg-agent {
    justify-content: flex-start;
  }
  .k-msg-bubble {
    max-width: 80%;
    font-size: 13px;
    padding: 8px 10px;
    border-radius: 12px;
    line-height: 1.35;
    position: relative;
    word-wrap: break-word;
  }
  .k-msg-bubble-user {
    background: linear-gradient(135deg, ${THEME.accent}, ${THEME.accent2});
    color: #020617;
    border-bottom-right-radius: 3px;
    box-shadow: 0 12px 26px rgba(15,23,42,0.8);
  }
  .k-msg-bubble-agent {
    background: rgba(15,23,42,0.96);
    border: 1px solid rgba(51,65,85,0.9);
    border-bottom-left-radius: 3px;
    ${THEME.agentBubbleExtra}
  }
  .k-msg-bubble a {
    color: ${THEME.accent};
    text-decoration: underline;
  }

  .k-quick-replies {
    margin-top: 4px;
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }
  .k-quick-reply-btn {
    border-radius: 999px;
    border: 1px solid rgba(148,163,184,0.6);
    padding: 2px 7px;
    font-size: 10px;
    background: rgba(15,23,42,0.9);
    color: #cbd5e1;
    cursor: pointer;
  }
  .k-quick-reply-btn:hover {
    border-color: ${THEME.accent};
  }

  .k-msg-time {
    font-size: 10px;
    opacity: 0.5;
    margin-top: 2px;
  }

  #k-quick {
    padding: 6px 10px 4px;
    border-top: 1px solid rgba(15,23,42,1);
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    background: linear-gradient(180deg, rgba(15,23,42,0.98), rgba(15,23,42,1));
  }
  .k-quick-btn {
    border-radius: ${CLIENT_ID === "amico" ? "6px" : "999px"};
    border: 1px solid rgba(148,163,184,0.6);
    padding: 4px 8px;
    font-size: 11px;
    background: rgba(15,23,42,0.95);
    color: #cbd5e1;
    cursor: pointer;
    max-width: 100%;
    text-align: left;
  }
  .k-quick-btn:hover {
    border-color: ${THEME.accent};
    color: #e0f2fe;
  }

  #k-input-area {
    padding: 6px 10px 10px;
    border-top: 1px solid rgba(15,23,42,1);
    display: flex;
    gap: 8px;
    align-items: flex-end;
    background: linear-gradient(180deg, rgba(15,23,42,0.98), rgba(15,23,42,1));
  }
  #k-input {
    flex: 1;
    min-height: 40px;
    max-height: 80px;
    padding: 8px 9px;
    border-radius: 10px;
    border: 1px solid rgba(51,65,85,0.9);
    background: rgba(15,23,42,0.9);
    color: #e5e7eb;
    font-size: 13px;
    resize: none;
    outline: none;
  }
  #k-input::placeholder {
    color: #64748b;
  }
  #k-send {
    width: 36px;
    height: 36px;
    border-radius: 999px;
    border: none;
    background: linear-gradient(135deg, ${THEME.accent}, ${THEME.accent2});
    color: #020617;
    cursor: pointer;
    display:flex;
    align-items:center;
    justify-content:center;
    font-size: 16px;
    box-shadow: 0 10px 25px rgba(15,23,42,0.9);
    transition: transform .15s ease, box-shadow .15s ease, opacity .15s ease;
  }
  #k-send:hover:not([disabled]) {
    transform: translateY(-1px);
    box-shadow: 0 12px 30px rgba(15,23,42,1);
  }
  #k-send[disabled] {
    opacity: 0.5;
    cursor: default;
    box-shadow: none;
  }

  .k-typing {
    font-size: 11px;
    opacity: 0.8;
    padding: 0 4px 4px;
    display: flex;
    align-items: center;
    gap: 5px;
  }
  .k-typing-dots {
    display: inline-flex;
    gap: 3px;
  }
  .k-dot {
    width: 4px;
    height: 4px;
    border-radius: 999px;
    background: #cbd5e1;
    opacity: 0.6;
    animation: k-dot 1s infinite ease-in-out;
  }
  .k-dot:nth-child(2) { animation-delay: .15s; }
  .k-dot:nth-child(3) { animation-delay: .3s; }
  @keyframes k-dot {
    0% { transform: translateY(0); opacity:.6; }
    50%{ transform: translateY(-2px); opacity:1; }
    100%{ transform: translateY(0); opacity:.6; }
  }

  .k-status-banner {
    font-size: 11px;
    padding: 6px 10px;
    border-bottom: 1px solid rgba(30,64,175,0.7);
    background: rgba(15,23,42,0.95);
    color: #e5e7eb;
  }
  .k-clear-btn {
    font-size: 10px;
    background: transparent;
    border: 1px solid rgba(148,163,184,0.6);
    border-radius: 999px;
    padding: 2px 6px;
    color: #cbd5e1;
    cursor: pointer;
    margin-left: 8px;
  }
  .k-clear-btn:hover {
    border-color: ${THEME.accent};
  }
  `;
  document.head.appendChild(style);

  /* ---------------- DOM: MESSAGES ---------------- */

  function appendMessage(text, from = "agent", meta = {}) {
    const messages = document.getElementById("k-messages");
    if (!messages) return;

    const row = document.createElement("div");
    row.className =
      "k-msg-row " + (from === "user" ? "k-msg-user" : "k-msg-agent");

    const bubble = document.createElement("div");
    bubble.className =
      "k-msg-bubble " +
      (from === "user" ? "k-msg-bubble-user" : "k-msg-bubble-agent");
    bubble.innerHTML = renderMessageContent(text);

    row.appendChild(bubble);

    // opcjonalne quick replies (meta.quickReplies)
    if (meta.quickReplies && Array.isArray(meta.quickReplies)) {
      const qrWrap = document.createElement("div");
      qrWrap.className = "k-quick-replies";
      meta.quickReplies.forEach((q) => {
        const btn = document.createElement("button");
        btn.className = "k-quick-reply-btn";
        btn.textContent = q;
        btn.onclick = () => {
          const input = document.getElementById("k-input");
          if (!input || input.disabled) return;
          input.value = q;
          sendMessage();
        };
        qrWrap.appendChild(btn);
      });
      bubble.appendChild(qrWrap);
    }

    const time = meta.time || new Date();
    const timeLabel = document.createElement("div");
    timeLabel.className = "k-msg-time";
    timeLabel.textContent = formatTime(time);

    const wrap = document.createElement("div");
    wrap.appendChild(row);
    wrap.appendChild(timeLabel);

    messages.appendChild(wrap);
    messages.scrollTop = messages.scrollHeight + 40;

    trimDomMessages();
  }

  let typingEl = null;
  function showTyping() {
    if (typingEl) return;
    const messages = document.getElementById("k-messages");
    if (!messages) return;
    typingEl = document.createElement("div");
    typingEl.className = "k-typing";
    typingEl.innerHTML = `
      <span>Asystent pisze</span>
      <span class="k-typing-dots">
        <span class="k-dot"></span>
        <span class="k-dot"></span>
        <span class="k-dot"></span>
      </span>
    `;
    messages.appendChild(typingEl);
    messages.scrollTop = messages.scrollHeight;
  }
  function hideTyping() {
    if (typingEl && typingEl.parentNode) typingEl.parentNode.removeChild(typingEl);
    typingEl = null;
  }

  /* ---------------- QUICK ACTIONS ---------------- */

  function setupQuickActions() {
    const quick = document.getElementById("k-quick");
    if (!quick) return;
    quick.innerHTML = "";

    const dataQuick = script?.getAttribute("data-quick");
    let sets = [];

    if (dataQuick) {
      try {
        const parsed = JSON.parse(dataQuick);
        if (Array.isArray(parsed)) sets = parsed;
      } catch {
        // fallback do zdefiniowanych niżej
      }
    }

    if (!sets.length) {
      sets = {
        demo: [
          "Wyjaśnij, jak działa ten asystent na stronie klienta.",
          "Jak mogę dopasować styl rozmowy do mojej marki?",
          "Podaj przykładowy scenariusz użycia dla firmy usługowej."
        ],
        amico: [
          "Czym sie zajmujecie?",
          "Na jakich materiałach pracujecie?",
          "Czy można sie z wami skontaktować telefonicznie?"
        ],
        premium: [
          "W jaki sposób ten asystent może obsługiwać klientów?",
          "Jak można dopasować design widgetu do identyfikacji wizualnej marki?",
          "Co wyróżnia to rozwiązanie na tle zwykłych chatbotów?"
        ]
      }[CLIENT_ID] || [];
    }

    sets.forEach((text) => {
      const btn = document.createElement("button");
      btn.className = "k-quick-btn";
      btn.textContent = text;
      btn.onclick = () => {
        const input = document.getElementById("k-input");
        if (!input || input.disabled) return;
        input.value = text;
        sendMessage();
      };
      quick.appendChild(btn);
    });
  }

  /* ---------------- HISTORY ---------------- */

  function restoreHistory() {
    const history = loadHistory();
    if (!history.length) return;
    history.forEach((msg) => {
      appendMessage(msg.text, msg.from, { time: msg.time });
    });
  }

  function pushToHistory(text, from) {
    const history = loadHistory();
    history.push({ text, from, time: new Date().toISOString() });
    while (history.length > MAX_HISTORY_ITEMS) history.shift();
    saveHistory(history);
  }

  /* ---------------- BACKEND ---------------- */

  async function sendMessage() {
    if (isSending) return;
    const input = document.getElementById("k-input");
    if (!input || input.disabled) return;

    const text = input.value.trim();
    if (!text) return;

    if (text.length > MAX_USER_MESSAGE_LENGTH) {
      appendMessage(
        "Twoja wiadomość jest dość długa. Spróbuj proszę zadać krótsze, bardziej konkretne pytanie.",
        "agent"
      );
      return;
    }

    if (!navigator.onLine) {
      appendMessage(
        "Wygląda na to, że nie masz połączenia z internetem. Spróbuj ponownie, gdy połączenie wróci.",
        "agent"
      );
      return;
    }

    appendMessage(text, "user");
    pushToHistory(text, "user");
    input.value = "";
    input.style.height = "40px";
    isSending = true;
    const sendBtn = document.getElementById("k-send");
    if (sendBtn) sendBtn.disabled = true;
    showTyping();
    playSound("send");
    dispatchEvent("messageSent", { clientId: CLIENT_ID, message: text });

    try {
      const payload = {
        message: text,
        sessionId: sessionId || loadSessionId() || undefined,
        clientId: CLIENT_ID
      };

      const res = await withTimeout(
        fetch(BACKEND_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        }),
        20000
      );

      let data = null;
      try {
        data = await res.json();
      } catch (e) {
        hideTyping();
        appendMessage(
          "Serwer odpowiedział w nieoczekiwany sposób. Spróbuj ponownie za chwilę.",
          "agent"
        );
        console.error("[Kontaktio] Błąd parsowania JSON:", e);
        return;
      }

      hideTyping();

      if (!res.ok) {
        if (res.status === 403 && data?.status === "unactive") {
          clientActive = false;
          clientStatusMessage =
            data.statusMessage ||
            "Asystent jest obecnie niedostępny. Skontaktuj się bezpośrednio z firmą.";

          appendMessage(clientStatusMessage, "agent");
          console.warn(
            "[Kontaktio] Klient nieaktywny – wyłączam możliwość dalszej rozmowy."
          );

          if (input) {
            input.disabled = true;
            input.placeholder = "Asystent jest nieaktywny.";
          }
          const btn = document.getElementById("k-send");
          if (btn) btn.disabled = true;

          return;
        }

        appendMessage(
          "Asystent chwilowo nie odpowiada. Spróbuj ponownie za moment.",
          "agent"
        );
        return;
      }

      sessionId = data.sessionId || sessionId || data.session_id || null;
      if (sessionId) saveSessionId(sessionId);

      const reply = data.reply || data.message || "Odpowiedź z asystenta.";
      appendMessage(reply, "agent");
      pushToHistory(reply, "agent");
      playSound("receive");
      dispatchEvent("replyReceived", {
        clientId: CLIENT_ID,
        message: reply
      });

      if (!isOpen) {
        const launcher = document.getElementById("k-launcher");
        if (launcher) launcher.classList.add("k-has-unread");
      }
    } catch (err) {
      hideTyping();
      appendMessage(
        "Wystąpił błąd po stronie serwera lub przekroczono czas oczekiwania. Spróbuj ponownie za chwilę.",
        "agent"
      );
      console.error("[Kontaktio] Błąd podczas wysyłania:", err);
    } finally {
      isSending = false;
      const sendBtn2 = document.getElementById("k-send");
      if (sendBtn2) sendBtn2.disabled = false;
    }
  }

  /* ---------------- WELCOME ---------------- */

  function showWelcomeMessage() {
    const baseText =
      CLIENT_ID === "premium"
        ? "Dzień dobry. Jestem asystentem premium Kontaktio. Pokażę Ci, jak zbudować doświadczenie godne Twojej marki."
        : CLIENT_ID === "amico"
        ? "Cześć! Jestem branżowym asystentem Kontaktio. Zobacz, jak ten widget może pracować dla Twojej firmy."
        : "Hej! Jestem demo asystentem Kontaktio. Mogę wytłumaczyć, jak to rozwiązanie sprawdzi się na Twojej stronie.";

    appendMessage(baseText, "agent");
    pushToHistory(baseText, "agent");

    setTimeout(() => {
      const hint =
        CLIENT_ID === "amico"
          ? "Możesz zacząć od pytania o materiały, z których wykonujemy realizacje."
          : "Możesz kliknąć jedno z gotowych pytań poniżej, żeby zobaczyć, jak odpowiadam.";
      appendMessage(hint, "agent");
      pushToHistory(hint, "agent");
    }, 600);
  }

  /* ---------------- DOM: WIDGET & LAUNCHER ---------------- */

  async function createLauncher() {
    if (launcherCreated) return;
    launcherCreated = true;

    await checkClientStatus();

    if (!clientActive) {
      console.warn(
        "[Kontaktio] Klient nieaktywny – widget nie zostanie wyrenderowany.",
        clientStatusMessage
      );
      return;
    }

    const launcher = document.createElement("div");
    launcher.id = "k-launcher";
    launcher.innerHTML = `<div id="k-launcher-icon">${THEME.launcherIcon}</div>`;

    let launcherClickLocked = false;
    launcher.addEventListener("click", () => {
      if (launcherClickLocked) return;
      launcherClickLocked = true;
      setTimeout(() => (launcherClickLocked = false), 200);

      toggleWidget();
    });

    document.body.appendChild(launcher);
    dispatchEvent("launcherCreated", { clientId: CLIENT_ID });
  }

  function createWidget() {
    if (document.getElementById("k-widget")) return;

    const wrap = document.createElement("div");
    wrap.id = "k-widget";
    wrap.innerHTML = `
      <div id="k-header">
        <div id="k-header-inner">
          <div id="k-avatar">
            ${CLIENT_ID === "premium" ? "KP" : CLIENT_ID === "amico" ? "BA" : "AI"}
          </div>
          <div id="k-header-text">
            <strong>${THEME.name}</strong>
            <span>${THEME.subtitle}</span>
          </div>
        </div>
        <div id="k-header-right">
          <div id="k-pill">${
            CLIENT_ID === "premium"
              ? "Premium • AI"
              : CLIENT_ID === "amico"
              ? "Branżowy • AI"
              : "Demo • AI"
          }</div>
          <button id="k-header-close" aria-label="Zamknij">&times;</button>
        </div>
      </div>
      <div id="k-status"></div>
      <div id="k-messages"></div>
      <div id="k-quick"></div>
      <div id="k-input-area">
        <textarea id="k-input" placeholder="Napisz wiadomość..." rows="1"></textarea>
        <button id="k-send">➤</button>
      </div>
    `;
    document.body.appendChild(wrap);

    const headerClose = document.getElementById("k-header-close");
    const input = document.getElementById("k-input");
    const sendBtn = document.getElementById("k-send");
    const statusBar = document.getElementById("k-status");

    if (headerClose) headerClose.onclick = toggleWidget;

    if (statusBar) {
      statusBar.className = "k-status-banner";
      statusBar.innerHTML = `
        <span>Rozmowy z asystentem nie są zapisywane poza tą stroną.</span>
        <button class="k-clear-btn" type="button">Wyczyść rozmowę</button>
      `;
      const clearBtn = statusBar.querySelector(".k-clear-btn");
      if (clearBtn) {
        clearBtn.addEventListener("click", () => {
          const messages = document.getElementById("k-messages");
          if (messages) messages.innerHTML = "";
          saveHistory([]);
          showWelcomeMessage();
        });
      }
    }

    if (input) {
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          sendMessage();
        }
      });

      input.addEventListener("input", () => {
        input.style.height = "auto";
        input.style.height = Math.min(input.scrollHeight, 80) + "px";
      });

      setTimeout(() => {
        if (!input.disabled) input.focus();
      }, 50);
    }

    if (sendBtn) {
      sendBtn.addEventListener("click", sendMessage);
    }

    setupQuickActions();
    restoreHistory();

    if (!hasMessages()) {
      showWelcomeMessage();
    }

    // Esc zamyka widget
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && isOpen) {
        toggleWidget(false);
      }
    });

    dispatchEvent("widgetCreated", { clientId: CLIENT_ID });
  }

  function toggleWidget(force) {
    const launcher = document.getElementById("k-launcher");
    const widget = document.getElementById("k-widget");

    if (!widget && !clientActive) {
      return;
    }

    if (!widget) {
      createWidget();
      isOpen = true;
    } else {
      if (typeof force === "boolean") {
        isOpen = force;
      } else {
        isOpen = !isOpen;
      }
      widget.style.display = isOpen ? "flex" : "none";
    }

    if (isOpen) {
      playSound("open");
      if (launcher) launcher.classList.remove("k-has-unread");
      saveOpenState(true);
      dispatchEvent("opened", { clientId: CLIENT_ID });
    } else {
      saveOpenState(false);
      dispatchEvent("closed", { clientId: CLIENT_ID });
    }
  }

  /* ---------------- INIT ---------------- */

  createLauncher();

  const initialOpen = loadOpenState();
  if (initialOpen) {
    setTimeout(() => {
      const launcher = document.getElementById("k-launcher");
      if (launcher) toggleWidget(true);
    }, 200);
  } else if (AUTO_OPEN) {
    setTimeout(() => {
      const launcher = document.getElementById("k-launcher");
      if (launcher) toggleWidget(true);
    }, AUTO_OPEN_DELAY);
  }

  // otwarcie z parametru w URL ?kontaktio=open
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get("kontaktio") === "open") {
      setTimeout(() => {
        const launcher = document.getElementById("k-launcher");
        if (launcher) toggleWidget(true);
      }, 200);
    }
  } catch {}
})();

