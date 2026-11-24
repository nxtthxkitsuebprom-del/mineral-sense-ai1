/* Mineral Sens AI - Gemini chatbot widget */
(() => {
  if (document.getElementById("mineral-chat-widget")) return;

  const style = document.createElement("style");
  style.textContent = `
    #mineral-chat-widget{font-family:Arial,sans-serif;position:relative;z-index:99999}
    #mc-launch{position:fixed;right:22px;bottom:22px;width:60px;height:60px;border:0;border-radius:50%;background:#176b43;color:#fff;font-size:27px;box-shadow:0 5px 18px #0003;cursor:pointer}
    #mc-panel{position:fixed;right:22px;bottom:94px;width:min(370px,calc(100vw - 28px));height:min(540px,calc(100dvh - 115px));background:#fff;border:1px solid #dce5df;border-radius:17px;box-shadow:0 8px 32px #0003;display:flex;flex-direction:column;overflow:hidden;color:#1d2b22}
    #mc-panel[hidden]{display:none}
    .mc-head{background:#176b43;color:#fff;padding:14px 16px;display:flex;align-items:center;justify-content:space-between}
    .mc-head strong{display:block;font-size:15px}.mc-head small{display:block;font-size:11px;opacity:.85;margin-top:4px}
    #mc-close{border:0;background:transparent;color:#fff;font-size:25px;cursor:pointer}
    #mc-log{flex:1;overflow-y:auto;padding:13px;display:flex;flex-direction:column;gap:9px;background:#fbfdfb}
    .mc-msg{max-width:87%;padding:10px 12px;border-radius:13px;font-size:13px;line-height:1.55;white-space:pre-wrap;overflow-wrap:anywhere}
    .mc-bot{align-self:flex-start;background:#eaf3ec;color:#233a2b;border-bottom-left-radius:4px}
    .mc-user{align-self:flex-end;background:#176b43;color:#fff;border-bottom-right-radius:4px}
    .mc-quick{display:flex;gap:6px;overflow-x:auto;padding:8px 10px 3px}
    .mc-quick button{white-space:nowrap;border:1px solid #b7d4c0;background:#fff;color:#176b43;border-radius:18px;padding:6px 9px;font-size:11px;cursor:pointer}
    #mc-form{display:flex;gap:7px;padding:10px;border-top:1px solid #e5eae6;background:#fff}
    #mc-input{flex:1;min-width:0;border:1px solid #cbd5ce;border-radius:22px;padding:10px 13px;font-size:13px;outline:none}
    #mc-input:focus{border-color:#176b43}
    #mc-send{border:0;border-radius:22px;padding:0 15px;background:#176b43;color:#fff;cursor:pointer}
    #mc-send:disabled{opacity:.55;cursor:wait}
    @media(max-width:480px){#mc-launch{right:15px;bottom:15px}#mc-panel{right:8px;bottom:84px;width:calc(100vw - 16px);height:min(560px,calc(100dvh - 100px))}}
  `;
  document.head.appendChild(style);

  const root = document.createElement("div");
  root.id = "mineral-chat-widget";
  root.innerHTML = `
    <button id="mc-launch" type="button" aria-label="เปิดผู้ช่วย Mineral Sens AI">🌱</button>
    <section id="mc-panel" hidden aria-label="แชตผู้ช่วย Mineral Sens AI">
      <header class="mc-head">
        <div><strong>Mineral Sens AI</strong><small>ผู้ช่วยด้านดินและการเกษตร</small></div>
        <button id="mc-close" type="button" aria-label="ปิด">×</button>
      </header>
      <div id="mc-log" aria-live="polite">
        <div class="mc-msg mc-bot">สวัสดีครับ 🌱 ผมคือผู้ช่วย Mineral Sens AI ถามเรื่องค่า pH, NPK, การปรับปรุงดิน หรือผลตรวจดินล่าสุดของบัญชีคุณได้เลยครับ</div>
      </div>
      <div class="mc-quick">
        <button type="button" data-q="ค่า pH ของดินบอกอะไรเราได้บ้าง">ค่า pH คืออะไร</button>
        <button type="button" data-q="ธาตุ N P K มีหน้าที่อะไร">ธาตุ NPK</button>
        <button type="button" data-q="ช่วยอธิบายผลตรวจดินล่าสุดของฉัน">อธิบายผลตรวจดิน</button>
      </div>
      <form id="mc-form">
        <input id="mc-input" maxlength="1500" autocomplete="off" placeholder="พิมพ์คำถามเกี่ยวกับดิน..." aria-label="ข้อความที่ต้องการถาม">
        <button id="mc-send" type="submit">ส่ง</button>
      </form>
    </section>`;
  document.body.appendChild(root);

  const panel = root.querySelector("#mc-panel");
  const launch = root.querySelector("#mc-launch");
  const log = root.querySelector("#mc-log");
  const form = root.querySelector("#mc-form");
  const input = root.querySelector("#mc-input");
  const send = root.querySelector("#mc-send");
  let history = [];
  let busy = false;

  function addMessage(text, role) {
    const el = document.createElement("div");
    el.className = "mc-msg " + (role === "user" ? "mc-user" : "mc-bot");
    el.textContent = text;
    log.appendChild(el);
    log.scrollTop = log.scrollHeight;
    return el;
  }

  async function submitMessage(value) {
    const message = String(value || "").trim();
    if (!message || busy) return;
    if (message.length > 1500) {
      addMessage("ข้อความยาวเกิน 1,500 ตัวอักษร กรุณาย่อคำถาม", "assistant");
      return;
    }

    busy = true;
    send.disabled = true;
    input.value = "";
    addMessage(message, "user");
    const pending = addMessage("กำลังค้นหาคำตอบจาก Gemini AI...", "assistant");

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        credentials: "same-origin",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({message, history: history.slice(-8)})
      });
      const data = await response.json();
      if (!response.ok || !data.ok) {
        throw new Error(data.error || "ไม่สามารถรับคำตอบได้");
      }
      pending.textContent = data.reply;
      history.push({role: "user", text: message}, {role: "model", text: data.reply});
      history = history.slice(-8);
    } catch (err) {
      pending.textContent = "ขออภัย: " + (err.message || "เกิดข้อผิดพลาด");
    } finally {
      busy = false;
      send.disabled = false;
      input.focus();
      log.scrollTop = log.scrollHeight;
    }
  }

  launch.addEventListener("click", () => {
    panel.hidden = !panel.hidden;
    if (!panel.hidden) input.focus();
  });
  root.querySelector("#mc-close").addEventListener("click", () => panel.hidden = true);
  form.addEventListener("submit", event => {
    event.preventDefault();
    submitMessage(input.value);
  });
  root.querySelectorAll("[data-q]").forEach(button => {
    button.addEventListener("click", () => submitMessage(button.dataset.q));
  });
})();
