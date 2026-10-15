/* Jobs tab — job-hunt tracker.
   Found something on LinkedIn before the laptop is open? Save it here first, apply calmly later.
   Rows are grouped by stage: Ongoing (reached an interview, i.e. past the auto-reject) on top,
   then Applied (waiting to hear), then Saved (not applied yet), then Closed.
   Data: doc.jobs[id] = { id, url, title, role, applied, interview, outcome, outcomeDate, notes, createdAt, updatedAt }
         doc.jobRoles = { list, updatedAt }. Each job merges by updatedAt; deletes stay as tombstones. */
const DEFAULT_ROLES = ["ML Engineer", "Robotics Engineer"];
const OUTCOMES = [["", "Still open"], ["offer", "Offer"], ["accepted", "Accepted"], ["rejected", "Rejected"], ["withdrawn", "Withdrew"]];
const GROUPS = [
  ["ongoing", "Ongoing · past the auto-reject", "Nothing at interview stage yet."],
  ["applied", "Applied · waiting to hear", "No applications waiting."],
  ["saved", "Saved · not applied yet", "Nothing saved. Found one on your phone? Add it above and apply from the laptop."],
  ["closed", "Closed", ""]
];
const today = () => ymd(new Date());
const roles = () => (doc.jobRoles && doc.jobRoles.list && doc.jobRoles.list.length) ? doc.jobRoles.list : DEFAULT_ROLES;
const jobList = () => Object.values(doc.jobs || {}).filter(j => j && !j.deleted);
const blankJob = () => ({ id: null, role: null, applied: null, interview: null, outcome: "", outcomeDate: null });
let jForm = blankJob(), jShowClosed = false;

function fmtDay(s) { if (!s) return ""; const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d).toLocaleDateString("en-GB", { day: "numeric", month: "short" }); }
function daysSince(s) { if (!s) return null; const [y, m, d] = s.split("-").map(Number); const t = new Date(); t.setHours(0, 0, 0, 0); return Math.round((t - new Date(y, m - 1, d)) / 864e5); }
function saveJobRecord(j) { doc.jobs = doc.jobs || {}; doc.jobs[j.id] = { ...j, updatedAt: Date.now() }; persist(); }

/* ---- roles (addable tags, like session types) ---- */
function rolesByRecency(extra) {
  const list = roles(), seen = [];
  jobList().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).forEach(j => { if (list.includes(j.role) && !seen.includes(j.role)) seen.push(j.role); });
  const out = [...seen, ...list.filter(r => !seen.includes(r))]; if (extra && !out.includes(extra)) out.push(extra); return out;
}
function renderRoleChips() {
  const el = $("jRoleChips"); el.innerHTML = "";
  if (!jForm.role) jForm.role = rolesByRecency()[0];
  rolesByRecency(jForm.role).forEach(r => {
    const b = document.createElement("button"); b.type = "button"; b.className = "chip"; b.textContent = r; b.setAttribute("aria-pressed", String(r === jForm.role));
    b.onclick = () => { jForm.role = r; renderRoleChips(); }; el.appendChild(b);
  });
}
function renderRoleRows() {
  const el = $("roleRows"); el.innerHTML = "";
  roles().forEach(r => {
    const row = document.createElement("div"); row.className = "trow"; const s = document.createElement("span"); s.textContent = r;
    const x = document.createElement("button"); x.className = "x"; x.type = "button"; x.textContent = "✕"; x.setAttribute("aria-label", "Remove " + r);
    x.onclick = () => { if (roles().length <= 1) { toast("Keep at least one role"); return; } saveRoles(roles().filter(y => y !== r)); };
    row.append(s, x); el.appendChild(row);
  });
}
function saveRoles(list) { doc.jobRoles = { list, updatedAt: Date.now() }; if (jForm.role && !list.includes(jForm.role) && !jForm.id) jForm.role = null; persist(); renderRoleRows(); renderRoleChips(); }
$("btnRoles").onclick = () => { $("rolesEdit").hidden = !$("rolesEdit").hidden; renderRoleRows(); };
$("btnAddRole").onclick = () => { const v = $("newRole").value.trim(); if (!v) return; if (roles().some(r => r.toLowerCase() === v.toLowerCase())) { toast(v + " is already a role"); return; } $("newRole").value = ""; saveRoles([...roles(), v]); jForm.role = v; renderRoleChips(); };
$("newRole").addEventListener("keydown", e => { if (e.key === "Enter") $("btnAddRole").click(); });

