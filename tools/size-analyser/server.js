/**
 * server.js — Express web server for neon sign calculator
 * Usage: node server.js  →  open http://localhost:3000
 */

const express = require('express');
const multer  = require('multer');
const path    = require('path');
const { analyzeNeonImage, previewThreshold } = require('./analyzer');
const { uploadToDirectus } = require('./directus');

const app    = express();
const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 30 * 1024 * 1024 }, // 30 MB
  fileFilter: (req, file, cb) => {
    const ok = /image\/(jpeg|png|webp|gif|tiff)/.test(file.mimetype);
    cb(ok ? null : new Error('Only images allowed'), ok);
  },
});

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});
app.use(express.static(__dirname));
app.use(express.json({ limit: '50mb' }));

// Serve the main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ── POST /preview ─────────────────────────────────────────────────────────
app.post('/preview', upload.single('image'), async (req, res) => {
  if (!req.file) return res.status(400).json({ ok: false, error: 'No image' });
  try {
    const { threshAdjust = 0 } = req.body;
    const result = await previewThreshold(req.file.buffer, {
      threshAdjust: parseInt(threshAdjust, 10),
    });
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── POST /analyze ─────────────────────────────────────────────────────────
app.post('/analyze', upload.single('image'), async (req, res) => {
  if (!req.file) return res.status(400).json({ ok: false, error: 'No image uploaded' });

  try {
    const {
      tubeWidthMm     = 6,
      pricePerMeter   = 1500,
      markup          = 30,
      threshAdjust    = 0,
      pricePerM2Cover = 0,
      thicknessAdjust = 0,
    } = req.body;

    const result = await analyzeNeonImage(req.file.buffer, {
      tubeWidthMm:     parseFloat(tubeWidthMm),
      pricePerMeter:   parseFloat(pricePerMeter),
      markup:          parseFloat(markup),
      threshAdjust:    parseInt(threshAdjust, 10),
      pricePerM2Cover: parseFloat(pricePerM2Cover),
      thicknessAdjust: parseFloat(thicknessAdjust),
    });

    res.json({ ok: true, ...result });
  } catch (err) {
    console.error('Analysis error:', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── POST /analyze-url ─────────────────────────────────────────────────────────
// Accepts JSON body with imageUrl instead of file upload — for batch processing
app.post('/analyze-url', express.json(), async (req, res) => {
  const {
    imageUrl,
    tubeWidthMm       = 6,
    pricePerMeter     = 1390,
    markup            = 0,
    threshAdjust      = 0,
    absoluteThreshold = null,
    pricePerM2Cover   = 0,
    thicknessAdjust   = 0,
  } = req.body;

  if (!imageUrl) return res.status(400).json({ ok: false, error: 'imageUrl required' });

  try {
    const imgRes = await fetch(imageUrl);
    if (!imgRes.ok) throw new Error(`Image fetch failed: ${imgRes.status}`);
    const buffer = Buffer.from(await imgRes.arrayBuffer());
    const result = await analyzeNeonImage(buffer, {
      tubeWidthMm, pricePerMeter, markup, threshAdjust, absoluteThreshold, pricePerM2Cover, thicknessAdjust,
    });
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── POST /proxy/save-sizes ────────────────────────────────────────────────────
app.post('/proxy/save-sizes', express.json({ limit: '10mb' }), async (req, res) => {
  try {
    const r = await fetch(process.env.N8N_SAVE_SIZES_URL || 'https://n8n.example.com/webhook/neon/save_sizes_json', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(req.body),
    });
    const text = await r.text();
    res.status(r.status).send(text);
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── POST /upload-viz ──────────────────────────────────────────────────────────
app.post('/upload-viz', upload.single('image'), async (req, res) => {
  if (!req.file) return res.status(400).json({ ok: false, error: 'No image' });
  try {
    const filename = `neon_viz_${Date.now()}.webp`;
    const url = await uploadToDirectus(req.file.buffer, filename, req.file.mimetype || 'image/webp');
    res.json({ ok: true, url });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 2999;
app.listen(PORT, () => {
  console.log(`\n🟡 Neon Calculator running at http://localhost:${PORT}\n`);
});
