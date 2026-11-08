/* Harada tab — one big goal, up to 8 sub-goals, up to 8 actions under each.
   Actions are direct: "do X every Y". Today shows what's due; Grid shows the 9×9; Notes holds the how-to.
   Data: doc.haradaCells[id] = { id, text, per, times, by, notes, updatedAt }
           ids: "c" (centre goal, has `by` date), "g1".."g8" (sub-goals), "g1a1".."g8a8" (actions, have per/times)
         doc.haradaTicks["<actionId>_<YYYY-MM-DD>"] = { id, aid, date, done, updatedAt }
   Untouched cells fall back to SEED, so nothing is written until you edit. Everything merges per record by updatedAt. */
(function () {
  const PERS = [["day", "Day"], ["week", "Week"], ["fortnight", "2 weeks"], ["month", "Month"], ["once", "Once"]];
  const PER_WORD = { day: "today", week: "this week", fortnight: "last 2 weeks", month: "this month", once: "done" };
  /* Positions around the centre of a 3×3, in reading order (centre = 4). */
  const RING = [0, 1, 2, 3, 5, 6, 7, 8];
  const HUES = ["#E46C6C", "#E0A33A", "#7BB661", "#3FA7A0", "#4C8DDB", "#8C6BD6", "#D466A8", "#9A8F7A"];

  const a = (text, per, times, notes) => ({ text, per, times: times || 1, notes: notes || "" });
  const SEED = {
    c: { text: "Be successful as before", by: "2027-02-28", notes: "Basics first. Sleep, food and body make everything else easier. Then people, then the job, then the rest." },
    g1: { text: "Sleep well", notes: "", focus: true },
    g1a1: a("In bed by 23:00", "day", 1, "Start winding down at 22:30."),
    g1a2: a("Up by 07:30, weekends too", "day"),
    g1a3: a("Phone charges outside the bedroom", "day", 1, "Kitchen or landing. Use a cheap alarm clock if needed."),
    g1a4: a("No Minecraft or screens after 22:00", "day"),
    g1a5: a("Daylight within an hour of waking", "day", 1, "A 10-minute walk round the block counts."),
    g1a6: a("No caffeine after 14:00", "day"),
    g2: { text: "Eat well", notes: "", focus: true },
    g2a1: a("Cook one proper meal", "day"),
    g2a2: a("Protein with every meal", "day"),
    g2a3: a("Plan the week's meals and shop", "week", 1, "Sunday. Write the list here, then shop once."),
    g2a4: a("Veg or fruit with every meal", "day"),
    g2a5: a("No snacking after dinner", "day", 1, "Bored at home ≠ hungry. Drink something, go for a walk."),
    g2a6: a("Cook a meal for the family", "week"),
    g3: { text: "Move my body", notes: "Follows the Recomp plan.", focus: true },
    g3a1: a("Recomp session (cardio or weights)", "week", 4, "Weeks 4–6 are cardio. Log it in Setgraph, import to Recomp."),
    g3a2: a("Walk 1 hour", "week", 3),
    g3a3: a("BJJ class", "week", 1),
    g3a4: a("Mobility / stretch 10 min", "week", 3),
    g3a5: a("Weigh in, Monday morning", "week", 1),
    g4: { text: "Clear head", notes: "" },
    g4a1: a("Out of the house before 12:00", "day", 1, "Library or café for the job task. Gets you away from home friction."),
    g4a2: a("Minecraft only after the day's job task", "day", 1, "Then play it guilt-free."),
    g4a3: a("Debrief the day: done, next, how I feel", "day", 1, "Three lines in the Log tab."),
    g4a4: a("Something just for fun: hike, climb, ride", "week", 2),
    g4a5: a("No LinkedIn before the laptop is open", "day", 1, "Save postings in Jobs, apply calmly later."),
    g5: { text: "People", notes: "" },
    g5a1: a("Call her (voice or video, not text)", "day"),
    g5a2: a("See her in person", "fortnight", 1, "Book the next visit before the current one ends."),
    g5a3: a("Tell the family about Hong Kong", "once", 1, "Calm moment. Lead with why, give the timeline and how often you'll be back. You don't need to win the first conversation."),
    g5a4: a("One-to-one time with my sister", "week"),
    g5a5: a("Message or meet a friend", "week", 2),
    g5a6: a("Do something kind at home", "week", 2),
    g6: { text: "Land the next job", notes: "UK role is a bridge: decent pay, clear hours. Doesn't need to be perfect." },
    g6a1: a("One finishable job task, then stop", "week", 5, "One application, one outreach message, or one CV fix."),
    g6a2: a("Pick my 2 job paths and drop the rest", "once"),
    g6a3: a("Coffee chat with someone in industry", "week", 1, "Ask how their weeks actually feel."),
    g6a4: a("Software fundamentals: 1 hour on a repo", "week", 3, "Tests, CI, Docker on a public repo."),
    g6a5: a("Interview practice, 30 min", "week", 2),
    g7: { text: "Money and HK ready", notes: "" },
    g7a1: a("Review spending", "week", 1, "Sunday, 10 minutes."),
    g7a2: a("Move savings when paid", "month"),
    g7a3: a("Top up the trip fund for visits", "month", 1, "Seeing her is maintenance, not a luxury."),
    g7a4: a("Cantonese, 15 min", "day"),
    g7a5: a("One HK admin step", "fortnight"),
    g8: { text: "Build and show", notes: "" },
    g8a1: a("Film the quad walking and post it", "once", 1, "Short clip + 3 lines on the build. LinkedIn."),
    g8a2: a("Quad session: new surface or RL gait", "week", 2),
    g8a3: a("Short post on something I built or learned", "fortnight"),
    g8a4: a("Add the quad to CV and portfolio", "once")
  };

  let view = (ls.get("chmodeHView") || "today"), level = null /* null = overview, or "g3" */, full = ls.get("chmodeHFull") === "1";
  let editing = null, fPer = "day", fTimes = 1, fFocus = false, showCovered = false, showOthers = false;

  /* ---------- data ---------- */
  const today = () => ymd(new Date());
  const cell = id => { const r = (doc.haradaCells || {})[id]; if (r && !r.deleted) return r; return SEED[id] ? { id, ...SEED[id] } : { id, text: "" }; };
  const goalIds = () => [1, 2, 3, 4, 5, 6, 7, 8].map(i => "g" + i);
  const actIds = g => [1, 2, 3, 4, 5, 6, 7, 8].map(j => g + "a" + j);
  const goalOf = aid => aid.split("a")[0];
  const isAction = id => /^g\d+a\d+$/.test(id);
  const hueOf = id => HUES[(+id.match(/^g(\d+)/)[1] - 1) % 8];
  function saveCell(id, patch) { doc.haradaCells = doc.haradaCells || {}; doc.haradaCells[id] = { ...cell(id), ...patch, id, updatedAt: Date.now() }; persist(); }

  function dayDiff(a, b) { const p = s => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); }; return Math.round((p(b) - p(a)) / 864e5); }
  function inPeriod(date, per) {
    const t = today();
    if (per === "day") return date === t;
    if (per === "week") { const mon = ymd(mondayOf(new Date())); const d = dayDiff(mon, date); return d >= 0 && d < 7; }
    if (per === "fortnight") { const d = dayDiff(date, t); return d >= 0 && d < 14; }
    if (per === "month") return date.slice(0, 7) === t.slice(0, 7);
    return true;
  }
  const doneDates = aid => Object.values(doc.haradaTicks || {}).filter(k => k && k.aid === aid && k.done).map(k => k.date).sort();
  function progress(id) {
    const c = cell(id), per = c.per || "day", target = per === "day" || per === "once" ? 1 : Math.max(1, c.times || 1);
    const dates = doneDates(id), n = dates.filter(d => inPeriod(d, per)).length;
    return { per, target, n, met: n >= target, todayDone: dates.includes(today()), last: dates[dates.length - 1] || null };
  }
  function toggleTick(aid) {
    const t = today(), key = aid + "_" + t, prev = (doc.haradaTicks || {})[key];
    doc.haradaTicks = doc.haradaTicks || {};
    doc.haradaTicks[key] = { id: key, aid, date: t, done: !(prev && prev.done), updatedAt: Date.now() };
    persist();
    if (!(prev && prev.done)) { const p = progress(aid); if (p.met && p.per !== "day" && p.per !== "once") toast("That's " + p.n + "/" + p.target + " " + PER_WORD[p.per] + ". Covered."); }
  }
  const everyText = c => { const per = c.per || "day"; if (per === "once") return "once"; if (per === "day") return "every day"; const t = Math.max(1, c.times || 1); const unit = per === "week" ? "week" : per === "month" ? "month" : "2 weeks"; return t === 1 ? "every " + unit : t + "× per " + unit; };
  const activeActions = focusOnly => goalIds().filter(g => cell(g).text && (!focusOnly || cell(g).focus)).flatMap(g => actIds(g).filter(id => cell(id).text));
  const otherActions = () => goalIds().filter(g => cell(g).text && !cell(g).focus).flatMap(g => actIds(g).filter(id => cell(id).text));

  /* ---------- view switching ---------- */
  function setView(v) {
    view = v; ls.set("chmodeHView", v);
    [["today", "hTabToday", "hTodayView"], ["grid", "hTabGrid", "hGridView"], ["notes", "hTabNotes", "hNotesView"]].forEach(([k, b, p]) => { $(b).setAttribute("aria-selected", String(k === v)); $(p).hidden = k !== v; });
    renderHarada();
  }
  $("hTabToday").onclick = () => setView("today"); $("hTabGrid").onclick = () => setView("grid"); $("hTabNotes").onclick = () => setView("notes");

  /* ---------- Today ---------- */
  function renderToday() {
    const c = cell("c");
    $("hGoal").textContent = c.text || "Set your big goal";
    if (c.by) { const d = dayDiff(today(), c.by); $("hBy").textContent = d >= 0 ? d + " days to " + new Date(c.by + "T12:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "Goal date passed. Set a new one."; } else $("hBy").textContent = "";
    $("hGoal").onclick = () => openForm("c");

    const due = [], doneToday = [], covered = [], others = [];
    const anyFocus = goalIds().some(g => cell(g).text && cell(g).focus);
    otherActions().forEach(id => { const p = progress(id); if (!anyFocus) return; if (p.todayDone) doneToday.push(id); else if (!(p.per === "once" && p.met)) others.push(id); });
    activeActions(anyFocus).forEach(id => {
      const p = progress(id);
      if (p.per === "once" && p.met && !p.todayDone) return; /* finished one-offs drop off */
      if (p.todayDone) doneToday.push(id); else if (p.met) covered.push(id); else due.push(id);
    });
    const total = due.length + doneToday.length;
    $("hsDone").textContent = doneToday.length; $("hsDue").textContent = due.length;
    $("hsPct").textContent = total ? Math.round(doneToday.length / total * 100) + "%" : "–";
    paint($("hsPctT"), total && doneToday.length ? doneToday.length / total : null);
    $("hFocusLine").textContent = anyFocus ? "Focus: " + goalIds().filter(g => cell(g).text && cell(g).focus).map(g => cell(g).text).join(" · ") : "";

    const L = $("hTodayList"); L.innerHTML = "";
    const section = (title, ids, empty, opts) => {
      const sec = document.createElement("section"); sec.className = "card hlist";
      const head = document.createElement("div"); head.className = "subhead";
      const l = document.createElement("span"); l.className = "lbl"; l.textContent = title + " · " + ids.length; head.appendChild(l);
      if (opts && opts.toggle) { const t = document.createElement("button"); t.type = "button"; t.className = "link"; t.textContent = showCovered ? "Hide" : "Show"; t.onclick = () => { showCovered = !showCovered; renderToday(); }; head.appendChild(t); }
      sec.appendChild(head);
      if (opts && opts.toggle && !showCovered) { L.appendChild(sec); return; }
      if (!ids.length) { const p = document.createElement("p"); p.className = "empty small"; p.textContent = empty; sec.appendChild(p); L.appendChild(sec); return; }
      ids.forEach(id => sec.appendChild(actionRow(id)));
      L.appendChild(sec);
    };
    section("To do", due, doneToday.length ? "All done for today. Go and enjoy the rest of it." : "Nothing due. Add actions in the Grid.");
    section("Done today", doneToday, "Nothing ticked yet. Start with the easiest one.");
    if (covered.length) section("Covered for now", covered, "", { toggle: true });
    if (others.length) {
      const sec = document.createElement("section"); sec.className = "card hlist";
      const head = document.createElement("div"); head.className = "subhead";
      const l = document.createElement("span"); l.className = "lbl"; l.textContent = "Other goals · " + others.length; head.appendChild(l);
      const t = document.createElement("button"); t.type = "button"; t.className = "link"; t.textContent = showOthers ? "Hide" : "Show"; t.onclick = () => { showOthers = !showOthers; renderToday(); }; head.appendChild(t);
      sec.appendChild(head);
      if (!showOthers) { const p = document.createElement("p"); p.className = "empty small"; p.textContent = "Not in focus yet. Basics first. Turn a sub-goal's Focus on in the Grid when you're ready."; sec.appendChild(p); }
      else others.forEach(id => sec.appendChild(actionRow(id)));
      L.appendChild(sec);
    }
  }
  function actionRow(id) {
    const c = cell(id), p = progress(id), g = cell(goalOf(id));
    const row = document.createElement("div"); row.className = "hrow" + (p.todayDone ? " done" : "");
    const tick = document.createElement("button"); tick.type = "button"; tick.className = "hcheck" + (p.todayDone ? " yes" : "");
    tick.textContent = p.todayDone ? "✓" : ""; tick.setAttribute("aria-pressed", String(p.todayDone)); tick.setAttribute("aria-label", (p.todayDone ? "Untick " : "Tick ") + c.text);
    tick.onclick = () => { toggleTick(id); renderToday(); };
    const body = document.createElement("button"); body.type = "button"; body.className = "hbody";
    const t = document.createElement("span"); t.className = "ht"; t.textContent = c.text;
    const m = document.createElement("span"); m.className = "hm";
    const dot = document.createElement("i"); dot.style.background = hueOf(id); m.appendChild(dot);
    m.appendChild(document.createTextNode(g.text + " · " + everyText(c) + (p.per !== "day" && p.per !== "once" ? " · " + p.n + "/" + p.target + " " + PER_WORD[p.per] : "") + (c.notes ? " · 📝" : "")));
    body.append(t, m); body.onclick = () => openForm(id);
    row.append(tick, body); return row;
  }

  /* ---------- Grid ---------- */
  function renderCrumbs() {
    const C = $("hCrumbs"); C.innerHTML = "";
    const add = (txt, fn, cur) => {
      if (C.childNodes.length) { const s = document.createElement("span"); s.className = "csep"; s.textContent = "›"; C.appendChild(s); }
      const b = document.createElement("button"); b.type = "button"; b.className = "crumb" + (cur ? " cur" : ""); b.textContent = txt; b.onclick = fn; if (cur) b.setAttribute("aria-current", "page"); C.appendChild(b);
    };
    add(clip(cell("c").text || "Big goal", 26), () => { level = null; renderGrid(); }, !level);
    if (level) add(clip(cell(level).text || "Sub-goal", 22), () => { }, true);
  }
  const clip = (s, n) => s.length > n ? s.slice(0, n - 1) + "…" : s;
  function goalScore(g) { const ids = actIds(g).filter(id => cell(id).text); if (!ids.length) return null; return ids.filter(id => progress(id).met).length / ids.length; }
  function makeCell(id, kind, onTap) {
    const c = cell(id), b = document.createElement("button"); b.type = "button"; b.className = "hc " + kind;
    if (!c.text) b.classList.add("blank");
    const t = document.createElement("span"); t.className = "hct"; t.textContent = c.text || (kind === "act" ? "+" : kind === "goal" ? "+ Sub-goal" : "+ Big goal"); b.appendChild(t);
    if (kind === "act") {
      b.style.setProperty("--hue", hueOf(id));
      if (c.text) {
        const p = progress(id); if (p.met) b.classList.add("met");
        if (!full) { const s = document.createElement("span"); s.className = "hcs"; s.textContent = (p.per === "once" ? (p.met ? "done" : "once") : p.per === "day" ? (p.todayDone ? "✓ today" : "every day") : p.n + "/" + p.target + " " + (p.per === "week" ? "wk" : p.per === "month" ? "mo" : "2wk")) + (c.notes ? " · 📝" : ""); b.appendChild(s); }
      }
    }
    if (kind === "goal") {
      b.style.setProperty("--hue", hueOf(id));
      if (c.text && !full) { const sc = goalScore(id), n = actIds(id).filter(x => cell(x).text).length; const s = document.createElement("span"); s.className = "hcs"; s.textContent = sc == null ? "no actions yet" : Math.round(sc * n) + "/" + n + " on track"; b.appendChild(s); }
      if (c.text && c.focus) b.classList.add("focus");
    }
    if (kind === "centre" && c.by && !full) { const s = document.createElement("span"); s.className = "hcs"; s.textContent = "by " + new Date(c.by + "T12:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "2-digit" }); b.appendChild(s); }
    b.setAttribute("aria-label", (kind === "centre" ? "Big goal: " : kind === "goal" ? "Sub-goal: " : "Action: ") + (c.text || "empty, tap to add"));
    b.onclick = onTap; return b;
  }
  function renderGrid() {
    const G = $("hGrid"); G.innerHTML = "";
    G.className = "hgrid " + (full ? "full" : "three");
    $("hFull").textContent = full ? "Zoom in (3×3)" : "Full grid (9×9)";
    $("hCrumbs").hidden = full;
    if (full) {
      const zoom = g => () => { full = false; ls.set("chmodeHFull", "0"); level = g; renderGrid(); };
      for (let block = 0; block < 9; block++) {
        const B = document.createElement("div"); B.className = "hblock";
        for (let inner = 0; inner < 9; inner++) {
          if (block === 4) { const g = "g" + (RING.indexOf(inner) + 1); B.appendChild(inner === 4 ? makeCell("c", "centre", () => openForm("c")) : makeCell(g, "goal", zoom(g))); continue; }
          const g = "g" + (RING.indexOf(block) + 1), id = g + "a" + (RING.indexOf(inner) + 1);
          B.appendChild(inner === 4 ? makeCell(g, "goal", zoom(g)) : makeCell(id, "act", () => openForm(id)));
        }
        G.appendChild(B);
      }
      return;
    }
    renderCrumbs();
    for (let i = 0; i < 9; i++) {
      if (!level) G.appendChild(i === 4 ? makeCell("c", "centre", () => openForm("c")) : (() => { const g = "g" + (RING.indexOf(i) + 1); return makeCell(g, "goal", () => { if (!cell(g).text) { openForm(g); return; } level = g; renderGrid(); }); })());
      else G.appendChild(i === 4 ? makeCell(level, "goal", () => openForm(level)) : (() => { const id = level + "a" + (RING.indexOf(i) + 1); return makeCell(id, "act", () => openForm(id)); })());
    }
    $("hGridHint").textContent = level ? "Tap an action to edit it, its frequency and how-to notes. Tap the middle to rename the sub-goal." : "Tap a sub-goal to open its 8 actions. Tap the middle to edit the big goal and its date.";
  }
  $("hFull").onclick = () => { full = !full; ls.set("chmodeHFull", full ? "1" : "0"); renderGrid(); };

  /* ---------- Notes ---------- */
  function renderNotes() {
    const L = $("hNoteList"); L.innerHTML = "";
    const noteItem = (id, title, sub) => {
      const c = cell(id), b = document.createElement("button"); b.type = "button"; b.className = "hnote" + (c.notes ? "" : " none");
      const t = document.createElement("span"); t.className = "ht"; t.textContent = title; b.appendChild(t);
      if (sub) { const m = document.createElement("span"); m.className = "hm"; m.textContent = sub; b.appendChild(m); }
      const n = document.createElement("span"); n.className = "hn"; n.textContent = c.notes || "Add how to do it, the best way, or what's next"; b.appendChild(n);
      b.onclick = () => openForm(id); return b;
    };
    const top = document.createElement("section"); top.className = "card hlist";
    const tl = document.createElement("span"); tl.className = "lbl"; tl.textContent = "Big goal"; top.appendChild(tl);
    top.appendChild(noteItem("c", cell("c").text || "Big goal")); L.appendChild(top);
    goalIds().forEach(g => {
      const gc = cell(g); if (!gc.text) return;
      const sec = document.createElement("section"); sec.className = "card hlist"; sec.style.borderLeft = "4px solid " + hueOf(g);
      const l = document.createElement("span"); l.className = "lbl"; l.textContent = gc.text; sec.appendChild(l);
      sec.appendChild(noteItem(g, "Why this matters", ""));
      actIds(g).filter(id => cell(id).text).forEach(id => sec.appendChild(noteItem(id, cell(id).text, everyText(cell(id)))));
      L.appendChild(sec);
    });
  }

  /* ---------- edit form ---------- */
  function renderPer() {
    const P = $("hPer"); P.innerHTML = "";
    PERS.forEach(([v, name]) => { const b = document.createElement("button"); b.type = "button"; b.className = "chip"; b.textContent = name; b.setAttribute("aria-pressed", String(fPer === v)); b.onclick = () => { fPer = v; renderPer(); }; P.appendChild(b); });
    const multi = fPer === "week" || fPer === "fortnight" || fPer === "month";
    $("hTimesRow").hidden = !multi;
    $("hTimes").textContent = fTimes;
    $("hTimesUnit").textContent = (fTimes === 1 ? "time" : "times") + " per " + (fPer === "week" ? "week" : fPer === "month" ? "month" : "2 weeks");
  }
  function renderFocus() { const b = $("hFocus"); b.className = "tick" + (fFocus ? " yes" : ""); b.textContent = fFocus ? "✓ On Today's list" : "Not on Today yet"; b.setAttribute("aria-pressed", String(fFocus)); }
  $("hFocus").onclick = () => { fFocus = !fFocus; renderFocus(); };
  $("hMinus").onclick = () => { fTimes = Math.max(1, fTimes - 1); renderPer(); };
  $("hPlus").onclick = () => { fTimes = Math.min(14, fTimes + 1); renderPer(); };
  function openForm(id) {
    editing = id; const c = cell(id), act = isAction(id);
    $("hFormTitle").textContent = id === "c" ? "Big goal" : act ? "Action" : "Sub-goal";
    $("hFormPath").textContent = act ? cell(goalOf(id)).text || "" : id === "c" ? "" : cell("c").text || "";
    $("hFormPath").hidden = !$("hFormPath").textContent;
    $("hText").value = c.text || ""; $("hText").placeholder = act ? "Do what? e.g. In bed by 23:00" : id === "c" ? "e.g. Be successful as before" : "e.g. Sleep well";
    $("hEvery").hidden = !act; $("hFocusRow").hidden = !/^g\d+$/.test(id); fFocus = !!c.focus; renderFocus(); $("hByRow").hidden = id !== "c"; $("hByInput").value = c.by || "";
    fPer = c.per || "day"; fTimes = Math.max(1, c.times || 1); renderPer();
    $("hNotesIn").value = c.notes || "";
    $("hNotesIn").placeholder = act ? "How to do it, the best way, what to do next…" : "Why this matters, what 'done' looks like…";
    if (act) { const p = progress(id), d = doneDates(id); $("hHistory").textContent = d.length ? "Done " + d.length + "× · last " + new Date(p.last + "T12:00").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" }) : "Not done yet."; }
    $("hHistory").hidden = !act;
    $("hClear").hidden = !c.text; $("hClearYes").parentElement.hidden = true;
    $("hForm").hidden = false; $("hForm").scrollIntoView({ block: "start", behavior: "smooth" });
  }
  function closeForm() { editing = null; $("hForm").hidden = true; renderHarada(); }
  $("hSave").onclick = () => {
    if (!editing) return; const act = isAction(editing), text = $("hText").value.trim();
    const patch = { text, notes: $("hNotesIn").value.trim() };
    if (act) { patch.per = fPer; patch.times = fTimes; }
    if (editing === "c") patch.by = $("hByInput").value || null;
    if (/^g\d+$/.test(editing)) patch.focus = fFocus;
    saveCell(editing, patch); toast("Saved"); closeForm();
  };
  $("hCancel").onclick = closeForm;
  $("hClear").onclick = () => { $("hClearYes").parentElement.hidden = false; };
  $("hClearYes").onclick = () => { if (!editing) return; saveCell(editing, { text: "", notes: "", per: "day", times: 1, by: null }); toast("Cleared"); closeForm(); };

  /* ---------- entry points ---------- */
  function renderHarada() {
    [["today", "hTabToday", "hTodayView"], ["grid", "hTabGrid", "hGridView"], ["notes", "hTabNotes", "hNotesView"]].forEach(([k, b, p]) => { $(b).setAttribute("aria-selected", String(k === view)); $(p).hidden = k !== view; });
    if (view === "today") renderToday(); else if (view === "grid") renderGrid(); else renderNotes();
  }
  window.renderHarada = renderHarada;
  window.haradaBusy = () => !$("hForm").hidden && $("hForm").contains(document.activeElement);
  window.haradaHasData = () => Object.keys(doc.haradaCells || {}).length + Object.keys(doc.haradaTicks || {}).length > 0;
})();
