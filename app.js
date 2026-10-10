/* Chmode Log — offline-first work-session logger.
   Data lives on the phone (IndexedDB) and syncs to a private GitHub repo when online. */
const APP_VERSION = "1.0.1";
const D = window.ChmodeData;
const DEFAULT_TYPES = ["Writing", "Technical", "Meeting", "Admin"];
const $ = id => document.getElementById(id);

/* ---------------- helpers ---------------- */
const pad = n => String(n).padStart(2, "0");
const ymd = d => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
const hm = d => pad(d.getHours()) + ":" + pad(d.getMinutes());
const fmtH = m => (m / 60).toFixed(1);
const fmtDur = m => Math.floor(m / 60) + "h " + pad(Math.round(m % 60)) + "m";
const has = D.isScore, tsOf = D.tsOf, spanMins = D.spanMins;
const nowTs = () => Math.floor(Date.now() / 60000) * 60000;
const newId = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2)).replace(/-/g, "").slice(0, 20);
function mondayOf(d) { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; }
function toast(t) { const el = $("toast"); el.textContent = t; el.hidden = false; clearTimeout(toast._t); toast._t = setTimeout(() => el.hidden = true, 2600); }
function cleanUrl(v) { v = v.trim(); if (!v) return null; if (!/^https?:\/\//i.test(v)) v = "https://" + v; try { return new URL(v).href; } catch (e) { return null; } }
function hostOf(u) { try { const x = new URL(u); return x.hostname.replace(/^www\./, "") + (x.pathname.length > 1 ? x.pathname : ""); } catch (e) { return u; } }
function ago(ts) { const s = Math.round((Date.now() - ts) / 1000); if (s < 60) return "just now"; if (s < 3600) return Math.round(s / 60) + " min ago"; if (s < 86400) return Math.round(s / 3600) + " h ago"; return new Date(ts).toLocaleDateString("en-GB", { day: "numeric", month: "short" }); }
const ls = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) { } }, del(k) { try { localStorage.removeItem(k); } catch (e) { } } };

/* Excel 3-colour scale */
const R = [248, 105, 107], Y = [255, 235, 132], G = [99, 190, 123];
function scaleRGB(t) { t = Math.max(0, Math.min(1, t)); const [a, b, u] = t < .5 ? [R, Y, t * 2] : [Y, G, (t - .5) * 2]; return "rgb(" + a.map((v, i) => Math.round(v + (b[i] - v) * u)).join(",") + ")"; }
function paint(el, t) { if (t == null || isNaN(t)) { el.style.background = ""; return; } el.style.background = "color-mix(in srgb," + scaleRGB(t) + " var(--mix),var(--card))"; }
const tQ = q => has(q) ? (q - 1) / 4 : null, tE = e => has(e) ? (5 - e) / 4 : null;

