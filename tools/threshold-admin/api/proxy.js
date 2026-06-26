/**
 * /api/proxy.js
 * Proxies images from the Directus host so the browser canvas can read pixels
 * (works around CORS restrictions on getImageData)
 */
const ALLOWED_ORIGIN = process.env.DIRECTUS_URL || 'https://directus.example.com';

export default async function handler(req, res) {
  const { url } = req.query;

  if (!url) return res.status(400).send('Missing url param');

  if (!url.startsWith(`${ALLOWED_ORIGIN}/`)) {
    return res.status(403).send(`Only ${ALLOWED_ORIGIN} is allowed`);
  }

  try {
    const upstream = await fetch(url);
    if (!upstream.ok) return res.status(upstream.status).send('Upstream error');

    const ct  = upstream.headers.get('content-type') || 'image/jpeg';
    const buf = await upstream.arrayBuffer();

    res.setHeader('Content-Type', ct);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.send(Buffer.from(buf));
  } catch (e) {
    res.status(500).send(e.message);
  }
}
