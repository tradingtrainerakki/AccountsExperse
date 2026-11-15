// ============================================================================
// MASTERS.JS: VIEW ALL, LEDGERS, GROUPS (+MOVE), STOCK GROUPS, ITEMS & BOM
// ============================================================================

// ============================================================================
// 1. VIEW ALL MASTERS SCREEN (GROUPS + LEDGERS TREE / GROUPS / LEDGERS)
// ============================================================================
window._MV_TAB = "tree"; // "tree" | "groups" | "ledgers"
window._MV_SEARCH = "";

function renderMastersViewScreen() {
  document.getElementById("screenTitle").textContent = "👁️ View All Masters (Groups & Ledgers)";
  document.getElementById("screenSub").textContent = "↑ ↓ + Enter ya Click se koi bhi Group ya Ledger kholein | Esc: Wapas";

  const balMap = computeAllLedgerBalances();
  const q = (window._MV_SEARCH || "").trim().toLowerCase();
  const tab = window._MV_TAB || "tree";

  let headHtml = "";
  let rowsHtml = "";

  if (tab === "tree") {
    headHtml = `
      <tr>
        <th style="width:52px;">Type</th>
        <th>Group / Ledger Name (Click or Enter to Open)</th>
        <th>Nature / Under</th>
        <th class="num">Opening Bal</th>
        <th class="num">Closing Debit (Dr)</th>
        <th class="num">Closing Credit (Cr)</th>
      </tr>`;

    (DB.groups || []).forEach(g => {
      const directLedgers = (DB.ledgers || []).filter(l => l.group === g.name);
      const grpMatches = !q || g.name.toLowerCase().includes(q) || (g.nature || "").toLowerCase().includes(q);
      const matchedLedgers = q ? directLedgers.filter(l => l.name.toLowerCase().includes(q)) : directLedgers;
      if (q && !grpMatches && matchedLedgers.length === 0) return;

      let gDr = 0, gCr = 0;
      directLedgers.forEach(l => {
        const net = Number((balMap[l.id] && balMap[l.id].netSigned) || 0);
        if (net > 0) gDr += net;
        else if (net < 0) gCr += Math.abs(net);
      });

      rowsHtml += `
        <tr onclick="openGroupSummary('${escHtml(g.name)}')" style="cursor:pointer; background:#f0fdf4; font-weight:700;">
          <td><span class="kbd" style="background:#dcfce7; color:#0f6e4e;">GRP</span></td>
          <td style="color:#0f6e4e;">📁 ${escHtml(g.name)} <span style="font-size:11px; color:#64748b; font-weight:500;">(${directLedgers.length} Ledgers)</span></td>
          <td><span class="kbd">${escHtml(g.nature || "")}</span> ${g.parent ? `<small style="color:#64748b;">(${escHtml(g.parent)})</small>` : ""}</td>
          <td class="num">-</td>
          <td class="num" style="color:#0f6e4e;">${gDr > 0 ? `₹${fmtINR(gDr)} Dr` : "-"}</td>
          <td class="num" style="color:#b91c1c;">${gCr > 0 ? `₹${fmtINR(gCr)} Cr` : "-"}</td>
        </tr>`;

      const showLedgers = grpMatches ? directLedgers : matchedLedgers;
      showLedgers.forEach(l => {
        const b = balMap[l.id] || { opDr: 0, opCr: 0, netSigned: 0 };
        const net = Number(b.netSigned || 0);
        const lDr = net > 0 ? net : 0;
        const lCr = net < 0 ? Math.abs(net) : 0;
        const opStr = b.opDr ? `₹${fmtINR(b.opDr)} Dr` : (b.opCr ? `₹${fmtINR(b.opCr)} Cr` : "-");

        rowsHtml += `
          <tr onclick="openLedgerFromGroup('${l.id}')" style="cursor:pointer;">
            <td style="padding-left:14px; color:#94a3b8;">↳</td>
            <td style="padding-left:24px;">📄 <b>${escHtml(l.name)}</b></td>
            <td style="color:#64748b; font-size:12px;">${escHtml(l.group)}</td>
            <td class="num">${opStr}</td>
            <td class="num" style="color:#0f6e4e;">${lDr > 0 ? `₹${fmtINR(lDr)} Dr` : "-"}</td>
            <td class="num" style="color:#b91c1c;">${lCr > 0 ? `₹${fmtINR(lCr)} Cr` : "-"}</td>
          </tr>`;
      });
    });
  } else if (tab === "groups") {
    headHtml = `
      <tr>
        <th>#</th>
        <th>Group Name (Click / Enter for Summary)</th>
        <th>Under Parent</th>
        <th>Nature</th>
        <th class="num">Ledgers</th>
        <th class="num">Total Dr</th>
        <th class="num">Total Cr</th>
      </tr>`;

    (DB.groups || [])
      .filter(g => !q || g.name.toLowerCase().includes(q) || (g.nature || "").toLowerCase().includes(q) || (g.parent || "").toLowerCase().includes(q))
      .forEach((g, idx) => {
        const leds = (DB.ledgers || []).filter(l => l.group === g.name);
        let gDr = 0, gCr = 0;
        leds.forEach(l => {
          const net = Number((balMap[l.id] && balMap[l.id].netSigned) || 0);
          if (net > 0) gDr += net;
          else if (net < 0) gCr += Math.abs(net);
        });
        rowsHtml += `
          <tr onclick="openGroupSummary('${escHtml(g.name)}')" style="cursor:pointer;">
            <td>${idx + 1}</td>
            <td><b style="color:#0f6e4e; text-decoration:underline;">📁 ${escHtml(g.name)}</b></td>
            <td>${escHtml(g.parent || "Primary")}</td>
            <td><span class="kbd">${escHtml(g.nature || "")}</span></td>
            <td class="num"><b>${leds.length}</b></td>
            <td class="num" style="color:#0f6e4e;">${gDr > 0 ? `₹${fmtINR(gDr)} Dr` : "-"}</td>
            <td class="num" style="color:#b91c1c;">${gCr > 0 ? `₹${fmtINR(gCr)} Cr` : "-"}</td>
          </tr>`;
      });
  } else {
    headHtml = `
      <tr>
        <th>#</th>
        <th>Ledger Name (Click / Enter to Open)</th>
        <th>Under Group</th>
        <th class="num">Opening Bal</th>
        <th class="num">Closing Dr</th>
        <th class="num">Closing Cr</th>
      </tr>`;

    (DB.ledgers || [])
      .filter(l => !q || l.name.toLowerCase().includes(q) || (l.group || "").toLowerCase().includes(q))
      .forEach((l, idx) => {
        const b = balMap[l.id] || { opDr: 0, opCr: 0, netSigned: 0 };
        const net = Number(b.netSigned || 0);
        const lDr = net > 0 ? net : 0;
        const lCr = net < 0 ? Math.abs(net) : 0;
        const opStr = b.opDr ? `₹${fmtINR(b.opDr)} Dr` : (b.opCr ? `₹${fmtINR(b.opCr)} Cr` : "-");
        rowsHtml += `
          <tr onclick="openLedgerFromGroup('${l.id}')" style="cursor:pointer;">
            <td>${idx + 1}</td>
            <td><b style="color:#0f6e4e; text-decoration:underline;">📄 ${escHtml(l.name)}</b></td>
            <td><span class="kbd">${escHtml(l.group)}</span></td>
            <td class="num">${opStr}</td>
            <td class="num" style="color:#0f6e4e;">${lDr > 0 ? `₹${fmtINR(lDr)} Dr` : "-"}</td>
            <td class="num" style="color:#b91c1c;">${lCr > 0 ? `₹${fmtINR(lCr)} Cr` : "-"}</td>
          </tr>`;
      });
  }

  document.getElementById("screenBody").innerHTML = `
    <div class="form-card" style="display:flex; justify-content:space-between; align-items:center; gap:10px; flex-wrap:wrap;">
      <div style="display:flex; gap:6px; flex-wrap:wrap;">
        <button class="btn ${tab === "tree" ? "" : "btn-sec"}" onclick="window._MV_TAB='tree'; renderMastersViewScreen();">🌳 All (Groups + Ledgers)</button>
        <button class="btn ${tab === "groups" ? "" : "btn-sec"}" onclick="window._MV_TAB='groups'; renderMastersViewScreen();">📁 Groups (${(DB.groups || []).length})</button>
        <button class="btn ${tab === "ledgers" ? "" : "btn-sec"}" onclick="window._MV_TAB='ledgers'; renderMastersViewScreen();">📒 Ledgers (${(DB.ledgers || []).length})</button>
      </div>
      <div style="flex:1; max-width:320px;">
        <input id="mvSearchInp" placeholder="🔍 Search Group ya Ledger..." value="${escHtml(window._MV_SEARCH)}"
               oninput="window._MV_SEARCH=this.value; renderMastersViewScreen();"
               style="width:100%; padding:6px 10px; border:1px solid #94a3b8; border-radius:4px;">
      </div>
    </div>

    <div class="form-card" style="padding:0; overflow:hidden;">
      <table class="tally-tbl">
        <thead>${headHtml}</thead>
        <tbody>${rowsHtml || `<tr><td colspan="7" style="text-align:center; padding:24px; color:#64748b;">Koi matching Group ya Ledger nahi mila.</td></tr>`}</tbody>
      </table>
    </div>`;

  if (window._MV_SEARCH) {
    const inp = document.getElementById("mvSearchInp");
    if (inp) { inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); }
  }
}