/* ---------------- storage (IndexedDB) ---------------- */
let idbP = null;
function idb() {
  if (!idbP) idbP = new Promise((res, rej) => {
    const r = indexedDB.open("chmode", 1);
    r.onupgradeneeded = () => { const d = r.result; d.createObjectStore("kv"); d.createObjectStore("images", { keyPath: "id" }); };
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
  return idbP;
}
async function tx(store, mode, fn) {
  const d = await idb();
  return new Promise((res, rej) => { const t = d.transaction(store, mode); const s = t.objectStore(store); const out = fn(s); t.oncomplete = () => res(out && out.result); t.onerror = () => rej(t.error); });
}
const kvGet = k => tx("kv", "readonly", s => s.get(k));
const kvSet = (k, v) => tx("kv", "readwrite", s => s.put(v, k));
const imgGet = id => tx("images", "readonly", s => s.get(id));
const imgPut = rec => tx("images", "readwrite", s => s.put(rec));
const imgAll = () => tx("images", "readonly", s => s.getAll());

/* ---------------- state ---------------- */
let doc = { version: 1, sessions: {}, types: { list: [...DEFAULT_TYPES], updatedAt: 0 }, active: null };
let sessions = [], shown = 50, startType = null, form = { mode: null }, uploading = 0, storageOk = true;
function rebuild() { sessions = Object.values(doc.sessions).filter(s => s && !s.deleted && s.startTs).sort((a, b) => b.startTs - a.startTs); }
const types = () => (doc.types && doc.types.list && doc.types.list.length) ? doc.types.list : DEFAULT_TYPES;
const isActive = () => doc.active && !doc.active.cleared && doc.active.startTs;
async function persist() {
  rebuild();
  try { await kvSet("doc", doc); storageOk = true; } catch (e) { storageOk = false; toast("Couldn't save on this phone. Free some space and try again."); }
  scheduleSync();
  renderSyncPill();
}
let askedPersist = false;
function askPersist() { if (askedPersist) return; askedPersist = true; try { navigator.storage && navigator.storage.persist && navigator.storage.persist(); } catch (e) { } }

/* ---------------- tabs ---------------- */
function setTab(t) {
  ["log", "stats", "sync"].forEach(n => {
    const on = n === t; $("tab" + n[0].toUpperCase() + n.slice(1)).setAttribute("aria-selected", String(on));
    $("page" + n[0].toUpperCase() + n.slice(1)).hidden = !on;
  });
  if (t === "sync") renderSyncPage();
  ls.set("chmodeTab", t === "sync" ? "log" : t);
}
$("tabLog").onclick = () => setTab("log"); $("tabStats").onclick = () => setTab("stats"); $("tabSync").onclick = () => setTab("sync");
$("syncPill").onclick = () => setTab("sync");

/* ---------------- types ---------------- */
function typesByRecency(extra) {
  const list = types(), seen = [];
  sessions.forEach(s => { if (list.includes(s.type) && !seen.includes(s.type)) seen.push(s.type); });
  const out = [...seen, ...list.filter(t => !seen.includes(t))]; if (extra && !out.includes(extra)) out.push(extra); return out;
}
function defaultType() { return startType || typesByRecency()[0]; }
function chips(el, sel, onPick) {
  el.innerHTML = "";
  typesByRecency(sel).forEach(t => { const b = document.createElement("button"); b.className = "chip"; b.type = "button"; b.textContent = t; b.setAttribute("aria-pressed", String(t === sel)); b.onclick = () => onPick(t); el.appendChild(b); });
}
function scale(el, sel, tf, onPick) {
  el.innerHTML = "";
  const na = document.createElement("button"); na.type = "button"; na.className = "na"; na.textContent = "–"; na.setAttribute("aria-label", "Skip"); na.setAttribute("aria-pressed", String(!has(sel))); na.onclick = () => onPick(null); el.appendChild(na);
  for (let i = 1; i <= 5; i++) { const b = document.createElement("button"); b.type = "button"; b.textContent = i; b.setAttribute("aria-pressed", String(i === sel)); paint(b, tf(i)); b.onclick = () => onPick(i); el.appendChild(b); }
}
$("btnTypes").onclick = () => { $("typesEdit").hidden = !$("typesEdit").hidden; renderTypes(); };
function renderTypes() {
  const el = $("typeRows"); el.innerHTML = "";
  types().forEach(t => {
    const r = document.createElement("div"); r.className = "trow"; const s = document.createElement("span"); s.textContent = t;
    const x = document.createElement("button"); x.className = "x"; x.type = "button"; x.textContent = "✕"; x.setAttribute("aria-label", "Remove " + t);
    x.onclick = () => { if (types().length <= 1) { toast("Keep at least one type"); return; } saveTypes(types().filter(y => y !== t)); };
    r.append(s, x); el.appendChild(r);
  });
}
$("btnAddType").onclick = () => { const v = $("newType").value.trim(); if (!v) return; if (types().some(t => t.toLowerCase() === v.toLowerCase())) { toast(v + " is already a type"); return; } $("newType").value = ""; saveTypes([...types(), v]); };
$("newType").addEventListener("keydown", e => { if (e.key === "Enter") $("btnAddType").click(); });
function saveTypes(list) { doc.types = { list, updatedAt: Date.now() }; if (startType && !list.includes(startType)) startType = null; persist(); renderTypes(); renderMode(); }

/* ---------------- photos ---------------- */
const urlCache = {};
async function imgURL(ref) {
  if (urlCache[ref.id]) return urlCache[ref.id];
  let rec = null; try { rec = await imgGet(ref.id); } catch (e) { }
  if (!rec && cfg() && navigator.onLine) {
    try { const blob = await ghRaw("data/images/" + ref.id + "." + (ref.ext || "jpg")); if (blob) { rec = { id: ref.id, blob, ext: ref.ext || "jpg", synced: true }; await imgPut(rec); } } catch (e) { }
  }
  if (!rec) return null;
  return (urlCache[ref.id] = URL.createObjectURL(rec.blob));
}
function renderAttach(thumbEl, linkEl, s, editable) {
  thumbEl.innerHTML = ""; linkEl.innerHTML = "";
  (s.images || []).forEach((ref, i) => {
    const b = document.createElement("div"); b.className = "thumb busy"; b.textContent = "…";
    imgURL(ref).then(u => {
      if (!u) { b.textContent = "Photo not on this phone yet"; return; }
      b.className = "thumb"; b.textContent = ""; const im = document.createElement("img"); im.src = u; im.alt = "Attached photo";
      im.onclick = () => { $("lightImg").src = u; $("lightbox").hidden = false; }; b.prepend(im);
    });
    if (editable) { const x = document.createElement("button"); x.type = "button"; x.className = "x"; x.textContent = "✕"; x.setAttribute("aria-label", "Remove photo"); x.onclick = e => { e.stopPropagation(); form.images.splice(i, 1); renderFormAttach(); }; b.appendChild(x); }
    thumbEl.appendChild(b);
  });
  if (editable) for (let i = 0; i < uploading; i++) { const b = document.createElement("div"); b.className = "thumb busy"; b.textContent = "Adding…"; thumbEl.appendChild(b); }
  (s.links || []).forEach((u, i) => {
    const r = document.createElement("div"); r.className = "linkrow"; const a = document.createElement("a"); a.href = u; a.target = "_blank"; a.rel = "noopener"; a.textContent = hostOf(u); r.appendChild(a);
    if (editable) { const x = document.createElement("button"); x.type = "button"; x.className = "x"; x.textContent = "✕"; x.setAttribute("aria-label", "Remove link"); x.onclick = () => { form.links.splice(i, 1); renderFormAttach(); }; r.appendChild(x); }
    linkEl.appendChild(r);
  });
}
$("lightbox").onclick = () => { $("lightbox").hidden = true; };
async function shrink(file) {
  try {
    const bmp = await createImageBitmap(file); const k = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    if (k === 1 && file.size < 1.5e6 && /jpe?g|png|webp/.test(file.type)) return file;
    const c = document.createElement("canvas"); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k); c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
    const b = await new Promise(r => c.toBlob(r, "image/jpeg", .85)); return b || file;
  } catch (e) { return file; }
}
const extOf = t => /png/.test(t) ? "png" : /webp/.test(t) ? "webp" : /gif/.test(t) ? "gif" : "jpg";
$("fFile").addEventListener("change", async e => {
  const files = [...e.target.files]; e.target.value = ""; if (!files.length) return;
  for (const f of files) {
    uploading++; renderFormAttach();
    try { const blob = await shrink(f); const id = newId(), ext = extOf(blob.type || f.type); await imgPut({ id, blob, ext, synced: false }); form.images.push({ id, ext }); }
    catch (err) { toast("Couldn't add that photo on this phone."); }
    finally { uploading--; renderFormAttach(); }
  }
});

/* ---------------- log views ---------------- */
function renderMode() {
  const inForm = !!form.mode, act = isActive();
  $("vForm").hidden = !inForm; $("vIdle").hidden = inForm || !!act; $("vRun").hidden = inForm || !act;
  const last = sessions[0], show = last && ((last.notes && last.notes.trim()) || (last.images || []).length || (last.links || []).length);
  $("handoff").hidden = !show; $("runHandoff").hidden = !(last && last.notes);
  if (show) {
    $("handoffText").textContent = last.notes || ""; $("runHandoffText").textContent = last.notes || "";
    renderAttach($("handoffThumbs"), $("handoffLinks"), last, false);
    $("handoffMeta").textContent = new Date(last.startTs).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" }) + " · " + last.start + "–" + last.end + " · " + last.type;
  }
  if (act) { chips($("runChips"), doc.active.type, t => { doc.active = { ...doc.active, type: t, updatedAt: Date.now() }; persist(); renderMode(); }); if (document.activeElement !== $("runStart")) $("runStart").value = hm(new Date(doc.active.startTs)); tick(); }
  if (!$("startTime").dataset.touched && document.activeElement !== $("startTime")) $("startTime").value = hm(new Date());
  chips($("startChips"), defaultType(), t => { startType = t; renderMode(); });
}
function tick() { if (!isActive()) return; const s = Math.max(0, Math.floor((Date.now() - doc.active.startTs) / 1000)); $("runClock").textContent = Math.floor(s / 3600) + ":" + pad(Math.floor(s / 60) % 60) + ":" + pad(s % 60); }
setInterval(() => { tick(); if (!isActive() && !$("startTime").dataset.touched && document.activeElement !== $("startTime")) $("startTime").value = hm(new Date()); }, 1000);
$("startTime").addEventListener("input", () => { $("startTime").dataset.touched = "1"; });

$("btnStart").onclick = () => {
  let ts = nowTs(); const v = $("startTime").value;
  if (v) { const t = tsOf(ymd(new Date()), v); ts = t > Date.now() + 60000 ? t - 864e5 : t; }
  doc.active = { type: defaultType(), startTs: ts, updatedAt: Date.now() }; delete $("startTime").dataset.touched;
  askPersist(); persist(); renderMode();
};
$("runStart").addEventListener("change", () => {
  const v = $("runStart").value; if (!v || !isActive()) return;
  let t = tsOf(ymd(new Date(doc.active.startTs)), v); if (t > Date.now() + 60000) t -= 864e5;
  doc.active = { ...doc.active, startTs: t, updatedAt: Date.now() }; persist(); tick(); toast("Start time changed to " + v);
});
$("btnEnd").onclick = () => { const s = new Date(doc.active.startTs); openForm("end", { type: doc.active.type, date: ymd(s), start: hm(s), end: hm(new Date()) }); };
$("btnDiscard").onclick = () => { $("discardConfirm").hidden = false; };
$("btnDiscardYes").onclick = () => { doc.active = { cleared: true, updatedAt: Date.now() }; $("discardConfirm").hidden = true; persist(); renderMode(); };
$("btnFinished").onclick = () => openForm("finished", { type: defaultType(), date: ymd(new Date()), start: "", end: hm(new Date()) });

/* ---------------- form ---------------- */
function openForm(mode, d) {
  form = { mode, id: d.id || null, type: d.type || null, q: has(d.quality) ? d.quality : null, e: has(d.exhaustion) ? d.exhaustion : null, images: [...(d.images || [])], links: [...(d.links || [])] };
  $("formTitle").textContent = { end: "Debrief", edit: "Edit session", finished: "Log a finished task" }[mode];
  $("fDate").value = d.date; $("fStart").value = d.start; $("fEnd").value = d.end; $("fNotes").value = d.notes || ""; $("fLink").value = "";
  $("btnSave").textContent = mode === "edit" ? "Save changes" : "Save session";
  $("btnDelete").hidden = mode !== "edit"; $("delConfirm").hidden = true; $("fErr").hidden = true;
  setTab("log"); renderFormBits(); renderFormAttach(); renderMode(); window.scrollTo({ top: 0 });
}
function renderQuick() {
  const el = $("quickStart"); el.innerHTML = ""; const end = $("fEnd").value, date = $("fDate").value; if (!end || !date) return;
  const endTs = tsOf(date, end);
  [15, 30, 45, 60, 90, 120].forEach(m => {
    const b = document.createElement("button"); b.type = "button"; b.textContent = m < 60 ? m + "m" : (m / 60) + "h";
    b.onclick = () => { const s = new Date(endTs - m * 60000); $("fStart").value = hm(s); if (ymd(s) !== date) $("fDate").value = ymd(s); renderFormBits(); };
    el.appendChild(b);
  });
  const prev = sessions.find(s => s.id !== form.id && s.endTs && s.endTs <= endTs);
  if (prev) { const b = document.createElement("button"); b.type = "button"; b.textContent = "after last (" + prev.end + ")"; b.onclick = () => { $("fStart").value = prev.end; $("fDate").value = ymd(new Date(prev.endTs)); renderFormBits(); }; el.appendChild(b); }
}
function renderFormBits() {
  chips($("formChips"), form.type, t => { form.type = t; renderFormBits(); });
  scale($("fQual"), form.q, tQ, v => { form.q = v; renderFormBits(); });
  scale($("fExh"), form.e, tE, v => { form.e = v; renderFormBits(); });
  const d = $("fDate").value, s = $("fStart").value, e = $("fEnd").value;
  $("fDur").textContent = (d && s && e) ? "Duration " + fmtDur(spanMins(d, s, e)) : "Pick when it started";
  renderQuick();
}
function renderFormAttach() { renderAttach($("fThumbs"), $("fLinks"), form, true); }
["fDate", "fStart", "fEnd"].forEach(id => $(id).addEventListener("input", renderFormBits));
$("btnAddLink").onclick = () => { const u = cleanUrl($("fLink").value); if (!u) { toast("That doesn't look like a link"); return; } form.links.push(u); $("fLink").value = ""; renderFormAttach(); };
$("fLink").addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); $("btnAddLink").click(); } });

