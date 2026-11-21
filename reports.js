// ============================================================================
// REPORTS.JS: DAY BOOK, LEDGER VIEW, GROUP SUMMARY, RECON, TB, P&L, B/S,
//             OUTSTANDING, STOCK SUMMARY, GSTR-1/3B & A4 SMART PRINT
// ============================================================================

let SELECTED_LEDGER_FOR_VIEW = "";
let SHOW_NARRATION_IN_LEDGER = true;
let SHOW_DETAILS_IN_LEDGER = false;
let SHOW_ZERO_BALANCES = false;
let BS_DETAILED_MODE = false;
window._BS_ACTIVE_GROUP_DRILL = null;
window.SELECTED_GROUP_FOR_SUMMARY = "";
window._RETURN_TO_GROUP_SUMMARY = "";
let SELECTED_STOCK_GROUP_FILTER = "ALL";

window.RECON_STATE = {
  ledgerId: "",
  fromDate: "",
  toDate: "",
  splitMode: true,
  showReconciled: true,
  stmtBal: "",
  pickerIdx: 0
};

// ================= HELPER: OPPOSITE LEDGER PARTICULARS =================
function getOppositeParticulars(v, targetLedgerId) {
  const entries = getVoucherEntries(v);
  const myEntry = entries.find(e => e.ledgerId === targetLedgerId);
  const others = entries.filter(e => e.ledgerId !== targetLedgerId);
  const prefix = (myEntry && myEntry.type === "Dr") ? "Cr" : "Dr";

  if (!others.length) {
    const fb = (v.partyLedgerId && v.partyLedgerId !== targetLedgerId) ? v.partyLedgerId : v.type;
    return { prefix, mainName: getLedger(fb) ? getLedgerName(fb) : String(fb || v.type), subLines: [] };
  }
  if (others.length === 1) {
    return { prefix, mainName: getLedgerName(others[0].ledgerId), subLines: [] };
  }
  return {
    prefix,
    mainName: `${getLedgerName(others[0].ledgerId)} (as per details)`,
    subLines: others.map(o => ({ name: getLedgerName(o.ledgerId), type: o.type, amount: o.amount }))
  };
}

function getGroupHierarchyNames(rootGroupName) {
  const names = new Set([rootGroupName]);
  let added = true;
  while (added) {
    added = false;
    (DB.groups || []).forEach(g => {
      if (g.parent && names.has(g.parent) && !names.has(g.name)) {
        names.add(g.name);
        added = true;
      }
    });
  }
  return names;
}

function getTempPeriod() {
  const c = DB.company || {};
  return {
    from: window.RECON_STATE.fromDate || c.fyFrom || "2026-04-01",
    to: window.RECON_STATE.toDate || c.fyTo || "2027-03-31"
  };
}

function resetTempPeriodToFy() {
  const c = DB.company || {};
  window.RECON_STATE.fromDate = c.fyFrom || "2026-04-01";
  window.RECON_STATE.toDate = c.fyTo || "2027-03-31";
  window.RECON_STATE.stmtBal = "";
}

// ================= UNIVERSAL LEDGER PICKER (F4 / Alt+L / Alt+R) =================
function launchDirectLedgerPicker(mode = "ledger_view") {
  resetTempPeriodToFy();
  const allLedgers = (DB.ledgers || []).slice().sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
  window.RECON_STATE.pickerIdx = 0;
  document.getElementById("directLedgerPickerModal")?.remove();

  const ov = document.createElement("div");
  ov.id = "directLedgerPickerModal";
  ov.style.cssText = "position:fixed;inset:0;background:rgba(15,23,42,0.6);z-index:999999;display:flex;align-items:flex-start;justify-content:center;padding-top:55px;";
  const title = mode === "recon" ? "🔍 Select Ledger for Reconciliation (Bank / Party / All)" : "📒 Select Ledger Account (Statement)";

  ov.innerHTML = `
    <div style="width:100%;max-width:520px;background:#fff;border:2px solid #0f6e4e;border-radius:6px;box-shadow:0 15px 35px rgba(0,0,0,0.3);overflow:hidden;">
      <div style="background:#0f6e4e;color:#fff;padding:9px 14px;font-weight:800;font-size:13px;display:flex;justify-content:space-between;">
        <span>${title}</span><span style="font-size:11px;">↑ ↓ Select • Enter Open • Esc Close</span>
      </div>
      <div style="padding:10px;background:#f8fafc;border-bottom:1px solid #cbd5e1;">
        <input type="text" id="directLedSearchInp" placeholder="Search Ledger or Group (${allLedgers.length} Ledgers)..."
               style="width:100%;padding:8px 10px;font-size:13px;font-weight:600;border:1.5px solid #0f6e4e;border-radius:4px;outline:none;">
      </div>
      <div id="directLedListBox" style="max-height:340px;overflow-y:auto;"></div>
    </div>`;
  document.body.appendChild(ov);

  const inp = document.getElementById("directLedSearchInp");
  const box = document.getElementById("directLedListBox");

  function drawList() {
    const q = (inp.value || "").trim().toLowerCase();
    const filtered = allLedgers.filter(l => (l.name || "").toLowerCase().includes(q) || (l.group || "").toLowerCase().includes(q));
    if (window.RECON_STATE.pickerIdx >= filtered.length) window.RECON_STATE.pickerIdx = 0;

    box.innerHTML = filtered.length ? filtered.map((l, i) => `
      <div class="d-pick-row" onclick="pickDirectLedger('${mode}','${l.id}')"
           style="padding:8px 14px;border-bottom:1px solid #f1f5f9;display:flex;justify-content:space-between;align-items:center;cursor:pointer;font-size:13px;${i === window.RECON_STATE.pickerIdx ? "background:#fef08a;font-weight:800;border-left:4px solid #0f6e4e;" : ""}">
        <span>${escHtml(l.name)}</span>
        <span style="font-size:11px;color:#475569;background:#e2e8f0;padding:1px 7px;border-radius:10px;">${escHtml(l.group || "")}</span>
      </div>`).join("") : `<div style="padding:18px;text-align:center;color:#64748b;">Koi matching ledger nahi mila.</div>`;

    const rows = box.querySelectorAll(".d-pick-row");
    if (rows[window.RECON_STATE.pickerIdx]) rows[window.RECON_STATE.pickerIdx].scrollIntoView({ block: "nearest" });
    return filtered;
  }

  inp.oninput = () => { window.RECON_STATE.pickerIdx = 0; drawList(); };
  inp.onkeydown = (e) => {
    const filtered = drawList();
    if (e.key === "ArrowDown") { e.preventDefault(); e.stopImmediatePropagation(); if (filtered.length) window.RECON_STATE.pickerIdx = (window.RECON_STATE.pickerIdx + 1) % filtered.length; drawList(); }
    else if (e.key === "ArrowUp") { e.preventDefault(); e.stopImmediatePropagation(); if (filtered.length) window.RECON_STATE.pickerIdx = (window.RECON_STATE.pickerIdx - 1 + filtered.length) % filtered.length; drawList(); }
    else if (e.key === "Enter") { e.preventDefault(); e.stopImmediatePropagation(); const ch = filtered[window.RECON_STATE.pickerIdx]; if (ch) pickDirectLedger(mode, ch.id); }
    else if (e.key === "Escape") { e.preventDefault(); e.stopImmediatePropagation(); ov.remove(); }
  };

  drawList();
  setTimeout(() => inp.focus(), 20);
}

function pickDirectLedger(mode, ledgerId) {
  document.getElementById("directLedgerPickerModal")?.remove();
  resetTempPeriodToFy();
  window.RECON_STATE.ledgerId = ledgerId;
  if (mode === "recon") {
    navigate("bank_recon");
  } else {
    SELECTED_LEDGER_FOR_VIEW = ledgerId;
    window._RETURN_TO_GROUP_SUMMARY = "";
    navigate("ledgers_view");
  }
}

