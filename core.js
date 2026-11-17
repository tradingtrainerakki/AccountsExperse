// ============================================================================
// CORE.JS: DB ENGINE, GST & ACCOUNTING CORE, F3 ENTITY MANAGER, GATEWAY, CLOUD
// ============================================================================

const GST_STATES = {
  "01":"Jammu & Kashmir","02":"Himachal Pradesh","03":"Punjab","04":"Chandigarh",
  "05":"Uttarakhand","06":"Haryana","07":"Delhi","08":"Rajasthan","09":"Uttar Pradesh",
  "10":"Bihar","11":"Sikkim","12":"Arunachal Pradesh","13":"Nagaland","14":"Manipur",
  "15":"Mizoram","16":"Tripura","17":"Meghalaya","18":"Assam","19":"West Bengal",
  "20":"Jharkhand","21":"Odisha","22":"Chhattisgarh","23":"Madhya Pradesh",
  "24":"Gujarat","26":"Dadra & Nagar Haveli and Daman & Diu","27":"Maharashtra",
  "29":"Karnataka","30":"Goa","31":"Lakshadweep","32":"Kerala","33":"Tamil Nadu",
  "34":"Puducherry","35":"Andaman & Nicobar Islands","36":"Telangana",
  "37":"Andhra Pradesh","38":"Ladakh"
};

const DEFAULT_GROUPS = [
  { name: "Capital Account", nature: "Liabilities", affectsGP: false },
  { name: "Reserves & Surplus", parent: "Capital Account", nature: "Liabilities", affectsGP: false },
  { name: "Current Assets", nature: "Assets", affectsGP: false },
  { name: "Bank Accounts", parent: "Current Assets", nature: "Assets", affectsGP: false },
  { name: "Cash-in-Hand", parent: "Current Assets", nature: "Assets", affectsGP: false },
  { name: "Deposits (Asset)", parent: "Current Assets", nature: "Assets", affectsGP: false },
  { name: "Loans & Advances (Asset)", parent: "Current Assets", nature: "Assets", affectsGP: false },
  { name: "Stock-in-Hand", parent: "Current Assets", nature: "Assets", affectsGP: true },
  { name: "Sundry Debtors", parent: "Current Assets", nature: "Assets", affectsGP: false },
  { name: "Current Liabilities", nature: "Liabilities", affectsGP: false },
  { name: "Duties & Taxes", parent: "Current Liabilities", nature: "Liabilities", affectsGP: false },
  { name: "Provisions", parent: "Current Liabilities", nature: "Liabilities", affectsGP: false },
  { name: "Sundry Creditors", parent: "Current Liabilities", nature: "Liabilities", affectsGP: false },
  { name: "Fixed Assets", nature: "Assets", affectsGP: false },
  { name: "Investments", nature: "Assets", affectsGP: false },
  { name: "Loans (Liability)", nature: "Liabilities", affectsGP: false },
  { name: "Bank OD A/c", parent: "Loans (Liability)", nature: "Liabilities", affectsGP: false },
  { name: "Secured Loans", parent: "Loans (Liability)", nature: "Liabilities", affectsGP: false },
  { name: "Unsecured Loans", parent: "Loans (Liability)", nature: "Liabilities", affectsGP: false },
  { name: "Suspense A/c", nature: "Liabilities", affectsGP: false },
  { name: "Misc. Expenses (ASSET)", nature: "Assets", affectsGP: false },
  { name: "Branch / Divisions", nature: "Liabilities", affectsGP: false },
  { name: "Sales Accounts", nature: "Income", affectsGP: true },
  { name: "Purchase Accounts", nature: "Expenses", affectsGP: true },
  { name: "Direct Incomes", nature: "Income", affectsGP: true },
  { name: "Direct Expenses", nature: "Expenses", affectsGP: true },
  { name: "Indirect Incomes", nature: "Income", affectsGP: false },
  { name: "Indirect Expenses", nature: "Expenses", affectsGP: false }
];

const DEFAULT_STOCK_GROUPS = [
  { id: "SG_RAW", name: "Raw Material", parent: "Primary", gstCategory: "Taxable", itcCategory: "Inputs", defaultHsn: "", defaultGst: 18, custom: false },
  { id: "SG_PACK", name: "Packing Material", parent: "Primary", gstCategory: "Taxable", itcCategory: "Inputs", defaultHsn: "4819", defaultGst: 18, custom: false },
  { id: "SG_FIN", name: "Finished Goods", parent: "Primary", gstCategory: "Taxable", itcCategory: "Inputs", defaultHsn: "", defaultGst: 18, custom: false },
  { id: "SG_SEMI", name: "Semi-Finished / WIP", parent: "Primary", gstCategory: "Taxable", itcCategory: "Inputs", defaultHsn: "", defaultGst: 18, custom: false },
  { id: "SG_CONS", name: "Consumables & Spares", parent: "Primary", gstCategory: "Taxable", itcCategory: "Inputs", defaultHsn: "", defaultGst: 18, custom: false },
  { id: "SG_CAP", name: "Capital Goods / Machinery", parent: "Primary", gstCategory: "Taxable", itcCategory: "Capital Goods", defaultHsn: "8479", defaultGst: 18, custom: false },
  { id: "SG_SCRAP", name: "Scrap / By-Products", parent: "Primary", gstCategory: "Taxable", itcCategory: "Inputs", defaultHsn: "7204", defaultGst: 18, custom: false },
  { id: "SG_EXEMPT", name: "Exempt / Agricultural Goods", parent: "Primary", gstCategory: "Exempt", itcCategory: "Ineligible", defaultHsn: "", defaultGst: 0, custom: false }
];

const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
const GST_SLABS = [0, 5, 12, 18, 28];
const UOM_LIST = ["NOS", "PCS", "KG", "GM", "LTR", "MTR", "SQFT", "BOX", "BAG", "SET", "TON"];

// ================= GLOBAL STATE =================
let ROLE = "viewer";
let CURRENT_SCREEN = "gateway";
let NAV_STACK = [];
let GW_INDEX = 0;
let CURRENT_ENTITY_ID = "DEFAULT_ENTITY";
window._GW_FOLDER = null;

let DB = {
  company: {
    name: "Shree Ganesh Traders Pvt. Ltd.",
    entityType: "Company",
    gstin: "05AABCS1429B1Z1",
    stateCode: "05",
    address: "Civil Lines, Roorkee, Uttarakhand",
    regType: "Regular",
    fyFrom: "2026-04-01",
    fyTo: "2027-03-31",
    curDate: "2026-10-21"
  },
  groups: [...DEFAULT_GROUPS],
  stockGroups: JSON.parse(JSON.stringify(DEFAULT_STOCK_GROUPS)),
  ledgers: [],
  items: [],
  vouchers: [],
  userRoles: []
};

// ================= COMMON UTILITIES =================
function uid(prefix = "ID") {
  return prefix + "_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 6);
}

function escHtml(t) {
  return String(t == null ? "" : t)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function toast(msg) {
  const el = document.getElementById("toastBox");
  if (!el) return;
  el.textContent = msg;
  el.style.display = "block";
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { el.style.display = "none"; }, 2600);
}

