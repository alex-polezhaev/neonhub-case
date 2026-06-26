/**
 * analyzer.js — Neon sign image analysis
 *
 * Pipeline:
 *  1. Load + resize (max 1000px)
 *  2. Grayscale + histogram
 *  3. Otsu threshold  →  binary bright/dark
 *  4. Morphological opening (erode→dilate)  →  remove glow noise
 *  5. Zhang-Suen skeletonization  →  1px centerline
 *  6. Scale: avgWidthPx = brightPixels / skeletonPixels
 *            mmPerPx    = tubeWidthMm  / avgWidthPx
 *            lengthMm   = skeletonPixels × mmPerPx
 *  7. Render visualization PNG
 */

const sharp = require('sharp');

const MAX_DIM = 1000;
const VIZ_OUTPUT_SIZE = 1000;
const VIZ_OUTPUT_PADDING = 48;

// ─── Threshold methods ───────────────────────────────────────────────────────

// Multi-Otsu (2 thresholds → 3 classes: bg / glow / core)
// Returns the HIGHER threshold — isolates the bright neon core only.
function multiOtsuHighThreshold(hist, total) {
  let sum = 0;
  for (let i = 0; i < 256; i++) sum += i * hist[i];

  // Precompute prefix sums for speed
  const W  = new Float64Array(257); // cumulative weight
  const S  = new Float64Array(257); // cumulative sum of i·hist[i]
  for (let i = 0; i < 256; i++) {
    W[i + 1] = W[i] + hist[i];
    S[i + 1] = S[i] + i * hist[i];
  }
  const mean = (a, b) => W[b] > W[a] ? (S[b] - S[a]) / (W[b] - W[a]) : 0;

  let best = -Infinity, t1best = 0, t2best = 128;
  for (let t1 = 1; t1 < 254; t1++) {
    for (let t2 = t1 + 1; t2 < 255; t2++) {
      const w0 = W[t1], w1 = W[t2] - W[t1], w2 = W[256] - W[t2];
      if (!w0 || !w1 || !w2) continue;
      const m0 = mean(0, t1), m1 = mean(t1, t2), m2 = mean(t2, 256);
      const mT = S[256] / W[256];
      const sigma = w0*(m0-mT)**2 + w1*(m1-mT)**2 + w2*(m2-mT)**2;
      if (sigma > best) { best = sigma; t1best = t1; t2best = t2; }
    }
  }
  return t2best; // upper threshold → bright core only
}

// ─── Morphological ops (3×3 structuring element) ───────────────────────────
function erode(bin, W, H) {
  const out = new Uint8Array(W * H);
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      if (
        bin[(y-1)*W+x-1] && bin[(y-1)*W+x] && bin[(y-1)*W+x+1] &&
        bin[ y  *W+x-1] && bin[ y  *W+x] && bin[ y  *W+x+1] &&
        bin[(y+1)*W+x-1] && bin[(y+1)*W+x] && bin[(y+1)*W+x+1]
      ) out[y*W+x] = 1;
    }
  }
  return out;
}

function dilate(bin, W, H) {
  const out = new Uint8Array(W * H);
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      if (
        bin[(y-1)*W+x-1] || bin[(y-1)*W+x] || bin[(y-1)*W+x+1] ||
        bin[ y  *W+x-1] || bin[ y  *W+x] || bin[ y  *W+x+1] ||
        bin[(y+1)*W+x-1] || bin[(y+1)*W+x] || bin[(y+1)*W+x+1]
      ) out[y*W+x] = 1;
    }
  }
  return out;
}

// Cross (4-connected) erode/dilate — gentler ½-step operation
function erode4(bin, W, H) {
  const out = new Uint8Array(W * H);
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      if (bin[y*W+x] && bin[(y-1)*W+x] && bin[(y+1)*W+x] &&
          bin[y*W+x-1] && bin[y*W+x+1]) out[y*W+x] = 1;
    }
  }
  return out;
}

