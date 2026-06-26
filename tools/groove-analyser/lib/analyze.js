const svgson = require('svgson');
const { svgPathProperties } = require('svg-path-properties');

// Parse CSS classes from <style> block
function parseCSS(tree) {
  const styles = {};
  function walk(node) {
    if (node.name === 'style' && node.children) {
      const css = node.children.map(c => c.value || '').join('');
      for (const [, name, body] of css.matchAll(/\.(\w+)\s*\{([^}]+)\}/g)) {
        styles[name] = {};
        for (const decl of body.split(';')) {
          const [prop, val] = decl.split(':').map(s => s.trim());
          if (prop && val) styles[name][prop] = val;
        }
      }
    }
    if (node.children) node.children.forEach(walk);
  }
  walk(tree);
  return styles;
}

// Resolve a CSS property from inline attrs + class
function resolveStyle(node, cssMap, prop) {
  // Inline style attr first
  const style = node.attributes.style || '';
  const inlineMatch = style.match(new RegExp(prop + '\\s*:\\s*([^;]+)'));
  if (inlineMatch) return inlineMatch[1].trim();

  // Direct attribute
  if (node.attributes[prop]) return node.attributes[prop];

  // CSS classes
  const classes = (node.attributes.class || '').split(/\s+/);
  for (const cls of classes) {
    if (cssMap[cls] && cssMap[cls][prop]) return cssMap[cls][prop];
  }
  return null;
}

// Convert basic SVG shapes to path d string
function shapeToPathD(node) {
  const a = node.attributes;
  switch (node.name) {
    case 'line':
      return `M${a.x1||0},${a.y1||0} L${a.x2||0},${a.y2||0}`;
    case 'polyline':
    case 'polygon': {
      const pts = (a.points || '').trim().split(/[\s,]+/);
      const pairs = [];
      for (let i = 0; i < pts.length - 1; i += 2) pairs.push([pts[i], pts[i+1]]);
      if (!pairs.length) return null;
      const d = pairs.map((p, i) => `${i===0?'M':'L'}${p[0]},${p[1]}`).join(' ');
      return node.name === 'polygon' ? d + ' Z' : d;
    }
    default:
      return null;
  }
}

// Recursively collect stroke paths from all relevant SVG elements
function collectPaths(node, cssMap, result = [], skipped = []) {
  const shapeNames = new Set(['path', 'line', 'polyline', 'polygon']);

  if (shapeNames.has(node.name)) {
    const d = node.name === 'path' ? node.attributes.d : shapeToPathD(node);
    const stroke = resolveStyle(node, cssMap, 'stroke');
    const fill = resolveStyle(node, cssMap, 'fill');
    const strokeWidth = resolveStyle(node, cssMap, 'stroke-width');

    const hasStroke = stroke && stroke !== 'none';
    const fillIsNone = !fill || fill === 'none' || fill === 'transparent';

    if (d && hasStroke) {
      // Accept: stroke present. Warn if fill is non-transparent (user might want to know).
      if (!fillIsNone) {
        console.warn(`[analyze] Path with fill="${fill}" accepted — treating as groove centerline`);
      }
      result.push({ d, stroke, strokeWidth: parseFloat(strokeWidth) || 0 });
    } else if (d && !hasStroke) {
      skipped.push({ element: node.name, reason: 'no stroke', d: d.slice(0, 40) });
    }
  }

  if (node.children) node.children.forEach(c => collectPaths(c, cssMap, result, skipped));
  return result;
}

// Parse "0 0 W H" viewBox string
function parseViewBox(vb) {
  const parts = vb.trim().split(/[\s,]+/).map(Number);
  return { minX: parts[0], minY: parts[1], width: parts[2], height: parts[3] };
}

// Parse dimension like "300mm" → number in mm
function parseDimMM(str) {
  if (!str) return null;
  const match = str.match(/([\d.]+)(mm|cm|px|pt|in)?/);
  if (!match) return null;
  const val = parseFloat(match[1]);
  const unit = match[2] || 'px';
  const toMM = { mm: 1, cm: 10, px: 0.264583, pt: 0.352778, in: 25.4 };
  return val * (toMM[unit] || 1);
}