function fmtINR(n) {
  const num = Number(n) || 0;
  return num.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(iso) {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00");
  if (isNaN(d)) return iso;
  const m = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${String(d.getDate()).padStart(2, "0")}-${m[d.getMonth()]}-${d.getFullYear()}`;
}

function defaultFY() {
  const now = new Date();
  const yr = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  return { from: `${yr}-04-01`, to: `${yr + 1}-03-31` };
}

function getLedger(id) { return DB.ledgers.find(l => l.id === id) || null; }
function getLedgerName(id) { const l = getLedger(id); return l ? l.name : "(Unknown Ledger)"; }
function getGroupObj(name) { return DB.groups.find(g => g.name === name) || { name, nature: "Assets", affectsGP: false }; }
function getItem(id) { return DB.items.find(i => i.id === id) || null; }

function isTrustEntity() {
  const c = DB.company || {};
  const et = String(c.entityType || c.orgType || c.type || "").toLowerCase();
  if (et === "company" || et === "business") return false;
  if (et === "trust" || et === "ngo") return true;
  const n = String(c.name || "").toLowerCase();
  return n.includes("trust") || n.includes("ngo") || n.includes("samiti") || n.includes("foundation");
}

function ensureStockGroupsInitialized() {
  if (!Array.isArray(DB.stockGroups) || DB.stockGroups.length === 0) {
    DB.stockGroups = JSON.parse(JSON.stringify(DEFAULT_STOCK_GROUPS));
  }
  if (!Array.isArray(DB.items)) DB.items = [];
  DB.items.forEach(it => {
    if (!it.stockGroup) it.stockGroup = "Finished Goods";
    if (!it.gstCategory) it.gstCategory = "Taxable";
    if (!it.itcCategory) it.itcCategory = "Inputs";
    if (!Array.isArray(it.bom)) it.bom = [];
    if (typeof it.bomStdBatch !== "number" || it.bomStdBatch <= 0) it.bomStdBatch = 1;
  });
}

// ================= DB LOAD / SAVE =================
function seedDefaultMasters() {
  if (DB.ledgers.length > 0) return;
  const sc = DB.company.stateCode || "05";
  DB.ledgers = [
    { id: "L_CASH", name: "Cash", group: "Cash-in-Hand", opBal: 50000, opType: "Dr", gstin: "", stateCode: sc },
    { id: "L_BANK", name: "SBI Current A/c", group: "Bank Accounts", opBal: 250000, opType: "Dr", gstin: "", stateCode: sc },
    { id: "L_SALES_GST", name: "Sales GST Local/Inter", group: "Sales Accounts", opBal: 0, opType: "Cr", gstApplicable: true },
    { id: "L_PURC_GST", name: "Purchase GST Account", group: "Purchase Accounts", opBal: 0, opType: "Dr", gstApplicable: true },
    { id: "L_CGST_OUT", name: "Output CGST", group: "Duties & Taxes", taxType: "GST", taxHead: "CGST", opBal: 0, opType: "Cr" },
    { id: "L_SGST_OUT", name: "Output SGST", group: "Duties & Taxes", taxType: "GST", taxHead: "SGST", opBal: 0, opType: "Cr" },
    { id: "L_IGST_OUT", name: "Output IGST", group: "Duties & Taxes", taxType: "GST", taxHead: "IGST", opBal: 0, opType: "Cr" },
    { id: "L_CGST_IN", name: "Input CGST", group: "Duties & Taxes", taxType: "GST", taxHead: "CGST_IN", opBal: 0, opType: "Dr" },
    { id: "L_SGST_IN", name: "Input SGST", group: "Duties & Taxes", taxType: "GST", taxHead: "SGST_IN", opBal: 0, opType: "Dr" },
    { id: "L_IGST_IN", name: "Input IGST", group: "Duties & Taxes", taxType: "GST", taxHead: "IGST_IN", opBal: 0, opType: "Dr" },
    { id: "L_ROUNDOFF", name: "Round Off", group: "Indirect Expenses", opBal: 0, opType: "Dr" },
    { id: "L_PARTY_LOCAL", name: "Himalaya Enterprises (UK)", group: "Sundry Debtors", opBal: 0, opType: "Dr", gstin: "05AABCH1111K1Z5", stateCode: "05", regType: "Regular" },
    { id: "L_PARTY_INTER", name: "Delhi Metro Suppliers (DL)", group: "Sundry Creditors", opBal: 0, opType: "Cr", gstin: "07AABCD2222M1Z2", stateCode: "07", regType: "Regular" }
  ];
}

function loadDB(entityId = "DEFAULT_ENTITY") {
  CURRENT_ENTITY_ID = entityId;
  try {
    const raw = localStorage.getItem("TALLY_PRIME_GST_DB_" + CURRENT_ENTITY_ID);
    if (raw) {
      const parsed = JSON.parse(raw);
      DB = Object.assign({
        company: {},
        groups: [...DEFAULT_GROUPS],
        stockGroups: JSON.parse(JSON.stringify(DEFAULT_STOCK_GROUPS)),
        ledgers: [],
        items: [],
        vouchers: [],
        userRoles: []
      }, parsed);
      if (!Array.isArray(DB.groups) || !DB.groups.length) DB.groups = [...DEFAULT_GROUPS];
    } else {
      const fy = defaultFY();
      DB = {
        company: {
          name: CURRENT_ENTITY_ID === "DEFAULT_ENTITY" ? "Shree Ganesh Traders" : "Charitable Trust",
          entityType: "Company", gstin: "", stateCode: "05", address: "Roorkee",
          regType: "Regular", fyFrom: fy.from, fyTo: fy.to, curDate: new Date().toISOString().slice(0, 10)
        },
        groups: [...DEFAULT_GROUPS],
        stockGroups: JSON.parse(JSON.stringify(DEFAULT_STOCK_GROUPS)),
        ledgers: [], items: [], vouchers: [], userRoles: []
      };
      seedDefaultMasters();
    }
  } catch (e) { console.error("DB load failed:", e); }
  if (DB.company) DB.company.curDate = new Date().toISOString().slice(0, 10);
  ensureStockGroupsInitialized();
  refreshHeaderAndSidebar();
}

function saveDB() {
  const role = getCurrentUserRole();
  if (role === "blocked") {
    toast("🚫 Aapka access Admin dwara block kar diya gaya hai!");
    return;
  }
  if (role === "viewer") {
    toast("🔒 Read-Only Mode: Viewer sirf reports dekh aur print kar sakta hai!");
    return;
  }
  localStorage.setItem("TALLY_PRIME_GST_DB_" + CURRENT_ENTITY_ID, JSON.stringify(DB));
  refreshHeaderAndSidebar();
  toast("💾 Saved!");
}

function persistCurrentEntitySilently() {
  if (!canWriteData()) return;
  try { localStorage.setItem("TALLY_PRIME_GST_DB_" + CURRENT_ENTITY_ID, JSON.stringify(DB)); } catch (e) {}
}

function refreshHeaderAndSidebar() {
  const c = DB.company || {};
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  set("topCmpName", c.name || "AccountsExperse ERP");
  set("topPeriod", `${fmtDate(c.fyFrom)} to ${fmtDate(c.fyTo)}`);
  set("topCurDate", fmtDate(c.curDate));
  set("lpCmpName", c.name || "-");
  set("lpCmpGstin", c.gstin || "Unregistered");
  set("lpCmpState", `${c.stateCode || "05"} - ${GST_STATES[c.stateCode || "05"] || ""}`);
  set("lpCmpReg", c.regType || "Regular");
  set("lpVchCount", (DB.vouchers || []).length);
  computeQuickPulse();
}

// ================= ACCOUNTING & GST CALCULATION ENGINE =================
function validateGSTIN(gstin) {
  const clean = (gstin || "").trim().toUpperCase();
  if (!clean) return { valid: true, empty: true, stateCode: "", pan: "" };
  const isValid = GSTIN_REGEX.test(clean);
  const stateCode = clean.slice(0, 2);
  return {
    valid: isValid && Boolean(GST_STATES[stateCode]),
    empty: false, gstin: clean,
    stateCode: GST_STATES[stateCode] ? stateCode : "",
    stateName: GST_STATES[stateCode] || "Invalid State Code",
    pan: clean.slice(2, 12)
  };
}

function getSupplyNature(partyLedgerId, overrideStateCode = "") {
  const cmpState = DB.company.stateCode || "05";
  let posState = cmpState, partyReg = "Unregistered", partyGstin = "";
  const p = getLedger(partyLedgerId);
  if (p) {
    posState = p.stateCode || cmpState;
    partyReg = p.regType || (p.gstin ? "Regular" : "Unregistered");
    partyGstin = p.gstin || "";
  }
  if (overrideStateCode && GST_STATES[overrideStateCode]) posState = overrideStateCode;
  const isInter = posState !== cmpState;
  return { cmpState, posState, posStateName: GST_STATES[posState] || "", isInter, supplyType: isInter ? "INTER" : "INTRA", partyReg, partyGstin };
}

function calculateInvoiceGST(lines, partyLedgerId, applyRoundOff = true, overridePos = "") {
  const supply = getSupplyNature(partyLedgerId, overridePos);
  let totalTaxable = 0, totalCGST = 0, totalSGST = 0, totalIGST = 0;
  const hsnMap = {};

  const computedLines = (lines || []).map(ln => {
    const qty = Number(ln.qty) || 0, rate = Number(ln.rate) || 0;
    const discPct = Number(ln.discPct) || 0, gstRate = Number(ln.gstRate) || 0;
    const gross = qty * rate;
    const discAmt = +(gross * (discPct / 100)).toFixed(2);
    const taxable = +(gross - discAmt).toFixed(2);

    let cgstRate = 0, sgstRate = 0, igstRate = 0, cgstAmt = 0, sgstAmt = 0, igstAmt = 0;
    if (supply.isInter) {
      igstRate = gstRate;
      igstAmt = +(taxable * (igstRate / 100)).toFixed(2);
    } else {
      cgstRate = +(gstRate / 2).toFixed(2);
      sgstRate = +(gstRate / 2).toFixed(2);
      cgstAmt = +(taxable * (cgstRate / 100)).toFixed(2);
      sgstAmt = +(taxable * (sgstRate / 100)).toFixed(2);
    }
    const lineTotal = +(taxable + cgstAmt + sgstAmt + igstAmt).toFixed(2);

    totalTaxable = +(totalTaxable + taxable).toFixed(2);
    totalCGST = +(totalCGST + cgstAmt).toFixed(2);
    totalSGST = +(totalSGST + sgstAmt).toFixed(2);
    totalIGST = +(totalIGST + igstAmt).toFixed(2);

    const hsnKey = (ln.hsn || "NA") + "_" + gstRate;
    if (!hsnMap[hsnKey]) hsnMap[hsnKey] = { hsn: ln.hsn || "NA", uom: ln.uom || "NOS", gstRate, qty: 0, taxable: 0, cgst: 0, sgst: 0, igst: 0 };
    hsnMap[hsnKey].qty = +(hsnMap[hsnKey].qty + qty).toFixed(3);
    hsnMap[hsnKey].taxable = +(hsnMap[hsnKey].taxable + taxable).toFixed(2);
    hsnMap[hsnKey].cgst = +(hsnMap[hsnKey].cgst + cgstAmt).toFixed(2);
    hsnMap[hsnKey].sgst = +(hsnMap[hsnKey].sgst + sgstAmt).toFixed(2);
    hsnMap[hsnKey].igst = +(hsnMap[hsnKey].igst + igstAmt).toFixed(2);

    return { ...ln, qty, rate, discPct, discAmt, taxable, gstRate, cgstRate, sgstRate, igstRate, cgstAmt, sgstAmt, igstAmt, lineTotal };
  });

  const totalTax = +(totalCGST + totalSGST + totalIGST).toFixed(2);
  const grossInvoice = +(totalTaxable + totalTax).toFixed(2);
  const netInvoice = applyRoundOff ? Math.round(grossInvoice) : grossInvoice;
  const roundOff = +(netInvoice - grossInvoice).toFixed(2);

  let gstrCategory = "B2CS";
  if (supply.partyGstin && supply.partyReg !== "Unregistered" && supply.partyReg !== "Consumer") gstrCategory = "B2B";
  else if (supply.isInter && netInvoice > 250000) gstrCategory = "B2CL";

  return { supply, gstrCategory, lines: computedLines, hsnSummary: Object.values(hsnMap), totalTaxable, totalCGST, totalSGST, totalIGST, totalTax, grossInvoice, roundOff, netInvoice };
}

function getVoucherEntries(v) {
  if (Array.isArray(v.entries) && v.entries.length > 0) {
    return v.entries.map(e => ({ ledgerId: e.ledgerId, type: e.type, amount: +(Number(e.amount) || 0).toFixed(2) })).filter(e => e.ledgerId && e.amount > 0);
  }
  const amt = +(Number(v.amount) || 0).toFixed(2), out = [];
  if (v.drLedgerId && amt > 0) out.push({ ledgerId: v.drLedgerId, type: "Dr", amount: amt });
  if (v.crLedgerId && amt > 0) out.push({ ledgerId: v.crLedgerId, type: "Cr", amount: amt });
  return out;
}

function isVoucherInPeriod(v, fromDate = DB.company.fyFrom, toDate = DB.company.fyTo) {
  if (!v || !v.date) return true;
  if (fromDate && v.date < fromDate) return false;
  if (toDate && v.date > toDate) return false;
  return true;
}

function computeAllLedgerBalances(fromDate = DB.company.fyFrom, toDate = DB.company.fyTo) {
  const map = {};
  (DB.ledgers || []).forEach(l => {
    const op = Number(l.opBal) || 0;
    map[l.id] = {
      ledger: l,
      opDr: l.opType === "Dr" ? op : 0,
      opCr: l.opType === "Cr" ? op : 0,
      curDr: 0, curCr: 0, closeDr: 0, closeCr: 0, netSigned: 0, closeBal: 0, closeType: "Dr"
    };
  });

  (DB.vouchers || []).forEach(v => {
    if (!v || !v.date || (toDate && v.date > toDate)) return;
    const beforePeriod = fromDate && v.date < fromDate;
    getVoucherEntries(v).forEach(en => {
      const row = map[en.ledgerId];
      if (!row) return;
      if (beforePeriod) {
        if (en.type === "Dr") row.opDr = +(row.opDr + en.amount).toFixed(2);
        else row.opCr = +(row.opCr + en.amount).toFixed(2);
      } else {
        if (en.type === "Dr") row.curDr = +(row.curDr + en.amount).toFixed(2);
        else row.curCr = +(row.curCr + en.amount).toFixed(2);
      }
    });
  });

  Object.values(map).forEach(row => {
    const netOp = +(row.opDr - row.opCr).toFixed(2);
    row.opDr = netOp > 0 ? netOp : 0;
    row.opCr = netOp < 0 ? Math.abs(netOp) : 0;
    const net = +(netOp + row.curDr - row.curCr).toFixed(2);
    row.netSigned = net;
    row.closeDr = net > 0 ? net : 0;
    row.closeCr = net < 0 ? Math.abs(net) : 0;
    row.closeBal = Math.abs(net);
    row.closeType = net >= 0 ? "Dr" : "Cr";
  });
  return map;
}

function getLedgerClosingString(ledgerId) {
  const b = computeAllLedgerBalances()[ledgerId];
  return (!b || b.closeBal === 0) ? "₹0.00" : `₹${fmtINR(b.closeBal)} ${b.closeType}`;
}

function computeQuickPulse() {
  const balMap = computeAllLedgerBalances();
  let cashBank = 0, totalSales = 0, totalPurc = 0, gstOut = 0, gstIn = 0;
  Object.values(balMap).forEach(b => {
    const grp = b.ledger.group;
    if (grp === "Cash-in-Hand" || grp === "Bank Accounts") cashBank += b.netSigned;
    else if (grp === "Sales Accounts") totalSales += (b.curCr - b.curDr);
    else if (grp === "Purchase Accounts") totalPurc += (b.curDr - b.curCr);
    else if (grp === "Duties & Taxes") {
      if (b.netSigned < 0) gstOut += Math.abs(b.netSigned);
      else gstIn += b.netSigned;
    }
  });
  const netGst = +(gstOut - gstIn).toFixed(2);
  const elCash = document.getElementById("lpCashBal");
  const elSales = document.getElementById("lpSalesTot");
  const elPurc = document.getElementById("lpPurcTot");
  const elGst = document.getElementById("lpGstNet");
  if (elCash) elCash.textContent = `₹${fmtINR(Math.abs(cashBank))} ${cashBank >= 0 ? "Dr" : "Cr"}`;
  if (elSales) elSales.textContent = `₹${fmtINR(Math.max(0, totalSales))}`;
  if (elPurc) elPurc.textContent = `₹${fmtINR(Math.max(0, totalPurc))}`;
  if (elGst) {
    elGst.textContent = netGst >= 0 ? `₹${fmtINR(netGst)} Payable` : `₹${fmtINR(Math.abs(netGst))} ITC Cr`;
    elGst.style.color = netGst > 0 ? "var(--danger)" : "var(--ok)";
  }
}

function computeInventoryStockSummary() {
  const stockMap = {};
  (DB.items || []).forEach(it => {
    const opQty = Number(it.opQty) || 0;
    const opRate = Number(it.opRate) || Number(it.rate) || 0;
    stockMap[it.id] = { item: it, opQty, opVal: +(opQty * opRate).toFixed(2), inQty: 0, inVal: 0, outQty: 0, outVal: 0, closeQty: opQty, closeVal: 0, avgRate: opRate };
  });

  (DB.vouchers || []).forEach(v => {
    if (!Array.isArray(v.itemLines) || !v.itemLines.length) return;
    v.itemLines.forEach(ln => {
      const st = stockMap[ln.itemId];
      if (!st) return;
      const qty = Number(ln.qty) || 0;
      const val = Number(ln.taxable) || (qty * (Number(ln.rate) || 0));
      if (["Purchase", "Receipt Note", "Credit Note"].includes(v.type)) {
        st.inQty = +(st.inQty + qty).toFixed(3);
        st.inVal = +(st.inVal + val).toFixed(2);
      } else if (["Sales", "Delivery Note", "Debit Note"].includes(v.type)) {
        st.outQty = +(st.outQty + qty).toFixed(3);
        st.outVal = +(st.outVal + val).toFixed(2);
      } else if (v.type === "Stock Journal") {
        if (qty >= 0) { st.inQty = +(st.inQty + qty).toFixed(3); st.inVal = +(st.inVal + Math.abs(val)).toFixed(2); }
        else { st.outQty = +(st.outQty + Math.abs(qty)).toFixed(3); st.outVal = +(st.outVal + Math.abs(val)).toFixed(2); }
      } else if (v.type === "Physical Stock") {
        const diff = qty - (st.opQty + st.inQty - st.outQty);
        if (diff >= 0) st.inQty = +(st.inQty + diff).toFixed(3);
        else st.outQty = +(st.outQty + Math.abs(diff)).toFixed(3);
      }
    });
  });

  Object.values(stockMap).forEach(st => {
    st.closeQty = +(st.opQty + st.inQty - st.outQty).toFixed(3);
    const avgRate = (st.opQty + st.inQty) > 0 ? ((st.opVal + st.inVal) / (st.opQty + st.inQty)) : (Number(st.item.opRate) || Number(st.item.rate) || 0);
    st.avgRate = +avgRate.toFixed(2);
    st.closeVal = +(st.closeQty * avgRate).toFixed(2);
  });
  return stockMap;
}

// ================= MODALS & STANDARD POPUPS =================
function showModal(title, bodyHtml, footHtml) {
  if (/Users\s*&\s*Role\s*Manager/i.test(String(title || "")) && !isSuperAdmin()) {
    toast("🚫 Security Lock: Sirf Master Admin hi Users manage kar sakta hai!");
    return;
  }
  document.getElementById("modalTitle").textContent = title;
  document.getElementById("modalBody").innerHTML = bodyHtml;
  document.getElementById("modalFoot").innerHTML = footHtml || "";
  document.getElementById("appModal").classList.add("open");
  setTimeout(() => {
    const first = document.querySelector("#modalBody input:not([type='hidden']), #modalBody select, #modalBody button, #modalFoot button");
    if (first) first.focus();
  }, 40);
}

function closeModal() {
  document.getElementById("appModal").classList.remove("open");
}

function kbOverlayOpen() {
  return document.getElementById("appModal").classList.contains("open");
}

function openDateModal() {
  const curVal = (CURRENT_SCREEN === "voucher_entry" && typeof VCH_STATE !== "undefined" && VCH_STATE.date)
    ? VCH_STATE.date
    : DB.company.curDate;
  const body = `<div class="field"><label>Voucher / Current Date (F2)</label><input type="date" id="curDateInp" value="${curVal}"></div>`;
  const foot = `<button class="btn btn-sec" onclick="closeModal()">Cancel</button><button class="btn" onclick="applyF2VoucherDate()">Apply (Enter)</button>`;
  showModal("Change Date (F2)", body, foot);
}

function applyF2VoucherDate() {
  const val = document.getElementById("curDateInp")?.value;
  if (!val) return;
  DB.company.curDate = val;
  if (CURRENT_SCREEN === "voucher_entry" && typeof VCH_STATE !== "undefined") {
    VCH_STATE.date = val;
    const inp = document.getElementById("vchDateInp");
    if (inp) inp.value = val;
  }
  saveDB();
  closeModal();
  toast("📅 Date Updated: " + fmtDate(val));
}

function openPeriodModal() {
  const body = `
    <div class="form-grid">
      <div class="field"><label>From Date</label><input type="date" id="fyFromInp" value="${DB.company.fyFrom}"></div>
      <div class="field"><label>To Date</label><input type="date" id="fyToInp" value="${DB.company.fyTo}"></div>
    </div>`;
  const foot = `<button class="btn btn-sec" onclick="closeModal()">Cancel</button><button class="btn" onclick="DB.company.fyFrom=document.getElementById('fyFromInp').value; DB.company.fyTo=document.getElementById('fyToInp').value; saveDB(); closeModal(); renderScreen(CURRENT_SCREEN); toast('📅 Period Updated');">Apply Period</button>`;
  showModal("Change Financial Period (Alt+F2)", body, foot);
}

function openHelpModal() {
  const body = `
    <div style="line-height:1.85; font-size:13px;">
      <div><b>F2 / Alt+F2:</b> Date / Period Filter</div>
      <div><b>F3:</b> Company / Trust Manager (Create, Select, Alter, Delete)</div>
      <div><b>C, Y, R, J, S, P, K, D:</b> Contra, Payment, Receipt, Journal, Sales, Purchase, Cr/Dr Note</div>
      <div><b>Alt+D / Alt+L / Alt+U:</b> Day Book / Ledger View / Group Summary</div>
      <div><b>Alt+R / Alt+O / Alt+S / Alt+M:</b> Reconciliation / Outstanding / Stock Summary / BOM Prod</div>
      <div><b>Alt+C:</b> Create Ledger On-the-Spot &nbsp;|&nbsp; <b>Ctrl+A:</b> Save &nbsp;|&nbsp; <b>Alt+P:</b> Print</div>
      <div><b>↑ ↓ + Enter / Esc:</b> Navigate, Open &amp; Go Back across all screens</div>
    </div>`;
  showModal("❓ AccountsExperse Keyboard Shortcuts", body, `<button class="btn" onclick="closeModal()">Close (Esc)</button>`);
}

// ================= GATEWAY 5-FOLDER SYSTEM & ROUTER =================
const FOLDER_DEFS = [
  { id: "MASTERS",      title: "📁 Create / Alter / View (Masters)", hk: "C" },
  { id: "TRANSACTIONS", title: "💸 Transactions (Vouchers)",         hk: "T" },
  { id: "INVENTORY",    title: "📦 Inventory (Stock & BOM)",         hk: "I" },
  { id: "ACC_REPORTS",  title: "📊 Accounting Reports",              hk: "A" },
  { id: "STAT_REPORTS", title: "🏛️ GST & Statutory Reports",        hk: "S" }
];

function getFolderItems(folderId) {
  const trust = isTrustEntity();
  if (folderId === "MASTERS") {
    return [
      { label: "👁️ View All (Groups & Ledgers)", hk: "W", screen: "masters_view" },
      { label: "Create / Alter Ledgers", hk: "L", screen: "masters_ledger" },
      { label: "Chart of Accounts (Groups)", hk: "G", screen: "masters_groups" }
    ];
  }
  if (folderId === "TRANSACTIONS") {
    return [
      { label: "Vouchers Entry (Contra, Payment, Receipt, Sales...)", hk: "V", screen: "voucher_entry" },
      { label: "Day Book / All Transactions", hk: "D", screen: "daybook" }
    ];
  }
  if (folderId === "INVENTORY") {
    return [
      { label: "Stock Items & HSN Master", hk: "I", screen: "masters_item" },
      { label: "Stock Groups (Raw, Packing, Finished & GST)", hk: "K", screen: "masters_stock_groups" },
      { label: "Stock Summary & Inventory Vouchers", hk: "S", screen: "stock_summary" },
      { label: "BOM Manufacturing (Raw+Packing → Finished)", hk: "M", screen: "bom_production" }
    ];
  }
  if (folderId === "ACC_REPORTS") {
    return [
      { label: "Ledger Account (By Head)", hk: "A", action: () => launchDirectLedgerPicker("ledger_view") },
      { label: "Group Summary (Group → Ledgers → Vouchers)", hk: "U", action: () => openGroupSummary() },
      { label: "Account Reconciliation (Bank / Party)", hk: "R", action: () => launchDirectLedgerPicker("recon") },
      { label: "Trial Balance", hk: "T", screen: "trial_balance" },
      { label: trust ? "Income & Expenditure A/c" : "Profit & Loss A/c", hk: "P", screen: "pnl_report" },
      { label: trust ? "Balance Sheet (Corpus Fund)" : "Balance Sheet", hk: "B", screen: "balance_sheet" },
      { label: "Outstanding (Receivables / Payables)", hk: "O", screen: "outstanding" }
    ];
  }
  if (folderId === "STAT_REPORTS") {
    return [
      { label: "GSTR-1 (Outward Supplies & JSON)", hk: "1", screen: "gstr1" },
      { label: "GSTR-3B (Tax & ITC Summary)", hk: "3", screen: "gstr3b" }
    ];
  }
  return [];
}

function getActiveGatewayList() {
  return window._GW_FOLDER ? getFolderItems(window._GW_FOLDER) : FOLDER_DEFS;
}

function openGwCategory(folderId) {
  window._GW_FOLDER = folderId;
  GW_INDEX = 0;
  renderGateway();
}

function triggerGwRow(idx) {
  const list = getActiveGatewayList();
  const item = list[idx];
  if (!item) return;
  if (!window._GW_FOLDER) { openGwCategory(item.id); return; }
  if (typeof item.action === "function") item.action();
  else if (item.screen) navigate(item.screen);
}

function renderGateway() {
  document.getElementById("screenTitle").textContent = "Gateway of AccountsExperse";
  document.getElementById("screenSub").textContent = "Use ↑ ↓ + Enter or Hotkey | Esc: Back / Quit";
  const list = getActiveGatewayList();
  if (GW_INDEX >= list.length) GW_INDEX = 0;

  const fObj = FOLDER_DEFS.find(x => x.id === window._GW_FOLDER);
  const headHtml = !window._GW_FOLDER
    ? `<div class="gateway-title">Gateway of AccountsExperse</div>`
    : `<div class="gw-sec"><span>${fObj ? fObj.title : ""}</span><button class="btn btn-sec" style="padding:2px 8px; font-size:11px;" onclick="openGwCategory(null)">⬅ Back (Esc)</button></div>`;

  const rowsHtml = list.map((m, i) => `
    <div class="gw-item ${i === GW_INDEX ? "active" : ""}" onclick="GW_INDEX=${i}; triggerGwRow(${i})">
      <span>${m.label || m.title}</span>
      <span class="kbd">${m.hk}</span>
    </div>
  `).join("");

  document.getElementById("screenBody").innerHTML = `<div class="gateway-wrap"><div class="gateway-box">${headHtml}${rowsHtml}</div></div>`;
}

function navigate(screen, pushHistory = true) {
  if (pushHistory && CURRENT_SCREEN !== screen) NAV_STACK.push(CURRENT_SCREEN);
  CURRENT_SCREEN = screen;
  renderScreen(screen);
}

function goBack() {
  if (kbOverlayOpen()) { closeModal(); return; }
  if (CURRENT_SCREEN === "balance_sheet" && window._BS_ACTIVE_GROUP_DRILL) {
    window._BS_ACTIVE_GROUP_DRILL = null;
    renderBalanceSheetScreen();
    return;
  }
  if (CURRENT_SCREEN === "gateway") {
    if (window._GW_FOLDER) openGwCategory(null);
    return;
  }
  const prev = NAV_STACK.pop() || "gateway";
  CURRENT_SCREEN = prev;
  renderScreen(prev);
}

function renderScreen(screen) {
  closeModal();
  const routes = {
    gateway: renderGateway,
    masters_view: () => window.renderMastersViewScreen && renderMastersViewScreen(),
    masters_ledger: () => window.renderLedgerMastersScreen && renderLedgerMastersScreen(),
    masters_groups: () => window.renderGroupsScreen && renderGroupsScreen(),
    masters_item: () => window.renderItemMastersScreen && renderItemMastersScreen(),
    masters_stock_groups: () => window.renderStockGroupsScreen && renderStockGroupsScreen(),
    voucher_entry: () => window.renderVoucherEntryScreen && renderVoucherEntryScreen(),
    bom_production: () => window.renderBomProductionScreen && renderBomProductionScreen(),
    daybook: () => window.renderDayBookScreen && renderDayBookScreen(),
    ledgers_view: () => window.renderLedgersViewScreen && renderLedgersViewScreen(),
    group_summary: () => window.renderGroupSummaryScreen && renderGroupSummaryScreen(),
    bank_recon: () => window.drawSleekReconView && drawSleekReconView(),
    trial_balance: () => window.renderTrialBalanceScreen && renderTrialBalanceScreen(),
    pnl_report: () => window.renderPnlScreen && renderPnlScreen(),
    balance_sheet: () => window.renderBalanceSheetScreen && renderBalanceSheetScreen(),
    outstanding: () => window.renderOutstandingScreen && renderOutstandingScreen(),
    stock_summary: () => window.renderStockSummaryScreen && renderStockSummaryScreen(),
    gstr1: () => window.renderGstr1Screen && renderGstr1Screen(),
    gstr3b: () => window.renderGstr3bScreen && renderGstr3bScreen()
  };
  (routes[screen] || renderGateway)();
}

// ================= MULTI-ENTITY MANAGER (F3) & BACKUP / RESTORE =================
const DELETED_ENT_KEY = "TALLY_PRIME_DELETED_ENTITIES";
function getDeletedEntities() { try { return JSON.parse(localStorage.getItem(DELETED_ENT_KEY) || "[]"); } catch { return []; } }

function getSavedEntitiesList() {
  const list = getDeletedEntities().includes("DEFAULT_ENTITY") ? [] : ["DEFAULT_ENTITY"];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith("TALLY_PRIME_GST_DB_")) {
      const id = key.replace("TALLY_PRIME_GST_DB_", "");
      if (!list.includes(id)) list.push(id);
    }
  }
  return list;
}

function getEntityData(ent) {
  if (ent === CURRENT_ENTITY_ID) return DB;
  try { const raw = localStorage.getItem("TALLY_PRIME_GST_DB_" + ent); return raw ? JSON.parse(raw) : null; } catch { return null; }
}

function entityLabel(ent) {
  const d = getEntityData(ent), c = (d && d.company) || {};
  return { name: c.name || (ent === "DEFAULT_ENTITY" ? "Shree Ganesh Traders" : ent), type: c.entityType || "Company" };
}

function entityNameExists(name, exceptId) {
  const n = (name || "").trim().toLowerCase();
  return getSavedEntitiesList().some(ent => ent !== exceptId && entityLabel(ent).name.trim().toLowerCase() === n);
}

function autoDetectStateFromGstin(gstin, selectId) {
  const code = (gstin || "").trim().toUpperCase().slice(0, 2);
  if (GST_STATES[code]) { const sel = document.getElementById(selectId); if (sel) sel.value = code; }
}

function entityDetailsFormHtml(p, c, type) {
  const v = k => escHtml(c[k] || "");
  const isTrust = type === "Trust";
  const stateOpts = Object.entries(GST_STATES).map(([code, nm]) => `<option value="${code}" ${(c.stateCode || "05") === code ? "selected" : ""}>${code} - ${nm}</option>`).join("");
  const reg = c.regType || "Unregistered";
  return `
    <div class="form-grid">
      <div class="field" style="grid-column:1/-1;">
        <label>Organization Type *</label>
        <select id="${p}EntityTypeInp">
          <option value="Company" ${!isTrust ? "selected" : ""}>🏢 Company / Regular Business</option>
          <option value="Trust" ${isTrust ? "selected" : ""}>🏛️ Trust / NGO / Section-8</option>
        </select>
      </div>
      <div class="field" style="grid-column:1/-1;"><label>Name *</label><input id="${p}NameInp" value="${v("name")}" placeholder="Company or Trust Name"></div>
      <div class="field" style="grid-column:1/-1;"><label>Address</label><input id="${p}AddrInp" value="${v("address")}"></div>
      <div class="field"><label>State</label><select id="${p}StateInp">${stateOpts}</select></div>
      <div class="field"><label>Registration Type</label>
        <select id="${p}RegInp">
          <option ${reg === "Regular" ? "selected" : ""}>Regular</option>
          <option ${reg === "Composition" ? "selected" : ""}>Composition</option>
          <option ${reg === "Unregistered" ? "selected" : ""}>Unregistered</option>
        </select>
      </div>
      <div class="field"><label>GSTIN (15 Digits)</label><input id="${p}GstinInp" value="${v("gstin")}" maxlength="15" oninput="autoDetectStateFromGstin(this.value,'${p}StateInp')"></div>
      <div class="field"><label>PAN</label><input id="${p}PanInp" value="${v("pan")}" maxlength="10"></div>
      <div class="field"><label>FY From *</label><input type="date" id="${p}FyFromInp" value="${v("fyFrom")}"></div>
      <div class="field"><label>FY To *</label><input type="date" id="${p}FyToInp" value="${v("fyTo")}"></div>
    </div>`;
}

function readEntityDetails(p) {
  const g = id => { const e = document.getElementById(p + id + "Inp"); return e ? e.value.trim() : ""; };
  return {
    entityType: g("EntityType") || "Company", name: g("Name"), address: g("Addr"),
    stateCode: g("State") || "05", regType: g("Reg") || "Unregistered",
    gstin: g("Gstin").toUpperCase(), pan: g("Pan").toUpperCase(),
    fyFrom: g("FyFrom"), fyTo: g("FyTo")
  };
}

function openEntitySwitcherModal() {
  const listHtml = getSavedEntitiesList().map(ent => {
    const lb = entityLabel(ent), isActive = ent === CURRENT_ENTITY_ID;
    return `
      <div style="display:flex; justify-content:space-between; align-items:center; padding:8px; border-bottom:1px solid #e2e8f0; background:${isActive ? "#ecfdf5" : "#fff"};">
        <div><b>${escHtml(lb.name)}</b> <span class="kbd">${escHtml(lb.type)}</span></div>
        <div style="display:flex; gap:6px; align-items:center;">
          ${isActive ? '<span style="color:var(--ok);font-weight:700;">Active ✔</span>' : `<button class="btn" style="padding:2px 8px;font-size:11px;" onclick="switchEntity('${ent}')">Select</button>`}
          ${isSuperAdmin() ? `<button class="btn btn-danger" style="padding:2px 8px;font-size:11px;" onclick="openDeleteEntityModal('${ent}')">Delete</button>` : ""}
        </div>
      </div>`;
  }).join("");
  const foot = `
    <button class="btn btn-sec" onclick="closeModal()">Cancel (Esc)</button>
    ${canWriteData() ? `<button class="btn btn-sec" onclick="openCompanyAlterModal()">Alter Current</button>` : ""}
    ${isSuperAdmin() ? `<button class="btn btn-sec" onclick="openRestoreModal()">📤 Restore</button><button class="btn" onclick="openCreateEntityModal()">➕ Create New</button>` : ""}`;
  showModal("Company / Trust Manager (F3)", `<div style="max-height:300px;overflow-y:auto;border:1px solid var(--border);border-radius:3px;">${listHtml}</div>`, foot);
}

function openCreateEntityModal() {
  if (!isSuperAdmin()) { toast("🚫 Sirf Admin nayi Company/Trust bana sakta hai!"); return; }
  const fy = defaultFY();
  const body = entityDetailsFormHtml("ent", { stateCode: "05", regType: "Unregistered", fyFrom: fy.from, fyTo: fy.to }, "Company");
  const foot = `<button class="btn btn-sec" onclick="openEntitySwitcherModal()">← Back</button><button class="btn" onclick="createNewEntity()">Create &amp; Switch</button>`;
  showModal("Create New Company / Trust", body, foot);
}

function createNewEntity() {
  if (!isSuperAdmin()) return;
  const d = readEntityDetails("ent");
  if (!d.name || !d.fyFrom || !d.fyTo) { toast("⚠ Name aur Financial Year dalein!"); return; }
  if (entityNameExists(d.name, null)) { toast("⚠ Is naam ki entity pehle se hai!"); return; }
  persistCurrentEntitySilently();
  const newId = "ENT_" + Date.now().toString(36);
  CURRENT_ENTITY_ID = newId;
  DB = {
    company: Object.assign({ curDate: new Date().toISOString().slice(0, 10) }, d),
    groups: [...DEFAULT_GROUPS],
    stockGroups: JSON.parse(JSON.stringify(DEFAULT_STOCK_GROUPS)),
    ledgers: [], items: [], vouchers: [], userRoles: []
  };
  seedDefaultMasters();
  if (d.entityType === "Trust") {
    DB.ledgers.push(
      { id: "L_T_CORPUS", name: "Corpus Fund", group: "Capital Account", opBal: 0, opType: "Cr" },
      { id: "L_T_DONATION", name: "Donations Received", group: "Indirect Incomes", opBal: 0, opType: "Cr" },
      { id: "L_T_PROGRAM", name: "Programme Expenses", group: "Indirect Expenses", opBal: 0, opType: "Dr" }
    );
  }
  saveDB();
  localStorage.setItem("TALLY_PRIME_LAST_ENTITY", newId);
  closeModal(); navigate("gateway", false);
  toast(`✅ "${d.name}" Created!`);
}

function switchEntity(entId) {
  persistCurrentEntitySilently();
  loadDB(entId);
  localStorage.setItem("TALLY_PRIME_LAST_ENTITY", entId);
  syncUserRolesStorage();
  window.applyUserBadge && window.applyUserBadge();
  closeModal(); navigate("gateway", false);
  toast(`🏢 Active: ${DB.company.name}`);
}

function openDeleteEntityModal(ent) {
  if (!isSuperAdmin()) return;
  if (getSavedEntitiesList().length <= 1) { toast("⚠ Kam se kam 1 Company/Trust rehni zaroori hai!"); return; }
  const lb = entityLabel(ent);
  const body = `<p style="margin-bottom:10px;"><b>"${escHtml(lb.name)}"</b> ko delete karne ke liye naam type karein:</p><input id="delConfirmInp" style="width:100%;padding:7px;" placeholder="${escHtml(lb.name)}">`;
  const foot = `<button class="btn btn-sec" onclick="openEntitySwitcherModal()">← Back</button><button class="btn btn-danger" onclick="confirmDeleteEntity('${ent}')">Delete Permanently</button>`;
  showModal("Delete Company / Trust", body, foot);
}

function confirmDeleteEntity(ent) {
  if (!isSuperAdmin()) return;
  const lb = entityLabel(ent);
  if ((document.getElementById("delConfirmInp").value || "").trim().toLowerCase() !== lb.name.trim().toLowerCase()) {
    toast("⚠ Naam match nahi hua!"); return;
  }
  const list = getSavedEntitiesList();
  if (ent === CURRENT_ENTITY_ID) loadDB(list.find(e => e !== ent));
  localStorage.removeItem("TALLY_PRIME_GST_DB_" + ent);
  if (ent === "DEFAULT_ENTITY") {
    const del = getDeletedEntities();
    if (!del.includes(ent)) { del.push(ent); localStorage.setItem(DELETED_ENT_KEY, JSON.stringify(del)); }
  }
  localStorage.setItem("TALLY_PRIME_LAST_ENTITY", CURRENT_ENTITY_ID);
  navigate("gateway", false); openEntitySwitcherModal();
  toast(`🗑️ "${lb.name}" Deleted`);
}

function exportBackupJSON() {
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(DB, null, 2));
  const a = document.createElement("a");
  a.href = dataStr;
  a.download = `backup_${(DB.company.name || "tally").replace(/[^A-Za-z0-9]+/g, "_")}_${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  toast("📥 Backup Downloaded!");
}

let RESTORE_DATA = null;
function openRestoreModal() {
  if (!isSuperAdmin()) { toast("🚫 Sirf Admin backup restore kar sakta hai!"); return; }
  RESTORE_DATA = null;
  const body = `
    <div class="field"><label>Select Backup (.json)</label><input type="file" accept=".json" onchange="restoreFileChosen(this)"></div>
    <div id="restorePreview" style="margin-top:10px;font-size:12.5px;color:var(--muted);">Backup file chunein...</div>`;
  const foot = `
    <button class="btn btn-sec" onclick="closeModal()">Cancel</button>
    <button class="btn btn-sec" id="restoreReplaceBtn" disabled onclick="applyRestore('replace')">Replace Current</button>
    <button class="btn" id="restoreNewBtn" disabled onclick="applyRestore('new')">Restore as New</button>`;
  showModal("Restore Backup", body, foot);
}

function restoreFileChosen(inp) {
  const f = inp.files && inp.files[0]; if (!f) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(String(reader.result || ""));
      if (!data.company || !Array.isArray(data.ledgers) || !Array.isArray(data.vouchers)) throw new Error();
      RESTORE_DATA = data;
      document.getElementById("restorePreview").innerHTML = `✔ <b>${escHtml(data.company.name)}</b> | Vouchers: <b>${data.vouchers.length}</b> | Ledgers: <b>${data.ledgers.length}</b>`;
      document.getElementById("restoreNewBtn").disabled = false;
      document.getElementById("restoreReplaceBtn").disabled = false;
    } catch {
      document.getElementById("restorePreview").innerHTML = `<span style="color:var(--danger);">⚠ Invalid JSON backup file</span>`;
    }
  };
  reader.readAsText(f);
}