function dilate4(bin, W, H) {
  const out = new Uint8Array(W * H);
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      if (bin[y*W+x] || bin[(y-1)*W+x] || bin[(y+1)*W+x] ||
          bin[y*W+x-1] || bin[y*W+x+1]) out[y*W+x] = 1;
    }
  }
  return out;
}

function adaptiveMorphIter(W, H) {
  return Math.min(2, Math.max(1, Math.round(Math.min(W, H) / 500)));
}

// Removes "lakes" — connected components whose thickness (2*area/perimeter)
// exceeds 3x the median thickness of the remaining lines.
function removeBlobs(mask, W, H) {
  const labels = new Int32Array(W * H).fill(-1);
  const areas  = [];
  const perims = [];
  const stack  = [];

  for (let start = 0; start < W * H; start++) {
    if (!mask[start] || labels[start] !== -1) continue;
    const label = areas.length;
    areas.push(0); perims.push(0);
    labels[start] = label;
    stack.push(start);
    while (stack.length > 0) {
      const idx = stack.pop();
      areas[label]++;
      const x = idx % W, y = (idx / W) | 0;
      let boundary = false;
      if (x > 0)   { const ni = idx-1; if (!mask[ni]) boundary=true; else if (labels[ni]===-1) { labels[ni]=label; stack.push(ni); } }
      else boundary = true;
      if (x < W-1) { const ni = idx+1; if (!mask[ni]) boundary=true; else if (labels[ni]===-1) { labels[ni]=label; stack.push(ni); } }
      else boundary = true;
      if (y > 0)   { const ni = idx-W; if (!mask[ni]) boundary=true; else if (labels[ni]===-1) { labels[ni]=label; stack.push(ni); } }
      else boundary = true;
      if (y < H-1) { const ni = idx+W; if (!mask[ni]) boundary=true; else if (labels[ni]===-1) { labels[ni]=label; stack.push(ni); } }
      else boundary = true;
      if (boundary) perims[label]++;
    }
  }

  const thick   = areas.map((a, i) => perims[i] > 0 ? 2 * a / perims[i] : 0);
  // minArea: components smaller than this threshold are noise artifacts, removed immediately
  const minArea = Math.max(10, Math.round((W * H) / 4000));
  const valid   = thick.filter((_, i) => areas[i] >= minArea).sort((a, b) => a - b);
  if (valid.length === 0) return mask;
  const median = valid[Math.floor(valid.length / 2)];
  const limit  = 3 * median;

  const out = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) {
    // Remove: too small (artifacts) or too thick (lakes)
    if (mask[i] && areas[labels[i]] >= minArea && thick[labels[i]] <= limit) out[i] = 1;
  }
  return out;
}

// Opening = N×erode then N×dilate (removes glow halo, preserves tube core)
function morphOpen(bin, W, H, iterations = 2) {
  let result = bin;
  for (let i = 0; i < iterations; i++) result = erode(result, W, H);
  for (let i = 0; i < iterations; i++) result = dilate(result, W, H);
  return result;
}

// Fill interior holes: BFS from border through background pixels.
// Any background pixel not reachable from the border is inside → fill it.
function fillHoles(mask, W, H) {
  const outside = new Uint8Array(W * H);
  const queue   = [];

  const enqueue = (i) => { if (!mask[i] && !outside[i]) { outside[i] = 1; queue.push(i); } };

  for (let x = 0; x < W; x++) { enqueue(x); enqueue((H - 1) * W + x); }
  for (let y = 1; y < H - 1; y++) { enqueue(y * W); enqueue(y * W + W - 1); }

  let head = 0;
  while (head < queue.length) {
    const idx = queue[head++];
    const x = idx % W, y = (idx / W) | 0;
    if (x > 0)     enqueue(idx - 1);
    if (x < W - 1) enqueue(idx + 1);
    if (y > 0)     enqueue(idx - W);
    if (y < H - 1) enqueue(idx + W);
  }

  // Anything background but NOT outside → it's a hole → fill
  const filled = new Uint8Array(mask);
  for (let i = 0; i < W * H; i++) if (!filled[i] && !outside[i]) filled[i] = 1;
  return filled;
}

