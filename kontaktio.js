(function () {
  if (window.KontaktioLoaded) return;
  window.KontaktioLoaded = true;

  // ============================
  // PODSTAWOWE ZMIENNE
  // ============================

  const script =
    document.currentScript ||
    document.querySelector('script[data-client][data-kontaktio]');

  const CLIENT_ID = script?.getAttribute("data-client") || "demo";
  const BACKEND_URL = script?.getAttribute("data-backend") || "";
  const CONFIG_URL = `${BACKEND_URL}/config/${CLIENT_ID}`;

  const STORAGE_KEY_HISTORY = `kontaktio-history-${CLIENT_ID}`;
  const STORAGE_KEY_SESSION = `kontaktio-session-${CLIENT_ID}`;
  const STORAGE_KEY_OPEN = `kontaktio-open-${CLIENT_ID}`;

  let CLIENT_CONFIG = null;
  let THEME = null;
  let sessionId = null;
  let isOpen = false;
  let isSending = false;

  // ============================
  // FUNKCJE LOCAL STORAGE
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
        console.warn("[Kontaktio] Błąd pobierania configu:", res.status);
        return null;
      }

      const cfg = await res.json();
      CLIENT_CONFIG = cfg;
      THEME = cfg.theme || {};

      return cfg;
    } catch (e) {
      console.error("[Kontaktio] loadClientConfig error:", e);
      return null;
    }
  }

  // ============================
  // START WIDGETU
  // ============================

  async function initKontaktio() {
    const cfg = await loadClientConfig();

    if (!cfg) {
      console.error("[Kontaktio] Brak konfiguracji klienta — widget nie wystartuje.");
      return;
    }

    // część 2 wygeneruje CSS
    // część 3 stworzy launcher i widget
    // część 4 obsłuży wiadomości
    // część 5 odpali auto-open i restore history

    window.KONTAKTIO_CONFIG = cfg; // debug
    window.KONTAKTIO_THEME = THEME;

    // przechodzimy do kolejnych części
    initAfterConfig();
  }

  // placeholder — zostanie nadpisany w części 5
  function initAfterConfig() {}

  // start
  initKontaktio();
  // ============================
  // GENEROWANIE CSS Z THEME
  // ============================

  function injectStyles(css) {
    const style = document.createElement("style");
    style.innerHTML = css;
    document.head.appendChild(style);
  }

  function generateCSS() {
    const t = THEME || {};
    const cfg = CLIENT_CONFIG;

    const radius = t.radius || cfg.bubble_radius || 18;
    const launcherSize = cfg.launcher_size || 56;
    const offsetX = cfg.offset_x ?? 20;
    const offsetY = cfg.offset_y ?? 20;

    const headerHeight = cfg.header_height || 52;
    const inputHeight = cfg.input_height || 48;

    const fontFamily = cfg.font_family || "Inter, sans-serif";
    const fontSize = cfg.font_size || "15px";

    const quickBg = cfg.quick_reply_bg || "#f3f4f6";
    const quickText = cfg.quick_reply_text || "#111827";
    const quickBorder = cfg.quick_reply_border || "transparent";

    const widgetBorder = cfg.widget_border || "1px solid rgba(255,255,255,0.08)";
    const widgetShadow =
      cfg.widget_shadow || "0 8px 28px rgba(0,0,0,0.25)";

    const inputBorder = cfg.input_border || "1px solid rgba(255,255,255,0.1)";

    const css = `
      /* ============================
         GLOBAL
      ============================ */
      .kontaktio-widget * {
        box-sizing: border-box;
        font-family: ${fontFamily};
        font-size: ${fontSize};
      }

      /* ============================
         LAUNCHER
      ============================ */
      #kontaktio-launcher {
        position: fixed;
        bottom: ${offsetY}px;
        right: ${offsetX}px;
        width: ${launcherSize}px;
        height: ${launcherSize}px;
        border-radius: 50%;
        background: ${t.buttonBg || "#7c3aed"};
        color: ${t.buttonText || "#ffffff"};
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        z-index: 999999;
        box-shadow: 0 4px 16px rgba(0,0,0,0.25);
        transition: transform 0.2s ease;
      }

      #kontaktio-launcher:hover {
        transform: scale(1.05);
      }

      /* ============================
         WIDGET
      ============================ */
      #kontaktio-widget {
        position: fixed;
        bottom: ${offsetY + launcherSize + 16}px;
        right: ${offsetX}px;
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

      /* ============================
         HEADER
      ============================ */
      #kontaktio-header {
        background: ${t.headerBg || "#0f172a"};
        color: ${t.headerText || "#ffffff"};
        height: ${headerHeight}px;
        display: flex;
        align-items: center;
        padding: 0 16px;
        font-weight: 600;
        border-bottom: 1px solid rgba(255,255,255,0.08);
      }

      /* ============================
         MESSAGES
      ============================ */
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
      }

      .kontaktio-msg-user {
        background: ${t.userBubbleBg || "#2563eb"};
        color: ${t.userBubbleText || "#ffffff"};
        margin-left: auto;
      }

      .kontaktio-msg-bot {
        background: ${t.botBubbleBg || "#1e293b"};
        color: ${t.botBubbleText || "#e2e8f0"};
        margin-right: auto;
      }

      /* ============================
         QUICK REPLIES
      ============================ */
      #kontaktio-quick {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        padding: 12px 16px;
        border-top: 1px solid rgba(255,255,255,0.08);
      }

      .kontaktio-quick-btn {
        padding: 6px 12px;
        background: ${quickBg};
        color: ${quickText};
        border: 1px solid ${quickBorder};
        border-radius: ${radius}px;
        cursor: pointer;
        font-size: 14px;
        transition: background 0.2s ease;
      }

      .kontaktio-quick-btn:hover {
        background: rgba(255,255,255,0.15);
      }

      /* ============================
         INPUT
      ============================ */
      #kontaktio-input-wrap {
        padding: 12px;
        border-top: 1px solid rgba(255,255,255,0.08);
        background: ${t.inputBg || "#0f172a"};
      }

      #kontaktio-input {
        width: 100%;
        height: ${inputHeight}px;
        padding: 10px 14px;
        border-radius: ${radius}px;
        border: ${inputBorder};
        background: ${t.inputBg || "#0f172a"};
        color: ${t.inputText || "#e5e7eb"};
        outline: none;
      }

      #kontaktio-send {
        position: absolute;
        right: 24px;
        bottom: 24px;
        cursor: pointer;
        color: ${t.buttonBg || "#7c3aed"};
      }

      /* ============================
         DARK MODE
      ============================ */
      body.kontaktio-dark #kontaktio-widget {
        background: ${cfg.dark_mode_theme?.widgetBg || "#0b0f19"};
      }
    `;

    injectStyles(css);
  }
  // ============================
  // TWORZENIE ELEMENTÓW UI
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

    widget.innerHTML = `
      <div id="kontaktio-header">
        ${CLIENT_CONFIG.company?.name || "Asystent"}
      </div>

      <div id="kontaktio-messages"></div>

      <div id="kontaktio-quick"></div>

      <div id="kontaktio-input-wrap">
        <input id="kontaktio-input" placeholder="Napisz wiadomość..." />
      </div>
    `;

    document.body.appendChild(widget);
  }

  // ============================
  // OBSŁUGA OTWIERANIA / ZAMYKANIA
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

    // zapis historii
    const history = loadHistory();
    history.push({ role, text });
    saveHistory(history);
  }

  function scrollMessagesToBottom() {
    const wrap = document.getElementById("kontaktio-messages");
    if (wrap) wrap.scrollTop = wrap.scrollHeight;
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
    if (history.length > 0) return; // nie pokazuj jeśli jest historia

    if (welcome) addMessage("bot", welcome);
    if (hint) addMessage("bot", hint);
  }

  // ============================
  // INICJALIZACJA UI
  // ============================

  function initUI() {
    createLauncher();
    createWidget();
    renderQuickReplies();
    showWelcomeMessages();

    // przywrócenie historii
    const history = loadHistory();
    history.forEach((m) => addMessage(m.role, m.text));

    // przywrócenie stanu otwarcia
    if (loadOpenState()) {
      toggleWidget();
    }

    // event: enter wysyła wiadomość
    const input = document.getElementById("kontaktio-input");
    if (input) {
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          sendUserMessage(input.value);
        }
      });
    }
  }

  // ============================
  // PRZEJŚCIE DO KOLEJNYCH CZĘŚCI
  // ============================

  // nadpisujemy placeholder z części 1
  initAfterConfig = function () {
    generateCSS();
    initUI();
  };
  // ============================
  // WYSYŁANIE WIADOMOŚCI
  // ============================

  async function sendUserMessage(text) {
    if (!text || !text.trim()) return;
    if (isSending) return;

    const input = document.getElementById("kontaktio-input");
    if (input) input.value = "";

    addMessage("user", text);
    isSending = true;

    try {
      const payload = {
        message: text,
        sessionId: sessionId || loadSessionId(),
        clientId: CLIENT_ID
      };

      const res = await fetch(`${BACKEND_URL}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        addMessage(
          "bot",
          CLIENT_CONFIG.fallback_message ||
            "Przepraszam, wystąpił błąd. Spróbuj ponownie później."
        );
        isSending = false;
        return;
      }

      const data = await res.json();

      // zapis sessionId
      if (data.sessionId) {
        sessionId = data.sessionId;
        saveSessionId(sessionId);
      }

      // odpowiedź bota
      if (data.reply) {
        addMessage("bot", data.reply);
      } else {
        addMessage(
          "bot",
          CLIENT_CONFIG.fallback_message ||
            "Przepraszam, nie udało mi się wygenerować odpowiedzi."
        );
      }
    } catch (e) {
      console.error("[Kontaktio] sendUserMessage error:", e);
      addMessage(
        "bot",
        CLIENT_CONFIG.error_message ||
          "Wystąpił błąd połączenia z serwerem."
      );
    }

    isSending = false;
  }

  // ============================
  // TYPING INDICATOR (opcjonalnie)
  // ============================

  function showTyping() {
    const wrap = document.getElementById("kontaktio-messages");
    if (!wrap) return;

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
  // PODPIĘCIE DO UI
  // ============================

  window.sendUserMessage = sendUserMessage;
  // ============================
  // AUTO-OPEN
  // ============================

  function autoOpenIfEnabled() {
    if (!CLIENT_CONFIG.auto_open_enabled) return;

    // jeśli użytkownik już otworzył/zamknął widget — nie otwieramy
    if (loadOpenState()) return;

    setTimeout(() => {
      const widget = document.getElementById("kontaktio-widget");
      if (!widget) return;

      isOpen = true;
      widget.style.display = "flex";
      saveOpenState(true);
      scrollMessagesToBottom();
    }, CLIENT_CONFIG.auto_open_delay || 15000);
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
  // START PO ZAŁADOWANIU CONFIGU
  // ============================

  initAfterConfig = function () {
    generateCSS();
    initUI();
    autoOpenIfEnabled();
  };

})();