function applyRestore(mode) {
  if (!RESTORE_DATA || !isSuperAdmin()) return;
  const R = RESTORE_DATA;
  if (mode === "replace") {
    DB = Object.assign({ groups: [...DEFAULT_GROUPS], stockGroups: JSON.parse(JSON.stringify(DEFAULT_STOCK_GROUPS)), items: [] }, R);
    saveDB();
  } else {
    persistCurrentEntitySilently();
    const newId = "ENT_" + Date.now().toString(36);
    CURRENT_ENTITY_ID = newId;
    DB = Object.assign({ groups: [...DEFAULT_GROUPS], stockGroups: JSON.parse(JSON.stringify(DEFAULT_STOCK_GROUPS)), items: [] }, R);
    saveDB();
    localStorage.setItem("TALLY_PRIME_LAST_ENTITY", newId);
  }
  RESTORE_DATA = null; closeModal(); navigate("gateway", false);
  toast("✅ Backup Restored!");
}

// ============================================================================
// SUPABASE CLOUD AUTH, AUTO-SYNC & STRICT RBAC SECURITY
// ============================================================================
const MASTER_ADMIN_EMAIL = "tradingtrainerakki@gmail.com";
const SUPA_SESSION_KEY = "SUPA_TALLY_AUTH_SESSION_V2";
const ACCESS_LIST_KEY = "TALLY_PRIME_USER_PERMISSIONS";

