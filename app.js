// JavaScript สำหรับหน้าเข้าสู่ระบบ, หน้าแสดงผล และหน้าบัญชี
const $ = (selector) => document.querySelector(selector);

async function api(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    // ดึงผลกล้องล่าสุดจากเซิร์ฟเวอร์เสมอ ไม่ใช้ข้อมูล GET ที่ค้างในแคช
    ...(options.method ? {} : {cache:"no-store"}),
    headers: { "Content-Type": "application/json", ...(options.headers || {}) }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "เกิดข้อผิดพลาด");
  return data;
}

// ---------- ระบบบัญชี: เข้าสู่ระบบ / ลงทะเบียน / ลืมรหัสผ่าน ----------
document.querySelectorAll("[data-auth]").forEach((tab) => tab.addEventListener("click", () => {
  const mode = tab.dataset.auth;
  document.querySelectorAll("[data-auth]").forEach((item) => item.classList.toggle("active", item === tab));
  document.querySelectorAll("[data-auth-panel]").forEach((panel) => panel.hidden = panel.dataset.authPanel !== mode);
  const descriptions = {login:"เข้าสู่ระบบเพื่อดูผลวิเคราะห์ pH, N, P และ K", register:"สร้างบัญชีเพื่อเริ่มใช้งานระบบ", forgot:"การกู้คืนบัญชีอย่างปลอดภัย"};
  $("#auth-description").textContent = descriptions[mode];
}));
async function submitAuth(form, endpoint, errorSelector, successMessage) {
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const payload = Object.fromEntries(new FormData(form).entries());
    const errorBox = $(errorSelector); errorBox.textContent = "";
    try {
      const result = await api(endpoint, {method:"POST", body:JSON.stringify(payload)});
      if (result.redirect) window.location.href = result.redirect;
      else errorBox.textContent = successMessage || result.message || "ดำเนินการสำเร็จ";
    } catch (error) { errorBox.textContent = error.message; }
  });
}
const registerForm = $("#register-form");
if (registerForm) submitAuth(registerForm, "/api/register", "#register-error");
const forgotForm = $("#forgot-form");
if (forgotForm) submitAuth(forgotForm, "/api/forgot-password", "#forgot-error", "เปลี่ยนรหัสผ่านแล้ว กรุณาเข้าสู่ระบบ");

// ---------- หน้าเข้าสู่ระบบ ----------
const loginForm = $("#login-form");
if (loginForm) {
  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(loginForm);
    const errorBox = $("#login-error");
    errorBox.textContent = "";
    try {
      const result = await api("/api/login", {
        method: "POST",
        body: JSON.stringify({
          username: form.get("username"),
          password: form.get("password")
        })
      });
      window.location.href = result.redirect;
    } catch (error) {
      errorBox.textContent = error.message;
    }
  });
}

// ---------- ออกจากระบบ ----------
document.querySelectorAll("[data-logout]").forEach((button) => {
  button.addEventListener("click", async () => {
    try { await api("/api/logout", { method: "POST", body: "{}" }); }
    finally { window.location.href = "/"; }
  });
});

// ---------- รูปโปรไฟล์: อีโมจิ หรือรูปที่อัปโหลด (data URL) ----------
function renderAvatar(el, value) {
  if (!el) return;
  el.textContent = "";
  if (typeof value === "string" && value.startsWith("data:image/")) {
    const img = document.createElement("img");
    img.src = value; img.alt = "รูปโปรไฟล์";
    el.appendChild(img);
  } else {
    el.textContent = value || "🌻";
  }
}

// ---------- หน้าบัญชี ----------
if ($("#profile-username")) {
  api("/api/me")
    .then((user) => {
      $("#profile-username").textContent = user.username;
      $("#profile-name").textContent = user.display_name;
      $("#profile-email").textContent = user.email || "-";
      if ($("#profile-avatar") && user.avatar) renderAvatar($("#profile-avatar"), user.avatar);
    })
    .catch(() => { window.location.href = "/"; });
}

