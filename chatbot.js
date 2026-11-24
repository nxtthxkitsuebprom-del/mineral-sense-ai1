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

  function addMessage(text, role) {
    const el = document.createElement("div");
    el.className = "gemini-message " + (role === "user" ? "user" : "assistant");
    el.textContent = String(text ?? "");
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
    const pending = addMessage("กำลังส่งคำถามและตรวจสอบผลวัดล่าสุด...", "assistant");

    try {
      let soilData = null;
      try { soilData = await getLatestSoilData(); } catch (_) {}
      const response = await fetch("/api/chat", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          history: history.slice(-8),
          soil_data: soilData,
          crop: cropInput ? cropInput.value.trim() : ""
        })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok) throw new Error(data.error || "ไม่สามารถรับคำตอบจาก Gemini ได้");
      pending.textContent = data.reply || "Gemini ไม่ได้ส่งข้อความตอบกลับ";
      history.push(
        { role: "user", text: message },
        { role: "model", text: pending.textContent }
      );
      history = history.slice(-8);
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
  window.setInterval(refreshSoilStatus, 5000);
})();
