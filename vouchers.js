// ============================================================================
// VOUCHERS.JS: F4-F9 VOUCHERS, GST INVOICE, DR/CR, BILL-WISE, INVENTORY & BOM
// ============================================================================

const VCH_NO_MODE_KEY = "VCH_NO_MODE";
let VCH_NO_MODE = "auto";
try { VCH_NO_MODE = localStorage.getItem(VCH_NO_MODE_KEY) || "auto"; } catch {}

let VCH_STATE = {
  editingId: null,
  vchType: "Sales",
  mode: "item",
  vchNo: "",
  date: "",
  refNo: "",
  partyLedgerId: "L_PARTY_LOCAL",
  salesPurcLedgerId: "L_SALES_GST",
  posState: "",
  rcm: false,
  billRefType: "New Ref",
  billRefName: "",
  narration: "",
  applyRoundOff: true,
  itemLines: [],
  acctLines: []
};

function isItemCapableVoucher(type) {
  return ["Sales", "Purchase", "Credit Note", "Debit Note"].includes(type);
}

function nextVoucherNumber(type) {
  const prefixMap = {
    "Sales": "INV/", "Purchase": "PUR/", "Payment": "PMT/",
    "Receipt": "RCT/", "Contra": "CNT/", "Journal": "JRN/",
    "Credit Note": "CRN/", "Debit Note": "DRN/"
  };
  const pref = prefixMap[type] || "VCH/";
  const count = (DB.vouchers || []).filter(v => v.type === type).length + 1;
  return pref + String(count).padStart(4, "0");
}

function createBlankItemLine() {
  const first = (DB.items || [])[0] || { id: "", name: "", hsn: "8504", uom: "NOS", gstRate: 18, rate: 0 };
  return {
    itemId: first.id, itemName: first.name, hsn: first.hsn || "",
    uom: first.uom || "NOS", qty: 1, rate: first.rate || 0, discPct: 0, gstRate: first.gstRate ?? 18
  };
}

function createDefaultAcctLines(type) {
  if (type === "Receipt") return [{ type: "Cr", ledgerId: "", amount: 0 }, { type: "Dr", ledgerId: "", amount: 0 }];
  return [{ type: "Dr", ledgerId: "", amount: 0 }, { type: "Cr", ledgerId: "", amount: 0 }];
}

function initVoucherState(type = "Sales", existingVoucher = null) {
  if (existingVoucher) {
    const v = existingVoucher;
    VCH_STATE = {
      editingId: v.id,
      vchType: v.type || "Sales",
      mode: v.mode || (v.gst && v.itemLines && v.itemLines.length ? "item" : "acct"),
      vchNo: v.vchNo || nextVoucherNumber(v.type),
      date: v.date || DB.company.curDate,
      refNo: v.refNo || "",
      partyLedgerId: v.partyLedgerId || (v.type === "Purchase" ? "L_PARTY_INTER" : "L_PARTY_LOCAL"),
      salesPurcLedgerId: v.salesPurcLedgerId || (v.type === "Purchase" || v.type === "Debit Note" ? "L_PURC_GST" : "L_SALES_GST"),
      posState: v.posState || "",
      rcm: Boolean(v.rcm),
      billRefType: (v.bill && v.bill.type) || "New Ref",
      billRefName: (v.bill && v.bill.ref) || v.vchNo || "",
      narration: v.narration || "",
      applyRoundOff: v.applyRoundOff !== false,
      itemLines: v.itemLines && v.itemLines.length ? JSON.parse(JSON.stringify(v.itemLines)) : [createBlankItemLine()],
      acctLines: v.entries && v.entries.length ? JSON.parse(JSON.stringify(v.entries)) : createDefaultAcctLines(v.type)
    };
    return;
  }

  const vNo = nextVoucherNumber(type);
  VCH_STATE = {
    editingId: null,
    vchType: type,
    mode: isItemCapableVoucher(type) ? "item" : "acct",
    vchNo: vNo,
    date: DB.company.curDate,
    refNo: "",
    partyLedgerId: (type === "Purchase" || type === "Debit Note") ? "L_PARTY_INTER" : "L_PARTY_LOCAL",
    salesPurcLedgerId: (type === "Purchase" || type === "Debit Note") ? "L_PURC_GST" : "L_SALES_GST",
    posState: "",
    rcm: false,
    billRefType: "New Ref",
    billRefName: vNo,
    narration: "",
    applyRoundOff: true,
    itemLines: [createBlankItemLine()],
    acctLines: createDefaultAcctLines(type)
  };
}

function openVoucherScreen(type = "Sales", editVoucherId = null) {
  if (CURRENT_SCREEN !== "voucher_entry") window._LAST_REPORT_SCREEN = CURRENT_SCREEN;
  const found = editVoucherId ? (DB.vouchers || []).find(v => v.id === editVoucherId) : null;
  initVoucherState(found ? found.type : type, found);
  navigate("voucher_entry");
  setTimeout(() => {
    const target = VCH_NO_MODE === "auto" && !VCH_STATE.editingId
      ? document.getElementById("vchDateInp")
      : document.getElementById("vchNoInp");
    if (target) { target.focus(); if (target.select) try { target.select(); } catch {} }
  }, 50);
}

function toggleVchNoMode() {
  VCH_NO_MODE = VCH_NO_MODE === "auto" ? "manual" : "auto";
  try { localStorage.setItem(VCH_NO_MODE_KEY, VCH_NO_MODE); } catch {}
  if (VCH_NO_MODE === "auto" && !VCH_STATE.editingId) {
    VCH_STATE.vchNo = nextVoucherNumber(VCH_STATE.vchType);
  }
  renderVoucherEntryScreen();
  toast(VCH_NO_MODE === "auto" ? "🔢 Voucher No.: Automatic" : "✍ Voucher No.: Manual");
}

function toggleVoucherMode() {
  syncVoucherHeaderFromDOM();
  VCH_STATE.mode = VCH_STATE.mode === "item" ? "acct" : "item";
  renderVoucherEntryScreen();
  toast(`🔄 Mode: ${VCH_STATE.mode === "item" ? "Item GST Invoice" : "Dr/Cr Double Entry"}`);
}

function syncVoucherHeaderFromDOM() {
  const g = id => { const el = document.getElementById(id); return el ? el.value : null; };
  if (g("vchNoInp") !== null) VCH_STATE.vchNo = g("vchNoInp");
  if (g("vchDateInp") !== null) VCH_STATE.date = g("vchDateInp");
  if (g("vchRefInp") !== null) VCH_STATE.refNo = g("vchRefInp");
  if (g("vchNarrInp") !== null) VCH_STATE.narration = g("vchNarrInp");
}

