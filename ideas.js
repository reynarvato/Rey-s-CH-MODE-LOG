/* Ideas tab — a canvas for project ideas and side missions (an electronics build, a trip, a story).
   An idea is the whole assembly. Its canvas holds parts; tap into a part to open its own canvas
   (its subassembly), with the path shown above. Connections (the interfaces: cables, networking,
   code, bookings, plot threads…) can join any two parts at any level. At each level a connection
   to a part deeper inside is drawn to the box that contains it (dashed), and a connection to a part
   outside this level shows that part as a dashed "port" on the left. Tap a port to jump to it.
   Data: doc.ideas[id]     = { id, title, emoji, notes, status: "active"|"inactive", createdAt, updatedAt }
         doc.ideaNodes[id] = { id, ideaId, parent (part id or null = top level), title, emoji, image:{id,ext}|null,
                               notes, url, status, x, y, createdAt, updatedAt }
         doc.ideaLinks[id] = { id, ideaId, from, to, type, label, notes, createdAt, updatedAt }
         doc.linkTypes     = { list: [{ name, color }], updatedAt }
   Every record merges by updatedAt; deletes stay as tombstones. Part photos sync to data/images like session photos. */
const DEFAULT_LINK_TYPES = [
  { name: "Power", color: "#D9534F" }, { name: "Data", color: "#2F7FD1" }, { name: "Network", color: "#8B5CF6" },
  { name: "Code", color: "#2E9E68" }, { name: "Mechanical", color: "#C98A12" }, { name: "Depends on", color: "#7C8784" }
];
const LINK_PALETTE = ["#D9534F", "#2F7FD1", "#8B5CF6", "#2E9E68", "#C98A12", "#D2569A", "#1BA0A8", "#E07B39", "#5B6CD8", "#7C8784"];
const IDEA_EMOJIS = ["⚙️", "🔌", "🔋", "💡", "📡", "💻", "🧠", "🤖", "📷", "🔩", "🛠️", "📦", "🧩", "🗺️", "✈️", "🏨", "🍜", "🎫", "📖", "✍️", "🎭", "🎯", "💰", "⭐"];
const NW = 156, NH = 64, GH = 46, SVGNS = "http://www.w3.org/2000/svg";

const linkTypes = () => (doc.linkTypes && doc.linkTypes.list && doc.linkTypes.list.length) ? doc.linkTypes.list : DEFAULT_LINK_TYPES;
const linkColor = name => (linkTypes().find(t => t.name === name) || {}).color || "#7C8784";
const ideaList = () => Object.values(doc.ideas || {}).filter(i => i && !i.deleted);
const iv = { idea: null, level: null, sel: null, from: null, cams: {}, showInactive: false };
let liveMap = {}, liveLinks = [];

function saveIdeaRec(coll, rec) { doc[coll] = doc[coll] || {}; doc[coll][rec.id] = { ...rec, updatedAt: Date.now() }; return doc[coll][rec.id]; }
function tomb(coll, id) { doc[coll] = doc[coll] || {}; doc[coll][id] = { id, deleted: true, updatedAt: Date.now() }; }
function S(tag, attrs, parent) { const e = document.createElementNS(SVGNS, tag); for (const k in attrs || {}) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; }
function clip(s, n) { s = s || ""; return s.length > n ? s.slice(0, n - 1) + "…" : s; }
function wrap2(s, n) {
  const words = (s || "").split(/\s+/).filter(Boolean), lines = [""];
  for (const w of words) {
    const cur = lines[lines.length - 1];
    if (!cur) lines[lines.length - 1] = w; else if ((cur + " " + w).length <= n) lines[lines.length - 1] = cur + " " + w; else if (lines.length < 2) lines.push(w); else { lines[1] += " " + w; break; }
  }
  return lines.map(l => clip(l, n));
}
const icon = x => (x && x.emoji) || "▫️";

/* ---------------- tree helpers ---------------- */
function buildLive(ideaId) {
  const all = {}; Object.values(doc.ideaNodes || {}).forEach(n => { if (n && !n.deleted && n.ideaId === ideaId) all[n.id] = n; });
  const memo = {};
  const alive = (id, d) => { if (id in memo) return memo[id]; const n = all[id]; if (!n || d > 60) return false; memo[id] = true; return (memo[id] = n.parent == null ? true : alive(n.parent, d + 1)); };
  liveMap = {}; Object.keys(all).forEach(id => { if (alive(id, 0)) liveMap[id] = all[id]; });
  liveLinks = Object.values(doc.ideaLinks || {}).filter(l => l && !l.deleted && l.ideaId === ideaId && liveMap[l.from] && liveMap[l.to]);
}
const childrenOf = pid => Object.values(liveMap).filter(n => (n.parent || null) === (pid || null));
function pathTo(id) { const out = []; let cur = liveMap[id], d = 0; while (cur && d++ < 60) { out.unshift(cur); cur = liveMap[cur.parent]; } return out; }
/* The part directly on `level` that contains `id` (or is `id`); null if `id` sits outside this level. */
function repAt(id, level) {
  let cur = liveMap[id], d = 0;
  while (cur && d++ < 60) { if ((cur.parent || null) === (level || null)) return cur.id; if (cur.id === level) return null; cur = liveMap[cur.parent]; }
  return null;
}
function descendants(id) { const out = []; const walk = p => childrenOf(p).forEach(c => { out.push(c.id); walk(c.id); }); walk(id); return out; }
const isAncestor = (a, b) => pathTo(b).some(n => n.id === a);
function whereText(n) { const p = pathTo(n.id).slice(0, -1); const idea = doc.ideas[n.ideaId]; return p.length ? "in " + p.map(x => x.title).join(" › ") : "top level of " + ((idea && idea.title) || "this idea"); }

