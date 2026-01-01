(function () {
  if (window.KontaktioLoaded) return;
  window.KontaktioLoaded = true;

  const script = document.currentScript;
  const CLIENT_ID = script?.getAttribute("data-client") || "demo";

  // Dostosuj do swojego backendu
  const BACKEND_URL = "https://chatbot-backend-x2cy.onrender.com/chat";

  let sessionId = null;
  let isOpen = false;
  let isSending = false;

  const STORAGE_KEY_HISTORY = `kontaktio-history-${CLIENT_ID}`;
  const STORAGE_KEY_SESSION = `kontaktio-session-${CLIENT_ID}`;

  const THEME = {
    demo: {
      accent: "#22d3ee",
      accent2: "#2563eb",
      accentSoft: "rgba(34,211,238,0.25)",
      name: "Asystent demo",
      subtitle: "Wyjaśnia, pokazuje, edukuje",
      launcherIcon: "💬"
    },
    amico: {
      accent: "#f97316",
      accent2: "#ea580c",
      accentSoft: "rgba(249,115,22,0.25)",
      name: "Asystent branżowy",
      subtitle: "Konkretnie, warsztatowo, bez lania wody",
      launcherIcon: "🛠️"
    },
    premium: {
      accent: "#a855f7",
      accent2: "#7c3aed",
      accentSoft: "rgba(168,85,247,0.25)",
      name: "Asystent premium",
      subtitle: "Elegancki, spokojny, ekskluzywny ton",
      launcherIcon: "✨"
    }
  }[CLIENT_ID] || {
    accent: "#22d3ee",
    accent2: "#2563eb",
    accentSoft: "rgba(34,211,238,0.25)",
    name: "Asystent AI",
    subtitle: "Odpowiada na pytania w czasie rzeczywistym",
    launcherIcon: "✦"
  };

  // proste dźwięki (możesz podmienić na swoje URL-e)
  const SOUNDS = {
    open: null,
    send: null,
    receive: null
    // np. new Audio("https://.../open.mp3")
  };

  function playSound(key) {
    const s = SOUNDS[key];
    if (!s) return;
    try {
      s.currentTime = 0;
      s.play();
    } catch {}
  }

  // ---------------- STYLE MAX PRO ----------------
  const style = document.createElement("style");
  style.textContent = `
  #k-launcher {
    position: fixed;
    right: 20px;
    bottom: 20px;
    width: 56px;
    height: 56px;
    border-radius: 999px;
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
    transition: transform .18s ease, box-shadow .18s ease, background .22s ease;
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
    border-radius: 22px;
    box-shadow:
      0 26px 90px rgba(15,23,42,1),
      0 0 0 1px rgba(30,64,175,0.4);
    border: 1px solid rgba(148,163,184,.55);
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
      border-radius: 18px;
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
    width: 30px;
    height: 30px;
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
    border-radius: 999px;
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
  `;
  document.head.appendChild(style);

  // ---------------- DOM ----------------
  function createLauncher() {
    const launcher = document.createElement("div");
    launcher.id = "k-launcher";
    launcher.innerHTML = `<div id="k-launcher-icon">${THEME.launcherIcon}</div>`;
    launcher.addEventListener("click", toggleWidget);
    document.body.appendChild(launcher);
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
          <div id="k-pill">Live • AI</div>
          <button id="k-header-close" aria-label="Zamknij">&times;</button>
        </div>
      </div>
      <div id="k-messages"></div>
      <div id="k-quick"></div>
      <div id="k-input-area">
        <textarea id="k-input" placeholder="Napisz wiadomość..." rows="1"></textarea>
        <button id="k-send">➤</button>
      </div>
    `;
    document.body.appendChild(wrap);

    document.getElementById("k-header-close").onclick = toggleWidget;
    const input = document.getElementById("k-input");
    const sendBtn = document.getElementById("k-send");

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

    sendBtn.addEventListener("click", sendMessage);
    setupQuickActions();
    restoreHistory();
    if (!hasMessages()) {
      showWelcomeMessage();
    }
  }

  function toggleWidget() {
    const widget = document.getElementById("k-widget");
    if (!widget) {
      createWidget();
      isOpen = true;
      playSound("open");
      return;
    }
    isOpen = !isOpen;
    widget.style.display = isOpen ? "flex" : "none";
    if (isOpen) {
      playSound("open");
    }
  }

  // ---------------- MESSAGES ----------------
  function formatTime(d) {
    try {
      const dt = typeof d === "string" ? new Date(d) : d;
      return dt.toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" });
    } catch {
      return "";
    }
  }

  function appendMessage(text, from = "agent", meta = {}) {
    const messages = document.getElementById("k-messages");
    if (!messages) return;

    const row = document.createElement("div");
    row.className = "k-msg-row " + (from === "user" ? "k-msg-user" : "k-msg-agent");

    const bubble = document.createElement("div");
    bubble.className = "k-msg-bubble " + (from === "user" ? "k-msg-bubble-user" : "k-msg-bubble-agent");
    bubble.textContent = text;

    row.appendChild(bubble);

    const time = meta.time || new Date();
    const timeLabel = document.createElement("div");
    timeLabel.className = "k-msg-time";
    timeLabel.textContent = formatTime(time);

    const wrap = document.createElement("div");
    wrap.appendChild(row);
    wrap.appendChild(timeLabel);

    messages.appendChild(wrap);
    messages.scrollTop = messages.scrollHeight;
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

  function hasMessages() {
    const messages = document.getElementById("k-messages");
    if (!messages) return false;
    return messages.children.length > 0;
  }

  // ---------------- QUICK ACTIONS ----------------
  function setupQuickActions() {
    const quick = document.getElementById("k-quick");
    if (!quick) return;
    quick.innerHTML = "";

    const sets = {
      demo: [
        "Wyjaśnij, jak działa ten asystent na stronie klienta.",
        "Jak mogę dopasować styl rozmowy do mojej marki?",
        "Podaj przykładowy scenariusz użycia dla firmy usługowej."
      ],
      amico: [
        "Opisz, jak ten asystent może pomóc podczas szkoleń lub warsztatów.",
        "Jak wygląda integracja techniczna krok po kroku?",
        "Jakie dane ten asystent może wykorzystywać w firmie produkcyjnej?"
      ],
      premium: [
        "W jaki sposób ten asystent może obsługiwać klientów premium lub VIP?",
        "Jak można dopasować design widgetu do identyfikacji wizualnej marki?",
        "Co wyróżnia to rozwiązanie na tle zwykłych chatbotów?"
      ]
    }[CLIENT_ID] || [];

    sets.forEach(text => {
      const btn = document.createElement("button");
      btn.className = "k-quick-btn";
      btn.textContent = text;
      btn.onclick = () => {
        const input = document.getElementById("k-input");
        if (!input) return;
        input.value = text;
        sendMessage();
      };
      quick.appendChild(btn);
    });
  }

  // ---------------- HISTORY ----------------
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

  function restoreHistory() {
    const history = loadHistory();
    if (!history.length) return;
    history.forEach(msg => {
      appendMessage(msg.text, msg.from, { time: msg.time });
    });
  }

  function pushToHistory(text, from) {
    const history = loadHistory();
    history.push({ text, from, time: new Date().toISOString() });
    // proste ograniczenie rozmiaru
    while (history.length > 50) history.shift();
    saveHistory(history);
  }

  // ---------------- BACKEND ----------------
  async function sendMessage() {
    if (isSending) return;
    const input = document.getElementById("k-input");
    if (!input) return;
    const text = input.value.trim();
    if (!text) return;

    appendMessage(text, "user");
    pushToHistory(text, "user");
    input.value = "";
    input.style.height = "40px"; // reset
    isSending = true;
    const sendBtn = document.getElementById("k-send");
    if (sendBtn) sendBtn.disabled = true;
    showTyping();
    playSound("send");

    try {
      const payload = {
        message: text,
        sessionId: sessionId || loadSessionId() || undefined,
        clientId: CLIENT_ID
      };

      const res = await fetch(BACKEND_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      hideTyping();

      sessionId = data.sessionId || sessionId || data.session_id || null;
      if (sessionId) saveSessionId(sessionId);

      const reply = data.reply || data.message || "Odpowiedź z asystenta.";
      appendMessage(reply, "agent");
      pushToHistory(reply, "agent");
      playSound("receive");
    } catch (err) {
      hideTyping();
      appendMessage("Wystąpił błąd po stronie serwera. Spróbuj ponownie za chwilę.", "agent");
      console.error("[Kontaktio] Błąd podczas wysyłania:", err);
    } finally {
      isSending = false;
      const sendBtn2 = document.getElementById("k-send");
      if (sendBtn2) sendBtn2.disabled = false;
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

  function showWelcomeMessage() {
    const text =
      CLIENT_ID === "premium"
        ? "Dzień dobry. Jestem asystentem premium Kontaktio. Pokażę Ci, jak zbudować doświadczenie godne Twojej marki."
        : CLIENT_ID === "amico"
        ? "Cześć! Jestem branżowym asystentem Kontaktio. Zobacz, jak ten widget może pracować dla Twojej firmy."
        : "Hej! Jestem demo asystentem Kontaktio. Mogę wytłumaczyć, jak to rozwiązanie sprawdzi się na Twojej stronie.";
    appendMessage(text, "agent");
    pushToHistory(text, "agent");
  }

  // ---------------- INIT ----------------
  createLauncher();
})();