// ================= UNIVERSAL TEMPORARY F2 PERIOD POPUP =================
function openDirectF2DateModal() {
  const p = getTempPeriod();
  document.getElementById("directF2DateModal")?.remove();

  const ov = document.createElement("div");
  ov.id = "directF2DateModal";
  ov.style.cssText = "position:fixed;inset:0;background:rgba(15,23,42,0.55);z-index:999999;display:flex;align-items:center;justify-content:center;";
  ov.innerHTML = `
    <div style="width:360px;background:#fff;border:2px solid #0f6e4e;border-radius:6px;box-shadow:0 12px 28px rgba(0,0,0,0.28);overflow:hidden;">
      <div style="background:#0f6e4e;color:#fff;padding:8px 14px;font-weight:800;font-size:13px;display:flex;justify-content:space-between;">
        <span>📅 Filter Period (Temporary - F2)</span>
        <span style="cursor:pointer;" onclick="document.getElementById('directF2DateModal').remove()">✕</span>
      </div>
      <div style="padding:14px;display:grid;gap:10px;">
        <div><label style="font-size:11.5px;font-weight:700;display:block;margin-bottom:3px;">From Date:</label>
          <input type="date" id="dF2From" value="${p.from}" style="width:100%;padding:6px 8px;border:1.5px solid #0f6e4e;border-radius:4px;font-weight:700;"></div>
        <div><label style="font-size:11.5px;font-weight:700;display:block;margin-bottom:3px;">To Date:</label>
          <input type="date" id="dF2To" value="${p.to}" style="width:100%;padding:6px 8px;border:1.5px solid #94a3b8;border-radius:4px;font-weight:700;"></div>
        <div style="display:flex;justify-content:space-between;margin-top:4px;">
          <button type="button" class="btn btn-sec" onclick="applyDirectF2Dates(true)">Reset Full FY</button>
          <button type="button" class="btn" onclick="applyDirectF2Dates(false)">✔ Apply (Enter)</button>
        </div>
      </div>
    </div>`;
  document.body.appendChild(ov);

  const fInp = document.getElementById("dF2From");
  const tInp = document.getElementById("dF2To");
  fInp.onkeydown = (e) => {
    if (e.key === "Escape") { e.preventDefault(); e.stopImmediatePropagation(); ov.remove(); }
    else if (e.key === "Enter") { e.preventDefault(); e.stopImmediatePropagation(); tInp.focus(); }
  };
  tInp.onkeydown = (e) => {
    if (e.key === "Escape") { e.preventDefault(); e.stopImmediatePropagation(); ov.remove(); }
    else if (e.key === "Enter") { e.preventDefault(); e.stopImmediatePropagation(); applyDirectF2Dates(false); }
  };
  setTimeout(() => fInp.focus(), 20);
}

function applyDirectF2Dates(resetFy) {
  const c = DB.company || {};
  window.RECON_STATE.fromDate = resetFy ? (c.fyFrom || "2026-04-01") : (document.getElementById("dF2From")?.value || c.fyFrom);
  window.RECON_STATE.toDate = resetFy ? (c.fyTo || "2027-03-31") : (document.getElementById("dF2To")?.value || c.fyTo);
  document.getElementById("directF2DateModal")?.remove();
  renderScreen(CURRENT_SCREEN);
}