$("btnSave").onclick = () => {
  const date = $("fDate").value, start = $("fStart").value, end = $("fEnd").value, notes = $("fNotes").value.trim();
  if (!date || !start || !end) { $("fErr").textContent = "Pick a start and end time to save."; $("fErr").hidden = false; return; }
  if (uploading) { $("fErr").textContent = "Wait for the photo to finish adding."; $("fErr").hidden = false; return; }
  const pending = cleanUrl($("fLink").value); if (pending) form.links.push(pending);
  const mins = spanMins(date, start, end), startTs = tsOf(date, start), id = form.id || newId();
  doc.sessions[id] = { id, date, start, end, type: form.type || defaultType(), quality: form.q, exhaustion: form.e, mins, notes, startTs, endTs: startTs + mins * 60000, images: form.images, links: form.links, updatedAt: Date.now() };
  if (form.mode === "end") doc.active = { cleared: true, updatedAt: Date.now() };
  const msg = form.mode === "edit" ? "Session updated" : "Logged " + fmtDur(mins);
  form = { mode: null }; askPersist(); persist(); renderAll(); toast(msg);
};
$("btnCancel").onclick = () => { form = { mode: null }; renderMode(); };
$("btnDelete").onclick = () => { $("delConfirm").hidden = false; };
$("btnDelYes").onclick = () => { doc.sessions[form.id] = { id: form.id, deleted: true, updatedAt: Date.now() }; form = { mode: null }; persist(); renderAll(); toast("Session deleted"); };