/* ---------------- list view ---------------- */
function ideaCounts(id) {
  let parts = 0, links = 0; Object.values(doc.ideaNodes || {}).forEach(n => { if (n && !n.deleted && n.ideaId === id) parts++; });
  Object.values(doc.ideaLinks || {}).forEach(l => { if (l && !l.deleted && l.ideaId === id) links++; });
  return { parts, links };
}
function lastEdit(id) {
  let t = (doc.ideas[id] || {}).updatedAt || 0;
  [doc.ideaNodes, doc.ideaLinks].forEach(c => Object.values(c || {}).forEach(r => { if (r && r.ideaId === id && (r.updatedAt || 0) > t) t = r.updatedAt; }));
  return t;
}
function renderIdeaList() {
  const all = ideaList().sort((a, b) => lastEdit(b.id) - lastEdit(a.id));
  const groups = [["active", "Active", "Nothing active. Start one above, or switch a parked idea back on."], ["inactive", "Inactive", ""]];
  const G = $("iGroups"); G.innerHTML = "";
  groups.forEach(([key, label, emptyText]) => {
    const list = all.filter(i => (i.status || "active") === key);
    if (key === "inactive" && !list.length) return;
    const sec = document.createElement("section"); sec.className = "card";
    const head = document.createElement("div"); head.className = "subhead";
    const l = document.createElement("span"); l.className = "lbl"; l.textContent = label + " · " + list.length; head.appendChild(l);
    if (key === "inactive") { const t = document.createElement("button"); t.type = "button"; t.className = "link"; t.textContent = iv.showInactive ? "Hide" : "Show"; t.onclick = () => { iv.showInactive = !iv.showInactive; renderIdeaList(); }; head.appendChild(t); }
    sec.appendChild(head);
    if (key === "inactive" && !iv.showInactive) { G.appendChild(sec); return; }
    if (!list.length) { const p = document.createElement("p"); p.className = "empty small"; p.style.margin = "0"; p.textContent = emptyText; sec.appendChild(p); G.appendChild(sec); return; }
    const box = document.createElement("div"); box.className = "ilist";
    list.forEach(i => {
      const row = document.createElement("div"); row.className = "irow" + (key === "inactive" ? " off" : "");
      const open = document.createElement("button"); open.type = "button"; open.className = "iopen";
      const e = document.createElement("span"); e.className = "iemo"; e.textContent = icon(i);
      const tx = document.createElement("span"); tx.className = "itext";
      const t = document.createElement("span"); t.className = "it"; t.textContent = i.title || "(untitled)";
      const c = ideaCounts(i.id), m = document.createElement("span"); m.className = "im";
      m.textContent = c.parts + " part" + (c.parts === 1 ? "" : "s") + " · " + c.links + " connection" + (c.links === 1 ? "" : "s") + " · " + ago(lastEdit(i.id) || Date.now());
      tx.append(t, m); open.append(e, tx); open.onclick = () => openIdea(i.id);
      const st = document.createElement("button"); st.type = "button"; st.className = "tick" + (key === "active" ? " yes" : "");
      st.textContent = key === "active" ? "Active" : "Inactive"; st.setAttribute("aria-label", (i.title || "Idea") + " is " + st.textContent.toLowerCase() + ", tap to switch");
      st.onclick = () => { saveIdeaRec("ideas", { ...i, status: key === "active" ? "inactive" : "active" }); persist(); renderIdeaList(); toast(key === "active" ? "Moved to inactive" : "Back to active"); };
      row.append(open, st); box.appendChild(row);
    });
    sec.appendChild(box); G.appendChild(sec);
  });
  if (!all.length) { const p = document.createElement("section"); p.className = "card"; p.innerHTML = '<p class="empty small" style="margin:0">Every idea and side mission gets its own canvas: an electronics build, a trip, a story. Break it into parts, open parts to plan their insides, and draw the connections between them.</p>'; G.prepend(p); }
}
$("iNew").onclick = () => openIdeaForm(null);

/* ---------------- canvas view ---------------- */
function openIdea(id, level, sel) {
  iv.idea = id; iv.level = level || null; iv.sel = sel || null; iv.from = null;
  ls.set("chmodeIdea", id); ls.set("chmodeIdeaLevel", iv.level || "");
  renderIdeas(); window.scrollTo(0, 0);
}
function closeIdea() { iv.idea = null; iv.from = null; iv.sel = null; ls.del("chmodeIdea"); ls.del("chmodeIdeaLevel"); renderIdeas(); }
function goLevel(level) {
  const prev = iv.level; iv.level = level || null; iv.sel = prev && prev !== iv.level ? repAt(prev, iv.level) : null;
  ls.set("chmodeIdeaLevel", iv.level || ""); renderCanvas();
}
function renderIdeas() {
  const idea = iv.idea && doc.ideas && doc.ideas[iv.idea];
  if (!idea || idea.deleted) { iv.idea = null; $("iListView").hidden = false; $("iCanvasView").hidden = true; renderIdeaList(); return; }
  $("iListView").hidden = true; $("iCanvasView").hidden = false;
  buildLive(iv.idea);
  if (iv.level && !liveMap[iv.level]) iv.level = null;
  if (iv.sel && !liveMap[iv.sel]) iv.sel = null;
  if (iv.from && !liveMap[iv.from]) iv.from = null;
  requestAnimationFrame(renderCanvas);
}
function renderCrumbs() {
  const C = $("iCrumbs"); C.innerHTML = "";
  const add = (txt, fn, cur) => {
    if (C.childNodes.length) { const s = document.createElement("span"); s.className = "csep"; s.textContent = "›"; C.appendChild(s); }
    const b = document.createElement("button"); b.type = "button"; b.className = "crumb" + (cur ? " cur" : ""); b.textContent = txt; b.onclick = fn; if (cur) b.setAttribute("aria-current", "page"); C.appendChild(b);
  };
  const idea = doc.ideas[iv.idea];
  add("‹ Ideas", closeIdea, false);
  add(icon(idea) + " " + clip(idea.title, 22), () => goLevel(null), !iv.level);
  pathTo(iv.level).forEach(n => add(icon(n) + " " + clip(n.title, 18), () => goLevel(n.id), n.id === iv.level));
  C.scrollLeft = C.scrollWidth;
}