function onVoucherQuickLedgerCreated(newLedgerId) {
  if (VCH_STATE.mode === "item") VCH_STATE.partyLedgerId = newLedgerId;
  else if (VCH_STATE.acctLines.length) {
    const emptyLine = VCH_STATE.acctLines.find(l => !l.ledgerId) || VCH_STATE.acctLines[0];
    emptyLine.ledgerId = newLedgerId;
  }
  renderVoucherEntryScreen();
}

function renderVoucherEntryScreen() {
  const s = VCH_STATE;
  const colors = {
    "Sales": "#0f6e4e", "Purchase": "#7c2d12", "Payment": "#b91c1c",
    "Receipt": "#15803d", "Contra": "#1d4ed8", "Journal": "#6d28d9",
    "Credit Note": "#0369a1", "Debit Note": "#9a3412"
  };
  const hdrColor = colors[s.vchType] || "var(--pri)";

  document.getElementById("screenTitle").innerHTML = `
    <span style="background:${hdrColor}; padding:2px 10px; border-radius:3px; border:1px solid #fff;">
      ${s.editingId ? "✏️ ALTER" : "➕ CREATE"} ${s.vchType.toUpperCase()} VOUCHER
    </span>
    <span style="font-size:12px; margin-left:8px; font-weight:400;">No: <b>${escHtml(s.vchNo)}</b></span>`;
  document.getElementById("screenSub").textContent = "Alt+N: Auto/Manual No | Alt+C: +Ledger | Ctrl+A: Save | Esc: Switch Type / Back";

  const vchTypes = ["Contra", "Payment", "Receipt", "Journal", "Sales", "Purchase", "Credit Note", "Debit Note"];
  const typeTabs = vchTypes.map(t => `
    <button class="btn ${s.vchType === t ? "" : "btn-sec"}"
      style="padding:4px 9px; font-size:11.5px; ${s.vchType === t ? `background:${colors[t]};border-color:${colors[t]};` : ""}"
      onclick="openVoucherScreen('${t}')">${t}</button>`).join("");

  let bodyHtml = `
    <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:6px; margin-bottom:10px;">
      <div style="display:flex; gap:4px; flex-wrap:wrap;">${typeTabs}</div>
      <div style="display:flex; gap:6px;">
        ${isItemCapableVoucher(s.vchType) ? `<button class="btn btn-sec" onclick="toggleVoucherMode()">⇄ Mode: <b>${s.mode === "item" ? "Item GST Invoice" : "Dr/Cr Double Entry"}</b></button>` : ""}
        <button class="btn btn-sec" onclick="openQuickLedgerModal('onVoucherQuickLedgerCreated')">⚡ +Ledger (Alt+C)</button>
      </div>
    </div>`;

  bodyHtml += (s.mode === "item" && isItemCapableVoucher(s.vchType))
    ? renderItemInvoiceSubScreen()
    : renderAcctDoubleEntrySubScreen();

  document.getElementById("screenBody").innerHTML = bodyHtml;
}

