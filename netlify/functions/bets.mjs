import { getStore } from '@netlify/blobs';

// Shared play-money bets + punter roster for the LGM WC Cup book.
// GET  -> { ok, bets:[...], roster:[...] }
// POST { join:true, punter }                     -> registers a punter name
// POST { punter,key,market,selection,odds,stake} -> appends a bet
// Settlement happens client-side from live results; this is append-only storage.

const MANAGERS = ['Harris','Ray','Jordan','Jake','Eric','Fink','Chris','Vinny'];

export default async (req) => {
  const store = getStore('lgm-bets');
  const KEY = 'all', RKEY = 'roster';
  const s = (v,n)=>String(v==null?'':v).slice(0,n);
  try {
    if (req.method === 'POST') {
      const b = await req.json();

      // Admin actions (verified against BOOK_ADMIN_KEY env var)
      if (b && b.admin === true) {
        const key = process.env.BOOK_ADMIN_KEY;
        if (!key) return Response.json({ ok:false, error:'BOOK_ADMIN_KEY not set in Netlify' }, { status:403 });
        if (b.adminKey !== key) return Response.json({ ok:false, error:'wrong admin key' }, { status:403 });
        let list = (await store.get(KEY, { type:'json' })) || [];
        if (b.action === 'delete' && b.id) { list = list.filter(x => x.id !== String(b.id)); await store.setJSON(KEY, list); }
        else if (b.action === 'wipe') { list = []; await store.setJSON(KEY, list); }
        else if (b.action !== 'ping') return Response.json({ ok:false, error:'bad admin action' }, { status:400 });
        const roster = (await store.get(RKEY, { type:'json' })) || [];
        return Response.json({ ok:true, bets:list, roster });
      }

      // Punter registration
      if (b && b.join === true) {
        const name = s(b.punter,24).trim();
        if (!name) return Response.json({ ok:false, error:'no name' }, { status:400 });
        const roster = (await store.get(RKEY, { type:'json' })) || [];
        if (!MANAGERS.includes(name) && !roster.includes(name)) {
          roster.push(name);
          if (roster.length > 50) roster.splice(0, roster.length - 50);
          await store.setJSON(RKEY, roster);
        }
        const list = (await store.get(KEY, { type:'json' })) || [];
        return Response.json({ ok:true, bets:list, roster });
      }

      // Bet placement
      if (!b || !b.punter || !b.key || !b.market || !b.selection || typeof b.stake !== 'number')
        return Response.json({ ok:false, error:'bad bet' }, { status:400 });
      const list = (await store.get(KEY, { type:'json' })) || [];
      list.push({
        id: b.id || ('b'+Date.now()),
        punter: s(b.punter,24), key: s(b.key,64),
        a: s(b.a,32), b: s(b.b,32), round: s(b.round,24),
        market: s(b.market,16), mlabel: s(b.mlabel,40),
        selection: s(b.selection,32), sellabel: s(b.sellabel,32),
        odds: Number(b.odds) || 1, stake: Math.max(1, Math.floor(b.stake)),
        ts: Date.now()
      });
      if (list.length > 2000) list.splice(0, list.length - 2000);
      await store.setJSON(KEY, list);
      // any better who isn't a manager lands on the roster too
      const roster = (await store.get(RKEY, { type:'json' })) || [];
      const nm = s(b.punter,24).trim();
      if (nm && !MANAGERS.includes(nm) && !roster.includes(nm)) { roster.push(nm); await store.setJSON(RKEY, roster); }
      return Response.json({ ok:true, bets:list, roster });
    }
    const list = (await store.get(KEY, { type:'json' })) || [];
    const roster = (await store.get(RKEY, { type:'json' })) || [];
    return Response.json({ ok:true, bets:list, roster });
  } catch (e) {
    return Response.json({ ok:false, error:String(e) }, { status:500 });
  }
};
