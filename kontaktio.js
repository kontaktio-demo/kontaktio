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

  const THEME = {
    demo: {
      accent: "#22d3ee",
      accentSoft: "rgba(34,211,238,0.18)",
      name: "Asystent demo",
      subtitle: "Wyjaśnia, pokazuje, edukuje"
    },
    amico: {
      accent: "#f97316",
      accentSoft: "rgba(249,115,22,0.18)",
      name: "Asystent branżowy",
      subtitle: "Konkretnie, warsztatowo, bez lania wody"
    },
    premium: {
      accent: "#a855f7",
      accentSoft: "rgba(168,85,247,0.2)",
      name: "Asystent premium",
      subtitle: "Elegancki, spokojny, ekskluzywny ton"
    }
  }[CLIENT_ID] || {
    accent: "#22d3ee",
    accentSoft: "rgba(34,211,238,0.18)",
    name: "Asystent AI",
    subtitle: "Odpowiada na pytania w czasie rzeczywistym"
  };

  /* ---------- STYLE ---------- */
  const style = document.createElement("style");
  style.textContent = `
  #k-launcher {
    position: fixed;
    right: 20px;
    bottom: 20px;
    width: 54px;
    height: 54px;
    border-radius: 999px;
    border: 1px solid rgba(148,163,184,.6);
    background: radial-gradient(circle at 30% 0, ${THEME.accentSoft}, rgba(15,23,42,0.98));
    box-shadow: 0 18px 45px rgba(15,23,42,.95);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    z-index: 9999;
    color: #e5e7eb;
    transition: transform .15s ease, box-shadow .15s ease, background .2s ease;
    backdrop-filter: blur(12px);
  }
  #k-launcher:hover {
    transform: translateY(-1px) scale(1.02);
    box-shadow: 0 22px 55px rgba(15,23,42,1);
    background: radial-gradient(circle at 20% 0, ${THEME.accentSoft}, rgba(15,23,42,0.95));
  }
  #k-launcher-icon {
    font-size: 22px;
  }

  #k-widget {
    position: fixed;
    right: 20px;
    bottom: 86px;
    width: min(380px, calc(100vw - 24px));
    height: min(520px, calc(100vh - 120px));
    background: radial-gradient(circle at top, rgba(15,23,42,0.98), rgba(15,23,42,1));
    border-radius: 22px;
    box-shadow: 0 24px 80px rgba(15,23,42,0.98);
    border: 1px solid rgba(148,163,184,.55);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    z-index: 9999;
    color: #e5e7eb;
    backdrop-filter: blur(20px);
  }
  @media (max-width: 640px) {
    #k-widget {
      right: 10px;
      left: 10px;
      width: auto;
      bottom: 80px;
      height: min(520px, calc(100vh - 110px));
    }
    #k-launcher {
      right: 16px;
      bottom: 16px;
    }
  }
  #k-header {
    padding: 12px 14px 10px;
    display: flex;
    align-items: center;
    gap: 10px;
    border-bottom: 1px solid rgba(15,23,42,1);
    background: linear-gradient(135deg, rgba(15,23,42,0.96), rgba(15,23,42,0.98));
    position: relative;
  }
  #k-header::after {
    content:"";
    position:absolute;
    inset:-40%;
    background: radial-gradient(circle at 0 0, ${THEME.accentSoft}, transparent 55%);
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
    background: radial-gradient(circle at 30% 0, #ffffff, ${THEME.accent});
    display: flex;
    align-items: center;
    justify-content: center;
    color: #020617;
    font-weight: 700;
    font-size: 15px;
    box-shadow: 0 0 0 2px rgba(15,23,42,1), 0 10px 25px rgba(15,23,42,0.9);
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
    opacity: 0.8;
  }
  #k-header-close {
    position: relative;
    z-index: 1;
    border: none;
    background: transparent;
    color: #9ca3af;
    cursor: pointer;
    padding: 4px;
    border-radius: 999px;
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
  }
  .k-msg-bubble-user {
    background: linear-gradient(135deg, ${THEME.accent}, #2563eb);
    color: #0b1120;
    border-bottom-right-radius: 3px;
  }
  .k-msg-bubble-agent {
    background: rgba(15,23,42,0.96);
    border: 1px solid rgba(51,65,85,0.9);
    border-bottom-left-radius: 3px;
  }

  #k-quick {
    padding: 6px 10px 4px;
    border-top: 1px solid rgba(15,23,42,1);
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .k-quick-btn {
    border-radius: 999px;
    border: 1px solid rgba(148,163,184,0.6);
    padding: 4px 8px;
    font-size: 11px;
    background: rgba(15,23,42,0.95);
    color: #cbd5e1;
    cursor: pointer;
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
    background: linear-gradient(135deg, ${THEME.accent}, #2563eb);
    color: #020617;
    cursor: pointer;
    display:flex;
    align-items:center;
    justify-content:center;
    font-size: 16px;
    box-shadow: 0 10px 25px rgba(15,23,42,0.9);
  }
  #k-send[disabled] {
    opacity: 0.5;
    cursor: default;
    box-shadow: none;
  }

  .k-typing {
    font-size: 11px;
    opacity: 0.75;
    padding: 0 4px 4px;
  }
  `;
  document.head.appendChild(style);

  /* ---------- DOM ---------- */
  function createLauncher() {
    const launcher = document.createElement("div");
    launcher.id = "k-launcher";
    launcher.innerHTML = `<div id="k-launcher-icon">✦</div>`;
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
          <div id="k-avatar">${CLIENT_ID === "premium" ? "KP" : CLIENT_ID === "amico" ? "BA" : "AI"}</div>
          <div id="k-header-text">
            <strong>${THEME.name}</strong>
            <span>${THEME.subtitle}</span>
          </div>
        </div>
        <button id="k-header-close" aria-label="Zamknij">&times;</button>
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

    sendBtn.addEventListener("click", sendMessage);
    setupQuickActions();
    showWelcomeMessage();
  }

  function toggleWidget() {
    const widget = document.getElementById("k-widget");
    if (!widget) {
      createWidget();
      isOpen = true;
      return;
    }
    isOpen = !isOpen;
    widget.style.display = isOpen ? "flex" : "none";
  }

  /* ---------- MESSAGES ---------- */
  function appendMessage(text, from = "agent") {
    const messages = document.getElementById("k-messages");
    if (!messages) return;

    const row = document.createElement("div");
    row.className = "k-msg-row " + (from === "user" ? "k-msg-user" : "k-msg-agent");

    const bubble = document.createElement("div");
    bubble.className = "k-msg-bubble " + (from === "user" ? "k-msg-bubble-user" : "k-msg-bubble-agent");
    bubble.textContent = text;

    row.appendChild(bubble);
    messages.appendChild(row);
    messages.scrollTop = messages.scrollHeight;
  }

  let typingEl = null;
  function showTyping() {
    if (typingEl) return;
    const messages = document.getElementById("k-messages");
    if (!messages) return;
    typingEl = document.createElement("div");
    typingEl.className = "k-typing";
    typingEl.textContent = "Asystent pisze…";
    messages.appendChild(typingEl);
    messages.scrollTop = messages.scrollHeight;
  }
  function hideTyping() {
    if (typingEl && typingEl.parentNode) typingEl.parentNode.removeChild(typingEl);
    typingEl = null;
  }

  /* ---------- QUICK ACTIONS ---------- */
  function setupQuickActions() {
    const quick = document.getElementById("k-quick");
    if (!quick) return;
    quick.innerHTML = "";

    const sets = {
      demo: [
        "Wyjaśnij, jak działa ten asystent na stronie klienta.",
        "Jak mogę dostosować styl rozmowy do mojej marki?",
        "Czy możesz podać przykładowy use case dla firmy usługowej?"
      ],
      amico: [
        "Opisz, jak ten asystent może pomóc na warsztatach / szkoleniach.",
        "Jak wygląda integracja techniczna krok po kroku?",
        "Jakie dane ten asystent może wykorzystywać w firmie produkcyjnej?"
      ],
      premium: [
        "Opowiedz, jak asystent wspiera obsługę VIP i klientów premium.",
        "Jak można dopasować design widgetu do identyfikacji wizualnej brandu?",
        "Co wyróżnia to rozwiązanie na tle standardowych chatbotów?"
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

  /* ---------- BACKEND ---------- */
  async function sendMessage() {
    if (isSending) return;
    const input = document.getElementById("k-input");
    if (!input) return;
    const text = input.value.trim();
    if (!text) return;

    appendMessage(text, "user");
    input.value = "";
    isSending = true;
    document.getElementById("k-send").disabled = true;
    showTyping();

    try {
      const payload = {
        message: text,
        sessionId,
        clientId: CLIENT_ID
      };

      const res = await fetch(BACKEND_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      hideTyping();
      sessionId = data.sessionId || sessionId;

      const reply = data.reply || data.message || "Odpowiedź z asystenta.";
      appendMessage(reply, "agent");
    } catch (err) {
      hideTyping();
      appendMessage("Wystąpił błąd po stronie serwera. Spróbuj ponownie za chwilę.", "agent");
      console.error("[Kontaktio] Błąd podczas wysyłania:", err);
    } finally {
      isSending = false;
      const sendBtn = document.getElementById("k-send");
      if (sendBtn) sendBtn.disabled = false;
    }
  }

  function showWelcomeMessage() {
    appendMessage(
      CLIENT_ID === "premium"
        ? "Dzień dobry. Jestem asystentem premium Kontaktio. Chcesz, żebyśmy wspólnie dopracowali doświadczenie Twoich klientów?"
        : CLIENT_ID === "amico"
        ? "Cześć! Jestem branżowym asystentem Kontaktio. Pokażę Ci, jak ten widget może pracować dla Twojej firmy."
        : "Hej! Jestem demo asystentem Kontaktio. Mogę Ci wytłumaczyć, jak to rozwiązanie sprawdzi się na Twojej stronie.",
      "agent"
    );
  }

  /* ---------- INIT ---------- */
  createLauncher();
})();