function getSupaSession() {
  try { return JSON.parse(sessionStorage.getItem(SUPA_SESSION_KEY) || "null"); } catch { return null; }
}

function getLoggedInEmail() {
  const s = getSupaSession();
  return (s && s.email) ? String(s.email).toLowerCase().trim() : "";
}

function isSuperAdmin() {
  return getLoggedInEmail() === MASTER_ADMIN_EMAIL;
}

// Searches across current DB, all saved entities, and global permissions map
function getCurrentUserRole() {
  const email = getLoggedInEmail();
  if (!email) return "viewer";
  if (email === MASTER_ADMIN_EMAIL) return "admin";

  // 1. Check current entity DB.userRoles
  if (DB && Array.isArray(DB.userRoles)) {
    const found = DB.userRoles.find(u => String(u.email || "").toLowerCase().trim() === email);
    if (found) return found.blocked ? "blocked" : (found.role || "viewer");
  }

  // 2. Check all other saved entities' DB.userRoles in localStorage
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith("TALLY_PRIME_GST_DB_")) {
      try {
        const d = JSON.parse(localStorage.getItem(k) || "{}");
        if (Array.isArray(d.userRoles)) {
          const f = d.userRoles.find(u => String(u.email || "").toLowerCase().trim() === email);
          if (f) return f.blocked ? "blocked" : (f.role || "viewer");
        }
      } catch {}
    }
  }

  // 3. Check global TALLY_PRIME_USER_PERMISSIONS map
  try {
    const map = JSON.parse(localStorage.getItem(ACCESS_LIST_KEY) || "{}");
    const entry = map[email];
    if (entry) {
      if (entry.active === false || entry.blocked === true) return "blocked";
      return entry.role || "viewer";
    }
  } catch {}

  return "viewer";
}