/* Everything drawn at the current level: parts, ports to outside parts, and the connections. */
function scene() {
  const nodes = childrenOf(iv.level), edges = [], outside = {};
  liveLinks.forEach(l => {
    const a = repAt(l.from, iv.level), b = repAt(l.to, iv.level);
    if (a && b && a !== b) edges.push({ link: l, a, b, via: a !== l.from || b !== l.to });
    else if (a && !b) { (outside[l.to] = outside[l.to] || []).push(a); edges.push({ link: l, a, b: "g:" + l.to, via: true }); }
    else if (!a && b) { (outside[l.from] = outside[l.from] || []).push(b); edges.push({ link: l, a: "g:" + l.from, b, via: true }); }
  });
  const pos = {}; nodes.forEach(n => { pos[n.id] = { x: n.x || 0, y: n.y || 0, w: NW, h: NH }; });
  const minX = nodes.length ? Math.min(...nodes.map(n => n.x || 0)) : 0;
  const ghosts = Object.keys(outside).map(id => ({ id, n: liveMap[id], y: outside[id].reduce((s, a) => s + pos[a].y, 0) / outside[id].length })).sort((p, q) => p.y - q.y);
  ghosts.forEach((g, i) => { if (i) g.y = Math.max(g.y, ghosts[i - 1].y + GH + 12); pos["g:" + g.id] = { x: minX - NW - 70, y: g.y, w: NW, h: GH }; });
  return { nodes, edges, ghosts, pos };
}
const camKey = () => iv.idea + "/" + (iv.level || "");
const cam = () => iv.cams[camKey()] || { x: 0, y: 0, k: 1 };
const clampK = k => Math.max(.25, Math.min(2.5, k));
function fitCam(sc, w, h) {
  const boxes = Object.values(sc.pos);
  if (!boxes.length) return { x: w / 2, y: h / 2, k: 1 };
  const x0 = Math.min(...boxes.map(b => b.x - b.w / 2)), x1 = Math.max(...boxes.map(b => b.x + b.w / 2));
  const y0 = Math.min(...boxes.map(b => b.y - b.h / 2)), y1 = Math.max(...boxes.map(b => b.y + b.h / 2));
  const k = clampK(Math.min(1.2, (w - 40) / (x1 - x0 || 1), (h - 110) / (y1 - y0 || 1)));
  return { k, x: w / 2 - (x0 + x1) / 2 * k, y: (h - 50) / 2 - (y0 + y1) / 2 * k };
}
function applyCam() { const c = cam(); $("iCam").setAttribute("transform", "translate(" + c.x + " " + c.y + ") scale(" + c.k + ")"); }
function setCam(c) { iv.cams[camKey()] = c; applyCam(); }