// ============================================================================
// 1. DAY BOOK (ALT+D)
// ============================================================================
function renderDayBookScreen() {
  const p = getTempPeriod();
  document.getElementById("screenTitle").textContent = "Day Book (All Transactions)";
  document.getElementById("screenSub").textContent = `Period: ${fmtDate(p.from)} to ${fmtDate(p.to)} | F2: Filter | ↑ ↓ + Enter: Edit | Esc: Back`;

  const sorted = (DB.vouchers || [])
    .filter(v => isVoucherInPeriod(v, p.from, p.to))
    .sort((a, b) => (a.date > b.date ? 1 : -1));
  let totAmt = 0;

  const rowsHtml = sorted.map((v, idx) => {
    totAmt = +(totAmt + (Number(v.amount) || 0)).toFixed(2);
    const ens = getVoucherEntries(v);
    let mainLedId = "";
    if (v.mode === "item" && v.partyLedgerId) {
      mainLedId = v.partyLedgerId;
    } else if (v.type === "Receipt") {
      mainLedId = (ens.find(e => e.type === "Cr") || ens[0] || {}).ledgerId || v.crLedgerId || v.drLedgerId;
    } else {
      mainLedId = (ens.find(e => e.type === "Dr") || ens[0] || {}).ledgerId || v.drLedgerId || v.crLedgerId;
    }
    const partyName = getLedgerName(mainLedId);
    return `
      <tr data-vid="${v.id}" onclick="openVoucherScreen('${v.type}','${v.id}')" style="cursor:pointer;">
        <td>${idx + 1}</td>
        <td><b>${fmtDate(v.date)}</b></td>
        <td><span class="kbd">${escHtml(v.type)}</span></td>
        <td><b>${escHtml(v.vchNo)}</b></td>
        <td>${escHtml(partyName)}</td>
        <td>${escHtml(v.narration || "-")}</td>
        <td class="num"><b>₹${fmtINR(v.amount)}</b></td>
        <td>
          <button class="btn btn-sec" style="padding:2px 7px;font-size:11px;" onclick="event.stopPropagation(); openVoucherScreen('${v.type}','${v.id}')">Edit</button>
          <button class="btn btn-danger" style="padding:2px 7px;font-size:11px;" onclick="event.stopPropagation(); deleteVoucher('${v.id}')">Del</button>
        </td>
      </tr>`;
  }).join("");

  document.getElementById("screenBody").innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
      <div class="kb-rowhint" style="margin:0;">💡 Use <span class="kbd">↑</span> <span class="kbd">↓</span> + <span class="kbd">Enter</span> to edit voucher.</div>
      <button class="btn btn-sec" style="padding:3px 10px;font-size:11.5px;" onclick="openDirectF2DateModal()">📅 ${fmtDate(p.from)} to ${fmtDate(p.to)} (F2)</button>
    </div>
    <div class="form-card" style="padding:0;overflow:hidden;">
      <table class="tally-tbl">
        <thead><tr><th>#</th><th>Date</th><th>Type</th><th>Vch No</th><th>Particulars / Party</th><th>Narration</th><th class="num">Amount (₹)</th><th>Actions</th></tr></thead>
        <tbody>${rowsHtml || `<tr><td colspan="8" style="text-align:center;padding:20px;color:var(--muted);">No Vouchers in this period.</td></tr>`}</tbody>
        <tfoot><tr style="background:#f1f5f9;font-weight:800;"><td colspan="6" style="text-align:right;">Total Day Book:</td><td class="num">₹${fmtINR(totAmt)}</td><td></td></tr></tfoot>
      </table>
    </div>`;
}

// ============================================================================
// 2. TALLY LEDGER VOUCHERS STATEMENT (ALT+L)
// ============================================================================
function drillToLedger(ledgerId) {
  SELECTED_LEDGER_FOR_VIEW = ledgerId;
  navigate("ledgers_view", true);
}

function openLedgerFromGroup(ledgerId) {
  if (!ledgerId) return;
  window._RETURN_TO_GROUP_SUMMARY = window.SELECTED_GROUP_FOR_SUMMARY || "";
  SELECTED_LEDGER_FOR_VIEW = ledgerId;
  navigate("ledgers_view", true);
}

function renderLedgersViewScreen() {
  const p = getTempPeriod();
  if (!SELECTED_LEDGER_FOR_VIEW && DB.ledgers.length) SELECTED_LEDGER_FOR_VIEW = DB.ledgers[0].id;
  const led = getLedger(SELECTED_LEDGER_FOR_VIEW);

  document.getElementById("screenTitle").textContent = `Ledger Vouchers — ${led ? led.name : ""}`;
  document.getElementById("screenSub").textContent = "F2: Period | F4: Change Ledger | ↑ ↓ + Enter: Edit Voucher | Esc: Back";

  const balMap = computeAllLedgerBalances(p.from, p.to);
  const curBal = balMap[SELECTED_LEDGER_FOR_VIEW] || { opDr: 0, opCr: 0, curDr: 0, curCr: 0, closeBal: 0, closeType: "Dr" };
  let running = +(curBal.opDr - curBal.opCr).toFixed(2);
  let totDr = 0, totCr = 0, rowsHtml = "";

  const sorted = (DB.vouchers || [])
    .filter(v => isVoucherInPeriod(v, p.from, p.to))
    .sort((a, b) => (a.date > b.date ? 1 : -1));

  sorted.forEach(v => {
    const myLines = getVoucherEntries(v).filter(e => e.ledgerId === SELECTED_LEDGER_FOR_VIEW);
    if (!myLines.length) return;
    let drAmt = 0, crAmt = 0;
    myLines.forEach(m => { if (m.type === "Dr") drAmt += m.amount; else crAmt += m.amount; });
    totDr = +(totDr + drAmt).toFixed(2);
    totCr = +(totCr + crAmt).toFixed(2);
    running = +(running + drAmt - crAmt).toFixed(2);

    const opp = getOppositeParticulars(v, SELECTED_LEDGER_FOR_VIEW);
    const subHtml = (SHOW_DETAILS_IN_LEDGER && opp.subLines.length > 1)
      ? `<div style="padding-left:20px;font-size:11px;color:#475569;">${opp.subLines.map(s => `• ${escHtml(s.name)}: ₹${fmtINR(s.amount)} ${s.type}`).join("<br>")}</div>` : "";
    const narrHtml = (SHOW_NARRATION_IN_LEDGER && v.narration)
      ? `<div style="padding-left:20px;font-size:11px;color:#64748b;font-style:italic;">${escHtml(v.narration)}</div>` : "";

    rowsHtml += `
      <tr data-vid="${v.id}" onclick="openVoucherScreen('${v.type}','${v.id}')" style="cursor:pointer;">
        <td style="white-space:nowrap;">${fmtDate(v.date)}</td>
        <td><b>${escHtml(opp.mainName)}</b>${subHtml}${narrHtml}</td>
        <td>${escHtml(v.type)}</td>
        <td>${escHtml(v.vchNo)}</td>
        <td class="num">${drAmt ? fmtINR(drAmt) : ""}</td>
        <td class="num">${crAmt ? fmtINR(crAmt) : ""}</td>
      </tr>`;
  });

  const opNet = +(curBal.opDr - curBal.opCr).toFixed(2);
  const opDr = opNet > 0 ? opNet : 0;
  const opCr = opNet < 0 ? Math.abs(opNet) : 0;
  const curTotDr = +(opDr + totDr).toFixed(2);
  const curTotCr = +(opCr + totCr).toFixed(2);
  const clsDiff = +(curTotDr - curTotCr).toFixed(2);
  const grandTot = Math.max(curTotDr, curTotCr);

  const c = DB.company || {};
  const regLine = [c.regNo ? `Reg. No: ${c.regNo}` : "", c.pan ? `PAN: ${c.pan}` : "", c.gstin ? `GSTIN: ${c.gstin}` : ""].filter(Boolean).join(" | ");
  const addrLine = [c.address, c.address2, c.city, c.state, c.pincode ? `- ${c.pincode}` : ""].filter(Boolean).join(", ");
  const contLine = [c.phone ? `Ph: ${c.phone}` : "", c.email ? c.email : ""].filter(Boolean).join(" | ");

  document.getElementById("screenBody").innerHTML = `
    <div class="form-card no-print" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;background:#f8fafc;">
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
        <button class="btn btn-sec" onclick="goBack()">← Back (Esc)</button>
        <button class="btn btn-sec" style="padding:3px 9px;font-size:11.5px;" onclick="launchDirectLedgerPicker('ledger_view')">🔄 Change Ledger (F4)</button>
        <button class="btn btn-sec" style="padding:3px 9px;font-size:11.5px;" onclick="openDirectF2DateModal()">📅 ${fmtDate(p.from)} to ${fmtDate(p.to)} (F2)</button>
        <label style="font-size:12px;cursor:pointer;"><input type="checkbox" ${SHOW_NARRATION_IN_LEDGER ? "checked" : ""} onchange="SHOW_NARRATION_IN_LEDGER=this.checked; renderLedgersViewScreen();"> Narration</label>
        <label style="font-size:12px;cursor:pointer;"><input type="checkbox" ${SHOW_DETAILS_IN_LEDGER ? "checked" : ""} onchange="SHOW_DETAILS_IN_LEDGER=this.checked; renderLedgersViewScreen();"> As per details</label>
      </div>
      <div style="font-size:14px;font-weight:800;color:var(--pri-dark);">Closing: ₹${fmtINR(Math.abs(clsDiff))} ${clsDiff >= 0 ? "Dr" : "Cr"}</div>
    </div>

    <div class="clean-ledger-sheet">
      <div class="cls-comp-head">
        <div class="cls-comp-name">${escHtml(c.name || "")}</div>
        ${regLine ? `<div class="cls-comp-sub">${escHtml(regLine)}</div>` : ""}
        ${addrLine ? `<div class="cls-comp-sub">${escHtml(addrLine)}</div>` : ""}
        ${contLine ? `<div class="cls-comp-sub">${escHtml(contLine)}</div>` : ""}
      </div>

      <div class="cls-led-head">
        <div class="cls-led-title">Ledger: ${escHtml(led ? led.name : "-")}</div>
        <div class="cls-led-meta">Period: ${fmtDate(p.from)} to ${fmtDate(p.to)}</div>
      </div>

      <table class="clean-led-tbl">
        <thead>
          <tr>
            <th style="width:12%;">Date</th>
            <th style="width:44%;">Particulars</th>
            <th style="width:12%;">Vch Type</th>
            <th style="width:10%;">Vch No.</th>
            <th class="num" style="width:11%;">Debit</th>
            <th class="num" style="width:11%;">Credit</th>
          </tr>
        </thead>
        <tbody>
          ${opNet !== 0 ? `
          <tr>
            <td>${fmtDate(p.from)}</td>
            <td><b>Opening Balance (b/f)</b></td>
            <td></td><td></td>
            <td class="num">${opDr ? fmtINR(opDr) : ""}</td>
            <td class="num">${opCr ? fmtINR(opCr) : ""}</td>
          </tr>` : ""}
          ${rowsHtml || `<tr><td colspan="6" style="text-align:center;padding:18px;color:#64748b;">No transactions in this period.</td></tr>`}
        </tbody>
        <tfoot>
          <tr class="cls-tot-row">
            <td></td><td><b>Current Total</b></td><td></td><td></td>
            <td class="num"><b>${fmtINR(curTotDr)}</b></td>
            <td class="num"><b>${fmtINR(curTotCr)}</b></td>
          </tr>
          <tr>
            <td></td><td><b>Closing Balance ${clsDiff >= 0 ? "Dr" : "Cr"}</b></td><td></td><td></td>
            <td class="num">${clsDiff < 0 ? `<b>${fmtINR(Math.abs(clsDiff))}</b>` : ""}</td>
            <td class="num">${clsDiff >= 0 ? `<b>${fmtINR(Math.abs(clsDiff))}</b>` : ""}</td>
          </tr>
          <tr class="cls-grand-row">
            <td></td><td><b>Total</b></td><td></td><td></td>
            <td class="num"><b>${fmtINR(grandTot)}</b></td>
            <td class="num"><b>${fmtINR(grandTot)}</b></td>
          </tr>
        </tfoot>
      </table>
      <div style="display:flex; justify-content:flex-end; margin-top:40px; padding-right:10px;">
        <div style="text-align:center;">
          <div style="font-size:12px; font-weight:700;">For ${escHtml(c.name || "")}</div>
          <div style="margin-top:36px; font-size:11.5px; color:#334155;">Authorised Signatory</div>
        </div>
      </div>
    </div>`;
}
// ============================================================================
// 3. GROUP SUMMARY & UNIVERSAL GROUP PICKER (G / F4) — EXACT F4 PATTERN
// ============================================================================
function launchDirectGroupPicker() {
  const allGroups = (DB.groups || []).slice();
  if (!allGroups.length) return;

  let pickerIdx = Math.max(0, allGroups.findIndex(g => g.name === window.SELECTED_GROUP_FOR_SUMMARY));
  document.getElementById("directGroupPickerModal")?.remove();

  const ov = document.createElement("div");
  ov.id = "directGroupPickerModal";
  ov.style.cssText = "position:fixed;inset:0;background:rgba(15,23,42,0.6);z-index:999999;display:flex;align-items:flex-start;justify-content:center;padding-top:55px;";

  ov.innerHTML = `
    <div style="width:100%;max-width:520px;background:#fff;border:2px solid #0f6e4e;border-radius:6px;box-shadow:0 15px 35px rgba(0,0,0,0.3);overflow:hidden;">
      <div style="background:#0f6e4e;color:#fff;padding:9px 14px;font-weight:800;font-size:13px;display:flex;justify-content:space-between;">
        <span>📂 Select Group (Group Summary)</span><span style="font-size:11px;">↑ ↓ Select • Enter Open • Esc Close</span>
      </div>
      <div style="padding:10px;background:#f8fafc;border-bottom:1px solid #cbd5e1;">
        <input type="text" id="directGrpSearchInp" placeholder="Search Group or Nature (${allGroups.length} Groups)..."
               style="width:100%;padding:8px 10px;font-size:13px;font-weight:600;border:1.5px solid #0f6e4e;border-radius:4px;outline:none;">
      </div>
      <div id="directGrpListBox" style="max-height:340px;overflow-y:auto;"></div>
    </div>`;
  document.body.appendChild(ov);

  const inp = document.getElementById("directGrpSearchInp");
  const box = document.getElementById("directGrpListBox");

  function drawList() {
    const q = (inp.value || "").trim().toLowerCase();
    const filtered = allGroups.filter(g => (g.name || "").toLowerCase().includes(q) || (g.nature || "").toLowerCase().includes(q));
    if (pickerIdx >= filtered.length) pickerIdx = 0;

    box.innerHTML = filtered.length ? filtered.map((g, i) => `
      <div class="d-pick-row" data-gname="${escHtml(g.name)}"
           style="padding:8px 14px;border-bottom:1px solid #f1f5f9;display:flex;justify-content:space-between;align-items:center;cursor:pointer;font-size:13px;${i === pickerIdx ? "background:#fef08a;font-weight:800;border-left:4px solid #0f6e4e;" : ""}">
        <span>${escHtml(g.name)}</span>
        <span style="font-size:11px;color:#475569;background:#e2e8f0;padding:1px 7px;border-radius:10px;">${escHtml(g.nature || "")}</span>
      </div>`).join("") : `<div style="padding:18px;text-align:center;color:#64748b;">Koi matching group nahi mila.</div>`;

    const rows = box.querySelectorAll(".d-pick-row");
    rows.forEach(r => {
      r.onclick = () => pickDirectGroup(r.getAttribute("data-gname"));
    });
    if (rows[pickerIdx]) rows[pickerIdx].scrollIntoView({ block: "nearest" });
    return filtered;
  }

  inp.oninput = () => { pickerIdx = 0; drawList(); };
  inp.onkeydown = (e) => {
    const filtered = drawList();
    if (e.key === "ArrowDown") { e.preventDefault(); e.stopImmediatePropagation(); if (filtered.length) pickerIdx = (pickerIdx + 1) % filtered.length; drawList(); }
    else if (e.key === "ArrowUp") { e.preventDefault(); e.stopImmediatePropagation(); if (filtered.length) pickerIdx = (pickerIdx - 1 + filtered.length) % filtered.length; drawList(); }
    else if (e.key === "Enter") { e.preventDefault(); e.stopImmediatePropagation(); const ch = filtered[pickerIdx]; if (ch) pickDirectGroup(ch.name); }
    else if (e.key === "Escape") { e.preventDefault(); e.stopImmediatePropagation(); ov.remove(); }
  };

  ov.onclick = (e) => { if (e.target === ov) ov.remove(); };
  drawList();
  setTimeout(() => inp.focus(), 20);
}

function pickDirectGroup(groupName) {
  document.getElementById("directGroupPickerModal")?.remove();
  if (groupName) openGroupSummary(groupName);
}

function openGroupSummary(groupName) {
  if (groupName) window.SELECTED_GROUP_FOR_SUMMARY = groupName;
  else if (!window.SELECTED_GROUP_FOR_SUMMARY) {
    const first = (DB.groups || []).find(g => (DB.ledgers || []).some(l => l.group === g.name));
    window.SELECTED_GROUP_FOR_SUMMARY = first ? first.name : ((DB.groups[0] && DB.groups[0].name) || "Cash-in-Hand");
  }
  navigate("group_summary");
}

function renderGroupSummaryScreen() {
  const p = getTempPeriod();
  const groupName = window.SELECTED_GROUP_FOR_SUMMARY || ((DB.groups[0] && DB.groups[0].name) || "");
  document.getElementById("screenTitle").textContent = `📂 Group Summary: ${groupName}`;
  document.getElementById("screenSub").textContent = "G / F4: Change Group | ↑ ↓ + Enter ya Click se Ledger kholein | F2: Period | Esc: Back";

  const balMap = computeAllLedgerBalances(p.from, p.to);
  const targetGroups = getGroupHierarchyNames(groupName);
  const grpLedgers = (DB.ledgers || []).filter(l => targetGroups.has(l.group));

  let totCurDr = 0, totCurCr = 0, totCloseDr = 0, totCloseCr = 0;
  const rowsHtml = grpLedgers.map((l, idx) => {
    const b = balMap[l.id] || { opDr: 0, opCr: 0, curDr: 0, curCr: 0, netSigned: 0 };
    const net = Number(b.netSigned || 0);
    const cDr = net > 0 ? net : 0, cCr = net < 0 ? Math.abs(net) : 0;
    totCurDr += b.curDr; totCurCr += b.curCr; totCloseDr += cDr; totCloseCr += cCr;
    const opStr = b.opDr ? `₹${fmtINR(b.opDr)} Dr` : (b.opCr ? `₹${fmtINR(b.opCr)} Cr` : "-");
    return `
      <tr onclick="openLedgerFromGroup('${l.id}')" style="cursor:pointer;">
        <td>${idx + 1}</td>
        <td><b style="color:#0f6e4e;text-decoration:underline;">${escHtml(l.name)}</b></td>
        <td><span class="kbd">${escHtml(l.group)}</span></td>
        <td class="num">${opStr}</td>
        <td class="num">${b.curDr ? `₹${fmtINR(b.curDr)}` : "-"}</td>
        <td class="num">${b.curCr ? `₹${fmtINR(b.curCr)}` : "-"}</td>
        <td class="num" style="color:#0f6e4e;font-weight:700;">${cDr ? `₹${fmtINR(cDr)} Dr` : "-"}</td>
        <td class="num" style="color:#b91c1c;font-weight:700;">${cCr ? `₹${fmtINR(cCr)} Cr` : "-"}</td>
      </tr>`;
  }).join("");

  const grpOpts = (DB.groups || []).map(g => `<option value="${escHtml(g.name)}" ${g.name === groupName ? "selected" : ""}>${escHtml(g.name)} (${escHtml(g.nature)})</option>`).join("");
  const netGrp = +(totCloseDr - totCloseCr).toFixed(2);

  document.getElementById("screenBody").innerHTML = `
    <div class="form-card" style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;">
      <div class="field" style="flex:1;min-width:240px;">
        <label>Select Group:</label>
        <select onchange="openGroupSummary(this.value)">${grpOpts}</select>
      </div>
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
        <button class="btn btn-sec" onclick="launchDirectGroupPicker()">🔄 Change Group (G)</button>
        <button class="btn btn-sec" onclick="openDirectF2DateModal()">📅 ${fmtDate(p.from)} to ${fmtDate(p.to)} (F2)</button>
        <div style="font-size:15px;font-weight:800;color:var(--pri-dark);">Net: ₹${fmtINR(Math.abs(netGrp))} ${netGrp >= 0 ? "Dr" : "Cr"}</div>
      </div>
    </div>
    <div class="form-card" style="padding:0;overflow:hidden;">
      <table class="tally-tbl">
        <thead><tr><th>#</th><th>Ledger Name</th><th>Group</th><th class="num">Opening</th><th class="num">Period Dr</th><th class="num">Period Cr</th><th class="num">Closing Dr</th><th class="num">Closing Cr</th></tr></thead>
        <tbody>${rowsHtml || `<tr><td colspan="8" style="text-align:center;padding:22px;color:var(--muted);">Is Group me koi Ledger nahi hai.</td></tr>`}</tbody>
        <tfoot><tr style="background:#f1f5f9;font-weight:800;"><td colspan="4" style="text-align:right;">Total (${grpLedgers.length} Ledgers):</td><td class="num">₹${fmtINR(totCurDr)}</td><td class="num">₹${fmtINR(totCurCr)}</td><td class="num" style="color:#0f6e4e;">₹${fmtINR(totCloseDr)} Dr</td><td class="num" style="color:#b91c1c;">₹${fmtINR(totCloseCr)} Cr</td></tr></tfoot>
      </table>
    </div>`;
}
// ============================================================================
// 4. SLEEK ACCOUNT / BANK RECONCILIATION (ALT+R)
// ============================================================================
function drawSleekReconView() {
  const s = window.RECON_STATE;
  const p = getTempPeriod();
  const led = getLedger(s.ledgerId) || (DB.ledgers || [])[0];
  if (!led) { navigate("gateway"); return; }
  s.ledgerId = led.id;

  document.getElementById("screenTitle").textContent = `🔄 Account Reconciliation — ${led.name} [${led.group}]`;
  document.getElementById("screenSub").textContent = "F2: Period | F4: Change Ledger | Double-Click: Edit Voucher | Esc: Back";

  const rows = [];
  (DB.vouchers || []).slice().sort((a, b) => (a.date > b.date ? 1 : -1)).forEach(v => {
    if (!isVoucherInPeriod(v, p.from, p.to)) return;
    const entries = getVoucherEntries(v);
    const myLines = entries.filter(e => e.ledgerId === led.id);
    myLines.forEach((myLine, mIdx) => {
      const oppLines = entries.filter(e => e.ledgerId !== led.id && e.type !== myLine.type);
      const rk = `${led.id}__line_${mIdx}`;
      const rDate = (v.bankRecon && (v.bankRecon[rk] || v.bankRecon[led.id])) || "";
      rows.push({
        vid: v.id, rk, date: v.date, vchNo: v.vchNo, type: v.type,
        oppName: oppLines.map(o => getLedgerName(o.ledgerId)).join(", ") || v.type,
        narration: v.narration || "",
        dr: myLine.type === "Dr" ? myLine.amount : 0,
        cr: myLine.type === "Cr" ? myLine.amount : 0,
        reconDate: rDate
      });
    });
  });

  const vis = s.showReconciled ? rows : rows.filter(r => !r.reconDate);
  const balMap = computeAllLedgerBalances(p.from, p.to);
  const b = balMap[led.id] || { opDr: 0, opCr: 0, netSigned: 0 };
  let unDr = 0, unCr = 0;
  rows.forEach(r => { if (!r.reconDate) { unDr += r.dr; unCr += r.cr; } });

  const netBook = b.netSigned;
  const netRec = +(netBook - unDr + unCr).toFixed(2);
  const fmtB = v => `₹${fmtINR(Math.abs(v))} ${v >= 0 ? "Dr" : "Cr"}`;

  const trHtml = vis.map((r, i) => `
    <tr ondblclick="openVoucherScreen('${r.type}','${r.vid}')" style="${r.reconDate ? "background:#f0fdf4;" : ""}">
      <td>${i + 1}</td>
      <td><b>${fmtDate(r.date)}</b></td>
      <td><b>${escHtml(r.oppName)}</b> ${r.narration ? `<small style="color:var(--muted);">(${escHtml(r.narration)})</small>` : ""}</td>
      <td><span class="kbd">${escHtml(r.type)}</span></td>
      <td><b>${escHtml(r.vchNo)}</b></td>
      <td style="white-space:nowrap;">
        <input type="date" value="${r.reconDate}" onchange="setReconRowDate('${r.vid}','${r.rk}',this.value)" style="padding:2px 5px;font-size:11.5px;width:122px;">
        ${r.reconDate
          ? `<button class="btn btn-sec" style="padding:1px 5px;font-size:10px;color:var(--danger);" onclick="setReconRowDate('${r.vid}','${r.rk}','')">✕</button>`
          : `<button class="btn btn-sec" style="padding:1px 5px;font-size:10px;color:var(--ok);" onclick="setReconRowDate('${r.vid}','${r.rk}','${r.date}')">✔</button>`}
      </td>
      <td class="num" style="color:#0f6e4e;font-weight:700;">${r.dr ? `₹${fmtINR(r.dr)}` : "-"}</td>
      <td class="num" style="color:#b91c1c;font-weight:700;">${r.cr ? `₹${fmtINR(r.cr)}` : "-"}</td>
    </tr>`).join("");

  document.getElementById("screenBody").innerHTML = `
    <div class="form-card" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;background:#f8fafc;">
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
        <b>📒 ${escHtml(led.name)}</b>
        <button class="btn btn-sec" style="padding:2px 8px;font-size:11px;" onclick="launchDirectLedgerPicker('recon')">🔄 Change Ledger (F4)</button>
        <button class="btn btn-sec" style="padding:2px 8px;font-size:11px;" onclick="openDirectF2DateModal()">📅 ${fmtDate(p.from)} to ${fmtDate(p.to)} (F2)</button>
      </div>
      <label style="font-size:12px;cursor:pointer;"><input type="checkbox" ${s.showReconciled ? "checked" : ""} onchange="window.RECON_STATE.showReconciled=this.checked; drawSleekReconView();"> Show Reconciled</label>
    </div>

    <div class="form-card" style="padding:0;overflow:hidden;">
      <table class="tally-tbl">
        <thead><tr><th>#</th><th>Date</th><th>Particulars</th><th>Type</th><th>Vch No</th><th>Clearing Date</th><th class="num">Debit (₹)</th><th class="num">Credit (₹)</th></tr></thead>
        <tbody>${trHtml || `<tr><td colspan="8" style="text-align:center;padding:22px;color:var(--muted);">No entries in this period.</td></tr>`}</tbody>
      </table>
    </div>

    <div class="form-card" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;background:#f8fafc;">
      <div><b>Book Bal:</b> ${fmtB(netBook)} &nbsp;|&nbsp; <span style="color:#b45309;"><b>Pending:</b> Dr ₹${fmtINR(unDr)} / Cr ₹${fmtINR(unCr)}</span> &nbsp;|&nbsp; <b style="color:var(--pri-dark);">Reconciled: ${fmtB(netRec)}</b></div>
      <div style="display:flex;align-items:center;gap:6px;">
        <span style="font-size:11.5px;font-weight:700;">Stmt Bal:</span>
        <input type="number" step="0.01" style="width:120px;padding:3px 6px;text-align:right;" value="${s.stmtBal || ""}" oninput="window.RECON_STATE.stmtBal=this.value; calcReconStmtDiff(${Math.abs(netRec).toFixed(2)}, this.value)">
        <span id="reconLiveDiffBadge" style="font-size:11.5px;font-weight:800;"></span>
      </div>
    </div>`;
  if (s.stmtBal) calcReconStmtDiff(Math.abs(netRec).toFixed(2), s.stmtBal);
}

function setReconRowDate(vid, rk, val) {
  const v = (DB.vouchers || []).find(x => x.id === vid); if (!v) return;
  v.bankRecon = v.bankRecon || {};
  v.bankRecon[rk] = val || "";
  v.bankRecon[window.RECON_STATE.ledgerId] = val || "";
  saveDB(); drawSleekReconView();
}

function calcReconStmtDiff(recAbs, stmtStr) {
  const badge = document.getElementById("reconLiveDiffBadge"); if (!badge) return;
  if (!stmtStr) { badge.innerHTML = ""; return; }
  const diff = +(Number(recAbs) - Math.abs(Number(stmtStr) || 0)).toFixed(2);
  badge.innerHTML = Math.abs(diff) < 0.01
    ? `<span style="color:var(--ok);">✔ Matched</span>`
    : `<span style="color:var(--danger);">⚠ Diff: ₹${fmtINR(Math.abs(diff))}</span>`;
}

// ============================================================================
// 5. TRIAL BALANCE, P&L / INCOME & EXPENDITURE, BALANCE SHEET
// ============================================================================
function renderTrialBalanceScreen() {
  const p = getTempPeriod();
  document.getElementById("screenTitle").textContent = "Trial Balance";
  document.getElementById("screenSub").textContent = "Click Ledger to Open Statement | Click Group for Group Summary | F2: Period";

  const balMap = computeAllLedgerBalances(p.from, p.to);
  let totDr = 0, totCr = 0;

  const rows = (DB.ledgers || []).map((l, i) => {
    const b = balMap[l.id] || { netSigned: 0 };
    const dr = b.netSigned > 0 ? b.netSigned : 0, cr = b.netSigned < 0 ? Math.abs(b.netSigned) : 0;
    totDr = +(totDr + dr).toFixed(2); totCr = +(totCr + cr).toFixed(2);
    return `
      <tr onclick="openLedgerFromGroup('${l.id}')" style="cursor:pointer;">
        <td>${i + 1}</td>
        <td><b>${escHtml(l.name)}</b></td>
        <td onclick="event.stopPropagation(); openGroupSummary('${escHtml(l.group)}')" style="color:#0f6e4e;font-weight:700;text-decoration:underline;">${escHtml(l.group)}</td>
        <td class="num">${dr ? `₹${fmtINR(dr)}` : "-"}</td>
        <td class="num">${cr ? `₹${fmtINR(cr)}` : "-"}</td>
      </tr>`;
  }).join("");

  const diff = +(totDr - totCr).toFixed(2);
  document.getElementById("screenBody").innerHTML = `
    <div style="display:flex;justify-content:flex-end;margin-bottom:8px;">
      <button class="btn btn-sec" style="padding:3px 10px;font-size:11.5px;" onclick="openDirectF2DateModal()">📅 ${fmtDate(p.from)} to ${fmtDate(p.to)} (F2)</button>
    </div>
    <div class="form-card" style="padding:0;overflow:hidden;">
      <table class="tally-tbl">
        <thead><tr><th>#</th><th>Ledger Name</th><th>Group (Click for Summary)</th><th class="num">Debit (₹)</th><th class="num">Credit (₹)</th></tr></thead>
        <tbody>${rows}</tbody>
        <tfoot><tr style="background:#f1f5f9;font-weight:800;"><td colspan="3" style="text-align:right;">Grand Total:</td><td class="num">₹${fmtINR(totDr)}</td><td class="num">₹${fmtINR(totCr)}</td></tr></tfoot>
      </table>
      <div style="padding:9px;text-align:center;font-weight:700;background:${diff === 0 ? "#ecfdf5" : "#fef2f2"};color:${diff === 0 ? "var(--ok)" : "var(--danger)"};">
        ${diff === 0 ? "✔ Trial Balance 100% Matched" : `⚠ Difference: ₹${fmtINR(Math.abs(diff))}`}
      </div>
    </div>`;
}

function computeDetailedPnL(balMap) {
  const directExpList = [], directIncList = [], indirectExpList = [], indirectIncList = [];
  let directExp = 0, directInc = 0, indirectExp = 0, indirectInc = 0;

  Object.values(balMap).forEach(b => {
    if (Math.abs(b.netSigned) < 0.005) return;
    const grp = b.ledger.group, gObj = getGroupObj(grp);
    if (gObj.nature === "Expenses") {
      const amt = b.netSigned;
      if (gObj.affectsGP || grp === "Purchase Accounts" || grp === "Direct Expenses") { directExp += amt; directExpList.push({ id: b.ledger.id, name: b.ledger.name, group: grp, amount: amt }); }
      else { indirectExp += amt; indirectExpList.push({ id: b.ledger.id, name: b.ledger.name, group: grp, amount: amt }); }
    } else if (gObj.nature === "Income") {
      const amt = -b.netSigned;
      if (gObj.affectsGP || grp === "Sales Accounts" || grp === "Direct Incomes") { directInc += amt; directIncList.push({ id: b.ledger.id, name: b.ledger.name, group: grp, amount: amt }); }
      else { indirectInc += amt; indirectIncList.push({ id: b.ledger.id, name: b.ledger.name, group: grp, amount: amt }); }
    }
  });
  const grossProfit = +(directInc - directExp).toFixed(2);
  const netProfit = +((grossProfit + indirectInc) - indirectExp).toFixed(2);
  return { directExpList, directIncList, indirectExpList, indirectIncList, directExp, directInc, indirectExp, indirectInc, grossProfit, netProfit };
}

function renderPnlScreen() {
  const p = getTempPeriod(), isTrust = isTrustEntity();
  document.getElementById("screenTitle").textContent = isTrust ? "Income & Expenditure Account" : "Profit & Loss Account";
  document.getElementById("screenSub").textContent = "Click any Ledger to Open Statement | F2: Period";

  const pnl = computeDetailedPnL(computeAllLedgerBalances(p.from, p.to));
  const ledList = arr => arr.map(x => `<div class="tally-sub-led" onclick="drillToLedger('${x.id}')"><span>📄 ${escHtml(x.name)}</span><span class="num">₹${fmtINR(x.amount)}</span></div>`).join("");
  const grand = Math.max(pnl.directExp + pnl.indirectExp + Math.max(0, pnl.netProfit), pnl.directInc + pnl.indirectInc + Math.max(0, -pnl.netProfit));

  document.getElementById("screenBody").innerHTML = `
    <div style="display:flex;justify-content:flex-end;margin-bottom:8px;">
      <button class="btn btn-sec" style="padding:3px 10px;font-size:11.5px;" onclick="openDirectF2DateModal()">📅 ${fmtDate(p.from)} to ${fmtDate(p.to)} (F2)</button>
    </div>
    <div class="tally-sheet-grid">
      <div class="tally-sheet-col">
        <div>
          <div class="tally-col-head"><span>${isTrust ? "EXPENDITURE (DR)" : "EXPENSES (DR)"}</span><span>AMOUNT (₹)</span></div>
          ${pnl.directExpList.length ? `<div class="tally-grp-block"><div class="tally-grp-title"><span>Direct Expenses / Purchases</span><span class="num">₹${fmtINR(pnl.directExp)}</span></div>${ledList(pnl.directExpList)}</div>` : ""}
          <div class="tally-grp-block"><div class="tally-grp-title"><span>Indirect Expenses</span><span class="num">₹${fmtINR(pnl.indirectExp)}</span></div>${ledList(pnl.indirectExpList)}</div>
          ${pnl.netProfit >= 0 ? `<div class="tally-grp-block" style="background:#ecfdf5;"><div class="tally-grp-title" style="color:var(--ok);"><span>${isTrust ? "Surplus" : "Net Profit"}</span><span class="num">₹${fmtINR(pnl.netProfit)}</span></div></div>` : ""}
        </div>
        <div class="tally-col-foot"><span>Total</span><span class="num">₹${fmtINR(grand)}</span></div>
      </div>
      <div class="tally-sheet-col">
        <div>
          <div class="tally-col-head"><span>${isTrust ? "INCOME / DONATIONS (CR)" : "INCOMES (CR)"}</span><span>AMOUNT (₹)</span></div>
          ${pnl.directIncList.length ? `<div class="tally-grp-block"><div class="tally-grp-title"><span>Sales / Direct Incomes</span><span class="num">₹${fmtINR(pnl.directInc)}</span></div>${ledList(pnl.directIncList)}</div>` : ""}
          <div class="tally-grp-block"><div class="tally-grp-title"><span>Indirect Incomes</span><span class="num">₹${fmtINR(pnl.indirectInc)}</span></div>${ledList(pnl.indirectIncList)}</div>
          ${pnl.netProfit < 0 ? `<div class="tally-grp-block" style="background:#fef2f2;"><div class="tally-grp-title" style="color:var(--danger);"><span>${isTrust ? "Deficit" : "Net Loss"}</span><span class="num">₹${fmtINR(Math.abs(pnl.netProfit))}</span></div></div>` : ""}
        </div>
        <div class="tally-col-foot"><span>Total</span><span class="num">₹${fmtINR(grand)}</span></div>
      </div>
    </div>`;
}

function renderBalanceSheetScreen() {
  const p = getTempPeriod(), isTrust = isTrustEntity();
  const balMap = computeAllLedgerBalances(p.from, p.to);
  const pnl = computeDetailedPnL(balMap);

  if (window._BS_ACTIVE_GROUP_DRILL) {
    openGroupSummary(window._BS_ACTIVE_GROUP_DRILL);
    window._BS_ACTIVE_GROUP_DRILL = null;
    return;
  }

  document.getElementById("screenTitle").textContent = `Balance Sheet as on ${fmtDate(p.to)}`;
  document.getElementById("screenSub").textContent = "Click any Group 📁 for Group Summary | Toggle Detailed View | F2: Period";

  const liabGroups = {}, assetGroups = {};
  let totalLiab = 0, totalAsset = 0;

  Object.values(balMap).forEach(b => {
    const grp = b.ledger.group, gObj = getGroupObj(grp);
    if (gObj.nature !== "Liabilities" && gObj.nature !== "Assets") return;
    if (!SHOW_ZERO_BALANCES && Math.abs(b.netSigned) < 0.005) return;
    if (gObj.nature === "Liabilities") {
      const amt = -b.netSigned; totalLiab += amt;
      if (!liabGroups[grp]) liabGroups[grp] = { total: 0, items: [] };
      liabGroups[grp].total += amt; liabGroups[grp].items.push({ id: b.ledger.id, name: b.ledger.name, amount: amt });
    } else {
      const amt = b.netSigned; totalAsset += amt;
      if (!assetGroups[grp]) assetGroups[grp] = { total: 0, items: [] };
      assetGroups[grp].total += amt; assetGroups[grp].items.push({ id: b.ledger.id, name: b.ledger.name, amount: amt });
    }
  });

  if (pnl.netProfit >= 0) totalLiab += pnl.netProfit;
  else totalAsset += Math.abs(pnl.netProfit);

  const renderBlocks = map => Object.entries(map).map(([gName, d]) => `
    <div class="tally-grp-block clickable" onclick="openGroupSummary('${escHtml(gName)}')">
      <div class="tally-grp-title"><span>📁 ${escHtml(gName)} <small style="color:var(--pri);">(${d.items.length})</small></span><span class="num">₹${fmtINR(d.total)}</span></div>
      ${BS_DETAILED_MODE ? d.items.map(it => `<div class="tally-sub-led" onclick="event.stopPropagation(); drillToLedger('${it.id}')"><span>↳ 📄 ${escHtml(it.name)}</span><span class="num">₹${fmtINR(it.amount)}</span></div>`).join("") : ""}
    </div>`).join("");

  document.getElementById("screenBody").innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;flex-wrap:wrap;gap:8px;">
      <button class="btn btn-sec" onclick="BS_DETAILED_MODE=!BS_DETAILED_MODE; renderBalanceSheetScreen();">${BS_DETAILED_MODE ? "🔽 Condensed View" : "📂 Detailed View (Show Ledgers)"}</button>
      <div style="display:flex;gap:10px;align-items:center;">
        <label style="font-size:12px;cursor:pointer;"><input type="checkbox" ${SHOW_ZERO_BALANCES ? "checked" : ""} onchange="SHOW_ZERO_BALANCES=this.checked; renderBalanceSheetScreen();"> Show ₹0</label>
        <button class="btn btn-sec" onclick="openDirectF2DateModal()">📅 ${fmtDate(p.from)} to ${fmtDate(p.to)} (F2)</button>
      </div>
    </div>
    <div class="tally-sheet-grid">
      <div class="tally-sheet-col">
        <div>
          <div class="tally-col-head"><span>${isTrust ? "FUNDS & LIABILITIES" : "LIABILITIES & CAPITAL"}</span><span>AMOUNT (₹)</span></div>
          ${renderBlocks(liabGroups)}
          ${pnl.netProfit >= 0 ? `<div class="tally-grp-block clickable" style="background:#ecfdf5;" onclick="navigate('pnl_report')"><div class="tally-grp-title" style="color:var(--pri-dark);"><span>📈 ${isTrust ? "Surplus" : "Net Profit"}</span><span class="num">₹${fmtINR(pnl.netProfit)}</span></div></div>` : ""}
        </div>
        <div class="tally-col-foot"><span>Total Liabilities</span><span class="num">₹${fmtINR(totalLiab)}</span></div>
      </div>
      <div class="tally-sheet-col">
        <div>
          <div class="tally-col-head"><span>ASSETS</span><span>AMOUNT (₹)</span></div>
          ${renderBlocks(assetGroups)}
          ${pnl.netProfit < 0 ? `<div class="tally-grp-block clickable" style="background:#fef2f2;" onclick="navigate('pnl_report')"><div class="tally-grp-title" style="color:var(--danger);"><span>📉 ${isTrust ? "Deficit" : "Net Loss"}</span><span class="num">₹${fmtINR(Math.abs(pnl.netProfit))}</span></div></div>` : ""}
        </div>
        <div class="tally-col-foot"><span>Total Assets</span><span class="num">₹${fmtINR(totalAsset)}</span></div>
      </div>
    </div>`;
}

