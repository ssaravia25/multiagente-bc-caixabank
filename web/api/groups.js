const BLOB_BASE = 'https://jsonblob.com/api/jsonBlob';
const BLOB_MAP = {
  g1:  '019dd3a0-7817-7d06-98f6-147e3fda1184',
  g2:  '019dd3a0-7bdc-7e39-be34-819dbfaaf0b0',
  g3:  '019dd3a0-7f71-7178-9770-50d637b65f37',
  g4:  '019dd3a0-8302-780d-9efd-68fdf74b3e61',
  g5:  '019dd3a0-8692-7c33-89f4-4d020f355f21',
  g6:  '019dd3a0-8a0e-742f-a5ff-1d77bcbfe524',
  g7:  '019dd3a0-8dcd-73dd-a52d-c7987eb6092b',
  g8:  '019dd3a0-931a-7565-94df-f87f707221f8',
  g9:  '019dd3a0-96a2-76f5-8042-efb6c99bb846',
  g10: '019dd3a0-9a1e-79cd-b39b-9a07dd95ecb1',
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
  try {
    const r = await fetch(`${BLOB_BASE}/${id}`, { headers: { Accept: 'application/json' } });
    if (!r.ok) return EMPTY_GROUP(slot);
    return await r.json();
  } catch { return EMPTY_GROUP(slot); }
}

async function writeBlob(slot, data) {
  const id = BLOB_MAP[slot];
  if (!id) throw new Error(`Unknown slot: ${slot}`);
  const r = await fetch(`${BLOB_BASE}/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(data),
  });
  if (!r.ok) throw new Error(`JSONBlob write failed: ${r.status}`);
  return r.json();
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
