import { getStore } from '@netlify/blobs';

// Shared reaction tallies for the LGM WC Cup dashboard.
// GET  /.netlify/functions/reactions            -> { manager: { emoji: count } }
// POST /.netlify/functions/reactions  {manager,emoji,delta:+1|-1} -> updated tallies
export default async (req) => {
  const store = getStore('lgm-reactions');
  const KEY = 'tallies';
  try {
    if (req.method === 'POST') {
      const { manager, emoji, delta } = await req.json();
      if (!manager || !emoji) return Response.json({ error: 'bad request' }, { status: 400 });
      const data = (await store.get(KEY, { type: 'json' })) || {};
      data[manager] = data[manager] || {};
      const cur = data[manager][emoji] || 0;
      data[manager][emoji] = Math.max(0, cur + (delta === -1 ? -1 : 1));
      await store.setJSON(KEY, data);
      return Response.json(data);
    }
    const data = (await store.get(KEY, { type: 'json' })) || {};
    return Response.json(data);
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
};