// ============================================================================
// SUB-SCREEN A: ITEM GST INVOICE MODE
// ============================================================================
function renderItemInvoiceSubScreen() {
  const s = VCH_STATE;
  const isAutoNo = VCH_NO_MODE === "auto" && !s.editingId;
  const partyOpts = (DB.ledgers || [])
    .filter(l => ["Sundry Debtors", "Sundry Creditors", "Cash-in-Hand", "Bank Accounts"].includes(l.group))
    .map(l => `<option value="${l.id}" ${l.id === s.partyLedgerId ? "selected" : ""}>${escHtml(l.name)} (${l.stateCode || DB.company.stateCode} | ${l.gstin || "Unreg"})</option>`).join("");

  const headGroup = (s.vchType === "Purchase" || s.vchType === "Debit Note") ? "Purchase Accounts" : "Sales Accounts";
  const headOpts = (DB.ledgers || [])
    .filter(l => l.group === headGroup)
    .map(l => `<option value="${l.id}" ${l.id === s.salesPurcLedgerId ? "selected" : ""}>${escHtml(l.name)}</option>`).join("");

  const gstCalc = calculateInvoiceGST(s.itemLines, s.partyLedgerId, s.applyRoundOff, s.posState);
  const sup = gstCalc.supply;
  const stateOpts = `<option value="">Auto (${sup.posState} - ${sup.posStateName})</option>` +
    Object.entries(GST_STATES).map(([c, nm]) => `<option value="${c}" ${s.posState === c ? "selected" : ""}>${c} - ${nm}</option>`).join("");

  const itemRowsHtml = gstCalc.lines.map((ln, idx) => {
    const itmOpts = (DB.items || []).map(it => `<option value="${it.id}" ${it.id === ln.itemId ? "selected" : ""}>${escHtml(it.name)}</option>`).join("");
    const slabOpts = GST_SLABS.map(sl => `<option value="${sl}" ${Number(ln.gstRate) === sl ? "selected" : ""}>${sl}%</option>`).join("");
    const taxStr = sup.isInter ? `IGST ${ln.igstRate}%: ₹${fmtINR(ln.igstAmt)}` : `CGST ${ln.cgstRate}% + SGST ${ln.sgstRate}%: ₹${fmtINR(ln.cgstAmt + ln.sgstAmt)}`;
    return `
      <tr>
        <td>${idx + 1}</td>
        <td style="min-width:180px;"><select style="width:100%;padding:4px;" onchange="onItemRowSelect(${idx}, this.value)">${itmOpts}</select></td>
        <td><input style="width:74px;padding:4px;" value="${escHtml(ln.hsn || "")}" oninput="updateItemRowField(${idx},'hsn',this.value)"></td>
        <td><input type="number" step="0.01" class="num" style="width:68px;padding:4px;" value="${ln.qty}" oninput="updateItemRowField(${idx},'qty',this.value)"></td>
        <td><input style="width:52px;padding:4px;" value="${escHtml(ln.uom || "NOS")}" oninput="updateItemRowField(${idx},'uom',this.value)"></td>
        <td><input type="number" step="0.01" class="num" style="width:88px;padding:4px;" value="${ln.rate}" oninput="updateItemRowField(${idx},'rate',this.value)"></td>
        <td><input type="number" step="0.01" class="num" style="width:54px;padding:4px;" value="${ln.discPct}" oninput="updateItemRowField(${idx},'discPct',this.value)"></td>
        <td class="num"><b>₹${fmtINR(ln.taxable)}</b></td>
        <td><select style="padding:4px;" onchange="updateItemRowField(${idx},'gstRate',this.value)">${slabOpts}</select></td>
        <td style="font-size:11px;color:#334155;">${taxStr}</td>
        <td class="num"><b>₹${fmtINR(ln.lineTotal)}</b></td>
        <td><button class="btn btn-danger" style="padding:2px 6px;" onclick="removeItemRow(${idx})">✕</button></td>
      </tr>`;
  }).join("");

  return `
    <div class="form-card">
      <div class="form-grid">
        <div class="field">
          <label>Voucher No. * ${!s.editingId ? `<button type="button" tabindex="-1" onclick="toggleVchNoMode()" style="margin-left:6px;padding:0 6px;font-size:10px;cursor:pointer;">${isAutoNo ? "🔢 Auto" : "✍ Manual"}</button>` : ""}</label>
          <input id="vchNoInp" value="${escHtml(s.vchNo)}" ${isAutoNo ? 'readonly style="background:#f1f5f9;"' : ""} oninput="VCH_STATE.vchNo=this.value">
        </div>
        <div class="field"><label>Voucher Date *</label><input type="date" id="vchDateInp" value="${s.date}" onchange="VCH_STATE.date=this.value"></div>
        <div class="field"><label>Supplier Inv / Ref No.</label><input id="vchRefInp" value="${escHtml(s.refNo)}" oninput="VCH_STATE.refNo=this.value"></div>
        <div class="field"><label>Party A/c (Bal: ${getLedgerClosingString(s.partyLedgerId)}) *</label><select id="vchPartyInp" onchange="VCH_STATE.partyLedgerId=this.value; renderVoucherEntryScreen();">${partyOpts}</select></div>
        <div class="field"><label>${headGroup} *</label><select id="vchHeadInp" onchange="VCH_STATE.salesPurcLedgerId=this.value">${headOpts}</select></div>
        <div class="field"><label>Place of Supply</label><select id="vchPosInp" onchange="VCH_STATE.posState=this.value; renderVoucherEntryScreen();">${stateOpts}</select></div>
        <div class="field"><label>Bill Ref Type</label>
          <select id="vchBillTypeInp" onchange="VCH_STATE.billRefType=this.value">
            <option ${s.billRefType === "New Ref" ? "selected" : ""}>New Ref</option>
            <option ${s.billRefType === "Agst Ref" ? "selected" : ""}>Agst Ref</option>
            <option ${s.billRefType === "Advance" ? "selected" : ""}>Advance</option>
            <option ${s.billRefType === "On Account" ? "selected" : ""}>On Account</option>
          </select>
        </div>
        <div class="field"><label>Bill Ref Name</label><input id="vchBillRefInp" value="${escHtml(s.billRefName || s.vchNo)}" oninput="VCH_STATE.billRefName=this.value"></div>
      </div>
      <div style="margin-top:8px; padding:6px 10px; background:var(--pri-light); border:1px solid var(--pri); border-radius:4px; display:flex; justify-content:space-between; font-size:12px;">
        <div><b>GST Engine:</b> ${sup.cmpState} → ${sup.posState} (${sup.posStateName}) | <span class="kbd" style="background:#fef08a;">${sup.isInter ? "INTER-STATE (IGST)" : "INTRA-STATE (CGST+SGST)"}</span></div>
        <div>GSTR-1: <b>${gstCalc.gstrCategory}</b></div>
      </div>
    </div>

    <div class="form-card" style="padding:0; overflow-x:auto;">
      <table class="tally-tbl">
        <thead><tr><th>#</th><th>Item</th><th>HSN</th><th class="num">Qty</th><th>UOM</th><th class="num">Rate</th><th class="num">Disc%</th><th class="num">Taxable</th><th>GST%</th><th>Tax Split</th><th class="num">Total</th><th></th></tr></thead>
        <tbody>${itemRowsHtml}</tbody>
      </table>
      <div style="padding:8px 10px; background:#f8fafc; border-top:1px solid var(--border); display:flex; justify-content:space-between;">
        <button class="btn btn-sec" onclick="addItemRow()">➕ Add Item Row</button>
        <label style="display:flex;align-items:center;gap:6px;font-size:12px;cursor:pointer;">
          <input type="checkbox" ${s.applyRoundOff ? "checked" : ""} onchange="VCH_STATE.applyRoundOff=this.checked; renderVoucherEntryScreen();"> Auto Round-Off
        </label>
      </div>
    </div>

    <div style="display:grid; grid-template-columns: 1fr 330px; gap:12px;">
      <div class="form-card">
        <div class="field"><label>Narration</label><textarea id="vchNarrInp" rows="3" oninput="VCH_STATE.narration=this.value">${escHtml(s.narration)}</textarea></div>
        <div style="margin-top:12px; display:flex; gap:8px;">
          <button class="btn" onclick="saveCurrentVoucher()">💾 Accept &amp; Save (Ctrl+A)</button>
          ${s.editingId ? `<button class="btn btn-sec" onclick="printTaxInvoice('${s.editingId}')">🖨️ Print Invoice</button>` : ""}
          <button class="btn btn-sec" onclick="goBack()">Cancel (Esc)</button>
        </div>
      </div>
      <div class="form-card" style="background:#f8fafc;">
        <div class="info-row"><span>Taxable Value</span><span class="num">₹${fmtINR(gstCalc.totalTaxable)}</span></div>
        <div class="info-row"><span>CGST</span><span class="num">₹${fmtINR(gstCalc.totalCGST)}</span></div>
        <div class="info-row"><span>SGST</span><span class="num">₹${fmtINR(gstCalc.totalSGST)}</span></div>
        <div class="info-row"><span>IGST</span><span class="num">₹${fmtINR(gstCalc.totalIGST)}</span></div>
        <div class="info-row"><span>Round Off</span><span class="num">${gstCalc.roundOff >= 0 ? "+" : ""}₹${fmtINR(gstCalc.roundOff)}</span></div>
        <div class="info-row" style="font-size:14px;font-weight:800;color:var(--pri-dark);border-top:2px solid var(--pri);margin-top:4px;padding-top:6px;">
          <span>Grand Total</span><span class="num">₹${fmtINR(gstCalc.netInvoice)}</span>
        </div>
      </div>
    </div>`;
}

