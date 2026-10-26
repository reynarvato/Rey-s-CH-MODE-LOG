const assert = require("assert");
const D = require("../merge.js");
let n = 0; const t = (name, fn) => { fn(); n++; console.log("ok  " + name); };

const s = (id, upd, extra = {}) => ({ id, date: "2026-10-10", start: "09:00", end: "10:00", type: "Writing", quality: 3, exhaustion: 2, mins: 60, startTs: 1000 + upd, endTs: 2000, images: [], links: [], notes: "", updatedAt: upd, ...extra });

t("newer edit wins per session", () => {
  const m = D.merge({ sessions: { a: s("a", 5, { notes: "local" }) } }, { sessions: [s("a", 9, { notes: "remote" })] });
  assert.strictEqual(m.sessions.a.notes, "remote");
  const m2 = D.merge({ sessions: { a: s("a", 12, { notes: "local" }) } }, { sessions: [s("a", 9, { notes: "remote" })] });
  assert.strictEqual(m2.sessions.a.notes, "local");
});
t("union of both sides", () => {
  const m = D.merge({ sessions: { a: s("a", 1) } }, { sessions: [s("b", 2)] });
  assert.deepStrictEqual(Object.keys(m.sessions).sort(), ["a", "b"]);
});
t("delete tombstone beats older copy", () => {
  const m = D.merge({ sessions: { a: { id: "a", deleted: true, updatedAt: 10 } } }, { sessions: [s("a", 5)] });
  assert.ok(m.sessions.a.deleted);
});
t("types and active take newer", () => {
  const m = D.merge({ types: { list: ["A"], updatedAt: 1 }, active: { cleared: true, updatedAt: 9 } }, { types: { list: ["A", "B"], updatedAt: 2 }, active: { type: "A", startTs: 5, updatedAt: 3 } });
  assert.deepStrictEqual(m.types.list, ["A", "B"]); assert.ok(m.active.cleared);
});
t("merge with null remote keeps local; sameData detects equality", () => {
  const local = { sessions: { a: s("a", 1) }, types: { list: ["A"], updatedAt: 1 }, active: null };
  const m = D.merge(local, null);
  assert.ok(D.sameData(m, D.toRemote(m)));
  assert.ok(!D.sameData(m, { sessions: [] }));
});
t("CSV export escapes notes and skips deleted", () => {
  const csv = D.toCSV({ sessions: { a: s("a", 1, { notes: 'said "hi", then\nleft', quality: null }), b: { id: "b", deleted: true, updatedAt: 2 } } });
  const rows = D.parseCSV(csv);
  assert.strictEqual(rows.length, 2);
  assert.deepStrictEqual(rows[0], D.CSV_HEADER);
  assert.strictEqual(rows[1][7], 'said "hi", then\nleft');
  assert.strictEqual(rows[1][4], "");
});
t("normalise dates and times from Excel-style CSVs", () => {
  assert.strictEqual(D.normDate("10/10/2026"), "2026-10-10");
  assert.strictEqual(D.normDate("2026-10-9"), "2026-10-09");
  assert.strictEqual(D.normDate("46305"), "2026-10-10");
  assert.strictEqual(D.normTime("9:05"), "09:05");
  assert.strictEqual(D.normTime("09:05:00"), "09:05");
  assert.strictEqual(D.normTime("2:30 PM"), "14:30");
  assert.strictEqual(D.normTime("0.5"), "12:00");
  assert.strictEqual(D.normTime("0930"), "09:30");
});
t("import old log rows, deterministic ids, midnight crossing", () => {
  const rows = D.parseCSV("Day,Start,Type,End,Quality,Exhaustion,Duration,Notes\n10/10/2026,23:30,Writing,00:30,4,3,1,late one\n11/10/2026,09:00,Admin,09:45,,,0.75,\nbad row,,,,,,,\n");
  const r = D.importRows(rows, 5);
  assert.strictEqual(r.sessions.length, 2); assert.strictEqual(r.skipped, 1);
  assert.strictEqual(r.sessions[0].mins, 60); assert.strictEqual(r.sessions[0].quality, 4);
  assert.strictEqual(r.sessions[1].quality, null); assert.strictEqual(r.sessions[1].type, "Admin");
  assert.strictEqual(r.sessions[0].id, D.importRows(rows, 6).sessions[0].id);
});
t("import reports missing columns", () => {
  assert.ok(D.importRows(D.parseCSV("Foo,Bar\n1,2\n"), 1).error);
});
t("semicolon-delimited CSV (European Excel)", () => {
  const r = D.importRows(D.parseCSV("Date;Start;End\n2026-10-10;08:00;09:30\n"), 1);
  assert.strictEqual(r.sessions[0].mins, 90);
});
t("stats prefs sync, newer wins", () => {
  const m = D.merge({ prefs: { statsExcluded: ["Lunch"], updatedAt: 5 } }, { prefs: { statsExcluded: [], updatedAt: 2 } });
  assert.deepStrictEqual(m.prefs.statsExcluded, ["Lunch"]);
  assert.deepStrictEqual(D.toRemote(m).prefs.statsExcluded, ["Lunch"]);
});
t("recomp plan merges per exercise and survives toRemote", () => {
  const m = D.merge({ recompPlan: { "S1|Bench Press": { changes: [{ from: 4, plan: { kg: 45 } }], updatedAt: 9 } } },
    { recompPlan: { "S1|Bench Press": { changes: [], updatedAt: 2 }, "S4|Leg Press": { changes: [{ from: 3, plan: { kg: 125 } }], updatedAt: 3 } } });
  assert.strictEqual(m.recompPlan["S1|Bench Press"].changes[0].plan.kg, 45); assert.strictEqual(m.recompPlan["S4|Leg Press"].changes[0].plan.kg, 125);
  assert.ok(D.toRemote(m).recompPlan["S4|Leg Press"]);
});
t("recomp days and weeks merge per record", () => {
  const m = D.merge({ recompDays: { "2026-10-12": { weight: 83.9, updatedAt: 9 } }, recompWeeks: { "1": { ticks: { "S1|Squat": "✓" }, updatedAt: 1 } } },
    { recompDays: { "2026-10-12": { weight: 84.5, updatedAt: 2 }, "2026-10-13": { weight: 83.7, updatedAt: 3 } }, recompWeeks: { "1": { ticks: {}, updatedAt: 5 } } });
  assert.strictEqual(m.recompDays["2026-10-12"].weight, 83.9); assert.strictEqual(m.recompDays["2026-10-13"].weight, 83.7);
  assert.deepStrictEqual(m.recompWeeks["1"].ticks, {});
  assert.ok(D.sameData(m, D.toRemote(m)));
});
t("jobs merge per record, roles newer wins, delete sticks", () => {
  const m = D.merge({ jobs: { a: { id: "a", title: "A", applied: "2026-10-15", updatedAt: 9 }, b: { id: "b", deleted: true, updatedAt: 8 } }, jobRoles: { list: ["ML"], updatedAt: 1 } },
    { jobs: { a: { id: "a", title: "A", updatedAt: 3 }, b: { id: "b", title: "B", updatedAt: 2 }, c: { id: "c", title: "C", updatedAt: 4 } }, jobRoles: { list: ["ML", "Robotics"], updatedAt: 5 } });
  assert.strictEqual(m.jobs.a.applied, "2026-10-15"); assert.ok(m.jobs.b.deleted); assert.strictEqual(m.jobs.c.title, "C");
  assert.deepStrictEqual(m.jobRoles.list, ["ML", "Robotics"]);
  assert.ok(D.sameData(m, D.toRemote(m)));
});
t("job stage: saved → applied → ongoing → closed", () => {
  assert.strictEqual(D.jobStage({}), "saved");
  assert.strictEqual(D.jobStage({ applied: "2026-10-15" }), "applied");
  assert.strictEqual(D.jobStage({ applied: "2026-10-15", interview: "2026-10-20" }), "ongoing");
  assert.strictEqual(D.jobStage({ applied: "2026-10-15", outcome: "offer" }), "ongoing");
  assert.strictEqual(D.jobStage({ applied: "2026-10-15", outcome: "rejected" }), "closed");
  assert.strictEqual(D.jobStage({ interview: "2026-10-20", outcome: "accepted" }), "closed");
  assert.strictEqual(D.jobStage({ deleted: true }), null);
});
t("jobs CSV skips deleted and escapes notes", () => {
  const rows = D.parseCSV(D.jobsCSV({ jobs: { a: { id: "a", title: "ML, Acme", role: "ML", url: "https://x.y", applied: "2026-10-15", notes: 'said "maybe"', createdAt: 1, updatedAt: 1 }, b: { id: "b", deleted: true, updatedAt: 2 } } }));
  assert.strictEqual(rows.length, 2); assert.deepStrictEqual(rows[0], D.JOBS_HEADER);
  assert.strictEqual(rows[1][1], "ML, Acme"); assert.strictEqual(rows[1][4], "applied"); assert.strictEqual(rows[1][9], 'said "maybe"');
});
console.log(n + " tests passed");
