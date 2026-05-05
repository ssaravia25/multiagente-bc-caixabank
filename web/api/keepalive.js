// Cron diario: toca los 10 JSONBlobs para evitar que sean purgados por inactividad.
// JSONBlob borra blobs sin acceso reciente. Este endpoint se ejecuta cada día a las 6:00 UTC.

const BLOB_BASE = 'https://jsonblob.com/api/jsonBlob';
const BLOB_IDS = [
  '019df6c2-5811-7749-9112-e852f22cb267',
  '019df6c2-5bc1-7258-aa3b-75ec05a7caab',
  '019df6c2-5f54-72f8-a9d0-40dad88028d7',
  '019df6c2-6354-77ed-9423-f4d6bc23e26d',
  '019df6c2-6755-7a94-88d9-36a52b16280a',
  '019df6c2-6b65-7bb9-91f8-e8f174862a43',
  '019df6c2-6ef1-7470-816e-90cf01e0e2aa',
  '019df6c2-7292-7181-8626-fc8cc6fc484f',
  '019df6c2-7692-7dbe-ab06-6327eff21675',
  '019df6c2-7a20-7693-b551-5e5bc5882fc4',
];

export default async function handler(req, res) {
  const results = await Promise.allSettled(
    BLOB_IDS.map(id =>
      fetch(`${BLOB_BASE}/${id}`, { headers: { Accept: 'application/json' } })
        .then(r => ({ id, status: r.status }))
    )
  );
  const ok    = results.filter(r => r.status === 'fulfilled' && r.value.status === 200).length;
  const dead  = results.filter(r => r.status === 'fulfilled' && r.value.status === 404).length;
  const errs  = results.filter(r => r.status === 'rejected').length;

  res.status(200).json({
    timestamp: new Date().toISOString(),
    total: BLOB_IDS.length, ok, dead, errs,
  });
}