function onItemRowSelect(idx, itemId) {
  syncVoucherHeaderFromDOM();
  const it = getItem(itemId); if (!it) return;
  VCH_STATE.itemLines[idx] = { ...VCH_STATE.itemLines[idx], itemId: it.id, itemName: it.name, hsn: it.hsn || "", uom: it.uom || "NOS", rate: it.rate || 0, gstRate: it.gstRate ?? 18 };
  renderVoucherEntryScreen();
}

function updateItemRowField(idx, field, val) {
  syncVoucherHeaderFromDOM();
  if (!VCH_STATE.itemLines[idx]) return;
  VCH_STATE.itemLines[idx][field] = ["qty", "rate", "discPct", "gstRate"].includes(field) ? (Number(val) || 0) : val;
  renderVoucherEntryScreen();
}

function addItemRow() { syncVoucherHeaderFromDOM(); VCH_STATE.itemLines.push(createBlankItemLine()); renderVoucherEntryScreen(); }
function removeItemRow(idx) {
  syncVoucherHeaderFromDOM();
  if (VCH_STATE.itemLines.length <= 1) { toast("⚠ Kam se kam 1 item row zaroori hai!"); return; }
  VCH_STATE.itemLines.splice(idx, 1); renderVoucherEntryScreen();
}

// ============================================================================
// SUB-SCREEN B: DOUBLE-ENTRY ACCOUNTING MODE (DR / CR) + BILL-WISE ALLOCATION
// ============================================================================
function getPartyKind(ledgerId) {
  const l = getLedger(ledgerId); if (!l) return "";
  let g = l.group, n = 0;
  while (g && n++ < 12) {
    if (g === "Sundry Debtors") return "D";
    if (g === "Sundry Creditors") return "C";
    const obj = (DB.groups || []).find(x => x.name === g);
    g = obj && obj.parent;
  }
  return "";
}

function renderAcctDoubleEntrySubScreen() {
  const s = VCH_STATE;
  const isAutoNo = VCH_NO_MODE === "auto" && !s.editingId;
  let totDr = 0, totCr = 0;

  const rowsHtml = s.acctLines.map((ln, idx) => {
    const amt = Number(ln.amount) || 0;
    if (ln.type === "Dr") totDr = +(totDr + amt).toFixed(2);
    else totCr = +(totCr + amt).toFixed(2);

    const ledOpts = '<option value="">-- Select Ledger --</option>' + (DB.ledgers || []).map(l =>
      `<option value="${l.id}" ${l.id === ln.ledgerId ? "selected" : ""}>${escHtml(l.name)} [${escHtml(l.group)}] (${getLedgerClosingString(l.id)})</option>`
    ).join("");

    const isParty = Boolean(getPartyKind(ln.ledgerId));
    const billBadge = isParty ? `
      <div class="ba-badge">
        <button type="button" tabindex="-1" onclick="openBillAllocModal(${idx})">📑 Bills (Alt+B)</button>
        <span>${ln.bills && ln.bills.length ? ln.bills.map(b => `${escHtml(b.type)}${b.ref ? ": " + escHtml(b.ref) : ""} ₹${fmtINR(b.amount)}`).join(" | ") : "Auto on Save"}</span>
      </div>` : "";

    return `
      <tr>
        <td style="width:85px;">
          <select style="width:100%;padding:5px;font-weight:700;" onchange="updateAcctRow(${idx},'type',this.value)">
            <option value="Dr" ${ln.type === "Dr" ? "selected" : ""}>Dr</option>
            <option value="Cr" ${ln.type === "Cr" ? "selected" : ""}>Cr</option>
          </select>
        </td>
        <td>
          <select style="width:100%;padding:5px;" onchange="updateAcctRow(${idx},'ledgerId',this.value)">${ledOpts}</select>
          ${billBadge}
        </td>
        <td class="num" style="width:155px;">
          ${ln.type === "Dr" ? `<input type="number" step="0.01" class="num acct-amt" data-idx="${idx}" style="width:135px;padding:5px;" value="${amt || ""}" placeholder="0.00" oninput="updateAcctRow(${idx},'amount',this.value)" onchange="onAcctAmountCommit(${idx})">` : "-"}
        </td>
        <td class="num" style="width:155px;">
          ${ln.type === "Cr" ? `<input type="number" step="0.01" class="num acct-amt" data-idx="${idx}" style="width:135px;padding:5px;" value="${amt || ""}" placeholder="0.00" oninput="updateAcctRow(${idx},'amount',this.value)" onchange="onAcctAmountCommit(${idx})">` : "-"}
        </td>
        <td style="width:45px;"><button class="btn btn-danger" style="padding:2px 6px;" onclick="removeAcctRow(${idx})">✕</button></td>
      </tr>`;
  }).join("");

  const diff = +(totDr - totCr).toFixed(2);
  return `
    <div class="form-card">
      <div class="form-grid">
        <div class="field">
          <label>Voucher No. * ${!s.editingId ? `<button type="button" tabindex="-1" onclick="toggleVchNoMode()" style="margin-left:6px;padding:0 6px;font-size:10px;cursor:pointer;">${isAutoNo ? "🔢 Auto" : "✍ Manual"}</button>` : ""}</label>
          <input id="vchNoInp" value="${escHtml(s.vchNo)}" ${isAutoNo ? 'readonly style="background:#f1f5f9;"' : ""} oninput="VCH_STATE.vchNo=this.value">
        </div>
        <div class="field"><label>Voucher Date *</label><input type="date" id="vchDateInp" value="${s.date}" onchange="VCH_STATE.date=this.value"></div>
        <div class="field"><label>Chq / Ref / UTR No.</label><input id="vchRefInp" value="${escHtml(s.refNo)}" placeholder="Cheque / UTR / Ref" oninput="VCH_STATE.refNo=this.value"></div>
      </div>
    </div>

    <div class="form-card" style="padding:0; overflow:hidden;">
      <table class="tally-tbl">
        <thead><tr><th>By / To</th><th>Particulars (Ledger Account)</th><th class="num">Debit (₹)</th><th class="num">Credit (₹)</th><th></th></tr></thead>
        <tbody>${rowsHtml}</tbody>
        <tfoot>
          <tr style="background:#f1f5f9;font-weight:700;">
            <td colspan="2" style="text-align:right;">Total Double-Entry Check:</td>
            <td class="num" id="acctTotDr">₹${fmtINR(totDr)}</td>
            <td class="num" id="acctTotCr">₹${fmtINR(totCr)}</td>
            <td></td>
          </tr>
        </tfoot>
      </table>
      <div style="padding:8px 10px; display:flex; justify-content:space-between; align-items:center; background:#f8fafc;">
        <button class="btn btn-sec" onclick="addAcctRow()">➕ Add Dr/Cr Line</button>
        <div id="acctDiffMsg" style="font-weight:700; color:${diff === 0 && totDr > 0 ? "var(--ok)" : "var(--danger)"};">
          ${diff === 0 && totDr > 0 ? "✔ Debit & Credit Matched" : `⚠ Difference: ₹${fmtINR(Math.abs(diff))} (${diff > 0 ? "Cr short" : "Dr short"})`}
        </div>
      </div>
    </div>

    <div class="form-card">
      <div class="field"><label>Narration</label><textarea id="vchNarrInp" rows="2" placeholder="Being amount paid/received/adjusted..." oninput="VCH_STATE.narration=this.value">${escHtml(s.narration)}</textarea></div>
      <div style="margin-top:10px; display:flex; gap:8px;">
        <button class="btn" id="saveVchMainBtn" onclick="saveCurrentVoucher()">💾 Accept &amp; Save Voucher (Ctrl+A)</button>
        <button class="btn btn-sec" onclick="goBack()">Cancel (Esc)</button>
      </div>
    </div>`;
}

