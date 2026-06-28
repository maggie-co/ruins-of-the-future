import { readFileSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';
import * as shapefile from 'shapefile';
import proj4 from 'proj4';
import * as turf from '@turf/turf';

proj4.defs('EPSG:4326', '+proj=longlat +datum=WGS84 +no_defs');

const THIS_YEAR = 2026;
const CUT_PERMIT  = 2005; // no permit since this year = neglect signal

function parseYear(dateStr) {
  if (!dateStr) return null;
  const m = dateStr.match(/(\d{4})/);
  return m ? parseInt(m[1]) : null;
}

// ── helpers ──────────────────────────────────────────────────────────────────
function parseCSVLine(line) {
  const vals = [];
  let cur = '', inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
      else inQ = !inQ;
    } else if (ch === ',' && !inQ) {
      vals.push(cur); cur = '';
    } else cur += ch;
  }
  vals.push(cur);
  return vals;
}

function buildLookup(mdbPath, table, fn) {
  const raw = execSync(`mdb-export "${mdbPath}" "${table}"`,
    { maxBuffer: 512 * 1024 * 1024 }).toString();
  const lines = raw.split('\n');
  const headers = parseCSVLine(lines[0]).map(h => h.trim());
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const vals = parseCSVLine(line);
    const row = {};
    headers.forEach((h, j) => row[h] = vals[j] ?? '');
    fn(row);
  }
}

function normalizeHandle(h) {
  return (h || '').trim();
}

console.log('Loading condemnations...');
const condemnByHandle = new Set();
buildLookup('./data-raw/bldginsp/bldginsp.mdb', 'Condemn', r => {
  if (r.Handle) condemnByHandle.add(r.Handle);
});
console.log(`  ${condemnByHandle.size} condemned handles`);

console.log('Loading vacant buildings...');
const vacByHandle = new Map();
buildLookup('./data-raw/bldginsp/bldginsp.mdb', 'VacBldg', r => {
  if (!r.Handle) return;
  const yr = parseYear(r.FirstDate);
  if (!yr) return;
  if (!vacByHandle.has(r.Handle) || yr < vacByHandle.get(r.Handle))
    vacByHandle.set(r.Handle, yr);
});
console.log(`  ${vacByHandle.size} vacant building handles`);

console.log('Loading LRA inventory...');
const lraByHandle = new Set();
buildLookup('./data-raw/lra/lra_public.mdb', 'dbo_vw_public_inventory', r => {
  if (r.Handle) lraByHandle.add(r.Handle);
});
console.log(`  ${lraByHandle.size} LRA handles`);

console.log('Loading building permits...');
const lastPermitByHandle = new Map();
buildLookup('./data-raw/prmbdo/prmbdo.mdb', 'PrmBldg', r => {
  if (!r.Handle) return;
  const yr = parseYear(r.IssueDate);
  if (!yr) return;
  if (!lastPermitByHandle.has(r.Handle) || yr > lastPermitByHandle.get(r.Handle))
    lastPermitByHandle.set(r.Handle, yr);
});
console.log(`  ${lastPermitByHandle.size} handles with permits`);

console.log('Loading demo permits...');
const demoByHandle = new Set();
buildLookup('./data-raw/prmbdo/prmbdo.mdb', 'PrmDemo', r => {
  if (r.Handle) demoByHandle.add(r.Handle);
});
console.log(`  ${demoByHandle.size} demo permit handles`);

// ── historic district spatial join ───────────────────────────────────────────

console.log('Loading historic districts...');
const hdSource = await shapefile.open('./data-raw/historic_dist/historict_districts.shp');
const hdPolygons = [];
let hdResult = await hdSource.read();
while (!hdResult.done) {
  hdPolygons.push(hdResult.value);
  hdResult = await hdSource.read();
}
console.log(`  ${hdPolygons.length} historic district polygons`);

// Pre-build turf polygons once
const hdTurf = hdPolygons
  .filter(f => f.geometry)
  .map(f => {
    try { return turf.feature(f.geometry, f.properties); }
    catch { return null; }
  })
  .filter(Boolean);

function isInHistoricDistrict(lng, lat) {
  const pt = turf.point([lng, lat]);
  return hdTurf.some(poly => {
    try { return turf.booleanPointInPolygon(pt, poly); }
    catch { return false; }
  });
}

// ── compute risk score ────────────────────────────────────────────────────────

/*
  PERSISTENCE RISK INDEX (0–100, higher = more at risk of demolition)

  Variable              Weight   Notes
  ─────────────────────────────────────────────────────────────────────
  condemned             30       Binary. Highest single signal.
  lraOwned              20       Binary. City land bank = clearance likely.
  landRatio             20       assessedLand / (assessedImprov + 1),
                                 normalized 0–1 against 95th percentile.
                                 High ratio = land worth more than building.
  vacancyScore          15       Binary + years vacant decay:
                                 min(1, yearsVacant / 20)
  noRecentPermit        10       No building permit issued since CUT_PERMIT.
  demolitionPermit       5       Permit to demolish has been issued.
  historicDistrict     −15       Legal protection reduces risk.
  ─────────────────────────────────────────────────────────────────────
  Max theoretical raw:  100 (condemned + lra + high landRatio + vacant
                         + no permit + demo permit, not historic)
*/

