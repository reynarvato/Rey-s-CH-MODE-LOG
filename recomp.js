/* Recomp tab — 12-week recomposition experiment (from Recomp_Session_Tracker.xlsx).
   One week on screen at a time: tick exercises and weekly actions, log the 7 days, see the summary.
   Data: doc.recompWeeks["1".."12"] and doc.recompDays["YYYY-MM-DD"], each record merged by updatedAt. */
const RECOMP = {
  start: "2026-10-12", weeks: 12, maintenanceFrom: 11, startKg: 84.0,
  targets: [83.4, 82.8, 82.2, 81.6, 81.0, 80.4, 79.8, 79.2, 78.6, 78.0, 78.0, 78.0],
  sessions: [
    { id: "S1", name: "S1 · Press", ex: ["Bench Press", "Incline DB Press", "Overhead Press", "Dips", "Lateral Raise", "Tricep Ext"] },
    { id: "S2", name: "S2 · Lower", ex: ["Squat", "Romanian Deadlift", "Leg Curl", "Leg Extension", "Calf Raise"] },
    { id: "S3", name: "S3 · Press #2", ex: ["Bench Press", "Lat Pulldown", "Barbell Row", "Face Pull", "Bicep Curl"] },
    { id: "S4", name: "S4 · Lower #2", ex: ["Leg Press", "Bulgarian Split Sq", "Overhead Press", "Lateral Raise", "Calf Raise"] }
  ],
  actions: [
    { id: "weighed", name: "Weighed 7/7", auto: d => d.filter(x => num(x.weight) != null).length >= 7 },
    { id: "food", name: "Food logged 7/7", auto: d => d.filter(x => num(x.kcal) != null).length >= 7 },
    { id: "protein", name: "Protein ≥175 g, 6/7", auto: d => d.filter(x => num(x.protein) >= 175).length >= 6 },
    { id: "steps", name: "Steps ≥10k, 5/7", auto: d => d.filter(x => num(x.steps) >= 10000).length >= 5 },
    { id: "waist", name: "Waist + measurements" },
    { id: "photos", name: "Photos (4 angles)", photoWeeksOnly: true },
    { id: "review", name: "Weekly review + analyse.py" }
  ],
  sessionChoices: ["", "S1 Press", "S2 Lower", "S3 Press2", "S4 Lower2", "BJJ", "Rest"]
};
const TOTAL_EX = RECOMP.sessions.reduce((a, s) => a + s.ex.length, 0); /* 21 */
function num(v) { if (v === "" || v == null) return null; const n = Number(v); return isNaN(n) ? null : n; }

/* ---- dates ---- */
function rStart() { const [y, m, d] = RECOMP.start.split("-").map(Number); return new Date(y, m - 1, d); }
function weekDays(w) { const out = []; for (let i = 0; i < 7; i++) { const d = rStart(); d.setDate(d.getDate() + (w - 1) * 7 + i); out.push(d); } return out; }
function currentWeek() { const t = new Date(); t.setHours(0, 0, 0, 0); const w = Math.floor((t - rStart()) / (7 * 864e5)) + 1; return Math.max(1, Math.min(RECOMP.weeks, w)); }
const photoWeek = w => w % 2 === 0;
const isMaint = w => w >= RECOMP.maintenanceFrom;
const fmtD = d => d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });

/* ---- data access ---- */
function rWeek(w) { return (doc.recompWeeks || {})[String(w)] || { ticks: {}, actions: {}, notes: "" }; }
function rDay(key) { return (doc.recompDays || {})[key] || {}; }
function saveWeek(w, patch) {
  doc.recompWeeks = doc.recompWeeks || {}; const cur = rWeek(w);
  doc.recompWeeks[String(w)] = { ...cur, ...patch, updatedAt: Date.now() }; persist(); renderRecomp();
}
function saveDay(key, field, val) {
  doc.recompDays = doc.recompDays || {}; const cur = rDay(key);
  doc.recompDays[key] = { ...cur, [field]: val, updatedAt: Date.now() }; persist(); renderRecompSummary();
}