// ============================================================================
// 2. LEDGER MASTER (CREATE / ALTER / DELETE + ALT+C QUICK POPUP)
// ============================================================================
function renderLedgerMastersScreen() {
  document.getElementById("screenTitle").textContent = "Ledger Master (Create / Alter / GSTIN Setup)";
  document.getElementById("screenSub").textContent = "Click any Ledger to Alter | Alt+C: Quick Ledger | Ctrl+A: Save | Esc: Back";

  const balMap = computeAllLedgerBalances();
  const groupOpts = (DB.groups || []).map(g => `<option value="${escHtml(g.name)}">${escHtml(g.name)} (${escHtml(g.nature)})</option>`).join("");
  const stateOpts = Object.entries(GST_STATES).map(([c, nm]) =>
    `<option value="${c}" ${c === (DB.company.stateCode || "05") ? "selected" : ""}>${c} - ${nm}</option>`
  ).join("");

  const rowsHtml = (DB.ledgers || []).map((l, idx) => {
    const b = balMap[l.id] || { closeBal: 0, closeType: "Dr" };
    return `
      <tr onclick="populateLedgerForm('${l.id}')" style="cursor:pointer;">
        <td>${idx + 1}</td>
        <td><b>${escHtml(l.name)}</b></td>
        <td>${escHtml(l.group)}</td>
        <td>${l.gstin ? `<span class="kbd">${escHtml(l.gstin)}</span>` : `<span style="color:var(--muted)">-</span>`}</td>
        <td>${l.stateCode ? `${l.stateCode} - ${GST_STATES[l.stateCode] || ""}` : "-"}</td>
        <td class="num">${l.opBal ? `₹${fmtINR(l.opBal)} ${l.opType}` : "-"}</td>
        <td class="num"><b>₹${fmtINR(b.closeBal)} ${b.closeType}</b></td>
        <td>
          <button class="btn btn-sec" style="padding:2px 7px; font-size:11px;" onclick="event.stopPropagation(); populateLedgerForm('${l.id}')">Alter</button>
          <button class="btn btn-danger" style="padding:2px 7px; font-size:11px;" onclick="event.stopPropagation(); deleteLedger('${l.id}')">Del</button>
        </td>
      </tr>`;
  }).join("");

  document.getElementById("screenBody").innerHTML = `
    <div class="form-card">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
        <h3 style="font-size:14px; color:var(--pri-dark);" id="ledFormHeading">➕ Create New Ledger Account</h3>
        <button class="btn btn-sec" onclick="resetLedgerForm()">New / Clear Form</button>
      </div>
      <input type="hidden" id="ledIdInp" value="">
      <div class="form-grid">
        <div class="field" style="grid-column: span 2;">
          <label>Ledger Name *</label>
          <input id="ledNameInp" placeholder="e.g. Sharma Hardware &amp; Electricals">
        </div>
        <div class="field">
          <label>Under Accounting Group * <u style="color:var(--pri);cursor:pointer;float:right;" onclick="openQuickAccountGroupModal('ledGroupInp')">➕ New Group</u></label>
          <select id="ledGroupInp">${groupOpts}</select>
        </div>
        <div class="field">
          <label>Registration Type</label>
          <select id="ledRegInp">
            <option value="Not Applicable">Not Applicable / Non-GST</option>
            <option value="Regular">Regular (B2B)</option>
            <option value="Unregistered">Unregistered / B2C</option>
            <option value="Composition">Composition Dealer</option>
            <option value="Consumer">End Consumer</option>
          </select>
        </div>
        <div class="field">
          <label>Party GSTIN (15 Digits - Auto State)</label>
          <input id="ledGstinInp" maxlength="15" placeholder="05AAAAA0000A1Z5" oninput="onLedgerGstinInput(this.value, 'ledStateInp', 'ledGstinStatus')">
          <small id="ledGstinStatus" style="font-size:10.5px; color:var(--muted);">Leave blank for Non-GST / Cash / Expense ledgers</small>
        </div>
        <div class="field">
          <label>State / Place of Supply</label>
          <select id="ledStateInp">${stateOpts}</select>
        </div>
        <div class="field">
          <label>Opening Balance (₹)</label>
          <input type="number" step="0.01" id="ledOpBalInp" value="0">
        </div>
        <div class="field">
          <label>Dr / Cr</label>
          <select id="ledOpTypeInp">
            <option value="Dr">Dr (Debit)</option>
            <option value="Cr">Cr (Credit)</option>
          </select>
        </div>
        <div class="field" style="grid-column: span 2;">
          <label>Address / Mobile / Bank Details</label>
          <input id="ledAddrInp" placeholder="Full Address, City, Mobile or A/c No.">
        </div>
      </div>
      <div style="margin-top:10px; display:flex; gap:8px; justify-content:flex-end;">
        <button class="btn" onclick="saveLedgerFromForm()">💾 Save Ledger (Ctrl+A)</button>
      </div>
    </div>

    <div class="form-card" style="padding:0; overflow:hidden;">
      <table class="tally-tbl">
        <thead>
          <tr>
            <th>#</th><th>Ledger Name</th><th>Under Group</th><th>GSTIN</th><th>State</th>
            <th class="num">Opening Bal</th><th class="num">Closing Bal</th><th>Actions</th>
          </tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    </div>`;
}