// First pass: collect land ratios to find 95th percentile for normalization
console.log('Loading buildings GeoJSON...');
const geojson = JSON.parse(readFileSync('./data-processed/buildings.geojson', 'utf8'));
console.log(`  ${geojson.features.length} buildings`);

console.log('Computing land ratio normalization...');
const ratios = geojson.features
  .map(f => {
    const land = parseFloat(f.properties.assessedLand) || 0;
    const improv = parseFloat(f.properties.assessedImprov) || 0;
    return land / (improv + 1);
  })
  .filter(r => r > 0)
  .sort((a, b) => a - b);

const p95idx = Math.floor(ratios.length * 0.95);
const RATIO_P95 = ratios[p95idx];
console.log(`  Land ratio 95th percentile: ${RATIO_P95.toFixed(2)}`);

// Second pass: compute centroid + score for each building
console.log('Scoring buildings...');
let scored = 0;
for (const feature of geojson.features) {
  const p = feature.properties;
  const handle = normalizeHandle(p.handle);

  // Centroid for historic district point-in-polygon
 // Centroid for historic district point-in-polygon
 let lng = 0, lat = 0, validCoords = false;
 try {
   const coords = feature.geometry.coordinates[0];
   if (Array.isArray(coords) && coords.length > 0) {
     const lngs = coords.map(c => c[0]).filter(v => typeof v === 'number' && isFinite(v));
     const lats = coords.map(c => c[1]).filter(v => typeof v === 'number' && isFinite(v));
     if (lngs.length > 0 && lats.length > 0) {
       lng = lngs.reduce((a, b) => a + b, 0) / lngs.length;
       lat = lats.reduce((a, b) => a + b, 0) / lats.length;
       validCoords = true;
     }
   }
 } catch { /* leave validCoords false */ }

  // Individual signals (0–1 each before weighting)
  const condemned    = condemnByHandle.has(handle) ? 1 : 0;
  const lraOwned     = lraByHandle.has(handle)     ? 1 : 0;
  const demoPerm     = demoByHandle.has(handle)     ? 1 : 0;
  const historic = (validCoords && lng !== 0) ? isInHistoricDistrict(lng, lat) : false;

  const land   = parseFloat(p.assessedLand)   || 0;
  const improv = parseFloat(p.assessedImprov) || 0;
  const rawRatio = land / (improv + 1);
  const landRatio = Math.min(1, rawRatio / RATIO_P95);

  // Vacancy: use existing vacantBldgYear OR VacBldg registry
  const vacYear = p.vacantBldgYear || vacByHandle.get(handle) || null;
  const vacancyScore = vacYear
    ? Math.min(1, (THIS_YEAR - parseInt(vacYear)) / 20)
    : 0;

  // Permit recency
  const lastPermit = lastPermitByHandle.get(handle) || null;
  const noRecentPermit = (!lastPermit || lastPermit < CUT_PERMIT) ? 1 : 0;

  // Weighted sum
  const raw =
  condemned        * 35 +   // was 30, absorbs lost permit signal
  lraOwned         * 25 +   // was 20, absorbs lost vacancy signal
  landRatio        * 25 +   // was 20, strongest continuous variable
  demoPerm         * 10 +   // was 5, elevated since demo permit = near-certain
  historic         * -20;   // was -15, stronger protection signal

  // Clamp 0–100
  const riskScore = Math.round(Math.max(0, Math.min(100, raw)));

  // Write back
  p.riskScore       = riskScore;
  p.condemned       = condemned === 1;
  p.lraOwned        = lraOwned  === 1;
  p.demoPerm        = demoPerm  === 1;
  p.historicDist    = historic  === 1;
  p.lastPermitYear  = lastPermit;
  p.noRecentPermit  = noRecentPermit === 1;
  p.vacancyScore    = parseFloat(vacancyScore.toFixed(3));
  p.landRatio       = parseFloat(rawRatio.toFixed(2));

  scored++;
  if (scored % 20000 === 0) console.log(`  ${scored} buildings scored`);
}

// ── write output ──────────────────────────────────────────────────────────────

const outPath = './data-processed/persistence.geojson';
writeFileSync(outPath, JSON.stringify(geojson));
console.log(`\nWrote ${outPath}`);

// Quick stats
const scores = geojson.features.map(f => f.properties.riskScore);
const avg = (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1);
const high = scores.filter(s => s >= 70).length;
const med  = scores.filter(s => s >= 40 && s < 70).length;
console.log(`\nRisk distribution:`);
console.log(`  Average score: ${avg}`);
console.log(`  High risk (≥70): ${high.toLocaleString()}`);
console.log(`  Medium risk (40–69): ${med.toLocaleString()}`);
console.log(`  Low risk (<40): ${(scores.length - high - med).toLocaleString()}`);