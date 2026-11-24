/* Mineral Sense AI - Gemini Soil Advisor แบบแสดงตลอดเวลา */
(() => {
  const section = document.getElementById("soil-gemini-advisor");
  if (!section || section.dataset.initialized === "true") return;
  section.dataset.initialized = "true";

  const statusEl = document.getElementById("gemini-soil-status");
  const log = document.getElementById("gemini-chat-log");
  const form = document.getElementById("gemini-chat-form");
  const input = document.getElementById("gemini-chat-input");
  const send = document.getElementById("gemini-chat-send");
  const cropInput = document.getElementById("gemini-crop");
  let history = [];
  let busy = false;

  function appendInline(parent, text) {
    // Render only a small safe Markdown subset; never inject model text as HTML.
    const tick = String.fromCharCode(96);
    const parts = String(text).split(/(\*\*[^*]+\*\*|\x60[^\x60]+\x60)/g);
    for (const part of parts) {
      if (!part) continue;
      if (part.startsWith("**") && part.endsWith("**")) {
        const strong = document.createElement("strong");
        strong.textContent = part.slice(2, -2);
        parent.appendChild(strong);
      } else if (part.startsWith(tick) && part.endsWith(tick)) {
        const code = document.createElement("code");
        code.textContent = part.slice(1, -1);
        parent.appendChild(code);
      } else {
        parent.appendChild(document.createTextNode(part));
      }
    }
  }

  function renderAssistantMessage(el, text) {
    el.replaceChildren();
    const lines = String(text ?? "").replace(/\r/g, "").split("\n");
    let list = null;
    let listType = "";
    const closeList = () => { list = null; listType = ""; };

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) { closeList(); continue; }
      const bullet = line.match(/^(?:[-*•])\s+(.+)$/);
      const numbered = line.match(/^\d+[.)]\s+(.+)$/);
      if (bullet || numbered) {
        const type = bullet ? "ul" : "ol";
        if (!list || listType !== type) {
          closeList();
          list = document.createElement(type);
          el.appendChild(list);
          listType = type;
        }
        const item = document.createElement("li");
        appendInline(item, (bullet || numbered)[1]);
        list.appendChild(item);
        continue;
      }
      closeList();
      const heading = line.match(/^#{1,3}\s+(.+)$/);
      const block = document.createElement(heading ? "div" : "p");
      if (heading) block.className = "gemini-answer-heading";
      appendInline(block, heading ? heading[1] : line);
      el.appendChild(block);
    }
  }

  function addMessage(text, role) {
    const el = document.createElement("div");
    const isAssistant = role !== "user";
    el.className = "gemini-message " + (isAssistant ? "assistant" : "user");
    if (isAssistant) renderAssistantMessage(el, text);
    else el.textContent = String(text ?? "");
    log.appendChild(el);
    log.scrollTop = log.scrollHeight;
    return el;
  }

  // ใช้เฉพาะผลตรวจที่ API ส่งมาจริง ไม่มีการเติมค่าจำลอง
  async function getLatestSoilData() {
    const response = await fetch("/api/data", {
      method: "GET", credentials: "same-origin", cache: "no-store"
    });
    if (!response.ok) throw new Error("อ่านผลตรวจจากเครื่องไม่สำเร็จ");
    const data = await response.json();
    const results = Array.isArray(data.results) ? data.results : [];
    const values = {};

    for (const key of ["pH", "N", "P", "K"]) {
      const item = results.find(row => row && row.type === key);
      if (!item || item.value === undefined || item.value === null || item.value === "") continue;
      const numeric = Number(item.value);
      if (!Number.isFinite(numeric)) continue;
      values[key] = {
        value: numeric,
        unit: item.unit || null,
        level: item.level || null,
        color_hex: item.color_hex || null,
        captured_at: item.captured_at || data.captured_at || null
      };
    }

    const available = Object.keys(values);
    const soilData = {
      values,
      available,
      complete: ["pH", "N", "P", "K"].every(key => Object.prototype.hasOwnProperty.call(values, key)),
      live: Boolean(data.live),
      captured_at: data.captured_at || null
    };
    statusEl.textContent = available.length
      ? `ได้รับผลตรวจจากเครื่องจริง ${available.length}/4 ค่า: ${available.join(", ")}${soilData.complete ? " · ครบแล้ว" : " · ยังรอค่าที่เหลือ"}`
      : "ยังไม่มีผลตรวจจากกล้อง · คุณสามารถถาม Gemini เรื่องดินทั่วไปได้";
    statusEl.dataset.hasData = available.length ? "true" : "false";
    return soilData;
  }

  async function refreshSoilStatus() {
    try {
      await getLatestSoilData();
    } catch (_) {
      statusEl.textContent = "ยังเชื่อมต่อข้อมูลผลตรวจไม่ได้ · ถามเรื่องดินทั่วไปได้";
      statusEl.dataset.hasData = "false";
    }
  }

  async function submitMessage(value) {
    const message = String(value || "").trim();
    if (!message || busy) return;
    busy = true;
    send.disabled = true;
    input.disabled = true;
    addMessage(message, "user");
    const pending = addMessage("กำลังวิเคราะห์คำถามและผลตรวจจากเครื่อง...", "assistant");

    try {
      // Backend อ่านค่าจาก camera_live_values โดยตรง จึงไม่ต้องเรียก /api/data ซ้ำก่อนแชต
      const response = await fetch("/api/chat", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          history: history.slice(-4),
          crop: cropInput ? cropInput.value.trim() : ""
        })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok) throw new Error(data.error || "ไม่สามารถรับคำตอบจาก Gemini ได้");
      renderAssistantMessage(pending, data.reply || "Gemini ไม่ได้ส่งข้อความตอบกลับ");
      history.push(
        { role: "user", text: message },
        { role: "model", text: data.reply || "Gemini ไม่ได้ส่งข้อความตอบกลับ" }
      );
      history = history.slice(-4);
    } catch (error) {
      pending.textContent = "ขออภัย: " + (error.message || "เกิดข้อผิดพลาด");
    } finally {
      busy = false;
      send.disabled = false;
      input.disabled = false;
      input.focus();
      log.scrollTop = log.scrollHeight;
    }
  }

  form.addEventListener("submit", event => {
    event.preventDefault();
    const message = input.value;
    input.value = "";
    submitMessage(message);
  });
  section.querySelectorAll("[data-gemini-q]").forEach(button => {
    button.addEventListener("click", () => submitMessage(button.dataset.geminiQ));
  });

  refreshSoilStatus();
  window.setInterval(refreshSoilStatus, 10000);
})();