// ============================================================================
// 6. OUTSTANDING (RECEIVABLES / PAYABLES), STOCK SUMMARY & GSTR-1 / 3B
// ============================================================================
const OS_STATE = { kind: "D", q: "" };
function renderOutstandingScreen() {
  document.getElementById("screenTitle").textContent = "Outstanding — " + (OS_STATE.kind === "D" ? "Receivables (Debtors)" : "Payables (Creditors)");
  document.getElementById("screenSub").textContent = "Click any Party to Open Ledger Statement";

  const balMap = computeAllLedgerBalances();
  const q = OS_STATE.q.trim().toLowerCase();
  const targetGrp = OS_STATE.kind === "D" ? "Sundry Debtors" : "Sundry Creditors";
  let grand = 0;

  const rows = (DB.ledgers || [])
    .filter(l => l.group === targetGrp && (!q || l.name.toLowerCase().includes(q)))
    .map((l, i) => {
      const b = balMap[l.id] || { netSigned: 0 };
      if (Math.abs(b.netSigned) < 0.01) return "";
      grand += Math.abs(b.netSigned);
      return `
        <tr onclick="drillToLedger('${l.id}')" style="cursor:pointer;">
          <td>${i + 1}</td>
          <td><b style="color:#0f6e4e;text-decoration:underline;">${escHtml(l.name)}</b></td>
          <td>${escHtml(l.gstin || "-")}</td>
          <td class="num"><b>₹${fmtINR(Math.abs(b.netSigned))} ${b.netSigned >= 0 ? "Dr" : "Cr"}</b></td>
        </tr>`;
    }).join("");

  document.getElementById("screenBody").innerHTML = `
    <div style="display:flex;gap:8px;align-items:center;margin-bottom:10px;flex-wrap:wrap;">
      <button class="btn ${OS_STATE.kind === "D" ? "" : "btn-sec"}" onclick="OS_STATE.kind='D'; renderOutstandingScreen();">Receivables (Debtors)</button>
      <button class="btn ${OS_STATE.kind === "C" ? "" : "btn-sec"}" onclick="OS_STATE.kind='C'; renderOutstandingScreen();">Payables (Creditors)</button>
      <input placeholder="🔍 Search Party..." value="${escHtml(OS_STATE.q)}" oninput="OS_STATE.q=this.value; renderOutstandingScreen();" style="margin-left:auto;padding:6px 10px;min-width:220px;">
    </div>
    <div class="form-card" style="padding:0;overflow:hidden;">
      <table class="tally-tbl">
        <thead><tr><th>#</th><th>Party Name</th><th>GSTIN</th><th class="num">Pending Balance</th></tr></thead>
        <tbody>${rows || `<tr><td colspan="4" style="text-align:center;padding:20px;color:var(--muted);">Koi pending balance nahi hai.</td></tr>`}</tbody>
        <tfoot><tr style="background:#f1f5f9;font-weight:800;"><td colspan="3" style="text-align:right;">Total Outstanding:</td><td class="num">₹${fmtINR(grand)}</td></tr></tfoot>
      </table>
    </div>`;
}

