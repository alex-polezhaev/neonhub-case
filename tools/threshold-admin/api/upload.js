/**
 * /api/upload.js
 * Uploads a file to Directus.
 * Accepts POST JSON: { data: "<base64>", filename: string, type: string }
 * Returns: { id, url }
 *
 * Env vars: DIRECTUS_TOKEN, DIRECTUS_URL, DIRECTUS_FOLDER_ID
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const token    = process.env.DIRECTUS_TOKEN;
  const base     = process.env.DIRECTUS_URL    || 'https://directus.example.com';
  const folderId = process.env.DIRECTUS_FOLDER_ID;

  if (!token) return res.status(500).json({ error: 'DIRECTUS_TOKEN not configured' });

  const { data, filename = 'overlay.jpg', type = 'image/jpeg' } = req.body || {};
  if (!data) return res.status(400).json({ error: 'Missing data' });

  try {
    const buf  = Buffer.from(data, 'base64');
    const blob = new Blob([buf], { type });

    const form = new FormData();
    if (folderId) form.append('folder', folderId);
    form.append('title',  filename);
    form.append('file',   blob, filename);

    const upstream = await fetch(`${base}/files`, {
      method:  'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body:    form,
    });
    const json = await upstream.json();
    if (!upstream.ok) return res.status(upstream.status).json(json);

    const id = json.data?.id || json.id;
    res.json({ id, url: `${base}/assets/${id}` });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