function updateAcctRow(idx, field, val) {
  syncVoucherHeaderFromDOM();
  const L = VCH_STATE.acctLines;
  if (!L[idx]) return;
  if (field === "amount") {
    L[idx].amount = Number(val) || 0;
    let d = 0, c = 0;
    L.forEach(x => { if (x.type === "Dr") d += Number(x.amount) || 0; else c += Number(x.amount) || 0; });
    const diff = +(d - c).toFixed(2);
    const dEl = document.getElementById("acctTotDr"), cEl = document.getElementById("acctTotCr"), mEl = document.getElementById("acctDiffMsg");
    if (dEl) dEl.textContent = "₹" + fmtINR(d);
    if (cEl) cEl.textContent = "₹" + fmtINR(c);
    if (mEl) {
      mEl.style.color = (diff === 0 && d > 0) ? "var(--ok)" : "var(--danger)";
      mEl.textContent = (diff === 0 && d > 0) ? "✔ Debit & Credit Matched" : `⚠ Difference: ₹${fmtINR(Math.abs(diff))} (${diff > 0 ? "Cr short" : "Dr short"})`;
    }
    return;
  }
  if (field === "ledgerId" || field === "type") L[idx].bills = undefined;
  L[idx][field] = val;
  renderVoucherEntryScreen();
}

function onAcctAmountCommit(idx) {
  const L = VCH_STATE.acctLines;
  let d = 0, c = 0;
  L.forEach(x => { if (x.type === "Dr") d += Number(x.amount) || 0; else c += Number(x.amount) || 0; });
  const diff = +(d - c).toFixed(2);
  if (diff !== 0) {
    const need = diff > 0 ? "Cr" : "Dr";
    const hasEmpty = L.some(x => x.type === need && !(Number(x.amount) || 0));
    if (!hasEmpty) {
      L.push({ type: need, ledgerId: "", amount: 0 });
      renderVoucherEntryScreen();
    }
  }
}

function addAcctRow() {
  syncVoucherHeaderFromDOM();
  let d = 0, c = 0;
  VCH_STATE.acctLines.forEach(l => { if (l.type === "Dr") d += Number(l.amount) || 0; else c += Number(l.amount) || 0; });
  VCH_STATE.acctLines.push({ type: d >= c ? "Cr" : "Dr", ledgerId: "", amount: +(Math.abs(d - c)).toFixed(2) });
  renderVoucherEntryScreen();
}

function removeAcctRow(idx) {
  syncVoucherHeaderFromDOM();
  if (VCH_STATE.acctLines.length <= 2) { toast("⚠ Kam se kam 2 lines (Dr aur Cr) zaroori hain!"); return; }
  VCH_STATE.acctLines.splice(idx, 1); renderVoucherEntryScreen();
}

// ---------- BILL ALLOCATION MODAL ----------
let _BA_IDX = -1, _BA_ROWS = [];
function openBillAllocModal(idx) {
  const L = VCH_STATE.acctLines[idx];
  if (!L || !getPartyKind(L.ledgerId) || !(Number(L.amount) > 0)) { toast("⚠ Pehle Party Ledger aur Amount dalein!"); return; }
  _BA_IDX = idx;
  _BA_ROWS = (L.bills && L.bills.length) ? JSON.parse(JSON.stringify(L.bills)) : [{ type: "New Ref", ref: VCH_STATE.refNo || VCH_STATE.vchNo, amount: Number(L.amount) }];
  renderBillAllocModal();
}

function renderBillAllocModal() {
  const L = VCH_STATE.acctLines[_BA_IDX];
  const types = ["New Ref", "Agst Ref", "Advance", "On Account"];
  const rowsHtml = _BA_ROWS.map((r, i) => `
    <tr>
      <td><select onchange="_BA_ROWS[${i}].type=this.value; renderBillAllocModal();">${types.map(t => `<option ${t === r.type ? "selected" : ""}>${t}</option>`).join("")}</select></td>
      <td>${r.type === "On Account" ? "—" : `<input value="${escHtml(r.ref || "")}" oninput="_BA_ROWS[${i}].ref=this.value">`}</td>
      <td><input type="number" step="0.01" class="num" value="${r.amount || ""}" oninput="_BA_ROWS[${i}].amount=Number(this.value)||0"></td>
      <td><button class="btn btn-sec" onclick="_BA_ROWS.splice(${i},1); renderBillAllocModal();">✕</button></td>
    </tr>`).join("");
  const body = `
    <div id="baWrap">
      <div class="ba-sum"><b>${escHtml(getLedgerName(L.ledgerId))}</b> | Line Amount: <b>₹${fmtINR(L.amount)} ${L.type}</b></div>
      <table class="ba-tbl"><thead><tr><th>Type</th><th>Bill Ref</th><th>Amount (₹)</th><th></th></tr></thead><tbody>${rowsHtml}</tbody></table>
      <div style="margin-top:8px;"><button class="btn btn-sec" onclick="_BA_ROWS.push({type:'New Ref',ref:'',amount:0}); renderBillAllocModal();">➕ Add Bill Row</button></div>
    </div>`;
  const foot = `<button class="btn btn-sec" onclick="closeModal()">Cancel</button><button class="btn" onclick="saveBillAllocModal()">✔ OK</button>`;
  showModal("📑 Bill-wise Allocation", body, foot);
}

