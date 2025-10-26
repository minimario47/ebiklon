/**
 * Kontrollera om signaler 870 och 880 är på samma länk
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
  console.log('\n🔍 Kontrollerar signal-positioner\n');

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

  const sig870 = graph.findObjectById('870');
  const sig880 = graph.findObjectById('880');
  const sig731 = graph.findObjectById('731');

  if (!sig870 || !sig880 || !sig731) {
    console.log('❌ Kunde inte hitta signaler');
    return;
  }

  console.log('📍 Signal 870:');
  console.log(`   Edge: ${sig870.edgeId}`);
  console.log(`   Position: ${sig870.distanceAlongEdge.toFixed(3)}`);
  console.log(`   Koordinat: (${sig870.coord.x.toFixed(0)}, ${sig870.coord.y.toFixed(0)})`);

  console.log('\n📍 Signal 880:');
  console.log(`   Edge: ${sig880.edgeId}`);
  console.log(`   Position: ${sig880.distanceAlongEdge.toFixed(3)}`);
  console.log(`   Koordinat: (${sig880.coord.x.toFixed(0)}, ${sig880.coord.y.toFixed(0)})`);

  console.log('\n📍 Signal 731:');
  console.log(`   Edge: ${sig731.edgeId}`);
  console.log(`   Position: ${sig731.distanceAlongEdge.toFixed(3)}`);
  console.log(`   Koordinat: (${sig731.coord.x.toFixed(0)}, ${sig731.coord.y.toFixed(0)})`);

  const sameEdge_870_880 = sig870.edgeId === sig880.edgeId;
  const sameEdge_731_870 = sig731.edgeId === sig870.edgeId;

  console.log(`\n🔗 Samma kant (870-880): ${sameEdge_870_880 ? '✅ JA' : '❌ NEJ'}`);
  console.log(`🔗 Samma kant (731-870): ${sameEdge_731_870 ? '✅ JA' : '❌ NEJ'}`);

  if (sameEdge_870_880) {
    const edge = graph.getEdges().find(e => `${e.fromNode}->${e.toNode}` === sig870.edgeId);
    if (edge) {
      console.log(`\n   Kant-längd: ${edge.link.length.toFixed(1)}m`);
      const dist = Math.abs(sig880.distanceAlongEdge - sig870.distanceAlongEdge) * edge.link.length;
      console.log(`   Avstånd 870-880: ${dist.toFixed(1)}m`);
    }
  }

  // Kolla alla växlar mellan signalerna
  console.log('\n🔀 Växlar i området:');
  const allPois = graph.getSnappedObjects().filter(o => o.type === 'poi');
  console.log(`   Totalt antal växlar: ${allPois.length}`);
  
  // Hitta växlar på samma kant som 870-880
  if (sameEdge_870_880) {
    const poisOnEdge = allPois.filter(p => p.edgeId === sig870.edgeId);
    console.log(`   Växlar på samma kant som 870-880: ${poisOnEdge.length}`);
    poisOnEdge.forEach(p => {
      const between = p.distanceAlongEdge > Math.min(sig870.distanceAlongEdge, sig880.distanceAlongEdge) &&
                      p.distanceAlongEdge < Math.max(sig870.distanceAlongEdge, sig880.distanceAlongEdge);
      console.log(`     POI ${p.id}: pos=${p.distanceAlongEdge.toFixed(3)} ${between ? '(MELLAN 870-880!)' : ''}`);
    });
  }

  // Hitta växel 712
  const poi712 = allPois.find(p => p.id === '712');
  if (poi712) {
    console.log(`\n🎯 Växel 712:`);
    console.log(`   Edge: ${poi712.edgeId}`);
    console.log(`   Position: ${poi712.distanceAlongEdge.toFixed(3)}`);
    console.log(`   Koordinat: (${poi712.coord.x.toFixed(0)}, ${poi712.coord.y.toFixed(0)})`);
    
    const dist712_870 = Math.sqrt(
      Math.pow(poi712.coord.x - sig870.coord.x, 2) + 
      Math.pow(poi712.coord.y - sig870.coord.y, 2)
    );
    const dist712_880 = Math.sqrt(
      Math.pow(poi712.coord.x - sig880.coord.x, 2) + 
      Math.pow(poi712.coord.y - sig880.coord.y, 2)
    );
    
    console.log(`   Avstånd till 870: ${dist712_870.toFixed(1)}m`);
    console.log(`   Avstånd till 880: ${dist712_880.toFixed(1)}m`);
  }
}

main().catch(err => {
  console.error('❌ Fel:', err);
  process.exit(1);
});

