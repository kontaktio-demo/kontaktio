(function () {
  // ============================================================
  // Kontaktio Widget – Production build
  // - multi-instance safe
  // - SPA safe
  // - custom CSS support
  // - backward compatible with existing backend & panel
  // ============================================================

  const scripts = Array.from(document.querySelectorAll("script[data-kontaktio]"));
  if (!scripts.length) return;

  // ============================================================
  // Helpers
  // ============================================================

  const safeJsonParse = (s, fallback) => {
    try {
      return JSON.parse(s);
    } catch {
      return fallback;
    }
  };

  const el = (tag, attrs = {}, children = []) => {
    const node = document.createElement(tag);
    Object.entries(attrs).forEach(([k, v]) => {
      if (k === "class") node.className = v;
      else if (k === "style") node.setAttribute("style", v);
      else if (k.startsWith("on") && typeof v === "function")
        node.addEventListener(k.slice(2), v);
      else if (v !== null && v !== undefined) node.setAttribute(k, String(v));
    });
    children.forEach((c) =>
      node.appendChild(typeof c === "string" ? document.createTextNode(c) : c)
    );
    return node;
  };

  // ============================================================
  // Global styles (inserted once)
  // ============================================================

  const ensureStyles = () => {
    if (document.getElementById("kontaktio-styles")) return;

    const style = document.createElement("style");
    style.id = "kontaktio-styles";
    style.innerHTML = `
      .kontaktio-root {
        all: initial;
        font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }

      .kontaktio-launcher {
        position: fixed;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        user-select: none;
        z-index: 2147483000;
        box-shadow: 0 10px 30px rgba(0,0,0,.25);
        transform: translateZ(0);
      }

      .kontaktio-widget {
        position: fixed;
        display: none;
        flex-direction: column;
        overflow: hidden;
        z-index: 2147483000;
        width: 360px;
        max-width: calc(100vw - 24px);
        max-height: min(640px, calc(100vh - 120px));
        box-shadow: 0 12px 40px rgba(0,0,0,.28);
        transform: translateZ(0);
      }

      .kontaktio-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 12px 14px;
        font-weight: 700;
        font-size: 14px;
        letter-spacing: .2px;
      }

      .kontaktio-header-sub {
        margin-top: 2px;
        font-weight: 500;
        font-size: 12px;
        opacity: .85;
      }

      .kontaktio-close {
        border: none;
        background: transparent;
        font-size: 18px;
        cursor: pointer;
        padding: 6px 8px;
        line-height: 1;
        opacity: .9;
      }
      .kontaktio-close:hover { opacity: 1; }

      .kontaktio-messages {
        flex: 1;
        overflow-y: auto;
        padding: 14px;
      }

      .kontaktio-row {
        display: flex;
        margin: 10px 0;
      }
      .kontaktio-row.user { justify-content: flex-end; }
      .kontaktio-row.bot { justify-content: flex-start; }

      .kontaktio-bubble {
        max-width: 82%;
        padding: 10px 12px;
        white-space: pre-wrap;
        line-height: 1.35;
        font-size: 14px;
        box-shadow: 0 4px 18px rgba(0,0,0,.08);
      }

      .kontaktio-quick {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        padding: 0 14px 12px 14px;
      }

      .kontaktio-quick button {
        cursor: pointer;
        border: 1px solid rgba(0,0,0,.12);
        background: #fff;
        padding: 8px 10px;
        font-size: 12px;
        border-radius: 999px;
        line-height: 1.1;
      }

      .kontaktio-inputwrap {
        display: flex;
        gap: 8px;
        padding: 12px 14px 14px 14px;
        border-top: 1px solid rgba(0,0,0,.08);
      }

      .kontaktio-input {
        flex: 1;
        border: 1px solid rgba(0,0,0,.16);
        border-radius: 999px;
        padding: 10px 12px;
        font-size: 14px;
        outline: none;
      }

      .kontaktio-send {
        border: none;
        border-radius: 999px;
        padding: 10px 12px;
        cursor: pointer;
        font-weight: 700;
      }

      .kontaktio-muted {
        opacity: .75;
        font-size: 12px;
        padding: 10px 14px 0 14px;
      }

      @media (max-width: 480px) {
        .kontaktio-widget { width: calc(100vw - 24px); }
      }
    `;
    document.head.appendChild(style);
  };

  ensureStyles();

  // ============================================================
  // Init per script (NO global boot flag)
  // ============================================================

  scripts.forEach((script, idx) => {
    if (script.__kontaktioMounted) return;
    script.__kontaktioMounted = true;

    const CLIENT_ID = script.getAttribute("data-client") || "demo";
    const BACKEND = script.getAttribute("data-backend") || "";
    const CUSTOM_CSS = script.getAttribute("data-css");
    const baseUrl = BACKEND.replace(/\/+$/, "");

    if (!baseUrl) {
      console.error("[Kontaktio] Missing data-backend on script tag");
      return;
    }

    // Optional custom CSS (official hook)
    if (CUSTOM_CSS) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = CUSTOM_CSS;
      document.head.appendChild(link);
    }

    // ============================================================
    // Storage keys
    // ============================================================

    const keys = {
      history: `kontaktio-history-${CLIENT_ID}`,
      session: `kontaktio-session-${CLIENT_ID}`,
      open: `kontaktio-open-${CLIENT_ID}`,
      autoOpened: `kontaktio-autoopened-${CLIENT_ID}`
    };

    let cfg = null;
    let isOpen = false;
    let isSending = false;

    const loadSessionId = () => {
      try { return localStorage.getItem(keys.session); } catch { return null; }
    };
    const saveSessionId = (sid) => {
      try { localStorage.setItem(keys.session, sid); } catch {}
    };

    const loadOpenState = () => {
      try { return localStorage.getItem(keys.open) === "1"; } catch { return false; }
    };
    const saveOpenState = (open) => {
      try { localStorage.setItem(keys.open, open ? "1" : "0"); } catch {}
    };

    const loadHistory = () => {
      try { return safeJsonParse(localStorage.getItem(keys.history) || "[]", []); } catch { return []; }
    };
    const saveHistory = (arr) => {
      try { localStorage.setItem(keys.history, JSON.stringify(arr || [])); } catch {}
    };

    const markAutoOpened = () => {
      try { localStorage.setItem(keys.autoOpened, "1"); } catch {}
    };
    const wasAutoOpened = () => {
      try { return localStorage.getItem(keys.autoOpened) === "1"; } catch { return false; }
    };

    // ============================================================
    // Fetch config
    // ============================================================

    const fetchConfig = async () => {
      const res = await fetch(`${baseUrl}/config/${encodeURIComponent(CLIENT_ID)}`);
      if (!res.ok) throw new Error("Config load failed");
      return res.json();
    };

    // ============================================================
    // Mount widget
    // ============================================================

    const mount = async () => {
      const root = el("div", { class: "kontaktio-root" });
      document.body.appendChild(root);

      try {
        cfg = await fetchConfig();
      } catch {
        cfg = {
          status: "unactive",
          statusMessage: "Asystent jest obecnie niedostępny.",
          company: { name: "Asystent" },
          theme: {}
        };
      }

      const theme = cfg.theme || {};
      const pos = theme.position === "left" ? "left" : "right";
      const offsetX = cfg.offset_x ?? 20;
      const offsetY = cfg.offset_y ?? 20;

      // Launcher
      const launcher = el("div", { class: "kontaktio-launcher" }, [
        el("div", {}, [cfg.launcher_icon || "💬"])
      ]);
      launcher.style.width = "56px";
      launcher.style.height = "56px";
      launcher.style.borderRadius = "999px";
      launcher.style.background = theme.buttonBg || "#2563eb";
      launcher.style.color = theme.buttonText || "#ffffff";
      launcher.style.bottom = `${offsetY}px`;
      launcher.style[pos] = `${offsetX}px`;

      // Widget
      const widget = el("div", { class: "kontaktio-widget" });
      widget.style.background = theme.widgetBg || "#ffffff";
      widget.style.borderRadius = `${Math.max(12, Number(theme.radius || 18))}px`;
      widget.style.bottom = `${offsetY + 70}px`;
      widget.style[pos] = `${offsetX}px`;

      const closeBtn = el("button", { class: "kontaktio-close", type: "button" }, ["×"]);
      closeBtn.style.color = theme.headerText || "#ffffff";
      closeBtn.addEventListener("click", () => {
        isOpen = false;
        saveOpenState(false);
        widget.style.display = "none";
      });

      const headerLeft = el("div", {}, [
        el("div", {}, [cfg.company?.name || "Asystent"]),
        cfg.welcome_hint
          ? el("div", { class: "kontaktio-header-sub" }, [cfg.welcome_hint])
          : el("div")
      ]);

      const header = el("div", { class: "kontaktio-header" }, [headerLeft, closeBtn]);
      header.style.background = theme.headerBg || "#111827";
      header.style.color = theme.headerText || "#ffffff";

      const muted = el("div", { class: "kontaktio-muted" }, [""]);
      muted.style.display = "none";

      const messages = el("div", { class: "kontaktio-messages" }, []);
      const quick = el("div", { class: "kontaktio-quick" }, []);

      const input = el("input", {
        class: "kontaktio-input",
        placeholder: "Napisz wiadomość…",
        type: "text"
      });
      input.style.background = theme.inputBg || "#ffffff";
      input.style.color = theme.inputText || "#111827";

      const sendBtn = el("button", { class: "kontaktio-send", type: "button" }, ["Wyślij"]);
      sendBtn.style.background = theme.buttonBg || "#2563eb";
      sendBtn.style.color = theme.buttonText || "#ffffff";

      const inputWrap = el("div", { class: "kontaktio-inputwrap" }, [input, sendBtn]);
      inputWrap.style.background = theme.widgetBg || "#ffffff";

      widget.appendChild(header);
      widget.appendChild(muted);
      widget.appendChild(messages);
      widget.appendChild(quick);
      widget.appendChild(inputWrap);

      root.appendChild(widget);
      root.appendChild(launcher);

      launcher.addEventListener("click", () => {
        isOpen = true;
        saveOpenState(true);
        widget.style.display = "flex";
        input.focus();
      });

      // Restore history
      const history = loadHistory();
      history.forEach((m) => {
        if (!m || !m.role) return;
        const row = el("div", { class: `kontaktio-row ${m.role}` }, [
          el("div", { class: "kontaktio-bubble" }, [m.text || ""])
        ]);
        messages.appendChild(row);
      });

      // Welcome / status
      if (cfg.status !== "active") {
        if (!history.length) {
          messages.appendChild(
            el("div", { class: "kontaktio-row bot" }, [
              el("div", { class: "kontaktio-bubble" }, [
                cfg.statusMessage || "Asystent jest obecnie niedostępny."
              ])
            ])
          );
        }
        muted.textContent = "Asystent jest wyłączony.";
        muted.style.display = "block";
      } else if (!history.length && cfg.welcome_message) {
        messages.appendChild(
          el("div", { class: "kontaktio-row bot" }, [
            el("div", { class: "kontaktio-bubble" }, [cfg.welcome_message])
          ])
        );
      }

      // Auto open
      if (
        cfg.status === "active" &&
        cfg.auto_open_enabled &&
        !wasAutoOpened() &&
        !loadOpenState()
      ) {
        setTimeout(() => {
          markAutoOpened();
          isOpen = true;
          saveOpenState(true);
          widget.style.display = "flex";
        }, Math.max(0, cfg.auto_open_delay || 0));
      }
    };

    mount();
  });
})();
