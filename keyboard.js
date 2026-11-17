// ============================================================================
// ACCOUNTSEXPERSE GST v2.0 — COMPLETE KEYBOARD & NAVIGATION ENGINE
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

  function isVisible(el) {
    if (!el) return false;
    const style = window.getComputedStyle(el);
    return style.display !== "none" && style.visibility !== "hidden" && el.offsetParent !== null;
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
    const bodyEl = document.getElementById("screenBody");
    const titleEl = document.querySelector("#screenTitle, .screen-title, .screen-bar");
    const titleTxt = titleEl ? titleEl.textContent : "";
    const bodyTxt = bodyEl ? bodyEl.textContent : "";
    return /Group Summary/i.test(titleTxt) || (/Select Group/i.test(bodyTxt) && !!(bodyEl && bodyEl.querySelector("select")));
  }

  // ==========================================================================
  // 1. STANDALONE "CHANGE GROUP (G)" PICKER MODAL
  // ==========================================================================
  let grpPickerState = {
    options: [],
    filtered: [],
    selIdx: 0,
    selectEl: null
  };

  window._closeGrpPicker = function () {
    const old = document.getElementById("customGrpPickerOverlay");
    if (old) old.remove();
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
    window._closeGrpPicker();
    if (!item || !selectEl) return;

    selectEl.value = item.val;
    selectEl.dispatchEvent(new Event("change", { bubbles: true }));

    if (document.activeElement && typeof document.activeElement.blur === "function") {
      document.activeElement.blur();
    }
  };

  window._openGroupPickerModal = function () {
    if (typeof window.closeModal === "function") window.closeModal();
    const stdModal = document.getElementById("modalOverlay");
    if (stdModal) {
      stdModal.classList.remove("show");
      stdModal.style.display = "none";
    }

    const bodyEl = document.getElementById("screenBody");
    if (!bodyEl) return;
    const grpSelect = bodyEl.querySelector("select");
    if (!grpSelect) return;

    window._closeGrpPicker();

    const options = Array.from(grpSelect.options).map(o => ({
      val: o.value,
      text: o.textContent.trim()
    }));

    grpPickerState.options = options;
    grpPickerState.filtered = options.slice();
    grpPickerState.selIdx = Math.max(0, options.findIndex(o => o.val === grpSelect.value));
    grpPickerState.selectEl = grpSelect;

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

    if (!isGroupSummaryScreen()) return;
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
  }, 450);

  // ==========================================================================
  // 2. ENTER KEY INSIDE ANY FORM / LOGIN / MODAL / VOUCHER
  // ==========================================================================
  function handleEnterInsideInput(e, active) {
    // Find current scope (Login card, Modal, or Main Screen Body)
    const scope =
      active.closest("#modalOverlay") ||
      active.closest("#loginOverlay, .login-card, .login-box, form") ||
      active.closest("#screenBody") ||
      document.body;

    // Focusable inputs & selects inside this scope
    const fields = Array.from(
      scope.querySelectorAll("input:not([type='hidden']):not([type='checkbox']):not([type='radio']):not([disabled]), select:not([disabled])")
    ).filter(isVisible);

    const idx = fields.indexOf(active);
    if (idx >= 0 && idx < fields.length - 1) {
      e.preventDefault();
      e.stopPropagation();
      fields[idx + 1].focus();
      if (typeof fields[idx + 1].select === "function") fields[idx + 1].select();
      return true;
    }

    // Agar aakhiri input par Enter dabaya hai (jaise Login Password ya Modal ka last field), toh Primary Button click karein
    if (idx === fields.length - 1) {
      const submitBtn = scope.querySelector(
        "button[type='submit'], button.btn-pri, button[onclick*='login'], button[onclick*='Login'], button[onclick*='signIn'], button[onclick*='save'], button"
      );
      if (submitBtn && isVisible(submitBtn)) {
        e.preventDefault();
        e.stopPropagation();
        submitBtn.click();
        return true;
      }
    }
    return false;
  }

  // ==========================================================================
  // 3. TABLE & GATEWAY MENU NAVIGATION (↑ ↓ + ENTER)
  // ==========================================================================
  function handleTableArrowNavigation(e) {
    const bodyEl = document.getElementById("screenBody");
    if (!bodyEl || !isVisible(bodyEl)) return false;

    // A) Gateway Menu Items
    const menuItems = Array.from(bodyEl.querySelectorAll(".gw-item, .menu-item, [data-gw-item]")).filter(isVisible);
    if (menuItems.length > 0) {
      let idx = menuItems.findIndex(el => el.classList.contains("active") || el.getAttribute("data-kb-active") === "1");
      if (e.key === "ArrowDown") {
        idx = idx >= menuItems.length - 1 ? 0 : idx + 1;
      } else if (e.key === "ArrowUp") {
        idx = idx <= 0 ? menuItems.length - 1 : idx - 1;
      } else if (e.key === "Enter") {
        if (idx >= 0 && menuItems[idx]) {
          menuItems[idx].click();
          return true;
        }
        return false;
      }
      menuItems.forEach(el => {
        el.classList.remove("active");
        el.removeAttribute("data-kb-active");
        el.style.removeProperty("background-color");
      });
      if (idx >= 0 && menuItems[idx]) {
        menuItems[idx].classList.add("active");
        menuItems[idx].setAttribute("data-kb-active", "1");
        menuItems[idx].style.setProperty("background-color", "#fef08a", "important");
        menuItems[idx].scrollIntoView({ block: "nearest" });
      }
      return true;
    }

    // B) Data Table Rows (Ledger Vouchers, Group Summary, Day Book, Trial Balance)
    const allRows = Array.from(bodyEl.querySelectorAll("table tbody tr, table tr"));
    const rows = allRows.filter(tr => tr.querySelector("td") && tr.textContent.trim().length > 0 && isVisible(tr));
    if (rows.length === 0) return false;

    let activeIdx = rows.findIndex(tr => tr.getAttribute("data-kb-row") === "1");

    if (e.key === "ArrowDown") {
      activeIdx = activeIdx >= rows.length - 1 ? 0 : activeIdx + 1;
    } else if (e.key === "ArrowUp") {
      activeIdx = activeIdx <= 0 ? rows.length - 1 : activeIdx - 1;
    } else if (e.key === "Enter") {
      if (activeIdx >= 0 && rows[activeIdx]) {
        const row = rows[activeIdx];
        const clickable = row.hasAttribute("onclick")
          ? row
          : row.querySelector("[onclick], a, button") || row;
        clickable.click();
        return true;
      }
      return false;
    }

    rows.forEach(tr => {
      tr.removeAttribute("data-kb-row");
      tr.style.removeProperty("background-color");
    });

    if (activeIdx >= 0 && rows[activeIdx]) {
      rows[activeIdx].setAttribute("data-kb-row", "1");
      rows[activeIdx].style.setProperty("background-color", "#fef08a", "important");
      rows[activeIdx].scrollIntoView({ block: "nearest" });
    }
    return true;
  }

  // ==========================================================================
  // 4. RIGHT SIDEBAR & TALLY SHORTCUT TRIGGER HELPER
  // ==========================================================================
  function clickSidebarShortcut(labelRegex) {
    const btns = Array.from(document.querySelectorAll("button, .f-btn, .side-btn, [onclick]"));
    const match = btns.find(b => isVisible(b) && labelRegex.test((b.textContent || "").trim()));
    if (match) {
      match.click();
      return true;
    }
    return false;
  }

  // ==========================================================================
  // 5. MASTER KEYDOWN CONTROLLER
  // ==========================================================================
  window.addEventListener("keydown", function (e) {
    // ------------------------------------------------------------------------
    // PRIORITY 1: STANDALONE "CHANGE GROUP (G)" POPUP IS OPEN
    // ------------------------------------------------------------------------
    if (isGroupPickerOpen()) {
      const inp = document.getElementById("gGrpSearch");
      const len = grpPickerState.filtered.length;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        if (len > 0) {
          grpPickerState.selIdx = Math.min(len - 1, grpPickerState.selIdx + 1);
          window._renderGrpPickerList();
        }
        if (inp) inp.focus();
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        if (len > 0) {
          grpPickerState.selIdx = Math.max(0, grpPickerState.selIdx - 1);
          window._renderGrpPickerList();
        }
        if (inp) inp.focus();
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        window._pickGroupFromModal(grpPickerState.selIdx);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        window._closeGrpPicker();
        return;
      }
      if (e.key === "Tab") {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        if (inp) inp.focus();
        return;
      }
      e.stopPropagation();
      return;
    }

    const active = document.activeElement;
    const tag = active && active.tagName ? active.tagName.toUpperCase() : "";
    const isTypingInput =
      (tag === "INPUT" && active.type !== "checkbox" && active.type !== "radio" && active.type !== "button") ||
      tag === "TEXTAREA" ||
      tag === "SELECT" ||
      (active && active.isContentEditable);

    // ------------------------------------------------------------------------
    // PRIORITY 2: STANDARD MODAL (#modalOverlay) IS OPEN
    // ------------------------------------------------------------------------
    if (isStandardModalOpen()) {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        if (typeof window.closeModal === "function") window.closeModal();
        return;
      }
      // Enter key inside modal inputs (e.g. F3 Company Modal, F2 Date Modal)
      if (e.key === "Enter" && isTypingInput && tag !== "TEXTAREA") {
        // Agar modal ke andar koi searchable list (jaise F4 Change Ledger) hai toh uska apna Enter chalne dein
        const modalEl = document.getElementById("modalOverlay");
        const hasPickerList = modalEl && modalEl.querySelector("[data-idx], .g-grp-item, .ledger-item");
        if (!hasPickerList) {
          handleEnterInsideInput(e, active);
        }
      }
      return;
    }

    // ------------------------------------------------------------------------
    // PRIORITY 3: WHEN TYPING INSIDE ANY INPUT (LOGIN SCREEN, VOUCHER FORM, ETC.)
    // ------------------------------------------------------------------------
    if (isTypingInput) {
      if (e.key === "Enter" && tag !== "TEXTAREA") {
        handleEnterInsideInput(e, active);
        return;
      }
      if (e.key === "Escape") {
        active.blur();
        return;
      }
      // Ctrl+A to Save while inside Voucher input
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "a") {
        const saveBtn = document.querySelector("#screenBody button.btn-pri, #screenBody [onclick*='save']");
        if (saveBtn) {
          e.preventDefault();
          saveBtn.click();
        }
      }
      // Alt+C for On-Spot Ledger Creation while inside Voucher input
      if (e.altKey && e.key.toLowerCase() === "c") {
        e.preventDefault();
        if (typeof window.openOnSpotLedgerModal === "function") window.openOnSpotLedgerModal();
      }
      return;
    }

    // ------------------------------------------------------------------------
    // PRIORITY 4: GLOBAL SHORTCUTS (WHEN NOT TYPING IN AN INPUT)
    // ------------------------------------------------------------------------
    // Ctrl+A -> Save
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "a") {
      const saveBtn = document.querySelector("#screenBody button.btn-pri, #screenBody [onclick*='save']");
      if (saveBtn) {
        e.preventDefault();
        saveBtn.click();
        return;
      }
    }

    // Alt + Key Shortcuts (Alt+P Print, Alt+D Day Book, Alt+L Ledger, Alt+U Grp Sum, Alt+C, etc.)
    if (e.altKey && !e.ctrlKey && !e.metaKey) {
      const k = e.key.toLowerCase();
      if (k === "p") {
        e.preventDefault();
        if (typeof window.printCurrentScreen === "function") window.printCurrentScreen();
        else window.print();
        return;
      }
      if (k === "d") { e.preventDefault(); clickSidebarShortcut(/Alt\+D|Day Book/i); return; }
      if (k === "l") { e.preventDefault(); clickSidebarShortcut(/Alt\+L|Ledger/i); return; }
      if (k === "u") { e.preventDefault(); clickSidebarShortcut(/Alt\+U|Grp Sum/i); return; }
      if (k === "r") { e.preventDefault(); clickSidebarShortcut(/Alt\+R|Recon/i); return; }
      if (k === "o") { e.preventDefault(); clickSidebarShortcut(/Alt\+O|Outstdg/i); return; }
      if (e.key === "F2") { e.preventDefault(); clickSidebarShortcut(/A\+F2|Period/i); return; }
    }

    // Function Keys (F2, F3, F4)
    if (e.key === "F2") {
      e.preventDefault();
      clickSidebarShortcut(/^F2\b|Date/i);
      return;
    }
    if (e.key === "F3") {
      e.preventDefault();
      clickSidebarShortcut(/F3|Company/i);
      return;
    }
    if (e.key === "F4") {
      const chgLedgerBtn = Array.from(document.querySelectorAll("#screenBody button")).find(b => /Change Ledger|F4/i.test(b.textContent || ""));
      if (chgLedgerBtn) {
        e.preventDefault();
        chgLedgerBtn.click();
        return;
      }
    }

    // Escape -> Back / Gateway
    if (e.key === "Escape") {
      e.preventDefault();
      const backBtn = Array.from(document.querySelectorAll("#screenBody button")).find(b => /Back|Esc/i.test(b.textContent || ""));
      if (backBtn) {
        backBtn.click();
      } else {
        clickSidebarShortcut(/Esc\s+Gateway/i);
      }
      return;
    }

    // 'G' Key on Group Summary Screen
    if (e.key.toLowerCase() === "g" && !e.altKey && !e.ctrlKey && !e.metaKey) {
      if (isGroupSummaryScreen()) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        window._openGroupPickerModal();
        return;
      }
    }

    // Single-Letter Voucher Shortcuts (C, Y, R, J, S, P, K, D) when not in input
    if (!e.altKey && !e.ctrlKey && !e.metaKey && e.key.length === 1) {
      const k = e.key.toUpperCase();
      const map = {
        C: /^C\s+Contra/i,
        Y: /^Y\s+Payment/i,
        R: /^R\s+Receipt/i,
        J: /^J\s+Journal/i,
        S: /^S\s+Sales/i,
        P: /^P\s+Purchase/i,
        K: /^K\s+Cr Note/i,
        D: /^D\s+Dr Note/i
      };
      if (map[k] && clickSidebarShortcut(map[k])) {
        e.preventDefault();
        return;
      }
    }

    // ------------------------------------------------------------------------
    // PRIORITY 5: ARROW UP / DOWN & ENTER ON TABLES / MENUS
    // ------------------------------------------------------------------------
    if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter") {
      const handled = handleTableArrowNavigation(e);
      if (handled) {
        e.preventDefault();
        e.stopPropagation();
      }
    }
  }, true);
})();
