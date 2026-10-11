/* Pure data helpers shared by the app, the tests and nothing else.
   Works as a browser global (window.ChmodeData) and as a CommonJS module. */
(function (root) {
  const CSV_HEADER = ["Date", "Start", "Type", "End", "Quality", "Exhaustion", "Duration (h)", "Notes", "Links", "Photos"];

  /* Merge two log documents. Every record carries updatedAt (ms); the newer one wins.
     Deleted sessions stay as tombstones ({deleted:true}) so a delete on one device
     isn't undone by the other device's older copy. */
  function merge(local, remote) {
    local = local || {}; remote = remote || {};
    const out = { version: 1, sessions: {}, types: null, active: null, prefs: null };
    const ls = local.sessions || {}, rs = toMap(remote.sessions);
    const ids = new Set([...Object.keys(ls), ...Object.keys(rs)]);
    ids.forEach(id => {
      const a = ls[id], b = rs[id];
      out.sessions[id] = !a ? b : !b ? a : ((b.updatedAt || 0) > (a.updatedAt || 0) ? b : a);
    });
    out.types = newer(local.types, remote.types);
    out.active = newer(local.active, remote.active);
    out.prefs = newer(local.prefs, remote.prefs);
    out.recompWeeks = mergeMap(local.recompWeeks, remote.recompWeeks);
    out.recompDays = mergeMap(local.recompDays, remote.recompDays);
    return out;
  }
  function mergeMap(a, b) { a = a || {}; b = b || {}; const o = {}; new Set([...Object.keys(a), ...Object.keys(b)]).forEach(k => { o[k] = newer(a[k], b[k]); }); return o; }
  function newer(a, b) { if (!a) return b || null; if (!b) return a; return (b.updatedAt || 0) > (a.updatedAt || 0) ? b : a; }
  function toMap(s) {
    if (!s) return {};
    if (Array.isArray(s)) { const m = {}; s.forEach(x => { if (x && x.id) m[x.id] = x; }); return m; }
    return s;
  }
  /* The shape written to the repo: sessions as an array sorted oldest first, so diffs read like a log. */
  function toRemote(doc) {
    const sessions = Object.values(doc.sessions || {}).sort((a, b) => (a.startTs || 0) - (b.startTs || 0) || (a.id < b.id ? -1 : 1));
    return { version: 1, types: doc.types || null, active: doc.active || null, prefs: doc.prefs || null, recompWeeks: sortKeys(doc.recompWeeks), recompDays: sortKeys(doc.recompDays), sessions };
  }
  function sortKeys(m) { const o = {}; Object.keys(m || {}).sort((x, y) => x.localeCompare(y, undefined, { numeric: true })).forEach(k => { o[k] = m[k]; }); return o; }
  function sameData(a, b) { return JSON.stringify(toRemote(a)) === JSON.stringify(toRemote(b)); }

  /* ---- CSV ---- */
  function csvCell(v) { v = v == null ? "" : String(v); return /[",\r\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }
  function toCSV(doc) {
    const rows = [CSV_HEADER];
    toRemote(doc).sessions.filter(s => !s.deleted).forEach(s => rows.push([
      s.date, s.start, s.type, s.end,
      isScore(s.quality) ? s.quality : "", isScore(s.exhaustion) ? s.exhaustion : "",
      (s.mins / 60).toFixed(2), s.notes || "", (s.links || []).join(" "), (s.images || []).length || ""
    ]));
    return "﻿" + rows.map(r => r.map(csvCell).join(",")).join("\r\n");
  }
  function parseCSV(text) {
    text = text.replace(/^﻿/, "");
    const delim = (text.split(/\r?\n/)[0].match(/;/g) || []).length > (text.split(/\r?\n/)[0].match(/,/g) || []).length ? ";" : ",";
    const rows = []; let row = [], cell = "", q = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) { if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
      else if (c === '"') q = true;
      else if (c === delim) { row.push(cell); cell = ""; }
      else if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i++; row.push(cell); rows.push(row); row = []; cell = ""; }
      else cell += c;
    }
    if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
    return rows.filter(r => r.some(x => String(x).trim() !== ""));
  }
  function isScore(v) { return typeof v === "number" && v >= 1 && v <= 5; }
  const pad = n => String(n).padStart(2, "0");
  function normDate(v) {
    v = String(v || "").trim(); let m;
    if ((m = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/))) return m[1] + "-" + pad(m[2]) + "-" + pad(m[3]);
    if ((m = v.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})/))) { let y = m[3]; if (y.length === 2) y = "20" + y; return y + "-" + pad(m[2]) + "-" + pad(m[1]); } /* UK day-first */
    if (/^\d{5}(\.\d+)?$/.test(v)) { const d = new Date(Date.UTC(1899, 11, 30) + Math.floor(+v) * 864e5); return d.getUTCFullYear() + "-" + pad(d.getUTCMonth() + 1) + "-" + pad(d.getUTCDate()); } /* Excel serial */
    return null;
  }
  function normTime(v) {
    v = String(v || "").trim(); let m;
    if ((m = v.match(/(\d{1,2}):(\d{2})(?::\d{2})?\s*([ap]\.?m\.?)?/i))) {
      let h = +m[1]; const ap = (m[3] || "").toLowerCase();
      if (ap.startsWith("p") && h < 12) h += 12; if (ap.startsWith("a") && h === 12) h = 0;
      return h < 24 && +m[2] < 60 ? pad(h) + ":" + m[2] : null;
    }
    if (/^0?\.\d+$/.test(v) || /^[01](\.0+)?$/.test(v)) { const t = Math.round(parseFloat(v) * 1440) % 1440; return pad(Math.floor(t / 60)) + ":" + pad(t % 60); } /* Excel fraction of a day */
    if ((m = v.match(/^(\d{1,2})(\d{2})$/))) return +m[1] < 24 && +m[2] < 60 ? pad(+m[1]) + ":" + m[2] : null; /* 0930 */
    return null;
  }
  function score(v) { const n = parseInt(String(v || "").trim(), 10); return n >= 1 && n <= 5 ? n : null; }
  function tsOf(date, time) { const [y, mo, d] = date.split("-").map(Number); const [h, mi] = time.split(":").map(Number); return new Date(y, mo - 1, d, h, mi).getTime(); }
  function spanMins(date, s, e) { let a = tsOf(date, s), b = tsOf(date, e); if (b <= a) b += 864e5; return Math.round((b - a) / 60000); }

  /* Turn CSV rows (e.g. an export of the old Excel log) into sessions. Headers are matched loosely. */
  function importRows(rows, now) {
    if (rows.length < 2) return { sessions: [], skipped: 0, error: "The file has no rows below the header." };
    const h = rows[0].map(x => String(x).toLowerCase().trim());
    const find = (...keys) => h.findIndex(x => keys.some(k => x === k || x.startsWith(k)));
    const col = {
      date: find("date", "day"), start: find("start"), end: find("end", "finish", "stop"),
      type: find("type", "kind", "category", "work"), q: find("quality", "q"), e: find("exhaustion", "exhausted", "e", "tired"),
      notes: find("notes", "note", "comment", "debrief"), links: find("links")
    };
    if (col.date < 0 || col.start < 0 || col.end < 0) return { sessions: [], skipped: 0, error: "Couldn't find Date, Start and End columns in the header row." };
    const out = []; let skipped = 0;
    rows.slice(1).forEach(r => {
      const date = normDate(r[col.date]), start = normTime(r[col.start]), end = normTime(r[col.end]);
      if (!date || !start || !end) { skipped++; return; }
      const mins = spanMins(date, start, end), startTs = tsOf(date, start);
      out.push({
        id: "imp-" + date + "-" + start.replace(":", ""),
        date, start, end, type: col.type >= 0 && String(r[col.type] || "").trim() ? String(r[col.type]).trim() : "Imported",
        quality: col.q >= 0 ? score(r[col.q]) : null, exhaustion: col.e >= 0 ? score(r[col.e]) : null,
        mins, startTs, endTs: startTs + mins * 60000,
        notes: col.notes >= 0 ? String(r[col.notes] || "").trim() : "",
        links: col.links >= 0 ? String(r[col.links] || "").split(/\s+/).filter(Boolean) : [],
        images: [], updatedAt: now
      });
    });
    return { sessions: out, skipped };
  }

  const api = { merge, toRemote, sameData, toCSV, parseCSV, importRows, normDate, normTime, spanMins, tsOf, isScore, CSV_HEADER };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.ChmodeData = api;
})(typeof self !== "undefined" ? self : this);
