/**
 * threshold-browser.js — Multi-Otsu, identical to server/analyzer.js
 */
const NeonThreshold = (() => {

  function computeLum(data, n) {
    const lum  = new Uint8Array(n);
    const hist = new Int32Array(256);
    for (let i = 0; i < n; i++) {
      const v = Math.round(0.299 * data[i*4] + 0.587 * data[i*4+1] + 0.114 * data[i*4+2]);
      lum[i] = v; hist[v]++;
    }
    return { lum, hist };
  }

  function multiOtsu(hist, total) {
    const W = new Float64Array(257), S = new Float64Array(257);
    for (let i = 0; i < 256; i++) { W[i+1] = W[i] + hist[i]; S[i+1] = S[i] + i * hist[i]; }
    const mean = (a, b) => W[b] > W[a] ? (S[b] - S[a]) / (W[b] - W[a]) : 0;
    let best = -Infinity, t2 = 128;
    for (let t1 = 1; t1 < 254; t1++) {
      for (let t2c = t1 + 1; t2c < 255; t2c++) {
        const w0 = W[t1], w1 = W[t2c]-W[t1], w2 = W[256]-W[t2c];
        if (!w0||!w1||!w2) continue;
        const mT = S[256]/W[256];
        const s = w0*(mean(0,t1)-mT)**2 + w1*(mean(t1,t2c)-mT)**2 + w2*(mean(t2c,256)-mT)**2;
        if (s > best) { best = s; t2 = t2c; }
      }
    }
    return t2;
  }

  function erode(bin, W, H) {
    const out = new Uint8Array(W*H);
    for (let y=1;y<H-1;y++) for (let x=1;x<W-1;x++)
      if (bin[(y-1)*W+x-1]&&bin[(y-1)*W+x]&&bin[(y-1)*W+x+1]&&
          bin[y*W+x-1]&&bin[y*W+x]&&bin[y*W+x+1]&&
          bin[(y+1)*W+x-1]&&bin[(y+1)*W+x]&&bin[(y+1)*W+x+1]) out[y*W+x]=1;
    return out;
  }
  function dilate(bin, W, H) {
    const out = new Uint8Array(W*H);
    for (let y=1;y<H-1;y++) for (let x=1;x<W-1;x++)
      if (bin[(y-1)*W+x-1]||bin[(y-1)*W+x]||bin[(y-1)*W+x+1]||
          bin[y*W+x-1]||bin[y*W+x]||bin[y*W+x+1]||
          bin[(y+1)*W+x-1]||bin[(y+1)*W+x]||bin[(y+1)*W+x+1]) out[y*W+x]=1;
    return out;
  }
  function morphOpen(bin, W, H, n=2) {
    let r=bin; for(let i=0;i<n;i++) r=erode(r,W,H); for(let i=0;i<n;i++) r=dilate(r,W,H); return r;
  }
  // Cross-shaped (4-connected) — half-step precision
  function erode4(bin, W, H) {
    const out=new Uint8Array(W*H);
    for(let y=1;y<H-1;y++) for(let x=1;x<W-1;x++)
      if(bin[y*W+x]&&bin[(y-1)*W+x]&&bin[(y+1)*W+x]&&bin[y*W+x-1]&&bin[y*W+x+1]) out[y*W+x]=1;
    return out;
  }
  function dilate4(bin, W, H) {
    const out=new Uint8Array(W*H);
    for(let y=1;y<H-1;y++) for(let x=1;x<W-1;x++)
      if(bin[y*W+x]||bin[(y-1)*W+x]||bin[(y+1)*W+x]||bin[y*W+x-1]||bin[y*W+x+1]) out[y*W+x]=1;
    return out;
  }
  function applyThicknessAdjust(mask, W, H, adj) {
    if (adj === 0) return mask;
    const abs  = Math.abs(adj);
    const full = Math.floor(abs);
    const half = Math.round(abs * 2) % 2 === 1;
    let r = mask;
    if (adj < 0) { for(let i=0;i<full;i++) r=erode(r,W,H);  if(half) r=erode4(r,W,H);  }
    else         { for(let i=0;i<full;i++) r=dilate(r,W,H); if(half) r=dilate4(r,W,H); }
    return r;
  }

  function resizeImageData(imageData, maxDim=1000) {
    const {width:W,height:H} = imageData;
    if (W<=maxDim&&H<=maxDim) return imageData;
    const s=Math.min(maxDim/W,maxDim/H), nW=Math.round(W*s), nH=Math.round(H*s);
    const src=document.createElement('canvas'); src.width=W; src.height=H;
    src.getContext('2d').putImageData(imageData,0,0);
    const dst=document.createElement('canvas'); dst.width=nW; dst.height=nH;
    const ctx=dst.getContext('2d'); ctx.imageSmoothingQuality='high';
    ctx.drawImage(src,0,0,nW,nH);
    return ctx.getImageData(0,0,nW,nH);
  }

  function adaptiveMorphIter(W, H) {
    return Math.min(2, Math.max(1, Math.round(Math.min(W, H) / 500)));
  }

  // Removes "lakes" — connected components whose thickness (2*area/perimeter)
  // exceeds 3x the median thickness of the remaining lines.
  function removeBlobs(mask, W, H) {
    const labels  = new Int32Array(W * H).fill(-1);
    const areas   = [];
    const perims  = [];
    const stack   = [];

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
        // 4-connected neighbours
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

    // Component thickness ~ 2 * area / perimeter
    const thick = areas.map((a, i) => perims[i] > 0 ? 2 * a / perims[i] : 0);

    // Median over components larger than the noise threshold
    const minArea = Math.max(5, Math.round(Math.min(W, H) / 50));
    const valid   = thick.filter((_, i) => areas[i] >= minArea).sort((a, b) => a - b);
    if (valid.length === 0) return mask;
    const median = valid[Math.floor(valid.length / 2)];
    const limit  = 3 * median;

    const out = new Uint8Array(W * H);
    for (let i = 0; i < W * H; i++) {
      if (mask[i] && thick[labels[i]] <= limit) out[i] = 1;
    }
    return out;
  }

  function analyze(imageData, threshAdjust=0) {
    const {width:W, height:H, data} = imageData;
    const n = W * H;
    const {lum, hist} = computeLum(data, n);
    const autoThresh = multiOtsu(hist, n);
    const thresh = Math.max(0, Math.min(255, autoThresh + Math.round(threshAdjust)));
    const bin = new Uint8Array(n);
    for (let i=0;i<n;i++) bin[i] = lum[i]>thresh ? 1 : 0;
    const opened = morphOpen(bin, W, H, adaptiveMorphIter(W, H));
    const mask   = removeBlobs(opened, W, H);
    return { autoThresh, thresh, mask, W, H, imageData };
  }

  function drawOverlay(canvas, imageData, mask, fillRGB=[57,255,20]) {
    const {width:W,height:H,data} = imageData;
    canvas.width=W; canvas.height=H;
    const ctx=canvas.getContext('2d');
    const out=ctx.createImageData(W,H), od=out.data;
    const [fr,fg,fb]=fillRGB;
    for (let i=0;i<W*H;i++) {
      if (mask[i]) { od[i*4]=fr; od[i*4+1]=fg; od[i*4+2]=fb; od[i*4+3]=255; }
      else { od[i*4]=data[i*4]; od[i*4+1]=data[i*4+1]; od[i*4+2]=data[i*4+2]; od[i*4+3]=255; }
    }
    ctx.putImageData(out,0,0);
  }

  return { analyze, applyThicknessAdjust, drawOverlay };
})();
