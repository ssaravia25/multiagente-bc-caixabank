const BLOB_BASE = 'https://jsonblob.com/api/jsonBlob';
const BLOB_MAP = {
  g1:  '019dda6f-cabc-7675-9db0-b2e4ec5c5e16',
  g2:  '019dda6f-d704-76fc-9d6e-7de99a60396d',
  g3:  '019dda6f-e308-7ebc-a1ec-b42e3af8b51a',
  g4:  '019dda6f-f974-7026-b072-da02b1590a36',
  g5:  '019dda70-059e-748d-a168-241467f3de51',
  g6:  '019dda70-11a7-7e97-8925-8fdef12e232e',
  g7:  '019dda70-1def-755e-ab69-f502ab6a4521',
  g8:  '019dda70-2b57-762a-a45e-7b2f70555f56',
  g9:  '019dda70-3762-7642-b39a-32216bd10a93',
  g10: '019dda70-43f6-75a0-b941-d5362b2d32ba',
};

const EMPTY_GROUP = (slot) => ({
  slot,
  teamName: '',
  summary: '',
  problem: '',
  alternative: '',
  financials: { capex: 0, opex_y1: 0, investment_total: 0, revenues: [0,0,0,0,0], wacc: 10, van: 0, tir: 0, payback: 0 },
  risks: '',
  recommendation: '',
  vote: '',
  timestamp: 0,
});

async function readBlob(slot) {
  const id = BLOB_MAP[slot];
  if (!id) return EMPTY_GROUP(slot);
  // Retry hasta 3 veces (JSONBlob a veces es flaky)
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(`${BLOB_BASE}/${id}`, { headers: { Accept: 'application/json' } });
      if (r.ok) return await r.json();
      if (r.status === 404) return EMPTY_GROUP(slot);
    } catch { /* retry */ }
    if (i < 2) await new Promise(r => setTimeout(r, 300 * (i + 1)));
  }
  return EMPTY_GROUP(slot);
}

async function writeBlob(slot, data) {
  const id = BLOB_MAP[slot];
  if (!id) throw new Error(`Unknown slot: ${slot}`);
  let lastErr;
  // Retry hasta 3 veces con backoff exponencial
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(`${BLOB_BASE}/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(data),
      });
      if (r.ok) return await r.json();
      lastErr = new Error(`JSONBlob write failed: ${r.status}`);
    } catch (e) { lastErr = e; }
    if (i < 2) await new Promise(r => setTimeout(r, 400 * (i + 1)));
  }
  throw lastErr;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET') {
    const slots = Object.keys(BLOB_MAP);
    const groups = await Promise.all(slots.map(readBlob));
    return res.status(200).json({ groups, lastUpdated: Date.now(), class: 'BC-CaixaBank-2025' });
  }

  if (req.method === 'PUT') {
    const body = req.body;

    // Vote action
    if (body.action === 'vote') {
      const { slot, votedFor } = body;
      if (!BLOB_MAP[slot]) return res.status(400).json({ error: 'Invalid slot' });
      const current = await readBlob(slot);
      current.vote = votedFor;
      current.timestamp = Date.now();
      await writeBlob(slot, current);
      return res.status(200).json({ ok: true });
    }

    // Full reset (admin)
    if (body.action === 'reset') {
      const slots = Object.keys(BLOB_MAP);
      await Promise.all(slots.map(s => writeBlob(s, EMPTY_GROUP(s))));
      return res.status(200).json({ ok: true, message: 'All groups reset' });
    }

    // Normal group update
    const { slot, teamName, summary, problem, alternative, financials, risks, recommendation } = body;
    if (!slot || !BLOB_MAP[slot]) return res.status(400).json({ error: 'Invalid slot' });
    const data = { slot, teamName, summary, problem, alternative, financials, risks, recommendation, vote: '', timestamp: Date.now() };
    await writeBlob(slot, data);
    return res.status(200).json({ ok: true });
  }

  if (req.method === 'DELETE') {
    const { slot } = req.body;
    if (!slot || !BLOB_MAP[slot]) return res.status(400).json({ error: 'Invalid slot' });
    await writeBlob(slot, EMPTY_GROUP(slot));
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