// Sample points along a path in document units, then convert to mm
function samplePath(d, mmPerUnit, samplesPerMM = 2) {
  let props;
  try { props = new svgPathProperties(d); } catch { return []; }
  const totalLength = props.getTotalLength(); // in SVG units
  const totalMM = totalLength * mmPerUnit;
  const numSamples = Math.max(2, Math.ceil(totalMM * samplesPerMM));
  const points = [];
  for (let i = 0; i <= numSamples; i++) {
    const pt = props.getPointAtLength((i / numSamples) * totalLength);
    points.push([
      parseFloat((pt.x * mmPerUnit).toFixed(4)),
      parseFloat((pt.y * mmPerUnit).toFixed(4)),
    ]);
  }
  return points;
}

function samplePathDetailed(d, mmPerUnit, stepMM = 0.75) {
  let props;
  try { props = new svgPathProperties(d); } catch { return null; }

  const totalLengthUnits = props.getTotalLength();
  const totalMM = totalLengthUnits * mmPerUnit;
  const sampleCount = Math.max(2, Math.ceil(totalMM / stepMM));
  const points = [];

  for (let i = 0; i <= sampleCount; i++) {
    const t = (i / sampleCount) * totalLengthUnits;
    const pt = props.getPointAtLength(t);
    points.push({
      x: pt.x,
      y: pt.y,
      xMM: pt.x * mmPerUnit,
      yMM: pt.y * mmPerUnit,
    });
  }

  const first = points[0];
  const last = points[points.length - 1];
  const dx = first.xMM - last.xMM;
  const dy = first.yMM - last.yMM;
  const hasCloseCommand = /[zZ]\s*$/.test(d.trim());
  const isClosed = hasCloseCommand || Math.hypot(dx, dy) <= Math.max(stepMM, 1);

  return { points, isClosed };
}

function isInteriorSample(path, index, stepMM = 0.75) {
  if (path.isClosed) return true;
  // Exclude only samples very close to the tips of open paths
  const samplesToSkip = Math.max(1, Math.ceil(stepMM / stepMM)); // = 1 sample from each end
  return index >= samplesToSkip && index < path.samples.length - samplesToSkip;
}

function sampleOverlapsInterior(point, path, otherPaths, stepMM = 0.75) {
  return otherPaths.some((other) => {
    // Trim only if the endpoint is physically inside the other strip (within half its width)
    const overlapRadiusMM = (other.widthMM || 0) / 2;
    if (overlapRadiusMM <= 0) return false;
    const limitSq = overlapRadiusMM * overlapRadiusMM;

    return other.samples.some((otherPoint, sampleIndex) => {
      if (!isInteriorSample(other, sampleIndex, stepMM)) return false;
      const dx = point.xMM - otherPoint.xMM;
      const dy = point.yMM - otherPoint.yMM;
      return dx * dx + dy * dy <= limitSq;
    });
  });
}

function pointsToPath(points) {
  if (points.length < 2) return null;
  return points.map((point, index) => (
    `${index === 0 ? 'M' : 'L'}${point.x.toFixed(2)},${point.y.toFixed(2)}`
  )).join(' ');
}

function trimOverlappingEnds(paths) {
  return paths.map((path, index) => {
    if (path.isClosed) return path;

    const others = paths.filter((_, otherIndex) => otherIndex !== index);
    let start = 0;
    let end = path.samples.length - 1;

    while (start < end - 1 && sampleOverlapsInterior(path.samples[start], path, others)) start++;
    while (end > start + 1 && sampleOverlapsInterior(path.samples[end], path, others)) end--;

    if (start === 0 && end === path.samples.length - 1) return path;

    const trimmedSamples = path.samples.slice(start, end + 1);
    const trimmedPath = pointsToPath(trimmedSamples);
    if (!trimmedPath) return path;

    return {
      ...path,
      d: trimmedPath,
      samples: trimmedSamples,
    };
  });
}

