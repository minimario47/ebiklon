/**
 * Debug collectCrossedObjects för att se varför 870 inte dyker upp
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { GraphBuilder } from '../dist/geo/graphBuilder.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function loadGeoJSON(filename) {
  const filepath = join(__dirname, '../EbiklonGeodata', filename);
  return JSON.parse(readFileSync(filepath, 'utf-8'));
}

async function main() {
  console.log('\n🔍 DEBUG: collectCrossedObjects\n');

  const netLinks = loadGeoJSON('net_jvg_link.geojson');
  const netNodes = loadGeoJSON('net_jvg_node.geojson');
  const signalsAtc = loadGeoJSON('signal_framst_atc.geojson');
  const signalsEjAtc = loadGeoJSON('signal_ej_atc.geojson');
  const stoppbock = loadGeoJSON('stoppbock.geojson');
  const vaxlar = loadGeoJSON('sparvaxel.geojson');
  const dcr = loadGeoJSON('sparkors.geojson');

  const allSignals = [...signalsAtc.features, ...signalsEjAtc.features];

  const graph = new GraphBuilder();
  graph.buildFromGeoJSON(
    netLinks,
    netNodes,
    allSignals,
    stoppbock.features,
    vaxlar.features,
    dcr.features
  );

  const sig731 = graph.findObjectById('731');
  const sig870 = graph.findObjectById('870');
  const sig880 = graph.findObjectById('880');

  console.log('📍 Signaler:');
  console.log(`   731: edgeId=${sig731.edgeId}, pos=${sig731.distanceAlongEdge.toFixed(3)}`);
  console.log(`   870: edgeId=${sig870.edgeId}, pos=${sig870.distanceAlongEdge.toFixed(3)}`);
  console.log(`   880: edgeId=${sig880.edgeId}, pos=${sig880.distanceAlongEdge.toFixed(3)}`);

  // Hitta alla signaler på samma kant
  const allOnEdge = graph.getSnappedObjects().filter(o => 
    o.edgeId === sig731.edgeId && o.type === 'signal'
  );

  console.log(`\n🚦 Alla signaler på samma kant (${allOnEdge.length}):`);
  allOnEdge.forEach(s => {
    const between731_880 = s.distanceAlongEdge >= sig731.distanceAlongEdge && 
                           s.distanceAlongEdge <= sig880.distanceAlongEdge;
    console.log(`   Signal ${s.id}: pos=${s.distanceAlongEdge.toFixed(3)} ${between731_880 ? '✅ MELLAN 731-880' : ''}`);
  });

  // Simulera collectCrossedObjects logik
  console.log(`\n🔍 Simulerar collectCrossedObjects för 731 → 880:`);
  console.log(`   path.length = 1 (samma kant)`);
  console.log(`   startObj.distanceAlongEdge = ${sig731.distanceAlongEdge.toFixed(3)}`);
  console.log(`   endObj.distanceAlongEdge = ${sig880.distanceAlongEdge.toFixed(3)}`);
  console.log(`   minPos = ${Math.min(sig731.distanceAlongEdge, sig880.distanceAlongEdge).toFixed(3)}`);
  console.log(`   maxPos = ${Math.max(sig731.distanceAlongEdge, sig880.distanceAlongEdge).toFixed(3)}`);

  console.log(`\n   Kontrollerar signal 870:`);
  console.log(`   870.distanceAlongEdge = ${sig870.distanceAlongEdge.toFixed(3)}`);
  console.log(`   870 < minPos? ${sig870.distanceAlongEdge < Math.min(sig731.distanceAlongEdge, sig880.distanceAlongEdge)}`);
  console.log(`   870 > maxPos? ${sig870.distanceAlongEdge > Math.max(sig731.distanceAlongEdge, sig880.distanceAlongEdge)}`);
  console.log(`   Borde inkluderas? ${sig870.distanceAlongEdge >= Math.min(sig731.distanceAlongEdge, sig880.distanceAlongEdge) && sig870.distanceAlongEdge <= Math.max(sig731.distanceAlongEdge, sig880.distanceAlongEdge)}`);

  // Kolla paritet (udda/jämn)
  const sig731Num = parseInt(sig731.id, 10);
  const sig870Num = parseInt(sig870.id, 10);
  const sig880Num = parseInt(sig880.id, 10);

  console.log(`\n   Paritet (udda/jämn):`);
  console.log(`   731: ${sig731Num} (${sig731Num % 2 === 0 ? 'JÄMN' : 'UDDA'})`);
  console.log(`   870: ${sig870Num} (${sig870Num % 2 === 0 ? 'JÄMN' : 'UDDA'})`);
  console.log(`   880: ${sig880Num} (${sig880Num % 2 === 0 ? 'JÄMN' : 'UDDA'})`);
  console.log(`   870 har samma paritet som 731? ${sig731Num % 2 === sig870Num % 2 ? '✅ JA' : '❌ NEJ'}`);
}

main().catch(err => {
  console.error('❌ Fel:', err);
  process.exit(1);
});

