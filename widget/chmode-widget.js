// Chmode Log home-screen widget for Scriptable (iOS).
// Shows: a running session, hours this week, and 7-day average quality / exhaustion.
// Setup: see README → "Home-screen widget". Paste your values below.

const REPO = "reynarvato/Rey-s-CH-MODE-DATA";        // your private data repo
const BRANCH = "main";
const APP_URL = "https://reynarvato.github.io/Rey-s-CH-MODE-LOG/"; // tapping the widget opens the app
const KEY = "chmode_token";                    // token is kept in the iOS Keychain, not in this file

// First run inside Scriptable asks for the token once and stores it in the Keychain.
if (!Keychain.contains(KEY)) {
  if (config.runsInWidget) { Script.setWidget(message("Open Scriptable and run this script once to add your token.")); Script.complete(); return; }
  const a = new Alert(); a.title = "GitHub token"; a.message = "Paste the same fine-grained token the app uses (Contents: Read on the data repo is enough).";
  a.addSecureTextField("github_pat_…"); a.addAction("Save"); a.addCancelAction("Cancel");
  if ((await a.present()) === -1) return;
  Keychain.set(KEY, a.textFieldValue(0).trim());
}

const G = new Color("#63BE7B"), Y = new Color("#FFEB84"), R = new Color("#F8696B");
function scale(t) { // Excel red→yellow→green, t in 0..1 (1 = good)
  t = Math.max(0, Math.min(1, t));
  const [a, b, u] = t < .5 ? [R, Y, t * 2] : [Y, G, (t - .5) * 2];
  const mix = (x, y) => Math.round((x + (y - x) * u) * 255);
  const hex = v => v.toString(16).padStart(2, "0");
  return new Color("#" + hex(mix(a.red, b.red)) + hex(mix(a.green, b.green)) + hex(mix(a.blue, b.blue)));
}
function message(text) { const w = new ListWidget(); const t = w.addText(text); t.font = Font.systemFont(12); w.url = APP_URL; return w; }

let log;
try {
  const req = new Request("https://api.github.com/repos/" + REPO + "/contents/data/log.json?ref=" + BRANCH);
  req.headers = { Authorization: "Bearer " + Keychain.get(KEY), Accept: "application/vnd.github.raw", "X-GitHub-Api-Version": "2022-11-28" };
  log = JSON.parse(await req.loadString());
  if (!log || !log.sessions) throw new Error(log && log.message || "No log yet");
} catch (e) {
  const w = message("Chmode: couldn't load the log.\n" + e.message);
  if (config.runsInWidget) Script.setWidget(w); else await w.presentSmall();
  Script.complete(); return;
}

const now = Date.now();
const live = (log.sessions || []).filter(s => !s.deleted && s.startTs);
const mon = new Date(); mon.setHours(0, 0, 0, 0); mon.setDate(mon.getDate() - ((mon.getDay() + 6) % 7));
const weekH = live.filter(s => s.startTs >= mon.getTime()).reduce((a, s) => a + s.mins, 0) / 60;
const last7 = live.filter(s => s.startTs >= now - 7 * 864e5);
const avg = k => { const v = last7.map(s => s[k]).filter(x => x >= 1 && x <= 5); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
const q = avg("quality"), ex = avg("exhaustion");
const act = log.active && !log.active.cleared && log.active.startTs ? log.active : null;

const w = new ListWidget();
w.url = APP_URL;
w.setPadding(12, 14, 12, 14);
const title = w.addText("CHMODE"); title.font = Font.semiboldSystemFont(10); title.textOpacity = 0.6;
w.addSpacer(4);

if (act) {
  const t = w.addText(act.type); t.font = Font.semiboldSystemFont(13);
  const d = w.addDate(new Date(act.startTs)); d.applyTimerStyle(); d.font = Font.monospacedDigitSystemFont(24, 500);
} else {
  const t = w.addText(weekH.toFixed(1) + " h"); t.font = Font.monospacedDigitSystemFont(26, 500);
  const s = w.addText("this week"); s.font = Font.systemFont(11); s.textOpacity = 0.6;
}
w.addSpacer();

const row = w.addStack(); row.spacing = 6;
function cell(label, val, good) {
  const c = row.addStack(); c.layoutVertically(); c.setPadding(4, 6, 4, 6); c.cornerRadius = 6;
  if (val != null) c.backgroundColor = scale(good);
  const v = c.addText(val == null ? "–" : val.toFixed(1)); v.font = Font.monospacedDigitSystemFont(14, 600); if (val != null) v.textColor = Color.black();
  const l = c.addText(label); l.font = Font.systemFont(9); if (val != null) l.textColor = Color.black(); else l.textOpacity = 0.6;
}
cell("qual 7d", q, q == null ? 0 : (q - 1) / 4);
cell("exh 7d", ex, ex == null ? 0 : (5 - ex) / 4);
if (act) { const h = row.addText(weekH.toFixed(1) + "h wk"); h.font = Font.systemFont(10); h.textOpacity = 0.6; }

w.refreshAfterDate = new Date(now + 15 * 60000);
if (config.runsInWidget) Script.setWidget(w); else await w.presentSmall();
Script.complete();