/* ---------------- sheet ---------------- */
function td(text, cls, t) { const c = document.createElement("td"); if (cls) c.className = cls; c.textContent = text; if (t !== undefined && t !== null) paint(c, t); return c; }
function renderList() {
  const body = $("sheetBody"); body.innerHTML = "";
  $("listEmpty").hidden = !!sessions.length; $("sheetWrap").hidden = !sessions.length; $("btnMore").hidden = sessions.length <= shown;
  if (!sessions.length) return;
  const rows = sessions.slice(0, shown), maxM = Math.max(240, ...rows.map(s => s.mins));
  rows.forEach(s => {
    const tr = document.createElement("tr");
    tr.append(td(new Date(s.startTs).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" }), "m"), td(s.start, "m"), td(s.end, "m"),
      td(fmtH(s.mins), "m n", s.mins / maxM), td(has(s.quality) ? s.quality : "–", "m c", tQ(s.quality)), td(has(s.exhaustion) ? s.exhaustion : "–", "m c", tE(s.exhaustion)));
    const n = document.createElement("td"); n.className = "note"; const nd = document.createElement("div"); nd.textContent = s.notes || ""; n.appendChild(nd);
    const ni = (s.images || []).length, nl = (s.links || []).length;
    if (ni || nl) { const a = document.createElement("div"); a.className = "att"; a.textContent = [ni ? ni + " photo" + (ni > 1 ? "s" : "") : "", nl ? nl + " link" + (nl > 1 ? "s" : "") : ""].filter(Boolean).join(" · "); n.appendChild(a); }
    tr.append(n, td(s.type, "t")); tr.onclick = () => openForm("edit", s); body.appendChild(tr);
  });
}
$("btnMore").onclick = () => { shown += 50; renderList(); };

/* ---------------- stats ---------------- */
const sum = a => a.reduce((x, y) => x + y, 0), mean = a => { a = a.filter(has); return a.length ? sum(a) / a.length : null; }, f1 = v => v == null ? "–" : v.toFixed(1);
function renderStats() {
  const now = Date.now(), w = sessions.filter(s => s.startTs >= now - 7 * 864e5);
  const h7 = sum(w.map(s => s.mins)) / 60, q7 = mean(w.map(s => s.quality)), e7 = mean(w.map(s => s.exhaustion));
  $("sHours").textContent = h7.toFixed(1); $("sQual").textContent = f1(q7); $("sExh").textContent = f1(e7);
  paint($("tHours"), w.length ? h7 / 30 : null); paint($("tQual"), q7 == null ? null : (q7 - 1) / 4); paint($("tExh"), e7 == null ? null : (5 - e7) / 4);
  const thisMon = mondayOf(new Date()).getTime(), weeks = [];
  for (let i = 7; i >= 0; i--) { const d = new Date(thisMon); d.setDate(d.getDate() - i * 7); weeks.push({ st: d.getTime(), list: [] }); }
  sessions.forEach(s => { const k = mondayOf(new Date(s.startTs)).getTime(); const b = weeks.find(x => x.st === k); if (b) b.list.push(s); });
  weeks.forEach(x => x.h = sum(x.list.map(s => s.mins)) / 60);
  const maxH = Math.max(5, ...weeks.map(x => x.h)), top = Math.ceil(maxH / 5) * 5;
  const W = 320, H = 130, L = 30, B = 18, T = 12, bw = (W - L) / 8; let g = "";
  [0, top / 2, top].forEach(v => { const lab = Number.isInteger(v) ? v : v.toFixed(1); const y = H - B - (v / top) * (H - B - T); g += `<line x1="${L}" x2="${W}" y1="${y}" y2="${y}" stroke="var(--grid)" stroke-width="1"/><text x="${L - 6}" y="${y + 3}" text-anchor="end">${lab}</text>`; });
  weeks.forEach((x, i) => {
    const bh = (x.h / top) * (H - B - T), xx = L + i * bw + bw * .18, ww = bw * .64, last = i === 7;
    g += `<rect x="${xx}" y="${H - B - bh}" width="${ww}" height="${bh}" rx="3" fill="${scaleRGB(x.h / maxH)}" stroke="var(--fg)" stroke-opacity="${last ? .6 : 0}"/>`;
    const d = new Date(x.st); g += `<text x="${xx + ww / 2}" y="${H - 5}" text-anchor="middle">${last ? "now" : d.getDate() + "/" + (d.getMonth() + 1)}</text>`;
    if (x.h > 0) g += `<text x="${xx + ww / 2}" y="${H - B - bh - 3}" text-anchor="middle" style="fill:var(--fg)">${x.h.toFixed(0)}</text>`;
  });
  $("weekChart").innerHTML = g;
  const wb = $("weekBody"); wb.innerHTML = "";
  [...weeks].reverse().forEach((x, i) => {
    const tr = document.createElement("tr"), d = new Date(x.st), q = mean(x.list.map(s => s.quality)), e = mean(x.list.map(s => s.exhaustion));
    tr.append(td(i === 0 ? "This week" : d.toLocaleDateString("en-GB", { day: "numeric", month: "short" }), "m"), td(x.h.toFixed(1), "m n", x.list.length ? x.h / maxH : null),
      td(x.list.length, "m n"), td(f1(q), "m c", q == null ? null : (q - 1) / 4), td(f1(e), "m c", e == null ? null : (5 - e) / 4));
    wb.appendChild(tr);
  });
  const m = sessions.filter(s => s.startTs >= now - 30 * 864e5), tb = $("typeBody"); tb.innerHTML = "";
  const all = [...types()]; m.forEach(s => { if (!all.includes(s.type)) all.push(s.type); });
  const rows = all.map(t => { const a = m.filter(s => s.type === t); return { t, a, h: sum(a.map(s => s.mins)) / 60 }; }).filter(r => r.a.length).sort((x, y) => y.h - x.h), maxT = Math.max(1, ...rows.map(r => r.h));
  rows.forEach(r => {
    const q = mean(r.a.map(s => s.quality)), e = mean(r.a.map(s => s.exhaustion)), tr = document.createElement("tr");
    tr.append(td(r.t), td(r.h.toFixed(1), "m n", r.a.length ? r.h / maxT : null), td(r.a.length, "m n"), td(f1(q), "m c", q == null ? null : (q - 1) / 4), td(f1(e), "m c", e == null ? null : (5 - e) / 4));
    tb.appendChild(tr);
  });
}
function renderAll() { rebuild(); renderMode(); renderList(); renderStats(); renderSyncPill(); }

/* ---------------- GitHub sync ---------------- */
const cfg = () => { try { const c = JSON.parse(ls.get("chmodeCfg") || "null"); return c && c.repo && c.token ? c : null; } catch (e) { return null; } };
function b64utf8(s) { const bytes = new TextEncoder().encode(s); let bin = ""; for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)); return btoa(bin); }
function unb64utf8(b) { const bin = atob(b.replace(/\s/g, "")); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return new TextDecoder().decode(u); }
const blobB64 = blob => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(",")[1]); r.onerror = () => rej(r.error); r.readAsDataURL(blob); });
class GhError extends Error { constructor(status, msg) { super(msg); this.status = status; } }
function ghUrl(path) { const c = cfg(); return "https://api.github.com/repos/" + c.repo + "/contents/" + path.split("/").map(encodeURIComponent).join("/"); }
async function gh(path, opts = {}) {
  const c = cfg(); const url = ghUrl(path) + (opts.method && opts.method !== "GET" ? "" : "?ref=" + encodeURIComponent(c.branch || "main"));
  const res = await fetch(url, { method: opts.method || "GET", cache: "no-store", headers: { Authorization: "Bearer " + c.token, Accept: opts.accept || "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", ...(opts.body ? { "Content-Type": "application/json" } : {}) }, body: opts.body ? JSON.stringify(opts.body) : undefined });
  if (res.status === 404 && opts.allow404) return null;
  if (!res.ok) { let m = ""; try { m = (await res.json()).message || ""; } catch (e) { } throw new GhError(res.status, m); }
  return opts.raw ? res.blob() : res.json();
}
async function ghRaw(path) { return gh(path, { accept: "application/vnd.github.raw", raw: true, allow404: true }); }
async function ghGetText(path) {
  const meta = await gh(path, { allow404: true }); if (!meta) return null;
  let text = meta.content && meta.encoding === "base64" ? unb64utf8(meta.content) : null;
  if (text == null) { const b = await ghRaw(path); text = b ? await b.text() : ""; }
  return { sha: meta.sha, text };
}
async function ghPut(path, b64, sha, message) {
  const c = cfg(); return gh(path, { method: "PUT", body: { message, content: b64, branch: c.branch || "main", ...(sha ? { sha } : {}) } });
}

