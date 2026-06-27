import { DBFFile } from 'dbffile';
import * as shapefile from 'shapefile';

console.log('=== LAND RECORDS DBF (par.dbf) ===');
const dbf = await DBFFile.open('./data-raw/par.dbf');
console.log('Total records:', dbf.recordCount);
console.log('Fields:', dbf.fields.map(f => `${f.name} (${f.type})`));
const sample = await dbf.readRecords(2);
console.log('Sample records:', JSON.stringify(sample, null, 2));

console.log('\n=== PARCEL SHAPEFILE (prcl.shp) ===');
const source = await shapefile.open('./data-raw/prcl_shape/prcl.shp');
let result = await source.read();
let count = 0;
while (!result.done && count < 2) {
  console.log(`Parcel ${count}:`, {
    properties: result.value.properties,
    geometryType: result.value.geometry.type
  });
  result = await source.read();
  count++;
}