function boxExit(c, t, w, h) {
  const dx = t.x - c.x, dy = t.y - c.y; if (!dx && !dy) return { x: c.x, y: c.y };
  const s = Math.min(dx ? (w / 2 + 3) / Math.abs(dx) : Infinity, dy ? (h / 2 + 3) / Math.abs(dy) : Infinity);
  return s >= 1 ? { x: c.x, y: c.y } : { x: c.x + dx * s, y: c.y + dy * s };
}
function drawEdges(sc) {
  const E = $("iEdges"), LB = $("iLabels"); E.innerHTML = ""; LB.innerHTML = "";
  const pairs = {}; sc.edges.forEach(e => { const k = [e.a, e.b].sort().join("|"); (pairs[k] = pairs[k] || []).push(e); });
  Object.values(pairs).forEach(list => list.forEach((e, i) => {
    let [p, q] = [e.a, e.b].sort(); const A = sc.pos[p], B = sc.pos[q]; if (!A || !B) return;
    const off = (i - (list.length - 1) / 2) * 26, dx = B.x - A.x, dy = B.y - A.y, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
    const cx = (A.x + B.x) / 2 + nx * off * 2, cy = (A.y + B.y) / 2 + ny * off * 2;
    const p1 = boxExit(A, { x: cx, y: cy }, A.w, A.h), p2 = boxExit(B, { x: cx, y: cy }, B.w, B.h);
    const d = "M" + p1.x + " " + p1.y + " Q" + cx + " " + cy + " " + p2.x + " " + p2.y;
    const lx = .25 * p1.x + .5 * cx + .25 * p2.x, ly = .25 * p1.y + .5 * cy + .25 * p2.y;
    const col = linkColor(e.link.type), g = S("g", { "data-hit": "link", "data-id": e.link.id, class: "iedge" + (iv.selLink === e.link.id ? " sel" : "") }, E);
    S("path", { d, class: "ehit" }, g);
    S("path", { d, class: "eline", stroke: col, "stroke-dasharray": e.via ? "7 5" : "none" }, g);
    const txt = clip(e.link.label || e.link.type || "", 22);
    if (txt) {
      const w = txt.length * 6.4 + 16, pg = S("g", { "data-hit": "link", "data-id": e.link.id, class: "ipill" }, LB);
      S("rect", { x: lx - w / 2, y: ly - 10, width: w, height: 20, rx: 10, class: "epill", stroke: col }, pg);
      S("text", { x: lx, y: ly + 4, class: "etext", "text-anchor": "middle" }, pg).textContent = txt;
    }
  }));
}
function drawNode(N, n) {
  const g = S("g", { "data-hit": "node", "data-id": n.id, transform: "translate(" + ((n.x || 0) - NW / 2) + " " + ((n.y || 0) - NH / 2) + ")",
    class: "inode" + (iv.sel === n.id ? " sel" : "") + (iv.from === n.id ? " from" : "") + (n.status === "inactive" ? " off" : "") }, N);
  S("rect", { width: NW, height: NH, rx: 12, class: "nbox" }, g);
  if (n.image) {
    const im = S("image", { x: 8, y: 8, width: 48, height: 48, preserveAspectRatio: "xMidYMid slice", "clip-path": "url(#iClip)" }, g);
    imgURL(n.image).then(u => { if (u) im.setAttribute("href", u); });
  } else if (n.emoji) S("text", { x: 32, y: 42, class: "nemo", "text-anchor": "middle" }, g).textContent = n.emoji;
  else { S("rect", { x: 10, y: 12, width: 44, height: 40, rx: 10, class: "ninit" }, g); S("text", { x: 32, y: 39, class: "ninitt", "text-anchor": "middle" }, g).textContent = (n.title || "?").trim().charAt(0).toUpperCase(); }
  const lines = wrap2(n.title, 12);
  lines.forEach((ln, i) => { S("text", { x: 64, y: lines.length > 1 ? 27 + i * 16 : 35, class: "ntitle" }, g); });
  lines.forEach((ln, i) => { g.querySelectorAll("text.ntitle")[i].textContent = ln; fitText(g.querySelectorAll("text.ntitle")[i], NW - 72); });
  const kids = childrenOf(n.id).length, marks = (n.notes ? "≡ " : "") + (n.url ? "↗" : "");
  if (marks) S("text", { x: 64, y: NH - 7, class: "nmark" }, g).textContent = marks.trim();
  if (kids) S("text", { x: NW - 9, y: NH - 7, class: "nbadge", "text-anchor": "end" }, g).textContent = "▸ " + kids;
  return g;
}
function fitText(t, max) { try { if (t.textContent && t.getComputedTextLength() > max) { t.setAttribute("textLength", max); t.setAttribute("lengthAdjust", "spacingAndGlyphs"); } } catch (e) { } }
function drawGhost(N, gh, P) {
  const g = S("g", { "data-hit": "ghost", "data-id": gh.id, transform: "translate(" + (P.x - NW / 2) + " " + (P.y - GH / 2) + ")", class: "ighost" }, N);
  S("rect", { width: NW, height: GH, rx: 10, class: "gbox" }, g);
  const t1 = S("text", { x: 10, y: 19, class: "gtitle" }, g); t1.textContent = "↗ " + (gh.n.emoji ? gh.n.emoji + " " : "") + clip(gh.n.title, 16); fitText(t1, NW - 18);
  const t2 = S("text", { x: 10, y: 36, class: "gsub" }, g); t2.textContent = clip(whereText(gh.n), 26); fitText(t2, NW - 18);
}
let lastScene = null;
function renderCanvas() {
  if ($("pageIdeas").hidden || $("iCanvasView").hidden || !iv.idea) return;
  buildLive(iv.idea); renderCrumbs();
  const svg = $("iSvg"), r = svg.getBoundingClientRect(); if (!r.width) return;
  const sc = lastScene = scene();
  if (!iv.cams[camKey()]) iv.cams[camKey()] = fitCam(sc, r.width, r.height);
  applyCam(); drawEdges(sc);
  const N = $("iNodes"); N.innerHTML = "";
  sc.ghosts.forEach(gh => drawGhost(N, gh, sc.pos["g:" + gh.id]));
  sc.nodes.forEach(n => drawNode(N, n));
  const empty = $("iEmpty"), here = iv.level && liveMap[iv.level];
  empty.hidden = sc.nodes.length > 0;
  empty.textContent = here ? "Nothing inside " + here.title + " yet. Add the parts that make it up." : "Start with the big pieces. Tap + Part to add the first one, then open it to plan what's inside.";
  renderBar();
}
function renderBar() {
  const B = $("iBar"), from = iv.from && liveMap[iv.from], sel = iv.sel && liveMap[iv.sel];
  $("iBanner").hidden = !from;
  if (from) { $("iBannerText").innerHTML = ""; const b = document.createElement("b"); b.textContent = "From " + icon(from) + " " + clip(from.title, 20) + ": tap the other end"; const s = document.createElement("span"); s.textContent = "Open parts or use the path above to reach other levels"; $("iBannerText").append(b, s); }
  B.innerHTML = ""; B.hidden = !sel; if (!sel) return;
  const t = document.createElement("span"); t.className = "cbar-t"; t.textContent = icon(sel) + " " + clip(sel.title, 18); B.appendChild(t);
  const btn = (txt, fn, cls) => { const b = document.createElement("button"); b.type = "button"; b.className = cls || "ghost"; b.textContent = txt; b.onclick = fn; B.appendChild(b); return b; };
  if (from && sel.id !== from.id) btn("Connect here", () => finishConnect(sel.id), "cprimary");
  const kids = childrenOf(sel.id).length;
  btn(kids ? "Inside ▸ " + kids : "Open inside ▸", () => goLevel(sel.id));
  if (!from) { btn("Connect", () => { iv.from = sel.id; iv.sel = null; renderCanvas(); }); btn("Edit", () => openNodeForm(sel)); }
}
$("iBannerCancel").onclick = () => { iv.from = null; renderCanvas(); };
$("iFit").onclick = () => { const r = $("iSvg").getBoundingClientRect(); if (lastScene) setCam(fitCam(lastScene, r.width, r.height)); };
$("iAdd").onclick = () => openNodeForm(null);
$("iDetails").onclick = () => openIdeaForm(doc.ideas[iv.idea]);
$("iTypesBtn").onclick = () => openTypesForm();
if (window.ResizeObserver) new ResizeObserver(() => { if (!$("iCanvasView").hidden) renderCanvas(); }).observe($("iCanvas"));