/* ---- form: checklist + outcome ---- */
function renderJobChecks() {
  const C = $("jChecks"); C.innerHTML = "";
  [["applied", "Applied"], ["interview", "Interview"]].forEach(([f, name]) => {
    const b = document.createElement("button"); b.type = "button"; const v = jForm[f];
    b.className = "tick" + (v ? " yes" : ""); b.textContent = (v ? "✓ " : "") + name + (v ? " · " + fmtDay(v) : "");
    b.setAttribute("aria-pressed", String(!!v));
    b.onclick = () => { jForm[f] = v ? null : today(); if (f === "interview" && jForm.interview && !jForm.applied) jForm.applied = jForm.interview; renderJobChecks(); };
    C.appendChild(b);
  });
  const O = $("jOutcome"); O.innerHTML = "";
  OUTCOMES.forEach(([v, name]) => {
    const b = document.createElement("button"); b.type = "button"; b.className = "chip"; b.textContent = name; b.setAttribute("aria-pressed", String((jForm.outcome || "") === v));
    b.onclick = () => { jForm.outcome = v; jForm.outcomeDate = v ? today() : null; renderJobChecks(); }; O.appendChild(b);
  });
  $("jSave").textContent = jForm.id ? "Save changes" : jForm.applied ? "Add job" : "Save for later";
}
function showJobForm(on) { $("jForm").hidden = !on; $("jOpen").hidden = on; }
function openJob(j) {
  jForm = j ? { ...j } : blankJob();
  $("jUrl").value = j ? j.url || "" : ""; $("jTitle").value = j ? j.title || "" : ""; $("jNotes").value = j ? j.notes || "" : "";
  $("jFormTitle").textContent = j ? "Edit job" : "Add a job";
  $("jDelete").hidden = !j; $("jDelConfirm").hidden = true; $("jErr").hidden = true;
  $("jHint").hidden = !!j;
  renderRoleChips(); renderJobChecks();
  if (j) { showJobForm(true); $("pageJobs").scrollIntoView({ block: "start" }); }
}
$("jOpen").onclick = () => { openJob(null); showJobForm(true); $("jUrl").focus(); };
$("jSave").onclick = () => {
  const rawUrl = $("jUrl").value.trim(), url = rawUrl ? cleanUrl(rawUrl) : null, title = $("jTitle").value.trim(), notes = $("jNotes").value.trim();
  if (rawUrl && !url) { $("jErr").textContent = "That link doesn't look right."; $("jErr").hidden = false; return; }
  if (!url && !title) { $("jErr").textContent = "Paste the link or write a title."; $("jErr").hidden = false; return; }
  const isNew = !jForm.id, id = jForm.id || newId(), prev = (doc.jobs || {})[id] || {};
  saveJobRecord({ ...prev, id, url, title: title || (url ? hostOf(url) : ""), role: jForm.role || rolesByRecency()[0], applied: jForm.applied, interview: jForm.interview,
    outcome: jForm.outcome || "", outcomeDate: jForm.outcomeDate || null, notes, createdAt: prev.createdAt || Date.now() });
  toast(isNew ? (jForm.applied ? "Job added" : "Saved for later. Apply when you're at the laptop.") : "Job updated");
  openJob(null); showJobForm(false); renderJobs();
};
$("jCancel").onclick = () => { openJob(null); showJobForm(false); };
$("jDelete").onclick = () => { $("jDelConfirm").hidden = false; };
$("jDelYes").onclick = () => { if (!jForm.id) return; doc.jobs[jForm.id] = { id: jForm.id, deleted: true, updatedAt: Date.now() }; persist(); openJob(null); showJobForm(false); renderJobs(); toast("Job deleted"); };

