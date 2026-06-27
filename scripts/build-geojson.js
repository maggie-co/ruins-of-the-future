import { DBFFile } from 'dbffile';
import * as shapefile from 'shapefile';
import proj4 from 'proj4';
import { writeFileSync } from 'fs';

// Source: NAD27 / Missouri State Plane East (feet)
const SOURCE_PROJ = '+proj=tmerc +lat_0=35.8333333333333 +lon_0=-90.5 +k=0.999933333 +x_0=152400.3048006096 +y_0=0 +datum=NAD27 +units=us-ft +no_defs';
const WGS84 = 'EPSG:4326';
proj4.defs('EPSG:4326', '+proj=longlat +datum=WGS84 +no_defs');

function reprojectCoords(coords) {
  // Recursively reproject every [x, y] pair in any nested array
  if (typeof coords[0] === 'number') {
    return proj4(SOURCE_PROJ, WGS84, coords);
  }
  return coords.map(reprojectCoords);
}

console.log('Loading DBF...');
const dbf = await DBFFile.open('./data-raw/par.dbf');
const records = await dbf.readRecords(dbf.recordCount);

const byHandle = {};
for (const r of records) {
  byHandle[r.HANDLE] = r;
}
console.log(`  ${records.length} attribute records indexed by HANDLE`);

console.log('Loading + reprojecting shapefile...');
const source = await shapefile.open('./data-raw/prcl_shape/prcl.shp');
const features = [];
let total = 0;
let withYear = 0;
let result = await source.read();
while (!result.done) {
  total++;
  const handle = result.value.properties.HANDLE;
  const attrs = byHandle[handle];

  if (attrs && attrs.BDG1YEAR > 0) {
    withYear++;
    features.push({
      type: 'Feature',
      properties: {
        handle,
        address: attrs.SITEADDR,
        yearBuilt: attrs.BDG1YEAR,
        numBuildings: attrs.NUMBLDGS,
        assessedLand: attrs.ASMTLAND,
        assessedImprov: attrs.ASMTIMPROV,
        vacantLand: attrs.VACANTLAND === 'Y',
        vacantBldgYear: attrs.VACBLDGYR || null,
        landUse: attrs.LANDUSE1,
        zoning: attrs.ZONING1,
        ownerGroup: attrs.OWNERGROUP,
        neighborhood: attrs.NBRHD,
      },
      geometry: {
        type: result.value.geometry.type,
        coordinates: reprojectCoords(result.value.geometry.coordinates),
      },
    });
  }
  if (total % 20000 === 0) console.log(`  ${total} parcels processed (${withYear} with building year)`);
  result = await source.read();
}

console.log(`\nTotal parcels: ${total}`);
console.log(`With building year: ${withYear}`);

const out = { type: 'FeatureCollection', features };
const path = './data-processed/buildings.geojson';
writeFileSync(path, JSON.stringify(out));
console.log(`\nWrote ${path}`);
