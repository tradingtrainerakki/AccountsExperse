// ============================================================================
// KEYBOARD.JS: UNIFIED MASTER KEYBOARD ENGINE FOR ACCOUNTSEXPERSE
// (Enter, Esc, Arrow Keys, Searchable Dropdowns, Voucher Switcher, Quit Box)
// ============================================================================

(function () {
  // ================= 1. SEARCHABLE DROPDOWN FOR ALL <SELECT> =================
  const kdPop = document.getElementById("kdPop");
  const kdSearch = document.getElementById("kdSearch");
  const kdList = document.getElementById("kdList");
  let kdCur = null, kdItems = [], kdAct = 0;

  function kdOpen() { return kdPop && kdPop.style.display === "flex"; }

  function kdBuild(filter) {
    const toks = (filter || "").toLowerCase().trim().split(/\s+/).filter(Boolean);
    kdItems = [];
    Array.from(kdCur.options).forEach((o, i) => {
      if (o.disabled) return;
      if (toks.every(w => o.text.toLowerCase().includes(w))) kdItems.push({ i, text: o.text });
    });
    kdAct = filter ? 0 : Math.max(0, kdItems.findIndex(x => x.i === kdCur.selectedIndex));
    kdList.innerHTML = kdItems.length
      ? kdItems.map((x, k) => `<div class="kd-item${x.i === kdCur.selectedIndex ? " cur" : ""}" data-k="${k}">${escHtml(x.text) || "&nbsp;"}</div>`).join("")
      : `<div class="kd-none">Koi match nahi mila</div>`;
    kdPaint();
  }

  function kdPaint() {
    kdList.querySelectorAll(".kd-item").forEach((d, k) => d.classList.toggle("act", k === kdAct));
    const a = kdList.querySelector(".kd-item.act");
    if (a) a.scrollIntoView({ block: "nearest" });
  }

  function openKdPop(sel) {
    if (!sel || sel.disabled || sel.multiple || sel.size > 1 || sel.hasAttribute("data-nokd")) return;
    kdCur = sel;
    kdSearch.value = "";
    kdPop.style.display = "flex";
    kdBuild("");
    const r = sel.getBoundingClientRect();
    kdPop.style.minWidth = Math.max(260, r.width) + "px";
    let left = Math.min(r.left, window.innerWidth - kdPop.offsetWidth - 8);
    let top = r.bottom + 2;
    if (top + kdPop.offsetHeight > window.innerHeight - 8) top = Math.max(8, r.top - kdPop.offsetHeight - 2);
    kdPop.style.left = Math.max(8, left) + "px";
    kdPop.style.top = top + "px";
    kdSearch.focus();
  }

  function closeKdPop(refocus) {
    kdPop.style.display = "none";
    const s = kdCur;
    kdCur = null;
    if (refocus && s && s.isConnected) s.focus();
  }

  function kdPick() {
    if (!kdCur) return;
    const it = kdItems[kdAct];
    const sel = kdCur;
    if (!it) { closeKdPop(true); return; }
    const root = sel.closest("#modalBody") || document.getElementById("screenBody") || document.body;
    const listBefore = getFocusableList(root, false);
    const idxBefore = listBefore.indexOf(sel);
    const changed = sel.selectedIndex !== it.i;
    sel.selectedIndex = it.i;
    kdPop.style.display = "none";
    kdCur = null;
    if (changed) {
      sel.dispatchEvent(new Event("input", { bubbles: true }));
      sel.dispatchEvent(new Event("change", { bubbles: true }));
    }
    setTimeout(() => {
      const rootNow = kbOverlayOpen() ? document.getElementById("modalBody") : document.getElementById("screenBody");
      if (!rootNow) return;
      const fl = getFocusableList(rootNow, false);
      const nextEl = fl[idxBefore + 1];
      if (nextEl) {
        nextEl.focus();
        if (nextEl.tagName === "INPUT" && nextEl.select) try { nextEl.select(); } catch {}
      }
    }, 50);
  }

  if (kdSearch) kdSearch.addEventListener("input", () => kdBuild(kdSearch.value));
  if (kdList) {
    kdList.addEventListener("mousedown", e => {
      const d = e.target.closest(".kd-item");
      if (!d) return;
      e.preventDefault();
      kdAct = +d.dataset.k;
      kdPick();
    });
  }
  document.addEventListener("mousedown", e => {
    const t = e.target;
    if (kdOpen()) { if (!kdPop.contains(t)) closeKdPop(false); return; }
    if (t && t.tagName === "SELECT" && !t.disabled && !t.multiple && !(t.size > 1) && !t.hasAttribute("data-nokd")) {
      e.preventDefault(); t.focus(); openKdPop(t);
    }
  }, true);

  // ================= 2. VOUCHER TYPE SWITCHER (#vtBox) =================
  const VCH_TYPES = [
    { k: "c", t: "Contra" }, { k: "y", t: "Payment" }, { k: "r", t: "Receipt" },
    { k: "j", t: "Journal" }, { k: "s", t: "Sales" }, { k: "p", t: "Purchase" },
    { k: "k", t: "Credit Note" }, { k: "d", t: "Debit Note" }
  ];
  const vtBox = document.getElementById("vtBox");
  const vtList = document.getElementById("vtList");
  let vtAct = 0;

  function vtOpen() { return vtBox && vtBox.style.display === "flex"; }
  function vtPaint() {
    vtList.innerHTML = VCH_TYPES.map((x, i) =>
      `<div class="vitem${i === vtAct ? " act" : ""}" data-i="${i}"><span>${x.t}</span><span class="vk">${x.k.toUpperCase()}</span></div>`
    ).join("");
  }
  function openVtBox() {
    const cur = (typeof VCH_STATE !== "undefined" && VCH_STATE) ? VCH_STATE.vchType : "";
    vtAct = Math.max(0, VCH_TYPES.findIndex(x => x.t === cur));
    vtPaint();
    document.activeElement?.blur?.();
    vtBox.style.display = "flex";
  }
  function closeVtBox() { vtBox.style.display = "none"; }
  function chooseVt(i) {
    const x = VCH_TYPES[i]; if (!x) return;
    closeVtBox();
    openVoucherScreen(x.t);
  }
  if (vtList) {
    vtList.addEventListener("mousedown", e => {
      const d = e.target.closest(".vitem");
      if (d) { e.preventDefault(); chooseVt(+d.dataset.i); }
    });
  }

  // ================= 3. QUIT BOX (#quitBox) =================
  const quitBox = document.getElementById("quitBox");
  const qYes = document.getElementById("qYes"), qNo = document.getElementById("qNo");
  let qSel = "no";
  function quitOpen() { return quitBox && quitBox.style.display === "flex"; }
  function paintQuit() { qYes.classList.toggle("act", qSel === "yes"); qNo.classList.toggle("act", qSel === "no"); }
  function openQuit() { qSel = "no"; paintQuit(); quitBox.style.display = "flex"; qNo.focus(); }
  function closeQuit() { quitBox.style.display = "none"; }
  if (qYes) qYes.onclick = () => { closeQuit(); supaLogout(); };
  if (qNo) qNo.onclick = closeQuit;

  // ================= 4. FOCUS & ROW HELPERS =================
  function isVisible(el) {
    return !!(el && el.offsetParent !== null && !el.disabled && el.type !== "hidden");
  }

  function getFocusableList(root, includeButtons) {
    const sel = includeButtons
      ? "input:not([type='hidden']):not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled])"
      : "input:not([type='hidden']):not([disabled]), select:not([disabled]), textarea:not([disabled])";
    return Array.from(root.querySelectorAll(sel)).filter(el => {
      if (!isVisible(el)) return false;
      if (el.readOnly && el.tagName === "INPUT") return false;
      if (el.tagName === "BUTTON") {
        const txt = (el.innerText || "").trim();
        if (txt === "✕ Esc" || txt === "✕") return false;
      }
      return true;
    });
  }

  function moveFocus(list, active, step) {
    if (!list.length) return false;
    let idx = list.indexOf(active);
    idx = idx < 0 ? (step > 0 ? 0 : list.length - 1) : (idx + step + list.length) % list.length;
    const t = list[idx];
    t.focus();
    if (t.tagName === "INPUT" && !["checkbox", "radio", "button"].includes(t.type)) {
      try { t.select(); } catch {}
    }
    return true;
  }

  function getSelectableRows(root) {
    return Array.from(root.querySelectorAll("table.tally-tbl tbody tr, .tally-grp-block.clickable, .tally-sub-led"))
      .filter(el => el.offsetParent !== null);
  }

  // ================= 5. SINGLE MASTER KEYDOWN HANDLER =================
  window.addEventListener("keydown", function (e) {
    if (e.isComposing) return;
    const k = e.key;
    const active = document.activeElement;

    // A. GLOBAL CTRL / ALT SHORTCUTS
    if (e.altKey && !e.ctrlKey && !e.metaKey) {
      const kl = k.toLowerCase();
      if (kl === "p") { e.preventDefault(); e.stopImmediatePropagation(); smartPrint(); return; }
      if (kl === "d") { e.preventDefault(); e.stopImmediatePropagation(); navigate("daybook"); return; }
      if (kl === "l") { e.preventDefault(); e.stopImmediatePropagation(); launchDirectLedgerPicker("ledger_view"); return; }
      if (kl === "u") { e.preventDefault(); e.stopImmediatePropagation(); openGroupSummary(); return; }
      if (kl === "r") { e.preventDefault(); e.stopImmediatePropagation(); launchDirectLedgerPicker("recon"); return; }
      if (kl === "o") { e.preventDefault(); e.stopImmediatePropagation(); navigate("outstanding"); return; }
      if (kl === "s") { e.preventDefault(); e.stopImmediatePropagation(); navigate("stock_summary"); return; }
      if (kl === "m") { e.preventDefault(); e.stopImmediatePropagation(); openBomProductionScreen(); return; }
      if (kl === "g") { e.preventDefault(); e.stopImmediatePropagation(); navigate("gstr1"); return; }
      if (kl === "3") { e.preventDefault(); e.stopImmediatePropagation(); navigate("gstr3b"); return; }
      if (kl === "c") { e.preventDefault(); e.stopImmediatePropagation(); openQuickLedgerModal(CURRENT_SCREEN === "voucher_entry" ? "onVoucherQuickLedgerCreated" : ""); return; }
      if (kl === "n" && CURRENT_SCREEN === "voucher_entry") { e.preventDefault(); e.stopImmediatePropagation(); toggleVchNoMode(); return; }
      if (kl === "b" && CURRENT_SCREEN === "voucher_entry") {
        const tr = active && active.closest && active.closest(".tally-tbl tbody tr");
        if (tr) { e.preventDefault(); e.stopImmediatePropagation(); openBillAllocModal(Array.from(tr.parentElement.children).indexOf(tr)); }
        return;
      }
      if (k === "F2") { e.preventDefault(); e.stopImmediatePropagation(); openPeriodModal(); return; }
      return;
    }

    if (e.ctrlKey && !e.altKey && !e.metaKey) {
      const kl = k.toLowerCase();
      if (kl === "e") { e.preventDefault(); e.stopImmediatePropagation(); exportBackupJSON(); return; }
      if (kl === "p") { e.preventDefault(); e.stopImmediatePropagation(); smartPrint(); return; }
      if (kl === "a") {
        e.preventDefault(); e.stopImmediatePropagation();
        if (kbOverlayOpen()) {
          const btn = document.querySelector("#modalFoot .btn:not(.btn-sec):not(.btn-danger)");
          if (btn) btn.click();
        } else if (CURRENT_SCREEN === "voucher_entry") saveCurrentVoucher();
        else if (CURRENT_SCREEN === "masters_ledger") saveLedgerFromForm();
        else if (CURRENT_SCREEN === "masters_groups") saveGroupFromForm();
        else if (CURRENT_SCREEN === "masters_stock_groups") saveStockGroupFromForm();
        else if (CURRENT_SCREEN === "masters_item") saveItemFromForm();
        else if (CURRENT_SCREEN === "bom_production") saveMfgProductionVoucher();
        return;
      }
      return;
    }

    // B. CLOUD LOGIN OVERLAY
    const supaOv = document.getElementById("supaAuthOverlay");
    if (supaOv && supaOv.classList.contains("active")) {
      const em = document.getElementById("supa-email"), pw = document.getElementById("supa-pass"), btn = document.getElementById("supa-login-btn");
      if (k === "ArrowDown" || k === "ArrowUp") {
        e.preventDefault(); e.stopImmediatePropagation();
        moveFocus([em, pw, btn].filter(Boolean), active, k === "ArrowDown" ? 1 : -1);
      } else if (k === "Enter") {
        e.preventDefault(); e.stopImmediatePropagation();
        if (active === em && pw) { pw.focus(); pw.select?.(); }
        else if (btn) btn.click();
      }
      return;
    }

    // C. SEARCHABLE DROPDOWN (#kdPop)
    if (kdOpen()) {
      if (k === "ArrowDown") { e.preventDefault(); e.stopImmediatePropagation(); if (kdItems.length) { kdAct = (kdAct + 1) % kdItems.length; kdPaint(); } return; }
      if (k === "ArrowUp") { e.preventDefault(); e.stopImmediatePropagation(); if (kdItems.length) { kdAct = (kdAct - 1 + kdItems.length) % kdItems.length; kdPaint(); } return; }
      if (k === "Enter" || k === "Tab") { e.preventDefault(); e.stopImmediatePropagation(); kdPick(); return; }
      if (k === "Escape") { e.preventDefault(); e.stopImmediatePropagation(); closeKdPop(true); return; }
      return;
    }

    // D. QUIT BOX
    if (quitOpen()) {
      e.preventDefault(); e.stopImmediatePropagation();
      if (k.toLowerCase() === "y") { closeQuit(); supaLogout(); }
      else if (k.toLowerCase() === "n" || k === "Escape") closeQuit();
      else if (["ArrowLeft", "ArrowRight", "Tab"].includes(k)) { qSel = qSel === "yes" ? "no" : "yes"; paintQuit(); }
      else if (k === "Enter") { qSel === "yes" ? (closeQuit(), supaLogout()) : closeQuit(); }
      return;
    }

    // E. VOUCHER TYPE SWITCHER (#vtBox)
    if (vtOpen()) {
      e.preventDefault(); e.stopImmediatePropagation();
      if (k === "ArrowDown") { vtAct = (vtAct + 1) % VCH_TYPES.length; vtPaint(); }
      else if (k === "ArrowUp") { vtAct = (vtAct - 1 + VCH_TYPES.length) % VCH_TYPES.length; vtPaint(); }
      else if (k === "Enter") chooseVt(vtAct);
      else if (k === "Escape") { closeVtBox(); goBack(); }
      else if (k.length === 1) {
        const i = VCH_TYPES.findIndex(x => x.k === k.toLowerCase());
        if (i >= 0) chooseVt(i);
      }
      return;
    }

    // F. F2 TEMP DATE & LEDGER PICKER POPUPS (handled by their own inputs)
    if (document.getElementById("directF2DateModal") || document.getElementById("directLedgerPickerModal")) return;

    // G. OPEN <SELECT> WITH ARROW / ENTER / TYPING
    if (active && active.tagName === "SELECT" && !active.hasAttribute("data-nokd")) {
      if (["ArrowDown", "ArrowUp", "Enter", " ", "F4"].includes(k)) {
        e.preventDefault(); e.stopImmediatePropagation(); openKdPop(active); return;
      }
      if (k.length === 1) {
        e.preventDefault(); e.stopImmediatePropagation(); openKdPop(active); kdSearch.value = k; kdBuild(k); return;
      }
    }

    // H. APP MODAL (#appModal: F3 Company, F2 Date, Period, Quick Ledger, etc.)
    if (kbOverlayOpen()) {
      if (k === "Escape") { e.preventDefault(); e.stopImmediatePropagation(); closeModal(); return; }
      const card = document.querySelector("#appModal .modal-card");
      const inputs = getFocusableList(card, false);
      const all = getFocusableList(card, true);
      const isText = active && ((active.tagName === "INPUT" && !["checkbox", "radio", "button"].includes(active.type)) || active.tagName === "TEXTAREA");

      if (["ArrowDown", "ArrowUp", "ArrowLeft", "ArrowRight"].includes(k)) {
        if (isText && (k === "ArrowLeft" || k === "ArrowRight")) return;
        e.preventDefault(); e.stopImmediatePropagation();
        moveFocus(all, active, (k === "ArrowDown" || k === "ArrowRight") ? 1 : -1);
        return;
      }
      if (k === "Enter") {
        if (active && active.tagName === "BUTTON" && card.contains(active)) { e.preventDefault(); e.stopImmediatePropagation(); active.click(); return; }
        if (inputs.length && active && card.contains(active)) {
          e.preventDefault(); e.stopImmediatePropagation();
          const i = inputs.indexOf(active);
          if (i >= 0 && i < inputs.length - 1) moveFocus(inputs, active, 1);
          else card.querySelector("#modalFoot .btn:not(.btn-sec):not(.btn-danger)")?.click();
        }
      }
      return;
    }

    // I. FUNCTION KEYS (F2, F3, F4-F9 VOUCHER SWITCH, ?)
    if (k === "F3") { e.preventDefault(); e.stopImmediatePropagation(); openEntitySwitcherModal(); return; }
    if (k === "?") { e.preventDefault(); e.stopImmediatePropagation(); openHelpModal(); return; }
    if (k === "F2") {
      e.preventDefault(); e.stopImmediatePropagation();
      if (CURRENT_SCREEN === "gateway" || CURRENT_SCREEN === "voucher_entry") openDateModal();
      else openDirectF2DateModal();
      return;
    }
    if (k === "F4" && (CURRENT_SCREEN === "ledgers_view" || CURRENT_SCREEN === "bank_recon")) {
      e.preventDefault(); e.stopImmediatePropagation();
      launchDirectLedgerPicker(CURRENT_SCREEN === "bank_recon" ? "recon" : "ledger_view");
      return;
    }

    // Standard Tally Function Keys (F4-F9) — Works everywhere (even inside dropdowns/inputs)
    const FN_VCH = { F4: "Contra", F5: "Payment", F6: "Receipt", F7: "Journal", F8: "Sales", F9: "Purchase" };
    if (FN_VCH[k]) {
      e.preventDefault();
      e.stopImmediatePropagation();
      openVoucherScreen(FN_VCH[k]);
      return;
    }

    // Single-Letter Voucher Keys (C, Y, R, J, S, P, K, D) — Works on Voucher Entry & Report screens
    if (CURRENT_SCREEN !== "gateway") {
      const isTypingBox = active && (
        active.tagName === "TEXTAREA" ||
        active.tagName === "SELECT" ||
        (active.tagName === "INPUT" && ["text", "search", "email", "password", "number"].includes((active.type || "text").toLowerCase()))
      );
      if (!isTypingBox && k.length === 1) {
        const vt = VCH_TYPES.find(x => x.k === k.toLowerCase());
        if (vt) {
          e.preventDefault();
          e.stopImmediatePropagation();
          openVoucherScreen(vt.t);
          return;
        }
      }
    }
    // J. GATEWAY SCREEN
    if (CURRENT_SCREEN === "gateway") {
      const list = getActiveGatewayList();
      if (k === "Escape") {
        e.preventDefault(); e.stopImmediatePropagation();
        if (window._GW_FOLDER) openGwCategory(null);
        else openQuit();
        return;
      }
      if (k === "ArrowDown" || k === "ArrowUp") {
        e.preventDefault(); e.stopImmediatePropagation();
        GW_INDEX = (GW_INDEX + (k === "ArrowDown" ? 1 : -1) + list.length) % list.length;
        renderGateway();
        return;
      }
      if (k === "Enter") { e.preventDefault(); e.stopImmediatePropagation(); triggerGwRow(GW_INDEX); return; }
      if (k.length === 1) {
        const i = list.findIndex(m => String(m.hk).toLowerCase() === k.toLowerCase());
        if (i >= 0) { e.preventDefault(); e.stopImmediatePropagation(); GW_INDEX = i; triggerGwRow(i); }
      }
      return;
    }

    // K. VOUCHER ENTRY SCREEN
    if (CURRENT_SCREEN === "voucher_entry") {
      if (k === "Escape") { e.preventDefault(); e.stopImmediatePropagation(); openVtBox(); return; }

      // Voucher Type Hotkeys (C, Y, R, J, S, P, K, D) — Text/Narration box ke bahar (Date box par bhi chalega)
      const isTextTyping = active && (
        active.tagName === "TEXTAREA" ||
        (active.tagName === "INPUT" && ["text", "search", "email", "password"].includes((active.type || "text").toLowerCase()))
      );
      if (!isTextTyping && k.length === 1) {
        const vt = VCH_TYPES.find(x => x.k === k.toLowerCase());
        if (vt) {
          e.preventDefault();
          e.stopImmediatePropagation();
          openVoucherScreen(vt.t);
          return;
        }
      }

      const sb = document.getElementById("screenBody");
      if (k === "Enter" && active && sb.contains(active) && (active.tagName === "INPUT" || active.tagName === "TEXTAREA")) {
        if (active.tagName === "TEXTAREA" && e.shiftKey) return;
        e.preventDefault(); e.stopImmediatePropagation();
        const fields = getFocusableList(sb, false);
        const i = fields.indexOf(active);
        if (i >= 0 && i < fields.length - 1) moveFocus(fields, active, 1);
        else document.getElementById("saveVchMainBtn")?.focus();
        return;
      }
      return;
    }

    // L. ALL OTHER SCREENS (MASTERS + REPORTS)
    if (k === "Escape") {
      e.preventDefault(); e.stopImmediatePropagation();
      if (CURRENT_SCREEN === "ledgers_view" && window._RETURN_TO_GROUP_SUMMARY) {
        const grp = window._RETURN_TO_GROUP_SUMMARY;
        window._RETURN_TO_GROUP_SUMMARY = "";
        openGroupSummary(grp);
      } else {
        goBack();
      }
      return;
    }

    const sb = document.getElementById("screenBody");
    if (!sb) return;

    // Inside Form Inputs (Masters / BOM / Search)
    if (active && sb.contains(active) && (active.tagName === "INPUT" || active.tagName === "TEXTAREA")) {
      if (k === "ArrowDown" || k === "ArrowUp") {
        e.preventDefault(); e.stopImmediatePropagation();
        const fields = getFocusableList(sb, false);
        moveFocus(fields, active, k === "ArrowDown" ? 1 : -1);
        return;
      }
      if (k === "Enter") {
        if (active.tagName === "TEXTAREA" && e.shiftKey) return;
        e.preventDefault(); e.stopImmediatePropagation();
        const fields = getFocusableList(sb, false);
        const i = fields.indexOf(active);
        if (i >= 0 && i < fields.length - 1) moveFocus(fields, active, 1);
        else sb.querySelector("button.btn:not(.btn-sec):not(.btn-danger)")?.focus();
      }
      return;
    }

    // Table / Report Row Navigation
    if (k === "ArrowDown" || k === "ArrowUp") {
      const rows = getSelectableRows(sb);
      if (!rows.length) return;
      e.preventDefault(); e.stopImmediatePropagation();
      let idx = rows.findIndex(r => r.classList.contains("kb-sel"));
      rows.forEach(r => r.classList.remove("kb-sel"));
      idx = idx < 0 ? (k === "ArrowDown" ? 0 : rows.length - 1) : (idx + (k === "ArrowDown" ? 1 : -1) + rows.length) % rows.length;
      rows[idx].classList.add("kb-sel");
      rows[idx].scrollIntoView({ block: "nearest" });
      return;
    }

    if (k === "Enter") {
      const sel = sb.querySelector(".kb-sel");
      if (sel) { e.preventDefault(); e.stopImmediatePropagation(); sel.click(); }
    }
  }, true);
})();
// ============================================================================
// DEDICATED F4 KEY FOR "CHANGE GROUP" ON GROUP SUMMARY SCREEN
// ============================================================================
window.addEventListener("keydown", function (e) {
  if (e.key !== "F4" || e.altKey || e.ctrlKey || e.shiftKey) return;

  // Check karein ki abhi Group Summary screen khuli hai
  const titleEl = document.querySelector("#screenTitle, .screen-title, .screen-bar");
  const isGroupSummary = titleEl && /Group Summary/i.test(titleEl.textContent || "");
  if (!isGroupSummary) return;

  // Agar koi modal pehle se khula ho toh skip karein
  const modalOpen = document.querySelector("#modalOverlay.show, #modalOverlay[style*='flex'], .modal-overlay.show");
  if (modalOpen) return;

  const grpSelect = document.querySelector("#screenBody select");
  if (!grpSelect) return;

  e.preventDefault();
  e.stopImmediatePropagation();

  const options = Array.from(grpSelect.options).map(o => ({ val: o.value, text: o.textContent.trim() }));
  let selIdx = Math.max(0, options.findIndex(o => o.val === grpSelect.value));

  const body = `
    <input id="f4GrpSearch" type="text" placeholder="Type Group name to search... (↑ ↓ + Enter)"
      style="width:100%; padding:8px 10px; font-size:13px; border:1.5px solid var(--pri); border-radius:4px; margin-bottom:8px;">
    <div id="f4GrpList" style="max-height:300px; overflow-y:auto; border:1px solid #e2e8f0; border-radius:4px;"></div>`;

  showModal("Change Group (F4)", body, `<button class="btn btn-sec" onclick="closeModal()">Cancel (Esc)</button>`);

  const inp = document.getElementById("f4GrpSearch");
  const listEl = document.getElementById("f4GrpList");
  let filtered = options.slice();

  function renderList() {
    if (selIdx >= filtered.length) selIdx = Math.max(0, filtered.length - 1);
    listEl.innerHTML = filtered.map((o, i) => `
      <div class="f4-grp-item" data-idx="${i}"
        style="padding:7px 10px; cursor:pointer; font-size:13px; border-bottom:1px solid #f1f5f9;
        background:${i === selIdx ? "#fef08a" : "#fff"}; font-weight:${i === selIdx ? "700" : "500"};">
        ${escHtml(o.text)}
      </div>`).join("") || `<div style="padding:12px; text-align:center; color:#64748b;">No group found</div>`;

    listEl.querySelectorAll(".f4-grp-item").forEach(el => {
      el.onclick = () => pickGroup(Number(el.dataset.idx));
    });
    const activeEl = listEl.querySelector(`[data-idx="${selIdx}"]`);
    if (activeEl) activeEl.scrollIntoView({ block: "nearest" });
  }

  function pickGroup(idx) {
    if (!filtered[idx]) return;
    grpSelect.value = filtered[idx].val;
    closeModal();
    grpSelect.dispatchEvent(new Event("change", { bubbles: true }));
  }

  inp.addEventListener("input", () => {
    const q = inp.value.trim().toLowerCase();
    filtered = options.filter(o => o.text.toLowerCase().includes(q));
    selIdx = 0;
    renderList();
  });

  inp.addEventListener("keydown", (ev) => {
    if (ev.key === "ArrowDown") { ev.preventDefault(); selIdx = Math.min(filtered.length - 1, selIdx + 1); renderList(); }
    else if (ev.key === "ArrowUp") { ev.preventDefault(); selIdx = Math.max(0, selIdx - 1); renderList(); }
    else if (ev.key === "Enter") { ev.preventDefault(); pickGroup(selIdx); }
  });

  renderList();
  setTimeout(() => inp.focus(), 40);
}, true);
