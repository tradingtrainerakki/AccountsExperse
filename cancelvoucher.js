// ============================================================================
// cancelvoucher.js  —  VOUCHER CANCEL (Delete ki jagah accounts wali sahi practice)
//   * Voucher screen ke upar "⛔ Cancel Voucher" button
//   * Day Book me har voucher ke saath "Cancel" button (Del jaisa ka taisa rahega)
//   * Cancel se pehle Yes / No ka popup
//   * Cancelled voucher: Day Book me CANCELLED likha dikhega, Ledger/Group/Reports
//     me iska asar nahi judega, Voucher No. dobara use nahi hoga, Restore bhi ho sakta hai
//   * Voucher SAVE karte waqt bhi screen ke beech me "Save? Yes / No" popup
// Load order: index.html me printsetup.js ke BAAD (sabse last) lagayein.
// ============================================================================
(function () {
  "use strict";

  const e = (s) => escHtml(s);
  const findV = (vid) => (DB.vouchers || []).find(v => v.id === vid);

  // --------------------------------------------------------------------------
  // 0. Cancelled voucher ki entries ko accounting se hata do
  //    (Balance, Ledger statement, Group Summary, Recon sab isi function se chalte hain)
  // --------------------------------------------------------------------------
  window.__cvShowRaw = false; // Day Book / voucher screen ko asli entries dikhani ho tab true
  const _origGVE = window.getVoucherEntries;
  if (typeof _origGVE === "function") {
    window.getVoucherEntries = function (v) {
      if (v && v.cancelled && !window.__cvShowRaw) return [];
      return _origGVE.apply(this, arguments);
    };
  }

  // thoda style (ek baar)
  (function addStyle() {
    if (document.getElementById("cvStyle")) return;
    const st = document.createElement("style");
    st.id = "cvStyle";
    st.textContent =
      ".cv-cancelled td{color:#94a3b8 !important;background:#f8fafc;}" +
      ".cv-cancelled td:not(:last-child){text-decoration:line-through;}" +
      ".cv-badge{display:inline-block;margin-left:6px;padding:1px 6px;border-radius:3px;background:#fee2e2;color:#b91c1c;" +
      "font-size:10px;font-weight:800;letter-spacing:.5px;text-decoration:none !important;}" +
      ".cv-red{color:#b91c1c !important;border-color:#fca5a5 !important;}";
    document.head.appendChild(st);
  })();

  // --------------------------------------------------------------------------
  // 1. YES / NO popup  (Y = Yes, N / Esc = No)
  // --------------------------------------------------------------------------
  function askPopup(opts) {
    // opts: { title, v, headline, points[], withReason, yesLabel, onYes }
    const pts = (opts.points || []).map(p => `<li>${p}</li>`).join("");
    const token = String(Date.now()) + Math.random().toString(36).slice(2, 6); // is popup ki pehchaan
    const body = `
      <div id="cvConfirmBox" data-cv="${token}" style="font-size:13px;line-height:1.6;">
        <div style="margin-bottom:8px;padding:8px 10px;background:#f1f5f9;border-radius:4px;">
          <b>${e(opts.v.type)}</b> &nbsp;|&nbsp; No: <b>${e(opts.v.vchNo)}</b> &nbsp;|&nbsp; ${e(fmtDate(opts.v.date))} &nbsp;|&nbsp; <b>₹${e(fmtINR(opts.v.amount))}</b>
        </div>
        <div style="font-weight:700;">${opts.headline}</div>
        ${opts.extra || ""}
        <ul style="margin:8px 0 8px 18px;font-size:12px;color:#475569;">${pts}</ul>
        ${opts.withReason ? `<div class="field"><label>Cancel ka karan (optional)</label><input id="cvReason" placeholder="e.g. Galat entry / Duplicate entry"></div>` : ""}
      </div>`;
    const foot = `<button class="btn btn-sec" onclick="closeModal()">No (N / Esc)</button>
                  <button class="${opts.yesClass || "btn btn-danger"}" id="cvYesBtn">${opts.yesLabel}</button>`;
    showModal(opts.title, body, foot);
    const yes = document.getElementById("cvYesBtn");
    if (yes) {
      yes.onclick = () => opts.onYes();
      if (opts.focusYes) setTimeout(() => yes.focus(), 30);
    }
    // Y / N keys (jab box khula ho aur koi text box me type na ho)
    const onKey = (ev) => {
      const box = document.getElementById("cvConfirmBox");
      // popup band ho gaya ya koi aur popup aa gaya => ye listener hata do (Y/N ka asar nahi hoga)
      if (!box || box.dataset.cv !== token || !kbOverlayOpen()) { window.removeEventListener("keydown", onKey, true); return; }
      const tag = (document.activeElement && document.activeElement.tagName || "").toUpperCase();
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      const k = (ev.key || "").toLowerCase();
      if (k === "y") { ev.preventDefault(); ev.stopImmediatePropagation(); window.removeEventListener("keydown", onKey, true); opts.onYes(); }
      else if (k === "n") { ev.preventDefault(); ev.stopImmediatePropagation(); window.removeEventListener("keydown", onKey, true); closeModal(); }
    };
    window.addEventListener("keydown", onKey, true);
  }

  function refreshScreen() {
    try { renderScreen(CURRENT_SCREEN); } catch (err) { /* ignore */ }
    try { if (typeof refreshHeaderAndSidebar === "function") refreshHeaderAndSidebar(); } catch (err) { /* ignore */ }
  }

  // --------------------------------------------------------------------------
  // 2. CANCEL
  // --------------------------------------------------------------------------
  window.cancelVoucherAsk = function (vid) {
    if (!canWriteData()) { toast("👁️ Read-Only Mode: Cancel ki permission nahi hai!"); return; }
    const v = findV(vid);
    if (!v) return;
    if (v.cancelled) { toast("ℹ Ye voucher pehle se Cancelled hai"); return; }
    askPopup({
      title: "⛔ Voucher Cancel Karein?",
      v: v,
      headline: "Kya aap is voucher ko <b>Cancel</b> karna chahte hain?",
      points: [
        "Voucher <b>delete nahi</b> hoga — Day Book me <b>CANCELLED</b> likha dikhega",
        "Ledger balance, Group Summary aur reports me iska asar <b>nahi</b> judega",
        "Voucher No. dobara use nahi hoga",
        "Zarurat par baad me <b>Restore</b> bhi kar sakte hain"
      ],
      withReason: true,
      yesLabel: "Yes, Cancel Voucher (Y)",
      onYes: () => window.cancelVoucherDo(vid)
    });
  };

  window.cancelVoucherDo = function (vid) {
    if (!canWriteData()) { toast("👁️ Read-Only Mode: Cancel ki permission nahi hai!"); return; }
    const v = findV(vid);
    if (!v) { closeModal(); return; }
    const reason = ((document.getElementById("cvReason") || {}).value || "").trim();
    v.cancelled = true;
    v.cancelledAt = new Date().toISOString();
    v.cancelReason = reason;
    saveDB();
    closeModal();
    refreshScreen();
    toast("⛔ Voucher Cancel ho gaya (Delete nahi hua)");
  };

  // --------------------------------------------------------------------------
  // 3. RESTORE
  // --------------------------------------------------------------------------
  window.restoreVoucherAsk = function (vid) {
    if (!canWriteData()) { toast("👁️ Read-Only Mode: Restore ki permission nahi hai!"); return; }
    const v = findV(vid);
    if (!v || !v.cancelled) return;
    askPopup({
      title: "↩ Voucher Restore Karein?",
      v: v,
      headline: "Kya aap is Cancelled voucher ko <b>dobara chalu (Restore)</b> karna chahte hain?",
      points: ["Voucher phir se Ledger balance aur reports me judne lagega"],
      withReason: false,
      yesLabel: "Yes, Restore (Y)",
      onYes: () => window.restoreVoucherDo(vid)
    });
  };

  window.restoreVoucherDo = function (vid) {
    const v = findV(vid);
    if (!v) { closeModal(); return; }
    delete v.cancelled; delete v.cancelledAt; delete v.cancelReason;
    saveDB();
    closeModal();
    refreshScreen();
    toast("↩ Voucher Restore ho gaya");
  };

  // --------------------------------------------------------------------------
  // 3b. SAVE se pehle "Save? Yes / No" popup  (+ Cancelled voucher edit block)
  // --------------------------------------------------------------------------
  function voucherTotals(st) {
    if (st.mode === "item" && typeof isItemCapableVoucher === "function" && isItemCapableVoucher(st.vchType)) return null;
    let dr = 0, cr = 0;
    (st.acctLines || []).forEach(l => {
      const a = Number(l.amount) || 0;
      if (!l.ledgerId || a <= 0) return;
      if (l.type === "Dr") dr += a; else cr += a;
    });
    return { dr: +dr.toFixed(2), cr: +cr.toFixed(2) };
  }

  const _origSV = window.saveCurrentVoucher;
  if (typeof _origSV === "function") {
    window.saveCurrentVoucher = function () {
      const st = (typeof VCH_STATE !== "undefined") ? VCH_STATE : null;
      const id = st ? st.editingId : null;
      const old = id ? findV(id) : null;
      if (old && old.cancelled) { toast("⛔ Cancelled voucher edit nahi ho sakta — pehle Restore karein"); return; }
      const boxOpen = !!document.getElementById("cvConfirmBox") && kbOverlayOpen();
      if (!st || boxOpen) return _origSV.apply(this, arguments);

      try { if (typeof syncVoucherHeaderFromDOM === "function") syncVoucherHeaderFromDOM(); } catch (err) { /* ignore */ }
      const t = voucherTotals(st);
      // Zaroori cheezein adhoori / Dr-Cr barabar nahi => popup ke bajay asli error dikhne do
      if (!String(st.vchNo || "").trim() || !st.date || (t && (t.dr <= 0 || t.dr !== t.cr))) {
        return _origSV.apply(this, arguments);
      }
      const extra = t ? `<div style="margin:6px 0;font-size:12.5px;">Debit: <b>₹${e(fmtINR(t.dr))}</b> &nbsp;|&nbsp; Credit: <b>₹${e(fmtINR(t.cr))}</b> <span style="color:#15803d;">✓ Matched</span></div>` : "";
      askPopup({
        title: "💾 Voucher Save Karein?",
        v: { type: st.vchType, vchNo: st.vchNo, date: st.date, amount: t ? t.dr : 0 },
        headline: old ? "Kya aap is voucher ke <b>badlav Save</b> karna chahte hain?" : "Kya aap is voucher ko <b>Save</b> karna chahte hain?",
        extra: extra,
        points: [],
        withReason: false,
        yesClass: "btn",
        focusYes: true,
        yesLabel: "Yes, Save (Y)",
        onYes: () => { closeModal(); _origSV.call(window); }
      });
    };
  }

  // --------------------------------------------------------------------------
  // 4. DAY BOOK  (CANCELLED dikhana + Cancel/Restore buttons + sahi Total)
  // --------------------------------------------------------------------------
  function decorateDayBook() {
    const body = document.getElementById("screenBody");
    if (!body) return;
    const rows = body.querySelectorAll("tbody tr[data-vid]");
    const canW = typeof canWriteData === "function" ? canWriteData() : false;
    let tot = 0;
    rows.forEach(tr => {
      const v = findV(tr.dataset.vid);
      if (!v) return;
      const cells = tr.children;
      const act = cells[cells.length - 1];
      if (v.cancelled) {
        tr.classList.add("cv-cancelled");
        if (v.cancelReason) tr.title = "Cancelled: " + v.cancelReason;
        if (cells[3]) cells[3].insertAdjacentHTML("beforeend", '<span class="cv-badge">CANCELLED</span>');
        const editBtn = act && Array.from(act.querySelectorAll("button")).find(b => /^\s*Edit\s*$/i.test(b.textContent));
        if (editBtn) editBtn.textContent = "View";
        if (act && canW) {
          const b = document.createElement("button");
          b.className = "btn btn-sec";
          b.style.cssText = "padding:2px 7px;font-size:11px;margin-left:4px;";
          b.textContent = "Restore";
          b.onclick = (ev) => { ev.stopPropagation(); window.restoreVoucherAsk(v.id); };
          const del = Array.from(act.querySelectorAll("button")).find(x => /Del/i.test(x.textContent));
          if (del) act.insertBefore(b, del); else act.appendChild(b);
        }
      } else {
        tot += Number(v.amount) || 0;
        if (act && canW) {
          const b = document.createElement("button");
          b.className = "btn btn-sec cv-red";
          b.style.cssText = "padding:2px 7px;font-size:11px;margin-left:4px;";
          b.textContent = "Cancel";
          b.title = "Voucher cancel karein (delete nahi hoga)";
          b.onclick = (ev) => { ev.stopPropagation(); window.cancelVoucherAsk(v.id); };
          const del = Array.from(act.querySelectorAll("button")).find(x => /Del/i.test(x.textContent));
          if (del) act.insertBefore(b, del); else act.appendChild(b);
        }
      }
    });
    // Total me cancelled voucher mat jodo
    const totCell = body.querySelector("tfoot td.num");
    if (totCell && rows.length) totCell.innerHTML = "₹" + e(fmtINR(+tot.toFixed(2)));
  }

  const _origDayBook = window.renderDayBookScreen;
  if (typeof _origDayBook === "function") {
    window.renderDayBookScreen = function () {
      window.__cvShowRaw = true; // Day Book me party ka naam dikhane ke liye asli entries
      try { _origDayBook.apply(this, arguments); }
      finally { window.__cvShowRaw = false; }
      try { decorateDayBook(); } catch (err) { /* ignore */ }
    };
  }

  // --------------------------------------------------------------------------
  // 5. VOUCHER SCREEN  (upar "⛔ Cancel Voucher" button / Cancelled ka laal banner)
  // --------------------------------------------------------------------------
  function decorateVoucherScreen() {
    if (typeof VCH_STATE === "undefined" || !VCH_STATE || !VCH_STATE.editingId) return;
    const v = findV(VCH_STATE.editingId);
    const body = document.getElementById("screenBody");
    if (!v || !body) return;

    if (v.cancelled) {
      body.querySelectorAll("input,select,textarea").forEach(el => { el.disabled = true; });
      ["saveVchMainBtn", "vchSlipBtn"].forEach(id => { const b = document.getElementById(id); if (b) b.style.display = "none"; });
      const when = v.cancelledAt ? new Date(v.cancelledAt).toLocaleString("en-IN") : "";
      const ban = document.createElement("div");
      ban.style.cssText = "background:#fef2f2;border:1px solid #fecaca;color:#991b1b;padding:8px 12px;border-radius:4px;margin-bottom:10px;display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;";
      ban.innerHTML = `<div><b>⛔ Ye voucher CANCELLED hai</b> — accounts me iska asar nahi judta. Edit nahi ho sakta.
          <div style="font-size:11.5px;font-weight:400;">${when ? "Cancel hua: " + e(when) : ""}${v.cancelReason ? " | Karan: " + e(v.cancelReason) : ""}</div></div>`;
      if (typeof canWriteData === "function" && canWriteData()) {
        const b = document.createElement("button");
        b.className = "btn btn-sec";
        b.type = "button";
        b.textContent = "↩ Restore Voucher";
        b.onclick = () => window.restoreVoucherAsk(v.id);
        ban.appendChild(b);
      }
      body.insertBefore(ban, body.firstChild);
      return;
    }

    // normal (saved) voucher: +Ledger button ke saath Cancel button
    if (document.getElementById("vchCancelBtn")) return;
    if (typeof canWriteData === "function" && !canWriteData()) return;
    const ledBtn = Array.from(body.querySelectorAll("button")).find(b => /openQuickLedgerModal/.test(b.getAttribute("onclick") || ""));
    if (!ledBtn) return;
    const b = document.createElement("button");
    b.id = "vchCancelBtn";
    b.type = "button";
    b.className = "btn btn-sec cv-red";
    b.textContent = "⛔ Cancel Voucher";
    b.title = "Voucher cancel karein (delete nahi hoga)";
    b.onclick = () => window.cancelVoucherAsk(v.id);
    ledBtn.insertAdjacentElement("afterend", b);
  }

  const _origRV = window.renderVoucherEntryScreen;
  if (typeof _origRV === "function") {
    window.renderVoucherEntryScreen = function () {
      window.__cvShowRaw = false;
      const r = _origRV.apply(this, arguments);
      try { decorateVoucherScreen(); } catch (err) { /* ignore */ }
      return r;
    };
  }
  // --------------------------------------------------------------------------
  // 6. GATEWAY se "Vouchers Entry" dabane par hamesha NAYA (fresh) voucher khule
  //    (pehle pichhla edit kiya hua voucher dobara khul jaata tha)
  // --------------------------------------------------------------------------
  window.__vchInit = false;
  const _origOpenV = window.openVoucherScreen;
  if (typeof _origOpenV === "function") {
    window.openVoucherScreen = function () {
      window.__vchInit = true; // is raaste me state pehle se sahi tarah set hoti hai
      try { return _origOpenV.apply(this, arguments); }
      finally { window.__vchInit = false; }
    };
  }

  const _origNav = window.navigate;
  if (typeof _origNav === "function") {
    window.navigate = function (screen) {
      if (screen === "voucher_entry" && !window.__vchInit && CURRENT_SCREEN === "gateway" &&
          typeof initVoucherState === "function") {
        try {
          const lastType = (typeof VCH_STATE !== "undefined" && VCH_STATE && VCH_STATE.vchType) || "Receipt";
          initVoucherState(lastType); // naya khaali voucher (editingId = null)
        } catch (err) { /* ignore */ }
      }
      return _origNav.apply(this, arguments);
    };
  }
})();