function renderStockSummaryScreen() {
  ensureStockGroupsInitialized();
  document.getElementById("screenTitle").textContent = "Inventory Stock Summary (Group-wise)";
  document.getElementById("screenSub").textContent = "Opening + Inward - Outward = Closing Stock Valuation";

  const stockMap = computeInventoryStockSummary();
  let totVal = 0;
  const filterOpts = `<option value="ALL">All Stock Groups (${DB.items.length})</option>` +
    DB.stockGroups.map(sg => `<option value="${escHtml(sg.name)}" ${SELECTED_STOCK_GROUP_FILTER === sg.name ? "selected" : ""}>${escHtml(sg.name)}</option>`).join("");

  const list = Object.values(stockMap).filter(st => SELECTED_STOCK_GROUP_FILTER === "ALL" || (st.item.stockGroup || "Finished Goods") === SELECTED_STOCK_GROUP_FILTER);
  const rows = list.map((st, i) => {
    totVal += st.closeVal;
    return `
      <tr>
        <td>${i + 1}</td><td><b>${escHtml(st.item.name)}</b></td><td><span class="kbd">${escHtml(st.item.stockGroup)}</span></td>
        <td>${escHtml(st.item.hsn || "-")}</td><td class="num">${st.opQty} ${st.item.uom}</td>
        <td class="num" style="color:var(--ok);">+${st.inQty}</td><td class="num" style="color:var(--danger);">-${st.outQty}</td>
        <td class="num"><b>${st.closeQty} ${st.item.uom}</b></td><td class="num">₹${fmtINR(st.avgRate)}</td>
        <td class="num"><b>₹${fmtINR(st.closeVal)}</b></td>
      </tr>`;
  }).join("");

  document.getElementById("screenBody").innerHTML = `
    <div class="form-card" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
      <select style="padding:6px 10px;font-weight:700;" onchange="SELECTED_STOCK_GROUP_FILTER=this.value; renderStockSummaryScreen();">${filterOpts}</select>
      <div style="display:flex;gap:6px;flex-wrap:wrap;">
        <button class="btn btn-sec" onclick="navigate('masters_item')">📦 +Item</button>
        <button class="btn" onclick="openInventoryVoucherModal('Stock Journal')">🛠️ Stock Journal</button>
        <button class="btn btn-sec" onclick="openInventoryVoucherModal('Physical Stock')">📋 Physical Stock</button>
        <button class="btn btn-sec" onclick="openBomProductionScreen()">🏭 BOM Prod</button>
      </div>
    </div>
    <div class="form-card" style="padding:0;overflow:hidden;">
      <table class="tally-tbl">
        <thead><tr><th>#</th><th>Item</th><th>Stock Group</th><th>HSN</th><th class="num">Opening</th><th class="num">Inward</th><th class="num">Outward</th><th class="num">Closing</th><th class="num">Avg Cost</th><th class="num">Value (₹)</th></tr></thead>
        <tbody>${rows || `<tr><td colspan="10" style="text-align:center;padding:18px;color:var(--muted);">No Stock Items.</td></tr>`}</tbody>
        <tfoot><tr style="background:#f1f5f9;font-weight:800;"><td colspan="9" style="text-align:right;">Total Closing Value:</td><td class="num">₹${fmtINR(totVal)}</td></tr></tfoot>
      </table>
    </div>`;
}