function canWriteData() {
  const r = getCurrentUserRole();
  return r === "admin" || r === "operator";
}

function syncUserRolesStorage() {
  if (!DB) return;
  if (!Array.isArray(DB.userRoles)) DB.userRoles = [];
  let map = {};
  try { map = JSON.parse(localStorage.getItem(ACCESS_LIST_KEY) || "{}") || {}; } catch {}

  if (DB.userRoles.length === 0) {
    Object.entries(map).forEach(([em, obj]) => {
      if (em && em !== MASTER_ADMIN_EMAIL && obj && typeof obj === "object") {
        DB.userRoles.push({ email: em, role: obj.role || "viewer", blocked: obj.active === false || !!obj.blocked });
      }
    });
  }

  const newMap = { [MASTER_ADMIN_EMAIL]: { role: "admin", active: true } };
  DB.userRoles.forEach(u => {
    const em = String(u.email || "").toLowerCase().trim();
    if (em && em !== MASTER_ADMIN_EMAIL) {
      newMap[em] = { role: u.role || "viewer", active: !u.blocked, blocked: !!u.blocked };
    }
  });
  try { localStorage.setItem(ACCESS_LIST_KEY, JSON.stringify(newMap)); } catch {}
}

(function initSupabaseCloud() {
  const SUPABASE_URL = "https://mjnqbmmyapusejymjchp.supabase.co";
  const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1qbnFibW15YXB1c2VqeW1qY2hwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI2MTQ4MjMsImV4cCI6MjEwODE5MDgyM30.196QHOcQ-bzbhgXGDwXZ6LXo6wpSh4yHNwIsJ4MuGJU";
  const TABLE_URL = `${SUPABASE_URL}/rest/v1/erp_cloud_data`;
  const AUTH_TOKEN_URL = `${SUPABASE_URL}/auth/v1/token?grant_type=password`;

  let isLoadingFromCloud = false;
  let syncTimer = null;
  const originalSetItem = localStorage.setItem;

  function showCloudStatus(msg, color = "#16a34a") {
    let badge = document.getElementById("supa-cloud-badge");
    if (!badge) {
      badge = document.createElement("div");
      badge.id = "supa-cloud-badge";
      badge.onclick = () => canWriteData() ? syncToSupabase(true) : toast("👁️ Read-Only Mode");
      document.body.appendChild(badge);
    }
    badge.style.backgroundColor = color;
    badge.textContent = msg;
  }

  localStorage.setItem = function(key, value) {
    if (getSupaSession() && !canWriteData() && !isLoadingFromCloud) {
      toast("🔒 Read-Only Access: Viewer बदलाव सेव नहीं कर सकता!");
      return;
    }
    originalSetItem.apply(this, arguments);
    if (!isLoadingFromCloud && canWriteData()) syncToSupabase();
  };

  function syncToSupabase(forceNow = false) {
    const sess = getSupaSession();
    if (!sess || !canWriteData()) return;
    clearTimeout(syncTimer);
    showCloudStatus("⏳ Saving...", "#d97706");
    syncTimer = setTimeout(async () => {
      try {
        const allData = {};
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && k.startsWith("TALLY_PRIME_")) allData[k] = localStorage.getItem(k);
        }
        const res = await fetch(TABLE_URL, {
          method: "POST",
          headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${sess.token}`, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates" },
          body: JSON.stringify({ id: "tally_main_data", content: allData, updated_at: new Date().toISOString() })
        });
        showCloudStatus(res.ok ? `☁️ Cloud Synced (${sess.email.split("@")[0]})` : `⚠️ Sync Error (${res.status})`, res.ok ? "#16a34a" : "#dc2626");
      } catch { showCloudStatus("⚠️ Retry Sync", "#dc2626"); }
    }, forceNow ? 50 : 600);
  }

  async function loadFromSupabase() {
    const sess = getSupaSession(); if (!sess) return;
    showCloudStatus("🔄 Loading Cloud...", "#2563eb");
    try {
      const res = await fetch(`${TABLE_URL}?id=eq.tally_main_data&select=content`, {
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${sess.token}` }
      });
      if (res.ok) {
        const rows = await res.json();
        if (Array.isArray(rows) && rows[0] && rows[0].content) {
          isLoadingFromCloud = true;
          Object.entries(rows[0].content).forEach(([k, v]) => originalSetItem.call(localStorage, k, v));
          isLoadingFromCloud = false;
          const avail = getSavedEntitiesList();
          const last = localStorage.getItem("TALLY_PRIME_LAST_ENTITY");
          loadDB(last && avail.includes(last) ? last : (avail[0] || "DEFAULT_ENTITY"));
          syncUserRolesStorage();
          if (getCurrentUserRole() === "blocked") {
            alert("🚫 Aapka account Admin dwara block kar diya gaya hai!");
            window.supaLogout();
            return;
          }
          renderScreen(CURRENT_SCREEN);
          window.applyUserBadge();
          showCloudStatus(`☁️ Cloud Synced (${sess.email.split("@")[0]})`, "#16a34a");
        }
      }
    } catch { showCloudStatus("⚠️ Retry Sync", "#d97706"); }
  }

  window.applyUserBadge = function() {
    const sess = getSupaSession(); if (!sess) return;
    ROLE = getCurrentUserRole();
    const badge = document.getElementById("topUserBadge");
    if (badge) {
      badge.style.display = "inline-block";
      badge.style.background = isSuperAdmin() ? "#047857" : (ROLE === "operator" ? "#0369a1" : "#1d4ed8");
      badge.style.fontWeight = "700";
      const icon = isSuperAdmin() ? "👑" : (ROLE === "operator" ? "✏️" : "👁️");
      badge.innerHTML = `${icon} ${escHtml(sess.email.split("@")[0])} (${ROLE}) | <u onclick="event.stopPropagation(); supaLogout();">Logout</u>`;
    }
    injectUserManagerButton();
  };

  window.supaLogout = function() {
    sessionStorage.removeItem(SUPA_SESSION_KEY);
    location.reload();
  };

  window.addEventListener("DOMContentLoaded", () => {
    const avail = getSavedEntitiesList();
    const last = localStorage.getItem("TALLY_PRIME_LAST_ENTITY");
    loadDB(last && avail.includes(last) ? last : (avail[0] || "DEFAULT_ENTITY"));
    navigate("gateway", false);

    const ov = document.getElementById("supaAuthOverlay");
    const sess = getSupaSession();
    if (sess && sess.token) {
      window.applyUserBadge();
      loadFromSupabase();
    } else if (ov) {
      ov.classList.add("active");
      setTimeout(() => document.getElementById("supa-email")?.focus(), 50);
    }

    const loginBtn = document.getElementById("supa-login-btn");
    if (loginBtn) {
      loginBtn.onclick = async () => {
        const email = (document.getElementById("supa-email").value || "").trim().toLowerCase();
        const password = document.getElementById("supa-pass").value;
        const errBox = document.getElementById("supa-err");
        if (!email || !password) { errBox.style.display = "block"; errBox.textContent = "⚠ Email aur Password dalein!"; return; }
        loginBtn.textContent = "⏳ Verifying..."; loginBtn.disabled = true; errBox.style.display = "none";
        try {
          const res = await fetch(AUTH_TOKEN_URL, {
            method: "POST",
            headers: { apikey: SUPABASE_KEY, "Content-Type": "application/json" },
            body: JSON.stringify({ email, password })
          });
          const data = await res.json();
          if (!res.ok || !data.access_token) {
            errBox.style.display = "block"; errBox.textContent = "❌ Galat Email ya Password!";
            loginBtn.textContent = "🔓 Sign In with Supabase"; loginBtn.disabled = false; return;
          }
          sessionStorage.setItem(SUPA_SESSION_KEY, JSON.stringify({ token: data.access_token, email: data.user.email.toLowerCase() }));
          ov.classList.remove("active");
          await loadFromSupabase();
          window.applyUserBadge();
          toast("✅ Welcome " + data.user.email);
        } catch {
          errBox.style.display = "block"; errBox.textContent = "❌ Network Error!";
          loginBtn.textContent = "🔓 Sign In with Supabase"; loginBtn.disabled = false;
        }
      };
    }
  });
})();