const LED_INTERVAL_MM = 1000 / 120; // 8.333mm per LED
const POWER_LEAD_LENGTH_MM = 80;
const MAX_SERIAL_LINK_DISTANCE_MM = Infinity;
const POWER_JUNCTION_THRESHOLD_MM = 15;
const AVAILABLE_WIRES_MM = [20, 40, 90];

function bestWireCombination(distanceMM, wireSizes = AVAILABLE_WIRES_MM) {
  // Pick the single shortest wire that covers the distance
  const sorted = [...wireSizes].sort((a, b) => a - b);
  const wire = sorted.find(w => w >= distanceMM) ?? sorted[sorted.length - 1];
  return [wire];
}

function computeLEDs(d, mmPerUnit) {
  let props;
  try { props = new svgPathProperties(d); } catch { return null; }

  const totalLengthUnits = props.getTotalLength();
  const totalMM = totalLengthUnits * mmPerUnit;
  const intervalUnits = LED_INTERVAL_MM / mmPerUnit;

  const positions = [];
  for (let t = 0; t <= totalLengthUnits; t += intervalUnits) {
    const pt = props.getPointAtLength(t);
    positions.push({ x: pt.x, y: pt.y });
  }

  const remainderMM = totalMM - positions.length * LED_INTERVAL_MM;
  // If the next cut mark would overshoot the groove end by <1mm, include it
  if (LED_INTERVAL_MM - remainderMM < 1) {
    const extraT = positions.length * intervalUnits;
    const pt = props.getPointAtLength(Math.min(extraT, totalLengthUnits));
    positions.push({ x: pt.x, y: pt.y });
  }

  // Always compute the next potential cut mark beyond the last position
  const nextT = positions.length * intervalUnits;
  const nextPt = props.getPointAtLength(Math.min(nextT, totalLengthUnits));
  const nextPosition = { x: nextPt.x, y: nextPt.y };

  return {
    count: positions.length,
    positions,
    nextPosition,
    stripLengthMM: parseFloat((positions.length * LED_INTERVAL_MM).toFixed(2)),
    remainderMM: parseFloat((totalMM - positions.length * LED_INTERVAL_MM).toFixed(2)),
  };
}

function grooveEndpoint(groove, side) {
  const point = side === 'start'
    ? groove.points[0]
    : groove.points[groove.points.length - 1];
  return { x: point[0], y: point[1] };
}

