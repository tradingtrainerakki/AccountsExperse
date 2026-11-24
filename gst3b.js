// ============================================================================
// gst3b.js  —  GSTR-3B (Tally jaisa poora roop) + GST ADJUSTMENT (Tally ke "GST adjustment journal" jaisa)
//
//   Portal ke 3B ki tarah tables:
//     3.1  Outward supplies  (a) Taxable (b) Zero-rated (c) Nil/Exempt (d) Reverse charge (e) Non-GST
//     3.2  Antar-rajya supplies (Unregistered / Composition) — rajya ke hisaab se
//     4    ITC: (A) Available  (B) Reversed  (C) Net ITC  (D) Ineligible
//     5    Inward nil/exempt/non-GST
//     6.1  Tax payable | ITC se bhara | Cash me bharna | Byaaj | Late fee   (rule 88A ke order me)
//
//   Data kaha se aata hai (Tally ki tarah):
//     * Item ki "GST Category"  (Taxable / Nil Rated / Exempt)  -> 3.1(c) aur Table 5
//     * Stock Group ka "ITC Type" (Inputs / Capital Goods / Input Services / Ineligible) -> 4(A)(5) ya 4(D)
//     * "GST Adjustment" (neeche) -> pichhla bacha ITC, Reverse Charge, ITC reversal, Zero-rated,
//       Non-GST, Byaaj, Late fee
//
// Load order: index.html me gstexport.js ke BAAD (sabse last).
// ============================================================================
(function () {
  "use strict";

  const e = (s) => escHtml(s);
  const r2 = (x) => +(+x || 0).toFixed(2);
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const HEADS = ["i", "c", "s", "k"];                        // IGST, CGST, SGST, Cess
  const HEAD_NAME = { i: "IGST", c: "CGST", s: "SGST", k: "Cess" };
  const zero4 = () => ({ i: 0, c: 0, s: 0, k: 0 });
  const sum4 = (a, b, sg = 1) => { HEADS.forEach(h => { a[h] += sg * (b[h] || 0); }); return a; };

  // --------------------------------------------------------------- GST Adjustment ke prakar
  const NATURES = [
    { id: "opening", label: "Opening ITC Balance (Carry-forward)", hint: "Pichhle mahine / saal se bacha hua ITC — credit ledger ka balance.", fields: "tax" },
    { id: "rcm", label: "Reverse Charge — Liability & ITC", hint: "Jin kharidari par tax aapko khud bharna hai (jaise GTA / transport freight). Tax cash me bharna padta hai, ITC baad me milta hai.", fields: "rcm" },
    { id: "rev_rules", label: "ITC Reversal — Rule 38, 42, 43 & Sec 17(5)", hint: "Table 4(B)(1): niyam ke hisaab se ITC wapas.", fields: "tax" },
    { id: "rev_other", label: "ITC Reversal — Others", hint: "Table 4(B)(2): baaki ITC wapas.", fields: "tax" },
    { id: "inelig_1705", label: "Ineligible ITC — Sec 17(5) (Blocked)", hint: "Table 4(D)(1): purchase me jo ITC mil nahi sakta (4(A)(5) se ghataya jayega).", fields: "tax" },
    { id: "zero", label: "Outward — Zero Rated (Export / SEZ)", hint: "Table 3.1(b): export / SEZ supply ki value (aur IGST, agar bhara ho).", fields: "taxval" },
    { id: "nongst", label: "Outward — Non-GST Supply", hint: "Table 3.1(e): GST ke baahar ki supply ki value.", fields: "val" },
    { id: "interest", label: "Interest on Late Payment", hint: "Table 5.1: der se bharne par byaaj (cash me).", fields: "tax" },
    { id: "latefee", label: "Late Fee", hint: "Table 5.1: late fee (cash me).", fields: "tax" },
    { id: "itc_other", label: "Other Increase of ITC", hint: "Table 4(A)(5) me jodna hai aisa koi aur ITC.", fields: "tax" }
  ];
  const natureOf = (id) => NATURES.find(n => n.id === id);

  // --------------------------------------------------------------- mahina
  function monthList() {
    let from, to;
    try { const p = getTempPeriod(); from = p.from; to = p.to; } catch (err) { from = DB.company.fyFrom; to = DB.company.fyTo; }
    const out = [];
    let y = +from.slice(0, 4), m = +from.slice(5, 7);
    const ey = +to.slice(0, 4), em = +to.slice(5, 7);
    while (y < ey || (y === ey && m <= em)) { out.push(`${y}-${String(m).padStart(2, "0")}`); m++; if (m > 12) { m = 1; y++; } }
    return out;
  }
  const monthLabel = (ym) => `${MONTHS[+ym.slice(5, 7) - 1]} ${ym.slice(0, 4)}`;
  const fpOf = (ym) => ym.slice(5, 7) + ym.slice(0, 4);
  window.__gstMonth = window.__gstMonth || "";
  function currentMonth() {
    const list = monthList();
    if (window.__gstMonth && list.includes(window.__gstMonth)) return window.__gstMonth;
    const cur = (DB.company.curDate || "").slice(0, 7);
    window.__gstMonth = list.includes(cur) ? cur : (list[0] || "");
    return window.__gstMonth;
  }

  // --------------------------------------------------------------- item / stock group
  function itemOf(id) { try { return typeof getItem === "function" ? getItem(id) : (DB.items || []).find(x => x.id === id); } catch (err) { return null; } }
  function itcTypeOf(item) {
    if (!item) return "Inputs";
    const sg = (DB.stockGroups || []).find(g => g.id === item.stockGroup || g.name === item.stockGroup);
    return (sg && sg.itcCategory) || item.itcCategory || "Inputs";
  }
  const isNilExempt = (item, line) => !!item && !!item.gstCategory && item.gstCategory !== "Taxable" && (Number(line.gstRate) || 0) === 0;

  // --------------------------------------------------------------- 3B ki ganana
  function compute3B(ym) {
    const T = {
      ym,
      s31: { a: { txval: 0, ...zero4() }, b: { txval: 0, ...zero4() }, c: { txval: 0 }, d: { txval: 0, ...zero4() }, e: { txval: 0 } },
      unreg: new Map(), comp: new Map(),
      itcA: { a1: zero4(), a2: zero4(), a3: zero4(), a4: zero4(), a5: zero4() },
      itcB: { b1: zero4(), b2: zero4() }, inelig: { d1: zero4(), d2: zero4() },
      inward: { interNil: 0, intraNil: 0, interNon: 0, intraNon: 0 },
      opening: zero4(), interest: zero4(), latefee: zero4(), notes: [], counts: { sales: 0, purchases: 0, adj: 0 },
      nilBreak: { nil: 0, exempt: 0 }
    };
    const vs = (DB.vouchers || []).filter(v => (v.date || "").slice(0, 7) === ym && !v.cancelled && v.gst && Array.isArray(v.itemLines));

    vs.forEach(v => {
      const led = (typeof getLedger === "function" ? getLedger(v.partyLedgerId) : null) || {};
      const inter = v.gst.supplyType === "INTER";
      const unregParty = !String(led.gstin || "").trim();
      const isOut = v.type === "Sales" || v.type === "Credit Note";
      const isIn = v.type === "Purchase" || v.type === "Debit Note";
      if (!isOut && !isIn) return;
      const sg = (v.type === "Credit Note" || v.type === "Debit Note") ? -1 : 1;
      if (isOut) T.counts.sales++; else T.counts.purchases++;

      v.itemLines.forEach(l => {
        const item = itemOf(l.itemId);
        const tx = Number(l.taxable) || 0;
        const tax = { i: Number(l.igstAmt) || 0, c: Number(l.cgstAmt) || 0, s: Number(l.sgstAmt) || 0, k: 0 };
        if (isOut) {
          if (isNilExempt(item, l)) {
            T.s31.c.txval += sg * tx;
            T.nilBreak[item.gstCategory === "Exempt" ? "exempt" : "nil"] += sg * tx;
          } else {
            T.s31.a.txval += sg * tx; sum4(T.s31.a, tax, sg);
            if (inter && unregParty && !/composition/i.test(led.regType || "")) {
              const pos = v.gst.posState || led.stateCode || "";
              const o = T.unreg.get(pos) || { txval: 0, i: 0 };
              o.txval += sg * tx; o.i += sg * tax.i; T.unreg.set(pos, o);
            } else if (inter && /composition/i.test(led.regType || "")) {
              const pos = v.gst.posState || led.stateCode || "";
              const o = T.comp.get(pos) || { txval: 0, i: 0 };
              o.txval += sg * tx; o.i += sg * tax.i; T.comp.set(pos, o);
            }
          }
        } else {
          if (isNilExempt(item, l)) { T.inward[inter ? "interNil" : "intraNil"] += sg * tx; }
          else if (itcTypeOf(item) === "Ineligible") sum4(T.inelig.d2, tax, sg);
          else sum4(T.itcA.a5, tax, sg);
        }
      });
    });

    // ---- GST Adjustments (is mahine ki) ----
    (DB.gstAdj || []).filter(a => (a.date || "").slice(0, 7) === ym).forEach(a => {
      T.counts.adj++;
      const t = { i: +a.igst || 0, c: +a.cgst || 0, s: +a.sgst || 0, k: +a.cess || 0 }, tv = +a.taxable || 0;
      switch (a.nature) {
        case "opening": sum4(T.opening, t); break;
        case "rcm":
          T.s31.d.txval += tv; sum4(T.s31.d, t);
          if (a.itcEligible === false) sum4(T.inelig.d2, t); else sum4(T.itcA.a3, t);
          break;
        case "rev_rules": sum4(T.itcB.b1, t); break;
        case "rev_other": sum4(T.itcB.b2, t); break;
        case "inelig_1705": sum4(T.inelig.d1, t); sum4(T.itcA.a5, t, -1); break;
        case "zero": T.s31.b.txval += tv; sum4(T.s31.b, t); break;
        case "nongst": T.s31.e.txval += tv; break;
        case "interest": sum4(T.interest, t); break;
        case "latefee": sum4(T.latefee, t); break;
        case "itc_other": sum4(T.itcA.a5, t); break;
      }
    });

    // ---- round off ----
    [T.s31.a, T.s31.b, T.s31.d].forEach(o => { o.txval = r2(o.txval); HEADS.forEach(h => { o[h] = r2(o[h]); }); });
    T.s31.c.txval = r2(T.s31.c.txval); T.s31.e.txval = r2(T.s31.e.txval);
    Object.values(T.itcA).forEach(o => HEADS.forEach(h => { o[h] = r2(o[h]); }));
    Object.values(T.itcB).forEach(o => HEADS.forEach(h => { o[h] = r2(o[h]); }));
    Object.values(T.inelig).forEach(o => HEADS.forEach(h => { o[h] = r2(o[h]); }));
    [T.opening, T.interest, T.latefee].forEach(o => HEADS.forEach(h => { o[h] = r2(o[h]); }));
    Object.keys(T.inward).forEach(k => { T.inward[k] = r2(T.inward[k]); });

    // ---- 4(C) Net ITC ----
    const A = zero4();
    ["a1", "a2", "a3", "a4", "a5"].forEach(k => sum4(A, T.itcA[k]));
    T.itcAtotal = A;
    const B = sum4(sum4(zero4(), T.itcB.b1), T.itcB.b2);
    T.itcBtotal = B;
    T.itcNet = zero4(); HEADS.forEach(h => { T.itcNet[h] = r2(A[h] - B[h]); });

    // ---- 6.1 bhugtan (rule 88A order) ----
    // Credit: pichhla bacha + is mahine ka (A(5) − reversal). RCM ka ITC (A3) cash dene ke BAAD milta hai,
    // isliye is mahine ki liability me istemal nahi kiya (surakshit hisaab); wo aage bacha ITC me jaata hai.
    const pool = zero4();
    HEADS.forEach(h => { pool[h] = Math.max(0, r2(T.opening[h] + T.itcA.a5[h] + T.itcA.a1[h] + T.itcA.a2[h] + T.itcA.a4[h] - B[h])); });
    const liab = zero4();     // RCM ke alawa
    HEADS.forEach(h => { liab[h] = Math.max(0, r2(T.s31.a[h] + T.s31.b[h])); });
    const used = { i: zero4(), c: zero4(), s: zero4(), k: zero4() };
    const P = Object.assign({}, pool), L = Object.assign({}, liab);
    const take = (ch, lh) => { const u = Math.min(P[ch], L[lh]); if (u > 0) { P[ch] = r2(P[ch] - u); L[lh] = r2(L[lh] - u); used[ch][lh] = r2(used[ch][lh] + u); } };
    take("i", "i"); take("i", "c"); take("i", "s"); take("c", "c"); take("c", "i"); take("s", "s"); take("s", "i"); take("k", "k");
    T.pay = {};
    HEADS.forEach(h => {
      const itcPaid = r2(HEADS.reduce((a, ch) => a + used[ch][h], 0));
      T.pay[h] = { payable: liab[h], rcm: T.s31.d[h], itc: itcPaid, cash: r2(L[h] + T.s31.d[h]), interest: T.interest[h], latefee: T.latefee[h] };
    });
    T.used = used;
    T.carry = zero4(); HEADS.forEach(h => { T.carry[h] = r2(P[h] + T.itcA.a3[h]); });
    T.cashTotal = r2(HEADS.reduce((a, h) => a + T.pay[h].cash + T.pay[h].interest + T.pay[h].latefee, 0));
    if (HEADS.some(h => B[h] > (T.opening[h] + T.itcA.a5[h] + A[h] - T.itcA.a3[h]) + 0.005)) T.notes.push("ITC reversal, uplabdh ITC se zyada hai — baaki rakam cash me bharni pad sakti hai; CA se milaan karein.");
    return T;
  }

  // --------------------------------------------------------------- screen
  const f2 = (x) => "₹" + e(fmtINR(x));
  function render3BScreen() {
    document.getElementById("screenTitle").textContent = "GSTR-3B (Tax Payable & ITC)";
    document.getElementById("screenSub").textContent = "Mahine ke hisaab se | Portal jaisi tables | Esc: Back";
    const ym = currentMonth();
    const T = compute3B(ym);
    window.__gst3b = T;
    const opts = monthList().map(m => `<option value="${m}" ${m === ym ? "selected" : ""}>${monthLabel(m)}</option>`).join("");
    const th = (cols) => `<thead><tr>${cols.map((c, i) => `<th class="${i ? "num" : ""}">${c}</th>`).join("")}</tr></thead>`;
    const td = (v, strong) => `<td class="num">${strong ? "<b>" : ""}${typeof v === "number" ? f2(v) : v}${strong ? "</b>" : ""}</td>`;
    const row = (label, vals, bold) => `<tr style="${bold ? "font-weight:800;background:#f1f5f9;" : ""}"><td>${label}</td>${vals.map(v => td(v)).join("")}</tr>`;
    const sec = (title) => `<div style="font-size:12px;font-weight:800;color:var(--pri-dark);text-transform:uppercase;margin:12px 0 4px;">${title}</div>`;
    const q = T.s31;
    const t31 = `<table class="tally-tbl">${th(["Nature of Supplies", "Taxable Value", "IGST", "CGST", "SGST", "Cess"])}<tbody>
      ${row("(a) Outward taxable supplies (other than zero rated, nil rated and exempted)", [q.a.txval, q.a.i, q.a.c, q.a.s, q.a.k])}
      ${row("(b) Outward taxable supplies (zero rated)", [q.b.txval, q.b.i, q.b.c, q.b.s, q.b.k])}
      ${row("(c) Other outward supplies (nil rated, exempted)", [q.c.txval, "", "", "", ""])}
      ${row("(d) Inward supplies (liable to reverse charge)", [q.d.txval, q.d.i, q.d.c, q.d.s, q.d.k])}
      ${row("(e) Non-GST outward supplies", [q.e.txval, "", "", "", ""])}</tbody></table>`;
    const unregRows = [...T.unreg.entries()].map(([pos, o]) => row(`${e((typeof GST_STATES !== "undefined" && GST_STATES[pos]) || pos)} (${e(pos)})`, [r2(o.txval), r2(o.i)])).join("");
    const compRows = [...T.comp.entries()].map(([pos, o]) => row(`${e((typeof GST_STATES !== "undefined" && GST_STATES[pos]) || pos)} (${e(pos)})`, [r2(o.txval), r2(o.i)])).join("");
    const t32 = `<table class="tally-tbl">${th(["Place of Supply", "Taxable Value", "IGST"])}<tbody>
      <tr><td colspan="3" style="font-weight:700;background:#f8fafc;">Supplies made to Unregistered Persons</td></tr>${unregRows || `<tr><td colspan="3" style="color:var(--muted);">— koi nahi —</td></tr>`}
      <tr><td colspan="3" style="font-weight:700;background:#f8fafc;">Supplies made to Composition Taxable Persons</td></tr>${compRows || `<tr><td colspan="3" style="color:var(--muted);">— koi nahi —</td></tr>`}</tbody></table>`;
    const A = T.itcA, B = T.itcB, D = T.inelig;
    const v4 = (o) => [o.i, o.c, o.s, o.k];
    const t4 = `<table class="tally-tbl">${th(["Details", "IGST", "CGST", "SGST", "Cess"])}<tbody>
      <tr><td colspan="5" style="font-weight:700;background:#f8fafc;">(A) ITC Available (whether in full or part)</td></tr>
      ${row("(1) Import of goods", v4(A.a1))}${row("(2) Import of services", v4(A.a2))}${row("(3) Inward supplies liable to reverse charge (other than 1 & 2 above)", v4(A.a3))}
      ${row("(4) Inward supplies from ISD", v4(A.a4))}${row("(5) All other ITC", v4(A.a5))}
      <tr><td colspan="5" style="font-weight:700;background:#f8fafc;">(B) ITC Reversed</td></tr>
      ${row("(1) As per rules 38, 42 & 43 of CGST Rules and sub-section (5) of section 17", v4(B.b1))}${row("(2) Others", v4(B.b2))}
      ${row("(C) Net ITC Available (A) − (B)", v4(T.itcNet), true)}
      <tr><td colspan="5" style="font-weight:700;background:#f8fafc;">(D) Ineligible ITC</td></tr>
      ${row("(1) As per section 17(5)", v4(D.d1))}${row("(2) Others (item ke ITC Type = Ineligible)", v4(D.d2))}</tbody></table>`;
    const I = T.inward;
    const t5 = `<table class="tally-tbl">${th(["Nature of supplies", "Inter-State", "Intra-State"])}<tbody>
      ${row("From a supplier under composition scheme, exempt and nil rated supply", [I.interNil, I.intraNil])}${row("Non GST supply", [I.interNon, I.intraNon])}</tbody></table>`;
    const P = T.pay;
    const t6 = `<table class="tally-tbl">${th(["Description", "Tax Payable", "Paid through ITC", "Tax paid in Cash", "Interest", "Late Fee"])}<tbody>
      ${HEADS.map(h => row(HEAD_NAME[h] + (P[h].rcm ? ` <span style="font-size:10.5px;color:#64748b;">(RCM ${f2(P[h].rcm)} sirf cash me)</span>` : ""), [P[h].payable + P[h].rcm, P[h].itc, P[h].cash, P[h].interest, P[h].latefee])).join("")}</tbody></table>`;
    document.getElementById("screenBody").innerHTML = `
      <div class="form-card" style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
        <b>Mahina:</b> <select id="gstMonthSel3" style="padding:4px 8px;">${opts}</select><span style="flex:1;"></span>
        <button class="btn btn-sec" onclick="window.gstAdjOpenList()">📋 GST Adjustments (${(DB.gstAdj || []).filter(a => (a.date || "").slice(0, 7) === ym).length})</button>
        <button class="btn" onclick="window.gstAdjOpenForm()">➕ GST Adjustment</button>
        <button class="btn btn-sec" onclick="window.gst3bCsv()">📊 CSV</button>
      </div>
      <div class="form-card" style="text-align:center;background:#ecfdf5;border-color:var(--pri);">
        <div style="font-size:13px;font-weight:700;color:var(--pri-dark);">NET CASH PAYABLE — ${monthLabel(ym)} (Tax + Interest + Late Fee)</div>
        <div style="font-size:24px;font-weight:800;color:var(--pri);">${f2(T.cashTotal)}</div>
        <div style="font-size:12px;color:#475569;margin-top:2px;">Aage ke liye bacha ITC: IGST ${f2(T.carry.i)} | CGST ${f2(T.carry.c)} | SGST ${f2(T.carry.s)}</div></div>
      ${T.notes.map(n => `<div class="form-card" style="color:#92400e;background:#fffbeb;">⚠ ${e(n)}</div>`).join("")}
      ${sec("3.1 Details of Outward Supplies and inward supplies liable to reverse charge")}<div class="form-card" style="padding:0;overflow:hidden;">${t31}</div>
      ${sec("3.2 Inter-State supplies (rajya ke hisaab se)")}<div class="form-card" style="padding:0;overflow:hidden;">${t32}</div>
      ${sec("4. Eligible ITC")}<div class="form-card" style="padding:0;overflow:hidden;">${t4}</div>
      ${sec("5. Values of exempt, nil-rated and non-GST inward supplies")}<div class="form-card" style="padding:0;overflow:hidden;">${t5}</div>
      ${sec("6.1 Payment of tax")}<div class="form-card" style="padding:0;overflow:hidden;">${t6}</div>
      <div class="form-card" style="font-size:12px;color:#475569;">
        ℹ ITC lagane ka order (Rule 88A): IGST credit pehle IGST, phir CGST, phir SGST; CGST credit pehle CGST, phir IGST; SGST credit pehle SGST, phir IGST.
        Reverse Charge ka tax hamesha cash me; uska ITC cash dene ke baad milta hai, isliye wo is mahine ki liability me nahi ghataya (aage ke ITC me jodta hai).
        Is mahine ${T.counts.sales} sales, ${T.counts.purchases} purchase voucher aur ${T.counts.adj} adjustment gine gaye.
        <b>Return bharne se pehle CA se milaan zaroor karein.</b></div>`;
    const sel = document.getElementById("gstMonthSel3");
    sel.onchange = () => { window.__gstMonth = sel.value; render3BScreen(); };
  }
  window.renderGstr3bScreen = render3BScreen;

  window.gst3bCsv = function () {
    const ym = currentMonth(), T = window.__gst3b || compute3B(ym);
    const L = [`GSTR-3B ${monthLabel(ym)} | GSTIN ${DB.company.gstin || "-"} | ${DB.company.name || ""}`, ""];
    const put = (...c) => L.push(c.map(x => { const s = String(x == null ? "" : x); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }).join(","));
    put("3.1 Outward supplies", "Taxable", "IGST", "CGST", "SGST", "Cess");
    const q = T.s31;
    put("(a) Taxable", q.a.txval, q.a.i, q.a.c, q.a.s, q.a.k); put("(b) Zero rated", q.b.txval, q.b.i, q.b.c, q.b.s, q.b.k);
    put("(c) Nil rated / Exempt", q.c.txval); put("(d) Reverse charge", q.d.txval, q.d.i, q.d.c, q.d.s, q.d.k); put("(e) Non-GST", q.e.txval);
    L.push(""); put("3.2 Place of supply", "Type", "Taxable", "IGST");
    T.unreg.forEach((o, pos) => put(pos, "Unregistered", r2(o.txval), r2(o.i))); T.comp.forEach((o, pos) => put(pos, "Composition", r2(o.txval), r2(o.i)));
    L.push(""); put("4. ITC", "IGST", "CGST", "SGST", "Cess");
    const A = T.itcA;
    put("(A)(1) Import goods", A.a1.i, A.a1.c, A.a1.s, A.a1.k); put("(A)(2) Import services", A.a2.i, A.a2.c, A.a2.s, A.a2.k);
    put("(A)(3) Reverse charge", A.a3.i, A.a3.c, A.a3.s, A.a3.k); put("(A)(4) ISD", A.a4.i, A.a4.c, A.a4.s, A.a4.k); put("(A)(5) All other", A.a5.i, A.a5.c, A.a5.s, A.a5.k);
    put("(B)(1) Reversed rules", T.itcB.b1.i, T.itcB.b1.c, T.itcB.b1.s, T.itcB.b1.k); put("(B)(2) Reversed others", T.itcB.b2.i, T.itcB.b2.c, T.itcB.b2.s, T.itcB.b2.k);
    put("(C) Net ITC", T.itcNet.i, T.itcNet.c, T.itcNet.s, T.itcNet.k);
    put("(D)(1) Ineligible 17(5)", T.inelig.d1.i, T.inelig.d1.c, T.inelig.d1.s, T.inelig.d1.k); put("(D)(2) Ineligible others", T.inelig.d2.i, T.inelig.d2.c, T.inelig.d2.s, T.inelig.d2.k);
    L.push(""); put("5. Inward exempt/nil/non-GST", "Inter-State", "Intra-State");
    put("Exempt/nil", T.inward.interNil, T.inward.intraNil); put("Non-GST", T.inward.interNon, T.inward.intraNon);
    L.push(""); put("6.1 Payment", "Tax payable", "Paid through ITC", "Cash", "Interest", "Late fee");
    HEADS.forEach(h => put(HEAD_NAME[h], r2(T.pay[h].payable + T.pay[h].rcm), T.pay[h].itc, T.pay[h].cash, T.pay[h].interest, T.pay[h].latefee));
    put("Carry-forward ITC", T.carry.i, T.carry.c, T.carry.s, T.carry.k);
    const blob = new Blob(["\ufeff" + L.join("\r\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `GSTR3B_${fpOf(ym)}.csv`;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    toast("📊 GSTR-3B CSV download ho gayi");
  };

  // --------------------------------------------------------------- GST Adjustment (list / form)
  function writeGuard() {
    if (typeof canWriteData === "function" && !canWriteData()) { toast("👁️ Read-Only Mode: adjustment ki permission nahi hai!"); return false; }
    return true;
  }
  const amt = (a) => (a.nature === "nongst" || a.nature === "zero") ? (a.taxable || 0) : ((a.igst || 0) + (a.cgst || 0) + (a.sgst || 0) + (a.cess || 0));

  window.gstAdjOpenList = function () {
    const ym = currentMonth();
    const list = (DB.gstAdj || []).filter(a => (a.date || "").slice(0, 7) === ym).sort((a, b) => (a.date || "").localeCompare(b.date || ""));
    const rows = list.map((a, i) => `<tr>
      <td>${i + 1}</td><td>${e(fmtDate(a.date))}</td><td><b>${e((natureOf(a.nature) || {}).label || a.nature)}</b>${a.narr ? `<div style="font-size:11px;color:#64748b;">${e(a.narr)}</div>` : ""}</td>
      <td class="num">${a.taxable ? f2(a.taxable) : "-"}</td><td class="num">${f2(a.igst || 0)}</td><td class="num">${f2(a.cgst || 0)}</td><td class="num">${f2(a.sgst || 0)}</td>
      <td style="white-space:nowrap;"><button class="btn btn-sec" style="padding:2px 7px;font-size:11px;" onclick="window.gstAdjOpenForm('${e(a.id)}')">Edit</button>
      <button class="btn btn-sec cv-red" style="padding:2px 7px;font-size:11px;" onclick="window.gstAdjDeleteAsk('${e(a.id)}')">Del</button></td></tr>`).join("");
    showModal(`GST Adjustments — ${monthLabel(ym)}`,
      `<div style="max-height:60vh;overflow:auto;"><table class="tally-tbl"><thead><tr><th>#</th><th>Date</th><th>Nature</th><th class="num">Taxable</th><th class="num">IGST</th><th class="num">CGST</th><th class="num">SGST</th><th></th></tr></thead>
       <tbody>${rows || `<tr><td colspan="8" style="text-align:center;padding:16px;color:var(--muted);">Is mahine koi adjustment nahi.</td></tr>`}</tbody></table></div>`,
      `<button class="btn btn-sec" onclick="closeModal()">Close (Esc)</button><button class="btn" onclick="window.gstAdjOpenForm()">➕ Naya Adjustment</button>`);
  };

  window.gstAdjOpenForm = function (id) {
    if (!writeGuard()) return;
    const a = id ? (DB.gstAdj || []).find(x => x.id === id) : null;
    const ym = currentMonth();
    const defDate = a ? a.date : (((DB.company.curDate || "").slice(0, 7) === ym) ? DB.company.curDate : ym + "-01");
    const natOpts = NATURES.map(n => `<option value="${n.id}" ${(a && a.nature === n.id) ? "selected" : ""}>${e(n.label)}</option>`).join("");
    const v = (k) => e(a && a[k] != null ? a[k] : "");
    const body = `
      <input type="hidden" id="gaId" value="${e(a ? a.id : "")}">
      <div class="form-grid" style="grid-template-columns:2fr 1fr;gap:10px;">
        <div class="field"><label>Nature of Adjustment *</label><select id="gaNature">${natOpts}</select></div>
        <div class="field"><label>Date *</label><input type="date" id="gaDate" value="${e(defDate)}"></div>
      </div>
      <div id="gaHint" style="font-size:12px;color:#475569;margin:4px 0 8px;"></div>
      <div id="gaRcmBox" style="display:none;" class="form-grid">
        <div class="field"><label>Supply Type</label><select id="gaSupply"><option value="intra">Intra-State (CGST+SGST)</option><option value="inter">Inter-State (IGST)</option></select></div>
        <div class="field"><label>GST Rate %</label><input type="number" step="0.01" id="gaRate" placeholder="e.g. 5"></div>
        <div class="field" style="display:flex;align-items:flex-end;"><label style="display:flex;gap:6px;align-items:center;"><input type="checkbox" id="gaItcOk" ${(!a || a.itcEligible !== false) ? "checked" : ""}> ITC milega (eligible)</label></div>
      </div>
      <div class="form-grid" style="grid-template-columns:repeat(5,1fr);gap:8px;">
        <div class="field" id="gaTvBox"><label>Taxable Value</label><input type="number" step="0.01" min="0" id="gaTv" value="${v("taxable")}"></div>
        <div class="field gaTaxF"><label>IGST</label><input type="number" step="0.01" min="0" id="gaI" value="${v("igst")}"></div>
        <div class="field gaTaxF"><label>CGST</label><input type="number" step="0.01" min="0" id="gaC" value="${v("cgst")}"></div>
        <div class="field gaTaxF"><label>SGST</label><input type="number" step="0.01" min="0" id="gaS" value="${v("sgst")}"></div>
        <div class="field gaTaxF"><label>Cess</label><input type="number" step="0.01" min="0" id="gaK" value="${v("cess")}"></div>
      </div>
      <div class="field" style="margin-top:8px;"><label>Narration</label><input id="gaNarr" value="${v("narr")}" placeholder="e.g. Transport freight Nov — GTA"></div>`;
    showModal(a ? "✏️ GST Adjustment Badlein" : "➕ GST Adjustment", body,
      `<button class="btn btn-sec" onclick="window.gstAdjOpenList()">Back</button><button class="btn" onclick="window.gstAdjSave()">Save (Ctrl+A)</button>`);

    const natSel = document.getElementById("gaNature");
    const upd = () => {
      const n = natureOf(natSel.value);
      document.getElementById("gaHint").textContent = n.hint;
      document.getElementById("gaRcmBox").style.display = n.fields === "rcm" ? "" : "none";
      document.getElementById("gaTvBox").style.display = (n.fields === "rcm" || n.fields === "taxval" || n.fields === "val") ? "" : "none";
      document.querySelectorAll("#modalBody .gaTaxF").forEach(el => { el.style.display = n.fields === "val" ? "none" : ""; });
    };
    natSel.onchange = upd; upd();
    const calc = () => {   // RCM: taxable + rate se tax khud bhar do (badla ja sakta hai)
      if (natSel.value !== "rcm") return;
      const tv = +document.getElementById("gaTv").value || 0, rt = +document.getElementById("gaRate").value || 0;
      const inter = document.getElementById("gaSupply").value === "inter";
      const tax = r2(tv * rt / 100), half = r2(tax / 2);
      document.getElementById("gaI").value = inter ? tax : 0;
      document.getElementById("gaC").value = inter ? 0 : half; document.getElementById("gaS").value = inter ? 0 : half;
    };
    ["gaTv", "gaRate", "gaSupply"].forEach(i => { const el = document.getElementById(i); if (el) el.oninput = el.onchange = calc; });
  };

  window.gstAdjSave = function () {
    if (!writeGuard()) return;
    const g = (i) => (document.getElementById(i) || {}).value;
    const nature = g("gaNature"), n = natureOf(nature), date = g("gaDate");
    if (!n || !date) { toast("⚠ Nature aur Date zaroori hai"); return; }
    const ym = date.slice(0, 7);
    if (!monthList().includes(ym)) { toast("⚠ Date company ke saal (period) ke andar honi chahiye"); return; }
    const num = (i) => Math.max(0, r2(g(i)));
    const rec = { nature, date, taxable: n.fields === "tax" ? 0 : num("gaTv"), igst: n.fields === "val" ? 0 : num("gaI"), cgst: n.fields === "val" ? 0 : num("gaC"),
      sgst: n.fields === "val" ? 0 : num("gaS"), cess: n.fields === "val" ? 0 : num("gaK"), narr: (g("gaNarr") || "").trim() };
    if (nature === "rcm") rec.itcEligible = !!(document.getElementById("gaItcOk") || {}).checked;
    const total = rec.taxable + rec.igst + rec.cgst + rec.sgst + rec.cess;
    if (total <= 0) { toast("⚠ Koi rakam bharein"); return; }
    if (nature === "rcm" && rec.igst > 0 && (rec.cgst > 0 || rec.sgst > 0)) { toast("⚠ Ek hi supply me IGST aur CGST/SGST dono nahi ho sakte"); return; }
    if (nature === "rcm" && rec.cgst !== rec.sgst) { toast("⚠ CGST aur SGST barabar hone chahiye"); return; }
    DB.gstAdj = DB.gstAdj || [];
    const id = g("gaId");
    const ex = id ? DB.gstAdj.find(x => x.id === id) : null;
    if (ex) Object.assign(ex, rec); else DB.gstAdj.push(Object.assign({ id: uid("GA") }, rec));
    saveDB();
    window.__gstMonth = ym;
    closeModal();
    render3BScreen();
    toast("✅ GST Adjustment save ho gaya");
  };

  window.gstAdjDeleteAsk = function (id) {
    if (!writeGuard()) return;
    const a = (DB.gstAdj || []).find(x => x.id === id);
    if (!a) return;
    showModal("🗑 Adjustment Hatayein?",
      `<div id="gaDelBox" style="font-size:13px;line-height:1.6;"><div style="padding:8px 10px;background:#f1f5f9;border-radius:4px;margin-bottom:8px;"><b>${e((natureOf(a.nature) || {}).label || a.nature)}</b> | ${e(fmtDate(a.date))} | ₹${e(fmtINR(amt(a)))}</div>
       Kya aap is adjustment ko <b>hata</b> dena chahte hain? Isse 3B ka hisaab badal jayega.</div>`,
      `<button class="btn btn-sec" onclick="window.gstAdjOpenList()">No (N / Esc)</button><button class="btn btn-danger" onclick="window.gstAdjDeleteDo('${e(id)}')">Yes, Hatayein</button>`);
  };
  window.gstAdjDeleteDo = function (id) {
    DB.gstAdj = (DB.gstAdj || []).filter(x => x.id !== id);
    saveDB();
    render3BScreen();
    window.gstAdjOpenList();
    toast("🗑 Adjustment hata diya");
  };

  window.__gst3b_api = { compute3B, NATURES };
})();