// Strictly show "👥 Users" Button ONLY for Master Admin (tradingtrainerakki@gmail.com)
function injectUserManagerButton() {
  const oldBtn = document.getElementById("aeUsersMgrBtn");
  if (!isSuperAdmin()) {
    if (oldBtn) oldBtn.remove();
    // Extra safety: remove any other button with text "Users" in header
    document.querySelectorAll("header button, .top-bar button").forEach(b => {
      if (/Users/i.test(b.textContent || "")) b.remove();
    });
    return;
  }
  if (oldBtn) return;

  const topbar = document.querySelector(".top-meta, .top-bar, header");
  if (!topbar) return;

  const btn = document.createElement("button");
  btn.id = "aeUsersMgrBtn";
  btn.className = "btn btn-sec";
  btn.style.cssText = "padding:3px 9px; font-size:11.5px; font-weight:700; margin-left:6px; background:#fef08a; color:#0f172a; border-color:#eab308;";
  btn.innerHTML = "👥 Users";
  btn.onclick = openUserManagerModal;
  topbar.appendChild(btn);
}

setInterval(injectUserManagerButton, 500);

function openUserManagerModal() {
  if (!isSuperAdmin()) {
    toast("🚫 Security Lock: Sirf Master Admin hi Users manage kar sakta hai!");
    return;
  }
  syncUserRolesStorage();

  const rowsHtml = DB.userRoles.map((u, idx) => `
    <tr style="${u.blocked ? "background:#fef2f2; opacity:0.75;" : ""}">
      <td>${idx + 1}</td>
      <td><b>${escHtml(u.email)}</b></td>
      <td>
        <select onchange="updateUserRoleItem(${idx}, 'role', this.value)" style="padding:3px 6px; font-size:12px;">
          <option value="viewer" ${u.role === "viewer" ? "selected" : ""}>👁️ Viewer (Read-Only)</option>
          <option value="operator" ${u.role === "operator" ? "selected" : ""}>✏️ Operator (Data Entry)</option>
          <option value="admin" ${u.role === "admin" ? "selected" : ""}>👑 Admin (Full Access)</option>
        </select>
      </td>
      <td>
        <button class="btn btn-sec" style="padding:2px 7px; font-size:11px; color:${u.blocked ? "var(--ok)" : "var(--danger)"};"
          onclick="updateUserRoleItem(${idx}, 'blocked', ${!u.blocked})">
          ${u.blocked ? "🔓 Unblock" : "🚫 Block"}
        </button>
        <button class="btn btn-danger" style="padding:2px 7px; font-size:11px;" onclick="removeUserRoleItem(${idx})">✕</button>
      </td>
    </tr>`).join("");

  const body = `
    <div style="font-size:12px; color:#475569; margin-bottom:10px; background:#f8fafc; padding:8px; border-radius:4px; border:1px solid #e2e8f0;">
      <b>Master Admin:</b> ${MASTER_ADMIN_EMAIL}<br>
      Naye user ko pehle <b>Supabase → Authentication → Users</b> me add karein, phir uski email yahan set karein.
    </div>
    <div class="form-grid" style="margin-bottom:12px; grid-template-columns: 2fr 1fr auto; align-items:end;">
      <div class="field"><label>User Email *</label><input id="umEmailInp" type="email" placeholder="member@gmail.com"></div>
      <div class="field"><label>Role *</label>
        <select id="umRoleInp">
          <option value="viewer">👁️ Viewer (Read-Only)</option>
          <option value="operator">✏️ Operator (Data Entry)</option>
          <option value="admin">👑 Admin (Full Access)</option>
        </select>
      </div>
      <button class="btn" style="height:33px;" onclick="addUserRoleItem()">➕ Add</button>
    </div>
    <table class="tally-tbl">
      <thead><tr><th>#</th><th>Email</th><th>Role</th><th>Action</th></tr></thead>
      <tbody>${rowsHtml || `<tr><td colspan="4" style="text-align:center; padding:16px; color:var(--muted);">Abhi koi extra user add nahi hai.</td></tr>`}</tbody>
    </table>`;

  showModal("👥 Users & Role Manager (Admin Only)", body, `<button class="btn" onclick="closeModal()">Done (Esc)</button>`);
}