function endpointDistance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function edgeKey(a, b) {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

function buildGrooveGraph(grooves) {
  const nodes = [];
  const adjacency = [];
  const nodeByGroovePoint = new Map();
  const seenEdges = new Set();

  function addNode(grooveId, pointIndex, point) {
    const nodeIndex = nodes.length;
    nodes.push({ x: point[0], y: point[1], grooveId, pointIndex });
    adjacency.push([]);
    nodeByGroovePoint.set(`${grooveId}:${pointIndex}`, nodeIndex);
    return nodeIndex;
  }

  function connect(a, b, distanceMM) {
    if (a === b) return;
    const key = edgeKey(a, b);
    if (seenEdges.has(key)) return;
    seenEdges.add(key);
    adjacency[a].push({ to: b, distanceMM });
    adjacency[b].push({ to: a, distanceMM });
  }

  grooves.forEach((groove) => {
    if (!groove.points || groove.points.length < 2) return;

    let points = groove.points.slice();
    const isLoop = groove.isClosed
      && points.length >= 2
      && Math.hypot(points[0][0] - points[points.length - 1][0], points[0][1] - points[points.length - 1][1]) <= 0.5;
    if (isLoop) points.pop();
    if (points.length < 2) return;

    // Sparse-sample to max 30 points per groove to keep Dijkstra fast
    // Keep original indices so nodeByGroovePoint lookups still work for ports
    const MAX_PTS = 30;
    let indexedPoints = points.map((p, i) => ({ p, origIdx: i }));
    if (indexedPoints.length > MAX_PTS) {
      const sparse = [indexedPoints[0]];
      const step = (indexedPoints.length - 1) / (MAX_PTS - 1);
      for (let k = 1; k < MAX_PTS - 1; k++) sparse.push(indexedPoints[Math.round(k * step)]);
      sparse.push(indexedPoints[indexedPoints.length - 1]);
      indexedPoints = sparse;
    }

    const nodeIndexes = indexedPoints.map(({ p, origIdx }) => addNode(groove.id, origIdx, p));
    for (let i = 1; i < nodeIndexes.length; i++) {
      const prevPoint = indexedPoints[i - 1].p;
      const point = indexedPoints[i].p;
      connect(
        nodeIndexes[i - 1],
        nodeIndexes[i],
        endpointDistance({ x: prevPoint[0], y: prevPoint[1] }, { x: point[0], y: point[1] })
      );
    }

    if (groove.isClosed && nodeIndexes.length > 2) {
      const firstPoint = indexedPoints[0].p;
      const lastPoint = indexedPoints[indexedPoints.length - 1].p;
      connect(
        nodeIndexes[0],
        nodeIndexes[nodeIndexes.length - 1],
        endpointDistance({ x: firstPoint[0], y: firstPoint[1] }, { x: lastPoint[0], y: lastPoint[1] })
      );
    }
  });

  const cellSize = POWER_JUNCTION_THRESHOLD_MM;
  const cellMap = new Map();
  nodes.forEach((node, nodeIndex) => {
    const cx = Math.floor(node.x / cellSize);
    const cy = Math.floor(node.y / cellSize);
    const key = `${cx}:${cy}`;
    if (!cellMap.has(key)) cellMap.set(key, []);
    cellMap.get(key).push(nodeIndex);
  });

  nodes.forEach((node, nodeIndex) => {
    const cx = Math.floor(node.x / cellSize);
    const cy = Math.floor(node.y / cellSize);
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const bucket = cellMap.get(`${cx + dx}:${cy + dy}`);
        if (!bucket) continue;
        bucket.forEach((otherIndex) => {
          if (otherIndex <= nodeIndex) return;
          const other = nodes[otherIndex];
          const distanceMM = endpointDistance(node, other);
          if (distanceMM <= POWER_JUNCTION_THRESHOLD_MM) {
            connect(nodeIndex, otherIndex, distanceMM);
          }
        });
      }
    }
  });

  return { nodes, adjacency, nodeByGroovePoint };
}

function runDijkstra(graph, startNodeIndex, maxDistanceMM = Infinity) {
  const distances = Array(graph.nodes.length).fill(Infinity);
  const previous = Array(graph.nodes.length).fill(-1);
  const visited = Array(graph.nodes.length).fill(false);
  distances[startNodeIndex] = 0;

  while (true) {
    let current = -1;
    let bestDistance = Infinity;
    for (let i = 0; i < distances.length; i++) {
      if (!visited[i] && distances[i] < bestDistance) {
        current = i;
        bestDistance = distances[i];
      }
    }

    if (current === -1 || bestDistance > maxDistanceMM) break;
    visited[current] = true;

    graph.adjacency[current].forEach((edge) => {
      if (visited[edge.to]) return;
      const nextDistance = bestDistance + edge.distanceMM;
      if (nextDistance < distances[edge.to] && nextDistance <= maxDistanceMM) {
        distances[edge.to] = nextDistance;
        previous[edge.to] = current;
      }
    });
  }

  return { distances, previous };
}

function reconstructRoutePoints(graph, previous, startNodeIndex, endNodeIndex) {
  const route = [];
  let cursor = endNodeIndex;

  while (cursor !== -1) {
    route.push(graph.nodes[cursor]);
    if (cursor === startNodeIndex) break;
    cursor = previous[cursor];
  }

  if (!route.length || route[route.length - 1].pointIndex !== graph.nodes[startNodeIndex].pointIndex || route[route.length - 1].grooveId !== graph.nodes[startNodeIndex].grooveId) {
    return null;
  }

  route.reverse();
  return route.map((node) => [
    parseFloat(node.x.toFixed(2)),
    parseFloat(node.y.toFixed(2)),
  ]);
}