/* ---- calculations (match the spreadsheet) ---- */
function weekStats(w) {
  const wk = rWeek(w), days = weekDays(w).map(d => rDay(ymd(d)));
  let ticks = 0, sessionsDone = 0;
  RECOMP.sessions.forEach(s => { let any = false; s.ex.forEach(e => { if (wk.ticks[s.id + "|" + e] === "✓") { ticks++; any = true; } }); if (any) sessionsDone++; });
  let aDone = 0, aTotal = 0;
  RECOMP.actions.forEach(a => {
    if (a.photoWeeksOnly && !photoWeek(w)) return;
    aTotal++; if (actionState(w, a, days) === "✓") aDone++;
  });
  const weights = days.map(d => num(d.weight)).filter(v => v != null);
  const mean = weights.length >= 4 ? weights.reduce((a, b) => a + b, 0) / weights.length : null;
  return { ticks, sessionsDone, training: ticks / TOTAL_EX, actions: aTotal ? aDone / aTotal : 0, mean, target: RECOMP.targets[w - 1], days, any: ticks > 0 || aDone > 0 || weights.length > 0 };
}
function actionState(w, a, days) {
  const v = rWeek(w).actions[a.id];
  if (v) return v;
  if (a.auto && a.auto(days || weekDays(w).map(d => rDay(ymd(d))))) return "✓";
  return "";
}
function rollingMean(key) { /* 7-day mean ending on this day, needs 4+ weights (spreadsheet rule) */
  const [y, m, d] = key.split("-").map(Number), vals = [];
  for (let i = 0; i < 7; i++) { const x = new Date(y, m - 1, d - i); const v = num(rDay(ymd(x)).weight); if (v != null) vals.push(v); }
  return vals.length >= 4 ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
}
const band = p => p >= .85 ? 1 : p >= .70 ? .5 : 0; /* green ≥85 · amber 70–84 · red <70 */
/* share of the week that has happened: 0 before it starts, 1 once it's over. Mid-week, scores are judged pro rata. */
function elapsed(w) { const t = new Date(); t.setHours(0, 0, 0, 0); const d = (t - weekDays(w)[0]) / 864e5 + 1; return Math.max(0, Math.min(1, d / 7)); }
const fair = (p, w) => { const e = elapsed(w); return e <= 0 ? null : band(Math.min(1, p / e)); };