// ---------- หน้าแสดงผลวิเคราะห์ดิน ----------
const dashboard = $("#nutrient-grid");
if (dashboard) {
  const keys = ["pH", "N", "P", "K"];
  const npkLevels = {
  0: "ขาดแคลนวิกฤต",
  1: "ขาดแคลน",
  2: "พอใช้",
  3: "เพียงพอ",
  4: "มากเกินไป"
};

function formatSoilValue(type, value) {
  if (type === "pH") return value;

  const num = Number(value);
  return Number.isInteger(num) && npkLevels[num] !== undefined
    ? npkLevels[num]
    : value;
}
  let previousStamp = null;
  const cropIcons = {"ข้าว":"🌾","ข้าวโพด":"🌽","มันสำปะหลัง":"🥔","อ้อย":"🎋","ถั่วเหลือง":"🫘","ผักบุ้ง":"🥬","คะน้า":"🥬","กะหล่ำปลี":"🥬","แตงกวา":"🥒","พริก":"🌶️","มะเขือเทศ":"🍅","มะม่วง":"🥭","กล้วย":"🍌","มะนาว":"🍋","ฝรั่ง":"🍐","ส้ม":"🍊","มะละกอ":"🍈"};
  function node(id) { return document.getElementById(id) || {textContent:"", className:""}; }
  function setEmpty() {
    if (advisorPanel) advisorPanel.hidden = true;
    keys.forEach(key => {
      const v=document.querySelector(`[data-value="${key}"]`), m=document.querySelector(`[data-meter="${key}"]`), c=document.querySelector(`[data-color-label="${key}"]`);
      const card=v?.closest(".nutrient-card");
      // เริ่มต้นทุกค่าที่ 0 และคงกรอบการ์ดไว้จนกว่าจะได้รับค่าจริงจากกล้อง
      if(card) card.hidden=false;
      if(v) v.textContent=`${key}: 0`; if(m) m.style.width="0%"; if(c) c.textContent="ยังไม่เริ่มตรวจ";
    });
    node("soil-type").textContent="รอผลวิเคราะห์";
    node("soil-detail").textContent="เมื่อกล้องส่งค่าครบ ระบบจะสรุปสภาพกรด-ด่างและระดับธาตุอาหาร";
    node("fertility-label").textContent="ยังไม่ประเมิน";
    node("nutrient-status").textContent="รอผลตรวจ NPK";
    node("soil-recommendations").innerHTML="<li>รอผลตรวจเพื่อแสดงคำแนะนำ</li>";
    node("crop-results").innerHTML='<div class="crop-empty">🌱<b>รอผลตรวจดิน</b><span>เมื่ออ่านค่าครบ ระบบจะแนะนำพืชที่เหมาะสม</span></div>';
    node("scan-progress-text").textContent="0 / 4 ค่า"; node("scan-progress-bar").style.width="0%";
  }

  // Gemini Soil Advisor: เปิดใช้เฉพาะเมื่อ API ยืนยันว่ากล้องอ่านครบ 4 ค่า
  const advisorPanel = document.getElementById("soil-advisor-panel");
  const advisorLog = document.getElementById("soil-advisor-log");
  const advisorQuestion = document.getElementById("soil-advisor-question");
  const advisorCrop = document.getElementById("soil-advisor-crop");
  const advisorSend = document.getElementById("soil-advisor-send");
  let advisorBusy = false;
  function advisorMessage(text, role) {
    if (!advisorLog) return;
    const item = document.createElement("div");
    item.className = "soil-advisor-message " + (role === "user" ? "user" : "assistant");
    item.textContent = text;
    advisorLog.appendChild(item);
    advisorLog.scrollTop = advisorLog.scrollHeight;
  }
  async function askSoilAdvisor(message) {
    const question = String(message || "").trim();
    if (!question || advisorBusy || !advisorPanel || advisorPanel.hidden) return;
    advisorBusy = true;
    if (advisorSend) advisorSend.disabled = true;
    advisorMessage(question, "user");
    const pending = document.createElement("div");
    pending.className = "soil-advisor-message assistant";
    pending.textContent = "กำลังวิเคราะห์ผลตรวจจากกล้องด้วย Gemini...";
    advisorLog.appendChild(pending);
    advisorLog.scrollTop = advisorLog.scrollHeight;
    try {
      const response = await fetch("/api/soil-advisor", {
        method: "POST",
        credentials: "same-origin",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify({message:question, crop:advisorCrop?.value || ""})
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.ok) throw new Error(result.error || "ไม่สามารถรับคำตอบจาก Gemini ได้");
      pending.textContent = result.reply;
    } catch (error) {
      pending.textContent = "ขออภัย: " + (error.message || "เกิดข้อผิดพลาด");
    } finally {
      advisorBusy = false;
      if (advisorSend) advisorSend.disabled = false;
      if (advisorLog) advisorLog.scrollTop = advisorLog.scrollHeight;
    }
  }
  if (advisorPanel) {
    document.querySelectorAll("[data-advisor-q]").forEach(button => {
      button.addEventListener("click", () => askSoilAdvisor(button.dataset.advisorQ));
    });
    document.getElementById("soil-advisor-form")?.addEventListener("submit", event => {
      event.preventDefault();
      const value = advisorQuestion?.value || "";
      if (advisorQuestion) advisorQuestion.value = "";
      askSoilAdvisor(value);
    });
  }

  // คำแนะนำการจัดการดินตาม pH ที่กล้องตรวจได้จริง (ไม่ใช่อัตราใส่วัสดุ)
  function soilCareAdvice(phValue, results = {}) {
    const ph = Number(phValue);
    if (!Number.isFinite(ph) || ph < 0 || ph > 14) return [];
    let advice;
    if (ph < 4.5) advice = [
      "ดินกรดจัด: ความเป็นกรดสูงอาจเพิ่มความเสี่ยงต่อพิษอะลูมิเนียมและจำกัดการเจริญของราก ควรตรวจยืนยันค่า pH ก่อนปรับปรุงดิน",
      "ตรวจความต้องการปูนของดินก่อนเลือกใช้ปูนเกษตรหรือโดโลไมต์ และกำหนดอัตราตามผลวิเคราะห์ ไม่ควรใส่ปูนโดยคาดเดา",
      "เพิ่มปุ๋ยหมักที่ย่อยสลายสมบูรณ์และปรับปรุงการระบายน้ำ พร้อมตรวจค่า pH ซ้ำหลังดำเนินการ"
    ];
    else if (ph < 5.5) advice = [
      "ดินค่อนข้างเป็นกรด: ตรวจช่วง pH ที่เหมาะสมกับพืชเป้าหมาย เพราะพืชแต่ละชนิดทนกรดได้ต่างกัน",
      "หากต้องปรับ pH ให้ตรวจความต้องการปูนก่อนใช้วัสดุปูน และเพิ่มอินทรียวัตถุเพื่อช่วยปรับปรุงโครงสร้างดิน",
      "ติดตามค่า pH หลังปรับปรุงและหลีกเลี่ยงการใส่ปูนเกินความจำเป็น"
    ];
    else if (ph < 6.5) advice = [
      "ดินกรดอ่อน: เป็นช่วงที่พืชหลายชนิดเจริญเติบโตได้ดี ควรตรวจสอบความต้องการเฉพาะของพืชที่จะปลูก",
      "รักษาอินทรียวัตถุด้วยปุ๋ยหมักสุกหรือเศษพืชคลุมดิน และดูแลความชื้นกับการระบายน้ำให้เหมาะสม",
      "วางแผนการให้ปุ๋ยจากผลวิเคราะห์ธาตุอาหารที่สอบเทียบแล้ว เพื่อลดการใช้ปุ๋ยเกินจำเป็น"
    ];
    else if (ph <= 7.5) advice = [
      "ดินใกล้เป็นกลาง: โดยทั่วไปเอื้อต่อการดูดใช้ธาตุอาหารของพืชหลายชนิด แต่ยังต้องพิจารณาความต้องการของพืชแต่ละชนิด",
      "รักษาคุณภาพดินด้วยอินทรียวัตถุ การคลุมดิน และการให้น้ำอย่างเหมาะสม",
      "ไม่จำเป็นต้องปรับ pH โดยไม่มีข้อบ่งชี้ ควรติดตามผลตรวจและหลีกเลี่ยงการใส่ปุ๋ยมากเกินไป"
    ];
    else if (ph <= 8.5) advice = [
      "ดินด่าง: ธาตุเหล็ก สังกะสี และแมงกานีสอาจอยู่ในรูปที่พืชดูดใช้ได้ยาก ควรสังเกตอาการใบเหลืองหรือการเจริญเติบโตช้า",
      "เพิ่มอินทรียวัตถุที่ย่อยสลายสมบูรณ์ และตรวจคุณภาพน้ำที่ใช้รดหากค่า pH สูงต่อเนื่อง",
      "ตรวจหาสาเหตุของความเป็นด่างก่อนใช้สารปรับสภาพดิน ไม่ควรเติมกรดหรือกำมะถันโดยไม่มีผลวิเคราะห์รองรับ"
    ];
    else advice = [
      "ดินด่างจัด: อาจทำให้เหล็ก สังกะสี แมงกานีส และฟอสฟอรัสบางส่วนอยู่ในรูปที่พืชดูดใช้ได้ยาก ส่งผลต่อการเจริญเติบโต",
      "ตรวจยืนยันค่า pH พร้อมประเมินความเค็มและโซเดียมแลกเปลี่ยน เพื่อแยกสาเหตุดินด่างก่อนเลือกวิธีปรับปรุง",
      "เพิ่มอินทรียวัตถุและจัดการน้ำกับการระบายน้ำให้เหมาะสม การใช้กำมะถันหรือยิปซัมต้องพิจารณาตามชนิดดินและผลวิเคราะห์ ไม่ใช่ใช้แทนกันได้ทุกกรณี",
      "ตรวจค่า pH ซ้ำหลังปรับปรุงดิน และเลือกพืชที่เหมาะกับสภาพดินระหว่างการฟื้นฟู"
    ];
    const nutrientNames = {N:"ไนโตรเจน (N)",P:"ฟอสฟอรัส (P)",K:"โพแทสเซียม (K)"};
    const low = Object.keys(nutrientNames).filter(k => {
      const value = Number(results[k]?.value);
      return results[k] && Number.isInteger(value) && value <= 1 && value >= 0;
    });
    if (low.length) advice.push(`ผลคัดกรองสีระบุว่า ${low.map(k=>nutrientNames[k]).join(" / ")} อยู่ในระดับต่ำตามเกณฑ์ต้นแบบ ควรตรวจยืนยันด้วยชุดทดสอบที่สอบเทียบแล้วก่อนกำหนดชนิดหรืออัตราปุ๋ย`);
    advice.push("หมายเหตุ: คำแนะนำนี้อ้างอิงค่า pH และระดับสี NPK เบื้องต้น ไม่ใช่ใบสั่งปุ๋ยหรือผลตรวจห้องปฏิบัติการ");
    return advice;
  }
  function renderAnalysis(a, by = {}) {
    if (!a || !a.available) return;
    node("soil-type").textContent=a.soil_type;
    node("soil-detail").textContent=`ภาพรวมธาตุอาหารอยู่ในระดับ${a.fertility} · ${a.method}`;
    node("fertility-label").textContent=a.fertility;
    node("nutrient-status").innerHTML=Object.entries(a.nutrients||{}).map(([k,v])=>`<span><b>${k}</b> ${v}</span>`).join("") || "ยังไม่มีหน่วย NPK ที่ผ่านการสอบเทียบ";
    const cropGroups = [
  { id: 1, names: ["ข้าว", "ข้าวโพด", "อ้อย"] },
  { id: 2, names: ["คะน้า", "กวางตุ้ง", "ผักบุ้งจีน"] },
  { id: 3, names: ["พริก", "มะเขือเทศ", "แตงกวา"] },
  { id: 4, names: ["ถั่วฝักยาว", "แตงกวา", "มะเขือเทศ"] },
  { id: 5, names: ["มันสำปะหลัง", "กล้วย", "อ้อย"] }
];

const allCrops = a.crops || [];

const rankedGroups = cropGroups.map(group => {
  const crops = group.names.map(name =>
    allCrops.find(crop => crop.name === name)
  ).filter(Boolean);

  const average = crops.length === group.names.length
    ? crops.reduce((sum, crop) => sum + Number(crop.score || 0), 0) / crops.length
    : -1;

  return { ...group, crops, average };
}).sort((a, b) => b.average - a.average || a.id - b.id);
    const ph = by.pH?.value;
    const recs = soilCareAdvice(ph, by);
    // ถ้าไม่มีค่า pH ให้ใช้คำแนะนำจากเซิร์ฟเวอร์แทน
    if (!recs.length) recs.push(...(a.recommendations || []));
    if (a.caution) recs.push(a.caution);
    node("soil-recommendations").innerHTML=recs.length ? recs.map(x=>`<li>${escapeHTML(x)}</li>`).join("") : "<li>ไม่พบธาตุอาหารที่อยู่ในระดับต่ำตามเกณฑ์ตัวอย่าง ควรติดตามผลตรวจเป็นระยะ</li>";
    node("crop-results").innerHTML = rankedGroups.some(g => g.crops.length)
  ? rankedGroups.map((group, groupIndex) => `
    <div class="crop-group-section">
      <h3 style="margin:24px 0 12px; grid-column:1/-1;">
        อันดับกลุ่ม ${groupIndex + 1} — กลุ่มที่ ${group.id}
        <small>
          (คะแนนเฉลี่ย ${
  group.average >= 0
    ? group.average.toFixed(1) + "%"
    : "ข้อมูลไม่ครบ"
})
        </small>
      </h3>

      <div class="crop-group-grid" style="
        display:grid;
        grid-template-columns:repeat(auto-fit,minmax(220px,1fr));
        gap:16px;
      ">
        ${group.crops.map((crop, index) => `
          <article class="crop-card">
            <div class="crop-card-top">
              <span class="crop-emoji">${cropIcons[crop.name] || "🌱"}</span>
              <span class="crop-rank">อันดับ ${index + 1} ในกลุ่ม</span>
            </div>

            <h3>${escapeHTML(crop.name)}</h3>
            <span class="crop-group">${escapeHTML(crop.group || `กลุ่มที่ ${group.id}`)}</span>

            <div class="crop-score">
              <b>${crop.score}%</b>
              <span>คะแนนเปรียบเทียบ</span>
            </div>

            <div class="crop-score-track">
              <i style="width:${Math.max(0, Math.min(100, Number(crop.score) || 0))}%"></i>
            </div>

            <p>${escapeHTML((crop.reasons || []).join(" · "))}</p>

            <details>
              <summary>รายละเอียดและวิธีปลูก</summary>
              <p>pH ที่เหมาะสม: ${crop.ph_range[0]}–${crop.ph_range[1]}</p>
              <p>
                ความต้องการ N: ${crop.needs.N[0]}–${crop.needs.N[1]} ·
                P: ${crop.needs.P[0]}–${crop.needs.P[1]} ·
                K: ${crop.needs.K[0]}–${crop.needs.K[1]}
                (เกณฑ์เปรียบเทียบ)
              </p>
              <p>${escapeHTML(crop.water)}</p>
              <p>${escapeHTML(crop.tip)}</p>
            </details>
          </article>
        `).join("")}
      </div>
    </div>
  `).join("")
  : '<div class="crop-empty">🧪<b>ยังไม่สามารถจัดอันดับพืชได้</b><span>ต้องมีข้อมูลคะแนนพืชก่อน</span></div>';
  }
  function escapeHTML(value) { return String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  // แสดงค่าเริ่มต้นเป็นศูนย์ทันทีเมื่อเปิดหน้า ก่อนรับข้อมูลจากกล้อง
  setEmpty();
  let refreshBusy=false;
  async function refreshDashboard() {
    if(refreshBusy) return;   // ไม่ยิงคำขอซ้อน: คำตอบเก่าจะไม่เขียนทับคำตอบใหม่
    refreshBusy=true;
    try {
      const data=await api("/api/data");
      updateMachineStatus(data);
      const by=Object.fromEntries((data.results||[]).map(item=>[item.type,item]));
      const available=keys.filter(k=>by[k]);
      // แสดงกรอบการ์ดทั้ง 4 ประเภทไว้ตลอดเวลา; แสดงเฉพาะตัวเลขของค่าที่เคยตรวจพบ
      keys.forEach(key=>{
        const card=document.querySelector(`[data-value="${key}"]`)?.closest(".nutrient-card");
        if(card) card.hidden = false;
      });
      // แสดงค่าที่กล้องอ่านได้ทันที แม้ยังไม่ครบทั้ง 4 ประเภท
      available.forEach(key=>{
        const item=by[key];
        const value=document.querySelector(`[data-value="${key}"]`);
        const meter=document.querySelector(`[data-meter="${key}"]`);
        const label=document.querySelector(`[data-color-label="${key}"]`);
        if (value) value.textContent = `${key}: ${formatSoilValue(key, item.value)}${key === "pH" && item.unit ? ` ${item.unit}` : ""}`;
        if(label) label.textContent=`${key!=="pH"?"ระดับ "+formatSoilValue(key,item.value)+" · ":""}${item.live || data.live ? "ล็อกแล้ว · " : "บันทึกแล้ว · "}${item.level || "ค่าประมาณ"} · ${item.color_hex || ""}`;
        const max=key==="pH"?14:Math.max(Number(item.value)*1.25,5);
        if(meter) meter.style.width=`${Math.max(0,Math.min(100,Number(item.value)/max*100))}%`;
      });
      node("scan-progress-text").textContent=`${available.length} / 4 ค่าที่อ่านได้`;
      node("scan-progress-bar").style.width=`${available.length/4*100}%`;
      if (advisorPanel) advisorPanel.hidden = !(data.device === "live-camera" && data.complete && keys.every(k => by[k]));
      if(data.complete && keys.every(k=>by[k])){
        node("soil-type").textContent="ประเมินค่าสีครบ 4 หลอดแล้ว";
        node("soil-detail").textContent="ค่าที่แสดงเป็นค่าประมาณจากสีที่กล้องอ่านได้";
        node("fertility-label").textContent="ค่าประมาณ";
        node("nutrient-status").textContent="NPK เป็นค่าประมาณจากสี โปรดสอบเทียบกับชุดน้ำยาจริงก่อนนำไปใช้งาน";
        node("soil-recommendations").innerHTML="<li>บันทึกผลครบ pH, N, P และ K แล้ว</li><li>ค่า NPK เป็นค่าต้นแบบ ยังไม่ใช่ผลแล็บที่ผ่านการสอบเทียบ</li>";
        try { renderAnalysis(data.analysis, by); } catch(analysisError) { console.error(analysisError); }
        node("read-state").textContent="COMPLETE 4/4 · บันทึกครบ 4 ค่าแล้ว ✓";
        node("read-state").className="status-pill done";
      } else if(data.live || available.length){
        node("soil-type").textContent="กำลังอ่านค่าจากกล้องแบบ LIVE";
        node("soil-detail").textContent="ค่าที่ตรวจพบจะถูกล็อกไว้จนกว่าจะกดปุ่มล้างค่า";
        node("fertility-label").textContent="กำลังอ่านค่า";
        node("nutrient-status").textContent=`อ่านได้แล้ว ${available.length}/4 ประเภท`;
        node("soil-recommendations").innerHTML="<li>ค่าที่แสดงเป็นค่าประมาณสดจากกล้อง</li><li>กล้องตรวจ pH, N, P, K ได้ทุกลำดับ และล็อกแต่ละชนิดเมื่อค่าอยู่ในช่วงที่แอดมินกำหนดต่อเนื่อง 3 วินาที (ครบทั้ง 4 ชนิดจึงถือว่าเสร็จ)</li>";
        node("read-state").textContent=`กำลังรับค่าจากกล้อง LIVE… ${available.length}/4 (เหลือ ${keys.filter(k=>!by[k]).join(", ")})`;
        node("read-state").className="status-pill waiting";
      } else {
        if(previousStamp) setEmpty();
        node("read-state").textContent="รอค่าจากกล้อง";
        node("read-state").className="status-pill waiting";
      }
      previousStamp=data.captured_at||"loaded";
    } catch(error) {
      if(error.message.includes("เข้าสู่ระบบ")) location.href="/";
      else { node("read-state").textContent="เชื่อมต่อเซิร์ฟเวอร์ไม่ได้"; setMachineStatus("ตรวจสอบสถานะไม่ได้"); }
    } finally {
      refreshBusy=false;
    }
  }
  const clearButton = $("#clear-results");
  if (clearButton) clearButton.addEventListener("click", async () => {
    if (!confirm("ต้องการล้างเฉพาะค่ากล้องที่แสดงอยู่หรือไม่? ประวัติผลตรวจที่บันทึกไว้จะไม่ถูกลบ")) return;
    clearButton.disabled = true;
    try {
      await api("/api/data/clear", {method:"POST", body:"{}"});
      previousStamp = null;
      setEmpty();
      // ขอข้อมูลใหม่ทันที และคงการ polling ต่อเนื่องเพื่อให้กล้องเริ่มรอบตรวจใหม่
      await new Promise(resolve => setTimeout(resolve, 650));
      await refreshDashboard();
      node("read-state").textContent = "ล้างค่ากล้องแล้ว · ประวัติเดิมยังอยู่ · รอผลตรวจใหม่";
      node("read-state").className = "status-pill waiting";
      await refreshHistory();
    } catch (error) {
      alert(error.message);
    } finally {
      clearButton.disabled = false;
    }
  });
  let historyCache=[];
  const openHistory=new Set();
  function whenParts(item){
    // เวลาจากกล้องเก็บเป็น UTC; รายการกรอกเองเก็บเป็นวันที่เฉยๆ
    const live=item.device==="live-camera";
    const raw=String(item.captured_at||"");
    const d=new Date(live && !/[zZ]|[+-]\d\d:?\d\d$/.test(raw) ? raw+"Z" : raw);
    if(isNaN(d)) return {date:escapeHTML(item.inspected_on||raw), time:""};
    const tz={timeZone:"Asia/Bangkok"};
    const date=d.toLocaleDateString("th-TH",{day:"numeric",month:"long",year:"numeric",...tz});
    const time=live?d.toLocaleTimeString("th-TH",{hour:"2-digit",minute:"2-digit",second:"2-digit",hour12:false,...tz})+" น.":"";
    return {date,time};
  }
  function whenText(item){const w=whenParts(item);return `${w.date}${w.time?" "+w.time:""}`;}
  function renderHistoryItem(item){
    const by=Object.fromEntries(item.results.map(x=>[x.type,x]));
    const a=item.analysis||{}, w=whenParts(item);
    const short=keys.map(k=>`${k} ${by[k]?(k==="pH"?by[k].value:`${by[k].value} (${formatSoilValue(k,by[k].value)})`):"—"}`).join("　");
    const rows=keys.map(k=>{
      const r=by[k]; if(!r) return `<div class="hist-val"><b>${k}</b><span>—</span></div>`;
      const dot=r.color_hex?`<i class="hist-dot" style="background:${escapeHTML(r.color_hex)}"></i>`:"";
      return `<div class="hist-val"><b>${k}</b><strong>${escapeHTML(r.value)}${k==="pH"&&r.unit?" "+escapeHTML(r.unit):""}${k!=="pH"?" ("+escapeHTML(formatSoilValue(k,r.value))+")":""}</strong><span>${escapeHTML(r.level||"")} ${dot}${escapeHTML(r.color_hex||"")}</span></div>`;
    }).join("");
    const crops=(a.crops||[]).length
      ? (a.crops||[]).map((c,i)=>`<li><span class="hist-rank">${i+1}</span><span class="hist-crop">${cropIcons[c.name]||"🌱"} <b>${escapeHTML(c.name)}</b> <small>${escapeHTML(c.group||"")}</small></span><span class="hist-score">${c.score}%</span></li>`).join("")
      : `<li>ยังไม่มีข้อมูลการแนะนำพืช</li>`;
    const advice=[...(a.recommendations||[])].map(x=>`<li>${escapeHTML(x)}</li>`).join("");
    const isOpen=openHistory.has(String(item.id))?" open":"";
    return `<details class="history-record" data-hid="${item.id}"${isOpen}>
      <summary><span class="hist-when"><b>📅 ${w.date}</b>${w.time?`<em>🕒 ${w.time}</em>`:""}</span><span class="hist-short">${escapeHTML(short)}</span><span class="hist-more">ดูรายละเอียด ▾</span></summary>
      <div class="hist-body">
        <h4>🧪 ค่าที่วัดได้</h4><div class="hist-vals">${rows}</div>
        <h4>🌾 ควรปลูกอะไร (เรียงตามความเหมาะสม)</h4><ol class="hist-crops">${crops}</ol>
        <p class="hist-soil"><b>สภาพดิน:</b> ${escapeHTML(a.soil_type||"ประเมินเบื้องต้น")} · <b>ความอุดมสมบูรณ์:</b> ${escapeHTML(a.fertility||"ยังประเมินไม่ได้")}</p>
        ${advice?`<ul class="hist-advice">${advice}</ul>`:""}
        <small>ค่าจากกล้องเป็นค่าประมาณ ควรสอบเทียบกับชุดน้ำยาจริงก่อนใช้ตัดสินใจ</small>
        <div class="hist-actions"><button class="btn btn-danger history-delete" type="button" data-delete-history="${item.id}">🗑️ ลบรายการนี้</button></div>
      </div></details>`;
  }
  async function refreshHistory(){
    try{
      const resp=await fetch("/api/history",{cache:"no-store"});
      if(resp.status===401){location.href="/";return;}
      const items=await resp.json(); historyCache=Array.isArray(items)?items:[]; node("history-count").textContent=historyCache.length;
      updateHistoryChart();
      const saveError=resp.headers.get("X-Autosave-Error");
      node("scan-history").innerHTML=historyCache.length?historyCache.map(renderHistoryItem).join(""):
        (saveError?`<p class="form-error">บันทึกอัตโนมัติไม่สำเร็จ: ${escapeHTML(saveError)}</p>`:"<p class=\"muted\">ยังไม่มีรายการที่บันทึก</p>");
    }catch(_){node("scan-history").textContent="โหลดประวัติไม่สำเร็จ";}
  }
  node("scan-history")?.addEventListener("toggle",ev=>{
    const d=ev.target.closest?.("details[data-hid]"); if(!d) return;
    d.open?openHistory.add(d.dataset.hid):openHistory.delete(d.dataset.hid);
  },true);
  node("scan-history")?.addEventListener("click",async ev=>{
    const btn=ev.target.closest("[data-delete-history]"); if(!btn) return;
    const id=btn.dataset.deleteHistory;
    if(!confirm("ยืนยันลบประวัติผลตรวจรายการนี้หรือไม่? รายการอื่นจะไม่ถูกลบ")) return;
    btn.disabled=true;
    try{await api(`/api/history/${id}`,{method:"DELETE"});await refreshHistory();}
    catch(err){alert(err.message);btn.disabled=false;}
  });
   // ---------- สถานะเครื่อง (ประเมินจากข้อมูลที่ API ส่งมา ไม่ใช่การยืนยันว่า Arduino ออนไลน์) ----------
   function setMachineStatus(message, detail="") {
     const status=document.getElementById("machine-status");
     const last=document.getElementById("machine-last-seen");
     if(status) status.textContent=message;
     if(last) last.textContent=detail;
   }
   function updateMachineStatus(data) {
     if(data.live) setMachineStatus("กำลังรับข้อมูลจากกล้อง", "ระบบรายงานว่ากำลังตรวจวัด");
     else if(data.complete) setMachineStatus("ตรวจวัดเสร็จแล้ว", "มีผลตรวจครบ 4 ค่า (ไม่ได้ยืนยันว่าเครื่องยังเชื่อมต่ออยู่)");
     else setMachineStatus("รอเริ่มตรวจ", "ยังไม่มีสัญญาณยืนยันการเชื่อมต่อ Arduino โดยตรง");
   }

   // ---------- กราฟประวัติของบัญชีที่เข้าสู่ระบบ ----------
   let soilChart=null;
   function historyRows() {
     return historyCache.map(item=>{
       const values=Object.fromEntries((item.results||[]).map(r=>[r.type, Number(r.value)]));
       return {date:whenText(item), pH:values.pH, N:values.N, P:values.P, K:values.K};
     }).reverse();
   }
   function updateHistoryChart() {
     const canvas=document.getElementById("soil-history-chart");
     const status=document.getElementById("chart-status");
     if(!canvas) return;
     if(typeof Chart==="undefined") {
       if(status) status.textContent="ไม่สามารถโหลดไลบรารีกราฟได้ กรุณาตรวจสอบอินเทอร์เน็ต";
       return;
     }
     const rows=historyRows().slice(-20);
     if(soilChart) {soilChart.destroy();soilChart=null;}
     if(!rows.length) {if(status) status.textContent="ยังไม่มีประวัติผลตรวจ";return;}
     const colors={pH:"#2563eb",N:"#16a34a",P:"#d97706",K:"#9333ea"};
     soilChart=new Chart(canvas,{
       type:"line",
       data:{labels:rows.map((r,i)=>`${i+1}. ${r.date}`),datasets:["pH","N","P","K"].map(k=>({
         label:k,data:rows.map(r=>Number.isFinite(r[k])?r[k]:null),borderColor:colors[k],
         backgroundColor:colors[k],tension:0.25,spanGaps:false
       }))},
       options:{responsive:true,maintainAspectRatio:false,interaction:{mode:"index",intersect:false},
         plugins:{legend:{position:"bottom"}},scales:{y:{beginAtZero:true}}}
     });
     if(status) status.textContent=`แสดง ${rows.length} รายการล่าสุด · NPK เป็นค่าประมาณจากสีหากยังไม่สอบเทียบ`;
   }

   // ---------- ส่งออกข้อมูลเฉพาะประวัติที่ API คืนให้บัญชีนี้ ----------
   const exportColumns=["วันที่และเวลา","pH","N","ระดับ N","P","ระดับ P","K","ระดับ K"];
   function exportRows() {
     return historyRows().map(r=>[r.date,Number.isFinite(r.pH)?r.pH:"",... ["N","P","K"].flatMap(k=>Number.isFinite(r[k])?[r[k],formatSoilValue(k,r[k])]:["",""])]);
   }
   document.getElementById("download-excel")?.addEventListener("click",()=>{
     const rows=exportRows();
     if(!rows.length) {alert("ยังไม่มีประวัติผลตรวจให้ดาวน์โหลด");return;}
     if(typeof XLSX==="undefined") {alert("โหลดไลบรารี Excel ไม่สำเร็จ กรุณาตรวจสอบอินเทอร์เน็ต");return;}
     const sheet=XLSX.utils.aoa_to_sheet([exportColumns,...rows]);
     sheet["!cols"]=[{wch:35},{wch:12},{wch:12},{wch:15},{wch:12},{wch:15},{wch:12},{wch:15}];
     const book=XLSX.utils.book_new();XLSX.utils.book_append_sheet(book,sheet,"ประวัติผลตรวจ");
     XLSX.writeFile(book,"mineral-sense-ai-history.xlsx");
   });
   document.getElementById("download-pdf")?.addEventListener("click",()=>{
     const rows=exportRows();
     if(!rows.length) {alert("ยังไม่มีประวัติผลตรวจให้ดาวน์โหลด");return;}
     const popup=window.open("","_blank");
     if(!popup) {alert("โปรดอนุญาตป๊อปอัปเพื่อพิมพ์หรือบันทึก PDF");return;}
     const cells=rows.map(row=>"<tr>"+row.map(v=>`<td>${escapeHTML(v)}</td>`).join("")+"</tr>").join("");
     popup.document.write(`<!doctype html><html lang="th"><head><meta charset="utf-8"><title>รายงาน Mineral Sense AI</title><style>body{font-family:Arial,sans-serif;padding:25px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #aaa;padding:7px;text-align:left}th{background:#eee}small{color:#555}@media print{button{display:none}}</style></head><body><h2>รายงานประวัติผลวิเคราะห์ดิน — Mineral Sense AI</h2><small>ข้อมูล NPK อาจเป็นค่าประมาณจากการอ่านสี ยังไม่ใช่ผลแล็บที่ผ่านการสอบเทียบ</small><table><thead><tr>${exportColumns.map(c=>`<th>${c}</th>`).join("")}</tr></thead><tbody>${cells}</tbody></table><p><button onclick="window.print()">พิมพ์ / บันทึกเป็น PDF</button></p></body></html>`);
     popup.document.close();
   });

  setEmpty();
  refreshDashboard();refreshHistory();setInterval(refreshDashboard,5000);setInterval(refreshHistory,30000);
}

// ---------- ช่วงค่าประมาณ (แสดงในหน้าบัญชี) ----------
if (document.querySelector(".standard-grid")) {
  api("/api/standards").then(d=>{
    const r=d.accepted_ranges||{};
    ["pH","N","P","K"].forEach((k,i)=>{
      const box=document.querySelectorAll(".standard-grid > div")[i];
      if(box && r[k]) box.querySelector("strong").textContent=`${Number(r[k][0]).toFixed(k==="pH"?2:0)}–${Number(r[k][1]).toFixed(k==="pH"?2:0)}`;
    });
  }).catch(()=>{});
}

// ---------- ปุ่มแสดง/ซ่อนรหัสผ่าน ----------
document.querySelectorAll('input[type="password"]').forEach((input)=>{
  const wrap=document.createElement("span"); wrap.className="pw-wrap";
  input.parentNode.insertBefore(wrap,input); wrap.appendChild(input);
  const btn=document.createElement("button"); btn.type="button"; btn.className="pw-toggle";
  btn.setAttribute("aria-label","แสดงรหัสผ่าน"); btn.textContent="👁️ แสดง";
  btn.addEventListener("click",()=>{
    const show=input.type==="password"; input.type=show?"text":"password";
    btn.textContent=show?"🙈 ซ่อน":"👁️ แสดง"; btn.setAttribute("aria-label",show?"ซ่อนรหัสผ่าน":"แสดงรหัสผ่าน");
  });
  wrap.appendChild(btn);
});

// ---------- แก้ไขโปรไฟล์ ----------
const profileForm=$("#profile-form");
if (profileForm) {
  const avatars=["🌻","🌱","🌾","🌽","🍅","🥬","🍌","🥭","👩‍🌾","👨‍🌾","🐛","🦋"];
  const picker=$("#avatar-picker"), avatarInput=$("#avatar-input");
  const removeBtn=$("#avatar-remove-btn"), fileInput=$("#avatar-file");
  function pickAvatar(value){
    avatarInput.value=value;
    renderAvatar($("#profile-avatar"),value); renderAvatar($("#avatar-preview"),value);
    picker.querySelectorAll("button").forEach(b=>b.classList.toggle("active",b.dataset.avatar===value));
    removeBtn.hidden=!String(value).startsWith("data:image/");
  }
  // ย่อ/ครอปรูปเป็นสี่เหลี่ยมจัตุรัส 256x256 แล้วบีบเป็น JPEG ก่อนส่ง (ไฟล์เล็กและเร็ว)
  function resizeImage(file,size=256){
    return new Promise((resolve,reject)=>{
      if(!file.type.startsWith("image/")) return reject(new Error("กรุณาเลือกไฟล์รูปภาพ"));
      if(file.size>15*1024*1024) return reject(new Error("ไฟล์ใหญ่เกิน 15 MB"));
      const url=URL.createObjectURL(file), img=new Image();
      img.onload=()=>{
        const side=Math.min(img.width,img.height), canvas=document.createElement("canvas");
        canvas.width=canvas.height=size;
        const ctx=canvas.getContext("2d");
        ctx.fillStyle="#fff"; ctx.fillRect(0,0,size,size);
        ctx.drawImage(img,(img.width-side)/2,(img.height-side)/2,side,side,0,0,size,size);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL("image/jpeg",0.85));
      };
      img.onerror=()=>{URL.revokeObjectURL(url);reject(new Error("เปิดรูปนี้ไม่ได้ ลองไฟล์ JPG หรือ PNG"));};
      img.src=url;
    });
  }
  $("#avatar-upload-btn").addEventListener("click",()=>fileInput.click());
  fileInput.addEventListener("change",async()=>{
    const msg=$("#profile-msg"); msg.style.color=""; msg.textContent="";
    const file=fileInput.files[0]; fileInput.value="";
    if(!file) return;
    try{ pickAvatar(await resizeImage(file)); msg.style.color="#278a32"; msg.textContent="เลือกรูปแล้ว กด “บันทึกโปรไฟล์” เพื่อยืนยัน"; }
    catch(error){ msg.textContent=error.message; }
  });
  removeBtn.addEventListener("click",()=>pickAvatar(avatars[0]));
  $("#edit-name-shortcut")?.addEventListener("click",()=>{ $("#profile-form").scrollIntoView({behavior:"smooth",block:"center"}); setTimeout(()=>$("#edit-name").focus(),300); });
  avatars.forEach(a=>{
    const b=document.createElement("button"); b.type="button"; b.dataset.avatar=a; b.textContent=a;
    b.addEventListener("click",()=>pickAvatar(a)); picker.appendChild(b);
  });
  api("/api/me").then(u=>{
    $("#edit-name").value=u.display_name||""; $("#edit-email").value=u.email||"";
    pickAvatar(u.avatar||avatars[0]);
  }).catch(()=>{});
  profileForm.addEventListener("submit",async(event)=>{
    event.preventDefault();
    const msg=$("#profile-msg"); msg.style.color=""; msg.textContent="";
    try{
      const u=await api("/api/profile",{method:"POST",body:JSON.stringify(Object.fromEntries(new FormData(profileForm).entries()))});
      $("#profile-name").textContent=u.display_name; $("#profile-email").textContent=u.email||"-";
      renderAvatar($("#profile-avatar"),u.avatar);
      msg.style.color="#278a32"; msg.textContent="บันทึกโปรไฟล์เรียบร้อยแล้ว ✓";
    }catch(error){ msg.textContent=error.message; }
  });
}