function addUserRoleItem() {
  if (!isSuperAdmin()) return;
  const email = (document.getElementById("umEmailInp")?.value || "").trim().toLowerCase();
  const role = document.getElementById("umRoleInp")?.value || "viewer";
  if (!email || !email.includes("@")) { toast("⚠ Valid Email dalein!"); return; }
  if (email === MASTER_ADMIN_EMAIL) { toast("ℹ️ Master Admin pehle se full access par hai!"); return; }
  if (!Array.isArray(DB.userRoles)) DB.userRoles = [];

  const existing = DB.userRoles.find(u => u.email.toLowerCase() === email);
  if (existing) { existing.role = role; existing.blocked = false; }
  else DB.userRoles.push({ email, role, blocked: false });

  syncUserRolesStorage();
  saveDB();
  openUserManagerModal();
  toast(`✅ ${email} (${role}) Saved & Synced!`);
}

function updateUserRoleItem(idx, field, val) {
  if (!isSuperAdmin() || !DB.userRoles || !DB.userRoles[idx]) return;
  DB.userRoles[idx][field] = val;
  syncUserRolesStorage();
  saveDB();
  openUserManagerModal();
  toast("✅ User Access Updated!");
}

function removeUserRoleItem(idx) {
  if (!isSuperAdmin() || !DB.userRoles) return;
  DB.userRoles.splice(idx, 1);
  syncUserRolesStorage();
  saveDB();
  openUserManagerModal();
  toast("🗑️ User Removed");
}