function finishConnect(to) {
  const from = iv.from;
  if (!from || !liveMap[from] || !liveMap[to] || from === to) return;
  if (isAncestor(from, to) || isAncestor(to, from)) { toast("One of those is inside the other. Pick a part at the same level or elsewhere."); return; }
  iv.from = null; iv.sel = null; renderCanvas();
  openLinkForm({ id: null, ideaId: iv.idea, from, to, type: ls.get("chmodeLinkType") || linkTypes()[0].name, label: "", notes: "" });
}

/* ---------------- gestures: tap, drag parts, pan, pinch/wheel zoom ---------------- */
const ptrs = new Map(); let gesture = null, lastTap = { id: null, t: 0 };
function localPt(e) { const r = $("iSvg").getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
function hitOf(t) { const g = t && t.closest && t.closest("[data-hit]"); return g ? { kind: g.dataset.hit, id: g.dataset.id } : { kind: "bg" }; }
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y), midp = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
$("iSvg").addEventListener("pointerdown", e => {
  try { $("iSvg").setPointerCapture(e.pointerId); } catch (err) { }
  const p = localPt(e); ptrs.set(e.pointerId, p);
  if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; gesture = { kind: "pinch", d: dist(a, b) || 1, mid: midp(a, b), cam: { ...cam() } }; return; }
  if (ptrs.size > 2) return;
  gesture = { kind: "press", hit: hitOf(e.target), start: p, cam: { ...cam() }, moved: false };
  if (gesture.hit.kind === "node" && liveMap[gesture.hit.id]) { const n = liveMap[gesture.hit.id]; gesture.n0 = { x: n.x || 0, y: n.y || 0 }; gesture.el = e.target.closest("[data-hit]"); }
});
$("iSvg").addEventListener("pointermove", e => {
  if (!ptrs.has(e.pointerId) || !gesture) return;
  const p = localPt(e); ptrs.set(e.pointerId, p);
  if (gesture.kind === "pinch") {
    if (ptrs.size < 2) return; const [a, b] = [...ptrs.values()], c0 = gesture.cam, k = clampK(c0.k * dist(a, b) / gesture.d), m = midp(a, b);
    const wx = (gesture.mid.x - c0.x) / c0.k, wy = (gesture.mid.y - c0.y) / c0.k; setCam({ k, x: m.x - wx * k, y: m.y - wy * k }); return;
  }
  if (gesture.kind !== "press") return;
  const dx = p.x - gesture.start.x, dy = p.y - gesture.start.y;
  if (!gesture.moved && Math.hypot(dx, dy) < 7) return;
  gesture.moved = true;
  if (gesture.n0) {
    const n = liveMap[gesture.hit.id], k = gesture.cam.k; n.x = Math.round(gesture.n0.x + dx / k); n.y = Math.round(gesture.n0.y + dy / k);
    gesture.el.setAttribute("transform", "translate(" + (n.x - NW / 2) + " " + (n.y - NH / 2) + ")");
    lastScene.pos[n.id] = { x: n.x, y: n.y, w: NW, h: NH }; drawEdges(lastScene);
  } else setCam({ ...gesture.cam, x: gesture.cam.x + dx, y: gesture.cam.y + dy });
});
function endPtr(e) {
  if (!ptrs.has(e.pointerId)) return; ptrs.delete(e.pointerId);
  const g = gesture; if (!g) return;
  gesture = ptrs.size ? { kind: "done" } : null;
  if (g.kind !== "press" || e.type === "pointercancel") { if (g.n0 && g.moved) { saveIdeaRec("ideaNodes", liveMap[g.hit.id]); persist(); renderCanvas(); } return; }
  if (g.moved) { if (g.n0) { saveIdeaRec("ideaNodes", liveMap[g.hit.id]); persist(); renderCanvas(); } return; }
  onTap(g.hit);
}
$("iSvg").addEventListener("pointerup", endPtr); $("iSvg").addEventListener("pointercancel", endPtr);
$("iSvg").addEventListener("wheel", e => {
  e.preventDefault(); const p = localPt(e), c = cam(), k = clampK(c.k * Math.exp(-e.deltaY * .0015));
  setCam({ k, x: p.x - (p.x - c.x) / c.k * k, y: p.y - (p.y - c.y) / c.k * k });
}, { passive: false });
function onTap(hit) {
  if (hit.kind === "node") {
    const now = Date.now();
    if (!iv.from && iv.sel === hit.id && lastTap.id === hit.id && now - lastTap.t < 420) { lastTap = { id: null, t: 0 }; goLevel(hit.id); return; }
    lastTap = { id: hit.id, t: now }; iv.sel = hit.id; renderCanvas(); return;
  }
  if (hit.kind === "ghost") { const n = liveMap[hit.id]; if (!n) return; iv.level = n.parent || null; ls.set("chmodeIdeaLevel", iv.level || ""); iv.sel = n.id; renderCanvas(); return; }
  if (hit.kind === "link") { const l = doc.ideaLinks[hit.id]; if (l && !iv.from) openLinkForm(l); return; }
  if (iv.sel) { iv.sel = null; renderCanvas(); }
}