function onLedgerGstinInput(val, stateSelectId, statusId) {
  const res = validateGSTIN(val);
  const stEl = document.getElementById(statusId);
  if (res.empty) {
    if (stEl) { stEl.textContent = "Unregistered / Non-GST Ledger"; stEl.style.color = "var(--muted)"; }
    return;
  }
  if (res.stateCode) {
    const sel = document.getElementById(stateSelectId);
    if (sel) sel.value = res.stateCode;
  }
  if (stEl) {
    if (res.valid) {
      stEl.textContent = `✔ Valid GSTIN | State: ${res.stateCode}-${res.stateName} | PAN: ${res.pan}`;
      stEl.style.color = "var(--ok)";
    } else {
      stEl.textContent = "⚠ Check GSTIN format (15 chars)";
      stEl.style.color = "var(--warn)";
    }
  }
}

function populateLedgerForm(id) {
  const l = getLedger(id);
  if (!l) return;
  document.getElementById("ledFormHeading").textContent = `✏️ Alter Ledger: ${l.name}`;
  document.getElementById("ledIdInp").value = l.id;
  document.getElementById("ledNameInp").value = l.name;
  document.getElementById("ledGroupInp").value = l.group;
  document.getElementById("ledRegInp").value = l.regType || "Not Applicable";
  document.getElementById("ledGstinInp").value = l.gstin || "";
  document.getElementById("ledStateInp").value = l.stateCode || DB.company.stateCode || "05";
  document.getElementById("ledOpBalInp").value = l.opBal || 0;
  document.getElementById("ledOpTypeInp").value = l.opType || "Dr";
  document.getElementById("ledAddrInp").value = l.address || "";
  document.getElementById("ledNameInp").focus();
}

function resetLedgerForm() {
  if (!document.getElementById("ledIdInp")) return;
  document.getElementById("ledFormHeading").textContent = "➕ Create New Ledger Account";
  document.getElementById("ledIdInp").value = "";
  document.getElementById("ledNameInp").value = "";
  document.getElementById("ledGroupInp").value = "Sundry Debtors";
  document.getElementById("ledRegInp").value = "Not Applicable";
  document.getElementById("ledGstinInp").value = "";
  document.getElementById("ledStateInp").value = DB.company.stateCode || "05";
  document.getElementById("ledOpBalInp").value = 0;
  document.getElementById("ledOpTypeInp").value = "Dr";
  document.getElementById("ledAddrInp").value = "";
  document.getElementById("ledNameInp").focus();
}

function saveLedgerFromForm() {
  const id = document.getElementById("ledIdInp").value;
  const name = document.getElementById("ledNameInp").value.trim();
  const group = document.getElementById("ledGroupInp").value;
  const regType = document.getElementById("ledRegInp").value;
  const gstin = document.getElementById("ledGstinInp").value.trim().toUpperCase();
  const stateCode = document.getElementById("ledStateInp").value;
  const opBal = Math.abs(Number(document.getElementById("ledOpBalInp").value) || 0);
  const opType = document.getElementById("ledOpTypeInp").value;
  const address = document.getElementById("ledAddrInp").value.trim();

  if (!name) { toast("⚠ Ledger Name zaroori hai!"); return; }
  if (DB.ledgers.some(l => l.name.toLowerCase() === name.toLowerCase() && l.id !== id)) {
    toast("⚠ Is naam ka Ledger pehle se maujood hai!"); return;
  }

  if (id) {
    const existing = getLedger(id);
    if (existing) Object.assign(existing, { name, group, regType, gstin, stateCode, opBal, opType, address });
    toast(`✅ Ledger "${name}" Updated!`);
  } else {
    DB.ledgers.push({ id: uid("L"), name, group, regType, gstin, stateCode, opBal, opType, address });
    toast(`✅ Ledger "${name}" Created!`);
  }
  saveDB();
  renderLedgerMastersScreen();
}

function deleteLedger(id) {
  if (DB.vouchers.some(v => getVoucherEntries(v).some(e => e.ledgerId === id))) {
    toast("🚫 Is Ledger me Vouchers enter hain, pehle voucher hatayein!"); return;
  }
  if (id.startsWith("L_CGST") || id.startsWith("L_SGST") || id.startsWith("L_IGST") || id === "L_CASH" || id === "L_ROUNDOFF") {
    toast("🚫 System Default GST/Cash Ledger delete nahi kiya ja sakta!"); return;
  }
  DB.ledgers = DB.ledgers.filter(l => l.id !== id);
  saveDB();
  renderLedgerMastersScreen();
  toast("🗑️ Ledger Deleted");
}

