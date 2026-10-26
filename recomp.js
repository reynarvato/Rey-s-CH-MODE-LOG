/* Recomp tab — 12-week recomposition experiment (from Recomp_Session_Tracker.xlsx).
   One week on screen at a time: tick exercises and weekly actions, log the 7 days, see the summary.
   Data: doc.recompWeeks["1".."12"] and doc.recompDays["YYYY-MM-DD"], each record merged by updatedAt. */
const P = (sets, lo, hi, kg, inc, o = {}) => ({ sets, lo, hi, kg, inc, ...o });
/* Rep ranges: M = mid-rep lifts 6–10, H = high-rep lifts 10–16. Starting kg = Rey's working weights from the Setgraph export (11–25 Oct). */
const M = (sets, kg, inc, o) => P(sets, 6, 10, kg, inc, o), H = (sets, kg, inc, o) => P(sets, 10, 16, kg, inc, o);
const LOWER1 = { id: "S2", name: "S2 · Lower", ex: ["Squat", "Romanian Deadlift", "Leg Curl", "Leg Extension", "Calf Raise"],
  rx: { "Squat": M(3, 51.3, 5), "Romanian Deadlift": M(3, 60, 5), "Leg Curl": H(3, 39, 2.5), "Leg Extension": H(2, 59, 2.5), "Calf Raise": H(3, 130, 10) } };
const LOWER2 = { id: "S4", name: "S4 · Lower #2", ex: ["Leg Press", "Single Leg Press", "Leg Curl", "Calf Raise"],
  rx: { "Leg Press": M(3, 120, 5), "Single Leg Press": M(3, 75, 5), "Leg Curl": H(3, 39, 2.5), "Calf Raise": H(3, 130, 10) } };