/* ---------------- sheets ---------------- */
let sheetOpen = null;
function openSheet(which) {
  ["iIdeaForm", "iNodeForm", "iLinkForm", "iTypesForm"].forEach(id => { $(id).hidden = id !== which; });
  $("iSheetBg").hidden = false; sheetOpen = which; $("iSheet").scrollTop = 0; document.body.classList.add("noscroll");
}
function closeSheet() { $("iSheetBg").hidden = true; sheetOpen = null; iv.selLink = null; document.body.classList.remove("noscroll"); if (!$("iCanvasView").hidden) renderCanvas(); }
$("iSheetBg").addEventListener("click", e => { if (e.target === $("iSheetBg")) closeSheet(); });
document.addEventListener("keydown", e => { if (e.key === "Escape" && sheetOpen) closeSheet(); });
function chipRow(el, items, cur, onPick) {
  el.innerHTML = "";
  items.forEach(([v, label, dot]) => {
    const b = document.createElement("button"); b.type = "button"; b.className = "chip" + (dot ? " dot" : ""); b.setAttribute("aria-pressed", String(v === cur));
    if (dot) { const i = document.createElement("i"); i.style.background = dot; b.appendChild(i); }
    b.appendChild(document.createTextNode(label)); b.onclick = () => onPick(v); el.appendChild(b);
  });
}
function emojiPicker(el, input, getCur, setCur) {
  const draw = () => {
    el.innerHTML = ""; const cur = getCur();
    IDEA_EMOJIS.forEach(em => { const b = document.createElement("button"); b.type = "button"; b.className = "emo"; b.textContent = em; b.setAttribute("aria-pressed", String(em === cur)); b.setAttribute("aria-label", "Use " + em); b.onclick = () => { setCur(em); input.value = ""; draw(); }; el.appendChild(b); });
  };
  input.oninput = () => { const v = input.value.trim(); if (v) { setCur(Array.from(v).slice(0, 4).join("")); draw(); } };
  draw();
}
const statusItems = [["active", "Active"], ["inactive", "Inactive"]];
function showErr(id, msg) { $(id).textContent = msg; $(id).hidden = !msg; }

/* idea form */
let ideaForm = null;
function openIdeaForm(idea) {
  ideaForm = idea ? { ...idea } : { id: null, title: "", emoji: "💡", notes: "", status: "active" };
  $("iiHead").textContent = idea ? "Idea details" : "New idea";
  $("iiTitle").value = ideaForm.title || ""; $("iiNotes").value = ideaForm.notes || ""; $("iiEmojiIn").value = "";
  emojiPicker($("iiEmojis"), $("iiEmojiIn"), () => ideaForm.emoji, v => { ideaForm.emoji = v; });
  const st = () => chipRow($("iiStatus"), statusItems, ideaForm.status || "active", v => { ideaForm.status = v; st(); }); st();
  $("iiSave").textContent = idea ? "Save" : "Create and open"; $("iiDelete").hidden = !idea; $("iiDelConfirm").hidden = true; showErr("iiErr", "");
  if (idea) { const c = ideaCounts(idea.id); $("iiDelText").textContent = "Deletes " + c.parts + " part" + (c.parts === 1 ? "" : "s") + " and " + c.links + " connection" + (c.links === 1 ? "" : "s") + "."; }
  openSheet("iIdeaForm"); if (!idea) setTimeout(() => $("iiTitle").focus(), 50);
}
$("iiSave").onclick = () => {
  const title = $("iiTitle").value.trim(); if (!title) { showErr("iiErr", "Give the idea a name."); return; }
  const isNew = !ideaForm.id, id = ideaForm.id || newId(), prev = (doc.ideas || {})[id] || {};
  saveIdeaRec("ideas", { ...prev, id, title, emoji: ideaForm.emoji || "💡", notes: $("iiNotes").value.trim(), status: ideaForm.status || "active", createdAt: prev.createdAt || Date.now() });
  persist(); closeSheet();
  if (isNew) openIdea(id); else renderIdeas();
};
$("iiCancel").onclick = closeSheet;
$("iiDelete").onclick = () => { $("iiDelConfirm").hidden = false; };
$("iiDelYes").onclick = () => {
  const id = ideaForm && ideaForm.id; if (!id) return;
  Object.values(doc.ideaNodes || {}).forEach(n => { if (n && !n.deleted && n.ideaId === id) tomb("ideaNodes", n.id); });
  Object.values(doc.ideaLinks || {}).forEach(l => { if (l && !l.deleted && l.ideaId === id) tomb("ideaLinks", l.id); });
  tomb("ideas", id); persist(); closeSheet(); closeIdea(); toast("Idea deleted");
};

