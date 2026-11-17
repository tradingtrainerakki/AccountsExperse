// ============================================================================
// ACCOUNTSEXPERSE GST v2.0 — KEYBOARD ENGINE WITH BACKGROUND SCREEN-LOCK
// ============================================================================
(function () {
  "use strict";

  function safeEsc(str) {
    if (typeof window.escHtml === "function") return window.escHtml(str);
    return String(str == null ? "" : str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  // Helper to get screenBody even when locked by our Group Picker
  function getRealScreenBody() {
    return document.getElementById("screenBody") || document.getElementById("screenBody_locked");
  }

  function isStandardModalOpen() {
    const m = document.getElementById("modalOverlay");
    if (!m) return false;
    if (m.classList.contains("show")) return true;
    const disp = window.getComputedStyle(m).display;
    return disp !== "none" && disp !== "";
  }

  function isGroupPickerOpen() {
    return !!document.getElementById("customGrpPickerOverlay");
  }

  function isGroupSummaryScreen() {
    const bodyEl = getRealScreenBody();
    const titleEl = document.querySelector("#screenTitle, .screen-title, .screen-bar");
    const titleTxt = titleEl ? titleEl.textContent : "";
    const bodyTxt = bodyEl ? bodyEl.textContent : "";
    return /Group Summary/i.test(titleTxt) || (/Select Group/i.test(bodyTxt) && !!(bodyEl && bodyEl.querySelector("select")));
  }

  // ==========================================================================
  // 1. STANDALONE "CHANGE GROUP (G)" PICKER WITH BACKGROUND FREEZE
  // ==========================================================================
  let grpPickerState = {
    options: [],
    filtered: [],
    selIdx: 0,
    selectEl: null,
    lockedRows: []
  };

  function lockBackgroundScreen() {
    const bodyEl = document.getElementById("screenBody");
    if (!bodyEl) return;

    // 1. Temporarily rename #screenBody ID so reports.js / app.js listeners find NOTHING
    bodyEl.id = "screenBody_locked";

    // 2. Temporarily disable onclick on background table rows so Enter cannot open a ledger
    grpPickerState.lockedRows = [];
    bodyEl.querySelectorAll("[onclick], tr, td, a").forEach(el => {
      if (el.hasAttribute("onclick")) {
        grpPickerState.lockedRows.push({ el, attr: el.getAttribute("onclick"), prop: el.onclick });
        el.removeAttribute("onclick");
        el.onclick = null;
      } else if (typeof el.onclick === "function") {
        grpPickerState.lockedRows.push({ el, attr: null, prop: el.onclick });
        el.onclick = null;
      }
    });
  }

  function unlockBackgroundScreen() {
    const bodyEl = document.getElementById("screenBody_locked");
    if (bodyEl) bodyEl.id = "screenBody";

    if (grpPickerState.lockedRows && grpPickerState.lockedRows.length) {
      grpPickerState.lockedRows.forEach(item => {
        if (item.attr !== null) item.el.setAttribute("onclick", item.attr);
        if (item.prop) item.el.onclick = item.prop;
      });
      grpPickerState.lockedRows = [];
    }
  }

  window._closeGrpPicker = function () {
    const old = document.getElementById("customGrpPickerOverlay");
    if (old) old.remove();
    unlockBackgroundScreen();
    grpPickerState.selectEl = null;
  };

  window._renderGrpPickerList = function () {
    const listEl = document.getElementById("gGrpList");
    if (!listEl) return;

    const { filtered } = grpPickerState;
    if (grpPickerState.selIdx >= filtered.length) {
      grpPickerState.selIdx = Math.max(0, filtered.length - 1);
    }
    const selIdx = grpPickerState.selIdx;

    listEl.innerHTML = filtered.length
      ? filtered.map((o, i) => `
          <div class="g-grp-item" data-idx="${i}"
            style="padding:8px 12px; cursor:pointer; font-size:13px; border-bottom:1px solid #f1f5f9;
            background:${i === selIdx ? "#fef08a" : "#fff"}; color:#0f172a; font-weight:${i === selIdx ? "700" : "500"};">
            ${safeEsc(o.text)}
          </div>`).join("")
      : `<div style="padding:14px; text-align:center; color:#64748b;">No group found</div>`;

    listEl.querySelectorAll(".g-grp-item").forEach(el => {
      el.onmousedown = function (ev) {
        ev.preventDefault();
        ev.stopPropagation();
        window._pickGroupFromModal(Number(el.getAttribute("data-idx")));
      };
    });

    const activeEl = listEl.querySelector(`[data-idx="${selIdx}"]`);
    if (activeEl) activeEl.scrollIntoView({ block: "nearest" });
  };

  window._pickGroupFromModal = function (idx) {
    const item = grpPickerState.filtered[idx];
    const selectEl = grpPickerState.selectEl;

    // Pehle background unlock karein taaki renderGroupSummary("#screenBody") sahi kaam kare
    const old = document.getElementById("customGrpPickerOverlay");
    if (old) old.remove();
    unlockBackgroundScreen();
    grpPickerState.selectEl = null;

    if (!item || !selectEl) return;

    setTimeout(() => {
      selectEl.value = item.val;
      selectEl.dispatchEvent(new Event("change", { bubbles: true }));
      if (document.activeElement && typeof document.activeElement.blur === "function") {
        document.activeElement.blur();
      }
    }, 10);
  };

  window._openGroupPickerModal = function () {
    if (typeof window.closeModal === "function") window.closeModal();
    const stdModal = document.getElementById("modalOverlay");
    if (stdModal) {
      stdModal.classList.remove("show");
      stdModal.style.display = "none";
    }

    unlockBackgroundScreen();
    const bodyEl = document.getElementById("screenBody");
    if (!bodyEl) return;
    const grpSelect = bodyEl.querySelector("select");
    if (!grpSelect) return;

    const old = document.getElementById("customGrpPickerOverlay");
    if (old) old.remove();

    const options = Array.from(grpSelect.options).map(o => ({
      val: o.value,
      text: o.textContent.trim()
    }));

    grpPickerState.options = options;
    grpPickerState.filtered = options.slice();
    grpPickerState.selIdx = Math.max(0, options.findIndex(o => o.val === grpSelect.value));
    grpPickerState.selectEl = grpSelect;

    // FREEZE BACKGROUND SCREEN SO OTHER JS FILES CANNOT TOUCH IT
    lockBackgroundScreen();

    const overlay = document.createElement("div");
    overlay.id = "customGrpPickerOverlay";
    overlay.style.cssText = "position:fixed; inset:0; background:rgba(15,23,42,0.45); z-index:999999; display:flex; align-items:center; justify-content:center;";

    overlay.innerHTML = `
      <div style="background:#fff; width:460px; max-width:92vw; border-radius:6px; box-shadow:0 12px 32px rgba(0,0,0,0.28); overflow:hidden; border:1px solid #047857;">
        <div style="background:#047857; color:#fff; padding:10px 14px; font-weight:700; font-size:14px; display:flex; justify-content:space-between; align-items:center;">
          <span>Change Group (G)</span>
          <span id="customGrpClose" style="cursor:pointer; background:#fff; color:#0f172a; padding:2px 8px; border-radius:3px; font-size:12px; font-weight:600;">✕ Esc</span>
        </div>
        <div style="padding:12px 14px;">
          <input id="gGrpSearch" type="text" autocomplete="off" placeholder="Type Group name... (↑ ↓ + Enter)"
            style="width:100%; box-sizing:border-box; padding:8px 10px; font-size:13.5px; border:1.5px solid #047857; border-radius:4px; outline:none; margin-bottom:8px;">
          <div id="gGrpList" style="max-height:280px; overflow-y:auto; border:1px solid #e2e8f0; border-radius:4px;"></div>
          <div style="text-align:right; margin-top:10px;">
            <span id="customGrpCancel" style="display:inline-block; cursor:pointer; padding:5px 12px; font-size:12.5px; border:1px solid #cbd5e1; border-radius:4px; background:#f8fafc; color:#1e293b;">Cancel (Esc)</span>
          </div>
        </div>
      </div>`;

    document.body.appendChild(overlay);

    const inp = document.getElementById("gGrpSearch");
    inp.addEventListener("input", function () {
      const q = inp.value.trim().toLowerCase();
      grpPickerState.filtered = grpPickerState.options.filter(o => o.text.toLowerCase().includes(q));
      grpPickerState.selIdx = 0;
      window._renderGrpPickerList();
    });

    document.getElementById("customGrpClose").onclick = window._closeGrpPicker;
    document.getElementById("customGrpCancel").onclick = window._closeGrpPicker;
    overlay.onclick = function (e) {
      if (e.target === overlay) window._closeGrpPicker();
    };

    window._renderGrpPickerList();
    setTimeout(() => inp.focus(), 25);
  };

  // Intercept showModal if any other script calls showModal("Change Group (G)", ...)
  setInterval(function () {
    if (typeof window.showModal === "function" && !window.showModal._cleanGrpHooked) {
      const orig = window.showModal;
      window.showModal = function (title) {
        if (title && /Change Group/i.test(String(title))) {
          window._openGroupPickerModal();
          return;
        }
        return orig.apply(this, arguments);
      };
      window.showModal._cleanGrpHooked = true;
    }
  }, 300);

  // Inject or Re-bind "🔄 Change Group (G)" button
  setInterval(function () {
    if (isGroupPickerOpen() || !isGroupSummaryScreen()) return;
    const bodyEl = document.getElementById("screenBody");
    if (!bodyEl) return;

    const existingBtns = Array.from(bodyEl.querySelectorAll("button")).filter(b => /Change Group/i.test(b.textContent || ""));
    if (existingBtns.length > 0) {
      existingBtns.forEach(b => {
        b.onclick = function (e) {
          e.preventDefault();
          e.stopPropagation();
          window._openGroupPickerModal();
        };
      });
      return;
    }

    const topBar = bodyEl.querySelector("div[style*='display:flex']") || bodyEl.querySelector(".form-card");
    if (!topBar) return;

    const btn = document.createElement("button");
    btn.id = "aeGroupChangeBtn";
    btn.className = "btn btn-sec";
    btn.style.cssText = "padding:3px 9px; font-size:11.5px; margin-left:6px;";
    btn.innerHTML = "🔄 Change Group (G)";
    btn.onclick = function (e) {
      e.preventDefault();
      e.stopPropagation();
      window._openGroupPickerModal();
    };
    topBar.appendChild(btn);
  }, 500);

  // ==========================================================================
  // 2. TABLE ROW NAVIGATION (LEDGER VOUCHERS, GROUP SUMMARY, DAY BOOK)
  // ==========================================================================
  function handleTableArrowNavigation(e) {
    const bodyEl = document.getElementById("screenBody");
    if (!bodyEl) return false;

    const allRows = Array.from(bodyEl.querySelectorAll("table tbody tr, table tr"));
    const rows = allRows.filter(tr => tr.querySelector("td") && tr.textContent.trim().length > 0);
    if (rows.length === 0) return false;

    let activeIdx = rows.findIndex(tr => tr.getAttribute("data-kb-row") === "1");

    if (e.key === "ArrowDown") {
      activeIdx = activeIdx >= rows.length - 1 ? 0 : activeIdx + 1;
    } else if (e.key === "ArrowUp
