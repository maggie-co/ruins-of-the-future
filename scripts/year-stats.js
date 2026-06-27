import { DBFFile } from 'dbffile';

const dbf = await DBFFile.open('./data-raw/par.dbf');
const records = await dbf.readRecords(dbf.recordCount);

const withYear = records.filter(r => r.BDG1YEAR > 0);
const years = withYear.map(r => r.BDG1YEAR).sort((a, b) => a - b);

console.log(`Total parcels: ${records.length}`);
console.log(`Parcels with BDG1YEAR > 0: ${withYear.length} (${(withYear.length / records.length * 100).toFixed(1)}%)`);
console.log(`Year range: ${years[0]} → ${years[years.length - 1]}`);
console.log(`Median year: ${years[Math.floor(years.length / 2)]}`);

// Decade distribution
const decades = {};
for (const y of years) {
  const decade = Math.floor(y / 10) * 10;
  decades[decade] = (decades[decade] || 0) + 1;
}
console.log('\nBuildings per decade:');
Object.keys(decades).sort().forEach(d => {
  const count = decades[d];
  const bar = '█'.repeat(Math.round(count / 500));
  console.log(`  ${d}s: ${count.toString().padStart(6)} ${bar}`);
});
