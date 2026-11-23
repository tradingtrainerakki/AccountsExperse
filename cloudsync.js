// ============================================================================
// cloudsync.js  —  SAP jaisa "Cloud hi asli maalik" (20 log, ek saath kaam)
//
//  1. Login ka token khatam hone par apne aap naya ho jaata hai (401 / Sync Error band)
//  2. Cloud me save sirf tab jab beech me kisi aur ne kuch na badla ho (version check)
//     Badla ho to dono ke badlav voucher-by-voucher MILA diye jaate hain (kisi ka kaam nahi mitta)
//  3. Dusre user ka naya data apne aap aa jaata hai (har 30 second, sirf badlav hone par)
//  4. Internet nahi hai to naya voucher/save band (SAP ki tarah); beech me net toote to
//     kaam surakshit rehta hai aur net aate hi apne aap cloud me chala jaata hai
//  5. Do user ek hi voucher no. bana len to baad wale ko naya no. mil jaata hai (batakar)
//
// Load order: index.html me cancelvoucher.js ke BAAD (sabse last) lagayein.
// core.js ko BADALNA nahi padta.
// ============================================================================
(function () {
  "use strict";

  const TABLE_PATH = "/rest/v1/erp_cloud_data";
  const ROW_ID = "tally_main_data";
  const DB_PREFIX = "TALLY_PRIME_GST_DB_";
  const SESSION_KEY = "SUPA_TALLY_AUTH_SESSION_V2";
  const RT_KEY = "AE_REFRESH_V1";      // refresh token (sirf is tab me, sessionStorage)
  const PENDING_KEY = "AE_PENDING_V1"; // net toote to adhoora save yaha surakshit rehta hai
  const POLL_MS = 30000;
  const RETRY_MS = 8000;

  const _fetch = window.fetch.bind(window);
  const nativeSet = Storage.prototype.setItem;
  const nativeRemove = Storage.prototype.removeItem;

  const state = {
    origin: "", apikey: "",
    ver: null,        // cloud ki aakhri updated_at jo humne dekhi
    base: null,       // cloud ka aakhri data (jis se hamara data mila hua tha)
    queue: Promise.resolve(),
    pending: false, authLost: false, retryTimer: null, refreshing: null
  };

  // ------------------------------------------------------------------ helpers
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const isPlain = (x) => x && typeof x === "object" && !Array.isArray(x);
  const toastSafe = (m) => { try { toast(m); } catch (e) { /* ignore */ } };
  function enqueue(fn) {
    const p = state.queue.then(fn, fn);
    state.queue = p.catch(() => {});
    return p;
  }
  function sameContent(a, b) {
    if (!a || !b) return false;
    const ka = Object.keys(a), kb = Object.keys(b);
    if (ka.length !== kb.length) return false;
    return ka.every(k => a[k] === b[k]);
  }
  function gatherLocal() {
    const o = {};
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith("TALLY_PRIME_")) o[k] = localStorage.getItem(k);
    }
    return o;
  }
  const canWrite = () => (typeof canWriteData === "function" ? canWriteData() : true);
  const newTs = () => new Date().toISOString();

  // ---------------------------------------------------------------- session / token
  const getSess = () => { try { return JSON.parse(sessionStorage.getItem(SESSION_KEY) || "null"); } catch (e) { return null; } };
  const getRT = () => { try { return sessionStorage.getItem(RT_KEY) || ""; } catch (e) { return ""; } };

  function refreshToken() {
    if (state.refreshing) return state.refreshing;
    const p = (async () => {
      const rt = getRT();
      if (!rt || !state.apikey || !state.origin) return false;
      try {
        const r = await _fetch(state.origin + "/auth/v1/token?grant_type=refresh_token", {
          method: "POST",
          headers: { apikey: state.apikey, "Content-Type": "application/json" },
          body: JSON.stringify({ refresh_token: rt })
        });
        if (!r.ok) return false;
        const d = await r.json();
        if (!d.access_token) return false;
        const s = getSess();
        if (s) { s.token = d.access_token; sessionStorage.setItem(SESSION_KEY, JSON.stringify(s)); }
        if (d.refresh_token) sessionStorage.setItem(RT_KEY, d.refresh_token);
        return true;
      } catch (e) { return false; }
    })();
    state.refreshing = p;
    p.finally(() => { state.refreshing = null; });
    return p;
  }

  function headersOf(init) {
    const h = init && init.headers;
    if (!h) return {};
    if (typeof Headers !== "undefined" && h instanceof Headers) return Object.fromEntries(h.entries());
    return Object.assign({}, h);
  }

  // har request taaza token ke saath; 401 aaye to token naya karke ek baar dobara
  async function authed(url, init) {
    init = init || {};
    const mk = () => {
      const h = headersOf(init);
      const s = getSess();
      if (s && s.token) h.Authorization = "Bearer " + s.token;
      if (state.apikey) h.apikey = state.apikey;
      return Object.assign({}, init, { headers: h });
    };
    let r = await _fetch(url, mk());
    if (r.status === 401 && getRT()) {
      if (await refreshToken()) { state.authLost = false; r = await _fetch(url, mk()); }
    }
    if (r.status === 401) state.authLost = true; else if (r.ok) state.authLost = false;
    return r;
  }

  const rowUrl = (sel) => `${state.origin}${TABLE_PATH}?id=eq.${ROW_ID}&select=${sel}`;
  const rowWhere = (ver) => `${state.origin}${TABLE_PATH}?id=eq.${ROW_ID}&updated_at=eq.${encodeURIComponent(ver)}`;

  // ---------------------------------------------------------------- 3-way MERGE
  const keyOf = (o) => (o && typeof o === "object") ? (o.id != null ? o.id : (o.email != null ? o.email : (o.name != null ? o.name : null))) : null;
  const keyed = (a) => Array.isArray(a) && a.every(x => x && typeof x === "object" && keyOf(x) != null);

  // ek record (voucher/ledger...) ko field-by-field milana
  function mergeObj(B, L, R) {
    const out = {};
    const keys = new Set([...Object.keys(L || {}), ...Object.keys(R || {}), ...Object.keys(B || {})]);
    keys.forEach(f => {
      const b = B ? B[f] : undefined, l = L ? L[f] : undefined, r = R ? R[f] : undefined;
      let v;
      if (eq(l, r)) v = l;
      else if (eq(l, b)) v = r;      // sirf dusre ne badla
      else if (eq(r, b)) v = l;      // sirf humne badla
      else v = l;                    // dono ne badla -> jo abhi save kar raha hai
      if (v !== undefined) out[f] = v;
    });
    return out;
  }

  function mergeArray(b, l, r) {
    b = Array.isArray(b) ? b : []; l = Array.isArray(l) ? l : []; r = Array.isArray(r) ? r : [];
    if (!(keyed(b) && keyed(l) && keyed(r))) return eq(l, b) ? r : l; // pehchaan wali list nahi -> poori list
    const mb = new Map(b.map(x => [keyOf(x), x]));
    const ml = new Map(l.map(x => [keyOf(x), x]));
    const mr = new Map(r.map(x => [keyOf(x), x]));
    const decide = (k) => {
      const B = mb.get(k), L = ml.get(k), R = mr.get(k);
      if (L && R) return B ? mergeObj(B, L, R) : (eq(L, R) ? R : mergeObj(undefined, L, R));
      if (L && !R) return !B ? L : (eq(L, B) ? null : L); // dusre ne hataya: hamne na badla ho to hata do
      if (!L && R) return !B ? R : (eq(R, B) ? null : R); // humne hataya: dusre ne na badla ho to hata do
      return null;
    };
    const out = [], seen = new Set();
    r.forEach(x => { const k = keyOf(x); seen.add(k); const v = decide(k); if (v) out.push(v); });
    l.forEach(x => { const k = keyOf(x); if (seen.has(k)) return; seen.add(k); const v = decide(k); if (v) out.push(v); });
    return out;
  }

  function mergeDB(B, L, R) {
    B = B || {};
    const out = {};
    const keys = new Set([...Object.keys(L), ...Object.keys(R), ...Object.keys(B)]);
    keys.forEach(t => {
      const b = B[t], l = L[t], r = R[t];
      let v;
      if (Array.isArray(l) || Array.isArray(r)) v = mergeArray(b, l, r);
      else if (isPlain(l) && isPlain(r)) v = mergeObj(isPlain(b) ? b : undefined, l, r);
      else v = eq(l, r) ? l : (eq(l, b) ? r : l);
      if (v !== undefined) out[t] = v;
    });
    return out;
  }

  function nextFreeNo(vs, type, sample) {
    const m = /^(.*?)(\d+)$/.exec(String(sample || ""));
    const pref = m ? m[1] : "VCH/", width = m ? m[2].length : 4;
    let max = 0;
    vs.forEach(x => {
      if (x.type !== type) return;
      const mm = /(\d+)$/.exec(String(x.vchNo || ""));
      if (mm) max = Math.max(max, parseInt(mm[1], 10));
    });
    return pref + String(max + 1).padStart(width, "0");
  }

  // dusre ne jo no. pehle le liya, humare naye voucher ko naya no.
  function fixDupNos(db, remoteIds) {
    const notes = [];
    const vs = db.vouchers || [];
    const used = new Set();
    vs.forEach(v => { if (remoteIds.has(v.id)) used.add(v.type + "|" + v.vchNo); });
    vs.forEach(v => {
      if (remoteIds.has(v.id)) return;
      const k = v.type + "|" + v.vchNo;
      if (used.has(k)) {
        const old = v.vchNo, nn = nextFreeNo(vs, v.type, old);
        v.vchNo = nn;
        if (v.bill && v.bill.ref === old) v.bill.ref = nn;
        notes.push(`${v.type}: ${old} → ${nn}`);
      }
      used.add(v.type + "|" + v.vchNo);
    });
    return notes;
  }

  function mergeContents(base, local, remote) {
    base = base || {};
    const out = {}, notes = [];
    const keys = new Set([...Object.keys(local), ...Object.keys(remote), ...Object.keys(base)]);
    keys.forEach(k => {
      const b = base[k], l = local[k], r = remote[k];
      let v;
      if (k.startsWith(DB_PREFIX) && typeof l === "string" && typeof r === "string") {
        try {
          const L = JSON.parse(l), R = JSON.parse(r), B = b ? JSON.parse(b) : {};
          const m = mergeDB(B, L, R);
          notes.push(...fixDupNos(m, new Set((R.vouchers || []).map(x => x.id))));
          v = JSON.stringify(m);
        } catch (e) { v = (l === b) ? r : l; }
      } else v = (l === r) ? l : (l === b ? r : l);
      if (v !== undefined) out[k] = v;
    });
    return { merged: out, notes };
  }

  // ----------------------------------------------------- local par lagana / screen
  function safeRerender() {
    try { if (typeof refreshHeaderAndSidebar === "function") refreshHeaderAndSidebar(); } catch (e) { /* ignore */ }
    try {
      if (typeof kbOverlayOpen === "function" && kbOverlayOpen()) return;
      if (typeof CURRENT_SCREEN !== "undefined" && CURRENT_SCREEN === "voucher_entry") return; // bhari hui entry na bigde
      const a = document.activeElement;
      const sb = document.getElementById("screenBody");
      if (a && sb && sb.contains(a) && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) return;
      if (typeof renderScreen === "function") renderScreen(CURRENT_SCREEN);
    } catch (e) { /* ignore */ }
  }

  function applyContentLocally(content, notes, quiet) {
    const keep = (typeof DB !== "undefined" && DB && DB.company) ? DB.company.curDate : null; // aaj ki working date
    Object.keys(content).forEach(k => { if (localStorage.getItem(k) !== content[k]) nativeSet.call(localStorage, k, content[k]); });
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k && k.startsWith("TALLY_PRIME_") && !(k in content)) nativeRemove.call(localStorage, k);
    }
    try {
      if (typeof loadDB === "function") loadDB(CURRENT_ENTITY_ID);
      if (keep && DB && DB.company) DB.company.curDate = keep;
      if (typeof syncUserRolesStorage === "function") syncUserRolesStorage();
    } catch (e) { /* ignore */ }
    safeRerender();
    if (notes && notes.length) toastSafe("🔢 Dusre user ne wahi Voucher No. le liya tha — aapka naya no.: " + notes.join(", "));
    else if (!quiet) toastSafe("🔄 Dusre user ke naye badlav aa gaye");
  }

  // ----------------------------------------------------------- cloud se padhna
  async function fetchLatest() {
    try {
      const r = await authed(rowUrl("content,updated_at"), { method: "GET", headers: {} });
      if (!r.ok) return { ok: false, status: r.status };
      const rows = await r.json();
      if (!rows.length) return { ok: true, missing: true };
      return { ok: true, content: rows[0].content || {}, ver: rows[0].updated_at };
    } catch (e) { return { ok: false, net: true, status: 0 }; }
  }
  async function fetchVersion() {
    try {
      const r = await authed(rowUrl("updated_at"), { method: "GET", headers: {} });
      if (!r.ok) return { ok: false, status: r.status };
      const rows = await r.json();
      return { ok: true, ver: rows.length ? rows[0].updated_at : null };
    } catch (e) { return { ok: false, net: true }; }
  }

  // --------------------------------------------------------- cloud me likhna (safe)
  async function pushWithMerge(local) {
    let cur = local;
    for (let i = 0; i < 6; i++) {
      if (!state.ver) {
        const g = await fetchLatest();
        if (!g.ok) return g;
        if (g.missing) {
          const ts = newTs();
          const r = await authed(`${state.origin}${TABLE_PATH}`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=representation" },
            body: JSON.stringify({ id: ROW_ID, content: cur, updated_at: ts })
          });
          if (!r.ok) return { ok: false, status: r.status };
          const rows = await r.json();
          state.ver = (rows[0] && rows[0].updated_at) || ts; state.base = clone(cur);
          return { ok: true };
        }
        const m = mergeContents(state.base || {}, cur, g.content);
        if (!sameContent(m.merged, cur)) applyContentLocally(m.merged, m.notes, false);
        cur = m.merged; state.ver = g.ver; state.base = clone(g.content);
      }
      const ts = newTs();
      let r;
      try {
        r = await authed(rowWhere(state.ver), {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Prefer: "return=representation" },
          body: JSON.stringify({ content: cur, updated_at: ts })
        });
      } catch (e) { return { ok: false, net: true, status: 0 }; }
      if (!r.ok) return { ok: false, status: r.status };
      const rows = await r.json();
      if (rows.length === 1) { state.ver = rows[0].updated_at || ts; state.base = clone(cur); return { ok: true }; }
      state.ver = null; // kisi aur ne beech me save kiya -> naya le kar mila do
    }
    return { ok: false, status: 409 };
  }

  // ------------------------------------------------------------- pending (net toota)
  function readPending() { try { return JSON.parse(localStorage.getItem(PENDING_KEY) || "null"); } catch (e) { return null; } }
  function writePending(base, local) {
    try { nativeSet.call(localStorage, PENDING_KEY, JSON.stringify({ base: base || {}, local: local, ts: newTs() })); } catch (e) { /* jagah kam */ }
  }
  function clearPending() { try { nativeRemove.call(localStorage, PENDING_KEY); } catch (e) { /* ignore */ } }

  function setBadge(text, color) {
    const b = document.getElementById("supa-cloud-badge");
    if (b) { b.textContent = text; b.style.backgroundColor = color; }
  }

  function updateBar() {
    let bar = document.getElementById("aeNetBar");
    let msg = "", bg = "#b91c1c", btn = "";
    if (!navigator.onLine) msg = "📵 Internet nahi hai — naya save band hai. Internet aane par dobara chalu ho jayega.";
    else if (state.authLost) { msg = "🔒 Login ki avadhi khatam — kaam surakshit hai. "; btn = '<button id="aeReLogin" style="margin-left:8px;padding:2px 10px;cursor:pointer;">Dobara Login</button>'; }
    else if (state.pending) { msg = "⏳ Cloud me save pending hai — aapka kaam surakshit hai, net aate hi apne aap chala jayega."; bg = "#b45309"; }
    if (!msg) { if (bar) bar.remove(); return; }
    if (!bar) {
      bar = document.createElement("div");
      bar.id = "aeNetBar";
      bar.style.cssText = "position:fixed;top:0;left:0;right:0;z-index:100000;padding:5px 12px;font-size:12.5px;font-weight:700;text-align:center;color:#fff;";
      document.body.appendChild(bar);
    }
    bar.style.background = bg;
    bar.innerHTML = msg + btn;
    const b = document.getElementById("aeReLogin");
    if (b) b.onclick = () => { if (typeof supaLogout === "function") supaLogout(); else location.reload(); };
  }

  function scheduleRetry() {
    if (state.retryTimer) return;
    state.retryTimer = setInterval(() => {
      if (!navigator.onLine) { updateBar(); return; }
      enqueue(async () => {
        const res = await pushWithMerge(gatherLocal());
        if (res.ok) {
          state.pending = false; clearPending();
          clearInterval(state.retryTimer); state.retryTimer = null;
          const s = getSess();
          setBadge(`☁️ Cloud Synced (${s ? String(s.email || "").split("@")[0] : ""})`, "#16a34a");
          toastSafe("✅ Pending kaam cloud me save ho gaya");
        }
        updateBar();
      });
    }, RETRY_MS);
  }

  // ------------------------------------------------------ core.js ke fetch ko rokna
  function noteRequest(url, init) {
    try { state.origin = new URL(url).origin; } catch (e) { /* ignore */ }
    const h = headersOf(init);
    if (h.apikey) state.apikey = h.apikey;
  }

  async function wrapLoad(url, init) {
    noteRequest(url, init);
    const newUrl = url.replace(/select=content(?!,)/, "select=content,updated_at");
    const res = await authed(newUrl, init || {});
    updateBar();
    if (!res.ok) return res;
    let rows;
    try { rows = await res.clone().json(); } catch (e) { return res; }
    if (!(Array.isArray(rows) && rows[0])) return res;
    const remote = rows[0].content || {};
    state.ver = rows[0].updated_at; state.base = clone(remote);
    const pend = readPending();
    if (pend && pend.local) {
      // pichhla adhoora save: cloud ke naye data ke saath mila kar wapas chalu
      const m = mergeContents(pend.base, pend.local, remote);
      state.pending = true;
      setTimeout(() => { toastSafe("⏳ Pichhla adhoora save cloud me bheja ja raha hai"); state.pending = true; scheduleRetry(); }, 1500);
      return new Response(JSON.stringify([{ content: m.merged, updated_at: rows[0].updated_at }]), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    return res;
  }

  function wrapSave(url, init) {
    noteRequest(url, init);
    return enqueue(async () => {
      const local = gatherLocal();
      const base = state.base ? clone(state.base) : {};
      const res = await pushWithMerge(local);
      if (res.ok) {
        state.pending = false; clearPending();
        if (state.retryTimer) { clearInterval(state.retryTimer); state.retryTimer = null; }
        updateBar();
        return new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } });
      }
      // fail: kaam surakshit rakho
      const pend = readPending();
      writePending(pend && pend.base ? pend.base : base, gatherLocal());
      state.pending = true; scheduleRetry(); updateBar();
      if (res.net) throw new TypeError("network");
      return new Response("{}", { status: res.status || 503 });
    });
  }

  window.fetch = function (input, init) {
    const url = typeof input === "string" ? input : (input && input.url) || "";
    const method = ((init && init.method) || (input && input.method) || "GET").toUpperCase();
    if (url.indexOf(TABLE_PATH) !== -1 && url.indexOf("id=eq." + ROW_ID) !== -1 && method === "GET" && /select=content/.test(url)) return wrapLoad(url, init);
    if (url.indexOf(TABLE_PATH) !== -1 && method === "POST") return wrapSave(url, init);
    if (url.indexOf("/auth/v1/token?grant_type=password") !== -1) {
      noteRequest(url, init);
      return _fetch(input, init).then(res => {
        res.clone().json().then(d => {
          if (d && d.refresh_token) { try { sessionStorage.setItem(RT_KEY, d.refresh_token); } catch (e) { /* ignore */ } }
        }).catch(() => {});
        return res;
      });
    }
    return _fetch(input, init);
  };

  // ------------------------------------------------- dusre ka naya data (poll)
  function isDirty() { return !sameContent(gatherLocal(), state.base); }

  function pollOnce() {
    if (!state.origin || !getSess() || state.pending || document.hidden) return Promise.resolve();
    return enqueue(async () => {
      if (!navigator.onLine) { updateBar(); return; }
      const v = await fetchVersion();
      if (!v.ok) { updateBar(); return; }
      if (v.ver === state.ver) return;
      if (isDirty() && canWrite()) { await pushWithMerge(gatherLocal()); return; }
      const g = await fetchLatest();
      if (!g.ok || g.missing) return;
      state.ver = g.ver; state.base = clone(g.content);
      applyContentLocally(g.content, [], false);
    });
  }
  setInterval(pollOnce, POLL_MS);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) pollOnce(); });
  window.addEventListener("online", () => { updateBar(); if (state.pending) scheduleRetry(); pollOnce(); });
  window.addEventListener("offline", updateBar);
  setInterval(() => { if (getRT() && getSess()) refreshToken(); }, 40 * 60 * 1000); // token pehle hi naya

  window.addEventListener("beforeunload", (ev) => {
    if (state.pending || (state.base && isDirty() && canWrite())) { ev.preventDefault(); ev.returnValue = ""; }
  });

  // --------------------------------------------------- save se pehle ki jaanch
  // saveDB: internet nahi to save nahi (SAP ki tarah) aur screen par aakhri saved data wapas
  const _saveDB = window.saveDB;
  if (typeof _saveDB === "function") {
    window.saveDB = function () {
      if (!navigator.onLine) {
        toastSafe("📵 Internet nahi hai — save nahi hua. Internet aane par dobara karein.");
        try {
          const keep = DB.company && DB.company.curDate;
          loadDB(CURRENT_ENTITY_ID);
          if (keep && DB.company) DB.company.curDate = keep;
        } catch (e) { /* ignore */ }
        updateBar();
        return;
      }
      return _saveDB.apply(this, arguments);
    };
  }

  // voucher save: net ho to pehle taaza data le lo, no. dobara jaancho
  const _scv = window.saveCurrentVoucher;
  if (typeof _scv === "function") {
    window.saveCurrentVoucher = async function () {
      const self = this, args = arguments;
      if (!navigator.onLine) {
        toastSafe("📵 Internet nahi hai — voucher save nahi ho sakta (aapki entry screen par surakshit hai).");
        updateBar();
        return;
      }
      try { await Promise.race([pollOnce(), new Promise(r => setTimeout(r, 4000))]); } catch (e) { /* ignore */ }
      try {
        const st = VCH_STATE;
        if (st && !st.editingId) {
          const clash = (DB.vouchers || []).some(v => v.type === st.vchType && v.vchNo === st.vchNo);
          if (clash) {
            const old = st.vchNo;
            const auto = (typeof VCH_NO_MODE !== "undefined") ? VCH_NO_MODE === "auto" : true;
            if (auto) {
              st.vchNo = nextFreeNo(DB.vouchers, st.vchType, old);
              if (st.billRefName === old) st.billRefName = st.vchNo;
              const a = document.getElementById("vchNoInp"); if (a) a.value = st.vchNo;
              const b = document.getElementById("vchBillRefInp"); if (b && b.value === old) b.value = st.vchNo;
              toastSafe(`🔢 Voucher No. ${old} kisi aur ne le liya tha — naya no.: ${st.vchNo}`);
            } else {
              toastSafe(`⚠ Voucher No. ${old} pehle se maujood hai — doosra no. likhein`);
              return;
            }
          }
        }
      } catch (e) { /* ignore */ }
      return _scv.apply(self, args);
    };
  }

  // logout par refresh token bhi hata do
  const _logout = window.supaLogout;
  if (typeof _logout === "function") {
    window.supaLogout = function () {
      try { sessionStorage.removeItem(RT_KEY); } catch (e) { /* ignore */ }
      return _logout.apply(this, arguments);
    };
  }

  window.__cloudSync = { state, mergeContents, pollOnce, pushWithMerge }; // jaanch ke liye
})();
