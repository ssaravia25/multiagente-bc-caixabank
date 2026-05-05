const BLOB_BASE = 'https://jsonblob.com/api/jsonBlob';
const BLOB_MAP = {
  g1:  '019df6c2-5811-7749-9112-e852f22cb267',
  g2:  '019df6c2-5bc1-7258-aa3b-75ec05a7caab',
  g3:  '019df6c2-5f54-72f8-a9d0-40dad88028d7',
  g4:  '019df6c2-6354-77ed-9423-f4d6bc23e26d',
  g5:  '019df6c2-6755-7a94-88d9-36a52b16280a',
  g6:  '019df6c2-6b65-7bb9-91f8-e8f174862a43',
  g7:  '019df6c2-6ef1-7470-816e-90cf01e0e2aa',
  g8:  '019df6c2-7292-7181-8626-fc8cc6fc484f',
  g9:  '019df6c2-7692-7dbe-ab06-6327eff21675',
  g10: '019df6c2-7a20-7693-b551-5e5bc5882fc4',
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