let syncing = false, syncAgain = false, syncTimer = null, lastErr = null;
function scheduleSync(ms = 1500) { clearTimeout(syncTimer); syncTimer = setTimeout(sync, ms); }
function pendingCount() { const t = +(ls.get("chmodeLastPush") || 0); return Object.values(doc.sessions).filter(s => (s.updatedAt || 0) > t).length; }
function renderSyncPill() {
  const p = $("syncPill"), c = cfg(), n = pendingCount(), last = +(ls.get("chmodeLastSync") || 0);
  p.classList.toggle("warn", !!lastErr && !!c);
  if (!c) { p.textContent = storageOk ? "Saved on this phone · set up backup" : "Not saving — storage full"; return; }
  if (syncing) { p.textContent = "Syncing…"; return; }
  if (!navigator.onLine) { p.textContent = "Offline" + (n ? " · " + n + " waiting" : " · saved on phone"); return; }
  if (lastErr) { p.textContent = "Sync problem · tap to fix"; return; }
  p.textContent = last ? "Synced " + ago(last) + (n ? " · " + n + " waiting" : "") : "Not synced yet";
}
setInterval(renderSyncPill, 30000);
function errText(e) {
  if (!navigator.onLine) return "You're offline. Changes will sync when you're back online.";
  if (e instanceof GhError) {
    if (e.status === 401) return "GitHub rejected the token. Make a new one and paste it in.";
    if (e.status === 403) return "The token can't write to that repo. Give it Contents: Read and write on the data repo.";
    if (e.status === 404) return "Couldn't find that repo. Check the owner/name, and that the token has access to it.";
    if (e.status === 409 || e.status === 422) return "Another device saved at the same moment. Tap Save and sync now to retry.";
    return "GitHub said: " + (e.message || e.status);
  }
  return "Couldn't reach GitHub. Try again in a moment.";
}
async function sync() {
  if (!cfg() || !navigator.onLine) { renderSyncPill(); return { ok: false, offline: !navigator.onLine }; }
  if (syncing) { syncAgain = true; return { ok: false, busy: true }; }
  syncing = true; renderSyncPill(); const started = Date.now();
  try {
    /* 1. photos referenced by sessions that GitHub doesn't have yet */
    const refs = new Set(); Object.values(doc.sessions).forEach(s => (s && !s.deleted ? s.images || [] : []).forEach(r => refs.add(r.id)));
    const imgs = (await imgAll()).filter(r => !r.synced && refs.has(r.id));
    for (const r of imgs) {
      try { await ghPut("data/images/" + r.id + "." + r.ext, await blobB64(r.blob), null, "Add photo"); }
      catch (e) { if (!(e instanceof GhError && e.status === 422)) throw e; } /* 422 = already there */
      r.synced = true; await imgPut(r);
    }
    /* 2. merge the log with GitHub's copy and write it back if anything differs */
    for (let attempt = 0; attempt < 3; attempt++) {
      const remote = await ghGetText("data/log.json");
      let remoteDoc = null; if (remote && remote.text) { try { remoteDoc = JSON.parse(remote.text); } catch (e) { remoteDoc = null; } }
      doc = D.merge(doc, remoteDoc); rebuild(); await kvSet("doc", doc);
      if (remoteDoc && D.sameData(doc, remoteDoc)) break;
      try {
        await ghPut("data/log.json", b64utf8(JSON.stringify(D.toRemote(doc), null, 1)), remote && remote.sha, "Update log (" + sessions.length + " sessions)");
        const csv = await gh("data/log.csv", { allow404: true });
        await ghPut("data/log.csv", b64utf8(D.toCSV(doc)), csv && csv.sha, "Update CSV");
        break;
      } catch (e) { if (!(e instanceof GhError && (e.status === 409 || e.status === 422)) || attempt === 2) throw e; }
    }
    const newest = Object.values(doc.sessions).reduce((m, s) => Math.max(m, (s && s.updatedAt) || 0), 0);
    ls.set("chmodeLastSync", String(Date.now())); ls.set("chmodeLastPush", String(Math.max(started, newest))); lastErr = null;
    renderAll(); return { ok: true };
  } catch (e) {
    lastErr = errText(e); return { ok: false, error: lastErr };
  } finally {
    syncing = false; renderSyncPill(); if ($("pageSync").hidden === false) renderSyncPage();
    if (syncAgain) { syncAgain = false; scheduleSync(500); }
  }
}
window.addEventListener("online", () => { renderSyncPill(); scheduleSync(300); });
window.addEventListener("offline", renderSyncPill);
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") { renderAll(); scheduleSync(300); if (swReg) swReg.update().catch(() => { }); } });

