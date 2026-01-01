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

  const savedPos = JSON.parse(localStorage.getItem("kontaktio-pos") || "null");
  let darkMode = localStorage.getItem("kontaktio-dark") === "1";

  const LAYOUTS = {
    demo: {
      name: "Kontaktio Demo",
      subtitle: "Asystent AI",
      logoType: "emoji",
      logo: "💬",
      bg: "#f8fafc",
      primary: "#2563eb",
      accent: "#3b82f6",
      quick: [
        "Co potrafi ten asystent?",
        "Jak wygląda wdrożenie?",
        "Dla jakich firm to działa?"
      ]
    },
    amico: {
      name: "AMICO",
      subtitle: "Pracownia Kamieniarska",
      logoType: "text",
      logo: "AMICO",
      bg: "#f7f6f2",
      primary: "#111111",
      accent: "#c9a24d",
      quick: [
        "Jakie wykonujecie blaty?",
        "Z jakich materiałów?",
        "Jak się z Wami skontaktować?"
      ]
    }
  };

  const L = LAYOUTS[CLIENT_ID] || LAYOUTS.demo;

  const style = document.createElement("style");
  style.textContent = `
  :root {
    --k-bg:${L.bg};
    --k-primary:${L.primary};
    --k-accent:${L.accent};
    --k-text:#111;
  }
  .k-dark {
    --k-bg:#020617;
    --k-text:#e5e7eb;
  }
  #k-launcher {
    position:fixed;right:20px;bottom:20px;
    width:56px;height:56px;border-radius:50%;
    background:var(--k-primary);color:#fff;
    display:flex;align-items:center;justify-content:center;
    cursor:pointer;z-index:99999;
    box-shadow:0 10px 30px rgba(0,0,0,.35);
  }
  #k-widget {
    position:fixed;right:20px;bottom:90px;
    width:380px;height:560px;
    background:var(--k-bg);
    border-radius:16px;
    display:flex;flex-direction:column;
    box-shadow:0 40px 120px rgba(0,0,0,.45);
    opacity:0;pointer-events:none;
    transform:translateY(20px);
    transition:.3s ease;
    z-index:99999;
    color:var(--k-text);
  }
  #k-widget.open {
    opacity:1;pointer-events:auto;transform:translateY(0);
  }
  #k-header {
    display:flex;align-items:center;gap:10px;
    padding:14px;background:var(--k-primary);
    color:#fff;cursor:move;user-select:none;
  }
  #k-controls {margin-left:auto;display:flex;gap:10px;}
  #k-controls button {
    background:none;border:none;color:#fff;
    cursor:pointer;font-size:14px;
  }
  #k-messages {flex:1;padding:14px;overflow-y:auto;}
  .k-msg {max-width:80%;padding:10px 14px;margin-bottom:10px;border-radius:14px;font-size:14px;}
  .k-user {background:var(--k-primary);color:#fff;margin-left:auto;}
  .k-bot {background:#e5e7eb;color:#111;}
  .k-typing {opacity:.6;font-style:italic;}
  #k-quick {display:flex;gap:8px;padding:10px;flex-wrap:wrap;}
  .k-q {padding:8px 10px;border-radius:10px;border:none;cursor:pointer;background:var(--k-accent);color:#fff;font-size:12px;}
  #k-input {display:flex;gap:8px;padding:12px;border-top:1px solid rgba(0,0,0,.1);}
  #k-input input {flex:1;padding:12px;border-radius:10px;border:1px solid #ddd;}
  #k-input button {padding:0 16px;border-radius:10px;border:none;background:var(--k-primary);color:#fff;cursor:pointer;}
  `;
  document.head.appendChild(style);

  const launcher = document.createElement("div");
  launcher.id = "k-launcher";
  launcher.textContent = "💬";

  const widget = document.createElement("div");
  widget.id = "k-widget";
  if (darkMode) widget.classList.add("k-dark");

  widget.innerHTML = `
    <div id="k-header">
      <div>${L.logo}</div>
      <div>
        <strong>${L.name}</strong><br>
        <small>${L.subtitle}</small>
      </div>
      <div id="k-controls">
        <button id="k-theme" type="button">🌓</button>
        <button id="k-close" type="button">✕</button>
      </div>
    </div>
    <div id="k-quick"></div>
    <div id="k-messages">
      <div class="k-msg k-bot">W czym mogę pomóc?</div>
    </div>
    <div id="k-input">
      <input id="k-text" placeholder="Napisz wiadomość…" />
      <button id="k-send" type="button">Wyślij</button>
    </div>
  `;

  document.body.appendChild(launcher);
  document.body.appendChild(widget);

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

  L.quick.forEach(q => {
    const b = document.createElement("button");
    b.className = "k-q";
    b.textContent = q;
    b.onclick = e => {
      e.stopPropagation();
      input.value = q;
      send();
    };
    quick.appendChild(b);
  });

  function add(text, cls) {
    const div = document.createElement("div");
    div.className = "k-msg " + cls;
    div.textContent = text;
    messages.appendChild(div);
    messages.scrollTop = messages.scrollHeight;
  }

  async function send() {
    const text = input.value.trim();
    if (!text || isLoading) return;
    isLoading = true;

    add(text, "k-user");
    input.value = "";

    const typing = document.createElement("div");
    typing.className = "k-msg k-bot k-typing";
    typing.textContent = "Asystent pisze…";
    messages.appendChild(typing);

    try {
      const res = await fetch(BACKEND_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, sessionId, clientId: CLIENT_ID })
      });
      const data = await res.json();
      sessionId = data.sessionId || sessionId;
      typing.remove();
      add(data.reply, "k-bot");
    } catch {
      typing.remove();
      add("Błąd połączenia.", "k-bot");
    } finally {
      isLoading = false;
    }
  }

  launcher.onclick = e => {
    e.stopPropagation();
    isOpen = !isOpen;
    widget.classList.toggle("open", isOpen);
  };

  closeBtn.onclick = e => {
    e.stopPropagation();
    widget.classList.remove("open");
    isOpen = false;
  };

  themeBtn.onclick = e => {
    e.stopPropagation();
    darkMode = !darkMode;
    widget.classList.toggle("k-dark", darkMode);
    localStorage.setItem("kontaktio-dark", darkMode ? "1" : "0");
  };

  sendBtn.onclick = e => {
    e.stopPropagation();
    send();
  };

  input.addEventListener("keydown", e => e.key === "Enter" && send());
})();
