import { getStore } from '@netlify/blobs';

// Live World Cup results via KickoffAPI (https://docs.kickoffapi.com).
// Proxied so the API key stays server-side, and cached in Netlify Blobs so we
// stay inside the free 100-requests/day tier. Uses the plain fixtures endpoint
// (free) rather than live=all (which needs a paid plan) — final results still
// land within a poll of full time.
//
// Netlify env vars (Site configuration -> Environment variables):
//   FOOTBALL_API_KEY = <your KickoffAPI key>
//   WC_LEAGUE_ID     = 1   (optional; World Cup league id. If results come back
//                           empty, the debug block below tells us the right one.)

const TTL_MS = 60 * 1000;

const apiHeaders = (key) => ({
  'x-api-key': key,
  'Accept': 'application/json',
  'Accept-Language': 'en-GB,en;q=0.9',
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
});

// KickoffAPI team name -> pool nation name (extend once we see real names in debug)
const MAP = {
  'Czech Republic':'Czechia','Czechia':'Czechia',
  'DR Congo':'Congo','Congo DR':'Congo','Congo':'Congo','Democratic Republic of Congo':'Congo',
  'Bosnia and Herzegovina':'Bosnia','Bosnia & Herzegovina':'Bosnia','Bosnia-Herzegovina':'Bosnia',
  'Turkey':'Turkey','Türkiye':'Turkey','Turkiye':'Turkey',
  'South Korea':'South Korea','Korea Republic':'South Korea',
  'USA':'USA','United States':'USA','United States of America':'USA',
  'Ivory Coast':'Ivory Coast',"Cote d'Ivoire":'Ivory Coast',"Côte d'Ivoire":'Ivory Coast',
  'Cape Verde':'Cape Verde','Cabo Verde':'Cape Verde','Cape Verde Islands':'Cape Verde',
  'Curacao':'Curacao','Curaçao':'Curacao',
  'Saudi Arabia':'Saudi Arabia','New Zealand':'New Zealand'
};
const norm = s => (s||'').toLowerCase().replace(/[^a-z]/g,'');
const NORM = {}; for (const [k,v] of Object.entries(MAP)) NORM[norm(k)] = v;
const toPool = name => !name ? name : (MAP[name] || NORM[norm(name)] || name);

export default async (req) => {
  const store = getStore('lgm-live');

  // Scout mode: /.netlify/functions/live?scout=1
  // Probes candidate football APIs FROM NETLIFY to see which are reachable
  // (JSON = usable; Cloudflare "Just a moment" HTML = blocked, like KickoffAPI was).
  try {
    const u0 = new URL(req.url);
    if (u0.searchParams.get('scout') === '1') {
      const probe = async (name, url, headers) => {
        try {
          const r = await fetch(url, { headers: headers || {} });
          const text = (await r.text());
          const looksJson = text.trim().startsWith('{') || text.trim().startsWith('[');
          const cloudflare = /Just a moment/i.test(text);
          return { name, status: r.status, looksJson, cloudflare, excerpt: text.slice(0, 220) };
        } catch (e) { return { name, error: String(e) }; }
      };
      const fdToken = (process.env.FOOTBALL_DATA_TOKEN || '').trim();
      const results = [];
      results.push(await probe('football-data.org (WC matches)',
        'https://api.football-data.org/v4/competitions/WC/matches',
        fdToken ? { 'X-Auth-Token': fdToken } : {}));
      results.push(await probe('api-football free (status)',
        'https://v3.football.api-sports.io/status',
        { 'x-apisports-key': (process.env.APIFOOTBALL_KEY || 'none').trim() }));
      results.push(await probe('worldcup26.ir (games)',
        'https://worldcup26.ir/get/games'));
      return Response.json({ ok:true, mode:'scout',
        note:'looksJson:true means Netlify can reach it. status 400/401/403 WITH JSON still means reachable (just needs a key). cloudflare:true means blocked like KickoffAPI.',
        results });
    }
  } catch (e) { /* fall through */ }

  // Diagnostic mode: /.netlify/functions/live?debug=1
  // Shows what key the function holds (masked) and probes KickoffAPI directly.
  try {
    const u = new URL(req.url);
    if (u.searchParams.get('debug') === '1') {
      const raw = process.env.FOOTBALL_API_KEY || '';
      const key = raw.trim();
      const info = {
        keyPresent: !!raw,
        keyPrefix: key.slice(0, 10),
        keyLength: key.length,
        rawHadWhitespace: raw !== key,
        leagueId: process.env.WC_LEAGUE_ID || '1'
      };
      const probe = async (path) => {
        try { const r = await fetch('https://api.kickoffapi.com' + path, { headers: apiHeaders(key) });
          return { status: r.status, body: (await r.text()).slice(0, 400) }; }
        catch (e) { return { error: String(e) }; }
      };
      const account  = await probe('/api/v1/account/status');
      const fixtures = await probe(`/api/v1/fixtures?league=${info.leagueId}&season=2026`);
      const leagues  = await probe('/api/v1/leagues?type=Cup&current=true');
      return Response.json({ ok:true, mode:'debug', info, account, fixtures, leagues });
    }
  } catch (e) { /* fall through to normal path */ }

  try {
    const cached = await store.get('cache', { type:'json' }).catch(()=>null);
    if (cached && (Date.now() - cached.ts) < TTL_MS)
      return Response.json({ ok:true, source:'KickoffAPI', cached:true, ts:cached.ts, matches:cached.matches });

    const key = (process.env.FOOTBALL_API_KEY || '').trim();
    if (!key) return Response.json({ ok:false, error:'FOOTBALL_API_KEY not set' });

    const league = process.env.WC_LEAGUE_ID || '1';
    const url = `https://api.kickoffapi.com/api/v1/fixtures?league=${encodeURIComponent(league)}&season=2026`;
    const r = await fetch(url, { headers: apiHeaders(key) });
    if (!r.ok) {
      if (cached) return Response.json({ ok:true, source:'KickoffAPI', stale:true, ts:cached.ts, matches:cached.matches });
      return Response.json({ ok:false, error:`upstream ${r.status}` });
    }
    const j = await r.json();
    const items = j.response || [];

    const rawTeams = new Set();
    const matches = items.map(x => {
      const hn = x.homeTeam?.name ?? x.teams?.home?.name;
      const an = x.awayTeam?.name ?? x.teams?.away?.name;
      if (hn) rawTeams.add(hn); if (an) rawTeams.add(an);
      return {
        t1: toPool(hn), t2: toPool(an),
        g1: x.homeTeam?.goals ?? x.goals?.home ?? null,
        g2: x.awayTeam?.goals ?? x.goals?.away ?? null,
        // penalty score — exact field unconfirmed; check the likely spots
        p1: x.homeTeam?.penalties ?? x.penalty?.home ?? x.score?.penalty?.home ?? null,
        p2: x.awayTeam?.penalties ?? x.penalty?.away ?? x.score?.penalty?.away ?? null,
        status: x.statusShort ?? x.status ?? null
      };
    }).filter(m => m.t1 && m.t2);

    const out = { ts: Date.now(), matches };
    await store.setJSON('cache', out);
    return Response.json({
      ok:true, source:'KickoffAPI', ts:out.ts, count:matches.length, matches,
      debug: { fixtures_returned: items.length, teams: [...rawTeams].sort() }
    });
  } catch (e) {
    return Response.json({ ok:false, error:String(e) });
  }
};