// ─── Zhang-Suen thinning (skeletonization) ──────────────────────────────────
// Neighbors in order: N, NE, E, SE, S, SW, W, NW
function neighbors8(img, x, y, W) {
  return [
    img[(y-1)*W + x    ],  // P2  N
    img[(y-1)*W + x + 1],  // P3  NE
    img[ y   *W + x + 1],  // P4  E
    img[(y+1)*W + x + 1],  // P5  SE
    img[(y+1)*W + x    ],  // P6  S
    img[(y+1)*W + x - 1],  // P7  SW
    img[ y   *W + x - 1],  // P8  W
    img[(y-1)*W + x - 1],  // P9  NW
  ];
}

// Count 0→1 transitions in the cyclic sequence
function countTransitions(n) {
  let c = 0;
  for (let i = 0; i < 7; i++) if (n[i] === 0 && n[i+1] === 1) c++;
  if (n[7] === 0 && n[0] === 1) c++;
  return c;
}

function zhangSuen(binary, W, H) {
  const img = new Uint8Array(binary);
  let changed = true;

  while (changed) {
    changed = false;

    for (let step = 0; step < 2; step++) {
      const toRemove = [];

      for (let y = 1; y < H - 1; y++) {
        for (let x = 1; x < W - 1; x++) {
          if (!img[y * W + x]) continue;

          const n = neighbors8(img, x, y, W);
          const B = n[0]+n[1]+n[2]+n[3]+n[4]+n[5]+n[6]+n[7]; // neighbour count

          // Conditions common to both steps:
          if (B < 2 || B > 6) continue;          // not isolated or end-point
          if (countTransitions(n) !== 1) continue; // exactly one 0→1 transition

          if (step === 0) {
            if (n[0] * n[2] * n[4] !== 0) continue; // P2·P4·P6 = 0
            if (n[2] * n[4] * n[6] !== 0) continue; // P4·P6·P8 = 0
          } else {
            if (n[0] * n[2] * n[6] !== 0) continue; // P2·P4·P8 = 0
            if (n[0] * n[4] * n[6] !== 0) continue; // P2·P6·P8 = 0
          }

          toRemove.push(y * W + x);
        }
      }

      if (toRemove.length) {
        for (const idx of toRemove) img[idx] = 0;
        changed = true;
      }
    }
  }

  return img;
}

// ─── Visualization (lightweight schema: white bg + black lines) ──────────────
function buildVizBuffer(opened, skel, W, H) {
  // White background
  const out = Buffer.alloc(W * H * 4, 255); // all 255 = white opaque

  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      const i = y * W + x;

      // Neon tube region — solid black fill
      if (opened[i]) {
        out[i*4]=30; out[i*4+1]=30; out[i*4+2]=30; out[i*4+3]=255;
      }

      // Skeleton centerline in red on top
      if (skel[i]) {
        out[i*4]=200; out[i*4+1]=30; out[i*4+2]=30; out[i*4+3]=255;
      }
    }
  }

  return out;
}