/* ---------------- sync page ---------------- */
function renderSyncPage() {
  const c = cfg() || JSON.parse(ls.get("chmodeCfg") || "{}") || {};
  if (document.activeElement !== $("cfgRepo")) $("cfgRepo").value = c.repo || "";
  if (document.activeElement !== $("cfgBranch")) $("cfgBranch").value = c.branch || "main";
  if (document.activeElement !== $("cfgToken")) $("cfgToken").value = c.token ? "••••••••••" : "";
  $("cfgErr").hidden = !lastErr || !cfg(); $("cfgErr").textContent = lastErr || "";
  const n = Object.values(doc.sessions).filter(s => s && !s.deleted).length;
  $("aboutText").textContent = "App version " + APP_VERSION + " · " + n + " session" + (n === 1 ? "" : "s") + " on this phone" + (cfg() ? " · backing up to " + cfg().repo : "");
}
$("btnSaveCfg").onclick = async () => {
  const repo = $("cfgRepo").value.trim().replace(/^https?:\/\/github\.com\//, "").replace(/\.git$/, "").replace(/\/$/, "");
  const old = cfg() || {}; let token = $("cfgToken").value.trim(); if (/^•+$/.test(token)) token = old.token || "";
  const branch = $("cfgBranch").value.trim() || "main";
  $("cfgErr").hidden = true; $("cfgOk").hidden = true;
  if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) { $("cfgErr").textContent = "Write the repo as owner/name, e.g. reynarvato/Rey-s-CH-MODE-DATA."; $("cfgErr").hidden = false; return; }
  if (!token) { $("cfgErr").textContent = "Paste your GitHub token."; $("cfgErr").hidden = false; return; }
  ls.set("chmodeCfg", JSON.stringify({ repo, token, branch }));
  $("btnSaveCfg").disabled = true; $("btnSaveCfg").textContent = "Syncing…";
  const r = await sync();
  $("btnSaveCfg").disabled = false; $("btnSaveCfg").textContent = "Save and sync now";
  if (r.ok) { $("cfgOk").textContent = "Synced. Your log is in " + repo + "/data."; $("cfgOk").hidden = false; }
  else if (r.offline) { $("cfgOk").textContent = "Saved. It will sync when you're online."; $("cfgOk").hidden = false; }
  renderSyncPage();
};
$("btnForget").onclick = () => { const c = cfg(); if (c) ls.set("chmodeCfg", JSON.stringify({ repo: c.repo, branch: c.branch })); lastErr = null; renderSyncPage(); renderSyncPill(); toast("Token removed. Your log stays on this phone."); };

