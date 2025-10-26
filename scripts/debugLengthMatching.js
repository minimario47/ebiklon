/**
 * Debug: Kontrollera om längdmätningsdata matchar länkar
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function loadGeoJSON(filename) {
  const filepath = join(__dirname, '../EbiklonGeodata', filename);
  return JSON.parse(readFileSync(filepath, 'utf-8'));
}

async function main() {
  console.log('\n🔍 DEBUGGING: Längdmätning vs Länkar\n');

  const netLinks = loadGeoJSON('net_jvg_link.geojson');
  const lengthMeasurements = loadGeoJSON('langdmatning.geojson');

  // Bygg index av längdmätningar per element-ID
  const measurementsByElement = new Map();
  for (const feat of lengthMeasurements.features) {
    const elementId = feat.properties.ELEMENT_ID;
    if (!measurementsByElement.has(elementId)) {
      measurementsByElement.set(elementId, []);
    }
    measurementsByElement.get(elementId).push({
      konnektLangd: feat.properties.konnektLangd,
      startMeasure: feat.properties.START_MEASURE,
      endMeasure: feat.properties.END_MEASURE,
    });
  }

  console.log(`📊 Statistik:`);
  console.log(`   Länkar: ${netLinks.features.length}`);
  console.log(`   Längdmätningar: ${lengthMeasurements.features.length}`);
  console.log(`   Unika element-ID i mätningar: ${measurementsByElement.size}\n`);

  // Räkna hur många länkar som har matchande längdmätningar
  let linksWithMeasurements = 0;
  let linksWithoutMeasurements = 0;
  const sampleLinksWithout = [];
  const sampleLinksWith = [];

  for (const feat of netLinks.features) {
    const elementId = feat.properties.ELEMENT_ID;
    const linkLength = feat.properties.LENGTH;
    
    if (measurementsByElement.has(elementId)) {
      linksWithMeasurements++;
      const measurements = measurementsByElement.get(elementId);
      const totalMeasured = measurements.reduce((sum, m) => sum + m.konnektLangd, 0);
      
      if (sampleLinksWith.length < 3) {
        sampleLinksWith.push({
          elementId: elementId.substring(0, 12) + '...',
          linkLength: linkLength.toFixed(1),
          measuredLength: totalMeasured.toFixed(1),
          diff: (totalMeasured - linkLength).toFixed(1),
          measurements: measurements.length
        });
      }
    } else {
      linksWithoutMeasurements++;
      if (sampleLinksWithout.length < 3) {
        sampleLinksWithout.push({
          elementId: elementId.substring(0, 12) + '...',
          linkLength: linkLength.toFixed(1)
        });
      }
    }
  }

  console.log(`✅ Länkar MED längdmätningar: ${linksWithMeasurements} (${((linksWithMeasurements/netLinks.features.length)*100).toFixed(1)}%)`);
  console.log(`❌ Länkar UTAN längdmätningar: ${linksWithoutMeasurements} (${((linksWithoutMeasurements/netLinks.features.length)*100).toFixed(1)}%)\n`);

  if (sampleLinksWith.length > 0) {
    console.log(`📋 Exempel på länkar MED mätningar:`);
    sampleLinksWith.forEach(s => {
      console.log(`   ${s.elementId}: Link=${s.linkLength}m, Mätt=${s.measuredLength}m, Diff=${s.diff}m (${s.measurements} mätningar)`);
    });
    console.log('');
  }

  if (sampleLinksWithout.length > 0) {
    console.log(`📋 Exempel på länkar UTAN mätningar:`);
    sampleLinksWithout.forEach(s => {
      console.log(`   ${s.elementId}: Link=${s.linkLength}m`);
    });
    console.log('');
  }

  // Hitta länkar nära signaler 870, 880, 731
  console.log(`\n🎯 Länkar nära signaler 870, 880, 731:\n`);
  
  const signalsAtc = loadGeoJSON('signal_framst_atc.geojson');
  const signalsEjAtc = loadGeoJSON('signal_ej_atc.geojson');
  const allSignals = [...signalsAtc.features, ...signalsEjAtc.features];

  const targetSignals = ['870', '880', '731'];
  
  for (const sigNum of targetSignals) {
    const signal = allSignals.find(f => 
      f.properties.Signalnr === sigNum || f.properties.Nummer === sigNum
    );
    
    if (!signal) {
      console.log(`❌ Signal ${sigNum} hittades inte`);
      continue;
    }

    const sigCoord = signal.geometry.coordinates;
    console.log(`📍 Signal ${sigNum} (${sigCoord[0].toFixed(0)}, ${sigCoord[1].toFixed(0)}):`);

    // Hitta närmaste länk
    let nearestLink = null;
    let minDist = Infinity;

    for (const feat of netLinks.features) {
      for (const coord of feat.geometry.coordinates) {
        const dist = Math.sqrt(
          Math.pow(coord[0] - sigCoord[0], 2) + 
          Math.pow(coord[1] - sigCoord[1], 2)
        );
        if (dist < minDist) {
          minDist = dist;
          nearestLink = feat;
        }
      }
    }

    if (nearestLink) {
      const elementId = nearestLink.properties.ELEMENT_ID;
      const linkLength = nearestLink.properties.LENGTH;
      const hasMeasurement = measurementsByElement.has(elementId);
      
      console.log(`   Närmaste länk: ${elementId.substring(0, 12)}... (${minDist.toFixed(1)}m bort)`);
      console.log(`   Link-längd: ${linkLength.toFixed(1)}m`);
      console.log(`   Har mätning: ${hasMeasurement ? '✅ JA' : '❌ NEJ'}`);
      
      if (hasMeasurement) {
        const measurements = measurementsByElement.get(elementId);
        const totalMeasured = measurements.reduce((sum, m) => sum + m.konnektLangd, 0);
        console.log(`   Mätt längd: ${totalMeasured.toFixed(1)}m (${measurements.length} mätningar)`);
      }
      console.log('');
    }
  }
}

main().catch(err => {
  console.error('❌ Fel:', err);
  process.exit(1);
});

