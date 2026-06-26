/**
 * /api/n8n-send.js
 * Forwards the request body to N8N_WEBHOOK_URL.
 * Accepts POST JSON: { group_id, sizes_json: { ... } }
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const url = process.env.N8N_WEBHOOK_URL
    || 'https://n8n.example.com/webhook/neon/save_sizes_json';

  try {
    const upstream = await fetch(url, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(req.body),
    });
    const text = await upstream.text();
    res.status(upstream.status).send(text);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