/* ---------------- import / export ---------------- */
$("importFile").addEventListener("change", async e => {
  const f = e.target.files[0]; e.target.value = ""; if (!f) return;
  const msg = $("importMsg"); msg.hidden = false; msg.className = "okmsg";
  try {
    const r = D.importRows(D.parseCSV(await f.text()), Date.now());
    if (r.error) { msg.className = "err"; msg.textContent = r.error; return; }
    let added = 0, kept = 0; const newTypes = [];
    r.sessions.forEach(s => { const ex = doc.sessions[s.id]; if (ex && !ex.deleted) { kept++; return; } doc.sessions[s.id] = s; added++; if (!types().includes(s.type) && !newTypes.includes(s.type)) newTypes.push(s.type); });
    if (newTypes.length) doc.types = { list: [...types(), ...newTypes], updatedAt: Date.now() };
    await persist(); renderAll();
    msg.textContent = "Imported " + added + " session" + (added === 1 ? "" : "s") + (kept ? ", " + kept + " already here" : "") + (r.skipped ? ", " + r.skipped + " rows skipped (missing date or times)" : "") + ".";
  } catch (err) { msg.className = "err"; msg.textContent = "Couldn't read that file. Save it from Excel as CSV UTF-8 and try again."; }
});
$("btnCsv").onclick = async () => {
  if (!sessions.length) { toast("Nothing to export yet"); return; }
  const name = "chmode-log-" + ymd(new Date()) + ".csv", blob = new Blob([D.toCSV(doc)], { type: "text/csv" });
  try { const file = new File([blob], name, { type: "text/csv" }); if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file] }); return; } } catch (e) { if (e && e.name === "AbortError") return; }
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
};