function renderGstr1Screen() {
  document.getElementById("screenTitle").textContent = "GSTR-1 (Outward Supplies)";
  document.getElementById("screenSub").textContent = "B2B, B2CL, B2CS Summary & JSON Export";
  const sales = (DB.vouchers || []).filter(v => v.type === "Sales" && v.gst && !v.cancelled);
  const rows = sales.map((v, i) => {
    const party = getLedger(v.partyLedgerId);
    return `
      <tr>
        <td>${i + 1}</td><td>${fmtDate(v.date)}</td><td><b>${escHtml(v.vchNo)}</b></td>
        <td>${escHtml(party ? party.name : "-")}</td><td><span class="kbd">${escHtml(party?.gstin || "Unreg")}</span></td>
        <td><span class="kbd" style="background:#fef08a;">${v.gst.gstrCategory}</span></td>
        <td class="num">₹${fmtINR(v.gst.taxable)}</td>
        <td class="num">₹${fmtINR(v.gst.cgst + v.gst.sgst + v.gst.igst)}</td>
        <td class="num"><b>₹${fmtINR(v.gst.netInvoice)}</b></td>
        <td><button class="btn btn-sec" style="padding:2px 7px;font-size:11px;" onclick="printTaxInvoice('${v.id}')">Print</button></td>
      </tr>`;
  }).join("");

  document.getElementById("screenBody").innerHTML = `
    <div class="form-card" style="display:flex;justify-content:space-between;align-items:center;">
      <b>GSTR-1 Outward Supplies (${sales.length} Invoices)</b>
      <button class="btn" onclick="exportGstr1JSON()">📥 Download GSTR-1 JSON</button>
    </div>
    <div class="form-card" style="padding:0;overflow:hidden;">
      <table class="tally-tbl">
        <thead><tr><th>#</th><th>Date</th><th>Inv No</th><th>Customer</th><th>GSTIN</th><th>Cat</th><th class="num">Taxable</th><th class="num">Tax</th><th class="num">Total</th><th></th></tr></thead>
        <tbody>${rows || `<tr><td colspan="10" style="text-align:center;padding:20px;color:var(--muted);">No GST Sales invoices yet.</td></tr>`}</tbody>
      </table>
    </div>`;
}