function buildGroovePorts(groove) {
  if (!groove.points || groove.points.length < 2) return [];

  if (!groove.isClosed) {
    return [
      {
        portType: 'endpoint',
        side: 'start',
        point: grooveEndpoint(groove, 'start'),
        sourceIndex: 0,
      },
      {
        portType: 'endpoint',
        side: 'end',
        point: grooveEndpoint(groove, 'end'),
        sourceIndex: groove.points.length - 1,
      },
    ];
  }

  const uniquePoints = groove.points.slice();
  if (uniquePoints.length >= 2) {
    const first = uniquePoints[0];
    const last = uniquePoints[uniquePoints.length - 1];
    if (Math.hypot(first[0] - last[0], first[1] - last[1]) <= 0.5) {
      uniquePoints.pop();
    }
  }

  if (!uniquePoints.length) return [];

  const maxPorts = 24;
  const step = Math.max(1, Math.ceil(uniquePoints.length / maxPorts));
  const ports = [];

  for (let index = 0; index < uniquePoints.length; index += step) {
    ports.push({
      portType: 'break',
      side: 'break',
      point: { x: uniquePoints[index][0], y: uniquePoints[index][1] },
      sourceIndex: index,
    });
  }

  const lastIndex = uniquePoints.length - 1;
  if (ports[ports.length - 1]?.sourceIndex !== lastIndex) {
    ports.push({
      portType: 'break',
      side: 'break',
      point: { x: uniquePoints[lastIndex][0], y: uniquePoints[lastIndex][1] },
      sourceIndex: lastIndex,
    });
  }

  return ports;
}