/* ---------------- app updates ---------------- */
let swReg = null, reloading = false;
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js").then(reg => {
    swReg = reg;
    const show = () => { if (reg.waiting && navigator.serviceWorker.controller) $("updateBanner").hidden = false; };
    show();
    reg.addEventListener("updatefound", () => { const w = reg.installing; if (w) w.addEventListener("statechange", () => { if (w.state === "installed") show(); }); });
  }).catch(() => { });
  navigator.serviceWorker.addEventListener("controllerchange", () => { if (reloading) return; reloading = true; location.reload(); });
}
$("updateBanner").onclick = () => { if (swReg && swReg.waiting) swReg.waiting.postMessage("skipWaiting"); else location.reload(); };
$("btnCheckUpdate").onclick = async () => {
  if (!swReg) { toast("Updates work once the app is installed from its web address."); return; }
  if (!navigator.onLine) { toast("You're offline. Check again when you have signal."); return; }
  try { await swReg.update(); setTimeout(() => { if (!(swReg.waiting || swReg.installing)) toast("You're on the latest version (" + APP_VERSION + ")."); }, 1500); } catch (e) { toast("Couldn't check for updates."); }
};

/* ---------------- boot ---------------- */
(async () => {
  try { const saved = await kvGet("doc"); if (saved && saved.sessions) doc = saved; }
  catch (e) { storageOk = false; toast("This browser won't let the app save. Open it from your home screen, not a private tab."); }
  if (!doc.types) doc.types = { list: [...DEFAULT_TYPES], updatedAt: 0 };
  setTab(ls.get("chmodeTab") === "stats" ? "stats" : "log");
  renderAll(); renderTypes();
  scheduleSync(800);
})();
