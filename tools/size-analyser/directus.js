/**
 * directus.js — upload a file buffer to Directus /files
 */

const SERVER_URL = process.env.DIRECTUS_URL || 'https://directus.example.com';
const API_TOKEN  = process.env.DIRECTUS_TOKEN;
const FOLDER_ID  = process.env.DIRECTUS_FOLDER_ID;

/**
 * @param {Buffer} buffer   — file contents
 * @param {string} filename — e.g. "neon_viz_1234.webp"
 * @param {string} mimeType — e.g. "image/webp"
 * @returns {Promise<string>} public asset URL
 */
async function uploadToDirectus(buffer, filename, mimeType = 'image/webp') {
  const blob = new Blob([buffer], { type: mimeType });
  const form = new FormData();
  form.append('folder', FOLDER_ID);
  form.append('title',  filename);
  form.append('file',   blob, filename);

  const res = await fetch(`${SERVER_URL}/files`, {
    method:  'POST',
    headers: { 'Authorization': `Bearer ${API_TOKEN}` },
    body:    form,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Directus ${res.status}: ${text.slice(0, 200)}`);
  }

  const { data } = await res.json();
  if (!data?.id) throw new Error('No file ID in Directus response');
  return `${SERVER_URL}/assets/${data.id}`;
}

module.exports = { uploadToDirectus };