function saveBillAllocModal() {
  const L = VCH_STATE.acctLines[_BA_IDX]; if (!L) return;
  L.bills = _BA_ROWS.filter(r => Number(r.amount) > 0);
  closeModal(); renderVoucherEntryScreen();
}

// ============================================================================
// SAVE & DELETE VOUCHER
// ============================================================================
function saveCurrentVoucher() {
  syncVoucherHeaderFromDOM();
  const s = VCH_STATE;
  if (!s.vchNo.trim() || !s.date) { toast("⚠ Voucher No. aur Date zaroori hai!"); return; }

  let entries = [], totalAmount = 0, gstMeta = null, itemLinesSaved = [];

  if (s.mode === "item" && isItemCapableVoucher(s.vchType)) {
    const calc = calculateInvoiceGST(s.itemLines, s.partyLedgerId, s.applyRoundOff, s.posState);
    if (calc.netInvoice <= 0) { toast("⚠ Invoice Total 0 se zyada hona chahiye!"); return; }
    totalAmount = calc.netInvoice;
    gstMeta = {
      supplyType: calc.supply.supplyType, posState: calc.supply.posState, gstrCategory: calc.gstrCategory,
      taxable: calc.totalTaxable, cgst: calc.totalCGST, sgst: calc.totalSGST, igst: calc.totalIGST,
      roundOff: calc.roundOff, netInvoice: calc.netInvoice, hsnSummary: calc.hsnSummary
    };
    itemLinesSaved = calc.lines;

    const isOutward = (s.vchType === "Sales" || s.vchType === "Debit Note");
    const isSalesSide = (s.vchType === "Sales" || s.vchType === "Credit Note");
    const partyType = isOutward ? "Dr" : "Cr", revType = isOutward ? "Cr" : "Dr";

    entries.push({ ledgerId: s.partyLedgerId, type: partyType, amount: calc.netInvoice });
    entries.push({ ledgerId: s.salesPurcLedgerId, type: revType, amount: calc.totalTaxable });
    if (calc.totalCGST > 0) entries.push({ ledgerId: isSalesSide ? "L_CGST_OUT" : "L_CGST_IN", type: revType, amount: calc.totalCGST });
    if (calc.totalSGST > 0) entries.push({ ledgerId: isSalesSide ? "L_SGST_OUT" : "L_SGST_IN", type: revType, amount: calc.totalSGST });
    if (calc.totalIGST > 0) entries.push({ ledgerId: isSalesSide ? "L_IGST_OUT" : "L_IGST_IN", type: revType, amount: calc.totalIGST });
    if (calc.roundOff !== 0) entries.push({ ledgerId: "L_ROUNDOFF", type: calc.roundOff > 0 ? revType : partyType, amount: Math.abs(calc.roundOff) });
  } else {
    let drSum = 0, crSum = 0;
    s.acctLines.forEach(l => {
      const a = +(Number(l.amount) || 0).toFixed(2);
      if (a > 0 && l.ledgerId) {
        const entry = { ledgerId: l.ledgerId, type: l.type, amount: a };
        if (l.bills && l.bills.length) entry.bills = l.bills;
        entries.push(entry);
        if (l.type === "Dr") drSum = +(drSum + a).toFixed(2);
        else crSum = +(crSum + a).toFixed(2);
      }
    });
    if (entries.length < 2 || drSum <= 0) { toast("⚠ Valid Debit aur Credit dalein!"); return; }
    if (Math.abs(drSum - crSum) > 0.01) { toast(`🚫 Dr (₹${fmtINR(drSum)}) aur Cr (₹${fmtINR(crSum)}) barabar nahi hain!`); return; }
    totalAmount = drSum;
  }

  const drFirst = entries.find(e => e.type === "Dr"), crFirst = entries.find(e => e.type === "Cr");
  const vchObj = {
    id: s.editingId || uid("V"), vchNo: s.vchNo.trim(), date: s.date, type: s.vchType, mode: s.mode,
    refNo: s.refNo.trim(), partyLedgerId: s.partyLedgerId, salesPurcLedgerId: s.salesPurcLedgerId,
    posState: s.posState, rcm: s.rcm, bill: { type: s.billRefType, ref: s.billRefName || s.vchNo },
    narration: s.narration.trim(), amount: totalAmount,
    drLedgerId: drFirst ? drFirst.ledgerId : "", crLedgerId: crFirst ? crFirst.ledgerId : "",
    entries, itemLines: itemLinesSaved, gst: gstMeta
  };

  if (s.editingId) {
    const idx = DB.vouchers.findIndex(v => v.id === s.editingId);
    if (idx >= 0) DB.vouchers[idx] = vchObj;
    toast(`✅ Voucher ${vchObj.vchNo} Updated!`);
  } else {
    DB.vouchers.push(vchObj);
    toast(`✅ Voucher ${vchObj.vchNo} Saved! (₹${fmtINR(totalAmount)})`);
  }

  saveDB();
  if (s.editingId) goBack();
  else {
    initVoucherState(s.vchType, null);
    renderVoucherEntryScreen();
    setTimeout(() => {
      const target = (VCH_NO_MODE === "auto")
        ? document.getElementById("vchDateInp")
        : document.getElementById("vchNoInp");
      if (target) {
        target.focus();
        if (target.select) try { target.select(); } catch {}
      }
    }, 50);
  }
}

function deleteVoucher(vid) {
  DB.vouchers = DB.vouchers.filter(v => v.id !== vid);
  saveDB(); renderScreen(CURRENT_SCREEN); toast("🗑️ Voucher Deleted");
}

// ============================================================================
// INVENTORY VOUCHERS MODAL (STOCK JOURNAL, PHYSICAL STOCK, DELIVERY/RECEIPT)
// ============================================================================
let INV_VCH_LINES = [];
function openInventoryVoucherModal(vType = "Stock Journal") {
  if (!DB.items.length) { toast("⚠ Pehle Stock Item banayein!"); navigate("masters_item"); return; }
  INV_VCH_LINES = [{ itemId: DB.items[0].id, itemName: DB.items[0].name, uom: DB.items[0].uom || "NOS", qty: 1, rate: DB.items[0].opRate || DB.items[0].rate || 0 }];
  renderInventoryVoucherModal(vType);
}

