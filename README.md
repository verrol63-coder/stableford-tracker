# Stableford Tracker

A live-synced, installable Stableford round tracker with handicap allowance —
works for any course worldwide.

- **Create a round**: enter/paste any course's Par & Stroke Index, add players
  and their Course Handicap. A Wrexham Golf Club (yellow tees) quick-start
  preset matches the roster and tee times used by the
  `Wrexham-golf-club-Tee-booking` GitHub Action.
- **Get a 5-character round code** — share it with your group.
- **Everyone joins from their own phone**, picks their name (or adds
  themselves), and enters their own scores. Stableford points are calculated
  automatically per hole, live, for everyone.
- **Installable as an app** (PWA) — add it to your home screen on iOS or
  Android, opens full-screen with its own icon.

See `SETUP.md` for the one-time, ~20 minute setup (free Firebase project +
deploy). After that, sharing is just sending people the app's URL.

## Local development

```bash
npm install
npm run dev
```

## Deploy

```bash
npm run build
firebase deploy
```