/* ---- render ---- */
let rWeekShown = null;
function renderRecomp() {
  if (rWeekShown == null) rWeekShown = currentWeek();
  const w = rWeekShown, days = weekDays(w), wk = rWeek(w);
  $("rWeekLabel").textContent = "Week " + w + (isMaint(w) ? " · maintenance" : "");
  $("rWeekDates").textContent = fmtD(days[0]) + " – " + fmtD(days[6]);
  $("rPrev").disabled = w <= 1; $("rNext").disabled = w >= RECOMP.weeks;

  /* sessions: one row per session, exercise chips cycle blank → ✓ → ✗ */
  const S = $("rSessions"); S.innerHTML = "";
  RECOMP.sessions.forEach(s => {
    const row = document.createElement("div"); row.className = "rsess";
    const h = document.createElement("div"); h.className = "rsess-h";
    const done = s.ex.filter(e => wk.ticks[s.id + "|" + e] === "✓").length;
    h.innerHTML = ""; const nm = document.createElement("span"); nm.textContent = s.name; const ct = document.createElement("span"); ct.className = "rcount"; ct.textContent = done + "/" + s.ex.length;
    h.append(nm, ct); row.appendChild(h);
    const chips = document.createElement("div"); chips.className = "chips";
    s.ex.forEach(e => {
      const k = s.id + "|" + e, v = wk.ticks[k] || "", b = document.createElement("button");
      b.type = "button"; b.className = "tick" + (v === "✓" ? " yes" : v === "✗" ? " no" : ""); b.textContent = (v ? v + " " : "") + e;
      b.setAttribute("aria-label", e + (v === "✓" ? ", done" : v === "✗" ? ", skipped" : ", not done"));
      b.onclick = () => saveWeek(w, { ticks: { ...wk.ticks, [k]: v === "" ? "✓" : v === "✓" ? "✗" : "" } });
      chips.appendChild(b);
    });
    row.appendChild(chips); S.appendChild(row);
  });

  /* weekly actions */
  const A = $("rActions"); A.innerHTML = "";
  RECOMP.actions.forEach(a => {
    const b = document.createElement("button"); b.type = "button";
    if (a.photoWeeksOnly && !photoWeek(w)) { b.className = "tick na"; b.textContent = a.name + " · n/a"; b.disabled = true; A.appendChild(b); return; }
    const manual = wk.actions[a.id] || "", st = actionState(w, a), auto = !manual && st === "✓";
    b.className = "tick" + (st === "✓" ? " yes" : st === "✗" ? " no" : "") + (auto ? " auto" : "");
    b.textContent = (st ? st + " " : "") + a.name + (auto ? " · auto" : "");
    b.title = a.auto ? "Ticks itself from the daily log; tap to set it by hand" : "";
    b.onclick = () => saveWeek(w, { actions: { ...wk.actions, [a.id]: manual === "" ? (auto ? "✗" : "✓") : manual === "✓" ? "✗" : "" } });
    A.appendChild(b);
  });

  /* daily log: 7 rows, inline inputs */
  const T = $("rDaily"); T.innerHTML = "";
  days.forEach(d => {
    const key = ymd(d), r = rDay(key), tr = document.createElement("tr");
    const t0 = new Date(); t0.setHours(0, 0, 0, 0); if (d.getTime() === t0.getTime()) tr.className = "today";
    const dc = document.createElement("td"); dc.className = "m"; dc.textContent = d.toLocaleDateString("en-GB", { weekday: "short" }) + " " + d.getDate(); tr.appendChild(dc);
    [["weight", "kg", "decimal", 4], ["kcal", "kcal", "numeric", 5], ["protein", "g", "numeric", 4], ["steps", "steps", "numeric", 6], ["sleep", "h", "decimal", 3]].forEach(([f, ph, mode, w2]) => {
      const c = document.createElement("td"), i = document.createElement("input");
      i.type = "text"; i.inputMode = mode; i.placeholder = ph; i.value = r[f] ?? ""; i.className = "cell"; i.style.width = (w2 + 1.4) + "ch"; i.id = "rd-" + key + "-" + f;
      i.onchange = () => { const v = i.value.trim().replace(",", "."); saveDay(key, f, v === "" ? null : (isNaN(Number(v)) ? v : Number(v))); paintDaily(); };
      c.appendChild(i); tr.appendChild(c);
    });
    const mc = document.createElement("td"); mc.className = "m n rmean"; mc.dataset.key = key; tr.appendChild(mc);
    [["session", RECOMP.sessionChoices], ["bjj", ["", "Y", "N"]], ["tier", ["", "A", "B", "C"]]].forEach(([f, opts]) => {
      const c = document.createElement("td"), s = document.createElement("select"); s.className = "cell"; s.id = "rd-" + key + "-" + f;
      opts.forEach(o => { const op = document.createElement("option"); op.value = o; op.textContent = o || "–"; s.appendChild(op); });
      s.value = r[f] || ""; s.onchange = () => saveDay(key, f, s.value || null); c.appendChild(s); tr.appendChild(c);
    });
    const nc = document.createElement("td"), ni = document.createElement("input"); ni.type = "text"; ni.className = "cell"; ni.placeholder = "notes"; ni.style.width = "16ch"; ni.value = r.notes || ""; ni.id = "rd-" + key + "-notes";
    ni.onchange = () => saveDay(key, "notes", ni.value.trim() || null); nc.appendChild(ni); tr.appendChild(nc);
    T.appendChild(tr);
  });
  if (document.activeElement !== $("rNotes")) $("rNotes").value = wk.notes || "";
  paintDaily(); renderRecompSummary();
}
function paintDaily() {
  document.querySelectorAll(".rmean").forEach(c => { const m = rollingMean(c.dataset.key); c.textContent = m == null ? "–" : m.toFixed(1); });
  weekDays(rWeekShown).forEach(d => {
    const k = ymd(d), r = rDay(k), p = $("rd-" + k + "-protein"), s = $("rd-" + k + "-steps");
    if (p) paint(p.parentNode, num(r.protein) == null ? null : num(r.protein) >= 175 ? 1 : num(r.protein) >= 150 ? .5 : 0);
    if (s) paint(s.parentNode, num(r.steps) == null ? null : num(r.steps) >= 10000 ? 1 : num(r.steps) >= 7000 ? .5 : 0);
  });
}
function renderRecompSummary() {
  const w = rWeekShown; if (w == null) return; const st = weekStats(w);
  $("rsSessions").textContent = st.sessionsDone + "/4"; paint($("rsSessionsT"), fair(st.sessionsDone / 4, w));
  $("rsTraining").textContent = Math.round(st.training * 100) + "%"; paint($("rsTrainingT"), fair(st.training, w));
  $("rsActions").textContent = Math.round(st.actions * 100) + "%"; paint($("rsActionsT"), elapsed(w) < 1 ? null : band(st.actions));
  $("rsWeight").textContent = st.mean == null ? "–" : st.mean.toFixed(1);
  $("rsTarget").textContent = "target " + st.target.toFixed(1) + " kg";
  paint($("rsWeightT"), st.mean == null ? null : st.mean <= st.target + .2 ? 1 : st.mean <= st.target + .6 ? .5 : 0);
  /* all-weeks overview: row = week */
  const B = $("rOverview"); B.innerHTML = ""; let tTicks = 0, tSess = 0, tA = 0, tAT = 0;
  for (let i = 1; i <= RECOMP.weeks; i++) {
    const s = weekStats(i), tr = document.createElement("tr");
    if (i === w) tr.className = "today";
    tr.append(td("W" + i + (isMaint(i) ? " ·M" : ""), "m"), td(s.sessionsDone + "/4", "m c", fair(s.sessionsDone / 4, i)),
      td(Math.round(s.training * 100) + "%", "m n", fair(s.training, i)), td(Math.round(s.actions * 100) + "%", "m n", elapsed(i) < 1 ? null : band(s.actions)),
      td(s.target.toFixed(1), "m n"), td(s.mean == null ? "–" : s.mean.toFixed(1), "m n", s.mean == null ? null : s.mean <= s.target + .2 ? 1 : s.mean <= s.target + .6 ? .5 : 0));
    tr.onclick = () => { rWeekShown = i; renderRecomp(); $("pageRecomp").scrollIntoView({ block: "start" }); };
    B.appendChild(tr);
    if (i <= 10) { tTicks += s.ticks; tSess += s.sessionsDone; RECOMP.actions.forEach(a => { if (a.photoWeeksOnly && !photoWeek(i)) return; tAT++; if (actionState(i, a, s.days) === "✓") tA++; }); }
  }
  $("rTotal").textContent = "Weeks 1–10: " + tSess + " sessions · training " + Math.round(tTicks / (TOTAL_EX * 10) * 100) + "% · actions " + Math.round(tA / tAT * 100) + "%. Design point 85%; below 70% two weeks running → fix the schedule, not the diet.";
  renderWeightChart();
}
function renderWeightChart() {
  const W = 320, H = 120, L = 30, R2 = 8, T = 10, B = 18;
  const pts = []; for (let i = 0; i < RECOMP.weeks * 7; i++) { const d = rStart(); d.setDate(d.getDate() + i); const m = rollingMean(ymd(d)); if (m != null) pts.push([i, m]); }
  const tg = RECOMP.targets.map((v, i) => [i * 7 + 6, v]); tg.unshift([0, RECOMP.startKg]);
  const ys = [...pts.map(p => p[1]), ...tg.map(p => p[1])], lo = Math.floor(Math.min(...ys) - .5), hi = Math.ceil(Math.max(...ys) + .5);
  const x = i => L + (i / (RECOMP.weeks * 7 - 1)) * (W - L - R2), y = v => T + (hi - v) / (hi - lo) * (H - T - B);
  let g = "";
  [lo, (lo + hi) / 2, hi].forEach(v => { g += `<line x1="${L}" x2="${W - R2}" y1="${y(v)}" y2="${y(v)}" stroke="var(--grid)"/><text x="${L - 5}" y="${y(v) + 3}" text-anchor="end">${Number.isInteger(v) ? v : v.toFixed(1)}</text>`; });
  [1, 4, 7, 10, 12].forEach(wn => { g += `<text x="${x((wn - 1) * 7 + 3)}" y="${H - 4}" text-anchor="middle">W${wn}</text>`; });
  g += `<path d="${tg.map((p, i) => (i ? "L" : "M") + x(p[0]).toFixed(1) + " " + y(p[1]).toFixed(1)).join("")}" fill="none" stroke="var(--muted)" stroke-width="1.2" stroke-dasharray="4 3"/>`;
  if (pts.length) {
    g += `<path d="${pts.map((p, i) => (i ? "L" : "M") + x(p[0]).toFixed(1) + " " + y(p[1]).toFixed(1)).join("")}" fill="none" stroke="var(--accent)" stroke-width="2"/>`;
    const lp = pts[pts.length - 1]; g += `<circle cx="${x(lp[0])}" cy="${y(lp[1])}" r="3" fill="var(--accent)"/><text x="${Math.min(x(lp[0]) + 5, W - 30)}" y="${y(lp[1]) - 6}" style="fill:var(--fg)">${lp[1].toFixed(1)}</text>`;
  }
  $("rChart").innerHTML = g;
  $("rChartNote").textContent = pts.length ? "Solid: your 7-day mean weight. Dashed: target (0.6 kg/week, holding at 78.0 kg in weeks 11–12)." : "Your 7-day mean weight appears here once 4 days of weights are logged. Dashed line: target.";
}