function buildSerialPowerPlan(grooves) {
  const graph = buildGrooveGraph(grooves);
  const grooveEntries = grooves
    .filter((groove) => groove.points.length >= 2)
    .map((groove) => ({
      groove,
      ports: buildGroovePorts(groove).map((port, portIndex) => ({
        ...port,
        id: `${groove.id}:${port.portType}:${port.sourceIndex}:${portIndex}`,
        nodeIndex: graph.nodeByGroovePoint.get(`${groove.id}:${port.sourceIndex}`) ?? null,
      })),
    }))
    .filter((entry) => entry.ports.length);

  const basePlan = {
    leadLengthMM: POWER_LEAD_LENGTH_MM,
    maxLinkDistanceMM: MAX_SERIAL_LINK_DISTANCE_MM,
    junctionThresholdMM: POWER_JUNCTION_THRESHOLD_MM,
    unsupportedGrooveIds: [],
    feasible: false,
    sequence: [],
    links: [],
  };

  const routeCache = new Map();

  function getGrooveRoute(fromPort, toPort) {
    if (fromPort.nodeIndex === null || toPort.nodeIndex === null) return null;
    let sourceRoutes = routeCache.get(fromPort.id);
    if (!sourceRoutes) {
      sourceRoutes = runDijkstra(graph, fromPort.nodeIndex);
      routeCache.set(fromPort.id, sourceRoutes);
    }

    const distanceMM = sourceRoutes.distances[toPort.nodeIndex];
    if (!Number.isFinite(distanceMM)) return null;

    const routePoints = reconstructRoutePoints(graph, sourceRoutes.previous, fromPort.nodeIndex, toPort.nodeIndex);
    if (!routePoints || routePoints.length < 2) return null;

    return {
      mode: 'groove',
      distanceMM: parseFloat(distanceMM.toFixed(2)),
      routePoints,
      directDistanceMM: parseFloat(endpointDistance(fromPort.point, toPort.point).toFixed(2)),
    };
  }

  function getLinkPlan(fromEntry, fromPort, toEntry, toPort) {
    const grooveRoute = getGrooveRoute(fromPort, toPort);
    if (grooveRoute) {
      return {
        fromGrooveId: fromEntry.groove.id,
        fromSide: fromPort.side,
        fromPortType: fromPort.portType,
        fromPoint: [
          parseFloat(fromPort.point.x.toFixed(2)),
          parseFloat(fromPort.point.y.toFixed(2)),
        ],
        fromSourceIndex: fromPort.sourceIndex,
        toGrooveId: toEntry.groove.id,
        toSide: toPort.side,
        toPortType: toPort.portType,
        toPoint: [
          parseFloat(toPort.point.x.toFixed(2)),
          parseFloat(toPort.point.y.toFixed(2)),
        ],
        toSourceIndex: toPort.sourceIndex,
        routeMode: grooveRoute.mode,
        routePoints: grooveRoute.routePoints,
        distanceMM: grooveRoute.distanceMM,
        directDistanceMM: grooveRoute.directDistanceMM,
        wires: bestWireCombination(grooveRoute.distanceMM),
      };
    }

    const directDistanceMM = endpointDistance(fromPort.point, toPort.point);
    // no distance limit

    return {
      fromGrooveId: fromEntry.groove.id,
      fromSide: fromPort.side,
      fromPortType: fromPort.portType,
      fromPoint: [
        parseFloat(fromPort.point.x.toFixed(2)),
        parseFloat(fromPort.point.y.toFixed(2)),
      ],
      fromSourceIndex: fromPort.sourceIndex,
      toGrooveId: toEntry.groove.id,
      toSide: toPort.side,
      toPortType: toPort.portType,
      toPoint: [
        parseFloat(toPort.point.x.toFixed(2)),
        parseFloat(toPort.point.y.toFixed(2)),
      ],
      toSourceIndex: toPort.sourceIndex,
      routeMode: 'direct',
      routePoints: [
        [
          parseFloat(fromPort.point.x.toFixed(2)),
          parseFloat(fromPort.point.y.toFixed(2)),
        ],
        [
          parseFloat(toPort.point.x.toFixed(2)),
          parseFloat(toPort.point.y.toFixed(2)),
        ],
      ],
      distanceMM: parseFloat(directDistanceMM.toFixed(2)),
      directDistanceMM: parseFloat(directDistanceMM.toFixed(2)),
      wires: bestWireCombination(parseFloat(directDistanceMM.toFixed(2))),
    };
  }

  if (!grooveEntries.length) {
    return {
      ...basePlan,
      reason: 'no_eligible_grooves',
    };
  }

  if (grooveEntries.length === 1) {
    const [selectedPort] = grooveEntries[0].ports;
    return {
      ...basePlan,
      feasible: true,
      totalLinkDistanceMM: 0,
      sequence: [{
        order: 1,
        grooveId: grooveEntries[0].groove.id,
        side: selectedPort.side,
        portType: selectedPort.portType,
        point: [
          parseFloat(selectedPort.point.x.toFixed(2)),
          parseFloat(selectedPort.point.y.toFixed(2)),
        ],
        sourceIndex: selectedPort.sourceIndex,
      }],
      links: [],
    };
  }

  // Greedy nearest-neighbour: O(n²) — works for any number of grooves
  const n = grooveEntries.length;
  const visited = new Array(n).fill(false);
  const chainEntries = [];   // { entryIndex, portIndex }
  const chainLinks = [];

  // Pick the best starting groove+port: try all, pick the one whose nearest
  // unvisited neighbour is closest (reduces total cost heuristically).
  let bestStartCost = Infinity;
  let bestStartEntry = 0;
  let bestStartPort = 0;

  for (let i = 0; i < n; i++) {
    for (let pi = 0; pi < grooveEntries[i].ports.length; pi++) {
      let nearestCost = Infinity;
      for (let j = 0; j < n; j++) {
        if (j === i) continue;
        for (let pj = 0; pj < grooveEntries[j].ports.length; pj++) {
          const link = getLinkPlan(grooveEntries[i], grooveEntries[i].ports[pi], grooveEntries[j], grooveEntries[j].ports[pj]);
          if (link && link.distanceMM < nearestCost) nearestCost = link.distanceMM;
        }
      }
      if (nearestCost < bestStartCost) {
        bestStartCost = nearestCost;
        bestStartEntry = i;
        bestStartPort = pi;
      }
    }
  }

  chainEntries.push({ entryIndex: bestStartEntry, portIndex: bestStartPort });
  visited[bestStartEntry] = true;
  let currentEntryIndex = bestStartEntry;
  let currentPortIndex = bestStartPort;

  while (chainEntries.length < n) {
    let bestCost = Infinity;
    let bestNext = -1;
    let bestNextPort = 0;
    let bestLink = null;

    for (let j = 0; j < n; j++) {
      if (visited[j]) continue;
      for (let pj = 0; pj < grooveEntries[j].ports.length; pj++) {
        const link = getLinkPlan(
          grooveEntries[currentEntryIndex], grooveEntries[currentEntryIndex].ports[currentPortIndex],
          grooveEntries[j], grooveEntries[j].ports[pj]
        );
        if (link && link.distanceMM < bestCost) {
          bestCost = link.distanceMM;
          bestNext = j;
          bestNextPort = pj;
          bestLink = link;
        }
      }
    }

    if (bestNext === -1) break; // disconnected — shouldn't happen with direct fallback
    chainLinks.push(bestLink);
    chainEntries.push({ entryIndex: bestNext, portIndex: bestNextPort });
    visited[bestNext] = true;
    currentEntryIndex = bestNext;
    currentPortIndex = bestNextPort;
  }

  const totalLinkDistanceMM = parseFloat(chainLinks.reduce((s, l) => s + l.distanceMM, 0).toFixed(2));

  const sequence = chainEntries.map(({ entryIndex, portIndex }, index) => {
    const entry = grooveEntries[entryIndex];
    const port = entry.ports[portIndex];
    return {
      order: index + 1,
      grooveId: entry.groove.id,
      side: port.side,
      portType: port.portType,
      point: [
        parseFloat(port.point.x.toFixed(2)),
        parseFloat(port.point.y.toFixed(2)),
      ],
      sourceIndex: port.sourceIndex,
    };
  });

  return {
    ...basePlan,
    feasible: true,
    totalLinkDistanceMM,
    sequence,
    links: chainLinks,
  };
}

