(function () {
  // Nie duplikujemy widgetu
  if (window.KontaktioLoaded) return;
  window.KontaktioLoaded = true;

  // ============================
  // PODSTAWOWE ZMIENNE
  // ============================

  const script =
    document.currentScript ||
    document.querySelector('script[data-client][data-kontaktio]');

  if (!script) {
    console.error("[Kontaktio] Nie znaleziono <script data-kontaktio>.");
    return;
  }

  const CLIENT_ID = script.getAttribute("data-client") || "demo";
  const BACKEND_URL = script.getAttribute("data-backend") || "";
  if (!BACKEND_URL) {
    console.error("[Kontaktio] Brak atrybutu data-backend.");
    return;
  }

  const CONFIG_URL = `${BACKEND_URL}/client/${encodeURIComponent(CLIENT_ID)}`;
  const CHAT_URL = `${BACKEND_URL}/chat`;

  const STORAGE_KEY_HISTORY = `kontaktio-history-${CLIENT_ID}`;
  const STORAGE_KEY_SESSION = `kontaktio-session-${CLIENT_ID}`;
  const STORAGE_KEY_OPEN = `kontaktio-open-${CLIENT_ID}`;

  let CLIENT_CONFIG = null;
  let THEME = {};
  let sessionId = null;
  let isOpen = false;
  let isSending = false;

  // ============================
  // LOCAL STORAGE
  // ============================

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

  function saveHistory(messages) {
    try {
      localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(messages));
    } catch {}
  }

  function loadHistory() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_HISTORY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  // ============================
  // POBIERANIE KONFIGURACJI
  // ============================

  async function loadClientConfig() {
    try {
      const res = await fetch(CONFIG_URL, { cache: "no-store" });

      if (!res.ok) {
        console.warn(
          "[Kontaktio] Błąd pobierania configu:",
          res.status,
          CONFIG_URL
        );
        return null;
      }

      const cfg = await res.json();
      CLIENT_CONFIG = cfg || {};
      THEME = cfg.theme || {};

      // dla debugowania
      window.KONTAKTIO_CONFIG = CLIENT_CONFIG;
      window.KONTAKTIO_THEME = THEME;

      return CLIENT_CONFIG;
    } catch (e) {
      console.error("[Kontaktio] loadClientConfig error:", e);
      return null;
    }
  }

  // ============================
  // CSS
  // ============================

  function injectStyles(css) {
    const style = document.createElement("style");
    style.innerHTML = css;
    document.head.appendChild(style);
  }

  function generateCSS() {
    if (!CLIENT_CONFIG) return;

    const t = THEME || {};
    const cfg = CLIENT_CONFIG;

    const radius = t.radius ?? cfg.bubble_radius ?? 18;
    const launcherSize = cfg.launcher_size ?? 64;
    const offsetX = cfg.offset_x ?? 20;
    const offsetY = cfg.offset_y ?? 20;
    const position = t.position || cfg.position || "right";

    const headerHeight = cfg.header_height ?? 52;
    const inputHeight = cfg.input_height ?? 48;

    const fontFamily = cfg.font_family || "system-ui, -apple-system, sans-serif";
    const fontSize = cfg.font_size || "14px";

    const widgetBorder = cfg.widget_border || "1px solid rgba(15,23,42,0.9)";
    const widgetShadow =
      cfg.widget_shadow || "0 18px 45px rgba(0,0,0,0.35)";

    const inputBorder = cfg.input_border || "1px solid rgba(148,163,184,0.35)";

    const basePos = position === "left" ? "left" : "right";

    const css = `
      .kontaktio-widget * {
        box-sizing: border-box;
        font-family: ${fontFamily};
        font-size: ${fontSize};
      }

      #kontaktio-launcher {
        position: fixed;
        bottom: ${offsetY}px;
        ${basePos}: ${offsetX}px;
        width: ${launcherSize}px;
        height: ${launcherSize}px;
        border-radius: 999px;
        background: ${t.buttonBg || "#7c3aed"};
        color: ${t.buttonText || "#ffffff"};
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        z-index: 999999;
        box-shadow: 0 12px 30px rgba(15,23,42,0.75);
        transition: transform 0.18s ease, box-shadow 0.18s ease;
      }

      #kontaktio-launcher:hover {
        transform: translateY(-2px) scale(1.03);
        box-shadow: 0 18px 48px rgba(15,23,42,0.9);
      }

      #kontaktio-widget {
        position: fixed;
        bottom: ${offsetY + launcherSize + 16}px;
        ${basePos}: ${offsetX}px;
        width: 360px;
        max-height: 600px;
        background: ${t.widgetBg || "#020617"};
        border-radius: ${radius}px;
        border: ${widgetBorder};
        box-shadow: ${widgetShadow};
        display: none;
        flex-direction: column;
        overflow: hidden;
        z-index: 999999;
      }

      #kontaktio-header {
        background: ${t.headerBg || "#020617"};
        color: ${t.headerText || "#e5e7eb"};
        height: ${headerHeight}px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0 16px;
        font-weight: 600;
        border-bottom: 1px solid rgba(30,64,175,0.6);
      }

      #kontaktio-header-title {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }

      #kontaktio-header-title span {
        font-size: 13px;
        opacity: 0.8;
      }

      #kontaktio-close {
        cursor: pointer;
        font-size: 18px;
        opacity: 0.7;
      }

      #kontaktio-close:hover {
        opacity: 1;
      }

      #kontaktio-messages {
        flex: 1;
        overflow-y: auto;
        padding: 16px;
        background: ${t.widgetBg || "#020617"};
      }

      .kontaktio-msg {
        max-width: 80%;
        padding: 10px 14px;
        border-radius: ${radius}px;
        margin-bottom: 10px;
        line-height: 1.4;
        white-space: pre-wrap;
        word-wrap: break-word;
      }

      .kontaktio-msg-user {
        background: ${t.userBubbleBg || "#0f172a"};
        color: ${t.userBubbleText || "#e5e7eb"};
        margin-left: auto;
      }

      .kontaktio-msg-bot {
        background: ${t.botBubbleBg || "#020617"};
        color: ${t.botBubbleText || "#cbd5e1"};
        margin-right: auto;
        border: 1px solid rgba(30,64,175,0.5);
      }

      #kontaktio-quick {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        padding: 10px 16px;
        border-top: 1px solid rgba(30,64,175,0.35);
        background: ${t.widgetBg || "#020617"};
      }

      .kontaktio-quick-btn {
        padding: 5px 10px;
        background: #111827;
        color: #e5e7eb;
        border-radius: 999px;
        border: 1px solid rgba(148,163,184,0.5);
        cursor: pointer;
        font-size: 12px;
        transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease;
      }

      .kontaktio-quick-btn:hover {
        background: #1f2937;
        border-color: #6366f1;
      }

      #kontaktio-input-wrap {
        padding: 10px 12px 12px;
        border-top: 1px solid rgba(30,64,175,0.35);
        background: ${t.inputBg || "#020617"};
      }

      #kontaktio-input-row {
        position: relative;
      }

      #kontaktio-input {
        width: 100%;
        height: ${inputHeight}px;
        padding: 10px 44px 10px 12px;
        border-radius: ${radius}px;
        border: ${inputBorder};
        background: ${t.inputBg || "#020617"};
        color: ${t.inputText || "#e5e7eb"};
        outline: none;
      }

      #kontaktio-input::placeholder {
        color: #64748b;
      }

      #kontaktio-send {
        position: absolute;
        right: 12px;
        top: 50%;
        transform: translateY(-50%);
        cursor: pointer;
        font-size: 16px;
        color: ${t.buttonBg || "#7c3aed"};
        opacity: 0.85;
      }

      #kontaktio-send:hover {
        opacity: 1;
      }

      #kontaktio-status {
        font-size: 11px;
        color: #94a3b8;
        margin-top: 4px;
        text-align: right;
      }

      #kontaktio-typing {
        opacity: 0.8;
        font-style: italic;
      }
    `;

    injectStyles(css);
  }

  // ============================
  // UI
  // ============================

  function createLauncher() {
    const launcher = document.createElement("div");
    launcher.id = "kontaktio-launcher";
    launcher.innerHTML = CLIENT_CONFIG.launcher_icon || "💬";

    launcher.addEventListener("click", toggleWidget);

    document.body.appendChild(launcher);
  }

  function createWidget() {
    const widget = document.createElement("div");
    widget.id = "kontaktio-widget";
    widget.className = "kontaktio-widget";

    const name = CLIENT_CONFIG.company?.name || "Asystent";
    const subtitle = CLIENT_CONFIG.company?.hours || "";

    widget.innerHTML = `
      <div id="kontaktio-header">
        <div id="kontaktio-header-title">
          <strong>${name}</strong>
          ${
            subtitle
              ? `<span>${subtitle}</span>`
              : "<span>Online</span>"
          }
        </div>
        <div id="kontaktio-close">&times;</div>
      </div>

      <div id="kontaktio-messages"></div>

      <div id="kontaktio-quick"></div>

      <div id="kontaktio-input-wrap">
        <div id="kontaktio-input-row">
          <input id="kontaktio-input" placeholder="${
            CLIENT_CONFIG.welcome_hint || "Napisz wiadomość..."
          }" />
          <div id="kontaktio-send">➤</div>
        </div>
        <div id="kontaktio-status"></div>
      </div>
    `;

    document.body.appendChild(widget);

    const closeBtn = document.getElementById("kontaktio-close");
    if (closeBtn) {
      closeBtn.addEventListener("click", () => {
        if (isOpen) toggleWidget();
      });
    }

    const sendBtn = document.getElementById("kontaktio-send");
    const input = document.getElementById("kontaktio-input");
    if (sendBtn && input) {
      sendBtn.addEventListener("click", () => {
        sendUserMessage(input.value);
      });

      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          sendUserMessage(input.value);
        }
      });
    }
  }

  // ============================
  // OTWIERANIE / ZAMYKANIE
  // ============================

  function toggleWidget() {
    isOpen = !isOpen;
    saveOpenState(isOpen);

    const widget = document.getElementById("kontaktio-widget");
    if (!widget) return;

    widget.style.display = isOpen ? "flex" : "none";

    if (isOpen) {
      scrollMessagesToBottom();
      focusInput();
    }
  }

  function focusInput() {
    const input = document.getElementById("kontaktio-input");
    if (input) input.focus();
  }

  // ============================
  // WIADOMOŚCI
  // ============================

  function addMessage(role, text) {
    const wrap = document.getElementById("kontaktio-messages");
    if (!wrap) return;

    const div = document.createElement("div");
    div.className = `kontaktio-msg kontaktio-msg-${role}`;
    div.textContent = text;

    wrap.appendChild(div);
    scrollMessagesToBottom();

    const history = loadHistory();
    history.push({ role, text });
    saveHistory(history);
  }

  function scrollMessagesToBottom() {
    const wrap = document.getElementById("kontaktio-messages");
    if (wrap) wrap.scrollTop = wrap.scrollHeight;
  }

  function setStatus(text) {
    const el = document.getElementById("kontaktio-status");
    if (el) el.textContent = text || "";
  }

  // ============================
  // QUICK REPLIES
  // ============================

  function renderQuickReplies() {
    const quickWrap = document.getElementById("kontaktio-quick");
    if (!quickWrap) return;

    quickWrap.innerHTML = "";

    const list = CLIENT_CONFIG.quick_replies || [];
    if (!Array.isArray(list) || list.length === 0) return;

    list.forEach((q) => {
      const btn = document.createElement("div");
      btn.className = "kontaktio-quick-btn";
      btn.textContent = q;

      btn.addEventListener("click", () => {
        sendUserMessage(q);
      });

      quickWrap.appendChild(btn);
    });
  }

  // ============================
  // WELCOME MESSAGE
  // ============================

  function showWelcomeMessages() {
    const welcome = CLIENT_CONFIG.welcome_message;
    const hint = CLIENT_CONFIG.welcome_hint;

    const history = loadHistory();
    if (history.length > 0) return;

    if (welcome) addMessage("bot", welcome);
    if (hint) addMessage("bot", hint);
  }

  // ============================
  // RESTORE HISTORY
  // ============================

  function restoreHistory() {
    const history = loadHistory();
    if (!history || history.length === 0) return;

    history.forEach((m) => addMessage(m.role, m.text));
  }

  // ============================
  // AUTO-OPEN
  // ============================

  function autoOpenIfEnabled() {
    if (!CLIENT_CONFIG.auto_open_enabled) return;
    if (loadOpenState()) return;

    const delay = CLIENT_CONFIG.auto_open_delay || 15000;

    setTimeout(() => {
      const widget = document.getElementById("kontaktio-widget");
      if (!widget) return;

      isOpen = true;
      widget.style.display = "flex";
      saveOpenState(true);
      scrollMessagesToBottom();
      focusInput();
    }, delay);
  }

  // ============================
  // TYPING INDICATOR
  // ============================

  function showTyping() {
    const wrap = document.getElementById("kontaktio-messages");
    if (!wrap) return;

    if (document.getElementById("kontaktio-typing")) return;

    const div = document.createElement("div");
    div.id = "kontaktio-typing";
    div.className = "kontaktio-msg kontaktio-msg-bot";
    div.textContent = "Asystent pisze…";

    wrap.appendChild(div);
    scrollMessagesToBottom();
  }

  function hideTyping() {
    const el = document.getElementById("kontaktio-typing");
    if (el) el.remove();
  }

  // ============================
  // WYSYŁANIE WIADOMOŚCI
  // ============================

  async function sendUserMessage(text) {
    if (!text || !text.trim()) return;
    if (isSending) return;

    const cleaned = text.trim();
    const input = document.getElementById("kontaktio-input");
    if (input) input.value = "";

    addMessage("user", cleaned);
    isSending = true;
    showTyping();
    setStatus("Wysyłanie...");

    try {
      const payload = {
        message: cleaned,
        sessionId: sessionId || loadSessionId(),
        clientId: CLIENT_ID
      };

      const res = await fetch(CHAT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      hideTyping();

      if (!res.ok) {
        console.warn("[Kontaktio] Błąd odpowiedzi /chat:", res.status);
        addMessage(
          "bot",
          CLIENT_CONFIG.fallback_message ||
            "Przepraszam, wystąpił błąd. Spróbuj ponownie później."
        );
        setStatus("Błąd serwera");
        isSending = false;
        return;
      }

      const data = await res.json();

      if (data.sessionId) {
        sessionId = data.sessionId;
        saveSessionId(sessionId);
      }

      if (data.reply) {
        addMessage("bot", data.reply);
        setStatus("Online");
      } else {
        addMessage(
          "bot",
          CLIENT_CONFIG.fallback_message ||
            "Przepraszam, nie udało mi się wygenerować odpowiedzi."
        );
        setStatus("Brak odpowiedzi");
      }
    } catch (e) {
      console.error("[Kontaktio] sendUserMessage error:", e);
      hideTyping();
      addMessage(
        "bot",
        CLIENT_CONFIG.error_message ||
          "Wystąpił błąd połączenia z serwerem."
      );
      setStatus("Błąd połączenia");
    }

    isSending = false;
  }

  // ============================
  // STATUS KLIENTA
  // ============================

  function handleClientStatus() {
    const status = CLIENT_CONFIG.status || "active";
    if (status === "active") return;

    const msg =
      CLIENT_CONFIG.statusMessage ||
      "Asystent jest obecnie niedostępny. Spróbuj później.";

    // pokazujemy komunikat i blokujemy input
    addMessage("bot", msg);

    const input = document.getElementById("kontaktio-input");
    const send = document.getElementById("kontaktio-send");
    if (input) {
      input.disabled = true;
      input.placeholder = "Asystent jest wyłączony";
    }
    if (send) {
      send.style.pointerEvents = "none";
      send.style.opacity = "0.4";
    }
    setStatus("Wyłączony");
  }

  // ============================
  // INICJALIZACJA UI PO CONFIGU
  // ============================

  function initUI() {
    generateCSS();
    createLauncher();
    createWidget();
    renderQuickReplies();

    // historia
    restoreHistory();
    showWelcomeMessages();

    // stan otwarcia
    if (loadOpenState()) {
      isOpen = true;
      const widget = document.getElementById("kontaktio-widget");
      if (widget) widget.style.display = "flex";
      scrollMessagesToBottom();
    }

    // status klienta
    handleClientStatus();

    // auto-open (jeśli klient aktywny)
    if ((CLIENT_CONFIG.status || "active") === "active") {
      autoOpenIfEnabled();
    }
  }

  // ============================
  // START
  // ============================

  async function initKontaktio() {
    const cfg = await loadClientConfig();

    if (!cfg) {
      console.error(
        "[Kontaktio] Brak konfiguracji klienta — widget nie wystartuje."
      );
      return;
    }

    initUI();
  }

  window.KontaktioSend = sendUserMessage; // ewentualne ręczne wywołanie z zewnątrz

  initKontaktio();
})();