/* ---- daily_log.csv in the column order analyse.py expects ---- */
function recompDailyCSV() {
  const rows = [["Date", "Day", "Week", "Weight kg", "7-day mean", "kcal", "Protein g", "Steps", "Sleep h", "Trained", "Session", "BJJ", "Tier", "Notes"]];
  for (let w = 1; w <= RECOMP.weeks; w++) weekDays(w).forEach(d => {
    const k = ymd(d), r = rDay(k), m = rollingMean(k), s = r.session || "";
    const trained = s ? (/^S\d|BJJ/.test(s) ? "Y" : "N") : (r.bjj === "Y" ? "Y" : "");
    rows.push([k, d.toLocaleDateString("en-GB", { weekday: "short" }), w, r.weight ?? "", m == null ? "" : m.toFixed(2), r.kcal ?? "", r.protein ?? "", r.steps ?? "", r.sleep ?? "", trained, s, r.bjj || "", r.tier || "", r.notes || ""]);
  });
  const q = v => { v = String(v ?? ""); return /[",\r\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
  return rows.map(r => r.map(q).join(",")).join("\r\n");
}
function recompHasData() { return Object.keys(doc.recompDays || {}).length || Object.keys(doc.recompWeeks || {}).length; }

$("rPrev").onclick = () => { if (rWeekShown > 1) { rWeekShown--; renderRecomp(); } };
$("rNext").onclick = () => { if (rWeekShown < RECOMP.weeks) { rWeekShown++; renderRecomp(); } };
$("rNotes").addEventListener("change", () => saveWeek(rWeekShown, { notes: $("rNotes").value.trim() }));
$("rCsv").onclick = async () => {
  const name = "daily_log.csv", blob = new Blob([recompDailyCSV()], { type: "text/csv" });
  try { const file = new File([blob], name, { type: "text/csv" }); if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file] }); return; } } catch (e) { if (e && e.name === "AbortError") return; }
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
};
