import { getStore } from '@netlify/blobs';

// Shared play-money bets for the LGM WC Cup book.
// GET  -> { ok, bets:[...] }
// POST { punter,key,a,b,round,market,mlabel,selection,sellabel,odds,stake } -> appends, returns full list.
// Settlement happens client-side from the live results, so this is just append-only storage.
export default async (req) => {
  const store = getStore('lgm-bets');
  const KEY = 'all';
  try {
    if (req.method === 'POST') {
      const b = await req.json();
      if (!b || !b.punter || !b.key || !b.market || !b.selection || typeof b.stake !== 'number')
        return Response.json({ ok:false, error:'bad bet' }, { status:400 });
      const list = (await store.get(KEY, { type:'json' })) || [];
      const s = (v,n)=>String(v==null?'':v).slice(0,n);
      list.push({
        id: b.id || ('b'+Date.now()),
        punter: s(b.punter,24), key: s(b.key,64),
        a: s(b.a,32), b: s(b.b,32), round: s(b.round,24),
        market: s(b.market,16), mlabel: s(b.mlabel,40),
        selection: s(b.selection,32), sellabel: s(b.sellabel,32),
        odds: Number(b.odds) || 1, stake: Math.max(1, Math.floor(b.stake)),
        ts: Date.now()
      });
      // keep it bounded
      if (list.length > 2000) list.splice(0, list.length - 2000);
      await store.setJSON(KEY, list);
      return Response.json({ ok:true, bets:list });
    }
    const list = (await store.get(KEY, { type:'json' })) || [];
    return Response.json({ ok:true, bets:list });
  } catch (e) {
    return Response.json({ ok:false, error:String(e) }, { status:500 });
  }
};
