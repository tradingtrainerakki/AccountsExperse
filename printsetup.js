// ============================================================================
// printsetup.js  —  (1) Multi-Bank Details section in Company/Trust Alteration (F3)
//                   (2) Tally-style "Print Setup" checklist (Company / Ledger / Group / Day Book)
// Load order: index.html me keyboard.js ke BAAD (sabse last) lagayein.
// ============================================================================
(function () {
  "use strict";

  // --------------------------------------------------------------------------
  // 0. DEFAULTS  (true = print me aayega)
  // --------------------------------------------------------------------------
  const PRINT_DEFAULTS = {
    company: { address: true, phone: true, email: true, website: false, regNo: true, pan: true, gstin: true,
               reg12A: false, reg80G: false, bankMode: "none", sign: true,
               qrCaption: "Scan to Pay via UPI", qrSize: "medium", qrPos: "right", qrShowId: true },
    ledger:  { ledgerName: true, period: true, partyAddr: false, partyGstin: false, opening: true,
               vchType: true, vchNo: true, narration: true, totals: true, closing: true, printDate: false, pageNo: true, qr: false },
    group:   { title: true, period: true, serial: true, grpCol: true, opening: true, periodDrCr: true,
               closing: true, totals: true, printDate: false, pageNo: true, qr: false },
    daybook: { title: true, period: true, serial: true, vchType: true, vchNo: true, party: true,
               narration: true, amount: true, totals: true, printDate: false, pageNo: true, qr: false },
    voucher: { "qr_Receipt": true, "qr_Sales": true, "qr_Payment": false, "qr_Journal": false, "qr_Contra": false,
               "qr_Purchase": false, "qr_Credit Note": false, "qr_Debit Note": false }
  };

  const SECTIONS = [
    { key: "company", icon: "🏢", title: "Company / Trust Section (har print ke upar header me)", items: [
      ["address", "Address (Line 1, 2, City, State, Pin)"],
      ["phone", "Phone"], ["email", "Email"], ["website", "Website"],
      ["regNo", "Registration No."], ["pan", "PAN"], ["gstin", "GSTIN"],
      ["reg12A", "12A No."], ["reg80G", "80G No."],
      ["sign", "Authorised Signatory (For ... / Sign) neeche"]
    ], bank: true, qrExtra: true },
    { key: "ledger", icon: "📒", title: "Ledger (Alt+L)", items: [
      ["ledgerName", "Ledger Name"], ["period", "Period line"],
      ["partyAddr", "Party Address"], ["partyGstin", "Party GSTIN"],
      ["opening", "Opening Balance row"], ["vchType", "Vch Type column"], ["vchNo", "Vch No. column"],
      ["narration", "Narration (screen par Narration ✔ ho tab)"],
      ["totals", "Current Total row"], ["closing", "Closing Balance + Grand Total"],
      ["printDate", "Print Date & Time"], ["pageNo", "Page No. (Page 1 of N)"],
      ["qr", "📲 UPI QR Scanner (neeche)"]
    ] },
    { key: "group", icon: "📂", title: "Group Summary (Alt+U)", items: [
      ["title", "Group Name (title)"], ["period", "Period line"], ["serial", "# (Serial No.)"],
      ["grpCol", "Group column"], ["opening", "Opening column"], ["periodDrCr", "Period Dr / Cr columns"],
      ["closing", "Closing Dr / Cr columns"], ["totals", "Total row"],
      ["printDate", "Print Date & Time"], ["pageNo", "Page No. (Page 1 of N)"],
      ["qr", "📲 UPI QR Scanner (neeche)"]
    ] },
    { key: "daybook", icon: "📖", title: "Day Book (Alt+D)", items: [
      ["title", "Report Title"], ["period", "Period line"], ["serial", "# (Serial No.)"],
      ["vchType", "Type column"], ["vchNo", "Vch No column"], ["party", "Particulars / Party"],
      ["narration", "Narration column"], ["amount", "Amount column"], ["totals", "Total row"],
      ["printDate", "Print Date & Time"], ["pageNo", "Page No. (Page 1 of N)"],
      ["qr", "📲 UPI QR Scanner (neeche)"]
    ] },
    { key: "voucher", icon: "🧾", title: "Voucher / Receipt par UPI QR (voucher screen se Alt+P)", items: [
      ["qr_Receipt", "Receipt"], ["qr_Sales", "Sales"], ["qr_Payment", "Payment"], ["qr_Journal", "Journal"],
      ["qr_Contra", "Contra"], ["qr_Purchase", "Purchase"], ["qr_Credit Note", "Credit Note"], ["qr_Debit Note", "Debit Note"]
    ] }
  ];

  function getCfg() {
    const saved = (typeof DB !== "undefined" && DB && DB.company && DB.company.printCfg) || {};
    const out = {};
    Object.keys(PRINT_DEFAULTS).forEach(k => { out[k] = Object.assign({}, PRINT_DEFAULTS[k], saved[k] || {}); });
    return out;
  }

  // --------------------------------------------------------------------------
  // 1. BANK DETAILS  (DB.company.banks = [{id, bankName, accNo, ifsc, address, isDefault}])
  // --------------------------------------------------------------------------
  function getBanks() {
    const c = (DB && DB.company) || {};
    let banks = Array.isArray(c.banks) ? c.banks.slice() : [];
    // purana single "Bank Account" field ho to use pehla bank bana do
    if (!banks.length && c.bankAccount) {
      banks = [{ id: "B_legacy", bankName: "", accNo: c.bankAccount, ifsc: "", address: "", isDefault: true }];
    }
    return banks;
  }

  function bankRowHtml(b) {
    const e = escHtml;
    return `
      <div class="ca-bank-row" data-bid="${e(b.id || "")}" style="border:1px solid #e2e8f0;border-radius:4px;padding:8px;margin-bottom:8px;background:#f8fafc;">
        <div class="form-grid" style="grid-template-columns:1.2fr 1.2fr 1fr;gap:8px;margin-bottom:6px;">
          <div class="field"><label>Bank Name</label><input class="cb-name" value="${e(b.bankName || "")}" placeholder="e.g. Bank of India"></div>
          <div class="field"><label>Account Number</label><input class="cb-acc" value="${e(b.accNo || "")}" placeholder="e.g. 721110210000007"></div>
          <div class="field"><label>IFSC Code</label><input class="cb-ifsc" maxlength="11" value="${e(b.ifsc || "")}" placeholder="e.g. BKID0007211"></div>
        </div>
        <div style="display:flex;gap:10px;align-items:flex-end;">
          <div class="field" style="flex:1;"><label>Branch / Address</label><input class="cb-addr" value="${e(b.address || "")}" placeholder="e.g. Roorkee Main Branch, Haridwar Road"></div>
          <label style="font-size:12px;display:flex;align-items:center;gap:4px;white-space:nowrap;cursor:pointer;">
            <input type="radio" name="caBankDef" class="cb-def" ${b.isDefault ? "checked" : ""}> Default
          </label>
          <button type="button" class="btn btn-danger" style="padding:4px 9px;font-size:11.5px;" onclick="window._caRemoveBank(this)">✕ Remove</button>
        </div>
      </div>`;
  }

  window._caAddBank = function (noFocus) {
    const list = document.getElementById("caBankList");
    if (!list) return;
    const hasAny = list.querySelector(".ca-bank-row");
    const wrap = document.createElement("div");
    wrap.innerHTML = bankRowHtml({ id: uid("B"), isDefault: !hasAny });
    const row = wrap.firstElementChild;
    list.appendChild(row);
    if (noFocus !== true) {
      row.querySelector(".cb-name")?.focus();
      row.scrollIntoView({ block: "nearest" });
    }
  };

  window._caRemoveBank = function (btn) {
    const row = btn.closest(".ca-bank-row");
    if (row) row.remove();
    const list = document.getElementById("caBankList");
    if (list && !list.querySelector(".cb-def:checked")) {
      const first = list.querySelector(".cb-def");
      if (first) first.checked = true;
    }
  };

  function injectBankSection() {
    const body = document.getElementById("modalBody");
    const scroller = body && body.firstElementChild;
    if (!scroller || document.getElementById("caBankList")) return;

    // Purana single "Bank Account" box chhupa do (value hidden input me rahegi)
    const old = document.getElementById("caBankAcc");
    if (old) {
      const f = old.closest(".field");
      old.type = "hidden";
      if (f) f.style.display = "none";
    }

    const heads = Array.from(scroller.children).filter(el => el.children.length === 0 && /Address\s*&\s*Contact/i.test(el.textContent || ""));
    const anchor = heads[0] || null;

    const banks = getBanks();
    const sec = document.createElement("div");
    sec.style.marginBottom = "12px";
    sec.innerHTML = `
      <div style="font-size:11px;font-weight:800;color:var(--pri);text-transform:uppercase;border-bottom:1px solid #e2e8f0;padding-bottom:3px;margin-bottom:8px;">🏦 Bank Details</div>
      <div id="caBankList">${banks.map(bankRowHtml).join("")}</div>
      <button type="button" class="btn btn-sec" style="padding:4px 10px;font-size:12px;" onclick="window._caAddBank()">➕ Add Another Bank</button>`;
    if (anchor) scroller.insertBefore(sec, anchor); else scroller.appendChild(sec);

    // ---- UPI QR section ----
    window._caQrData = (DB.company && DB.company.upiQr) || "";
    window._caQrAuto = !!(DB.company && DB.company.upiQrAuto);
    const qsec = document.createElement("div");
    qsec.style.marginBottom = "12px";
    qsec.innerHTML = `
      <div style="font-size:11px;font-weight:800;color:var(--pri);text-transform:uppercase;border-bottom:1px solid #e2e8f0;padding-bottom:3px;margin-bottom:8px;">📲 UPI QR Scanner (Print ke liye)</div>
      <div style="display:flex;gap:12px;align-items:flex-start;">
        <div style="width:110px;height:110px;border:1px dashed #94a3b8;border-radius:4px;display:flex;align-items:center;justify-content:center;background:#f8fafc;overflow:hidden;">
          <img id="caQrPreview" alt="" style="max-width:100%;max-height:100%;${window._caQrData ? "" : "display:none;"}" src="${window._caQrData ? escHtml(window._caQrData) : ""}">
          <span id="caQrEmpty" style="font-size:11px;color:#64748b;text-align:center;${window._caQrData ? "display:none;" : ""}">QR nahi<br>laga hai</span>
        </div>
        <div style="flex:1;">
          <div class="field" style="margin-bottom:6px;"><label>UPI ID (isi se QR khud ban jayega)</label><input id="caUpiId" value="${escHtml((DB.company && DB.company.upiId) || "")}" placeholder="e.g. sanrakshan@sbi"></div>
          <div style="display:flex;gap:8px;margin-bottom:8px;flex-wrap:wrap;">
            <button type="button" class="btn" style="padding:3px 10px;font-size:11.5px;" onclick="window._caQrMake()">⚡ UPI ID se QR Banao</button>
            <button type="button" class="btn btn-danger" style="padding:3px 9px;font-size:11.5px;" onclick="window._caQrClear()">✕ QR Hatayein</button>
          </div>
          <div class="field" style="margin-bottom:0;"><label>Ya apni QR ki photo lagayein (PNG / JPG)</label><input type="file" id="caQrFile" accept="image/*"></div>
        </div>
      </div>`;
    if (anchor) scroller.insertBefore(qsec, anchor); else scroller.appendChild(qsec);
    const fileInp = document.getElementById("caQrFile");
    if (fileInp) fileInp.addEventListener("change", () => window._caQrLoad(fileInp.files && fileInp.files[0]));

    // koi bank nahi hai to ek khali row de do
    if (!banks.length) window._caAddBank(true);
  }

  // UPI ID se QR khud banata hai (qrcode.js library chahiye)
  function makeUpiQr(upiId, name) {
    if (typeof qrcode !== "function") return "";
    const vpa = String(upiId || "").trim();
    if (!/^[A-Za-z0-9._-]{2,}@[A-Za-z0-9.-]{2,}$/.test(vpa)) return "";
    const url = "upi://pay?pa=" + encodeURIComponent(vpa).replace(/%40/g, "@") +
                "&pn=" + encodeURIComponent(String(name || "").trim()) + "&cu=INR";
    try {
      const qr = qrcode(0, "M");
      qr.addData(url);
      qr.make();
      return qr.createDataURL(8, 4);
    } catch (e) { return ""; }
  }

  window._caQrAuto = false;

  window._caQrMake = function () {
    if (typeof qrcode !== "function") { toast("⚠ qrcode.js file jodi nahi gayi (index.html me script lagayein)"); return; }
    const upi = ((document.getElementById("caUpiId") || {}).value || "").trim();
    const nm = ((document.getElementById("caName") || {}).value || (DB.company && DB.company.name) || "").trim();
    const out = makeUpiQr(upi, nm);
    if (!out) { toast("⚠ Pehle sahi UPI ID likhein (jaise name@sbi)"); return; }
    window._caQrData = out;
    window._caQrAuto = true;
    _setQrPreview(out);
    toast("✅ QR ban gaya — Save (Ctrl+A) dabayein");
  };

  function _setQrPreview(src) {
    const img = document.getElementById("caQrPreview"), emp = document.getElementById("caQrEmpty");
    if (img) { img.src = src || ""; img.style.display = src ? "" : "none"; }
    if (emp) emp.style.display = src ? "none" : "";
  }

  window._caQrClear = function () {
    window._caQrData = "";
    window._caQrAuto = false;
    const f = document.getElementById("caQrFile"); if (f) f.value = "";
    _setQrPreview("");
  };

  // photo ko chhota karke (max 320px) save karte hain, taaki DB bhari na ho
  window._caQrLoad = function (file) {
    if (!file) return;
    if (!/^image\//.test(file.type)) { toast("⚠ Sirf image (PNG/JPG) chunein"); return; }
    const fr = new FileReader();
    fr.onerror = () => toast("⚠ Photo padh nahi paaye");
    fr.onload = () => {
      const im = new Image();
      im.onerror = () => toast("⚠ Photo kharab hai ya khul nahi rahi");
      im.onload = () => {
        const max = 320, sc = Math.min(1, max / Math.max(im.width, im.height));
        const cv = document.createElement("canvas");
        cv.width = Math.max(1, Math.round(im.width * sc));
        cv.height = Math.max(1, Math.round(im.height * sc));
        const cx = cv.getContext("2d");
        cx.fillStyle = "#fff"; cx.fillRect(0, 0, cv.width, cv.height);
        cx.drawImage(im, 0, 0, cv.width, cv.height);
        let out = cv.toDataURL("image/png");
        if (out.length > 150000) out = cv.toDataURL("image/jpeg", 0.92);
        window._caQrData = out;
        window._caQrAuto = false;
        _setQrPreview(out);
        toast("✅ QR laga diya — Save (Ctrl+A) dabayein");
      };
      im.src = fr.result;
    };
    fr.readAsDataURL(file);
  };

  function collectBanks() {
    const rows = Array.from(document.querySelectorAll("#caBankList .ca-bank-row"));
    const banks = [];
    let bad = "";
    rows.forEach((r, i) => {
      const g = s => ((r.querySelector(s) || {}).value || "").trim();
      const b = {
        id: r.dataset.bid || uid("B"),
        bankName: g(".cb-name"), accNo: g(".cb-acc"),
        ifsc: g(".cb-ifsc").toUpperCase(), address: g(".cb-addr"),
        isDefault: !!(r.querySelector(".cb-def") || {}).checked
      };
      if (!b.bankName && !b.accNo && !b.ifsc && !b.address) return; // khali row ignore
      if (b.ifsc && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(b.ifsc)) {
        bad = bad || `Bank ${i + 1} ka IFSC galat hai (4 letters + 0 + 6 akshar/number)`;
      }
      banks.push(b);
    });
    if (banks.length && !banks.some(b => b.isDefault)) banks[0].isDefault = true;
    return { banks, bad };
  }

  // openCompanyAlterModal / saveCompanyAlter ko wrap karte hain (core.js ko chhuye bina)
  const _origOpen = window.openCompanyAlterModal;
  if (typeof _origOpen === "function") {
    window.openCompanyAlterModal = function () {
      const r = _origOpen.apply(this, arguments);
      if (document.getElementById("caEntityType")) injectBankSection();
      return r;
    };
  }

  const _origSave = window.saveCompanyAlter;
  if (typeof _origSave === "function") {
    window.saveCompanyAlter = function () {
      if (document.getElementById("caBankList")) {
        const { banks, bad } = collectBanks();
        if (bad) { toast("⚠ " + bad); return; }
        DB.company.banks = banks;
        const def = banks.find(b => b.isDefault) || banks[0];
        const hid = document.getElementById("caBankAcc");
        if (hid) hid.value = def ? def.accNo : "";
      }
      if (document.getElementById("caQrFile")) {
        const upi = ((document.getElementById("caUpiId") || {}).value || "").trim();
        const nm = ((document.getElementById("caName") || {}).value || "").trim();
        let data = window._caQrData || "", auto = !!window._caQrAuto;
        // UPI ID bhari hai aur QR nahi laga (ya pehle wala khud bana tha) -> naya khud bana do
        if (upi && (auto || !data)) {
          const g = makeUpiQr(upi, nm);
          if (g) { data = g; auto = true; }
        }
        DB.company.upiQr = data;
        DB.company.upiQrAuto = auto;
        DB.company.upiId = upi;
      }
      return _origSave.apply(this, arguments);
    };
  }

  // --------------------------------------------------------------------------
  // 2. PRINT SETUP  (checklist modal)
  // --------------------------------------------------------------------------
  window.openPrintSetupModal = function () {
    const cfg = getCfg();
    const secHtml = SECTIONS.map(s => {
      const boxes = s.items.map(([k, label]) => `
        <label style="display:flex;gap:6px;align-items:center;font-size:12.5px;cursor:pointer;">
          <input type="checkbox" data-sec="${s.key}" data-key="${k}" ${cfg[s.key][k] ? "checked" : ""}> ${escHtml(label)}
        </label>`).join("");
      const bankSel = s.bank ? `
        <div style="margin-top:8px;display:flex;gap:8px;align-items:center;font-size:12.5px;">
          <b>🏦 Bank Details:</b>
          <select id="pcBankMode" style="padding:3px 6px;">
            <option value="none" ${cfg.company.bankMode === "none" ? "selected" : ""}>Print me na dikhayein</option>
            <option value="default" ${cfg.company.bankMode === "default" ? "selected" : ""}>Sirf Default Bank</option>
            <option value="all" ${cfg.company.bankMode === "all" ? "selected" : ""}>Sabhi Banks</option>
          </select>
        </div>` : "";
      const qrEx = s.qrExtra ? `
        <div style="margin-top:10px;padding:8px;border:1px dashed #cbd5e1;border-radius:4px;background:#f8fafc;font-size:12.5px;">
          <b>📲 UPI QR Scanner ki setting</b> <span style="color:#64748b;">(QR photo F3 me upload hoti hai)</span>
          <div style="display:grid;grid-template-columns:2fr 1fr 1fr;gap:8px;margin-top:6px;">
            <div class="field"><label>QR ke neeche likha text</label><input id="pcQrCaption" value="${escHtml(cfg.company.qrCaption || "")}"></div>
            <div class="field"><label>Size</label><select id="pcQrSize">
              <option value="small" ${cfg.company.qrSize === "small" ? "selected" : ""}>Chhota</option>
              <option value="medium" ${cfg.company.qrSize === "medium" ? "selected" : ""}>Medium</option>
              <option value="large" ${cfg.company.qrSize === "large" ? "selected" : ""}>Bada</option></select></div>
            <div class="field"><label>Jagah</label><select id="pcQrPos">
              <option value="right" ${cfg.company.qrPos === "right" ? "selected" : ""}>Neeche Right</option>
              <option value="left" ${cfg.company.qrPos === "left" ? "selected" : ""}>Neeche Left</option>
              <option value="center" ${cfg.company.qrPos === "center" ? "selected" : ""}>Neeche Beech me</option></select></div>
          </div>
          <label style="display:flex;gap:6px;align-items:center;margin-top:6px;cursor:pointer;">
            <input type="checkbox" id="pcQrShowId" ${cfg.company.qrShowId ? "checked" : ""}> QR ke saath UPI ID bhi likhein
          </label>
        </div>` : "";
      return `
        <div style="margin-bottom:14px;">
          <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #e2e8f0;padding-bottom:3px;margin-bottom:8px;">
            <span style="font-size:11.5px;font-weight:800;color:var(--pri);text-transform:uppercase;">${s.icon} ${escHtml(s.title)}</span>
            <span style="font-size:11px;">
              <a href="#" onclick="window._psToggle('${s.key}',true);return false;">Sab chuno</a> |
              <a href="#" onclick="window._psToggle('${s.key}',false);return false;">Sab hatao</a>
            </span>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px 16px;">${boxes}</div>
          ${bankSel}${qrEx}
        </div>`;
    }).join("");

    const body = `<div style="max-height:66vh;overflow-y:auto;padding-right:6px;">
      <div style="font-size:12px;color:#475569;margin-bottom:10px;">✔ Jo tick hoga wahi Print me aayega (Alt+P par). Sirf us report par lagega jiska section hai.</div>
      ${secHtml}</div>`;
    const foot = `<button class="btn btn-sec" onclick="closeModal()">Cancel</button><button class="btn" onclick="window.savePrintSetup()">Save (Ctrl+A)</button>`;
    showModal("🖨️ Print Setup — Kya kya Print me chahiye", body, foot);
  };

  window._psToggle = function (sec, val) {
    document.querySelectorAll(`#modalBody input[data-sec="${sec}"]`).forEach(cb => { cb.checked = val; });
  };

  window.savePrintSetup = function () {
    const cfg = {};
    document.querySelectorAll("#modalBody input[data-sec]").forEach(cb => {
      (cfg[cb.dataset.sec] = cfg[cb.dataset.sec] || {})[cb.dataset.key] = cb.checked;
    });
    cfg.company = cfg.company || {};
    cfg.company.bankMode = (document.getElementById("pcBankMode") || {}).value || "none";
    cfg.company.qrCaption = ((document.getElementById("pcQrCaption") || {}).value || "").trim();
    cfg.company.qrSize = (document.getElementById("pcQrSize") || {}).value || "medium";
    cfg.company.qrPos = (document.getElementById("pcQrPos") || {}).value || "right";
    cfg.company.qrShowId = !!(document.getElementById("pcQrShowId") || {}).checked;
    DB.company.printCfg = cfg;
    if (typeof canWriteData === "function" && !canWriteData()) {
      toast("ℹ Sirf is session ke liye lagega (Viewer save nahi kar sakta)");
    } else {
      saveDB();
      toast("✅ Print Setup Save Ho Gaya!");
    }
    closeModal();
  };

  // Right bar me "Print Setup" button
  (function addButton() {
    const pb = document.querySelector(".right-bar .fn-print");
    if (!pb || document.getElementById("fnPrintSetup")) return;
    const b = document.createElement("button");
    b.id = "fnPrintSetup";
    b.className = "fn-btn";
    b.onclick = () => window.openPrintSetupModal();
    b.innerHTML = '<span class="fn-key">Setup</span><span>⚙️ Print Setup</span>';
    pb.insertAdjacentElement("afterend", b);
  })();

  // --------------------------------------------------------------------------
  // 3. PRINT ENGINE  (smartPrint ko replace karta hai)
  // --------------------------------------------------------------------------
  function companyHeaderHtml(cc) {
    const c = DB.company || {};
    const e = escHtml;
    const lines = [];

    if (cc.address) {
      const a = [c.address, c.address2, c.city, c.state, c.pincode ? "- " + c.pincode : ""].filter(Boolean).join(", ");
      if (a) lines.push(`<div style="font-size:11px;margin-top:2px;">${e(a)}</div>`);
    }
    const contact = [];
    if (cc.phone && c.phone) contact.push("Ph: " + c.phone);
    if (cc.email && c.email) contact.push("Email: " + c.email);
    if (cc.website && c.website) contact.push("Web: " + c.website);
    if (contact.length) lines.push(`<div style="font-size:10.5px;margin-top:2px;">${e(contact.join(" | "))}</div>`);

    const reg = [];
    if (cc.regNo && c.regNo) reg.push("Reg. No: " + c.regNo);
    if (cc.pan && c.pan) reg.push("PAN: " + c.pan);
    if (cc.gstin && c.gstin) reg.push("GSTIN: " + c.gstin);
    if (cc.reg12A && c.reg12A) reg.push("12A: " + c.reg12A);
    if (cc.reg80G && c.reg80G) reg.push("80G: " + c.reg80G);
    if (reg.length) lines.push(`<div style="font-size:10.5px;font-weight:700;margin-top:2px;">${e(reg.join(" | "))}</div>`);

    if (cc.bankMode && cc.bankMode !== "none") {
      let banks = getBanks();
      if (cc.bankMode === "default") { const d = banks.find(b => b.isDefault) || banks[0]; banks = d ? [d] : []; }
      banks.forEach(b => {
        const t = [b.bankName ? "Bank: " + b.bankName : "", b.accNo ? "A/c No: " + b.accNo : "",
                   b.ifsc ? "IFSC: " + b.ifsc : "", b.address ? "Branch: " + b.address : ""].filter(Boolean).join(" | ");
        if (t) lines.push(`<div style="font-size:10.5px;margin-top:2px;">${e(t)}</div>`);
      });
    }

    return `<div style="text-align:center;border-bottom:2px solid #000;padding-bottom:6px;margin-bottom:8px;">
      <div style="font-size:18px;font-weight:800;">${e(c.name || "")}</div>${lines.join("")}</div>`;
  }

  function qrBlockHtml(cc) {
    const c = DB.company || {};
    if (!c.upiQr) return "";
    const px = { small: 90, medium: 125, large: 165 }[cc.qrSize] || 125;
    return `<div style="text-align:center;font-size:11px;">
      <img src="${escHtml(c.upiQr)}" alt="UPI QR" style="width:${px}px;height:${px}px;object-fit:contain;">
      ${cc.qrCaption ? `<div style="font-weight:700;margin-top:2px;">${escHtml(cc.qrCaption)}</div>` : ""}
      ${cc.qrShowId && c.upiId ? `<div>UPI ID: ${escHtml(c.upiId)}</div>` : ""}
    </div>`;
  }

  function footerHtml(cc, rc, qrOn) {
    const c = DB.company || {};
    const e = escHtml;
    let h = "";
    const signHtml = cc.sign ? `<div style="text-align:center;font-size:12px;">
          <div style="font-weight:700;">For ${e(c.name || "")}</div>
          <div style="margin-top:34px;">${e(c.signatoryName || "")}</div>
          <div>${e(c.signatoryDesig || "Authorised Signatory")}</div>
        </div>` : "";
    const qrHtml = qrOn ? qrBlockHtml(cc) : "";
    if (qrOn && !qrHtml) toast("ℹ UPI QR laga nahi hai — F3 (Company) me photo upload karein");
    if (signHtml || qrHtml) {
      const pos = cc.qrPos || "right";
      const slots = { left: "", center: "", right: "" };
      if (qrHtml) slots[pos] = qrHtml;
      if (signHtml) slots[qrHtml ? (pos === "right" ? "left" : "right") : "right"] = signHtml;
      const cell = (jc, inner) => `<div style="flex:1;display:flex;justify-content:${jc};">${inner}</div>`;
      h += `<div style="display:flex;align-items:flex-end;margin-top:30px;padding:0 10px;">
        ${cell("flex-start", slots.left)}${cell("center", slots.center)}${cell("flex-end", slots.right)}</div>`;
    }
    if (rc && rc.printDate) {
      h += `<div style="margin-top:10px;font-size:10px;color:#475569;">Printed on: ${e(new Date().toLocaleString("en-IN"))}</div>`;
    }
    return h;
  }

  // table ke columns chhupana (colspan ka dhyan rakhte hue)
  function hideCols(table, hideSet) {
    if (!table || !hideSet.size) return;
    Array.from(table.rows).forEach(tr => {
      let pos = 0;
      Array.from(tr.cells).forEach(cell => {
        const span = cell.colSpan || 1;
        let visible = 0;
        for (let i = pos; i < pos + span; i++) if (!hideSet.has(i)) visible++;
        if (visible === 0) cell.remove(); else cell.colSpan = visible;
        pos += span;
      });
    });
  }

  function prepLedger(clone, r) {
    const sheet = clone.querySelector(".clean-ledger-sheet");
    clone.querySelector(".cls-comp-head")?.remove(); // apna header hum laga rahe hain
    if (sheet && sheet.lastElementChild && /Authorised Signatory/i.test(sheet.lastElementChild.textContent || "")) {
      sheet.lastElementChild.remove();                 // apna signature hum laga rahe hain
    }
    if (!r.ledgerName) clone.querySelector(".cls-led-title")?.remove();
    if (!r.period) clone.querySelector(".cls-led-meta")?.remove();

    if (r.partyAddr || r.partyGstin) {
      const led = (typeof getLedger === "function" && typeof SELECTED_LEDGER_FOR_VIEW !== "undefined") ? getLedger(SELECTED_LEDGER_FOR_VIEW) : null;
      if (led) {
        const parts = [];
        if (r.partyAddr && led.address) parts.push("Address: " + led.address);
        if (r.partyGstin && led.gstin) parts.push("GSTIN: " + led.gstin);
        if (parts.length) {
          const d = document.createElement("div");
          d.style.cssText = "font-size:11.5px;margin-top:2px;";
          d.textContent = parts.join(" | ");
          (clone.querySelector(".cls-led-head") || sheet || clone).appendChild(d);
        }
      }
    }

    const tbl = clone.querySelector(".clean-led-tbl");
    if (!tbl) return;
    if (!r.narration) {
      tbl.querySelectorAll("tbody td div").forEach(d => { if (/italic/i.test(d.getAttribute("style") || "")) d.remove(); });
    }
    if (!r.opening) tbl.querySelectorAll("tbody tr").forEach(tr => { if (/Opening Balance/i.test(tr.textContent || "")) tr.remove(); });
    if (!r.totals) tbl.querySelector("tfoot .cls-tot-row")?.remove();
    if (!r.closing) {
      tbl.querySelectorAll("tfoot tr").forEach(tr => {
        if (tr.classList.contains("cls-grand-row") || /Closing Balance/i.test(tr.textContent || "")) tr.remove();
      });
    }
    const hide = new Set();
    if (!r.vchType) hide.add(2);
    if (!r.vchNo) hide.add(3);
    hideCols(tbl, hide);
  }

  function prepGroup(clone, r) {
    clone.querySelector(".form-card")?.remove(); // upar ka Select Group / Net box
    const tbl = clone.querySelector("table.tally-tbl");
    if (!tbl) return;
    const hide = new Set();
    if (!r.serial) hide.add(0);
    if (!r.grpCol) hide.add(2);
    if (!r.opening) hide.add(3);
    if (!r.periodDrCr) { hide.add(4); hide.add(5); }
    if (!r.closing) { hide.add(6); hide.add(7); }
    if (!r.totals) tbl.querySelector("tfoot")?.remove();
    hideCols(tbl, hide);
  }

  function prepDayBook(clone, r) {
    const tbl = clone.querySelector("table.tally-tbl");
    if (!tbl) return;
    const hide = new Set([7]); // Actions (Edit/Del) kabhi print nahi
    if (!r.serial) hide.add(0);
    if (!r.vchType) hide.add(2);
    if (!r.vchNo) hide.add(3);
    if (!r.party) hide.add(4);
    if (!r.narration) hide.add(5);
    if (!r.amount) hide.add(6);
    if (!r.totals) tbl.querySelector("tfoot")?.remove();
    hideCols(tbl, hide);
  }

  function periodLine() {
    try {
      const p = getTempPeriod();
      return `<div style="text-align:center;font-size:11.5px;margin-bottom:6px;">Period: ${escHtml(fmtDate(p.from))} to ${escHtml(fmtDate(p.to))}</div>`;
    } catch (e) { return ""; }
  }

  window.smartPrint = function () {
    const modalOpen = kbOverlayOpen();
    const title = ((modalOpen ? document.getElementById("modalTitle") : document.getElementById("screenTitle")) || {}).textContent || "";
    const srcEl = modalOpen ? document.getElementById("modalBody") : document.getElementById("screenBody");
    if (!srcEl) return window.print();

    const cfg = getCfg();
    const screen = modalOpen ? "" : (typeof CURRENT_SCREEN !== "undefined" ? CURRENT_SCREEN : "");
    const kind = screen === "ledgers_view" ? "ledger" : screen === "group_summary" ? "group" : screen === "daybook" ? "daybook" : "";
    const rc = kind ? cfg[kind] : null;

    // clone + inputs ko text me badlo
    const clone = srcEl.cloneNode(true);
    clone.removeAttribute("id"); // warna style.css ka :has(~ #screenBody) rule header chhupa deta hai
    const origInputs = srcEl.querySelectorAll("input,select,textarea");
    const cloneInputs = clone.querySelectorAll("input,select,textarea");
    origInputs.forEach((el, i) => {
      const t = cloneInputs[i]; if (!t) return;
      const sp = document.createElement("span");
      sp.className = "pr-val";
      sp.textContent = el.tagName === "SELECT" ? ((el.options[el.selectedIndex] || {}).text || "")
        : (el.type === "checkbox" ? (el.checked ? "✔" : "✘") : el.value);
      if (el.type === "hidden") sp.style.display = "none";
      t.replaceWith(sp);
    });

    if (kind === "ledger") prepLedger(clone, rc);
    else if (kind === "group") prepGroup(clone, rc);
    else if (kind === "daybook") prepDayBook(clone, rc);

    // header + title/period
    let head = companyHeaderHtml(cfg.company);
    if (kind === "ledger") {
      // title/period clone ke andar (cls-led-head) hi hai
    } else if (kind === "group" || kind === "daybook") {
      if (rc.title) head += `<div style="text-align:center;font-size:14px;font-weight:700;margin-bottom:6px;">${escHtml(title.trim())}</div>`;
      if (rc.period) head += periodLine();
    } else {
      head += `<div style="text-align:center;font-size:14px;font-weight:700;margin-bottom:8px;">${escHtml(title.trim())}</div>`;
    }

    const area = document.getElementById("printArea");
    area.innerHTML = head;
    area.appendChild(clone);
    const foot = document.createElement("div");
    let qrOn = false;
    if (kind) qrOn = !!rc.qr;
    else if (screen === "voucher_entry" && typeof VCH_STATE !== "undefined" && VCH_STATE) qrOn = !!cfg.voucher["qr_" + VCH_STATE.vchType];
    foot.innerHTML = footerHtml(cfg.company, rc, qrOn);
    area.appendChild(foot);

    // Page number (Chrome)
    let pageStyle = null;
    if (rc && rc.pageNo) {
      pageStyle = document.createElement("style");
      pageStyle.textContent = '@page { @bottom-right { content: "Page " counter(page) " of " counter(pages); font-size: 9px; } }';
      document.head.appendChild(pageStyle);
    }

    document.body.classList.add("printing");
    const done = () => {
      document.body.classList.remove("printing");
      area.innerHTML = "";
      if (pageStyle) pageStyle.remove();
      window.removeEventListener("afterprint", done);
    };
    window.addEventListener("afterprint", done);
    setTimeout(() => window.print(), 60);
  };
})();