function exportGstr1JSON() {
  const sales = (DB.vouchers || []).filter(v => v.type === "Sales" && v.gst && !v.cancelled);
  const a = document.createElement("a");
  a.href = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(sales, null, 2));
  a.download = `GSTR1_${DB.company.gstin || "export"}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  toast("📥 GSTR-1 JSON Downloaded!");
}

function renderGstr3bScreen() {
  document.getElementById("screenTitle").textContent = "GSTR-3B Summary (Tax Payable & ITC)";
  document.getElementById("screenSub").textContent = "Output GST Liability vs Input Tax Credit";
  const balMap = computeAllLedgerBalances();
  let oC = 0, oS = 0, oI = 0, iC = 0, iS = 0, iI = 0;
  Object.values(balMap).forEach(b => {
    const id = b.ledger.id, net = b.netSigned;
    if (id === "L_CGST_OUT") oC += Math.abs(net);
    if (id === "L_SGST_OUT") oS += Math.abs(net);
    if (id === "L_IGST_OUT") oI += Math.abs(net);
    if (id === "L_CGST_IN") iC += net;
    if (id === "L_SGST_IN") iS += net;
    if (id === "L_IGST_IN") iI += net;
  });
  const payable = Math.max(0, oC - iC) + Math.max(0, oS - iS) + Math.max(0, oI - iI);
  document.getElementById("screenBody").innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
      <div class="form-card"><h3 style="color:var(--pri-dark);margin-bottom:8px;">OUTWARD TAX (Sales)</h3>
        <div class="info-row"><span>Output CGST</span><span class="num">₹${fmtINR(oC)}</span></div>
        <div class="info-row"><span>Output SGST</span><span class="num">₹${fmtINR(oS)}</span></div>
        <div class="info-row"><span>Output IGST</span><span class="num">₹${fmtINR(oI)}</span></div>
      </div>
      <div class="form-card"><h3 style="color:var(--pri-dark);margin-bottom:8px;">INPUT TAX CREDIT (Purchase)</h3>
        <div class="info-row"><span>Input CGST</span><span class="num">₹${fmtINR(iC)}</span></div>
        <div class="info-row"><span>Input SGST</span><span class="num">₹${fmtINR(iS)}</span></div>
        <div class="info-row"><span>Input IGST</span><span class="num">₹${fmtINR(iI)}</span></div>
      </div>
    </div>
    <div class="form-card" style="text-align:center;background:#ecfdf5;border-color:var(--pri);">
      <div style="font-size:13px;font-weight:700;color:var(--pri-dark);">NET GST PAYABLE IN CASH</div>
      <div style="font-size:24px;font-weight:800;color:var(--pri);">₹${fmtINR(payable)}</div>
    </div>`;
}

