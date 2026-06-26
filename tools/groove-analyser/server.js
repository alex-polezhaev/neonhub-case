const express = require('express');
const multer = require('multer');
const path = require('path');
const { analyzeGrooves } = require('./lib/analyze');

const app = express();
const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'image/svg+xml' || path.extname(file.originalname) === '.svg') {
      cb(null, true);
    } else {
      cb(new Error('Only SVG files allowed'));
    }
  },
  limits: { fileSize: 20 * 1024 * 1024 },
});

app.use(express.static('public'));

app.post('/analyze', upload.single('svg'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const result = await analyzeGrooves(req.file.buffer);
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`http://localhost:${PORT}`));
