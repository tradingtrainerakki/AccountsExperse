// ============================================================================
// demodata.js  —  NAMUNA (DEMO) COMPANY  : jaanch ke liye taiyaar data
//
//   Ek naya, alag company banata hai ("DEMO — Shree Cement & Hardware") jisme
//   cement dukan + chhote kaarkhane (SSI) jaisa asli-sa data apne aap bharta hai:
//     * Party (registered / unregistered / dusre rajya), Item (HSN, unit, GST category), Stock Group (ITC type)
//     * Sales (B2B intra/inter, B2CS, B2CL > 1 lakh, nil-rated), Credit Note, Purchase, Debit Note
//     * Kharche (freight, repairs) accounting-mode me GST ke saath, Receipt/Payment, GST set-off Journal
//     * Ek cancelled voucher, aur "jaanbujhkar galat" 2 voucher (Pre-check dikhane ke liye)
//   Aapka asli (Trust) data NAHI chhua jaata. Jaanch ke baad F3 se is demo company ko hata sakte hain.
//
//   Apna hisaab alag se bhi nikalta hai (sidhe jod kar) taaki aap screen ke aankdon se milaa sakein.
//
// Load order: index.html me sabse LAST (gst3b.js ke baad).
// ============================================================================
(function () {
  "use strict";

  const r2 = (x) => +(+x || 0).toFixed(2);

  function buildDemo() {
    // ---------- company ----------
    DB.company = {
      name: "DEMO — Shree Cement & Hardware (Namuna)", entityType: "Company", gstin: "05AAACD1234E1Z5", stateCode: "05",
      address: "Haridwar Road", address2: "Near Bus Stand", city: "Roorkee", pincode: "247667", phone: "9876543210", email: "demo@example.com",
      pan: "AAACD1234E", regType: "Regular", regNo: "", fyFrom: "2026-04-01", fyTo: "2027-03-31",
      curDate: new Date().toISOString().slice(0, 10), isDemo: true,
      banks: [{ id: "B_DEMO", bankName: "State Bank of India", accNo: "12345678901", ifsc: "SBIN0001234", address: "Roorkee Main", isDefault: true }]
    };
    seedDefaultMasters();

    // ---------- stock group ITC types (Tally jaisa) ----------
    ensureStockGroupsInitialized();
    const sgAdd = (id, name, itc, gstCat, hsn) => {
      if (!DB.stockGroups.some(g => g.id === id)) DB.stockGroups.push({ id, name, parent: "Primary", gstCategory: gstCat || "Taxable", itcCategory: itc, defaultHsn: hsn || "", defaultGst: 18, custom: true });
    };
    sgAdd("SG_TRADE", "Trading Goods (Cement/Steel)", "Inputs", "Taxable", "2523");
    sgAdd("SG_VEH", "Vehicles (Blocked Credit)", "Ineligible", "Taxable", "8703");
    sgAdd("SG_NIL", "Nil Rated Goods", "Inputs", "Nil Rated", "1001");

    // ---------- ledgers ----------
    const sc = "05";
    const L = (id, name, group, extra) => DB.ledgers.push(Object.assign({ id, name, group, opBal: 0, opType: "Dr", stateCode: sc }, extra || {}));
    // purane default party hata do, apne daalte hain
    DB.ledgers = DB.ledgers.filter(l => !["L_PARTY_LOCAL", "L_PARTY_INTER"].includes(l.id));
    DB.ledgers.find(l => l.id === "L_CASH").opBal = 100000;
    DB.ledgers.find(l => l.id === "L_BANK").opBal = 500000;
    L("L_P_SHARMA", "Sharma Builders (Roorkee)", "Sundry Debtors", { gstin: "05AABCS1234A1Z5", regType: "Regular" });
    L("L_P_GUPTA", "Gupta Construction (Dehradun)", "Sundry Debtors", { gstin: "05AACCG5678B1Z3", regType: "Regular" });
    L("L_P_DELHI", "Delhi Infra Pvt Ltd (Delhi)", "Sundry Debtors", { gstin: "07AAACD9999C1Z1", stateCode: "07", regType: "Regular" });
    L("L_P_CASH", "Cash Customers (Local)", "Sundry Debtors", { gstin: "", regType: "Unregistered" });
    L("L_P_UP", "UP Road Contractor (Unregistered, Lucknow)", "Sundry Debtors", { gstin: "", stateCode: "09", regType: "Unregistered" });
    L("L_P_ULTRA", "Ultra Cement Depot (Haryana)", "Sundry Creditors", { opType: "Cr", gstin: "06AAACU1111D1Z8", stateCode: "06", regType: "Regular" });
    L("L_P_STEEL", "Bharat Steel Traders (Haridwar)", "Sundry Creditors", { opType: "Cr", gstin: "05AABCB2222E1Z6", regType: "Regular" });
    L("L_P_AUTO", "Prime Motors (Dehradun)", "Sundry Creditors", { opType: "Cr", gstin: "05AAACP3333F1Z4", regType: "Regular" });
    L("L_P_TRANSPORT", "Shiv Transport (GTA)", "Sundry Creditors", { opType: "Cr", gstin: "", regType: "Unregistered" });
    L("L_E_FREIGHT", "Freight Inward", "Direct Expenses", { gstApplicable: true });
    L("L_E_REPAIR", "Repairs & Maintenance", "Indirect Expenses", { gstApplicable: true });
    L("L_E_RENT", "Godown Rent", "Indirect Expenses", { gstApplicable: true });
    L("L_E_SALARY", "Salary & Wages", "Indirect Expenses");
    L("L_CAPITAL", "Proprietor's Capital", "Capital Account", { opType: "Cr", opBal: 600000 });

    // ---------- items ----------
    const I = (id, name, sg, cat, hsn, uom, rate, opQty, opRate) => DB.items.push({ id, name, stockGroup: sg, gstCategory: cat, itcCategory: "Inputs", hsn, uom, gstRate: cat === "Taxable" ? 18 : 0, rate, opQty, opRate, bom: [], bomStdBatch: 1 });
    I("I_CEM", "Cement PPC 50kg", "Trading Goods (Cement/Steel)", "Taxable", "2523", "BAG", 420, 500, 380);
    I("I_TMT", "TMT Bar 12mm", "Trading Goods (Cement/Steel)", "Taxable", "7214", "KG", 62, 8000, 55);
    I("I_PAINT", "Wall Putty 20kg", "Trading Goods (Cement/Steel)", "Taxable", "3214", "BAG", 780, 100, 650);
    I("I_WHEAT", "Wheat (Nil Rated)", "Nil Rated Goods", "Nil Rated", "1001", "KG", 28, 2000, 24);
    I("I_CAR", "Delivery Van", "Vehicles (Blocked Credit)", "Taxable", "8703", "NOS", 750000, 0, 0);

    // ---------- voucher banane ke madadgaar (app ki apni gananaon se) ----------
    const lineOf = (itemId, qty, rate) => { const it = DB.items.find(x => x.id === itemId); return { itemId, itemName: it.name, hsn: it.hsn, uom: it.uom, qty, rate: rate != null ? rate : it.rate, discPct: 0, gstRate: it.gstRate }; };
    const mkItem = (type, date, party, lines, opt) => {
      opt = opt || {};
      const salesLed = (type === "Sales" || type === "Credit Note") ? "L_SALES_GST" : "L_PURC_GST";
      const calc = calculateInvoiceGST(lines, party, true, "");
      const isOutward = (type === "Sales" || type === "Debit Note"), isSalesSide = (type === "Sales" || type === "Credit Note");
      const pT = isOutward ? "Dr" : "Cr", rT = isOutward ? "Cr" : "Dr";
      const en = [{ ledgerId: party, type: pT, amount: calc.netInvoice }, { ledgerId: salesLed, type: rT, amount: calc.totalTaxable }];
      if (calc.totalCGST > 0) en.push({ ledgerId: isSalesSide ? "L_CGST_OUT" : "L_CGST_IN", type: rT, amount: calc.totalCGST });
      if (calc.totalSGST > 0) en.push({ ledgerId: isSalesSide ? "L_SGST_OUT" : "L_SGST_IN", type: rT, amount: calc.totalSGST });
      if (calc.totalIGST > 0) en.push({ ledgerId: isSalesSide ? "L_IGST_OUT" : "L_IGST_IN", type: rT, amount: calc.totalIGST });
      if (calc.roundOff !== 0) en.push({ ledgerId: "L_ROUNDOFF", type: calc.roundOff > 0 ? rT : pT, amount: Math.abs(calc.roundOff) });
      const no = opt.no || nextVoucherNumber(type);
      const v = {
        id: uid("V"), vchNo: no, date, type, mode: "item", refNo: "", partyLedgerId: party, salesPurcLedgerId: salesLed, posState: calc.supply.posState, rcm: false,
        bill: { type: "New Ref", ref: no }, narration: opt.narr || `${type} — ${getLedgerName(party)}`, amount: calc.netInvoice,
        drLedgerId: en.find(x => x.type === "Dr").ledgerId, crLedgerId: en.find(x => x.type === "Cr").ledgerId, entries: en, itemLines: calc.lines,
        gst: { supplyType: calc.supply.supplyType, posState: calc.supply.posState, gstrCategory: calc.gstrCategory, taxable: calc.totalTaxable, cgst: calc.totalCGST, sgst: calc.totalSGST, igst: calc.totalIGST, roundOff: calc.roundOff, netInvoice: calc.netInvoice, hsnSummary: calc.hsnSummary }
      };
      if (opt.cancelled) { v.cancelled = true; v.cancelledAt = new Date().toISOString(); v.cancelReason = "Namuna: galat entry"; }
      DB.vouchers.push(v);
      return v;
    };
    const mkAcct = (type, date, entries, narr, opt) => {
      opt = opt || {};
      const no = opt.no || nextVoucherNumber(type);
      const dr = entries.filter(e => e.type === "Dr").reduce((a, e) => a + e.amount, 0);
      const v = { id: uid("V"), vchNo: no, date, type, mode: "acct", refNo: opt.ref || "", partyLedgerId: "", salesPurcLedgerId: "", posState: "", rcm: false,
        bill: { type: "", ref: no }, narration: narr, amount: r2(dr), drLedgerId: entries.find(e => e.type === "Dr").ledgerId, crLedgerId: entries.find(e => e.type === "Cr").ledgerId,
        entries: entries.map(e => Object.assign({}, e, { amount: r2(e.amount) })), itemLines: [], gst: null };
      DB.vouchers.push(v);
      return v;
    };

    // ================== SEPTEMBER 2026 ==================
    mkItem("Purchase", "2026-09-03", "L_P_ULTRA", [lineOf("I_CEM", 600, 385)], { narr: "Cement stock kharidi (Haryana — IGST)" });
    mkItem("Purchase", "2026-09-05", "L_P_STEEL", [lineOf("I_TMT", 5000, 56)], { narr: "TMT bar kharidi (local)" });
    mkItem("Sales", "2026-09-12", "L_P_SHARMA", [lineOf("I_CEM", 150, 425)], { narr: "Cement bikri — Sharma Builders" });
    mkItem("Sales", "2026-09-20", "L_P_CASH", [lineOf("I_CEM", 20, 430), lineOf("I_PAINT", 5, 790)], { narr: "Cash bikri" });

    // ================== OCTOBER 2026 ==================
    mkItem("Purchase", "2026-10-02", "L_P_ULTRA", [lineOf("I_CEM", 400, 386)]);
    mkItem("Sales", "2026-10-05", "L_P_SHARMA", [lineOf("I_CEM", 200, 425), lineOf("I_TMT", 1000, 66)]);
    mkItem("Sales", "2026-10-09", "L_P_GUPTA", [lineOf("I_CEM", 120, 428)]);
    mkItem("Sales", "2026-10-14", "L_P_DELHI", [lineOf("I_CEM", 250, 430)], { narr: "Antar-rajya bikri (IGST)" });
    mkAcct("Payment", "2026-10-16", [{ ledgerId: "L_E_FREIGHT", type: "Dr", amount: 8000 }, { ledgerId: "L_CGST_IN", type: "Dr", amount: 200 }, { ledgerId: "L_SGST_IN", type: "Dr", amount: 200 }, { ledgerId: "L_BANK", type: "Cr", amount: 8400 }], "Freight (forward charge, 5% GST) — accounting mode");

    // ================== NOVEMBER 2026 (jaanch ka mukhya mahina) ==================
    mkItem("Purchase", "2026-11-02", "L_P_ULTRA", [lineOf("I_CEM", 500, 388)], { narr: "Cement kharidi (IGST)" });                       // ITC eligible (IGST)
    mkItem("Purchase", "2026-11-04", "L_P_STEEL", [lineOf("I_TMT", 6000, 57), lineOf("I_PAINT", 40, 660)], { narr: "TMT + Putty kharidi (local)" });
    mkItem("Purchase", "2026-11-06", "L_P_AUTO", [lineOf("I_CAR", 1, 750000)], { narr: "Delivery van — ITC BLOCKED (stock group = Ineligible)" });
    mkItem("Sales", "2026-11-03", "L_P_SHARMA", [lineOf("I_CEM", 300, 425)], { narr: "B2B local (CGST+SGST)" });
    mkItem("Sales", "2026-11-05", "L_P_GUPTA", [lineOf("I_CEM", 180, 428), lineOf("I_TMT", 2000, 66)]);
    mkItem("Sales", "2026-11-07", "L_P_DELHI", [lineOf("I_CEM", 300, 430)], { narr: "B2B antar-rajya (IGST)" });
    mkItem("Sales", "2026-11-09", "L_P_CASH", [lineOf("I_CEM", 25, 432), lineOf("I_PAINT", 4, 795)], { narr: "B2CS — chhoti nakad bikri" });
    mkItem("Sales", "2026-11-11", "L_P_UP", [lineOf("I_CEM", 300, 430)], { narr: "B2CL — antar-rajya unregistered, Rs 1 lakh se upar" });
    mkItem("Sales", "2026-11-12", "L_P_CASH", [lineOf("I_WHEAT", 1500, 30)], { narr: "Nil-rated item ki bikri (3.1(c))" });
    mkItem("Sales", "2026-11-13", "L_P_SHARMA", [lineOf("I_CEM", 50, 425)], { narr: "GALAT ENTRY — cancel kiya", cancelled: true });
    mkItem("Credit Note", "2026-11-15", "L_P_SHARMA", [lineOf("I_CEM", 10, 425)], { narr: "Maal wapasi — Sharma Builders" });
    mkItem("Debit Note", "2026-11-17", "L_P_STEEL", [lineOf("I_TMT", 200, 57)], { narr: "Kharidi wapasi (Debit Note)" });
    mkAcct("Payment", "2026-11-10", [{ ledgerId: "L_E_REPAIR", type: "Dr", amount: 12000 }, { ledgerId: "L_CGST_IN", type: "Dr", amount: 1080 }, { ledgerId: "L_SGST_IN", type: "Dr", amount: 1080 }, { ledgerId: "L_BANK", type: "Cr", amount: 14160 }], "Godown repair (18% GST) — ACCOUNTING MODE, 3B me 'Bahi vs 3B' se pakda jayega");
    mkAcct("Payment", "2026-11-14", [{ ledgerId: "L_E_FREIGHT", type: "Dr", amount: 20000 }, { ledgerId: "L_P_TRANSPORT", type: "Cr", amount: 20000 }], "Transport freight (GTA, unregistered) — REVERSE CHARGE: 3B me ➕GST Adjustment → Reverse Charge se jodein (20000 par 5% = 500+500)");
    mkAcct("Receipt", "2026-11-20", [{ ledgerId: "L_BANK", type: "Dr", amount: 300000 }, { ledgerId: "L_P_SHARMA", type: "Cr", amount: 300000 }], "Sharma Builders se Bank me jama");
    mkAcct("Payment", "2026-11-22", [{ ledgerId: "L_E_SALARY", type: "Dr", amount: 45000 }, { ledgerId: "L_CASH", type: "Cr", amount: 45000 }], "Salary (GST nahi)");

    // ---------- 2 jaanbujhkar galat voucher (Pre-check dikhane ke liye) ----------
    DB.ledgers.push({ id: "L_P_BADGST", name: "Bad GSTIN Party (TEST)", group: "Sundry Debtors", opBal: 0, opType: "Dr", gstin: "07BADGSTIN", stateCode: "07", regType: "Regular" });
    DB.ledgers.push({ id: "L_P_NOGST", name: "Registered No-GSTIN Party (TEST)", group: "Sundry Debtors", opBal: 0, opType: "Dr", gstin: "", stateCode: "05", regType: "Regular" });
    mkItem("Sales", "2026-11-18", "L_P_BADGST", [lineOf("I_CEM", 10, 430)], { narr: "TEST-GALAT: party ka GSTIN galat" });
    const noHsn = mkItem("Sales", "2026-11-19", "L_P_NOGST", [lineOf("I_CEM", 10, 430)], { narr: "TEST-GALAT: Registered party par GSTIN khali + HSN khali" });
    noHsn.itemLines.forEach(l => { l.hsn = ""; });

    DB.userRoles = DB.userRoles || [];
    DB.company.curDate = "2026-11-24";
  }

  // --------------------------------------------------------------- apne aap hisaab (sidhe jod kar)
  function expectedSummary() {
    const live = DB.vouchers.filter(v => !v.cancelled && v.gst && (v.date || "").startsWith("2026-11"));
    const sum = (types, k, sign) => r2(live.filter(v => types.includes(v.type)).reduce((a, v) => a + (sign && (v.type === "Credit Note" || v.type === "Debit Note") ? -1 : 1) * (v.gst[k] || 0), 0));
    const out = (k) => r2(sum(["Sales"], k) - sum(["Credit Note"], k));
    const inn = (k) => r2(sum(["Purchase"], k) - sum(["Debit Note"], k));
    const car = DB.vouchers.find(v => /ITC BLOCKED/.test(v.narration || ""));
    return {
      outTaxable: out("taxable"), outCgst: out("cgst"), outSgst: out("sgst"), outIgst: out("igst"),
      inCgst: inn("cgst"), inSgst: inn("sgst"), inIgst: inn("igst"),
      carCgst: car ? car.gst.cgst : 0, carSgst: car ? car.gst.sgst : 0,
      b2cl: live.filter(v => v.type === "Sales" && v.gst.supplyType === "INTER" && !(DB.ledgers.find(l => l.id === v.partyLedgerId) || {}).gstin && v.gst.netInvoice > 100000).length
    };
  }

  // --------------------------------------------------------------- entity banana
  function createDemoEntity() {
    if (typeof isSuperAdmin === "function" && !isSuperAdmin()) { toast("🚫 Sirf Master Admin demo company bana sakta hai"); return; }
    persistCurrentEntitySilently();
    const newId = "ENT_DEMO_" + Date.now().toString(36);
    CURRENT_ENTITY_ID = newId;
    DB = {
      company: {}, groups: [...DEFAULT_GROUPS], stockGroups: JSON.parse(JSON.stringify(DEFAULT_STOCK_GROUPS)),
      ledgers: [], items: [], vouchers: [], userRoles: []
    };
    buildDemo();
    saveDB();
    localStorage.setItem("TALLY_PRIME_LAST_ENTITY", newId);
    const E = expectedSummary();
    try { syncUserRolesStorage(); } catch (e) { /* ignore */ }
    try { navigate("gateway", false); } catch (e) { /* ignore */ }
    showModal("🧪 Demo Company Taiyaar!",
      `<div style="font-size:13px;line-height:1.7;">
        <b>${escHtml(DB.company.name)}</b> ban gayi (${DB.vouchers.length} voucher). Aapka asli data nahi chhua gaya.
        <div style="margin:10px 0 6px;font-weight:800;color:var(--pri-dark);">✅ Ab aap ye jaanch sakte hain (November 2026 chuniye):</div>
        <ol style="margin:0 0 8px 18px;">
          <li><b>GSTR-1:</b> B2B, B2CL (${E.b2cl} bill, Rs 1 lakh se upar), B2CS, Credit Note, HSN. Pre-check me <b>2 jaanbujhkar galtiyan</b> (galat GSTIN, HSN khali) dikhni chahiye.</li>
          <li><b>GSTR-3B:</b> Output tax aur ITC; <b>Delivery Van</b> ka ITC (Rs ${E.carCgst + E.carSgst}) "Ineligible" 4(D) me; nil-rated gehun 3.1(c) me.</li>
          <li><b>Bahi vs 3B milaan:</b> Repair (Payment) ka GST pakda jana chahiye → "ITC 3B me jodein".</li>
          <li><b>Reverse Charge:</b> Transport freight (Rs 20,000) ko ➕GST Adjustment → Reverse Charge se jodein (5% = 500 + 500).</li>
          <li>Ek <b>cancelled</b> voucher, Credit/Debit Note, Day Book, Ledger, Group Summary aur Print/QR bhi dekh sakte hain.</li></ol>
        <div style="background:#f1f5f9;border-radius:4px;padding:8px 10px;font-size:12.5px;">
          <b>Apne aap jod kar nikale gaye aankde (Nov 2026, saare chalu voucher; cancelled nahi) — 3B screen se milaayein:</b><br>
          Bikri taxable: ₹${E.outTaxable} | Output CGST ₹${E.outCgst} | SGST ₹${E.outSgst} | IGST ₹${E.outIgst}<br>
          Kharidi tax (Input) CGST ₹${E.inCgst} | SGST ₹${E.inSgst} | IGST ₹${E.inIgst} (Van ka ₹${E.carCgst + E.carSgst} isme shamil hai, 3B me Ineligible me jayega)
        </div>
        <div style="margin-top:8px;color:#92400e;font-size:12px;">ℹ Ye demo company cloud me bhi sync hoti hai, isliye baaki users ko bhi F3 list me dikhegi. Jaanch ke baad F3 → company → Delete se hata dein.</div>
      </div>`,
      `<button class="btn" onclick="closeModal()">OK</button>`);
  }

  window.openDemoCompanyAsk = function () {
    if (typeof isSuperAdmin === "function" && !isSuperAdmin()) { toast("🚫 Sirf Master Admin demo company bana sakta hai"); return; }
    showModal("🧪 Demo Company Banayein?",
      `<div id="demoAskBox" style="font-size:13px;line-height:1.6;">
        Ek <b>nayi, alag</b> company ban jayegi jisme cement dukan / chhote kaarkhane jaisa namuna data hoga (jaanch ke liye).
        <ul style="margin:8px 0 8px 18px;font-size:12px;color:#475569;">
          <li>Aapka Trust ya koi asli data <b>nahi badlega</b>.</li>
          <li>Jaanch ke baad F3 se is company ko hata sakte hain.</li>
          <li>Cloud sync chalu hai to ye company baaki users ko bhi dikhegi.</li></ul></div>`,
      `<button class="btn btn-sec" onclick="closeModal()">No (N / Esc)</button><button class="btn" onclick="window.openDemoCompanyDo()">Yes, Banayein</button>`);
  };
  window.openDemoCompanyDo = function () { closeModal(); createDemoEntity(); };

  // right bar me button
  (function addButton() {
    const bar = document.querySelector(".right-bar");
    if (!bar || document.getElementById("fnDemoCo")) return;
    const b = document.createElement("button");
    b.id = "fnDemoCo"; b.className = "fn-btn";
    b.onclick = () => window.openDemoCompanyAsk();
    b.innerHTML = '<span class="fn-key">Demo</span><span>🧪 Demo Company</span>';
    const anchor = Array.from(bar.querySelectorAll("button")).find(x => /Restore/.test(x.textContent));
    if (anchor) anchor.insertAdjacentElement("afterend", b); else bar.appendChild(b);
  })();

  window.__demodata = { buildDemo, expectedSummary };
})();
