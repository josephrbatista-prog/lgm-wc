import { getStore } from '@netlify/blobs';

// Live World Cup results, tried in order:
//   A) football-data.org  (free tier incl. World Cup; set FOOTBALL_DATA_TOKEN in Netlify)
//   B) worldcup26.ir      (free, no key at all)
// The page itself falls back to openfootball (daily) if this function returns nothing.
//
// Modes:
//   /.netlify/functions/live           -> normalized results {ok, source, ts, matches}
//   /.netlify/functions/live?debug=1   -> shows config + raw probes of both sources
//   /.netlify/functions/live?scout=1   -> reachability scan of candidate APIs
//
// Normalized match shape: { t1,t2, g1,g2, p1,p2, w, status:'FT' }
//   t = pool nation names · g = goals (incl. extra time) · p = penalty score · w = explicit winner

const TTL_MS = 60 * 1000;

const MAP = {
  'Czech Republic':'Czechia','Czechia':'Czechia',
  'DR Congo':'Congo','Congo DR':'Congo','Democratic Republic of Congo':'Congo','Democratic Republic of the Congo':'Congo',
  'Bosnia and Herzegovina':'Bosnia','Bosnia & Herzegovina':'Bosnia','Bosnia-Herzegovina':'Bosnia',
  'Turkey':'Turkey','Türkiye':'Turkey','Turkiye':'Turkey',
  'South Korea':'South Korea','Korea Republic':'South Korea','Republic of Korea':'South Korea',
  'USA':'USA','United States':'USA','United States of America':'USA',
  'Ivory Coast':'Ivory Coast',"Cote d'Ivoire":'Ivory Coast',"Côte d'Ivoire":'Ivory Coast',
  'Cape Verde':'Cape Verde','Cabo Verde':'Cape Verde','Cape Verde Islands':'Cape Verde',
  'Curacao':'Curacao','Curaçao':'Curacao',
  'Saudi Arabia':'Saudi Arabia','New Zealand':'New Zealand',
  'Netherlands':'Netherlands','Holland':'Netherlands','Iran':'Iran','IR Iran':'Iran'
};
const norm = s => (s||'').toLowerCase().replace(/[^a-z]/g,'');
const NORM = {}; for (const [k,v] of Object.entries(MAP)) NORM[norm(k)] = v;
const toPool = name => !name ? name : (MAP[name] || NORM[norm(name)] || name);
const N = v => { const x = Number(v); return Number.isFinite(x) ? x : null; };

async function fromFootballData(token){
  const r = await fetch('https://api.football-data.org/v4/competitions/WC/matches',
    { headers: { 'X-Auth-Token': token } });
  if (!r.ok) throw new Error('football-data '+r.status);
  const j = await r.json();
  const matches = (j.matches||[]).filter(x=>x.status==='FINISHED').map(x=>{
    const t1=toPool(x.homeTeam&&x.homeTeam.name), t2=toPool(x.awayTeam&&x.awayTeam.name);
    const ft=(x.score&&x.score.fullTime)||{}; const pen=(x.score&&x.score.penalties)||null;
    let w=null;
    if (x.score&&x.score.winner==='HOME_TEAM') w=t1;
    else if (x.score&&x.score.winner==='AWAY_TEAM') w=t2;
    return { t1,t2, g1:N(ft.home), g2:N(ft.away),
      p1:pen?N(pen.home):null, p2:pen?N(pen.away):null, w, status:'FT' };
  }).filter(m=>m.t1&&m.t2&&m.g1!=null&&m.g2!=null);
  if (!matches.length) throw new Error('football-data: no finished matches');
  return { source:'football-data.org', matches };
}

async function fromWorldcup26(){
  const r = await fetch('https://worldcup26.ir/get/games');
  if (!r.ok) throw new Error('worldcup26 '+r.status);
  const j = await r.json();
  const games = j.games || j.data || (Array.isArray(j)?j:[]);
  const isFin = x => String(x.finished).toUpperCase() === 'TRUE';
  const matches = games.filter(isFin).map(g=>{
    const t1 = toPool(g.home_team_name_en), t2 = toPool(g.away_team_name_en);
    const g1 = N(g.home_score), g2 = N(g.away_score);
    const p1 = N(g.home_penalty_score), p2 = N(g.away_penalty_score);
    let w = null;
    if (p1!=null && p2!=null && p1!==p2) w = p1>p2 ? t1 : t2;   // shootout winner
    else if (g1!=null && g2!=null) { if (g1>g2) w=t1; else if (g2>g1) w=t2; }
    return { t1, t2, g1, g2, p1, p2, w, status:'FT' };
  }).filter(m => m.t1 && m.t2 && m.g1!=null && m.g2!=null);
  if (!matches.length) throw new Error('worldcup26: no finished matches');
  return { source:'worldcup26.ir', matches };
}

export default async (req) => {
  const store = getStore('lgm-live');
  const token = (process.env.FOOTBALL_DATA_TOKEN || '').trim();

  // ---- scout mode ----
  try {
    const u = new URL(req.url);
    if (u.searchParams.get('scout') === '1') {
      const probe = async (name, url, headers) => {
        try { const r = await fetch(url, { headers: headers||{} }); const text = await r.text();
          return { name, status:r.status, looksJson:/^[\[{]/.test(text.trim()),
            cloudflare:/Just a moment/i.test(text), excerpt:text.slice(0,220) }; }
        catch(e){ return { name, error:String(e) }; }
      };
      return Response.json({ ok:true, mode:'scout', results:[
        await probe('football-data.org (WC matches)','https://api.football-data.org/v4/competitions/WC/matches', token?{'X-Auth-Token':token}:{}),
        await probe('worldcup26.ir (games)','https://worldcup26.ir/get/games')
      ]});
    }
    // ---- debug mode ----
    if (u.searchParams.get('debug') === '1') {
      const out = { tokenPresent: !!token, tokenLength: token.length };
      try { const a = await fromFootballData(token||'none'); out.footballData = { ok:true, finished:a.matches.length, sample:a.matches[0] }; }
      catch(e){ out.footballData = { ok:false, error:String(e) }; }
      try { const b = await fromWorldcup26(); out.worldcup26 = { ok:true, finished:b.matches.length, sample:b.matches[0] }; }
      catch(e){ out.worldcup26 = { ok:false, error:String(e) }; }
      return Response.json({ ok:true, mode:'debug', ...out });
    }
  } catch (e) { /* fall through */ }

  // ---- normal path ----
  try {
    const cached = await store.get('cache', { type:'json' }).catch(()=>null);
    if (cached && (Date.now() - cached.ts) < TTL_MS)
      return Response.json({ ok:true, source:cached.source, cached:true, ts:cached.ts, matches:cached.matches });

    let result = null, errs = [];
    if (token) { try { result = await fromFootballData(token); } catch(e){ errs.push(String(e)); } }
    if (!result) { try { result = await fromWorldcup26(); } catch(e){ errs.push(String(e)); } }
    if (!result) {
      if (cached) return Response.json({ ok:true, source:cached.source, stale:true, ts:cached.ts, matches:cached.matches });
      return Response.json({ ok:false, error:errs.join(' | ') || 'no source available' });
    }
    const out = { ts:Date.now(), source:result.source, matches:result.matches };
    await store.setJSON('cache', out);
    return Response.json({ ok:true, ...out, count:result.matches.length });
  } catch (e) {
    return Response.json({ ok:false, error:String(e) });
  }
};