// ─── Main export ─────────────────────────────────────────────────────────────
async function analyzeNeonImage(inputBuffer, options = {}) {
  const {
    tubeWidthMm       = 6,
    pricePerMeter     = 1500,
    markup            = 30,
    threshAdjust      = 0,      // ±offset applied after multi-otsu auto threshold
    absoluteThreshold = null,   // if set, skip multi-otsu and use this value directly
    pricePerM2Cover   = 0,
    thicknessAdjust   = 0,
  } = options;

  // 1. Load image at full resolution
  const meta = await sharp(inputBuffer).metadata();
  const W = meta.width, H = meta.height;
  const { data } = await sharp(inputBuffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });

  // 2. Luminance + histogram
  const lum  = new Uint8Array(W * H);
  const hist = new Int32Array(256);
  for (let i = 0; i < W * H; i++) {
    const v = Math.round(0.299 * data[i*4] + 0.587 * data[i*4+1] + 0.114 * data[i*4+2]);
    lum[i] = v;
    hist[v]++;
  }

  // 3. Threshold — Multi-Otsu + optional ±offset, or absolute value
  let autoThresh = multiOtsuHighThreshold(hist, W * H);
  let thresh;
  if (absoluteThreshold !== null && absoluteThreshold !== undefined) {
    thresh = Math.max(0, Math.min(255, Math.round(absoluteThreshold)));
  } else {
    thresh = Math.max(0, Math.min(255, autoThresh + parseInt(threshAdjust, 10)));
  }

  const bin = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) bin[i] = lum[i] > thresh ? 1 : 0;

  // 5. Morphological opening → remove glow halo noise (adaptive to image resolution)
  let opened = morphOpen(bin, W, H, adaptiveMorphIter(W, H));
  opened = removeBlobs(opened, W, H);

  // 5b. Optional thickness adjustment — supports 0.5-step precision
  //     Integer part → full 3×3 square erode/dilate
  //     0.5 fraction  → gentler cross-shaped (4-connected) erode/dilate
  const adjAbs   = Math.abs(thicknessAdjust);
  const fullSteps = Math.min(Math.floor(adjAbs), 10);
  const hasHalf   = (Math.round(adjAbs * 2) % 2) === 1;
  if (thicknessAdjust < 0) {
    for (let i = 0; i < fullSteps; i++) opened = erode(opened, W, H);
    if (hasHalf) opened = erode4(opened, W, H);
  } else if (thicknessAdjust > 0) {
    for (let i = 0; i < fullSteps; i++) opened = dilate(opened, W, H);
    if (hasHalf) opened = dilate4(opened, W, H);
  }

  let brightPixels = 0;
  for (let i = 0; i < W * H; i++) if (opened[i]) brightPixels++;

  // 6. Skeletonize
  const skel = zhangSuen(new Uint8Array(opened), W, H);
  let skelPixels = 0;
  for (let i = 0; i < W * H; i++) if (skel[i]) skelPixels++;

  if (skelPixels < 20) {
    throw new Error(
      `Too few bright lines found (${skelPixels} px). ` +
      `Try adjusting the threshold correction (current: ${thresh}).`
    );
  }

  // 7. Scale calculation
  //    Area of bright region ≈ avgWidth × skeletonLength
  //    → avgWidthPx = brightPixels / skelPixels
  //    → mmPerPx    = tubeWidthMm  / avgWidthPx
  //    → lengthMm   = skelPixels   × mmPerPx
  const avgWidthPx = brightPixels / skelPixels;
  const mmPerPx    = tubeWidthMm  / avgWidthPx;
  const lengthMm   = skelPixels   * mmPerPx;
  const lengthCm   = lengthMm / 10;
  const lengthM    = lengthMm / 1000;

  // 8. Bounding box of bright region → sign dimensions
  let minX = W, maxX = 0, minY = H, maxY = 0;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (opened[y * W + x]) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  const signWidthMm  = (maxX - minX + 1) * mmPerPx;
  const signHeightMm = (maxY - minY + 1) * mmPerPx;
  const signWidthCm  = Math.round(signWidthMm) / 10;
  const signHeightCm = Math.round(signHeightMm) / 10;

  // 9. Auto cover margin: 5% of the smaller sign dimension, clamped 10–100 mm
  const coverMarginMm = Math.round(
    Math.max(10, Math.min(100, Math.min(signWidthMm, signHeightMm) * 0.04))
  );

  const marginPx = Math.max(1, Math.min(Math.round(coverMarginMm / mmPerPx), 120));
  const need = marginPx + 4;                         // extra 4px breathing room
  const padL = Math.max(0, need - minX);
  const padR = Math.max(0, need - (W - 1 - maxX));
  const padT = Math.max(0, need - minY);
  const padB = Math.max(0, need - (H - 1 - maxY));

  // Build (possibly padded) working canvas
  const vW = W + padL + padR;
  const vH = H + padT + padB;

  const vOpened = new Uint8Array(vW * vH);           // black border = 0 → dilation won't clip
  const vSkel   = new Uint8Array(vW * vH);
  const vData   = Buffer.alloc(vW * vH * 4, 0);     // RGBA, black padding

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const vi = (y + padT) * vW + (x + padL);
      vOpened[vi] = opened[y * W + x];
      vSkel[vi]   = skel[y * W + x];
      const si = (y * W + x) * 4, di = vi * 4;
      vData[di] = data[si]; vData[di+1] = data[si+1];
      vData[di+2] = data[si+2]; vData[di+3] = data[si+3];
    }
  }

  // Adjusted bounding box in padded coords
  const vMinX = minX + padL, vMaxX = maxX + padL;
  const vMinY = minY + padT, vMaxY = maxY + padT;

  // Cover mask: dilate on padded canvas, then fill enclosed holes (O, D, B…)
  let coverMask = new Uint8Array(vOpened);
  for (let i = 0; i < marginPx; i++) coverMask = dilate(coverMask, vW, vH);
  coverMask = fillHoles(coverMask, vW, vH);

  let coverPixels = 0;
  for (let i = 0; i < vW * vH; i++) if (coverMask[i]) coverPixels++;

  // px² → mm² → m²
  const coverAreaM2 = coverPixels * (mmPerPx * mmPerPx) / 1_000_000;
  const coverPrice  = coverAreaM2 * pricePerM2Cover;

  // 10. Power consumption: 8 W per meter
  const wattsPerMeter = 8;
  const powerW  = lengthM * wattsPerMeter;
  const powerKW = powerW / 1000;

  // 11. Cost
  const tubePrice  = lengthM * pricePerMeter;
  const subtotal   = tubePrice + coverPrice;
  const totalPrice = subtotal * (1 + markup / 100);

  // 12. Visualization on padded canvas
  const vizRaw = buildVizBuffer(vOpened, vSkel, vW, vH);

  // — Cover contour in teal
  for (let y = 1; y < vH - 1; y++) {
    for (let x = 1; x < vW - 1; x++) {
      if (!coverMask[y * vW + x]) continue;
      const isBorder =
        !coverMask[(y-1)*vW + x] || !coverMask[(y+1)*vW + x] ||
        !coverMask[y*vW + x - 1] || !coverMask[y*vW + x + 1];
      if (isBorder) {
        const i = (y * vW + x) * 4;
        vizRaw[i] = 0; vizRaw[i+1] = 140; vizRaw[i+2] = 130; vizRaw[i+3] = 255;
      }
    }
  }

  // — Dimension lines in padded coords
  function setPixel(buf, x, y, rgba) {
    if (x < 0 || x >= vW || y < 0 || y >= vH) return;
    const i = (y * vW + x) * 4;
    buf[i] = rgba[0]; buf[i+1] = rgba[1]; buf[i+2] = rgba[2]; buf[i+3] = rgba[3];
  }

  const dimColor   = [60,  60,  60,  255];
  const arrowColor = [30,  30,  30,  255];

  // Horizontal dim line — width (3px thick)
  const hLineY = Math.max(8, vMinY - 20);
  for (let t = -1; t <= 1; t++) {
    for (let x = vMinX; x <= vMaxX; x++) {
      if ((x - vMinX) % 6 < 4) setPixel(vizRaw, x, hLineY + t, dimColor);
    }
  }
  for (let dy = -6; dy <= 6; dy++) {
    setPixel(vizRaw, vMinX, hLineY + dy, arrowColor);
    setPixel(vizRaw, vMaxX, hLineY + dy, arrowColor);
  }

  // Vertical dim line — height (3px thick)
  const vLineX = Math.max(8, vMinX - 20);
  for (let t = -1; t <= 1; t++) {
    for (let y = vMinY; y <= vMaxY; y++) {
      if ((y - vMinY) % 6 < 4) setPixel(vizRaw, vLineX + t, y, dimColor);
    }
  }
  for (let dx = -6; dx <= 6; dx++) {
    setPixel(vizRaw, vLineX + dx, vMinY, arrowColor);
    setPixel(vizRaw, vLineX + dx, vMaxY, arrowColor);
  }

  // — Text labels via SVG composite
  const cx = ((vMinX + vMaxX) / 2) | 0;
  const cy = ((vMinY + vMaxY) / 2) | 0;
  const labelSvg = Buffer.from(`<svg width="${vW}" height="${vH}" xmlns="http://www.w3.org/2000/svg">
    <style>
      text { font-family: Arial, sans-serif; font-size: 66px; font-weight: 700;
             fill: #1a1a1a; paint-order: stroke; stroke: #fff; stroke-width: 15px; stroke-linejoin: round; }
    </style>
    <!-- Width label above horizontal line -->
    <text x="${cx}" y="${Math.max(70, hLineY - 10)}" text-anchor="middle">${signWidthCm} cm</text>
    <!-- Height label left of vertical line, rotated -->
    <text x="${Math.max(40, vLineX - 10)}" y="${cy}"
          text-anchor="middle"
          transform="rotate(-90 ${Math.max(40, vLineX - 10)} ${cy})">${signHeightCm} cm</text>
  </svg>`);

  // Crop region: bounding box + margin large enough to include dim-line labels (66px font)
  const cropMargin = Math.max(120, Math.round(Math.min(vW, vH) * 0.08));
  const cropL = Math.max(0, vMinX - cropMargin);
  const cropT = Math.max(0, vMinY - cropMargin);
  const cropR = Math.min(vW, vMaxX + cropMargin + 1);
  const cropB = Math.min(vH, vMaxY + cropMargin + 1);
  const cropW = cropR - cropL;
  const cropH = cropB - cropT;

  const vizComposited = await sharp(vizRaw, { raw: { width: vW, height: vH, channels: 4 } })
    .png()
    .composite([{ input: labelSvg, top: 0, left: 0 }])
    .toBuffer();

  const vizPng = await sharp(vizComposited)
    .extract({ left: cropL, top: cropT, width: cropW, height: cropH })
    .resize({
      width: VIZ_OUTPUT_SIZE - VIZ_OUTPUT_PADDING * 2,
      height: VIZ_OUTPUT_SIZE - VIZ_OUTPUT_PADDING * 2,
      fit: 'inside',
    })
    .extend({
      top: VIZ_OUTPUT_PADDING,
      bottom: VIZ_OUTPUT_PADDING,
      left: VIZ_OUTPUT_PADDING,
      right: VIZ_OUTPUT_PADDING,
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    })
    .resize({
      width: VIZ_OUTPUT_SIZE,
      height: VIZ_OUTPUT_SIZE,
      fit: 'contain',
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    })
    .webp({ quality: 40, effort: 6 })
    .toBuffer();

  // Overlay image: original photo + contour of detected neon region
  const overlayRaw = Buffer.alloc(vW * vH * 4);
  for (let i = 0; i < vW * vH; i++) {
    overlayRaw[i*4]   = vData[i*4];
    overlayRaw[i*4+1] = vData[i*4+1];
    overlayRaw[i*4+2] = vData[i*4+2];
    overlayRaw[i*4+3] = 255;
  }
  // Draw edge of detected mask in bright green
  for (let y = 1; y < vH - 1; y++) {
    for (let x = 1; x < vW - 1; x++) {
      if (!vOpened[y * vW + x]) continue;
      const isBorder =
        !vOpened[(y-1)*vW+x] || !vOpened[(y+1)*vW+x] ||
        !vOpened[y*vW+x-1]   || !vOpened[y*vW+x+1];
      if (!isBorder) continue;
      const i = (y * vW + x) * 4;
      overlayRaw[i] = 0; overlayRaw[i+1] = 255; overlayRaw[i+2] = 100; overlayRaw[i+3] = 255;
    }
  }
  const overlayPng = await sharp(overlayRaw, { raw: { width: vW, height: vH, channels: 4 } })
    .extract({ left: cropL, top: cropT, width: cropW, height: cropH })
    .png()
    .toBuffer();

  return {
    // Image info
    imageWidth:  W,
    imageHeight: H,
    // Analysis params
    threshold:   thresh,
    autoThresh,
    threshAdjust,
    brightPixels,
    skelPixels,
    // Scale
    avgWidthPx:     Math.round(avgWidthPx * 10) / 10,
    mmPerPx:        Math.round(mmPerPx * 100000) / 100000,
    thicknessAdjust,
    // Tube length
    lengthMm:    Math.round(lengthMm),
    lengthCm:    Math.round(lengthCm),
    lengthM:     Math.round(lengthM * 100) / 100,
    // Sign dimensions (bounding box)
    signWidthMm:  Math.round(signWidthMm),
    signHeightMm: Math.round(signHeightMm),
    signWidthCm:  Math.round(signWidthMm / 10 * 10) / 10,
    signHeightCm: Math.round(signHeightMm / 10 * 10) / 10,
    // Cover (contour-based area)
    coverAreaM2:   Math.round(coverAreaM2 * 10000) / 10000,
    coverPrice:    Math.round(coverPrice),
    coverMarginMm,
    marginPx,
    // Power
    powerW:  Math.round(powerW * 10) / 10,
    powerKW: Math.round(powerKW * 1000) / 1000,
    // Cost
    tubePrice:   Math.round(tubePrice),
    totalPrice:  Math.round(totalPrice),
    // Visualization
    vizBase64:     vizPng.toString('base64'),
    overlayBase64: overlayPng.toString('base64'),
  };
}