function renderInventoryVoucherModal(vType) {
  const vNo = "INV-VCH/" + String(DB.vouchers.length + 1).padStart(4, "0");
  const rows = INV_VCH_LINES.map((ln, idx) => {
    const opts = DB.items.map(it => `<option value="${it.id}" ${it.id === ln.itemId ? "selected" : ""}>${escHtml(it.name)} (${it.uom})</option>`).join("");
    return `
      <tr>
        <td>${idx + 1}</td>
        <td><select style="width:100%;padding:4px;" onchange="const it=getItem(this.value); if(it){INV_VCH_LINES[${idx}]={itemId:it.id,itemName:it.name,uom:it.uom,qty:1,rate:it.opRate||it.rate||0}; renderInventoryVoucherModal('${vType}');}">${opts}</select></td>
        <td><input type="number" step="0.01" class="num" style="width:85px;padding:4px;" value="${ln.qty}" oninput="INV_VCH_LINES[${idx}].qty=Number(this.value)||0"></td>
        <td><input type="number" step="0.01" class="num" style="width:95px;padding:4px;" value="${ln.rate}" oninput="INV_VCH_LINES[${idx}].rate=Number(this.value)||0"></td>
        <td><button class="btn btn-danger" style="padding:2px 6px;" onclick="INV_VCH_LINES.splice(${idx},1); renderInventoryVoucherModal('${vType}')">✕</button></td>
      </tr>`;
  }).join("");

  const body = `
    <div class="form-grid" style="margin-bottom:10px;">
      <div class="field"><label>Type</label><input id="invVchType" value="${vType}" readonly></div>
      <div class="field"><label>Voucher No</label><input id="invVchNo" value="${vNo}"></div>
      <div class="field"><label>Date</label><input type="date" id="invVchDate" value="${DB.company.curDate}"></div>
    </div>
    <table class="tally-tbl">
      <thead><tr><th>#</th><th>Stock Item</th><th class="num">Qty (+/-)</th><th class="num">Rate (₹)</th><th></th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div style="margin-top:8px;"><button class="btn btn-sec" onclick="INV_VCH_LINES.push({itemId:DB.items[0].id,itemName:DB.items[0].name,uom:DB.items[0].uom,qty:1,rate:DB.items[0].rate||0}); renderInventoryVoucherModal('${vType}')">➕ Add Line</button></div>
    <div class="field" style="margin-top:8px;"><label>Narration</label><input id="invVchNarr" placeholder="Stock adjustment note..."></div>`;
  const foot = `<button class="btn btn-sec" onclick="closeModal()">Cancel</button><button class="btn" onclick="saveInventoryVoucherModal()">💾 Save ${vType}</button>`;
  showModal(`📦 Inventory Voucher: ${vType}`, body, foot);
}

function saveInventoryVoucherModal() {
  const type = document.getElementById("invVchType").value;
  const vchNo = document.getElementById("invVchNo").value.trim() || "INV/01";
  const date = document.getElementById("invVchDate").value || DB.company.curDate;
  const narration = document.getElementById("invVchNarr").value.trim() || `${type} Entry`;
  let tot = 0;
  const lines = INV_VCH_LINES.map(l => {
    const taxable = +((Number(l.qty) || 0) * (Number(l.rate) || 0)).toFixed(2);
    tot += Math.abs(taxable);
    return { ...l, taxable, gstRate: 0, lineTotal: taxable };
  });
  DB.vouchers.push({ id: uid("V"), vchNo, date, type, mode: "item", narration, amount: +tot.toFixed(2), entries: [], itemLines: lines });
  saveDB(); closeModal(); navigate("stock_summary"); toast(`✅ ${type} Saved!`);
}

// ============================================================================
// BOM MANUFACTURING PRODUCTION SCREEN (ALT+M)
// ============================================================================
let MFG_STATE = { vchNo: "", date: "", fgItemId: "", produceQty: 1, extraCost: 0, narration: "", consumedLines: [] };

function openBomProductionScreen() {
  ensureStockGroupsInitialized();
  const fg = DB.items.find(i => (i.bom && i.bom.length) || i.stockGroup === "Finished Goods") || DB.items[0];
  const count = DB.vouchers.filter(v => v.type === "Stock Journal").length + 1;
  MFG_STATE = { vchNo: "MFG/" + String(count).padStart(4, "0"), date: DB.company.curDate, fgItemId: fg ? fg.id : "", produceQty: 1, extraCost: 0, narration: "", consumedLines: [] };
  recalcMfgFromBom();
  navigate("bom_production");
}

function recalcMfgFromBom() {
  const fg = getItem(MFG_STATE.fgItemId);
  if (!fg || !Array.isArray(fg.bom) || !fg.bom.length) { MFG_STATE.consumedLines = []; return; }
  const stockMap = computeInventoryStockSummary();
  const mult = (Number(MFG_STATE.produceQty) || 0) / (fg.bomStdBatch || 1);
  MFG_STATE.consumedLines = fg.bom.map(b => {
    const c = getItem(b.itemId), st = stockMap[b.itemId];
    const rate = st ? st.avgRate : (Number(c?.opRate) || Number(c?.rate) || 0);
    return { itemId: b.itemId, itemName: c ? c.name : "", stockGroup: c ? c.stockGroup : "", uom: c ? c.uom : "NOS", qty: +((Number(b.qty) || 0) * mult).toFixed(3), rate };
  });
}