function openQuickLedgerModal(callbackFnName = "") {
  const groupOpts = (DB.groups || []).map(g => `<option value="${escHtml(g.name)}" ${g.name === "Sundry Debtors" ? "selected" : ""}>${escHtml(g.name)}</option>`).join("");
  const stateOpts = Object.entries(GST_STATES).map(([c, nm]) => `<option value="${c}" ${c === (DB.company.stateCode || "05") ? "selected" : ""}>${c} - ${nm}</option>`).join("");

  const body = `
    <div class="form-grid">
      <div class="field" style="grid-column: span 2;"><label>Ledger Name *</label><input id="qLedName" placeholder="Party or Expense Ledger Name"></div>
      <div class="field"><label>Under Group *</label><select id="qLedGroup">${groupOpts}</select></div>
      <div class="field"><label>Registration Type</label>
        <select id="qLedReg">
          <option value="Not Applicable">Not Applicable / Non-GST</option>
          <option value="Regular">Regular (B2B)</option>
          <option value="Unregistered">Unregistered</option>
          <option value="Composition">Composition</option>
          <option value="Consumer">End Consumer</option>
        </select>
      </div>
      <div class="field"><label>GSTIN (15 Digits)</label><input id="qLedGstin" maxlength="15" oninput="onLedgerGstinInput(this.value, 'qLedState', 'qLedStMsg')"><small id="qLedStMsg" style="font-size:10px;color:var(--muted);"></small></div>
      <div class="field"><label>State</label><select id="qLedState">${stateOpts}</select></div>
      <div class="field"><label>Opening Balance</label><input type="number" id="qLedOp" value="0"></div>
      <div class="field"><label>Dr / Cr</label><select id="qLedOpType"><option value="Dr">Dr</option><option value="Cr">Cr</option></select></div>
    </div>`;
  const foot = `<button class="btn btn-sec" onclick="closeModal()">Cancel (Esc)</button><button class="btn" onclick="saveQuickLedgerModal('${callbackFnName}')">Create Ledger (Enter)</button>`;
  showModal("⚡ Quick Ledger Creation (Alt+C)", body, foot);
}

function saveQuickLedgerModal(callbackFnName) {
  const name = (document.getElementById("qLedName").value || "").trim();
  if (!name) { toast("⚠ Ledger Name dalein!"); return; }
  const newLed = {
    id: uid("L"), name,
    group: document.getElementById("qLedGroup").value,
    regType: document.getElementById("qLedReg").value,
    gstin: document.getElementById("qLedGstin").value.trim().toUpperCase(),
    stateCode: document.getElementById("qLedState").value,
    opBal: Math.abs(Number(document.getElementById("qLedOp").value) || 0),
    opType: document.getElementById("qLedOpType").value
  };
  DB.ledgers.push(newLed);
  saveDB();
  closeModal();
  toast(`⚡ Ledger "${name}" Created!`);
  if (callbackFnName && typeof window[callbackFnName] === "function") window[callbackFnName](newLed.id);
  else renderScreen(CURRENT_SCREEN);
}