const RECOMP = {
  start: "2026-10-12", weeks: 12, maintenanceFrom: 11, startKg: 84.0,
  targets: [83.4, 82.8, 82.2, 81.6, 81.0, 80.4, 79.8, 79.2, 78.6, 78.0, 78.0, 78.0],
  /* Programme by phase: the newest phase whose `from` week is ≤ the week shown applies.
     Tick and log keys are "S1|<exercise name>", so earlier weeks keep their data when a later phase changes.
     rx = default plan per exercise: sets × lo–hi reps @ kg, +inc when progression is earned.
     Your own edits and accepted progressions (doc.recompPlan) override these defaults from the week they start. */
  phases: [
    { from: 1, sessions: [
      { id: "S1", name: "S1 · Press", ex: ["Bench Press", "Incline DB Press", "Overhead Press", "Dips", "Lateral Raise", "Tricep Ext"] },
      { id: "S2", name: "S2 · Lower", ex: ["Squat", "Romanian Deadlift", "Leg Curl", "Leg Extension", "Calf Raise"] },
      { id: "S3", name: "S3 · Press #2", ex: ["Bench Press", "Lat Pulldown", "Barbell Row", "Face Pull", "Bicep Curl"] },
      { id: "S4", name: "S4 · Lower #2", ex: ["Leg Press", "Bulgarian Split Sq", "Overhead Press", "Lateral Raise", "Calf Raise"] }
    ] },
    { from: 3, label: "Shoulder deload · week 3", sessions: [
      { id: "S1", name: "S1 · Press", ex: ["Bench Press", "Seated Cable Row", "Lat Pulldown", "Rear Delt Fly", "Tricep Ext"],
        rx: { "Bench Press": M(4, 40, 2.5), "Seated Cable Row": M(3, 45, 2.5), "Lat Pulldown": M(3, 55.3, 2.5), "Rear Delt Fly": H(3, 39, 6), "Tricep Ext": H(2, 10.2, 1) } },
      LOWER1,
      { id: "S3", name: "S3 · Press #2", ex: ["Bench Press", "Barbell Row", "Lat Pulldown", "Bicep Curl"],
        rx: { "Bench Press": M(3, 40, 2.5), "Barbell Row": M(3, 50, 2.5), "Lat Pulldown": M(3, 55.3, 2.5), "Bicep Curl": H(2, 14.7, 1) } },
      LOWER2
    ], rules: [
      "No overhead press, laterals, incline or dips this week.",
      "Warm-up: cable external rotation only, 12 per side, lightest setting."
    ] },
    { from: 4, label: "Overhead back in · from week 4", sessions: [
      { id: "S1", name: "S1 · Press", ex: ["Bench Press", "Overhead Press", "Seated Cable Row", "Lat Pulldown", "Rear Delt Fly", "Tricep Ext"],
        rx: { "Bench Press": M(4, 40, 2.5), "Overhead Press": M(3, 21.3, 1, { shoulder: true }), "Seated Cable Row": M(3, 45, 2.5), "Lat Pulldown": M(3, 55.3, 2.5), "Rear Delt Fly": H(3, 39, 6), "Tricep Ext": H(2, 10.2, 1) } },
      LOWER1,
      { id: "S3", name: "S3 · Press #2", ex: ["Bench Press", "Barbell Row", "Lat Pulldown", "Lateral Raise", "Bicep Curl"],
        rx: { "Bench Press": M(3, 40, 2.5), "Barbell Row": M(3, 50, 2.5), "Lat Pulldown": M(3, 55.3, 2.5), "Lateral Raise": H(2, 6, 1, { shoulder: true }), "Bicep Curl": H(2, 14.7, 1) } },
      LOWER2
    ], rules: [
      "Overhead press on S1, laterals on S3 only, and only if the shoulder is pain-free.",
      "Shoulder lifts ◆ go up one step at a time. Incline and dips stay out until the physio has seen it."
    ] }
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
function phaseFor(w) { return RECOMP.phases.filter(p => p.from <= w).pop(); }
function sessionsFor(w) { return phaseFor(w).sessions; }
function totalEx(w) { return sessionsFor(w).reduce((a, s) => a + s.ex.length, 0); }
/* ---- plan + progression ----
   Plans are per lift name ("Bench Press"), not per session, so a progression earned on any day carries into every
   later session and week that has that lift. doc.recompPlan[name].changes = [{ from: week, plan: { only the fields changed } }];
   the plan for week w = the default for that session (rx) + every change with from ≤ w, applied in order. */
const PLAN_FIELDS = ["sets", "lo", "hi", "kg", "inc"];
const r25 = v => Math.round(v * 4) / 4;
function rxFor(sid, e, w) {
  const here = sessionsFor(w), own = here.find(x => x.id === sid);
  if (own && own.rx && own.rx[e]) return own.rx[e];
  for (const s of here) if (s.rx && s.rx[e]) return s.rx[e];
  for (const ph of [...RECOMP.phases].reverse()) for (const s of ph.sessions) if (s.rx && s.rx[e]) return s.rx[e];
  return null;
}
function planChanges(sid, e) { const m = doc.recompPlan || {}; return [...((m[e] || {}).changes || []), ...((m[sid + "|" + e] || {}).changes || [])]; }
function planFor(sid, e, w) {
  const base = rxFor(sid, e, w), ch = planChanges(sid, e).filter(x => x.from <= w).sort((a, b) => a.from - b.from || a.at - b.at);
  if (!base && !ch.length) return null;
  const out = { ...(base || P(3, 8, 12, null, 2.5)) };
  ch.forEach(c => PLAN_FIELDS.forEach(f => { if (c.plan[f] !== undefined && c.plan[f] !== null) out[f] = c.plan[f]; }));
  out.custom = ch.length > 0; return out;
}
/* A change applies from week `from` onwards and replaces this lift's changes from that week on. */
function setPlan(name, from, plan, noRender) {
  doc.recompPlan = doc.recompPlan || {};
  const keep = ((doc.recompPlan[name] || {}).changes || []).filter(x => x.from < from), clean = {};
  PLAN_FIELDS.forEach(f => { if (plan[f] !== undefined) clean[f] = plan[f] == null || plan[f] === "" ? null : Number(plan[f]); });
  keep.push({ from, plan: clean, at: Date.now() });
  doc.recompPlan[name] = { changes: keep, updatedAt: Date.now() };
  if (!noRender) { persist(); renderRecomp(); }
}
function dropPlanWeek(name, w) {
  const cur = (doc.recompPlan || {})[name]; if (!cur) return;
  doc.recompPlan[name] = { changes: cur.changes.filter(x => x.from !== w), updatedAt: Date.now() }; persist(); renderRecomp();
}
/* v1.5 stored plans per session ("S1|Bench Press"). Fold them into the per-lift plan once; the old key is emptied
   (not deleted) so the other device's copy doesn't bring it back on merge. */
function migratePlans() {
  const m = doc.recompPlan || {}; let changed = false;
  Object.keys(m).filter(k => k.includes("|") && (m[k].changes || []).length).forEach(k => {
    const name = k.split("|")[1], own = (m[name] || {}).changes || [];
    m[name] = { changes: [...m[k].changes, ...own].sort((a, b) => a.from - b.from || a.at - b.at), updatedAt: Date.now() };
    m[k] = { changes: [], updatedAt: Date.now() }; changed = true;
  });
  if (changed) persist();
}
function rLog(w, key) { return (rWeek(w).logs || {})[key] || null; }
function saveLog(w, key, patch) {
  const wk = rWeek(w), L = { ...(rLog(w, key) || {}), ...patch }, logs = { ...(wk.logs || {}), [key]: L };
  const [sid, e] = key.split("|"), p = planFor(sid, e, w), ticks = { ...wk.ticks };
  if (p && workSets(L, p).length >= p.sets && !ticks[key]) ticks[key] = "✓";
  saveWeek(w, { logs, ticks });
}
/* Working sets from a log: imported Setgraph sets as they are, or hand-entered reps at one weight. */
function workSets(L, p) {
  if (!L) return [];
  if (Array.isArray(L.sets)) return L.sets.filter(x => num(x.reps) != null).map(x => ({ kg: num(x.kg), reps: num(x.reps) }));
  const kg = num(L.kg) ?? (p ? p.kg : null);
  return (L.reps || []).map(num).filter(r => r != null).map(r => ({ kg, reps: r }));
}
/* All logs for a lift in a week, whichever session it was done in. */
function logsByName(w, e) { return Object.entries(rWeek(w).logs || {}).filter(([k]) => k.split("|")[1] === e).map(([, L]) => L); }
const fmtSets = ss => ss.map(x => x.reps + "×" + (x.kg == null ? "?" : Math.round(x.kg * 100) / 100)).join(", ");
/* Did this log earn the next step? Top of the rep range on 2 sets at ≥ plan weight → +step next week.
   2 sets of at least the bottom of the range at a heavier weight than planned → offer that weight as the plan.
   Shoulder lifts: a step over 5% needs the target hit two weeks running. Pain on the day always holds. */
function verdict(sid, e, w) {
  const key = sid + "|" + e, p = planFor(sid, e, w), L = rLog(w, key);
  if (!p || !L) return null;
  const ss = workSets(L, p);
  if (ss.length < 2) return { state: "partial", text: "Log at least 2 sets to check progression." };
  if (ss.some(x => x.kg == null)) return { state: "partial", text: "Add the weight you used." };
  if (L.pain) return { state: "hold", text: "Pain flagged: hold here next week." };
  const top = ss.filter(x => x.reps >= p.hi).map(x => x.kg).sort((a, b) => b - a);
  const okLo = ss.filter(x => x.reps >= p.lo).map(x => x.kg).sort((a, b) => b - a);
  let next = null, why = "";
  if (p.kg == null) { if (okLo.length >= 2) { next = okLo[1]; why = "Make " + okLo[1] + " kg the plan"; } }
  else if (top.length >= 2 && top[1] >= p.kg) { next = r25(top[1] + (p.inc || 0)); why = "Hit " + p.hi + " on 2 sets at " + top[1] + " kg → " + next + " kg next week"; }
  else if (okLo.length >= 2 && okLo[1] > p.kg) { next = okLo[1]; why = "2 sets of " + p.lo + "+ at " + okLo[1] + " kg → make " + okLo[1] + " kg the plan"; }
  if (next == null) return { state: "hold", text: "Not yet: " + p.hi + " reps on 2 sets at " + fmtKg(p.kg) + " (you did " + fmtSets(ss) + ")." };
  if (p.kg != null && next <= p.kg) return { state: "hold", text: "On plan. Same again next week." };
  if (p.shoulder && p.kg && next > r25(p.kg + (p.inc || 0))) { next = r25(p.kg + (p.inc || 0)); why = why.replace(/ → .*$/, "") + " → one step only on a shoulder lift: " + next + " kg next week"; } /* never a jump to whatever you lifted */
  if (p.shoulder && p.kg && next > p.kg * 1.05 + 1e-9) {
    const prevMet = w > 1 && logsByName(w - 1, e).some(L2 => !L2.pain && workSets(L2, planFor(sid, e, w - 1)).filter(x => x.reps >= p.hi && x.kg >= p.kg).length >= 2);
    if (!prevMet) return { state: "cap", next, text: why + ", but that's over the 5% shoulder cap. Hit it again next week first." };
  }
  return { state: "ready", next, text: why + "." };
}
/* A verdict whose next weight is already in next week's plan has been accepted. */
function pendingVerdict(sid, e, w) {
  const v = verdict(sid, e, w); if (!v || v.next == null) return v;
  const n = planFor(sid, e, w + 1); return n && n.kg === v.next ? { ...v, accepted: true } : v;
}
const fmtKg = v => v == null ? "set kg" : (Math.round(v * 100) / 100) + " kg";
const fmtPlan = p => fmtKg(p.kg) + " · goal " + p.hi + " reps ×2";
const fmtGoal = p => "Goal: " + fmtKg(p.kg) + " for " + p.hi + " reps on 2 sets (" + p.sets + " sets planned)" + (p.kg != null && p.inc ? ", then " + fmtKg(r25(p.kg + p.inc)) : "") + ".";
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
  sessionsFor(w).forEach(s => { let any = false; s.ex.forEach(e => { if (wk.ticks[s.id + "|" + e] === "✓") { ticks++; any = true; } }); if (any) sessionsDone++; });
  let aDone = 0, aTotal = 0;
  RECOMP.actions.forEach(a => {
    if (a.photoWeeksOnly && !photoWeek(w)) return;
    aTotal++; if (actionState(w, a, days) === "✓") aDone++;
  });
  const weights = days.map(d => num(d.weight)).filter(v => v != null);
  const mean = weights.length >= 4 ? weights.reduce((a, b) => a + b, 0) / weights.length : null;
  return { ticks, sessionsDone, training: ticks / totalEx(w), actions: aTotal ? aDone / aTotal : 0, mean, target: RECOMP.targets[w - 1], days, any: ticks > 0 || aDone > 0 || weights.length > 0 };
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

/* ---- Setgraph import ----
   Reads Setgraph's "Set export" CSV (Exercise, Date, Repetitions, Weight (kg)), maps exercise names to the plan,
   drops the warm-up (the first set at each lift, when it's lighter than the heaviest set),
   works out which session each training day was from the lifts in it, and fills that week's logs and ticks. */
const SG_ALIAS = { "incline bench press": "Incline DB Press", "incline db press": "Incline DB Press", "overhead dumbell press": "Overhead Press", "overhead dumbbell press": "Overhead Press", "overhead press": "Overhead Press", "assisted dip": "Dips", "dip": "Dips", "dips": "Dips", "db lateral raises": "Lateral Raise", "lateral raises": "Lateral Raise", "tricep extensions ovhd": "Tricep Ext", "tricep extension": "Tricep Ext", "standing calf raise": "Calf Raise", "machine rear delt fly": "Rear Delt Fly", "rear delt fly": "Rear Delt Fly", "leg press 45": "Leg Press", "rdl": "Romanian Deadlift", "bulgarian split squat": "Bulgarian Split Sq" };
const SESSION_LABEL = { S1: "S1 Press", S2: "S2 Lower", S3: "S3 Press2", S4: "S4 Lower2" };
function allLiftNames() { const n = new Set(); RECOMP.phases.forEach(ph => ph.sessions.forEach(s => s.ex.forEach(e => n.add(e)))); return [...n]; }
function sgName(x) { const k = String(x || "").trim().toLowerCase(); return SG_ALIAS[k] || allLiftNames().find(n => n.toLowerCase() === k) || null; }
function weekOf(dateStr) { const [y, m, d] = dateStr.split("-").map(Number); return Math.floor((new Date(y, m - 1, d) - rStart()) / (7 * 864e5)) + 1; }
function importSetgraph(text) {
  const rows = D.parseCSV(text); if (rows.length < 2) return "That file is empty.";
  const h = rows[0].map(x => String(x).trim().toLowerCase());
  if (h.includes("activity type")) return "That's Setgraph's Sessions export, which has no sets in it. Export the Set export instead (Setgraph_Set_Export_….csv).";
  const ci = { ex: h.indexOf("exercise"), date: h.indexOf("date"), reps: h.indexOf("repetitions"), kg: h.indexOf("weight (kg)") };
  if (Object.values(ci).some(i => i < 0)) return "Couldn't find Exercise, Date, Repetitions and Weight (kg) columns.";
  const days = {}, unmatched = new Set();
  rows.slice(1).forEach(r => {
    const dt = String(r[ci.date] || "").trim(), day = dt.slice(0, 10); if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return;
    const w = weekOf(day); if (w < 1 || w > RECOMP.weeks) return;
    const name = sgName(r[ci.ex]); if (!name) { unmatched.add(String(r[ci.ex]).trim()); return; }
    const reps = num(r[ci.reps]), kg = num(r[ci.kg]); if (reps == null) return;
    ((days[day] = days[day] || {})[name] = days[day][name] || []).push({ t: dt, kg: kg ?? 0, reps });
  });
  let nSets = 0; const usedByWeek = {}, touched = new Set();
  Object.keys(days).sort().forEach(day => {
    const w = weekOf(day), lifts = days[day], names = Object.keys(lifts), sess = sessionsFor(w);
    usedByWeek[w] = usedByWeek[w] || new Set();
    const sid = sess.map(s => ({ id: s.id, score: names.filter(n => s.ex.includes(n)).length * 2 - (usedByWeek[w].has(s.id) ? 1 : 0) }))
      .sort((a, b) => b.score - a.score)[0].id;
    usedByWeek[w].add(sid);
    const wk = rWeek(w), logs = { ...(wk.logs || {}) }, ticks = { ...wk.ticks }, ex = sess.find(s => s.id === sid).ex;
    names.forEach(n => {
      const arr = lifts[n].sort((a, b) => a.t < b.t ? -1 : 1), top = Math.max(...arr.map(x => x.kg));
      const work = arr.filter((x, i) => !(i === 0 && x.kg < top && arr.length > 1));
      logs[sid + "|" + n] = { ...(logs[sid + "|" + n] || {}), sets: work.map(x => ({ kg: x.kg, reps: x.reps })), date: day, src: "setgraph" };
      if (ex.includes(n)) ticks[sid + "|" + n] = "✓"; nSets += work.length;
    });
    doc.recompWeeks = doc.recompWeeks || {}; doc.recompWeeks[String(w)] = { ...wk, logs, ticks, updatedAt: Date.now() };
    const rd = rDay(day); if (!rd.session) { doc.recompDays = doc.recompDays || {}; doc.recompDays[day] = { ...rd, session: SESSION_LABEL[sid], updatedAt: Date.now() }; }
    touched.add(w);
  });
  persist(); rWeekShown = touched.size ? Math.max(...touched) : rWeekShown; renderRecomp();
  return "Imported " + nSets + " working sets from " + Object.keys(days).length + " days" + (touched.size ? " (week " + [...touched].sort((a, b) => a - b).join(", ") + ")" : "") + "." + (unmatched.size ? " Not in the plan, skipped: " + [...unmatched].join(", ") + "." : "");
}

/* ---- render ---- */
let rWeekShown = null, rOpen = null, rEditing = false;
/* Panel for one exercise in one week: plan (editable), the sets you did, pain flag, done/skip, progression. */
function exercisePanel(w, s, e, p) {
  const k = s.id + "|" + e, wk = rWeek(w), L = rLog(w, k) || {}, box = document.createElement("div"); box.className = "rpanel";
  const el = (tag, cls, txt) => { const x = document.createElement(tag); if (cls) x.className = cls; if (txt != null) x.textContent = txt; return x; };
  const inp = (val, ph, w2, mode = "decimal") => { const i = el("input", "cell"); i.type = "text"; i.inputMode = mode; i.placeholder = ph; i.value = val ?? ""; i.style.width = w2 + "ch"; return i; };
  const btn = (txt, cls, fn) => { const b = el("button", "tick" + (cls ? " " + cls : ""), txt); b.type = "button"; b.onclick = fn; return b; };

  /* plan line */
  const pl = el("div", "rp-row");
  if (p && !rEditing) {
    pl.append(el("b", null, fmtGoal(p) + (p.shoulder ? " ◆" : "")));
    const src = planChanges(s.id, e).filter(x => x.from <= w).sort((a, b) => a.from - b.from || a.at - b.at).pop();
    const srcTxt = !src ? "Starting plan." : src.from === w ? "Set this week." : "Carried from week " + src.from + ".";
    const sl = el("div", "rp-row"); sl.appendChild(el("span", "rp-l", srcTxt));
    if (src && src.from === w) sl.appendChild(btn("Undo week " + w + " change", "sm", () => dropPlanWeek(e, w)));
    sl.appendChild(btn("Edit", "sm", () => { rEditing = true; renderRecomp(); }));
    box.append(pl, sl);
  } else if (p || rEditing) {
    const q = p || P(3, 8, 12, null, 2.5), f = {};
    const g = el("div", "rp-edit");
    [["sets", "sets", 3, "numeric"], ["lo", "min reps", 4, "numeric"], ["hi", "max reps", 4, "numeric"], ["kg", "kg", 5], ["inc", "+kg step", 5]].forEach(([n, ph, w2, m]) => {
      const lab = el("label", "rp-f"); lab.append(el("span", null, ph)); f[n] = inp(q[n], ph, w2 + 1.5, m); lab.appendChild(f[n]); g.appendChild(lab);
    });
    box.appendChild(g);
    const r = el("div", "rp-row");
    r.append(btn("Save from week " + w, "yes", () => {
      const plan = {}; Object.keys(f).forEach(n => { const v = f[n].value.trim().replace(",", "."); plan[n] = v === "" || isNaN(Number(v)) ? null : Number(v); });
      if (!plan.sets || !plan.lo) return; if (!plan.hi || plan.hi < plan.lo) plan.hi = plan.lo; rEditing = false; setPlan(e, w, plan);
    }), btn("Cancel", "sm", () => { rEditing = false; renderRecomp(); }));
    box.appendChild(r);
    box.appendChild(el("div", "empty small", "Applies from week " + w + " on. Earlier weeks keep what they were. Min = max means fixed reps."));
  }

  /* what you did */
  if (Array.isArray(L.sets)) {
    const dr = el("div", "rp-row"); dr.append(el("span", "rp-l", "Setgraph"), el("b", null, fmtSets(workSets(L, p)) || "–"));
    dr.appendChild(btn("Enter by hand", "sm", () => saveLog(w, k, { sets: null, kg: null, reps: null })));
    box.appendChild(dr);
    box.appendChild(el("div", "empty small", "Working sets imported " + (L.date ? "from " + L.date : "") + " (warm-ups dropped). Re-import after your next session to update."));
  } else {
  /* what you did */
    const sets = p ? p.sets : Math.max(3, (L.reps || []).length);
    const dr = el("div", "rp-row"); dr.appendChild(el("span", "rp-l", "Did"));
    const kgI = inp(L.kg ?? (p ? p.kg : ""), "kg", 6.5); kgI.onchange = () => { const v = kgI.value.trim().replace(",", "."); saveLog(w, k, { kg: v === "" || isNaN(+v) ? null : +v }); };
    dr.append(kgI, el("span", "rp-l", "kg ×"));
    const reps = (L.reps || []).slice();
    for (let i = 0; i < sets; i++) {
      const ri = inp(reps[i], p ? String(p.hi) : "reps", 4.5, "numeric");
      ri.onchange = () => { const v = ri.value.trim(); const rr = (rLog(w, k) || {}).reps ? [...rLog(w, k).reps] : []; while (rr.length < sets) rr.push(null); rr[i] = v === "" || isNaN(+v) ? null : +v; const patch = { reps: rr }; if ((rLog(w, k) || {}).kg == null && p && p.kg != null && kgI.value.trim() !== "") patch.kg = +kgI.value.trim().replace(",", "."); saveLog(w, k, patch); };
      dr.appendChild(ri);
    }
    box.appendChild(dr);
  }

  const tr = el("div", "rp-row"), v = wk.ticks[k] || "";
  tr.append(
    btn("✓ Done", v === "✓" ? "yes" : "", () => saveWeek(w, { ticks: { ...wk.ticks, [k]: v === "✓" ? "" : "✓" } })),
    btn("✗ Skipped", v === "✗" ? "no" : "", () => saveWeek(w, { ticks: { ...wk.ticks, [k]: v === "✗" ? "" : "✗" } })),
    btn(L.pain ? "⚠ Pain" : "Pain?", L.pain ? "no" : "", () => saveLog(w, k, { pain: !L.pain })));
  box.appendChild(tr);

  /* progression */
  const vd = p ? verdict(s.id, e, w) : null;
  if (vd) {
    const vr = el("div", "rp-verdict " + vd.state); vr.appendChild(el("span", null, vd.text + (w < RECOMP.weeks && vd.next != null ? " Carries into every later week and session with this lift." : "")));
    const already = pendingVerdict(s.id, e, w).accepted;
    if (already) vr.appendChild(el("span", "rp-ok", " ✓ Week " + (w + 1) + " plan updated."));
    else if (vd.state === "ready" && w < RECOMP.weeks) vr.appendChild(btn("Accept → " + fmtKg(vd.next), "yes", () => setPlan(e, w + 1, { kg: vd.next })));
    else if (vd.state === "cap" && w < RECOMP.weeks) vr.appendChild(btn("Add anyway", "sm", () => setPlan(e, w + 1, { kg: vd.next })));
    box.appendChild(vr);
  }
  return box;
}
function renderRecomp() {
  migratePlans();
  if (rWeekShown == null) rWeekShown = currentWeek();
  const w = rWeekShown, days = weekDays(w), wk = rWeek(w);
  $("rWeekLabel").textContent = "Week " + w + (isMaint(w) ? " · maintenance" : "");
  $("rWeekDates").textContent = fmtD(days[0]) + " – " + fmtD(days[6]);
  $("rPrev").disabled = w <= 1; $("rNext").disabled = w >= RECOMP.weeks;

  /* sessions: one row per session, exercise chips cycle blank → ✓ → ✗ */
  const S = $("rSessions"); S.innerHTML = ""; const ph = phaseFor(w);
  $("rPhase").hidden = !ph.label; $("rPhase").textContent = ph.label || "";
  const R = $("rRules"); R.innerHTML = ""; R.hidden = !ph.rules;
  (ph.rules || []).forEach(t => { const li = document.createElement("li"); li.textContent = t; R.appendChild(li); });
  const readyAll = [];
  ph.sessions.forEach(s => {
    const row = document.createElement("div"); row.className = "rsess";
    const h = document.createElement("div"); h.className = "rsess-h";
    const done = s.ex.filter(e => wk.ticks[s.id + "|" + e] === "✓").length;
    const nm = document.createElement("span"); nm.textContent = s.name; const ct = document.createElement("span"); ct.className = "rcount"; ct.textContent = done + "/" + s.ex.length;
    h.append(nm, ct); row.appendChild(h);
    const chips = document.createElement("div"); chips.className = "chips";
    let openHere = null;
    const extra = Object.keys(wk.logs || {}).filter(k => k.startsWith(s.id + "|") && !s.ex.includes(k.split("|")[1])).map(k => k.split("|")[1]);
    [...s.ex, ...extra].forEach(e => {
      const k = s.id + "|" + e, v = wk.ticks[k] || "", p = planFor(s.id, e, w), vd0 = p ? pendingVerdict(s.id, e, w) : null, vd = vd0 && !vd0.accepted ? vd0 : null, b = document.createElement("button");
      b.type = "button"; b.className = "tick" + (v === "✓" ? " yes" : v === "✗" ? " no" : "") + (rOpen === k ? " open" : "");
      b.textContent = (v ? v + " " : "") + e + (p && p.shoulder ? " ◆" : "") + (vd && vd.state === "ready" ? " ▲" : "");
      if (p) { const rx = document.createElement("span"); rx.className = "rx"; const ws = workSets(rLog(w, k), p); rx.textContent = fmtPlan(p) + (ws.length ? " · did " + ws.map(x => x.reps).join("/") + (ws.some(x => x.kg !== p.kg) ? " @" + Math.max(...ws.map(x => x.kg || 0)) : "") : ""); b.appendChild(rx); }
      b.setAttribute("aria-label", e + (v === "✓" ? ", done" : v === "✗" ? ", skipped" : ", not done") + (vd && vd.state === "ready" ? ", ready to progress" : ""));
      b.onclick = () => { rOpen = rOpen === k ? null : k; renderRecomp(); };
      chips.appendChild(b);
      if (extra.includes(e)) b.classList.add("extra");
      if (vd && vd.state === "ready" && !(p && p.shoulder)) readyAll.push([e, vd.next]);
      if (rOpen === k) openHere = [s, e, p];
    });
    row.appendChild(chips);
    if (openHere) row.appendChild(exercisePanel(w, ...openHere));
    S.appendChild(row);
  });

  if (readyAll.length && w < RECOMP.weeks) {
    const best = {}; readyAll.forEach(([e, n]) => { best[e] = Math.max(best[e] || 0, n); });
    const bar = document.createElement("div"); bar.className = "rp-verdict ready";
    bar.append(Object.assign(document.createElement("span"), { textContent: Object.keys(best).length + " lift" + (Object.keys(best).length > 1 ? "s" : "") + " earned a step (shoulder ◆ lifts are accepted one at a time): " + Object.entries(best).map(([e, n]) => e + " → " + fmtKg(n)).join(", ") + "." }));
    const ab = document.createElement("button"); ab.type = "button"; ab.className = "tick yes"; ab.textContent = "Accept all ▲";
    ab.onclick = () => { Object.entries(best).forEach(([e, n]) => setPlan(e, w + 1, { kg: n }, true)); persist(); renderRecomp(); };
    bar.appendChild(ab); S.prepend(bar);
  }

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
  const B = $("rOverview"); B.innerHTML = ""; let tTicks = 0, tSess = 0, tA = 0, tAT = 0, tEx = 0;
  for (let i = 1; i <= RECOMP.weeks; i++) {
    const s = weekStats(i), tr = document.createElement("tr");
    if (i === w) tr.className = "today";
    tr.append(td("W" + i + (isMaint(i) ? " ·M" : ""), "m"), td(s.sessionsDone + "/4", "m c", fair(s.sessionsDone / 4, i)),
      td(Math.round(s.training * 100) + "%", "m n", fair(s.training, i)), td(Math.round(s.actions * 100) + "%", "m n", elapsed(i) < 1 ? null : band(s.actions)),
      td(s.target.toFixed(1), "m n"), td(s.mean == null ? "–" : s.mean.toFixed(1), "m n", s.mean == null ? null : s.mean <= s.target + .2 ? 1 : s.mean <= s.target + .6 ? .5 : 0));
    tr.onclick = () => { rWeekShown = i; renderRecomp(); $("pageRecomp").scrollIntoView({ block: "start" }); };
    B.appendChild(tr);
    if (i <= 10) { tTicks += s.ticks; tEx += totalEx(i); tSess += s.sessionsDone; RECOMP.actions.forEach(a => { if (a.photoWeeksOnly && !photoWeek(i)) return; tAT++; if (actionState(i, a, s.days) === "✓") tA++; }); }
  }
  $("rTotal").textContent = "Weeks 1–10: " + tSess + " sessions · training " + Math.round(tTicks / tEx * 100) + "% · actions " + Math.round(tA / tAT * 100) + "%. Design point 85%; below 70% two weeks running → fix the schedule, not the diet.";
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

$("rImport").addEventListener("change", async ev => {
  const f = ev.target.files && ev.target.files[0]; if (!f) return;
  try { $("rImportMsg").textContent = importSetgraph(await f.text()); } catch (err) { $("rImportMsg").textContent = "Import failed: " + err.message; }
  ev.target.value = "";
});
$("rPrev").onclick = () => { if (rWeekShown > 1) { rWeekShown--; renderRecomp(); } };
$("rNext").onclick = () => { if (rWeekShown < RECOMP.weeks) { rWeekShown++; renderRecomp(); } };
$("rNotes").addEventListener("change", () => saveWeek(rWeekShown, { notes: $("rNotes").value.trim() }));
$("rCsv").onclick = async () => {
  const name = "daily_log.csv", blob = new Blob([recompDailyCSV()], { type: "text/csv" });
  try { const file = new File([blob], name, { type: "text/csv" }); if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file] }); return; } } catch (e) { if (e && e.name === "AbortError") return; }
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
};
