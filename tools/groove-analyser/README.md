# Neon Groove Analyser

Upload a **routed-groove SVG** (the CNC cut file for a flex-neon sign) and get, per groove:
its real length in millimetres, where to place LED **cut marks**, and a **serial
power-wiring plan** that chains every groove into one electrical run. Node/Express.

## Pipeline (`lib/analyze.js`)
1. **Parse SVG**: `svgson` parses the document; `<style>` CSS classes and inline styles are
   resolved (`parseCSS` / `resolveStyle`) so every *stroked* element (path, line, polyline,
   rect, circle, ...) is collected as a path (`collectPaths` / `shapeToPathD`). Paths whose
   `d` contains several disconnected sub-paths are split into separate grooves, and relative
   `m` sub-paths are converted to absolute `M`.
2. **Real-world scale**: `mmPerUnit = docWidthMM / viewBox.width`, so every length is
   reported in millimetres regardless of the SVG's internal units.
3. **Per-groove length**: `svg-path-properties` (`getTotalLength`) measures each path.
   Overlapping strip ends at shared corners are trimmed (`trimOverlappingEnds`) so they
   aren't double-counted.
4. **LED cut marks**: an addressable strip at 120 LED/m can be cut every
   `1000 / 120 ≈ 8.333 mm`. `computeLEDs` lays cut positions along each groove and reports
   the resulting strip length and remainder.
5. **Power**: total strip length × watts-per-metre → watts, plus current at 12 V and 24 V.
6. **Serial wiring plan** (`buildSerialPowerPlan`), the core of the tool:
   - **Endpoint graph**: `buildGrooveGraph` builds a graph of groove endpoints, sparsely
     sampled (≤ 30 nodes per groove), with edges weighted by Euclidean distance in mm.
   - **Dijkstra**: for each candidate hop between two groove *ports*, `runDijkstra` finds
     the shortest path **through the material** (so a wire follows the substrate rather than
     cutting straight across gaps), with a straight-line fallback when needed.
   - **Greedy chain**: a nearest-neighbour heuristic orders the grooves into a single series
     run: it picks the starting groove/port whose nearest neighbour is closest, then
     repeatedly hops to the nearest unvisited groove. Each hop selects the shortest standard
     wire length that covers it (`bestWireCombination`).
   - **Output**: the groove sequence, per-link wire lengths, and total wire distance.

## HTTP API (`server.js`, Express)
| Method & path   | Purpose                                  |
|-----------------|------------------------------------------|
| `GET  /`        | UI (`public/index.html`)                 |
| `POST /analyze` | Multipart SVG upload → JSON plan         |

## Run
```bash
npm install
npm start        # http://localhost:3001
```
No secrets or external services required.
