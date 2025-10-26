/**
 * Skript för att köra vägsökningstester med faktisk geodata
 * 
 * Användning:
 *   npx ts-node scripts/runPathTests.ts 862 872
 *   npx ts-node scripts/runPathTests.ts 838 908
 */

import * as fs from 'fs';
import * as path from 'path';
import { GraphBuilder } from '../geo/graphBuilder.js';
import { PathEngine } from '../geo/pathEngine.js';

// Läs in geodata
function loadGeoJSON(filename: string): any {
  const filepath = path.join(__dirname, '../EbiklonGeodata', filename);
  if (!fs.existsSync(filepath)) {
    console.error(`❌ Fil saknas: ${filepath}`);
    return null;
  }
  return JSON.parse(fs.readFileSync(filepath, 'utf-8'));
}

async function main() {
  const args = process.argv.slice(2);
  const startSignal = args[0] || '862';
  const endSignal = args[1] || '872';
  const viaSignal = args[2]; // Optional

  console.log('\n🚂 Laddar geodata...\n');

  // Ladda alla nödvändiga filer (inkl. längdmätningsdata)
  const netLinks = loadGeoJSON('net_jvg_link.geojson');
  const netNodes = loadGeoJSON('net_jvg_node.geojson');
  const signalsAtc = loadGeoJSON('signal_framst_atc.geojson');
  const signalsEjAtc = loadGeoJSON('signal_ej_atc.geojson');
  const stoppbock = loadGeoJSON('stoppbock.geojson');
  const vaxlar = loadGeoJSON('sparvaxel.geojson');
  const dcr = loadGeoJSON('sparkors.geojson');
  const lengthMeasurements = loadGeoJSON('langdmatning.geojson');

  if (!netLinks || !netNodes) {
    console.error('❌ Kunde inte ladda nödvändig geodata.');
    return;
  }

  // Kombinera signaler
  const allSignals = [
    ...(signalsAtc?.features || []),
    ...(signalsEjAtc?.features || []),
  ];

  console.log(`📊 Data laddad:`);
  console.log(`  - Länkar: ${netLinks.features?.length || 0}`);
  console.log(`  - Noder: ${netNodes.features?.length || 0}`);
  console.log(`  - Signaler: ${allSignals.length}`);
  console.log(`  - Stoppbock: ${stoppbock?.features?.length || 0}`);
  console.log(`  - Växlar: ${vaxlar?.features?.length || 0}`);
  console.log(`  - DCR: ${dcr?.features?.length || 0}\n`);

  // Bygg graf
  console.log('🔧 Bygger graf och snappar objekt...\n');

  const graph = new GraphBuilder();
  graph.buildFromGeoJSON(
    netLinks,
    netNodes,
    allSignals,
    stoppbock?.features || [],
    vaxlar?.features || [],
    dcr?.features || [],
    lengthMeasurements
  );

  console.log(`✅ Graf byggd:`);
  console.log(`  - Noder: ${graph.getNodes().size}`);
  console.log(`  - Kanter: ${graph.getEdges().length}`);
  console.log(`  - Snappade objekt: ${graph.getSnappedObjects().length}\n`);

  // Skapa motor och sök vägar
  const engine = new PathEngine(graph);

  console.log(`\n🔍 Söker vägar: ${startSignal} → ${endSignal}${viaSignal ? ` (via ${viaSignal})` : ''}\n`);

  const paths = engine.findPaths(startSignal, endSignal, viaSignal);

  if (paths.length === 0) {
    console.log('❌ Inga vägar hittades.\n');
    console.log('Kontrollera att:');
    console.log('  - Signalerna finns i geodata');
    console.log('  - Signalnummer är korrekta (utan prefix/suffix)');
    console.log('  - Det finns en sammanhängande väg mellan objekten\n');
    return;
  }

  console.log(`✅ Hittade ${paths.length} möjliga vägar:\n`);
  console.log('═'.repeat(80) + '\n');

  paths.forEach((path, i) => {
    console.log(`🚂 VÄG ${i + 1}`);
    console.log(`─`.repeat(80));
    console.log(`📏 Total längd: ${Math.round(path.totalLength)} meter`);
    console.log(`🔗 Antal kanter: ${path.edges.length}`);

    const signals = path.crossedObjects.filter((o) => o.type === 'signal');
    const pois = path.crossedObjects.filter((o) => o.type === 'poi');
    const dcrs = path.crossedObjects.filter((o) => o.type === 'dcr');
    const tcis = path.crossedObjects.filter((o) => o.type === 'tci');

    if (signals.length > 0) {
      console.log(`\n🚦 Signaler (${signals.length}):`);
      console.log(`   ${signals.map((s) => s.id).join(' → ')}`);
    }

    if (pois.length > 0) {
      console.log(`\n🔀 Växlar/POI (${pois.length}):`);
      console.log(`   ${pois.map((p) => p.id).join(', ')}`);
    }

    if (dcrs.length > 0) {
      console.log(`\n✖️  DCR (${dcrs.length}):`);
      console.log(`   ${dcrs.map((d) => d.id).join(', ')}`);
    }

    if (tcis.length > 0) {
      console.log(`\n🛤️  TCI (${tcis.length}):`);
      console.log(`   ${tcis.map((t) => t.id).join(', ')}`);
    }

    console.log('\n' + '═'.repeat(80) + '\n');
  });

  // Verifiering mot referensfall
  console.log('\n🧪 VERIFIERING MOT REFERENSFALL\n');

  if (startSignal === '862' && endSignal === '872') {
    console.log('Test 1: 862 → 872');
    const validPath = paths.find((p) => {
      const pois = p.crossedObjects.filter((o) => o.type === 'poi').map((o) => o.id);
      const dcrs = p.crossedObjects.filter((o) => o.type === 'dcr').map((o) => o.id);

      return (
        pois.includes('725') &&
        pois.includes('723') &&
        pois.includes('726') &&
        dcrs.includes('861')
      );
    });

    if (validPath) {
      console.log('  ✅ PASS – Hittade väg med POI 725, 723, 726 och DCR 861');
    } else {
      console.log('  ❌ FAIL – Kunde inte hitta förväntad väg');
      console.log('  Förväntade objekt: POI 725, 723, 726; DCR 861');
    }
  }

  if (startSignal === '838' && endSignal === '908') {
    console.log('\nTest 2: 838 → stoppbock 908');
    const sequences = paths.map((p) => {
      const signals = p.crossedObjects.filter((o) => o.type === 'signal').map((o) => o.id);
      return signals.join('-');
    });

    const expected = [
      '838-862-872-882-908',
      '838-864-872-882-908',
      '838-864-870-880-908',
      '838-862-870-880-908',
    ];

    const foundCount = expected.filter((exp) => sequences.includes(exp)).length;

    console.log(`  Förväntade: ${expected.length} sekvenser`);
    console.log(`  Hittade: ${foundCount} av ${expected.length}`);

    if (foundCount === expected.length) {
      console.log('  ✅ PASS – Alla fyra signalsekvenser hittade');
    } else {
      console.log('  ⚠️  PARTIAL – Vissa sekvenser saknas');
      console.log('\n  Förväntade sekvenser:');
      expected.forEach((e) => console.log(`    - ${e}`));
      console.log('\n  Hittade sekvenser:');
      sequences.forEach((s) => console.log(`    - ${s}`));
    }
  }

  console.log('\n✅ Test komplett!\n');
}

main().catch((err) => {
  console.error('❌ Fel:', err);
  process.exit(1);
});

