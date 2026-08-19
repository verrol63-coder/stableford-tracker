# Stableford Tracker — Setup & Deploy Guide

This turns the tracker into a real installable app with live score syncing
between phones. No paid plan needed — Firebase's free "Spark" tier covers
this comfortably (no credit card required).

**Steps 1–3 below are already done for you** — the Firebase project
(`stableford-tracker`), Firestore database (`eur3`, Europe), security rules,
and web app registration were all set up via Claude in Chrome, and
`src/firebase.js` already has your real config values in it. They're included
here so you know what's there and can redo any of it if you ever need to.

What's left is just the local/terminal half: install, test, deploy.

---

## 1. Create a Firebase project — ✅ done (`stableford-tracker`)

## 2. Turn on Firestore (the live database) — ✅ done (`eur3`, Production mode)

Security rules are published — a round is only accessible to someone who has
its 5-character code, no login involved. Don't post round codes anywhere
public. The published rules are in `firestore.rules` if you ever need to
re-paste them (Firestore console → Rules tab → paste → Publish).

## 3. Register a web app & get your config — ✅ done (`stableford-web`)

`src/firebase.js` already has the real `firebaseConfig` values for this
project. Nothing to paste here.

## 4. Install dependencies & test locally

Open a terminal in this folder and run:

```bash
npm install
npm run dev
```

Open the URL it prints (something like `http://localhost:5173`). Try creating a round — if you see a round code appear, Firebase is wired up correctly.

Press `Ctrl+C` to stop the dev server when you're done testing.

## 5. Deploy it to a real URL

```bash
npm install -g firebase-tools
firebase login
firebase init hosting
```

When `firebase init` asks:
- **Use an existing project** → pick the one you created in step 1.
- **What do you want to use as your public directory?** → type `dist`
- **Configure as a single-page app?** → `Yes`
- **Set up automatic builds with GitHub?** → `No` (unless you want that later)
- **File dist/index.html already exists. Overwrite?** → `No`

Then build and deploy:

```bash
npm run build
firebase deploy
```

It'll print a live URL like `https://stableford-tracker-xxxx.web.app` — that's your app, live on the internet, for free.

## 6. Install it on your phone (and everyone else's)

**iPhone (Safari):**
1. Open the URL from step 5.
2. Tap the **Share** icon (square with an arrow) → **Add to Home Screen** → **Add**.

**Android (Chrome):**
1. Open the URL.
2. Tap the **⋮** menu → **Install app** (or **Add to Home screen**).

It now behaves like a normal app — its own icon, opens full-screen, no browser bar.

Send the same URL to your Sunday four-ball (or anyone else) so they can install it too. Nobody needs a Firebase account or a login — they just open the link, install it, and either create a round or join one with a code.

## Updating later

Whenever you or I change the code:

```bash
npm run build
firebase deploy
```

That's it — the same URL updates for everyone.

## Costs

Firestore and Hosting on the free Spark plan comfortably cover a group like yours (thousands of reads/writes a day, free). You won't hit limits doing a few rounds of golf a week.
