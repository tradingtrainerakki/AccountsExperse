// ============================================================================
// gstexport.js  —  GST ki taiyari (vyapari / cement dukan jaise graahak ke liye)
//
//   * GSTR-1: MAHINE ke hisaab se, sahi table me banta hai
//       B2B | B2CL (Rs 1 lakh se upar, antar-rajya) | B2CS | Credit Note (CDNR/CDNUR) | HSN | Docs
//   * "Pre-check": portal par jaane se PEHLE galtiyaan batata hai (GSTIN, HSN, rate, invoice no. ...)
//   * Download: (1) Portal-JSON (prayogik)  (2) Saari tables ek CSV me (jaanch / Excel ke liye)
//   * GSTR-3B: mahine ka Output GST, ITC aur cash me bharne wala tax (sahi utilization order me)
//   * Cancelled voucher in sab me nahi judte
//   * B2CL ki seema 2.5 lakh se 1 lakh (Aug 2024 se) kar di gayi hai
//
// Load order: index.html me sabse LAST (cloudsync.js ke baad) lagayein.
// ============================================================================
(function () {
  "use strict";

  const e = (s) => escHtml(s);
  const r2 = (x) => +(+x || 0).toFixed(2);
  const B2CL_LIMIT = 100000;                       // Rs 1 lakh (Aug 2024 se)
  const GSTR1_VERSION = "GST3.2.4";                 // portal ne badla ho to yaha badlein
  const VALID_RATES = [0, 0.1, 0.25, 1, 1.5, 3, 5, 6, 7.5, 12, 14, 18, 28, 40];
  const UQC_MAP = {
    bag: "BAG", bags: "BAG", kg: "KGS", kgs: "KGS", kilogram: "KGS", ton: "TON", tons: "TON", tonne: "TON", mt: "MTS",
    "metric ton": "MTS", qtl: "QTL", quintal: "QTL", nos: "NOS", no: "NOS", number: "NOS", pcs: "PCS", pc: "PCS", piece: "PCS",
    pieces: "PCS", mtr: "MTR", meter: "MTR", metre: "MTR", ltr: "LTR", litre: "LTR", liter: "LTR", box: "BOX", bdl: "BDL",
    bundle: "BDL", sqm: "SQM", sqf: "SQF", roll: "ROL", set: "SET", pair: "PRS", cbm: "CBM", drum: "DRM", can: "CAN",
    carton: "CTN", dozen: "DOZ", unit: "UNT", units: "UNT", gm: "GMS", gram: "GMS", bundles: "BDL", sheet: "SHT", tube: "TBS"
  };
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  // --------------------------------------------------------------- period helpers
  function monthList() {
    let from, to;
    try { const p = getTempPeriod(); from = p.from; to = p.to; } catch (err) { from = DB.company.fyFrom; to = DB.company.fyTo; }
    const out = [];
    let y = +from.slice(0, 4), m = +from.slice(5, 7);
    const ey = +to.slice(0, 4), em = +to.slice(5, 7);
    while (y < ey || (y === ey && m <= em)) {
      out.push(`${y}-${String(m).padStart(2, "0")}`);
      m++; if (m > 12) { m = 1; y++; }
    }
    return out;
  }
  const monthLabel = (ym) => `${MONTHS[+ym.slice(5, 7) - 1]} ${ym.slice(0, 4)}`;
  const fpOf = (ym) => ym.slice(5, 7) + ym.slice(0, 4);                         // MMYYYY
  const dmy = (iso) => `${iso.slice(8, 10)}-${iso.slice(5, 7)}-${iso.slice(0, 4)}`; // dd-mm-yyyy

  window.__gstMonth = window.__gstMonth || "";
  function currentMonth() {
    const list = monthList();
    if (window.__gstMonth && list.includes(window.__gstMonth)) return window.__gstMonth;
    const cur = (DB.company.curDate || "").slice(0, 7);
    window.__gstMonth = list.includes(cur) ? cur : (list[0] || "");
    return window.__gstMonth;
  }

  // --------------------------------------------------------------- data building
  function uqcOf(uom) {
    const k = String(uom || "").trim().toLowerCase();
    return UQC_MAP[k] || "";
  }

  function buildInvoice(v) {
    const led = (typeof getLedger === "function" ? getLedger(v.partyLedgerId) : null) || {};
    const g = v.gst || {};
    const lines = Array.isArray(v.itemLines) ? v.itemLines : [];
    const byRate = new Map();
    lines.forEach(l => {
      const rt = Number(l.gstRate) || 0;
      const o = byRate.get(rt) || { rt, txval: 0, iamt: 0, camt: 0, samt: 0 };
      o.txval += Number(l.taxable) || 0; o.iamt += Number(l.igstAmt) || 0;
      o.camt += Number(l.cgstAmt) || 0; o.samt += Number(l.sgstAmt) || 0;
      byRate.set(rt, o);
    });
    const items = [...byRate.values()].sort((a, b) => a.rt - b.rt)
      .map(o => ({ rt: o.rt, txval: r2(o.txval), iamt: r2(o.iamt), camt: r2(o.camt), samt: r2(o.samt) }));
    return {
      id: v.id, type: v.type, no: String(v.vchNo || ""), date: v.date,
      val: r2(g.netInvoice), pos: g.posState || led.stateCode || DB.company.stateCode || "",
      inter: g.supplyType === "INTER", ctin: String(led.gstin || "").trim().toUpperCase(),
      regType: led.regType || "", party: led.name || "", ledId: v.partyLedgerId,
      items, lines, taxable: r2(g.taxable), cgst: r2(g.cgst), sgst: r2(g.sgst), igst: r2(g.igst), roundOff: r2(g.roundOff)
    };
  }

  function addHsn(map, inv, sign) {
    inv.lines.forEach(l => {
      const rt = Number(l.gstRate) || 0;
      const hsn = String(l.hsn || "").trim();
      const uqc = uqcOf(l.uom) || "OTH";
      const key = [hsn, uqc, rt].join("|");
      const o = map.get(key) || { hsn_sc: hsn, desc: String(l.itemName || "").slice(0, 30), uqc, qty: 0, rt, txval: 0, iamt: 0, camt: 0, samt: 0 };
      o.qty += sign * (Number(l.qty) || 0); o.txval += sign * (Number(l.taxable) || 0);
      o.iamt += sign * (Number(l.igstAmt) || 0); o.camt += sign * (Number(l.cgstAmt) || 0); o.samt += sign * (Number(l.sgstAmt) || 0);
      map.set(key, o);
    });
  }

  function docSeries(vs) {
    const groups = new Map();
    vs.forEach(v => {
      const no = String(v.vchNo || "");
      const m = /^(.*?)(\d+)$/.exec(no);
      const pref = m ? m[1] : no, n = m ? parseInt(m[2], 10) : 0;
      const g = groups.get(pref) || { items: [] };
      g.items.push({ no, n, cancelled: !!v.cancelled });
      groups.set(pref, g);
    });
    return [...groups.values()].map(g => {
      g.items.sort((a, b) => a.n - b.n);
      const first = g.items[0], last = g.items[g.items.length - 1];
      const cancel = g.items.filter(x => x.cancelled).length;
      return { from: first.no, to: last.no, totnum: g.items.length, cancel, net_issue: g.items.length - cancel, gap: (last.n - first.n + 1) !== g.items.length };
    });
  }

  function buildGstr1(ym) {
    const issues = [];
    const add = (level, msg) => issues.push({ level, msg });
    const c = DB.company || {};
    if (!c.gstin) add("error", "Company ka GSTIN bhara nahi hai (F3 me bharein).");
    else if (typeof validateGSTIN === "function" && !validateGSTIN(c.gstin).valid) add("error", "Company ka GSTIN galat hai: " + c.gstin);
    if (c.regType && /unreg/i.test(c.regType)) add("warn", "Company 'Unregistered' likhi hai — GST return tabhi bharna hota hai jab registration ho.");

    const all = (DB.vouchers || []).filter(v => (v.date || "").slice(0, 7) === ym && (v.type === "Sales" || v.type === "Credit Note") && v.gst);
    const cancelled = all.filter(v => v.cancelled);
    const live = all.filter(v => !v.cancelled);
    if (cancelled.length) add("info", `${cancelled.length} cancelled voucher return me nahi judenge (sirf Docs ki ginti me aayenge).`);

    const out = { b2b: [], b2cl: [], b2cs: [], cdnr: [], cdnur: [], docsSales: docSeries(all.filter(v => v.type === "Sales")), docsCN: docSeries(all.filter(v => v.type === "Credit Note")) };
    const hsnB2B = new Map(), hsnB2C = new Map();
    const seenNo = new Set();

    live.forEach(v => {
      const inv = buildInvoice(v);
      const isCN = v.type === "Credit Note";
      const tag = `${isCN ? "Credit Note" : "Invoice"} ${inv.no}`;

      // ---- jaanch ----
      if (!/^[A-Za-z1-9][A-Za-z0-9/-]{0,15}$/.test(inv.no)) add("error", `${tag}: number 16 akshar se zyada / galat akshar / 0 ya - ya / se shuru. Sirf akshar, number, '/' aur '-' chalte hain.`);
      const dupKey = v.type + "|" + inv.no;
      if (seenNo.has(dupKey)) add("error", `${tag}: ye number dobara aaya hai (duplicate).`);
      seenNo.add(dupKey);
      if (!inv.pos) add("error", `${tag}: Place of Supply (rajya) nahi mila.`);
      if (inv.ctin) {
        if (typeof validateGSTIN === "function" && !validateGSTIN(inv.ctin).valid) add("error", `${tag}: ${inv.party} ka GSTIN galat hai (${inv.ctin}).`);
        if (inv.ctin === String(c.gstin || "").toUpperCase()) add("warn", `${tag}: graahak ka GSTIN aur aapka GSTIN ek jaisa hai.`);
      } else if (/regular|composition/i.test(inv.regType)) {
        add("error", `${tag}: ${inv.party} 'Registered' hai par GSTIN khali hai.`);
      }
      if (!inv.lines.length) add("error", `${tag}: item ki line nahi mili.`);
      inv.lines.forEach(l => {
        const hsn = String(l.hsn || "").trim();
        if (!hsn) add("error", `${tag}: '${l.itemName}' ka HSN khali hai.`);
        else if (!/^\d{4}(\d{2}|\d{4})?$/.test(hsn)) add("error", `${tag}: '${l.itemName}' ka HSN '${hsn}' sahi nahi (4, 6 ya 8 ank chahiye).`);
        if (!uqcOf(l.uom)) add("warn", `${tag}: '${l.itemName}' ki unit '${l.uom}' portal ke UQC code se mil nahi rahi — 'OTH' likhi jayegi.`);
        const rt = Number(l.gstRate) || 0;
        if (!VALID_RATES.includes(rt)) add("error", `${tag}: GST rate ${rt}% portal ke rate me nahi hai.`);
      });
      if (inv.cgst !== inv.sgst) add("error", `${tag}: CGST aur SGST barabar nahi hain.`);
      const calc = r2(inv.taxable + inv.cgst + inv.sgst + inv.igst + inv.roundOff);
      if (Math.abs(calc - inv.val) > 1) add("warn", `${tag}: invoice value (${inv.val}) aur taxable+tax (${calc}) me antar hai.`);
      const sumTx = r2(inv.items.reduce((a, o) => a + o.txval, 0));
      if (Math.abs(sumTx - inv.taxable) > 1) add("warn", `${tag}: taxable value aur line-wise jod me antar hai.`);

      // ---- table me daalna ----
      const cat = inv.ctin ? "B2B" : (inv.inter && inv.val > B2CL_LIMIT ? "B2CL" : "B2CS");
      const sign = isCN ? -1 : 1;
      addHsn(inv.ctin ? hsnB2B : hsnB2C, inv, sign);

      if (!isCN) {
        if (cat === "B2B") out.b2b.push(inv);
        else if (cat === "B2CL") out.b2cl.push(inv);
        else out.b2cs.push(inv);
      } else {
        if (cat === "B2B") out.cdnr.push(inv);
        else if (cat === "B2CL") out.cdnur.push(inv);
        else { out.b2cs.push(Object.assign({}, inv, { isCN: true })); add("warn", `${tag}: unregistered graahak ka credit note — Table 7 (B2CS) me ghataya gaya hai; portal par ek baar jaanch lein.`); }
      }
    });

    [...out.docsSales.map(d => ["Sales invoice", d]), ...out.docsCN.map(d => ["Credit note", d])].forEach(([n, d]) => {
      if (d.gap) add("warn", `${n} series ${d.from} se ${d.to}: beech ke kuch number gayab hain (delete hue?). Docs table me dikkat aa sakti hai.`);
    });
    if (!live.length) add("info", "Is mahine me koi GST sales invoice nahi mili.");

    out.hsnB2B = [...hsnB2B.values()]; out.hsnB2C = [...hsnB2C.values()];
    out.issues = issues; out.ym = ym; out.count = live.length;
    return out;
  }

  // --------------------------------------------------------------- JSON (portal)
  const itmOf = (inv, withTax) => inv.items.map((o, i) => {
    const d = { rt: o.rt, txval: o.txval };
    if (inv.inter) d.iamt = o.iamt; else { d.camt = o.camt; d.samt = o.samt; }
    d.csamt = 0;
    return { num: i + 1, itm_det: d };
  });

  function groupBy(arr, fn) { const m = new Map(); arr.forEach(x => { const k = fn(x); (m.get(k) || m.set(k, []).get(k)).push(x); }); return m; }

  function toPortalJson(R) {
    const c = DB.company;
    const j = { gstin: String(c.gstin || "").toUpperCase(), fp: fpOf(R.ym), version: GSTR1_VERSION, hash: "hash" };

    if (R.b2b.length) j.b2b = [...groupBy(R.b2b, x => x.ctin)].map(([ctin, list]) => ({
      ctin, inv: list.map(x => ({ inum: x.no, idt: dmy(x.date), val: x.val, pos: x.pos, rchrg: "N", inv_typ: "R", itms: itmOf(x) }))
    }));
    if (R.b2cl.length) j.b2cl = [...groupBy(R.b2cl, x => x.pos)].map(([pos, list]) => ({
      pos, inv: list.map(x => ({ inum: x.no, idt: dmy(x.date), val: x.val, itms: itmOf(x) }))
    }));
    if (R.b2cs.length) {
      const m = new Map();
      R.b2cs.forEach(x => {
        const sign = x.isCN ? -1 : 1, ty = x.inter ? "INTER" : "INTRA";
        x.items.forEach(o => {
          const k = [ty, x.pos, o.rt].join("|");
          const a = m.get(k) || { sply_ty: ty, rt: o.rt, typ: "OE", pos: x.pos, txval: 0, iamt: 0, camt: 0, samt: 0 };
          a.txval += sign * o.txval; a.iamt += sign * o.iamt; a.camt += sign * o.camt; a.samt += sign * o.samt;
          m.set(k, a);
        });
      });
      j.b2cs = [...m.values()].map(a => {
        const o = { sply_ty: a.sply_ty, rt: a.rt, typ: a.typ, pos: a.pos, txval: r2(a.txval) };
        if (a.sply_ty === "INTER") o.iamt = r2(a.iamt); else { o.camt = r2(a.camt); o.samt = r2(a.samt); }
        o.csamt = 0; return o;
      });
    }
    if (R.cdnr.length) j.cdnr = [...groupBy(R.cdnr, x => x.ctin)].map(([ctin, list]) => ({
      ctin, nt: list.map(x => ({ ntty: "C", nt_num: x.no, nt_dt: dmy(x.date), val: x.val, pos: x.pos, rchrg: "N", inv_typ: "R", itms: itmOf(x) }))
    }));
    if (R.cdnur.length) j.cdnur = R.cdnur.map(x => ({ typ: "B2CL", ntty: "C", nt_num: x.no, nt_dt: dmy(x.date), val: x.val, pos: x.pos, itms: itmOf(x) }));

    const hsnRow = (h, i) => ({ num: i + 1, hsn_sc: h.hsn_sc, desc: h.desc, uqc: h.uqc, qty: +(+h.qty).toFixed(3), rt: h.rt,
      txval: r2(h.txval), iamt: r2(h.iamt), camt: r2(h.camt), samt: r2(h.samt), csamt: 0 });
    j.hsn = { hsn_b2b: R.hsnB2B.map(hsnRow), hsn_b2c: R.hsnB2C.map(hsnRow) };

    const docs = [];
    if (R.docsSales.length) docs.push({ doc_num: 1, doc_typ: "Invoices for outward supply", docs: R.docsSales.map((d, i) => ({ num: i + 1, from: d.from, to: d.to, totnum: d.totnum, cancel: d.cancel, net_issue: d.net_issue })) });
    if (R.docsCN.length) docs.push({ doc_num: 5, doc_typ: "Credit Note", docs: R.docsCN.map((d, i) => ({ num: i + 1, from: d.from, to: d.to, totnum: d.totnum, cancel: d.cancel, net_issue: d.net_issue })) });
    j.doc_issue = { doc_det: docs };
    return j;
  }

  // --------------------------------------------------------------- CSV (jaanch ke liye)
  const csvCell = (x) => { const s = String(x == null ? "" : x); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  function toCsv(R) {
    const L = [];
    const sec = (title, head, rows) => { L.push(""); L.push(csvCell(title)); L.push(head.map(csvCell).join(",")); rows.forEach(r => L.push(r.map(csvCell).join(","))); };
    const invRows = (list, withCtin) => list.flatMap(x => x.items.map(o => [
      ...(withCtin ? [x.ctin, x.party] : [x.pos]), x.no, dmy(x.date), x.val, x.pos, o.rt, o.txval, o.iamt, o.camt, o.samt]));
    L.push(`GSTR-1 ${monthLabel(R.ym)} | GSTIN ${DB.company.gstin || "-"} | ${DB.company.name || ""}`);
    sec("TABLE 4 — B2B", ["GSTIN", "Receiver", "Invoice No", "Date", "Invoice Value", "POS", "Rate", "Taxable", "IGST", "CGST", "SGST"], invRows(R.b2b, true));
    sec("TABLE 5 — B2CL (> Rs 1 lakh, inter-state)", ["POS", "Invoice No", "Date", "Invoice Value", "POS", "Rate", "Taxable", "IGST", "CGST", "SGST"], invRows(R.b2cl, false));
    const cs = new Map();
    R.b2cs.forEach(x => x.items.forEach(o => {
      const sg = x.isCN ? -1 : 1, k = [x.inter ? "INTER" : "INTRA", x.pos, o.rt].join("|");
      const a = cs.get(k) || [x.inter ? "INTER" : "INTRA", x.pos, o.rt, 0, 0, 0, 0];
      a[3] += sg * o.txval; a[4] += sg * o.iamt; a[5] += sg * o.camt; a[6] += sg * o.samt; cs.set(k, a);
    }));
    sec("TABLE 7 — B2CS (summary)", ["Supply", "POS", "Rate", "Taxable", "IGST", "CGST", "SGST"], [...cs.values()].map(a => a.map((v, i) => i >= 3 ? r2(v) : v)));
    sec("TABLE 9B — Credit Notes (Registered)", ["GSTIN", "Receiver", "Note No", "Date", "Note Value", "POS", "Rate", "Taxable", "IGST", "CGST", "SGST"], invRows(R.cdnr, true));
    sec("TABLE 9B — Credit Notes (Unregistered)", ["POS", "Note No", "Date", "Note Value", "POS", "Rate", "Taxable", "IGST", "CGST", "SGST"], invRows(R.cdnur, false));
    const hrow = (h) => [h.hsn_sc, h.desc, h.uqc, +(+h.qty).toFixed(3), h.rt, r2(h.txval), r2(h.iamt), r2(h.camt), r2(h.samt)];
    const hh = ["HSN", "Description", "UQC", "Qty", "Rate", "Taxable", "IGST", "CGST", "SGST"];
    sec("TABLE 12 — HSN (B2B)", hh, R.hsnB2B.map(hrow));
    sec("TABLE 12 — HSN (B2C)", hh, R.hsnB2C.map(hrow));
    sec("TABLE 13 — Documents issued", ["Type", "From", "To", "Total", "Cancelled", "Net issued"],
      [...R.docsSales.map(d => ["Invoices for outward supply", d.from, d.to, d.totnum, d.cancel, d.net_issue]),
       ...R.docsCN.map(d => ["Credit Note", d.from, d.to, d.totnum, d.cancel, d.net_issue])]);
    return "\ufeff" + L.join("\r\n");
  }

  function download(name, text, mime) {
    const blob = new Blob([text], { type: mime });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  // --------------------------------------------------------------- GSTR-1 screen
  function sumTbl(list) {
    return { n: list.length, tx: r2(list.reduce((a, x) => a + x.taxable, 0)), tax: r2(list.reduce((a, x) => a + x.cgst + x.sgst + x.igst, 0)) };
  }

  window.renderGstr1Screen = function () {
    document.getElementById("screenTitle").textContent = "GSTR-1 (Outward Supplies)";
    document.getElementById("screenSub").textContent = "Mahine ke hisaab se | Pre-check | Portal JSON | Esc: Back";
    const ym = currentMonth();
    const R = buildGstr1(ym);
    window.__gstR1 = R;
    const opts = monthList().map(m => `<option value="${m}" ${m === ym ? "selected" : ""}>${monthLabel(m)}</option>`).join("");
    const errs = R.issues.filter(i => i.level === "error").length, warns = R.issues.filter(i => i.level === "warn").length;
    const card = (t, s) => `<div class="form-card" style="flex:1;min-width:150px;margin:0;"><div style="font-size:11px;font-weight:800;color:var(--pri-dark);">${t}</div>
      <div style="font-size:12.5px;margin-top:4px;">${s.n} bill<br>Taxable ₹${e(fmtINR(s.tx))}<br>Tax ₹${e(fmtINR(s.tax))}</div></div>`;
    const sb = sumTbl;
    const cn = sumTbl([...R.cdnr, ...R.cdnur]);
    const icon = { error: "❌", warn: "⚠️", info: "ℹ️" };
    const issueHtml = R.issues.length
      ? R.issues.map(i => `<div style="padding:3px 0;font-size:12.5px;color:${i.level === "error" ? "#b91c1c" : i.level === "warn" ? "#92400e" : "#334155"};">${icon[i.level]} ${e(i.msg)}</div>`).join("")
      : `<div style="color:#15803d;font-weight:700;">✅ Koi galti nahi mili.</div>`;
    const rows = [...R.b2b.map(x => ["B2B", x]), ...R.b2cl.map(x => ["B2CL", x]), ...R.b2cs.filter(x => !x.isCN).map(x => ["B2CS", x]),
      ...[...R.cdnr, ...R.cdnur].map(x => ["CN", x]), ...R.b2cs.filter(x => x.isCN).map(x => ["CN-B2CS", x])]
      .map(([cat, x], i) => `<tr><td>${i + 1}</td><td>${e(fmtDate(x.date))}</td><td><b>${e(x.no)}</b></td><td>${e(x.party || "-")}</td>
        <td><span class="kbd">${e(x.ctin || "Unreg")}</span></td><td><span class="kbd" style="background:#fef08a;">${cat}</span></td>
        <td class="num">₹${e(fmtINR(x.taxable))}</td><td class="num">₹${e(fmtINR(x.cgst + x.sgst + x.igst))}</td><td class="num"><b>₹${e(fmtINR(x.val))}</b></td></tr>`).join("");

    document.getElementById("screenBody").innerHTML = `
      <div class="form-card" style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
        <b>Mahina:</b> <select id="gstMonthSel" style="padding:4px 8px;">${opts}</select>
        <span style="flex:1;"></span>
        <button class="btn btn-sec" onclick="window.gstDownloadCsv()">📊 Saari Tables (CSV)</button>
        <button class="btn" onclick="window.gstDownloadJson()">📥 Portal JSON</button>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px;">
        ${card("B2B (Table 4)", sb(R.b2b))}${card("B2CL (Table 5)", sb(R.b2cl))}${card("B2CS (Table 7)", sb(R.b2cs.filter(x => !x.isCN)))}${card("Credit Note (9B)", cn)}
      </div>
      <div class="form-card"><b>✅ Pre-check:</b> <span style="color:${errs ? "#b91c1c" : "#15803d"};font-weight:700;">${errs} galti</span>, ${warns} chetavni
        <div style="margin-top:6px;max-height:170px;overflow-y:auto;">${issueHtml}</div></div>
      <div class="form-card" style="padding:0;overflow:hidden;">
        <table class="tally-tbl"><thead><tr><th>#</th><th>Date</th><th>No</th><th>Party</th><th>GSTIN</th><th>Table</th><th class="num">Taxable</th><th class="num">Tax</th><th class="num">Total</th></tr></thead>
        <tbody>${rows || `<tr><td colspan="9" style="text-align:center;padding:20px;color:var(--muted);">Is mahine ke GST invoice nahi hain.</td></tr>`}</tbody></table>
      </div>`;
    const sel = document.getElementById("gstMonthSel");
    sel.onchange = () => { window.__gstMonth = sel.value; window.renderGstr1Screen(); };
  };

  window.gstDownloadJson = function () {
    const R = window.__gstR1 || buildGstr1(currentMonth());
    const errs = R.issues.filter(i => i.level === "error");
    if (errs.length) { toast(`❌ ${errs.length} galti hai — pehle Pre-check theek karein, tab JSON banega`); return; }
    if (!R.count) { toast("ℹ Is mahine koi GST invoice nahi hai"); return; }
    download(`GSTR1_${DB.company.gstin}_${fpOf(R.ym)}.json`, JSON.stringify(toPortalJson(R), null, 2), "application/json");
    toast("📥 Portal JSON ban gaya — portal par upload karke jaanch lein");
  };
  window.gstDownloadCsv = function () {
    const R = window.__gstR1 || buildGstr1(currentMonth());
    download(`GSTR1_tables_${fpOf(R.ym)}.csv`, toCsv(R), "text/csv;charset=utf-8");
    toast("📊 Tables CSV download ho gayi");
  };
  window.exportGstr1JSON = window.gstDownloadJson; // purana button/shortcut bhi naya chale

  // --------------------------------------------------------------- GSTR-3B (mahine ka)
  function compute3B(ym) {
    const zero = () => ({ txval: 0, iamt: 0, camt: 0, samt: 0 });
    const out = zero(), itc = zero(), notes = [];
    const vs = (DB.vouchers || []).filter(v => (v.date || "").slice(0, 7) === ym && !v.cancelled && v.gst);
    vs.forEach(v => {
      const g = v.gst;
      const add = (acc, s) => { acc.txval += s * (g.taxable || 0); acc.iamt += s * (g.igst || 0); acc.camt += s * (g.cgst || 0); acc.samt += s * (g.sgst || 0); };
      if (v.type === "Sales") add(out, 1);
      else if (v.type === "Credit Note") add(out, -1);
      else if (v.type === "Purchase") add(itc, 1);
      else if (v.type === "Debit Note") add(itc, -1);
    });
    ["txval", "iamt", "camt", "samt"].forEach(k => { out[k] = r2(out[k]); itc[k] = r2(itc[k]); });
    // utilization order: IGST credit -> IGST, CGST, SGST | CGST credit -> CGST, IGST | SGST credit -> SGST, IGST
    let ci = Math.max(0, itc.iamt), cc = Math.max(0, itc.camt), cs = Math.max(0, itc.samt);
    let pI = Math.max(0, out.iamt), pC = Math.max(0, out.camt), pS = Math.max(0, out.samt);
    const use = (credit, pay) => { const u = Math.min(credit, pay); return [credit - u, pay - u]; };
    [ci, pI] = use(ci, pI); [ci, pC] = use(ci, pC); [ci, pS] = use(ci, pS);
    [cc, pC] = use(cc, pC); [cc, pI] = use(cc, pI);
    [cs, pS] = use(cs, pS); [cs, pI] = use(cs, pI);
    return { out, itc, cash: { iamt: r2(pI), camt: r2(pC), samt: r2(pS) }, carry: { iamt: r2(ci), camt: r2(cc), samt: r2(cs) }, n: vs.length };
  }

  window.renderGstr3bScreen = function () {
    document.getElementById("screenTitle").textContent = "GSTR-3B Summary (Tax Payable & ITC)";
    document.getElementById("screenSub").textContent = "Mahine ke hisaab se | Esc: Back";
    const ym = currentMonth();
    const T = compute3B(ym);
    window.__gst3b = T;
    const opts = monthList().map(m => `<option value="${m}" ${m === ym ? "selected" : ""}>${monthLabel(m)}</option>`).join("");
    const f = (x) => "₹" + e(fmtINR(x));
    const row = (l, o, bold) => `<tr style="${bold ? "font-weight:800;background:#f1f5f9;" : ""}"><td>${l}</td><td class="num">${o.txval == null ? "" : f(o.txval)}</td><td class="num">${f(o.iamt)}</td><td class="num">${f(o.camt)}</td><td class="num">${f(o.samt)}</td></tr>`;
    const cash = T.cash, total = r2(cash.iamt + cash.camt + cash.samt);
    document.getElementById("screenBody").innerHTML = `
      <div class="form-card" style="display:flex;gap:10px;align-items:center;">
        <b>Mahina:</b> <select id="gstMonthSel3" style="padding:4px 8px;">${opts}</select><span style="flex:1;"></span>
        <button class="btn btn-sec" onclick="window.gst3bCsv()">📊 CSV</button>
      </div>
      <div class="form-card" style="padding:0;overflow:hidden;"><table class="tally-tbl">
        <thead><tr><th>Vivaran</th><th class="num">Taxable</th><th class="num">IGST</th><th class="num">CGST</th><th class="num">SGST</th></tr></thead><tbody>
        ${row("3.1(a) Outward taxable supplies (Sales − Credit Note)", T.out)}
        ${row("4(A)(5) ITC — all other (Purchase − Debit Note)", { iamt: T.itc.iamt, camt: T.itc.camt, samt: T.itc.samt, txval: null })}
        ${row("Cash me bharna hai (ITC ghatane ke baad)", { iamt: cash.iamt, camt: cash.camt, samt: cash.samt, txval: null }, true)}
        ${row("Aage ke liye bacha ITC", { iamt: T.carry.iamt, camt: T.carry.camt, samt: T.carry.samt, txval: null })}
        </tbody></table></div>
      <div class="form-card" style="text-align:center;background:#ecfdf5;border-color:var(--pri);">
        <div style="font-size:13px;font-weight:700;color:var(--pri-dark);">NET GST PAYABLE IN CASH (${monthLabel(ym)})</div>
        <div style="font-size:24px;font-weight:800;color:var(--pri);">${f(total)}</div></div>
      <div class="form-card" style="font-size:12px;color:#475569;">
        ℹ Is hisaab me <b>shamil nahi</b>: reverse charge, nil/exempt supplies, export, pichhle mahine ka bacha ITC, ITC ke niyam 42/43 jaise ulte-pulte (reversal), byaaj/late fee.
        Return bharne se pehle CA se milaan zaroor karein. Is mahine ${T.n} GST voucher gine gaye.</div>`;
    const sel = document.getElementById("gstMonthSel3");
    sel.onchange = () => { window.__gstMonth = sel.value; window.renderGstr3bScreen(); };
  };

  window.gst3bCsv = function () {
    const ym = currentMonth(), T = window.__gst3b || compute3B(ym);
    const L = [`GSTR-3B ${monthLabel(ym)} | GSTIN ${DB.company.gstin || "-"}`, "Vivaran,Taxable,IGST,CGST,SGST",
      `3.1(a) Outward taxable,${T.out.txval},${T.out.iamt},${T.out.camt},${T.out.samt}`,
      `4(A)(5) ITC all other,,${T.itc.iamt},${T.itc.camt},${T.itc.samt}`,
      `Cash payable,,${T.cash.iamt},${T.cash.camt},${T.cash.samt}`,
      `ITC carried forward,,${T.carry.iamt},${T.carry.camt},${T.carry.samt}`];
    download(`GSTR3B_${fpOf(ym)}.csv`, "\ufeff" + L.join("\r\n"), "text/csv;charset=utf-8");
    toast("📊 GSTR-3B CSV download ho gayi");
  };

  // --------------------------------------------------------------- B2CL seema theek (nayi entry par)
  const _calc = window.calculateInvoiceGST;
  if (typeof _calc === "function") {
    window.calculateInvoiceGST = function () {
      const r = _calc.apply(this, arguments);
      if (r && r.supply && !(r.supply.partyGstin && r.supply.partyReg !== "Unregistered" && r.supply.partyReg !== "Consumer")) {
        r.gstrCategory = (r.supply.isInter && r.netInvoice > B2CL_LIMIT) ? "B2CL" : "B2CS";
      }
      return r;
    };
  }

  window.__gstexport = { buildGstr1, toPortalJson, toCsv, compute3B, B2CL_LIMIT };
})();
