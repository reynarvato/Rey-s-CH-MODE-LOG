# Chmode Log — to do

Added 10 Oct 2026.

## Log table
- [x] **Duration column** shown as h:mm (e.g. 1:25), coloured on the Excel red→yellow→green scale (longer = greener). Replaces or sits beside the current "Hrs" decimal column.
- [x] **Oldest at top, newest at bottom** (spreadsheet order), so the latest row sits nearest the debrief form; scroll the table to the bottom on load.
- [x] **Show only today's and yesterday's rows** by default. A "Show all" button reveals the full history (in pages, so 500+ rows stay fast); remember the choice only for that visit.

## Day clock
- [x] A sleek **24-hour wall clock** (midnight at top, noon at bottom) for the selected day:
  - each session drawn as a coloured arc on the ring, one colour per work type (Writing, Technical, Meeting…), with a small legend
  - gaps left neutral = free time; a running session drawn live up to the current time, with a hand showing now
  - centre shows totals: productive hours vs free hours for the day (and awake-hours share if a sleep window is set later)
  - swipe or arrows to step back through previous days
  - placement: top of the Stats tab, plus a small version on the Log tab
  - type colours need to be picked so they stay distinct from the red/yellow/green quality scale

## Stats
- [x] **Count these types** checklist on Stats (synced across devices); hours, averages, weekly chart, by-type table and the clock's "counted" total follow it.
- [x] **Type as the 3rd column** (Date, Start, Type, End, Duration, Q, E, Notes).

Done in v1.1.0 (11 Oct 2026).

## Recomp
- [x] **Recomp tab** (v1.2.0, 11 Oct 2026): 12-week experiment from `Recomp_Session_Tracker.xlsx`. One week per screen: workout ticks (✓/✗), weekly actions (4 tick themselves from the daily log), 7-day daily log, summary, all-weeks table and weight vs target chart. Syncs to `data/recomp/daily_log.csv` for analyse.py.

## Jobs
- [x] **Jobs tab** (v1.3.0, 15 Oct 2026): save postings found on the phone (link, title, role tag — addable like session types), tick Applied / Interview, set the outcome, notes. Grouped Ongoing (past the auto-reject) → Applied → Saved (not applied yet) → Closed. Syncs to `data/jobs.csv`.

## Planned
- [ ] Spend tab (receipt logging) — see `receipts-spec.md`