/* part form */
let nodeForm = null, nUploading = 0;
function renderNodePhoto() {
  const T = $("inThumb"); T.innerHTML = "";
  if (nUploading) { const b = document.createElement("div"); b.className = "thumb busy"; b.textContent = "Adding…"; T.appendChild(b); }
  else if (nodeForm.image) {
    const b = document.createElement("div"); b.className = "thumb busy"; b.textContent = "…";
    imgURL(nodeForm.image).then(u => { if (!u) { b.textContent = "Photo not on this phone yet"; return; } b.className = "thumb"; b.textContent = ""; const im = document.createElement("img"); im.src = u; im.alt = "Part photo"; im.onclick = () => { $("lightImg").src = u; $("lightbox").hidden = false; }; b.prepend(im); const x = document.createElement("button"); x.type = "button"; x.className = "x"; x.textContent = "✕"; x.setAttribute("aria-label", "Remove photo"); x.onclick = () => { nodeForm.image = null; renderNodePhoto(); }; b.appendChild(x); });
    T.appendChild(b);
  }
  $("inPhotoLbl").textContent = nodeForm.image ? "Change photo" : "Add photo";
  $("inEmojiWrap").classList.toggle("dim", !!nodeForm.image);
}
function openNodeForm(n) {
  nodeForm = n ? { ...n } : { id: null, title: "", emoji: "", notes: "", url: "", status: "active", image: null };
  $("inHead").textContent = n ? "Edit part" : (iv.level && liveMap[iv.level] ? "New part inside " + clip(liveMap[iv.level].title, 24) : "New part");
  $("inTitle").value = nodeForm.title || ""; $("inNotes").value = nodeForm.notes || ""; $("inUrl").value = nodeForm.url || ""; $("inEmojiIn").value = "";
  emojiPicker($("inEmojis"), $("inEmojiIn"), () => nodeForm.emoji, v => { nodeForm.emoji = v; });
  const st = () => chipRow($("inStatus"), statusItems, nodeForm.status || "active", v => { nodeForm.status = v; st(); }); st();
  renderNodePhoto();
  $("inSave").textContent = n ? "Save" : "Add part"; $("inDelete").hidden = !n; $("inDelConfirm").hidden = true; $("inInside").hidden = !n; showErr("inErr", "");
  if (n) {
    const kids = childrenOf(n.id).length; $("inInside").textContent = kids ? "Open inside · " + kids + " part" + (kids === 1 ? "" : "s") : "Open inside (empty)";
    const d = descendants(n.id), ids = new Set([n.id, ...d]), nl = liveLinks.filter(l => ids.has(l.from) || ids.has(l.to)).length;
    $("inDelText").textContent = "Deletes this part" + (d.length ? ", the " + d.length + " part" + (d.length === 1 ? "" : "s") + " inside it" : "") + (nl ? " and " + nl + " connection" + (nl === 1 ? "" : "s") : "") + ".";
    const ln = liveLinks.filter(l => l.from === n.id || l.to === n.id);
    const L = $("inLinks"); L.innerHTML = ""; $("inLinksWrap").hidden = !ln.length;
    ln.forEach(l => {
      const other = liveMap[l.from === n.id ? l.to : l.from], b = document.createElement("button"); b.type = "button"; b.className = "ilink";
      const i = document.createElement("i"); i.style.background = linkColor(l.type);
      const t = document.createElement("span"); t.textContent = (l.type || "Connection") + (l.label ? " · " + l.label : "") + " → " + icon(other) + " " + other.title;
      b.append(i, t); b.onclick = () => openLinkForm(l); L.appendChild(b);
    });
  } else $("inLinksWrap").hidden = true;
  openSheet("iNodeForm"); if (!n) setTimeout(() => $("inTitle").focus(), 50);
}
$("inFile").addEventListener("change", async e => {
  const f = e.target.files[0]; e.target.value = ""; if (!f) return;
  nUploading++; renderNodePhoto();
  try { const blob = await shrink(f), id = newId(), ext = extOf(blob.type || f.type); await imgPut({ id, blob, ext, synced: false }); nodeForm.image = { id, ext }; }
  catch (err) { toast("Couldn't add that photo on this phone."); }
  finally { nUploading--; renderNodePhoto(); }
});
/* Nearest free spot to the middle of the view, on a grid roomy enough for connections and labels to show. */
function freeSpot() {
  const r = $("iSvg").getBoundingClientRect(), c = cam(), cx = (r.width / 2 - c.x) / c.k, cy = ((r.height - 60) / 2 - c.y) / c.k;
  const sx = NW + 60, sy = NH + 70, sibs = childrenOf(iv.level), spots = [];
  for (let i = -6; i <= 6; i++) for (let j = -8; j <= 8; j++) spots.push({ x: Math.round(cx + i * sx), y: Math.round(cy + j * sy) });
  const score = q => Math.hypot((q.x - cx) / sx, (q.y - cy) / sy) + (q.x < cx ? .01 : 0) + (q.y < cy ? .02 : 0); /* ties go right, then down */
  spots.sort((a, b) => score(a) - score(b));
  return spots.find(s => !sibs.some(n => Math.abs((n.x || 0) - s.x) < NW + 30 && Math.abs((n.y || 0) - s.y) < NH + 40)) || { x: Math.round(cx), y: Math.round(cy) };
}
$("inSave").onclick = () => {
  const title = $("inTitle").value.trim(); if (!title) { showErr("inErr", "Give the part a name."); return; }
  const rawUrl = $("inUrl").value.trim(), url = rawUrl ? cleanUrl(rawUrl) : null;
  if (rawUrl && !url) { showErr("inErr", "That link doesn't look right."); return; }
  if (nUploading) { showErr("inErr", "Wait for the photo to finish adding."); return; }
  const isNew = !nodeForm.id, id = nodeForm.id || newId(), prev = (doc.ideaNodes || {})[id] || {}, spot = isNew ? freeSpot() : {};
  saveIdeaRec("ideaNodes", { ...prev, id, ideaId: iv.idea, parent: isNew ? (iv.level || null) : (prev.parent || null), title, emoji: nodeForm.emoji || "", image: nodeForm.image || null,
    notes: $("inNotes").value.trim(), url, status: nodeForm.status || "active", x: isNew ? spot.x : prev.x, y: isNew ? spot.y : prev.y, createdAt: prev.createdAt || Date.now() });
  if (isNew) {
    iv.sel = id; const r = $("iSvg").getBoundingClientRect(), c = cam(), px = spot.x * c.k + c.x, py = spot.y * c.k + c.y;
    if (px - NW / 2 * c.k < 0 || px + NW / 2 * c.k > r.width || py - NH / 2 * c.k < 56 || py + NH / 2 * c.k > r.height - 110) delete iv.cams[camKey()]; /* off-screen: refit on render */
  }
  persist(); closeSheet(); toast(isNew ? "Part added" : "Part saved");
};
$("inCancel").onclick = closeSheet;
$("inInside").onclick = () => { const id = nodeForm.id; closeSheet(); goLevel(id); };
$("inDelete").onclick = () => { $("inDelConfirm").hidden = false; };
$("inDelYes").onclick = () => {
  const id = nodeForm.id; if (!id) return; const ids = new Set([id, ...descendants(id)]);
  liveLinks.forEach(l => { if (ids.has(l.from) || ids.has(l.to)) tomb("ideaLinks", l.id); });
  ids.forEach(x => tomb("ideaNodes", x)); if (iv.sel && ids.has(iv.sel)) iv.sel = null; persist(); closeSheet(); toast("Part deleted");
};

