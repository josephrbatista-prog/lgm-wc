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

## OPTIONAL: live-to-the-minute results (KickoffAPI)
By default the site already auto-updates results daily from openfootball with **no key**. To upgrade to
near-instant results during matches, add a free KickoffAPI key. The site tries KickoffAPI first and
silently falls back to openfootball if the key isn't set — so this can't break anything.

Requires the **GitHub deploy** (functions only run on a real deploy, not a drag-drop).

1. **Get a free key:** go to **kickoffapi.com/signup.html**, sign up (no card), copy your API key.
2. **Add it to Netlify:** your `lgm-wc` project → **Site configuration → Environment variables → Add a variable**:
   - Key: `FOOTBALL_API_KEY`  Value: *(paste your key)*
   - (Optional) `WC_LEAGUE_ID` = `1`  — only change if step 4 shows the wrong competition.
3. **Redeploy:** Deploys tab → **Trigger deploy → Deploy site** (env vars apply on the next deploy).
4. **Check it:** open `lgm-wc.netlify.app`. Under the title it should say **"LIVE · to-the-minute via KickoffAPI."**
   - The page refreshes results about once a minute while it's open.
   - The key is never exposed — it lives only in the Netlify function, which caches results (max one
     upstream call per minute) to stay inside the free 100-requests/day tier.

### If it doesn't say "LIVE via KickoffAPI"
Visit **lgm-wc.netlify.app/.netlify/functions/live** directly — you'll see raw JSON:
- `"error":"FOOTBALL_API_KEY not set"` → the env var didn't apply; re-check step 2 and redeploy.
- `"error":"upstream 401/403"` → the key is wrong or not active yet.
- Team names look wrong / empty `matches` → paste me that JSON and I'll fix the name mapping or the
  league id. (I can't test the live API from my end, so this one-time check is where we confirm it.)

Either way, if anything's off it just keeps using openfootball, so the site stays working.

---

## The Book (group betting) — nothing extra to set up
The betting layer works the same way as Reactions: it stores everyone's bets in Netlify Blobs via
`netlify/functions/bets.mjs`. **No API key or env var needed.** It just requires the GitHub deploy
(so the functions run). Bets are play-money only and settle automatically from whatever results feed
the site is using. Until deployed (or if opened as a local file) it falls back to per-device storage.
