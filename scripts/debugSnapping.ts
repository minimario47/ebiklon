import * as fs from 'fs';
import * as path from 'path';
import { GraphBuilder } from '../geo/graphBuilder.js';

function loadGeoJSON(filename: string): any {
  const filepath = path.join(__dirname, '../EbiklonGeodata', filename);
  if (!fs.existsSync(filepath)) {
    console.error(`❌ Fil saknas: ${filepath}`);
    return null;
  }
  return JSON.parse(fs.readFileSync(filepath, 'utf-8'));
}

const netLinks = loadGeoJSON('net_jvg_link.geojson');
const netNodes = loadGeoJSON('net_jvg_node.geojson');
const signalsAtc = loadGeoJSON('signal_framst_atc.geojson');
const signalsEjAtc = loadGeoJSON('signal_ej_atc.geojson');

const allSignals = [
  ...(signalsAtc?.features || []),
  ...(signalsEjAtc?.features || []),
];

const graph = new GraphBuilder();
graph.buildFromGeoJSON(
  netLinks,
  netNodes,
  allSignals,
  [],
  [],
  []
);

console.log('\n🔍 Söker efter signal 862 och 872:\n');

const snapped = graph.getSnappedObjects();
const sig862 = snapped.filter(s => s.id.includes('862'));
const sig872 = snapped.filter(s => s.id.includes('872'));

console.log('Signal 862:', sig862);
console.log('Signal 872:', sig872);

console.log('\n📋 Alla snappade signaler (första 20):');
const signals = snapped.filter(s => s.type === 'signal').slice(0, 20);
signals.forEach(s => {
  console.log(`  ${s.id} → edge: ${s.edgeId}, dist: ${s.snapDistance.toFixed(2)}m`);
});

console.log('\n🔢 Signal-nummerstatistik:');
const signalIds = snapped.filter(s => s.type === 'signal').map(s => s.id);
console.log('Totalt:', signalIds.length);
console.log('Exempel:', signalIds.slice(0, 30).join(', '));