// ============================================================================
// 3. ACCOUNTING GROUPS MASTER (+ BULK MOVE LEDGERS + GROUP SUMMARY DRILL)
// ============================================================================
function renderGroupsScreen() {
  document.getElementById("screenTitle").textContent = "Chart of Accounts (Accounting Groups)";
  document.getElementById("screenSub").textContent = "Click/Enter on Group for Group Summary | Alter button to Edit | Move to shift Ledgers";

  const parentOpts = (DB.groups || []).map(g => `<option value="${escHtml(g.name)}">${escHtml(g.name)} (${escHtml(g.nature)})</option>`).join("");

  const rows = (DB.groups || []).map((g, i) => {
    const count = (DB.ledgers || []).filter(l => l.group === g.name).length;
    return `
      <tr onclick="openGroupSummary('${escHtml(g.name)}')" style="cursor:pointer;" title="Click/Enter to view Ledgers &amp; Balances in ${escHtml(g.name)}">
        <td>${i + 1}</td>
        <td><b style="color:#0f6e4e; text-decoration:underline;">${escHtml(g.name)}</b> ${g.custom ? '<span class="kbd" style="background:#fef08a;">Custom</span>' : ''}</td>
        <td>${g.parent ? escHtml(g.parent) : "<span style='color:var(--pri-dark);font-weight:700;'>Primary</span>"}</td>
        <td><span class="kbd">${escHtml(g.nature)}</span></td>
        <td>${g.affectsGP ? "Yes (Trading A/c)" : "No (P&L / B/S)"}</td>
        <td class="num"><b>${count}</b> Ledgers</td>
        <td style="display:flex; gap:5px; align-items:center;">
          <button class="btn btn-sec" style="padding:2px 7px; font-size:11px;" onclick="event.stopPropagation(); populateGroupForm(${i})">Alter</button>
          ${count > 0 ? `<button class="btn btn-sec" style="padding:2px 7px; font-size:11px; background:#eff6ff; color:#1d4ed8; border-color:#93c5fd;" onclick="event.stopPropagation(); openMoveGroupLedgersModal(${i})">⇄ Move (${count})</button>` : ''}
          ${g.custom ? `<button class="btn btn-danger" style="padding:2px 7px; font-size:11px;" onclick="event.stopPropagation(); deleteCustomGroup('${escHtml(g.name)}')">Del</button>` : ''}
        </td>
      </tr>`;
  }).join("");

  document.getElementById("screenBody").innerHTML = `
    <div class="form-card">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
        <h3 style="font-size:14px; color:var(--pri-dark);" id="grpFormTitle">➕ Create New Accounting Sub-Group</h3>
        <button class="btn btn-sec" onclick="resetGroupForm()">Clear Form</button>
      </div>
      <input type="hidden" id="grpEditIdx" value="">
      <div class="form-grid">
        <div class="field"><label>Group Name *</label><input id="grpNameInp" placeholder="e.g. Roorkee Debtors / Project Expenses"></div>
        <div class="field"><label>Under Parent Group *</label><select id="grpParentInp" onchange="syncGroupNatureFromParent()">${parentOpts}</select></div>
        <div class="field"><label>Nature of Group</label>
          <select id="grpNatureInp">
            <option value="Assets">Assets</option><option value="Liabilities">Liabilities</option>
            <option value="Income">Income</option><option value="Expenses">Expenses</option>
          </select>
        </div>
        <div class="field"><label>Affects Gross Profit?</label>
          <select id="grpGpInp"><option value="no">No (P&amp;L / B/S)</option><option value="yes">Yes (Trading A/c)</option></select>
        </div>
      </div>
      <div style="margin-top:10px; display:flex; justify-content:flex-end;">
        <button class="btn" onclick="saveGroupFromForm()">💾 Save Group (Ctrl+A)</button>
      </div>
    </div>

    <div class="form-card" style="padding:0; overflow:hidden;">
      <table class="tally-tbl">
        <thead>
          <tr><th>#</th><th>Group Name</th><th>Under (Parent)</th><th>Nature</th><th>Affects GP?</th><th class="num">Active Ledgers</th><th>Actions</th></tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

function syncGroupNatureFromParent() {
  const pObj = DB.groups.find(g => g.name === document.getElementById("grpParentInp").value);
  if (pObj) {
    document.getElementById("grpNatureInp").value = pObj.nature;
    document.getElementById("grpGpInp").value = pObj.affectsGP ? "yes" : "no";
  }
}

function populateGroupForm(idx) {
  const g = DB.groups[idx]; if (!g) return;
  document.getElementById("grpFormTitle").textContent = `✏️ Alter Group: ${g.name}`;
  document.getElementById("grpEditIdx").value = idx;
  document.getElementById("grpNameInp").value = g.name;
  if (g.parent) document.getElementById("grpParentInp").value = g.parent;
  document.getElementById("grpNatureInp").value = g.nature;
  document.getElementById("grpGpInp").value = g.affectsGP ? "yes" : "no";
  document.getElementById("grpNameInp").focus();
}

function resetGroupForm() {
  document.getElementById("grpFormTitle").textContent = "➕ Create New Accounting Sub-Group";
  document.getElementById("grpEditIdx").value = "";
  document.getElementById("grpNameInp").value = "";
}

function saveGroupFromForm() {
  const idx = document.getElementById("grpEditIdx").value;
  const name = document.getElementById("grpNameInp").value.trim();
  const parent = document.getElementById("grpParentInp").value;
  const nature = document.getElementById("grpNatureInp").value;
  const affectsGP = document.getElementById("grpGpInp").value === "yes";
  if (!name) { toast("⚠ Group ka naam dalein!"); return; }

  if (idx !== "") {
    const g = DB.groups[Number(idx)];
    const oldName = g.name;
    Object.assign(g, { name, parent, nature, affectsGP });
    DB.ledgers.forEach(l => { if (l.group === oldName) l.group = name; });
    toast(`✅ Group "${name}" Updated!`);
  } else {
    if (DB.groups.some(g => g.name.toLowerCase() === name.toLowerCase())) { toast("⚠ Yeh Group pehle se hai!"); return; }
    DB.groups.push({ name, parent, nature, affectsGP, custom: true });
    toast(`✅ Custom Group "${name}" Created!`);
  }
  saveDB();
  renderGroupsScreen();
}

function deleteCustomGroup(name) {
  if (DB.ledgers.some(l => l.group === name)) { toast("🚫 Is Group me Ledgers bane hain, pehle unhe Move karein!"); return; }
  DB.groups = DB.groups.filter(g => g.name !== name);
  saveDB(); renderGroupsScreen(); toast("🗑️ Custom Group Deleted");
}

function openQuickAccountGroupModal(targetSelectId = "") {
  const parentOpts = (DB.groups || []).map(g => `<option value="${escHtml(g.name)}">${escHtml(g.name)} (${escHtml(g.nature)})</option>`).join("");
  const body = `
    <div class="form-grid">
      <div class="field" style="grid-column:span 2;"><label>New Accounting Group Name *</label><input id="qGrpNameInp" placeholder="e.g. Project Expenses"></div>
      <div class="field"><label>Under Parent Group *</label><select id="qGrpParentInp" onchange="const p=DB.groups.find(g=>g.name===this.value); if(p) document.getElementById('qGrpNatureInp').value=p.nature;">${parentOpts}</select></div>
      <div class="field"><label>Nature</label><select id="qGrpNatureInp"><option>Assets</option><option>Liabilities</option><option>Expenses</option><option>Income</option></select></div>
    </div>`;
  const foot = `<button class="btn btn-sec" onclick="closeModal()">Cancel</button><button class="btn" onclick="saveQuickAccountGroup('${targetSelectId}')">💾 Create Group</button>`;
  showModal("➕ Create New Accounting Group", body, foot);
}

function saveQuickAccountGroup(targetSelectId) {
  const name = (document.getElementById("qGrpNameInp").value || "").trim();
  const parent = document.getElementById("qGrpParentInp").value;
  const nature = document.getElementById("qGrpNatureInp").value;
  if (!name) { toast("⚠ Group Name dalein!"); return; }
  if (DB.groups.some(g => g.name.toLowerCase() === name.toLowerCase())) { toast("⚠ Yeh Group pehle se hai!"); return; }
  const pObj = DB.groups.find(g => g.name === parent);
  DB.groups.push({ name, parent, nature, affectsGP: pObj ? pObj.affectsGP : false, custom: true });
  saveDB(); closeModal(); renderScreen(CURRENT_SCREEN);
  setTimeout(() => { if (targetSelectId && document.getElementById(targetSelectId)) document.getElementById(targetSelectId).value = name; }, 40);
}

function openMoveGroupLedgersModal(grpIdx) {
  const srcGrp = DB.groups[grpIdx]; if (!srcGrp) return;
  const ledgersInGroup = DB.ledgers.map((l, idx) => ({ l, idx })).filter(x => x.l.group === srcGrp.name);
  if (!ledgersInGroup.length) { toast("ℹ️ Is group me koi ledger nahi hai!"); return; }
  const targetOpts = DB.groups.filter(g => g.name !== srcGrp.name).map(g => `<option value="${escHtml(g.name)}">${escHtml(g.name)} (${escHtml(g.nature)})</option>`).join("");
  const ledRows = ledgersInGroup.map(x => `
    <label style="display:flex; align-items:center; gap:8px; padding:6px 10px; border-bottom:1px solid #e2e8f0; cursor:pointer;">
      <input type="checkbox" class="move-led-chk" value="${x.idx}" checked>
      <b>${escHtml(x.l.name)}</b>
      <span style="margin-left:auto; font-size:11px; color:#64748b;">Op: ₹${fmtINR(x.l.opBal || 0)} ${x.l.opType || "Dr"}</span>
    </label>`).join("");
  const body = `
    <div style="margin-bottom:10px; font-size:12.5px;">Current Group: <b style="color:var(--pri-dark);">${escHtml(srcGrp.name)}</b> (${ledgersInGroup.length} Ledgers)</div>
    <div style="max-height:210px; overflow-y:auto; border:1px solid var(--border); border-radius:4px; margin-bottom:12px;">${ledRows}</div>
    <div class="field"><label>Move Selected Ledgers To *</label><select id="moveTargetGroupSel">${targetOpts}</select></div>`;
  const foot = `<button class="btn btn-sec" onclick="closeModal()">Cancel</button><button class="btn" onclick="confirmMoveGroupLedgers('${escHtml(srcGrp.name)}')">⇄ Move Ledgers</button>`;
  showModal("⇄ Move Ledgers to Another Group", body, foot);
}

function confirmMoveGroupLedgers(srcGrpName) {
  const targetGrp = document.getElementById("moveTargetGroupSel").value;
  const chks = Array.from(document.querySelectorAll(".move-led-chk:checked"));
  if (!chks.length) { toast("⚠ Kam se kam 1 ledger select karein!"); return; }
  chks.forEach(c => { if (DB.ledgers[Number(c.value)]) DB.ledgers[Number(c.value)].group = targetGrp; });
  saveDB(); closeModal(); renderGroupsScreen();
  toast(`✅ ${chks.length} Ledgers moved from "${srcGrpName}" to "${targetGrp}"!`);
}

// ============================================================================
// 4. STOCK GROUPS MASTER
// ============================================================================
function renderStockGroupsScreen() {
  ensureStockGroupsInitialized();
  document.getElementById("screenTitle").textContent = "Stock Groups Master (Raw, Packing, Finished Goods & GST)";
  document.getElementById("screenSub").textContent = "Create/Alter Inventory Groups with Default HSN, GST & ITC Category";

  const parentOpts = `<option value="Primary">Primary</option>` + DB.stockGroups.map(sg => `<option value="${escHtml(sg.name)}">${escHtml(sg.name)}</option>`).join("");
  const slabOpts = GST_SLABS.map(s => `<option value="${s}" ${s === 18 ? "selected" : ""}>${s}% GST</option>`).join("");

  const rows = DB.stockGroups.map((sg, idx) => {
    const itemCount = DB.items.filter(it => (it.stockGroup || "Finished Goods") === sg.name).length;
    return `
      <tr onclick="populateStockGroupForm('${sg.id}')" style="cursor:pointer;">
        <td>${idx + 1}</td>
        <td><b>${escHtml(sg.name)}</b> ${sg.custom ? '<span class="kbd" style="background:#fef08a;">Custom</span>' : ''}</td>
        <td>${escHtml(sg.parent || "Primary")}</td>
        <td><span class="kbd">${escHtml(sg.gstCategory || "Taxable")}</span></td>
        <td>${escHtml(sg.itcCategory || "Inputs")}</td>
        <td>${escHtml(sg.defaultHsn || "-")}</td>
        <td class="num"><b>${sg.defaultGst ?? 18}%</b></td>
        <td class="num"><b>${itemCount}</b> Items</td>
        <td>
          <button class="btn btn-sec" style="padding:2px 7px; font-size:11px;" onclick="event.stopPropagation(); populateStockGroupForm('${sg.id}')">Alter</button>
          ${sg.custom ? `<button class="btn btn-danger" style="padding:2px 7px; font-size:11px;" onclick="event.stopPropagation(); deleteStockGroup('${sg.id}')">Del</button>` : ''}
        </td>
      </tr>`;
  }).join("");

  document.getElementById("screenBody").innerHTML = `
    <div class="form-card">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
        <h3 style="font-size:14px; color:var(--pri-dark);" id="sgFormHeading">🏭 Create / Alter Stock Group</h3>
        <div style="display:flex; gap:6px;">
          <button class="btn btn-sec" onclick="resetStockGroupForm()">Clear</button>
          <button class="btn btn-sec" onclick="navigate('masters_item')">📦 Stock Items →</button>
        </div>
      </div>
      <input type="hidden" id="sgIdInp" value="">
      <div class="form-grid">
        <div class="field"><label>Stock Group Name *</label><input id="sgNameInp" placeholder="e.g. Corrugated Boxes"></div>
        <div class="field"><label>Under Parent</label><select id="sgParentInp">${parentOpts}</select></div>
        <div class="field"><label>GST Category *</label>
          <select id="sgGstCatInp" onchange="if(this.value!=='Taxable') document.getElementById('sgGstRateInp').value='0';">
            <option value="Taxable">Taxable</option><option value="Nil Rated">Nil Rated</option>
            <option value="Exempt">Exempt</option><option value="Non-GST">Non-GST</option>
          </select>
        </div>
        <div class="field"><label>ITC Type</label>
          <select id="sgItcCatInp">
            <option value="Inputs">Inputs</option><option value="Capital Goods">Capital Goods</option>
            <option value="Input Services">Input Services</option><option value="Ineligible">Ineligible</option>
          </select>
        </div>
        <div class="field"><label>Default HSN</label><input id="sgHsnInp" placeholder="e.g. 4819"></div>
        <div class="field"><label>Default GST %</label><select id="sgGstRateInp">${slabOpts}</select></div>
      </div>
      <div style="margin-top:10px; display:flex; justify-content:flex-end;">
        <button class="btn" onclick="saveStockGroupFromForm()">💾 Save Stock Group (Ctrl+A)</button>
      </div>
    </div>

    <div class="form-card" style="padding:0; overflow:hidden;">
      <table class="tally-tbl">
        <thead><tr><th>#</th><th>Stock Group</th><th>Under</th><th>GST Cat</th><th>ITC</th><th>HSN</th><th class="num">GST%</th><th class="num">Items</th><th>Actions</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

function populateStockGroupForm(id) {
  const sg = DB.stockGroups.find(x => x.id === id); if (!sg) return;
  document.getElementById("sgFormHeading").textContent = `✏️ Alter Stock Group: ${sg.name}`;
  document.getElementById("sgIdInp").value = sg.id;
  document.getElementById("sgNameInp").value = sg.name;
  document.getElementById("sgParentInp").value = sg.parent || "Primary";
  document.getElementById("sgGstCatInp").value = sg.gstCategory || "Taxable";
  document.getElementById("sgItcCatInp").value = sg.itcCategory || "Inputs";
  document.getElementById("sgHsnInp").value = sg.defaultHsn || "";
  document.getElementById("sgGstRateInp").value = sg.defaultGst ?? 18;
  document.getElementById("sgNameInp").focus();
}

function resetStockGroupForm() {
  document.getElementById("sgFormHeading").textContent = "🏭 Create / Alter Stock Group";
  document.getElementById("sgIdInp").value = "";
  document.getElementById("sgNameInp").value = "";
}

function saveStockGroupFromForm() {
  const id = document.getElementById("sgIdInp").value;
  const name = document.getElementById("sgNameInp").value.trim();
  const parent = document.getElementById("sgParentInp").value;
  const gstCategory = document.getElementById("sgGstCatInp").value;
  const itcCategory = document.getElementById("sgItcCatInp").value;
  const defaultHsn = document.getElementById("sgHsnInp").value.trim();
  const defaultGst = gstCategory === "Taxable" ? (Number(document.getElementById("sgGstRateInp").value) || 0) : 0;
  if (!name) { toast("⚠ Stock Group Name dalein!"); return; }
  if (id) {
    const sg = DB.stockGroups.find(x => x.id === id);
    if (sg) {
      const old = sg.name;
      Object.assign(sg, { name, parent, gstCategory, itcCategory, defaultHsn, defaultGst });
      DB.items.forEach(it => { if (it.stockGroup === old) it.stockGroup = name; });
    }
  } else {
    DB.stockGroups.push({ id: uid("SG"), name, parent, gstCategory, itcCategory, defaultHsn, defaultGst, custom: true });
  }
  saveDB(); renderStockGroupsScreen(); toast(`✅ Stock Group "${name}" Saved!`);
}

function deleteStockGroup(id) {
  const sg = DB.stockGroups.find(x => x.id === id); if (!sg) return;
  if (DB.items.some(it => it.stockGroup === sg.name)) { toast("🚫 Is Stock Group me Items jude hain!"); return; }
  DB.stockGroups = DB.stockGroups.filter(x => x.id !== id);
  saveDB(); renderStockGroupsScreen(); toast("🗑️ Stock Group Deleted");
}

// ============================================================================
// 5. STOCK ITEMS MASTER & BOM RECIPE BUILDER
// ============================================================================
function renderItemMastersScreen() {
  ensureStockGroupsInitialized();
  document.getElementById("screenTitle").textContent = "Stock Items & HSN Master (with Stock Group & BOM)";
  document.getElementById("screenSub").textContent = "Click any Item to Alter | Set BOM Recipe for Finished Goods";

  const sgOpts = DB.stockGroups.map(sg => `<option value="${escHtml(sg.name)}" ${sg.name === "Finished Goods" ? "selected" : ""}>${escHtml(sg.name)} [${sg.defaultGst}%]</option>`).join("");
  const uomOpts = UOM_LIST.map(u => `<option value="${u}">${u}</option>`).join("");
  const slabOpts = GST_SLABS.map(s => `<option value="${s}" ${s === 18 ? "selected" : ""}>${s}% GST</option>`).join("");

  const rowsHtml = (DB.items || []).map((it, idx) => {
    const opVal = +((Number(it.opQty) || 0) * (Number(it.opRate) || 0)).toFixed(2);
    const hasBom = Array.isArray(it.bom) && it.bom.length > 0;
    return `
      <tr onclick="populateItemForm('${it.id}')" style="cursor:pointer;">
        <td>${idx + 1}</td>
        <td><b>${escHtml(it.name)}</b> ${hasBom ? `<span class="kbd" style="background:#dbeafe;color:#1e3a8a;">BOM (${it.bom.length})</span>` : ""}</td>
        <td><span class="kbd">${escHtml(it.stockGroup || "Finished Goods")}</span></td>
        <td><span class="kbd">${escHtml(it.hsn || "-")}</span></td>
        <td>${escHtml(it.uom)}</td>
        <td class="num"><b>${it.gstRate}%</b></td>
        <td class="num">₹${fmtINR(it.rate)}</td>
        <td class="num">${it.opQty || 0} ${escHtml(it.uom)}</td>
        <td class="num">₹${fmtINR(opVal)}</td>
        <td>
          <button class="btn btn-sec" style="padding:2px 6px; font-size:11px;" onclick="event.stopPropagation(); openBomSetupModal('${it.id}')">⚙️ BOM</button>
          <button class="btn btn-danger" style="padding:2px 6px; font-size:11px;" onclick="event.stopPropagation(); deleteStockItem('${it.id}')">Del</button>
        </td>
      </tr>`;
  }).join("");

  document.getElementById("screenBody").innerHTML = `
    <div class="form-card">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; flex-wrap:wrap; gap:6px;">
        <h3 style="font-size:14px; color:var(--pri-dark);" id="itmFormHeading">📦 Create Stock Item</h3>
        <div style="display:flex; gap:6px;">
          <button class="btn" style="background:#1e3a8a;" onclick="openBomSetupModal()">⚙️ Set BOM (Recipe)</button>
          <button class="btn btn-sec" onclick="navigate('masters_stock_groups')">🏭 Stock Groups</button>
          <button class="btn btn-sec" onclick="resetItemForm()">Clear</button>
        </div>
      </div>
      <input type="hidden" id="itmIdInp" value="">
      <div class="form-grid">
        <div class="field" style="grid-column:span 2;"><label>Item Name *</label><input id="itmNameInp" placeholder="e.g. Solar Inverter 5KVA"></div>
        <div class="field"><label>Stock Group *</label><select id="itmSgInp" onchange="onItemStockGroupSelect(this.value)">${sgOpts}</select></div>
        <div class="field"><label>GST Category</label>
          <select id="itmGstCatInp" onchange="if(this.value!=='Taxable') document.getElementById('itmGstInp').value='0';">
            <option value="Taxable">Taxable</option><option value="Nil Rated">Nil Rated</option><option value="Exempt">Exempt</option>
          </select>
        </div>
        <div class="field"><label>HSN / SAC Code</label><input id="itmHsnInp" placeholder="8504"></div>
        <div class="field"><label>UOM</label><select id="itmUomInp">${uomOpts}</select></div>
        <div class="field"><label>GST Rate %</label><select id="itmGstInp">${slabOpts}</select></div>
        <div class="field"><label>Std Rate (₹)</label><input type="number" step="0.01" id="itmRateInp" value="0"></div>
        <div class="field"><label>Opening Qty</label><input type="number" step="0.01" id="itmOpQtyInp" value="0"></div>
        <div class="field"><label>Opening Cost Rate (₹)</label><input type="number" step="0.01" id="itmOpRateInp" value="0"></div>
      </div>
      <div style="margin-top:10px; display:flex; justify-content:flex-end;">
        <button class="btn" onclick="saveItemFromForm()">💾 Save Stock Item (Ctrl+A)</button>
      </div>
    </div>

    <div class="form-card" style="padding:0; overflow:hidden;">
      <table class="tally-tbl">
        <thead><tr><th>#</th><th>Item Name</th><th>Stock Group</th><th>HSN</th><th>UOM</th><th class="num">GST%</th><th class="num">Rate</th><th class="num">Op Qty</th><th class="num">Op Val</th><th>Actions</th></tr></thead>
        <tbody>${rowsHtml || `<tr><td colspan="10" style="text-align:center; padding:18px; color:var(--muted);">No Stock Items yet.</td></tr>`}</tbody>
      </table>
    </div>`;
}

function onItemStockGroupSelect(sgName) {
  const sg = DB.stockGroups.find(x => x.name === sgName); if (!sg) return;
  document.getElementById("itmGstCatInp").value = sg.gstCategory || "Taxable";
  if (!document.getElementById("itmHsnInp").value && sg.defaultHsn) document.getElementById("itmHsnInp").value = sg.defaultHsn;
  document.getElementById("itmGstInp").value = String(sg.defaultGst ?? 18);
}

function populateItemForm(id) {
  const it = getItem(id); if (!it) return;
  document.getElementById("itmFormHeading").textContent = `✏️ Alter Item: ${it.name}`;
  document.getElementById("itmIdInp").value = it.id;
  document.getElementById("itmNameInp").value = it.name;
  document.getElementById("itmSgInp").value = it.stockGroup || "Finished Goods";
  document.getElementById("itmGstCatInp").value = it.gstCategory || "Taxable";
  document.getElementById("itmHsnInp").value = it.hsn || "";
  document.getElementById("itmUomInp").value = it.uom || "NOS";
  document.getElementById("itmGstInp").value = it.gstRate ?? 18;
  document.getElementById("itmRateInp").value = it.rate || 0;
  document.getElementById("itmOpQtyInp").value = it.opQty || 0;
  document.getElementById("itmOpRateInp").value = it.opRate || 0;
  document.getElementById("itmNameInp").focus();
}

function resetItemForm() {
  document.getElementById("itmFormHeading").textContent = "📦 Create Stock Item";
  document.getElementById("itmIdInp").value = "";
  document.getElementById("itmNameInp").value = "";
  document.getElementById("itmHsnInp").value = "";
  document.getElementById("itmRateInp").value = 0;
  document.getElementById("itmOpQtyInp").value = 0;
  document.getElementById("itmOpRateInp").value = 0;
}

function saveItemFromForm() {
  const id = document.getElementById("itmIdInp").value;
  const name = document.getElementById("itmNameInp").value.trim();
  const stockGroup = document.getElementById("itmSgInp").value;
  const gstCategory = document.getElementById("itmGstCatInp").value;
  const hsn = document.getElementById("itmHsnInp").value.trim();
  const uom = document.getElementById("itmUomInp").value;
  const gstRate = gstCategory === "Taxable" ? (Number(document.getElementById("itmGstInp").value) || 0) : 0;
  const rate = Number(document.getElementById("itmRateInp").value) || 0;
  const opQty = Number(document.getElementById("itmOpQtyInp").value) || 0;
  const opRate = Number(document.getElementById("itmOpRateInp").value) || 0;
  if (!name) { toast("⚠ Item Name dalein!"); return; }
  if (id) {
    const it = getItem(id);
    if (it) Object.assign(it, { name, stockGroup, gstCategory, hsn, uom, gstRate, rate, opQty, opRate });
  } else {
    DB.items.push({ id: uid("I"), name, stockGroup, gstCategory, itcCategory: "Inputs", hsn, uom, gstRate, rate, opQty, opRate, bom: [], bomStdBatch: 1 });
  }
  saveDB(); renderItemMastersScreen(); toast(`✅ Stock Item "${name}" Saved!`);
}

function deleteStockItem(id) {
  DB.items = DB.items.filter(i => i.id !== id);
  saveDB(); renderItemMastersScreen(); toast("🗑️ Stock Item Deleted");
}

// ---------- BOM RECIPE SETUP MODAL ----------
let TEMP_BOM_ITEM_ID = "", TEMP_BOM_BATCH = 1, TEMP_BOM_LINES = [];

function openBomSetupModal(finishedItemId = "") {
  ensureStockGroupsInitialized();
  const fgId = finishedItemId || (document.getElementById("itmIdInp") ? document.getElementById("itmIdInp").value : "");
  if (!fgId) { toast("⚠ Pehle kisi Stock Item ko select/save karein!"); return; }
  const fgItem = getItem(fgId); if (!fgItem) return;
  const avail = DB.items.filter(i => i.id !== fgId);
  if (!avail.length) { toast("⚠ BOM ke liye pehle Raw/Packing items banayein!"); return; }
  TEMP_BOM_ITEM_ID = fgId;
  TEMP_BOM_BATCH = fgItem.bomStdBatch || 1;
  TEMP_BOM_LINES = (fgItem.bom && fgItem.bom.length) ? JSON.parse(JSON.stringify(fgItem.bom)) : [{ itemId: avail[0].id, qty: 1 }];
  renderBomModalUI();
}

function renderBomModalUI() {
  const fgItem = getItem(TEMP_BOM_ITEM_ID);
  const avail = DB.items.filter(i => i.id !== TEMP_BOM_ITEM_ID);
  let estCost = 0;
  const rows = TEMP_BOM_LINES.map((ln, idx) => {
    const comp = getItem(ln.itemId) || avail[0];
    const rate = Number(comp?.opRate) || Number(comp?.rate) || 0;
    const cost = +((Number(ln.qty) || 0) * rate).toFixed(2);
    estCost += cost;
    const opts = avail.map(c => `<option value="${c.id}" ${c.id === ln.itemId ? "selected" : ""}>${escHtml(c.name)} [${escHtml(c.stockGroup || "")}]</option>`).join("");
    return `
      <tr>
        <td>${idx + 1}</td>
        <td><select style="width:100%;padding:4px;" onchange="TEMP_BOM_LINES[${idx}].itemId=this.value; renderBomModalUI();">${opts}</select></td>
        <td><input type="number" step="0.001" class="num" style="width:85px;padding:4px;" value="${ln.qty}" oninput="TEMP_BOM_LINES[${idx}].qty=Number(this.value)||0;"> ${escHtml(comp?.uom || "")}</td>
        <td class="num">₹${fmtINR(cost)}</td>
        <td><button class="btn btn-danger" style="padding:2px 6px;" onclick="TEMP_BOM_LINES.splice(${idx},1); renderBomModalUI();">✕</button></td>
      </tr>`;
  }).join("");

  const body = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
      <b>🏭 Recipe for: ${escHtml(fgItem.name)}</b>
      <div>Batch Qty: <input type="number" style="width:70px;padding:4px;" value="${TEMP_BOM_BATCH}" oninput="TEMP_BOM_BATCH=Math.max(1,Number(this.value)||1)"> ${escHtml(fgItem.uom)}</div>
    </div>
    <table class="tally-tbl">
      <thead><tr><th>#</th><th>Raw / Packing Item</th><th>Qty Required</th><th class="num">Est. Cost</th><th></th></tr></thead>
      <tbody>${rows}</tbody>
      <tfoot><tr style="background:#f1f5f9;font-weight:700;"><td colspan="3" style="text-align:right;">Total Material Cost:</td><td class="num">₹${fmtINR(estCost)}</td><td></td></tr></tfoot>
    </table>
    <div style="margin-top:8px;"><button class="btn btn-sec" onclick="TEMP_BOM_LINES.push({itemId:'${avail[0].id}',qty:1}); renderBomModalUI();">➕ Add Component</button></div>`;
  const foot = `<button class="btn btn-sec" onclick="closeModal()">Cancel</button><button class="btn" onclick="saveBomToItem()">💾 Save BOM Recipe</button>`;
  showModal(`⚙️ BOM Setup - ${fgItem.name}`, body, foot);
}

function saveBomToItem() {
  const fg = getItem(TEMP_BOM_ITEM_ID); if (!fg) return;
  fg.bomStdBatch = Math.max(1, Number(TEMP_BOM_BATCH) || 1);
  fg.bom = TEMP_BOM_LINES.filter(l => l.itemId && Number(l.qty) > 0);
  saveDB(); closeModal(); renderScreen(CURRENT_SCREEN);
  toast(`✅ BOM Saved for "${fg.name}"!`);
}