function renderBomProductionScreen() {
  document.getElementById("screenTitle").textContent = "🏭 BOM Manufacturing (Raw + Packing → Finished Goods)";
  document.getElementById("screenSub").textContent = "Auto-Consumes Raw & Packing Stock & Produces Finished Goods";

  const fgOpts = (DB.items || []).map(it => `<option value="${it.id}" ${it.id === MFG_STATE.fgItemId ? "selected" : ""}>${escHtml(it.name)} [${escHtml(it.stockGroup || "")}]</option>`).join("");
  const fg = getItem(MFG_STATE.fgItemId);
  let rawCost = 0;
  const rows = MFG_STATE.consumedLines.map((ln, idx) => {
    const amt = +((Number(ln.qty) || 0) * (Number(ln.rate) || 0)).toFixed(2);
    rawCost += amt;
    return `
      <tr>
        <td>${idx + 1}</td><td><b>${escHtml(ln.itemName)}</b></td><td><span class="kbd">${escHtml(ln.stockGroup)}</span></td>
        <td><input type="number" step="0.001" class="num" style="width:85px;padding:4px;" value="${ln.qty}" oninput="MFG_STATE.consumedLines[${idx}].qty=Number(this.value)||0; renderBomProductionScreen();"> ${escHtml(ln.uom)}</td>
        <td><input type="number" step="0.01" class="num" style="width:90px;padding:4px;" value="${ln.rate}" oninput="MFG_STATE.consumedLines[${idx}].rate=Number(this.value)||0; renderBomProductionScreen();"></td>
        <td class="num"><b>₹${fmtINR(amt)}</b></td>
        <td><button class="btn btn-danger" style="padding:2px 6px;" onclick="MFG_STATE.consumedLines.splice(${idx},1); renderBomProductionScreen();">✕</button></td>
      </tr>`;
  }).join("");

  const totalCost = +(rawCost + (Number(MFG_STATE.extraCost) || 0)).toFixed(2);
  document.getElementById("screenBody").innerHTML = `
    <div class="form-card">
      <div class="form-grid">
        <div class="field"><label>Mfg Voucher No</label><input value="${escHtml(MFG_STATE.vchNo)}" oninput="MFG_STATE.vchNo=this.value"></div>
        <div class="field"><label>Date</label><input type="date" value="${MFG_STATE.date}" onchange="MFG_STATE.date=this.value"></div>
        <div class="field" style="grid-column:span 2;"><label>Finished Good *</label><select onchange="MFG_STATE.fgItemId=this.value; recalcMfgFromBom(); renderBomProductionScreen();">${fgOpts}</select></div>
        <div class="field"><label>Qty Produced (${escHtml(fg?.uom || "NOS")})</label><input type="number" step="0.01" class="num" value="${MFG_STATE.produceQty}" oninput="MFG_STATE.produceQty=Number(this.value)||0; recalcMfgFromBom(); renderBomProductionScreen();"></div>
        <div class="field"><label>Overhead / Labour Cost (₹)</label><input type="number" step="0.01" class="num" value="${MFG_STATE.extraCost}" oninput="MFG_STATE.extraCost=Number(this.value)||0; renderBomProductionScreen();"></div>
      </div>
    </div>
    <div class="form-card" style="padding:0; overflow:hidden;">
      <table class="tally-tbl">
        <thead><tr><th>#</th><th>Consumed Raw / Packing</th><th>Group</th><th>Qty</th><th>Rate</th><th class="num">Cost (₹)</th><th></th></tr></thead>
        <tbody>${rows || `<tr><td colspan="7" style="text-align:center;padding:18px;color:var(--muted);">BOM set karne ke liye Stock Items me jaakar ⚙️ BOM setup karein.</td></tr>`}</tbody>
        <tfoot><tr style="background:#f1f5f9;font-weight:800;"><td colspan="5" style="text-align:right;">Total Production Cost:</td><td class="num">₹${fmtINR(totalCost)}</td><td></td></tr></tfoot>
      </table>
    </div>
    <div class="form-card" style="display:flex; justify-content:space-between; align-items:center; gap:10px;">
      <input style="flex:1;padding:6px 8px;" placeholder="Production Narration..." value="${escHtml(MFG_STATE.narration)}" oninput="MFG_STATE.narration=this.value">
      <button class="btn" onclick="saveMfgProductionVoucher()">💾 Complete Production (Ctrl+A)</button>
    </div>`;
}

function saveMfgProductionVoucher() {
  const fg = getItem(MFG_STATE.fgItemId), prodQty = Number(MFG_STATE.produceQty) || 0;
  if (!fg || prodQty <= 0 || !MFG_STATE.consumedLines.length) { toast("⚠ Valid Finished Good aur Raw Material zaroori hai!"); return; }
  let rawTotal = 0;
  const lines = [];
  MFG_STATE.consumedLines.forEach(c => {
    const q = Math.abs(Number(c.qty) || 0), r = Number(c.rate) || 0;
    if (q > 0) {
      const val = +(q * r).toFixed(2); rawTotal += val;
      lines.push({ itemId: c.itemId, itemName: c.itemName, uom: c.uom, qty: -q, rate: r, taxable: -val, gstRate: 0, lineTotal: -val });
    }
  });
  const totalCost = +(rawTotal + (Number(MFG_STATE.extraCost) || 0)).toFixed(2);
  lines.push({ itemId: fg.id, itemName: fg.name, uom: fg.uom, qty: prodQty, rate: +(totalCost / prodQty).toFixed(2), taxable: totalCost, gstRate: 0, lineTotal: totalCost });
  DB.vouchers.push({ id: uid("V"), vchNo: MFG_STATE.vchNo, date: MFG_STATE.date, type: "Stock Journal", subType: "BOM Manufacturing", mode: "item", narration: MFG_STATE.narration || `Manufactured ${prodQty} ${fg.uom} of ${fg.name}`, amount: totalCost, entries: [], itemLines: lines });
  saveDB(); toast(`✅ Produced ${prodQty} ${fg.uom} of ${fg.name}!`); navigate("stock_summary");
}
// ============================================================================
// FIX: ALWAYS OPEN FRESH VOUCHER + AUTO FOCUS ON DATE / MANUAL VOUCHER NO.
// ============================================================================
(function patchFreshVoucherAndFocus() {
  if (typeof openVoucherScreen !== "function" || window._VCH_FRESH_PATCHED) return;
  const origOpenVch = openVoucherScreen;

  window.openVoucherScreen = function (type, editId) {
    // Agar editId nahi di gayi (yaani fresh voucher kholna hai), toh purana edit state clear karein
    if (!editId) {
      if (typeof EDIT_VOUCHER_ID !== "undefined") EDIT_VOUCHER_ID = null;
      if (typeof CUR_EDIT_VCH_ID !== "undefined") CUR_EDIT_VCH_ID = null;
      if (typeof ACTIVE_VCH_ID !== "undefined") ACTIVE_VCH_ID = null;
      window._editingVchId = null;
    }

    const res = origOpenVch.call(this, type, editId || null);

    // Focus Logic: Manual mode -> Voucher No., Auto mode -> Voucher Date
    setTimeout(() => {
      const body = document.getElementById("screenBody");
      if (!body) return;
      const vchNoInp = body.querySelector("#vchNo, #vNo, input[id*='vchNo' i], input[placeholder*='Voucher' i]");
      const vchDateInp = body.querySelector("#vchDate, #vDate, input[type='date']");
      const isManual = (typeof VCH_MANUAL_NO !== "undefined" && VCH_MANUAL_NO) ||
                       (vchNoInp && !vchNoInp.readOnly && !vchNoInp.disabled && !(vchNoInp.style.background || "").includes("f1f5f9"));

      if (isManual && vchNoInp) {
        vchNoInp.focus();
        vchNoInp.select();
      } else if (vchDateInp) {
        vchDateInp.focus();
      }
    }, 60);

    return res;
  };
  window._VCH_FRESH_PATCHED = true;
})();