// ============================================================================
// ENHANCED COMPANY / TRUST ALTERATION (F3) WITH ALL DETAILS
// ============================================================================
function openCompanyAlterModal() {
  if (!canWriteData()) {
    toast("🔒 Read-Only Mode: Viewer Company details alter nahi kar sakta!");
    return;
  }
  const c = DB.company || {};
  const stateOpts = (typeof STATE_LIST !== "undefined" ? STATE_LIST : ["05 - Uttarakhand"])
    .map(s => `<option value="${escHtml(s)}" ${c.state === s ? "selected" : ""}>${escHtml(s)}</option>`).join("");

  const body = `
    <div style="max-height:68vh; overflow-y:auto; padding-right:6px;">
      <div style="font-size:11px; font-weight:800; color:var(--pri); text-transform:uppercase; border-bottom:1px solid #e2e8f0; padding-bottom:3px; margin-bottom:8px;">Basic Info</div>
      <div class="form-grid" style="grid-template-columns: 1fr 2fr; gap:8px; margin-bottom:10px;">
        <div class="field"><label>Organization Type *</label>
          <select id="caEntityType">
            <option value="company" ${(c.entityType || "company") === "company" ? "selected" : ""}>🏢 Company / Business</option>
            <option value="trust" ${c.entityType === "trust" ? "selected" : ""}>🏛️ Trust / NGO / Section-8</option>
          </select>
        </div>
        <div class="field"><label>Company / Trust Name *</label><input id="caName" value="${escHtml(c.name || "")}"></div>
      </div>
      <div class="form-grid" style="grid-template-columns: 1fr 1fr 1fr; gap:8px; margin-bottom:12px;">
        <div class="field"><label>Registration Number</label><input id="caRegNo" value="${escHtml(c.regNo || "")}" placeholder="e.g. UK/403-IV/2025"></div>
        <div class="field"><label>Registration Date</label><input type="date" id="caRegDate" value="${escHtml(c.regDate || "")}"></div>
        <div class="field"><label>PAN Number</label><input id="caPan" value="${escHtml(c.pan || "")}" placeholder="e.g. ABMTS4018D"></div>
      </div>

      <div style="font-size:11px; font-weight:800; color:var(--pri); text-transform:uppercase; border-bottom:1px solid #e2e8f0; padding-bottom:3px; margin-bottom:8px;">Tax Registrations &amp; Bank</div>
      <div class="form-grid" style="grid-template-columns: 1fr 1fr 1fr; gap:8px; margin-bottom:8px;">
        <div class="field"><label>12A Number</label><input id="ca12A" value="${escHtml(c.reg12A || "")}" placeholder="e.g. 12A/2020-21/5678"></div>
        <div class="field"><label>80G Number</label><input id="ca80G" value="${escHtml(c.reg80G || "")}" placeholder="e.g. 80G/2020-21/1234"></div>
        <div class="field"><label>Bank Account</label><input id="caBankAcc" value="${escHtml(c.bankAccount || "")}" placeholder="e.g. 721110210000007"></div>
      </div>
      <div class="form-grid" style="grid-template-columns: 1fr 1fr 1fr 1fr; gap:8px; margin-bottom:12px;">
        <div class="field"><label>GST Reg. Type</label>
          <select id="caRegType">
            <option value="Regular" ${(c.regType || "Regular") === "Regular" ? "selected" : ""}>Regular</option>
            <option value="Composition" ${c.regType === "Composition" ? "selected" : ""}>Composition</option>
            <option value="Unregistered" ${c.regType === "Unregistered" ? "selected" : ""}>Unregistered</option>
          </select>
        </div>
        <div class="field"><label>GSTIN (15 Digits)</label><input id="caGstin" value="${escHtml(c.gstin || "")}" placeholder="Optional"></div>
        <div class="field"><label>FY From *</label><input type="date" id="caFyFrom" value="${escHtml(c.fyFrom || "2026-04-01")}"></div>
        <div class="field"><label>FY To *</label><input type="date" id="caFyTo" value="${escHtml(c.fyTo || "2027-03-31")}"></div>
      </div>

      <div style="font-size:11px; font-weight:800; color:var(--pri); text-transform:uppercase; border-bottom:1px solid #e2e8f0; padding-bottom:3px; margin-bottom:8px;">Address &amp; Contact</div>
      <div class="form-grid" style="grid-template-columns: 1fr 1fr 1fr; gap:8px; margin-bottom:8px;">
        <div class="field"><label>Address Line 1</label><input id="caAddr" value="${escHtml(c.address || "")}" placeholder="e.g. Ganga Enclave"></div>
        <div class="field"><label>Address Line 2</label><input id="caAddr2" value="${escHtml(c.address2 || "")}" placeholder="e.g. Area / Landmark"></div>
        <div class="field"><label>City</label><input id="caCity" value="${escHtml(c.city || "")}" placeholder="e.g. Roorkee"></div>
      </div>
      <div class="form-grid" style="grid-template-columns: 1fr 1fr 1fr; gap:8px; margin-bottom:8px;">
        <div class="field"><label>State</label><select id="caState">${stateOpts}</select></div>
        <div class="field"><label>Pincode</label><input id="caPin" value="${escHtml(c.pincode || "")}" placeholder="e.g. 247667"></div>
        <div class="field"><label>Phone</label><input id="caPhone" value="${escHtml(c.phone || "")}" placeholder="e.g. 9897346272"></div>
      </div>
      <div class="form-grid" style="grid-template-columns: 1fr 1fr; gap:8px; margin-bottom:12px;">
        <div class="field"><label>Email</label><input type="email" id="caEmail" value="${escHtml(c.email || "")}" placeholder="e.g. trust@gmail.com"></div>
        <div class="field"><label>Website</label><input id="caWeb" value="${escHtml(c.website || "")}" placeholder="e.g. www.trust.org"></div>
      </div>

      <div style="font-size:11px; font-weight:800; color:var(--pri); text-transform:uppercase; border-bottom:1px solid #e2e8f0; padding-bottom:3px; margin-bottom:8px;">Authorised Signatory (Print Ke Liye)</div>
      <div class="form-grid" style="grid-template-columns: 1fr 1fr; gap:8px;">
        <div class="field"><label>Signatory Name</label><input id="caSigName" value="${escHtml(c.signatoryName || "")}" placeholder="e.g. Suresh Kumar"></div>
        <div class="field"><label>Designation</label><input id="caSigDesig" value="${escHtml(c.signatoryDesig || "Authorised Signatory")}" placeholder="Authorised Signatory"></div>
      </div>
    </div>`;

  const foot = `<button class="btn btn-sec" onclick="closeModal()">Cancel</button><button class="btn" onclick="saveCompanyAlter()">Save (Ctrl+A)</button>`;
  showModal("Company / Trust Alteration (F3)", body, foot);
}

function saveCompanyAlter() {
  if (!canWriteData()) return;
  const name = (document.getElementById("caName")?.value || "").trim();
  if (!name) { toast("⚠ Company / Trust Name zaroori hai!"); return; }

  DB.company.entityType = document.getElementById("caEntityType")?.value || "company";
  DB.company.name = name;
  DB.company.regNo = (document.getElementById("caRegNo")?.value || "").trim();
  DB.company.regDate = document.getElementById("caRegDate")?.value || "";
  DB.company.pan = (document.getElementById("caPan")?.value || "").trim().toUpperCase();
  DB.company.reg12A = (document.getElementById("ca12A")?.value || "").trim();
  DB.company.reg80G = (document.getElementById("ca80G")?.value || "").trim();
  DB.company.bankAccount = (document.getElementById("caBankAcc")?.value || "").trim();
  DB.company.regType = document.getElementById("caRegType")?.value || "Regular";
  DB.company.gstin = (document.getElementById("caGstin")?.value || "").trim().toUpperCase();
  DB.company.fyFrom = document.getElementById("caFyFrom")?.value || DB.company.fyFrom;
  DB.company.fyTo = document.getElementById("caFyTo")?.value || DB.company.fyTo;
  DB.company.address = (document.getElementById("caAddr")?.value || "").trim();
  DB.company.address2 = (document.getElementById("caAddr2")?.value || "").trim();
  DB.company.city = (document.getElementById("caCity")?.value || "").trim();
  DB.company.state = document.getElementById("caState")?.value || DB.company.state;
  DB.company.pincode = (document.getElementById("caPin")?.value || "").trim();
  DB.company.phone = (document.getElementById("caPhone")?.value || "").trim();
  DB.company.email = (document.getElementById("caEmail")?.value || "").trim();
  DB.company.website = (document.getElementById("caWeb")?.value || "").trim();
  DB.company.signatoryName = (document.getElementById("caSigName")?.value || "").trim();
  DB.company.signatoryDesig = (document.getElementById("caSigDesig")?.value || "Authorised Signatory").trim();

  if (typeof syncEntityMeta === "function") syncEntityMeta();
  saveDB();
  closeModal();
  if (typeof updateShellUI === "function") updateShellUI();
  toast("✅ Company / Trust Details Saved!");
}