/* ---- grouped sheets ---- */
function quickTick(j, f) {
  const b = document.createElement("button"); b.type = "button"; const v = j[f];
  b.className = "tick" + (v ? " yes" : ""); b.textContent = v ? "✓ " + fmtDay(v) : "–";
  b.setAttribute("aria-label", (f === "applied" ? "Applied" : "Interview") + (v ? " on " + fmtDay(v) + ", tap to clear" : ", tap to tick"));
  b.onclick = e => {
    e.stopPropagation(); const patch = { [f]: v ? null : today() };
    if (f === "interview" && patch.interview && !j.applied) patch.applied = patch.interview;
    saveJobRecord({ ...j, ...patch }); renderJobs();
  };
  return b;
}
function outcomeText(j) {
  const name = (OUTCOMES.find(o => o[0] === j.outcome) || ["", ""])[1];
  if (j.outcome === "rejected") return name + (j.interview ? " · after interview" : " · no interview");
  return name;
}
function renderJobs() {
  const all = jobList(), by = { ongoing: [], applied: [], saved: [], closed: [] };
  all.forEach(j => { const s = D.jobStage(j); if (s) by[s].push(j); });
  by.ongoing.sort((a, b) => (b.interview || "").localeCompare(a.interview || ""));
  by.applied.sort((a, b) => (a.applied || "").localeCompare(b.applied || "")); /* longest waiting first */
  by.saved.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
  by.closed.sort((a, b) => (b.outcomeDate || "").localeCompare(a.outcomeDate || ""));

  /* summary */
  const wk = all.filter(j => j.applied && daysSince(j.applied) < 7).length, appliedAll = all.filter(j => j.applied), iv = appliedAll.filter(j => j.interview).length;
  $("jsWeek").textContent = wk; $("jsOpen").textContent = by.ongoing.length + by.applied.length;
  $("jsRate").textContent = appliedAll.length ? Math.round(iv / appliedAll.length * 100) + "%" : "–";
  paint($("jsRateT"), appliedAll.length >= 5 ? Math.min(1, iv / appliedAll.length / .3) : null);

  const G = $("jGroups"); G.innerHTML = "";
  GROUPS.forEach(([key, label, emptyText]) => {
    const list = by[key], sec = document.createElement("section"); sec.className = "card"; sec.id = "jg-" + key;
    const head = document.createElement("div"); head.className = "subhead";
    const l = document.createElement("span"); l.className = "lbl"; l.textContent = label + " · " + list.length; head.appendChild(l);
    if (key === "closed" && list.length) {
      const t = document.createElement("button"); t.type = "button"; t.className = "link"; t.textContent = jShowClosed ? "Hide" : "Show";
      t.onclick = () => { jShowClosed = !jShowClosed; renderJobs(); }; head.appendChild(t);
    }
    sec.appendChild(head);
    if (key === "closed" && (!list.length || !jShowClosed)) { if (!list.length) return; G.appendChild(sec); return; }
    if (!list.length) { const p = document.createElement("p"); p.className = "empty small"; p.style.margin = "0"; p.textContent = emptyText; sec.appendChild(p); G.appendChild(sec); return; }
    const wrap = document.createElement("div"); wrap.className = "sheetwrap";
    const tbl = document.createElement("table"); tbl.className = "sheet jobs";
    const cols = key === "closed" ? ["Job", "Applied", "Interview", "Outcome", "Notes"] : ["Job", "Applied", "Interview", "Notes"];
    tbl.innerHTML = "<thead><tr>" + cols.map(c => "<th>" + c + "</th>").join("") + "</tr></thead>";
    const body = document.createElement("tbody");
    list.forEach(j => {
      const tr = document.createElement("tr");
      const tc = document.createElement("td"); tc.className = "job";
      const tt = document.createElement("div"); tt.className = "jt"; tt.textContent = j.title || "(untitled)"; tc.appendChild(tt);
      if (j.role) { const r = document.createElement("div"); r.className = "jrole"; r.textContent = j.role; tc.appendChild(r); }
      if (j.url) { const a = document.createElement("a"); a.href = j.url; a.target = "_blank"; a.rel = "noopener"; a.textContent = hostOf(j.url); a.onclick = e => e.stopPropagation(); tc.appendChild(a); }
      else if (key === "saved") { const s = document.createElement("div"); s.className = "jsub"; s.textContent = "saved " + ago(j.createdAt || Date.now()); tc.appendChild(s); }
      if (key === "saved" && j.url) { const s = document.createElement("div"); s.className = "jsub"; s.textContent = "saved " + ago(j.createdAt || Date.now()); tc.appendChild(s); }
      tr.appendChild(tc);
      const ac = document.createElement("td"); ac.appendChild(quickTick(j, "applied"));
      if (key === "applied") { const d = daysSince(j.applied), s = document.createElement("div"); s.className = "jsub"; s.textContent = d === 0 ? "today" : d + "d waiting"; ac.appendChild(s); }
      tr.appendChild(ac);
      const ic = document.createElement("td"); ic.appendChild(quickTick(j, "interview")); tr.appendChild(ic);
      if (key === "closed") tr.appendChild(td(outcomeText(j), "t", j.outcome === "accepted" ? 1 : j.outcome === "rejected" ? 0 : null));
      const n = document.createElement("td"); n.className = "note"; const nd = document.createElement("div"); nd.textContent = j.notes || ""; n.appendChild(nd);
      if (key === "ongoing" && j.outcome === "offer") { const o = document.createElement("div"); o.className = "att"; o.textContent = "Offer on the table"; n.appendChild(o); }
      tr.appendChild(n);
      tr.onclick = () => openJob(j);
      body.appendChild(tr);
    });
    tbl.appendChild(body); wrap.appendChild(tbl); sec.appendChild(wrap); G.appendChild(sec);
  });
  if (!$("jForm").dataset.ready) { $("jForm").dataset.ready = "1"; openJob(null); }
  else { renderRoleChips(); renderJobChecks(); }
}
function jobsHaveData() { return jobList().length > 0; }
