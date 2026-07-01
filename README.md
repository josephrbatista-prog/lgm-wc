# LGM WC Cup — deploy kit (start here)

This folder is the whole site. Putting it on Netlify makes the shared **Reactions** counter work.
Follow the steps in order. ~10 minutes. You do NOT need to understand any of it.

## What's in here (keep this exact structure)
```
deploy-kit/
├─ world-cup-pool.html      ← the dashboard
├─ netlify.toml             ← config (don't touch)
├─ package.json             ← config (don't touch)
└─ netlify/
   └─ functions/
      └─ reactions.mjs       ← the shared-reactions helper
```
(There's also `.github/workflows/deploy.yml` for optional auto-deploy, plus `DEPLOY.md` and
`HANDOFF.md` with more detail. Ignore them unless you want them.)

## Why not just drag-and-drop the HTML?
Because the reactions counter needs the little `reactions.mjs` helper to ride along and actually
run on Netlify. Drag-drop only takes the one file. Going through GitHub (below) takes the whole
folder, so the helper ships too. Everything else on the site works either way — only reactions
needs this.

---

## Do this in order

**Have two browser tabs open and logged in:** github.com and app.netlify.com

**1. Get these files into one folder on your computer** (keep the `netlify/functions/` sub-folders).

**2. Make a GitHub repo.**
github.com → click **+** (top-right) → **New repository** → name it `lgm-wc` → **Create repository**.

**3. Upload the files.**
On the new repo page click the **“uploading an existing file”** link → drag in the *contents* of
this folder, including the `netlify` folder → scroll down → **Commit changes**.
✅ Check: in the repo you can click `netlify` → `functions` → and see `reactions.mjs` inside.

**4. Connect Netlify to the repo.**
Netlify tab → your **lgm-wc** project → **Site configuration** → **Build & deploy** →
**Continuous deployment** → **Link repository** → **GitHub** → pick your `lgm-wc` repo →
leave build settings blank/default → **Deploy**. (Netlify reads `netlify.toml` and handles the rest.)

**5. Wait ~2 minutes, then test.**
Open **lgm-wc.netlify.app** → scroll to **Reactions**. The grey line under it should say
**“Live and shared,”** not “running locally on this device.” Tap a 👑, then open the site on your
phone — the count should already be there. Done.

---

## If it still says “running locally”
99% of the time the `netlify` folder didn't upload with its structure. In the GitHub repo, confirm
`netlify/functions/reactions.mjs` exists. If not, re-upload just that folder (Step 3).

## If reactions throw an error after deploy
Netlify dashboard → **Logs → Functions** → copy whatever it shows and send it to me. The function
is written correctly but I've never been able to test it against a live Netlify, so if anything's
off I'll fix it fast.

## Updating the site later
Just replace `world-cup-pool.html` in the GitHub repo (edit → upload new version → commit).
Netlify redeploys automatically in a minute or two.

---

## Live results (two free sources, no KickoffAPI)
The site gets results from, in order:
1. **football-data.org** — near-live (results within minutes of full time). Needs a free token.
2. **worldcup26.ir** — free, NO key at all. Works the moment this kit is deployed.
3. **openfootball** — daily fallback baked into the page.

So it's live out of the box via worldcup26.ir. To upgrade to football-data.org (more reliable,
explicit penalty-shootout winners):
1. Go to **football-data.org** → "Get your free API token" → enter your email → the token is emailed instantly.
2. Netlify → **Site configuration → Environment variables → Add a variable**:
   Key: `FOOTBALL_DATA_TOKEN`   Value: *(paste the token)*
3. **Deploys → Trigger deploy → Deploy site.**
4. Open the site — the header should say **"LIVE · football-data.org."** Without the token it says
   **"LIVE · worldcup26.ir."** Either way you're live.
The old `FOOTBALL_API_KEY` (KickoffAPI) is no longer used and can be deleted from Netlify.
Health checks: `/.netlify/functions/live?debug=1` (tests both sources) and `?scout=1` (reachability).

---

## The Book (group betting) — nothing extra to set up
The betting layer works the same way as Reactions: it stores everyone's bets in Netlify Blobs via
`netlify/functions/bets.mjs`. **No API key or env var needed.** It just requires the GitHub deploy
(so the functions run). Bets are play-money only and settle automatically from whatever results feed
the site is using. Until deployed (or if opened as a local file) it falls back to per-device storage.

---

## Admin tab (delete bets)
A small ⚙️ tab sits next to The Book. Anyone can see it, but it only works with the admin word:
1. Netlify → **Site configuration → Environment variables → Add a variable**:
   - Key: `BOOK_ADMIN_KEY`   Value: *(pick a secret word — this IS your admin word)*
2. **Deploys → Trigger deploy → Deploy site** (env vars apply on the next deploy).
3. Open the site → ⚙️ tab → enter your word. You can now delete any single bet (✕) or wipe the whole book.
Deletes are checked server-side on every action, apply instantly for everyone, and can't be done without the word. The word is remembered on your device; the Lock button forgets it.