/* connection form */
let linkForm = null;
function renderLinkTypeChips() {
  const items = linkTypes().map(t => [t.name, t.name, t.color]);
  if (linkForm.type && !items.some(i => i[0] === linkForm.type)) items.push([linkForm.type, linkForm.type + " (removed)", "#7C8784"]);
  chipRow($("ilTypes"), items, linkForm.type, v => { linkForm.type = v; renderLinkTypeChips(); });
}
function openLinkForm(l) {
  linkForm = { ...l }; iv.selLink = l.id || null;
  const a = liveMap[l.from], b = liveMap[l.to];
  $("ilHead").textContent = l.id ? "Connection" : "New connection";
  const end = (el, n) => { el.innerHTML = ""; const t = document.createElement("b"); t.textContent = icon(n) + " " + n.title; const s = document.createElement("span"); s.textContent = whereText(n); el.append(t, s); };
  end($("ilA"), a); end($("ilB"), b);
  $("ilLabel").value = l.label || ""; $("ilNotes").value = l.notes || "";
  renderLinkTypeChips();
  $("ilSave").textContent = l.id ? "Save" : "Add connection"; $("ilDelete").hidden = !l.id; $("ilDelConfirm").hidden = true;
  openSheet("iLinkForm"); if (!$("iCanvasView").hidden) renderCanvas();
}
$("ilSave").onclick = () => {
  const isNew = !linkForm.id, id = linkForm.id || newId(), prev = (doc.ideaLinks || {})[id] || {};
  saveIdeaRec("ideaLinks", { ...prev, id, ideaId: linkForm.ideaId, from: linkForm.from, to: linkForm.to, type: linkForm.type || "", label: $("ilLabel").value.trim(), notes: $("ilNotes").value.trim(), createdAt: prev.createdAt || Date.now() });
  if (linkForm.type) ls.set("chmodeLinkType", linkForm.type);
  persist(); closeSheet(); toast(isNew ? "Connected" : "Connection saved");
};
$("ilCancel").onclick = closeSheet;
$("ilFlip").onclick = () => { const t = linkForm.from; linkForm.from = linkForm.to; linkForm.to = t; const a = $("ilA").innerHTML; $("ilA").innerHTML = $("ilB").innerHTML; $("ilB").innerHTML = a; };
$("ilDelete").onclick = () => { $("ilDelConfirm").hidden = false; };
$("ilDelYes").onclick = () => { if (!linkForm.id) return; tomb("ideaLinks", linkForm.id); persist(); closeSheet(); toast("Connection deleted"); };
$("ilEditTypes").onclick = () => openTypesForm(true);

/* connection types */
let typesBack = false;
function saveLinkTypes(list) { doc.linkTypes = { list, updatedAt: Date.now() }; persist(); renderTypeRows(); }
function renderTypeRows() {
  const el = $("itRows"); el.innerHTML = "";
  linkTypes().forEach((t, i) => {
    const row = document.createElement("div"); row.className = "trow";
    const sw = document.createElement("button"); sw.type = "button"; sw.className = "swatch"; sw.style.background = t.color; sw.setAttribute("aria-label", "Change colour of " + t.name);
    sw.onclick = () => { const list = linkTypes().map(x => ({ ...x })), j = LINK_PALETTE.indexOf(t.color); list[i].color = LINK_PALETTE[(j + 1) % LINK_PALETTE.length]; saveLinkTypes(list); };
    const s = document.createElement("span"); s.className = "tname"; s.textContent = t.name;
    const x = document.createElement("button"); x.className = "x"; x.type = "button"; x.textContent = "✕"; x.setAttribute("aria-label", "Remove " + t.name);
    x.onclick = () => { if (linkTypes().length <= 1) { toast("Keep at least one type"); return; } saveLinkTypes(linkTypes().filter(y => y.name !== t.name)); };
    row.append(sw, s, x); el.appendChild(row);
  });
}
function openTypesForm(back) { typesBack = !!back; $("itBack").textContent = back ? "Back to connection" : "Done"; renderTypeRows(); openSheet("iTypesForm"); }
$("itAdd").onclick = () => {
  const v = $("itNew").value.trim(); if (!v) return;
  if (linkTypes().some(t => t.name.toLowerCase() === v.toLowerCase())) { toast(v + " is already a type"); return; }
  const used = linkTypes().map(t => t.color), color = LINK_PALETTE.find(c => !used.includes(c)) || LINK_PALETTE[linkTypes().length % LINK_PALETTE.length];
  $("itNew").value = ""; saveLinkTypes([...linkTypes(), { name: v, color }]);
  if (typesBack && linkForm) linkForm.type = v;
};
$("itNew").addEventListener("keydown", e => { if (e.key === "Enter") $("itAdd").click(); });
$("itBack").onclick = () => { if (typesBack && linkForm) { openSheet("iLinkForm"); renderLinkTypeChips(); } else closeSheet(); };

/* ---------------- hooks for app.js ---------------- */
function ideasBusy() { return !!gesture || !!sheetOpen; }
function ideaImageRefs() { const out = []; Object.values(doc.ideaNodes || {}).forEach(n => { if (n && !n.deleted && n.image) out.push(n.image.id); }); return out; }
/* Reopen the idea and level you were last on (checked against the data once it has loaded). */
iv.idea = ls.get("chmodeIdea") || null; iv.level = ls.get("chmodeIdeaLevel") || null;
