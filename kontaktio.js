(function () {
  if (window.KontaktioLoaded) return;
  window.KontaktioLoaded = true;

  const script = document.currentScript;
  const CLIENT_ID = script?.getAttribute("data-client") || "demo";
  const BACKEND_URL = "https://chatbot-backend-x2cy.onrender.com/chat";

  let sessionId = null;
  let isOpen = false;
  let isLoading = false;
  let themeApplied = false;
  let darkMode = localStorage.getItem("kontaktio-dark") === "1";

  /* =========================
     LAYOUT PRESETS (RÓŻNICE)
     ========================= */
  const LAYOUTS = {
    demo: {
      headerStyle: "saas",
      title: "Kontaktio Demo",
      subtitle: "Asystent AI dla firm",
      showQuickBar: true,
      quickBar: [
        "Co potrafi ten asystent?",
        "Jak wygląda wdrożenie?",
        "Dla jakich firm to działa?"
      ]
    },

    amico: {
      headerStyle: "brand",
      title: "AMICO",
      subtitle: "Pracownia Kamieniarska",
      showQuickBar: true,
      quickBar: [
        "Jakie wykonujecie blaty?",
        "Czy robicie schody z granitu?",
        "Jak się z Wami skontaktować?"
      ]
    },

    premium: {
      headerStyle: "luxury",
      title: "Kontaktio Premium",
      subtitle: "Obsługa klasy premium",
      showQuickBar: false,
      quickBar: []
    }
  };

  const LAYOUT = LAYOUTS[CLIENT_ID] || LAYOUTS.demo;

  const START_MESSAGE = {
    demo: "To jest wersja demonstracyjna asystenta Kontaktio.",
    amico: "Jestem asystentem Pracowni Kamieniarskiej AMICO.",
    premium: "Witaj w wersji premium asystenta Kontaktio."
  };

  /* =========================
     CSS
     ========================= */
  const style = document.createElement("style");
  style.textContent = `
  :root {
    --k-primary:#111;
    --k-accent:#2563eb;
    --k-bg:#f8fafc;
    --k-bot:#e5e7eb;
    --k-text:#111;
    --k-radius:14px;
  }

  body.k-dark {
    --k-bg:#020617;
    --k-bot:#1e293b;
    --k-text:#e5e7eb;
  }

  #k-launcher {
    position:fixed;bottom:20px;right:20px;
    width:56px;height:56px;border-radius:50%;
    background:var(--k-primary);color:#fff;
    display:flex;align-items:center;justify-content:center;
    cursor:pointer;z-index:99999;
    transition:transform .2s,box-shadow .2s;
  }
  #k-launcher:hover{
    transform:scale(1.08);
    box-shadow:0 14px 35px rgba(0,0,0,.4)
  }

  #k-widget {
    position:fixed;bottom:90px;right:20px;
    width:360px;height:560px;
    background:var(--k-bg);
    border-radius:var(--k-radius);
    display:flex;flex-direction:column;
    overflow:hidden;
    box-shadow:0 30px 90px rgba(0,0,0,.5);
    opacity:0;
    transform:translateY(30px) scale(.94);
    pointer-events:none;
    transition:all .4s cubic-bezier(.16,1,.3,1);
    z-index:99999;
  }
  #k-widget.open{
    opacity:1;
    transform:none;
    pointer-events:auto;
  }

  /* ===== HEADERS ===== */
  #k-header{
    color:#fff;
    padding:14px;
    cursor:move;
    display:flex;
    justify-content:space-between;
    align-items:center;
  }

  .k-header-saas {
    background:linear-gradient(135deg,#2563eb,#1e40af);
  }

  .k-header-brand {
    background:linear-gradient(135deg,#111,#c9a24d);
    text-transform:uppercase;
    letter-spacing:1px;
  }

  .k-header-luxury {
    background:linear-gradient(135deg,#020617,#0f172a);
    padding:18px;
  }

  #k-header small{
    opacity:.75;
    font-size:12px;
  }

  #k-header button{
    background:none;border:none;color:#fff;
    font-size:16px;cursor:pointer;margin-left:6px;
  }

  /* ===== QUICK BAR ===== */
  #k-quickbar{
    display:flex;
    gap:8px;
    padding:10px;
    overflow-x:auto;
    background:rgba(0,0,0,.04);
  }

  .k-quick{
    white-space:nowrap;
    font-size:12px;
    padding:8px 12px;
    border-radius:999px;
    background:var(--k-accent);
    color:#fff;
    border:none;
    cursor:pointer;
  }

  #k-messages{
    flex:1;
    padding:14px;
    overflow-y:auto;
  }

  .k-msg{
    max-width:80%;
    padding:10px 14px;
    border-radius:14px;
    margin-bottom:10px;
    font-size:14px;
    animation:msgIn .25s ease;
  }

  @keyframes msgIn{
    from{opacity:0;transform:translateY(6px)}
    to{opacity:1;transform:none}
  }

  .k-user{
    background:var(--k-primary);
    color:#fff;
    margin-left:auto;
  }

  .k-bot{
    background:var(--k-bot);
    color:var(--k-text);
  }

  .k-typing{
    font-size:12px;
    opacity:.6;
    animation:pulse 1.2s infinite;
  }

  @keyframes pulse{
    0%{opacity:.3}
    50%{opacity:.8}
    100%{opacity:.3}
  }

  #k-input{
    display:flex;
    border-top:1px solid rgba(0,0,0,.1);
  }

  #k-input input{
    flex:1;
    padding:12px;
    border:none;
    outline:none;
    background:transparent;
    color:var(--k-text);
  }

  #k-input button{
    padding:0 16px;
    border:none;
    background:var(--k-primary);
    color:#fff;
    cursor:pointer;
  }
  `;
  document.head.appendChild(style);

  /* =========================
     HTML
     ========================= */
  const launcher = document.createElement("div");
  launcher.id = "k-launcher";
  launcher.textContent = "💬";

  const widget = document.createElement("div");
  widget.id = "k-widget";
  widget.innerHTML = `
    <div id="k-header" class="k-header-${LAYOUT.headerStyle}">
      <div>
        <strong>${LAYOUT.title}</strong><br>
        <small>${LAYOUT.subtitle}</small>
      </div>
      <div>
        <button id="k-theme">🌓</button>
        <button id="k-close">✕</button>
      </div>
    </div>

    ${LAYOUT.showQuickBar ? `<div id="k-quickbar"></div>` : ``}

    <div id="k-messages">
      <div class="k-msg k-bot">${START_MESSAGE[CLIENT_ID]}</div>
    </div>

    <div id="k-input">
      <input id="k-text" placeholder="Napisz wiadomość…" />
      <button id="k-send">Wyślij</button>
    </div>
  `;

  document.body.appendChild(launcher);
  document.body.appendChild(widget);

  const messages = widget.querySelector("#k-messages");
  const input = widget.querySelector("#k-text");
  const sendBtn = widget.querySelector("#k-send");
  const closeBtn = widget.querySelector("#k-close");
  const themeBtn = widget.querySelector("#k-theme");
  const header = widget.querySelector("#k-header");
  const quickbar = widget.querySelector("#k-quickbar");

  if (darkMode) document.body.classList.add("k-dark");

  /* ===== QUICK BAR ===== */
  if (quickbar && LAYOUT.quickBar) {
    LAYOUT.quickBar.forEach(q => {
      const b = document.createElement("button");
      b.className = "k-quick";
      b.textContent = q;
      b.onclick = () => {
        input.value = q;
        send();
      };
      quickbar.appendChild(b);
    });
  }

  function add(text, cls) {
    const div = document.createElement("div");
    div.className = "k-msg " + cls;
    div.textContent = text || "—";
    messages.appendChild(div);
    messages.scrollTop = messages.scrollHeight;
    return div;
  }

  async function send() {
    const text = input.value.trim();
    if (!text || isLoading) return;

    isLoading = true;
    add(text, "k-user");
    input.value = "";

    const typing = add("Asystent pisze…", "k-bot k-typing");

    try {
      const res = await fetch(BACKEND_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          sessionId,
          clientId: CLIENT_ID
        })
      });

      const data = await res.json();
      sessionId = data.sessionId || sessionId;

      if (!themeApplied && data.theme) {
        const r = document.documentElement.style;
        Object.entries(data.theme).forEach(([k, v]) => {
          r.setProperty(`--k-${k}`, v);
        });
        themeApplied = true;
      }

      typing.remove();
      add(data.reply, "k-bot");
    } catch {
      typing.remove();
      add("Błąd połączenia z serwerem.", "k-bot");
    } finally {
      isLoading = false;
      input.focus();
    }
  }

  /* ===== DRAG ===== */
  let dragging = false, ox = 0, oy = 0;
  header.addEventListener("mousedown", e => {
    dragging = true;
    const r = widget.getBoundingClientRect();
    ox = e.clientX - r.left;
    oy = e.clientY - r.top;
  });
  document.addEventListener("mousemove", e => {
    if (!dragging) return;
    widget.style.left = e.clientX - ox + "px";
    widget.style.top = e.clientY - oy + "px";
    widget.style.right = "auto";
    widget.style.bottom = "auto";
  });
  document.addEventListener("mouseup", () => dragging = false);

  /* ===== EVENTS ===== */
  launcher.onclick = () => {
    isOpen = !isOpen;
    widget.classList.toggle("open", isOpen);
    if (isOpen) input.focus();
  };

  closeBtn.onclick = () => {
    isOpen = false;
    widget.classList.remove("open");
  };

  themeBtn.onclick = () => {
    darkMode = !darkMode;
    document.body.classList.toggle("k-dark", darkMode);
    localStorage.setItem("kontaktio-dark", darkMode ? "1" : "0");
  };

  sendBtn.onclick = send;
  input.addEventListener("keydown", e => {
    if (e.key === "Enter") send();
  });
})();
