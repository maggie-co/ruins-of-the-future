import { readFileSync } from 'fs';
const data = JSON.parse(readFileSync('./data-processed/buildings.geojson', 'utf8'));

console.log(`Total features: ${data.features.length}`);

// Year distribution (sanity check)
const years = data.features.map(f => f.properties.yearBuilt);
console.log(`Year range: ${Math.min(...years)} → ${Math.max(...years)}`);

// First few buildings — confirm coords look like St. Louis (~-90.2, 38.6)
console.log('\nFirst 3 features:');
data.features.slice(0, 3).forEach((f, i) => {
  const firstCoord = JSON.stringify(f.geometry.coordinates).match(/-?\d+\.\d+/g).slice(0, 2);
  console.log(`  ${i}: ${f.properties.address} | built ${f.properties.yearBuilt} | first coord ~ [${firstCoord.join(', ')}]`);
});

// Oldest building
const oldest = data.features.reduce((a, b) => a.properties.yearBuilt < b.properties.yearBuilt ? a : b);
console.log(`\nOldest: ${oldest.properties.address} (${oldest.properties.yearBuilt})`);

// Anything on 4th St (Old Courthouse area)
const fourth = data.features.filter(f => f.properties.address?.includes('N 4TH ST')).slice(0, 5);
console.log('\nN 4TH ST samples:');
fourth.forEach(f => console.log(`  ${f.properties.address} | built ${f.properties.yearBuilt}`));