async function analyzeGrooves(svgBuffer) {
  console.log('[analyze] START');
  const svgText = svgBuffer.toString('utf8');
  const tree = await svgson.parse(svgText, { camelcase: false });
  console.log('[analyze] SVG parsed');

  const root = tree;
  const viewBoxStr = root.attributes.viewBox || root.attributes.viewbox || '';
  const widthStr = root.attributes.width || '';
  const heightStr = root.attributes.height || '';

  const vb = viewBoxStr ? parseViewBox(viewBoxStr) : null;
  const docWidthMM = parseDimMM(widthStr);
  const docHeightMM = parseDimMM(heightStr);

  // mm per SVG unit
  const mmPerUnit = vb && docWidthMM ? docWidthMM / vb.width : 1;

  const cssMap = parseCSS(tree);
  const skipped = [];
  const collectedPaths = collectPaths(tree, cssMap, [], skipped);
  console.log('[analyze] collectedPaths:', collectedPaths.length);

  // Split any path containing multiple disconnected subpaths (M or m after position 0)
  const rawPaths = collectedPaths.flatMap((path) => {
    const d = path.d.trim();

    // Find positions of M/m that start new subpaths (after position 0)
    const starts = [{ pos: 0, rel: false }];
    for (let i = 1; i < d.length; i++) {
      if (d[i] === 'M') starts.push({ pos: i, rel: false });
      else if (d[i] === 'm') starts.push({ pos: i, rel: true });
    }
    if (starts.length <= 1) return [path];

    // Slice raw pieces
    const pieces = starts.map((s, idx) =>
      d.slice(s.pos, starts[idx + 1]?.pos ?? d.length).trim()
    );

    // Convert relative-m pieces to absolute M so they stand alone correctly.
    // We compute the endpoint of each piece using svgPathProperties on the
    // full accumulated path up to that point.
    const results = [];
    let accum = '';
    for (let idx = 0; idx < pieces.length; idx++) {
      const piece = pieces[idx];
      const isRel = starts[idx].rel;

      if (idx === 0 || !isRel) {
        results.push({ ...path, d: piece });
        accum = (accum ? accum + ' ' : '') + piece;
      } else {
        // Relative m: get endpoint of previous accumulated path, compute absolute start
        let absX = 0, absY = 0;
        try {
          const props = new svgPathProperties(accum);
          const len = props.getTotalLength();
          const pt = props.getPointAtLength(len);
          absX = pt.x; absY = pt.y;
        } catch {}

        // Replace leading `m dx,dy` with `M absX+dx, absY+dy`
        const relMatch = piece.match(/^m\s*([-\d.eE+]+)[,\s]+([-\d.eE+]+)/);
        let converted = piece;
        if (relMatch) {
          const dx = parseFloat(relMatch[1]);
          const dy = parseFloat(relMatch[2]);
          converted = `M${(absX + dx).toFixed(4)},${(absY + dy).toFixed(4)}` + piece.slice(relMatch[0].length);
        }

        results.push({ ...path, d: converted });
        accum += ' ' + converted;
      }
    }

    return results.filter(p => p.d.length > 2);
  });
  console.log('[analyze] rawPaths after subpath split:', rawPaths.length);

  const MIN_LENGTH_MM = 5; // shorter than one LED interval — skip
  const filteredPaths = rawPaths.filter((path) => {
    try {
      const len = new svgPathProperties(path.d).getTotalLength() * mmPerUnit;
      if (len < MIN_LENGTH_MM) {
        skipped.push({ element: 'path', reason: `too short (${len.toFixed(1)}mm < ${MIN_LENGTH_MM}mm)`, d: path.d.slice(0, 40) });
        return false;
      }
      return true;
    } catch { return false; }
  });
  console.log('[analyze] filteredPaths:', filteredPaths.length);

  if (skipped.length) console.log('[analyze] Skipped:', JSON.stringify(skipped));

  console.log('[analyze] starting trimOverlappingEnds...');
  const pathDefs = trimOverlappingEnds(filteredPaths.map((path) => {
    const detailed = samplePathDetailed(path.d, mmPerUnit);
    return {
      d: path.d,
      widthMM: parseFloat(((parseFloat(path.strokeWidth) || 0) * mmPerUnit).toFixed(2)),
      samples: detailed?.points || [],
      sourceSamples: detailed?.points || [],
      isClosed: detailed?.isClosed || false,
    };
  }));
  console.log('[analyze] trimOverlappingEnds done, pathDefs:', pathDefs.length);

  const grooves = pathDefs.map((path, i) => {
    console.log(`[analyze] groove ${i + 1}/${pathDefs.length} computeLEDs...`);
    const points = samplePath(path.d, mmPerUnit);
    const props = (() => { try { return new svgPathProperties(path.d); } catch { return null; } })();
    const lengthMM = props ? parseFloat((props.getTotalLength() * mmPerUnit).toFixed(2)) : 0;
    const leds = computeLEDs(path.d, mmPerUnit);
    return {
      id: i + 1,
      d: path.d,
      isClosed: path.isClosed,
      widthMM: path.widthMM,
      lengthMM,
      sourcePoints: path.sourceSamples.map((point) => [
        parseFloat(point.xMM.toFixed(4)),
        parseFloat(point.yMM.toFixed(4)),
      ]),
      points,
      leds,
    };
  });
  console.log('[analyze] grooves built:', grooves.length, '— starting buildSerialPowerPlan (greedy O(n²))');
  const powerPlan = buildSerialPowerPlan(grooves);
  console.log('[analyze] buildSerialPowerPlan done');

  return {
    docWidthMM,
    docHeightMM,
    mmPerUnit,
    viewBox: vb,
    grooves,
    powerPlan,
    skipped,
  };
}

module.exports = { analyzeGrooves };
