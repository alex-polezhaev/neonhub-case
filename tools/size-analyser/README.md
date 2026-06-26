# Neon Size Analyser

Estimate a neon sign's physical dimensions, neon-tube length, cover (acrylic) area,
power draw and price **from a single photo of the lit sign**, plus an annotated
visualization. Node/Express + [Sharp](https://sharp.pixelplumbing.com/); all of the
computer vision is plain JavaScript (no OpenCV).

## The idea
A lit neon tube is the brightest thing in the photo. If we isolate that bright region
and thin it to a 1px centreline, the centreline length (in pixels) is proportional to the
real tube length. The single real-world anchor the user provides is the **physical tube
width in millimetres**, which converts pixels to millimetres.

## Pipeline (`analyzer.js`)
1. **Load & luminance**: Sharp decodes the image at full resolution; each pixel is
   converted to 8-bit luminance (`0.299·R + 0.587·G + 0.114·B`) and accumulated into a
   256-bin histogram.
2. **Multi-Otsu threshold**: `multiOtsuHighThreshold` computes the high (brightest-class)
   Otsu threshold so only the glowing tube survives. A manual `±threshAdjust` offset or an
   `absoluteThreshold` can override the auto value.
3. **Binarize**: pixels brighter than the threshold become the foreground mask.
4. **Morphology**: an adaptive 3×3 morphological *opening* (erode → dilate), scaled to the
   image resolution, removes the glow halo; `removeBlobs` then drops small noise blobs and
   over-thick "lakes". An optional `±thicknessAdjust` with 0.5-step precision uses a full
   3×3 square for whole steps and a gentler 4-connected cross for half steps.
5. **Zhang-Suen skeletonization**: `zhangSuen` thins the mask to a 1px centreline. The
   skeleton pixel count is the tube length in pixels.
6. **Scale & geometry**: using the foreground (`brightPixels`) and skeleton (`skelPixels`)
   counts:
   - `avgWidthPx = brightPixels / skelPixels`
   - `mmPerPx    = tubeWidthMm / avgWidthPx`
   - `lengthMm   = skelPixels  * mmPerPx`
   Sign width/height come from the mask bounding box × `mmPerPx`; cover area is the outline
   bounding box plus a ~4% margin.
7. **Cost & power**: `price = lengthM · pricePerMeter (+ coverArea · pricePerM2Cover)
   · (1 + markup%)`; power is derived from watts-per-metre of tube, with daily/monthly
   electricity from an hours-per-day input.

The result includes an annotated visualization (white background, black skeleton,
dimension callouts) rendered as an overlay image.

## HTTP API (`server.js`, Express)
| Method & path        | Purpose                                                        |
|----------------------|----------------------------------------------------------------|
| `GET  /`             | Single-photo UI (`index.html`)                                 |
| `POST /preview`      | Fast threshold + contour preview (no skeletonization)          |
| `POST /analyze`      | Full analysis of an uploaded image                             |
| `POST /analyze-url`  | Same, but fetches the image by URL (used by batch mode)        |
| `POST /proxy/save-sizes` | Forwards computed sizes to an n8n webhook                  |
| `POST /upload-viz`   | Uploads the visualization to Directus                          |

`batch.html` drives `/analyze-url` over a product list for bulk size generation.

## Run
```bash
npm install
cp .env.example .env     # only needed for the Directus upload + n8n save integrations
npm start                # http://localhost:2999
```

## Configuration
The core CV analysis needs **no** configuration. Only the upload/persist integrations read
environment variables (`directus.js` and the n8n save endpoint). See `.env.example`. No
secrets are committed; placeholder `*.example.com` hosts stand in for real ones.