// ============================================================================
// 7. GST TAX INVOICE PRINT & UNIVERSAL A4 SMART PRINT (ALT+P)
// ============================================================================
function printTaxInvoice(vid) {
  const v = (DB.vouchers || []).find(x => x.id === vid); if (!v) return;
  const party = getLedger(v.partyLedgerId), c = DB.company;
  const itemsHtml = (v.itemLines || []).map((ln, i) => `
    <tr>
      <td>${i + 1}</td><td><b>${escHtml(ln.itemName || "")}</b></td><td>${escHtml(ln.hsn || "")}</td>
      <td class="num">${ln.qty} ${ln.uom}</td><td class="num">₹${fmtINR(ln.rate)}</td>
      <td class="num">₹${fmtINR(ln.taxable)}</td><td class="num">${ln.gstRate}%</td><td class="num">₹${fmtINR(ln.lineTotal)}</td>
    </tr>`).join("");
  const body = `
    <div style="font-size:12px;color:#000;">
      <div style="text-align:center;border-bottom:2px solid #000;padding-bottom:6px;margin-bottom:8px;">
        <h2 style="font-size:16px;">TAX INVOICE</h2>
        <div style="font-weight:700;">${escHtml(c.name)}</div>
        <div>${escHtml(c.address || "")} | GSTIN: <b>${escHtml(c.gstin || "Unregistered")}</b></div>
      </div>
      <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
        <div><b>Buyer:</b> ${escHtml(party?.name || "-")}<br>GSTIN: ${escHtml(party?.gstin || "Unregistered")}</div>
        <div style="text-align:right;">Inv No: <b>${escHtml(v.vchNo)}</b><br>Date: <b>${fmtDate(v.date)}</b></div>
      </div>
      <table class="tally-tbl">
        <thead><tr><th>#</th><th>Item</th><th>HSN</th><th class="num">Qty</th><th class="num">Rate</th><th class="num">Taxable</th><th class="num">GST%</th><th class="num">Total</th></tr></thead>
        <tbody>${itemsHtml}</tbody>
      </table>
      <div style="text-align:right;font-size:14px;font-weight:800;margin-top:8px;">Grand Total: ₹${fmtINR(v.amount)}</div>
    </div>`;
  showModal("GST Tax Invoice Print Preview", body, `<button class="btn" onclick="smartPrint()">🖨️ Print</button>`);
}

function smartPrint() {
  const modalOpen = kbOverlayOpen();
  const title = (modalOpen ? document.getElementById("modalTitle") : document.getElementById("screenTitle"))?.textContent || "";
  const srcEl = modalOpen ? document.getElementById("modalBody") : document.getElementById("screenBody");
  if (!srcEl) return window.print();

  const area = document.getElementById("printArea");
  const c = DB.company || {};
  area.innerHTML = `
    <div style="text-align:center;border-bottom:2px solid #000;padding-bottom:6px;margin-bottom:8px;">
      <div style="font-size:17px;font-weight:800;">${escHtml(c.name || "")}</div>
      <div style="font-size:11px;">${escHtml(c.address || "")}${c.gstin ? " | GSTIN: <b>" + escHtml(c.gstin) + "</b>" : ""}</div>
    </div>
    <div style="text-align:center;font-size:14px;font-weight:700;margin-bottom:8px;">${escHtml(title.trim())}</div>`;

  const clone = srcEl.cloneNode(true);
  const origInputs = srcEl.querySelectorAll("input,select,textarea");
  const cloneInputs = clone.querySelectorAll("input,select,textarea");
  origInputs.forEach((el, i) => {
    const t = cloneInputs[i]; if (!t) return;
    const sp = document.createElement("span");
    sp.className = "pr-val";
    sp.textContent = el.tagName === "SELECT" ? (el.options[el.selectedIndex]?.text || "") : (el.type === "checkbox" ? (el.checked ? "✔" : "✘") : el.value);
    if (el.type === "hidden") sp.style.display = "none";
    t.replaceWith(sp);
  });
  area.appendChild(clone);
  document.body.classList.add("printing");
  const done = () => { document.body.classList.remove("printing"); area.innerHTML = ""; window.removeEventListener("afterprint", done); };
  window.addEventListener("afterprint", done);
  setTimeout(() => window.print(), 60);
}
