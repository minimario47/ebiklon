/**
 * Specifikt test för signal 870 → 880
 * Förväntat resultat:
 * - Längd: ~100m
 * - Inga växlar mellan signalerna
 * - Signalerna finns på samma spår
 */

import * as fs from 'fs';
import * as path from 'path';
import { GraphBuilder } from '../geo/graphBuilder.js';
import { PathEngine } from '../geo/pathEngine.js';

function loadGeoJSON(filename: string): any {
  const filepath = path.join(__dirname, '../EbiklonGeodata', filename);
  if (!fs.existsSync(filepath)) {
    console.error(`❌ Fil saknas: ${filepath}`);
    return null;
  }
  return JSON.parse(fs.readFileSync(filepath, 'utf-8'));
}

async function main() {
  console.log('\n🧪 TEST: Signal 870 → 880\n');
  console.log('Förväntat resultat:');
  console.log('  - Längd: ~100m');
  console.log('  - Inga växlar mellan signalerna');
  console.log('  - Signalerna på samma spår\n');
  console.log('═'.repeat(80) + '\n');

  // Ladda geodata
  console.log('📦 Laddar geodata...');
  const netLinks = loadGeoJSON('net_jvg_link.geojson');
  const netNodes = loadGeoJSON('net_jvg_node.geojson');
  const signalsAtc = loadGeoJSON('signal_framst_atc.geojson');
  const signalsEjAtc = loadGeoJSON('signal_ej_atc.geojson');
  const stoppbock = loadGeoJSON('stoppbock.geojson');
  const vaxlar = loadGeoJSON('sparvaxel.geojson');
  const dcr = loadGeoJSON('sparkors.geojson');
  const lengthMeasurements = loadGeoJSON('langdmatning.geojson');

  if (!netLinks || !netNodes) {
    console.error('❌ Kunde inte ladda geodata');
    return;
  }

  // Hitta signal 870 och 880 i rådata
  console.log('\n🔍 Söker efter signaler i rådata...');
  const allSignalFeatures = [
    ...(signalsAtc?.features || []),
    ...(signalsEjAtc?.features || []),
  ];

  const signal870 = allSignalFeatures.find(
    (f) => f.properties.Signalnr === '870' || f.properties.Nummer === '870'
  );
  const signal880 = allSignalFeatures.find(
    (f) => f.properties.Signalnr === '880' || f.properties.Nummer === '880'
  );

  if (!signal870 || !signal880) {
    console.log('❌ Kunde inte hitta signal 870 eller 880 i rådata');
    console.log(`   Signal 870: ${signal870 ? '✓' : '✗'}`);
    console.log(`   Signal 880: ${signal880 ? '✓' : '✗'}`);
    return;
  }

  console.log('✅ Signaler hittade i rådata:');
  console.log(`   Signal 870: ${JSON.stringify(signal870.properties, null, 2).substring(0, 200)}...`);
  console.log(`   Signal 880: ${JSON.stringify(signal880.properties, null, 2).substring(0, 200)}...`);

  const coord870 = signal870.geometry.coordinates;
  const coord880 = signal880.geometry.coordinates;
  const directDistance = Math.sqrt(
    Math.pow(coord880[0] - coord870[0], 2) + Math.pow(coord880[1] - coord870[1], 2)
  );
  console.log(`\n📏 Direkt avstånd (fågelvägen): ${directDistance.toFixed(1)}m`);

  // Bygg graf
  console.log('\n🔧 Bygger graf...');
  const graph = new GraphBuilder();
  graph.buildFromGeoJSON(
    netLinks,
    netNodes,
    allSignalFeatures,
    stoppbock?.features || [],
    vaxlar?.features || [],
    dcr?.features || [],
    lengthMeasurements
  );

  console.log(`✅ Graf byggd:`);
  console.log(`   Noder: ${graph.getNodes().size}`);
  console.log(`   Kanter: ${graph.getEdges().length}`);
  console.log(`   Snappade objekt: ${graph.getSnappedObjects().length}`);

  // Hitta snappade objekt
  const snapped870 = graph.findObjectById('870');
  const snapped880 = graph.findObjectById('880');

  if (!snapped870 || !snapped880) {
    console.log('\n❌ Kunde inte hitta snappade signaler:');
    console.log(`   Signal 870: ${snapped870 ? '✓' : '✗'}`);
    console.log(`   Signal 880: ${snapped880 ? '✓' : '✗'}`);
    console.log('\n📋 Tillgängliga snappade signaler:');
    const signals = graph.getSnappedObjects().filter((o) => o.type === 'signal');
    signals.forEach((s) => console.log(`   - ${s.id} (${s.originalId})`));
    return;
  }

  console.log('\n✅ Signaler snappade till graf:');
  console.log(`   Signal 870: edgeId=${snapped870.edgeId}, pos=${snapped870.distanceAlongEdge.toFixed(3)}`);
  console.log(`   Signal 880: edgeId=${snapped880.edgeId}, pos=${snapped880.distanceAlongEdge.toFixed(3)}`);

  // Kolla om de är på samma kant
  const sameEdge = snapped870.edgeId === snapped880.edgeId;
  console.log(`\n🔗 Samma kant: ${sameEdge ? '✅ JA' : '❌ NEJ'}`);

  if (sameEdge) {
    const edge = graph.getEdges().find(
      (e) => `${e.fromNode}->${e.toNode}` === snapped870.edgeId
    );
    if (edge) {
      console.log(`   Kant-längd (från Net_jvg_link): ${edge.link.length.toFixed(1)}m`);
      console.log(`   Element ID: ${edge.link.elementId}`);

      // Kolla längdmätningsdata
      const correctedLength = graph.getCorrectedLinkLength(edge.link);
      console.log(`   Korrigerad längd (från langdmatning): ${correctedLength.toFixed(1)}m`);

      // Beräkna segment mellan signalerna
      const segmentLength = graph.getCorrectedSegmentLength(
        edge.link,
        snapped870.distanceAlongEdge,
        snapped880.distanceAlongEdge
      );
      console.log(`\n📏 Avstånd mellan 870 och 880: ${segmentLength.toFixed(1)}m`);
      console.log(`   Förväntat: ~100m`);
      console.log(`   Differens: ${Math.abs(segmentLength - 100).toFixed(1)}m`);

      if (Math.abs(segmentLength - 100) < 20) {
        console.log('   ✅ PASS - Längd är korrekt (~100m ±20m)');
      } else {
        console.log('   ❌ FAIL - Längd avviker för mycket från förväntad');
      }
    }
  }

  // Sök väg med PathEngine
  console.log('\n🚂 Söker väg med PathEngine...');
  const engine = new PathEngine(graph);
  const paths = engine.findPaths('870', '880');

  if (paths.length === 0) {
    console.log('❌ Inga vägar hittades');
    return;
  }

  console.log(`✅ Hittade ${paths.length} väg(ar)\n`);

  paths.forEach((path, i) => {
    console.log(`\n📍 VÄG ${i + 1}:`);
    console.log(`   Total längd: ${path.totalLength.toFixed(1)}m`);
    console.log(`   Antal kanter: ${path.edges.length}`);

    const signals = path.crossedObjects.filter((o) => o.type === 'signal');
    const pois = path.crossedObjects.filter((o) => o.type === 'poi');
    const dcrs = path.crossedObjects.filter((o) => o.type === 'dcr');

    console.log(`\n   🚦 Signaler (${signals.length}): ${signals.map((s) => s.id).join(' → ')}`);
    console.log(`   🔀 Växlar (${pois.length}): ${pois.length > 0 ? pois.map((p) => p.id).join(', ') : 'INGA'}`);
    console.log(`   ✖️  DCR (${dcrs.length}): ${dcrs.length > 0 ? dcrs.map((d) => d.id).join(', ') : 'INGA'}`);

    // Validering
    console.log('\n   📊 VALIDERING:');
    const lengthOk = Math.abs(path.totalLength - 100) < 20;
    const noSwitches = pois.length === 0;
    const correctSignals = signals.length === 2 && signals[0].id === '870' && signals[1].id === '880';

    console.log(`   ${lengthOk ? '✅' : '❌'} Längd ~100m (faktisk: ${path.totalLength.toFixed(1)}m)`);
    console.log(`   ${noSwitches ? '✅' : '❌'} Inga växlar (faktiska: ${pois.length})`);
    console.log(`   ${correctSignals ? '✅' : '❌'} Endast signaler 870 och 880`);

    if (lengthOk && noSwitches && correctSignals) {
      console.log('\n   🎉 PASS - Alla kriterier uppfyllda!');
    } else {
      console.log('\n   ⚠️  FAIL - Vissa kriterier inte uppfyllda');
    }
  });

  console.log('\n' + '═'.repeat(80) + '\n');
}

main().catch((err) => {
  console.error('❌ Fel:', err);
  console.error(err.stack);
  process.exit(1);
});

