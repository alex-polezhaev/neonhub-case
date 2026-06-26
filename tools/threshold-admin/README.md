# Neon Threshold Admin

A small admin tool to tune the **per-product brightness threshold** used to extract a clean
neon mask from each product photo. Pick a product, adjust the Multi-Otsu threshold live
(with an eraser brush to wipe stray bright spots), then save the chosen threshold back to
the automation backend. Static HTML + vanilla JS front-end with Vercel serverless functions.

## How it works
- **`threshold-browser.js`** runs the same Multi-Otsu + "lake" removal logic as the
  server-side analyser, but entirely in the browser on a `<canvas>`, so the mask preview
  updates instantly as you drag the threshold slider.
- **`index.html`** is the UI: a product list (grouped by `group_id`), a live mask overlay in
  a chosen colour, zoom controls, an **eraser brush** to remove false-positive bright
  regions, and a Save button that posts the final threshold.
- **`api/` (Vercel serverless functions):**
  - `proxy.js`: same-origin image proxy so the canvas can read pixels from the Directus
    host without CORS errors (allow-listed to `DIRECTUS_URL`).
  - `upload.js`: uploads the flattened overlay image to Directus (`/files`).
  - `n8n-send.js`: forwards the saved threshold / sizes JSON to an n8n webhook.

## Configuration
Everything is **environment-based**. See `.env.example`. No secrets are hardcoded. The
client constants in `index.html` (`API_URL`, `HUB_ORIGIN`) point at placeholder
`*.example.com` hosts; replace them (and set the serverless env vars) with your own
endpoints before deploying.

## Run
```bash
cp .env.example .env
vercel dev       # serves index.html + the api/ functions locally
```
