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

  /* ================= CSS ================= */
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
    transform:scale(1.07);
    box-shadow:0 12px 30px rgba(0,0,0,.35)
  }

  #k-widget {
    position:fixed;bottom:90px;right:20px;
    width:360px;height:520px;
    background:var(--k-bg);
    border-radius:var(--k-radius);
    display:flex;flex-direction:column;
    overflow:hidden;
    box-shadow:0 30px 80px rgba(0,0,0,.5);
    opacity:0;
    transform:translateY(20px) scale(.95);
    pointer-events:none;
    transition:all .35s cubic-bezier(.4,0,.2,1);
    z-index:99999;
  }
  #k-widget.open{
    opacity:1;
    transform:none;
    pointer-events:auto;
  }

  #k-header{
    background:var(--k-primary);
    color:#fff;
    padding:12px;
    cursor:move;
    display:flex;
    justify-content:space-between;
    align-items:center;
  }

  #k-header button{
    background:none;
    border:none;
    color:#fff;
    font-size:16px;
    cursor:pointer;
    margin-left:8px;
  }

  #k-messages{
    flex:1;
    padding:12px;
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

  /* ================= HTML ================= */
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

  if (darkMode) document.body.classList.add("k-dark");

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
