# Chmode Log

An offline-first phone app for logging work sessions: mark the start, debrief at the end (quality, exhaustion, notes, photos, links), and glance at how much and how well you've been working. Your log syncs to a **private** GitHub repo whenever you have signal.

- App code (this repo, public): served by GitHub Pages.
- Your data (a separate private repo, e.g. `Rey-s-CH-MODE-DATA`): `data/log.json`, `data/log.csv` (opens in Excel) and `data/images/`.

Keeping the two apart means the app can be hosted for free on GitHub Pages while your notes and photos stay private.

## One-time setup

1. **Data repo.** Create a private, empty repo, e.g. `reynarvato/Rey-s-CH-MODE-DATA` (tick "Add a README" so it has a `main` branch).
2. **Token.** GitHub → Settings → Developer settings → Personal access tokens → **Fine-grained tokens** → Generate:
   - Repository access: *Only select repositories* → `Rey-s-CH-MODE-DATA`
   - Permissions → Repository → **Contents: Read and write** (nothing else)
   - Expiry: up to a year. Put a reminder in for when it runs out.
3. **Install on iPhone.** Open the Pages URL (e.g. `https://reynarvato.github.io/Rey-s-CH-MODE-LOG/`) in **Safari** → Share → **Add to Home Screen**. Always open it from that icon: home-screen apps keep their data; a Safari tab can have its storage cleared by iOS after a week unused.
4. In the app, **Sync** tab → enter `reynarvato/Rey-s-CH-MODE-DATA`, paste the token, branch `main` → **Save and sync now**.
5. Optional: **Import CSV** on the Sync tab to bring in the old Excel log (Excel → Save As → CSV UTF-8).

The token is stored only on that phone. If you set up a second device, paste it there too; both devices merge their logs through the repo (newest edit of each session wins, deletes are kept).

## Home-screen widgets

iOS only lets native apps put widgets on the home screen, so there are two lightweight routes:

**One-tap open (Shortcuts).** Shortcuts app → new shortcut → *Open URLs* → your Pages URL. Add the Shortcuts widget to the home screen and pick that shortcut. (Or just put the app icon in your dock.)

**Glance widget (Scriptable).** Install *Scriptable* (free). New script → paste `widget/chmode-widget.js` → check `REPO` and `APP_URL` at the top → run it once in Scriptable and paste the token when asked (it goes into the iOS Keychain). Then add a Scriptable widget (small) to the home screen → long-press → Edit → Script: *chmode-widget*. It shows a running session's timer, or hours this week, plus 7-day quality and exhaustion in the same red/yellow/green colours. It reads from GitHub, so it reflects whatever the app last synced and refreshes about every 15 minutes.

## Making changes

Edit the files, then **bump the version** in both `app.js` (`APP_VERSION`) and `sw.js` (`VERSION`) and push. Pages redeploys in about a minute; the app shows *"New version ready — tap to update"* next time it's opened online. Your log is untouched by app updates.

Files:
- `index.html` — markup and styles
- `app.js` — app logic, storage (IndexedDB) and GitHub sync
- `recomp.js` — Recomp tab (12-week experiment)
- `jobs.js` — Jobs tab (job-hunt tracker)
- `merge.js` — pure helpers: merging two logs, CSV export/import (unit-tested in `test/`)
- `sw.js` — offline cache and update handling
- `widget/chmode-widget.js` — Scriptable widget

Run the tests with `node test/merge.test.js`.

## Data format

`data/log.json`:

```json
{ "version": 1,
  "types":  { "list": ["Writing", "Technical", "Meeting", "Admin"], "updatedAt": 1760000000000 },
  "active": { "type": "Writing", "startTs": 1760000000000, "updatedAt": 1760000000000 },
  "sessions": [
    { "id": "…", "date": "2026-10-10", "start": "09:00", "end": "10:30", "type": "Writing",
      "quality": 4, "exhaustion": 2, "mins": 90, "notes": "Done: …\nNext: …",
      "startTs": 1760083200000, "endTs": 1760088600000,
      "images": [{ "id": "…", "ext": "jpg" }], "links": ["https://…"], "updatedAt": 1760088700000 } ] }
```

Jobs live in the same file as `"jobRoles": { "list": […], "updatedAt": … }` and `"jobs": { "<id>": { "id", "url", "title", "role", "applied": "YYYY-MM-DD"|null, "interview": "YYYY-MM-DD"|null, "outcome": ""|"offer"|"accepted"|"rejected"|"withdrawn", "outcomeDate", "notes", "createdAt", "updatedAt" } }`, plus a `data/jobs.csv` copy for Excel. Stage is worked out from those fields: Saved (not applied) → Applied → Ongoing (reached an interview, or holding an offer) → Closed (rejected, accepted or withdrawn).

`quality` / `exhaustion` are 1–5 or `null` (skipped). Deleted sessions remain as `{ "id", "deleted": true, "updatedAt" }` so a delete on one device sticks.