// ─── Fast preview: threshold + morph open + contour (no skeletonization) ──────
async function previewThreshold(inputBuffer, options = {}) {
  const { threshAdjust = 0 } = options;

  // Full resolution — precise threshold, precise morphology
  const meta = await sharp(inputBuffer).metadata();
  const W = meta.width, H = meta.height;
  const { data } = await sharp(inputBuffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });

  const lum  = new Uint8Array(W * H);
  const hist = new Int32Array(256);
  for (let i = 0; i < W * H; i++) {
    const v = Math.round(0.299 * data[i*4] + 0.587 * data[i*4+1] + 0.114 * data[i*4+2]);
    lum[i] = v; hist[v]++;
  }

  const autoThresh = multiOtsuHighThreshold(hist, W * H);
  const thresh = Math.max(0, Math.min(255, autoThresh + parseInt(threshAdjust, 10)));

  // Binary mask + morph open (remove glow)
  const bin = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) bin[i] = lum[i] > thresh ? 1 : 0;
  let opened = morphOpen(bin, W, H, adaptiveMorphIter(W, H));
  opened = removeBlobs(opened, W, H);

  // Build overlay: original image with detected mask filled black
  const out = Buffer.alloc(W * H * 4);
  for (let i = 0; i < W * H; i++) {
    if (opened[i]) {
      out[i*4] = 57; out[i*4+1] = 255; out[i*4+2] = 20; out[i*4+3] = 255;
    } else {
      out[i*4]   = data[i*4];
      out[i*4+1] = data[i*4+1];
      out[i*4+2] = data[i*4+2];
      out[i*4+3] = 255;
    }
  }

  const png = await sharp(out, { raw: { width: W, height: H, channels: 4 } })
    .png().toBuffer();

  return { overlayBase64: png.toString('base64'), threshold: thresh, autoThresh };
}

module.exports = { analyzeNeonImage, previewThreshold };
