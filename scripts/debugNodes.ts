import * as fs from 'fs';
import * as path from 'path';
import { GraphBuilder } from '../geo/graphBuilder.js';

function loadGeoJSON(filename: string): any {
  const filepath = path.join(__dirname, '../EbiklonGeodata', filename);
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
graph.buildFromGeoJSON(netLinks, netNodes, allSignals, [], [], []);

const sig862 = graph.findObjectById('862');
console.log('\n📍 Signal 862:', sig862);

const [from, to] = sig862!.edgeId.split('->');
const nodes = graph.getNodes();

const fromNode = nodes.get(from);
const toNode = nodes.get(to);

console.log('\n🔗 Edge noder:');
console.log(`  FROM ${from.substring(0, 8)}...: (${fromNode?.coord.x.toFixed(0)}, ${fromNode?.coord.y.toFixed(0)})`);
console.log(`  TO   ${to.substring(0, 8)}...: (${toNode?.coord.x.toFixed(0)}, ${toNode?.coord.y.toFixed(0)})`);

const distFrom = Math.sqrt(
  Math.pow((fromNode?.coord.x || 0) - sig862!.coord.x, 2) +
  Math.pow((fromNode?.coord.y || 0) - sig862!.coord.y, 2)
);

const distTo = Math.sqrt(
  Math.pow((toNode?.coord.x || 0) - sig862!.coord.x, 2) +
  Math.pow((toNode?.coord.y || 0) - sig862!.coord.y, 2)
);

console.log(`\n📏 Avstånd från signal 862:`);
console.log(`  FROM-nod: ${distFrom.toFixed(0)}m`);
console.log(`  TO-nod: ${distTo.toFixed(0)}m`);
console.log(`  → Närmaste nod: ${distFrom < distTo ? 'FROM' : 'TO'}`);

// Visa utgående kanter från båda
const edges = graph.getEdges();
const fromEdges = edges.filter(e => e.fromNode === from);
const toEdges = edges.filter(e => e.fromNode === to);

console.log(`\n🚀 Utgående kanter från FROM-nod (${fromEdges.length}):`);
fromEdges.slice(0, 3).forEach(e => {
  const endNode = nodes.get(e.toNode);
  console.log(`  → ${e.toNode.substring(0, 8)}... (${endNode?.coord.x.toFixed(0)}, ${endNode?.coord.y.toFixed(0)}), ${e.link.length.toFixed(0)}m`);
});

console.log(`\n🚀 Utgående kanter från TO-nod (${toEdges.length}):`);
toEdges.slice(0, 3).forEach(e => {
  const endNode = nodes.get(e.toNode);
  console.log(`  → ${e.toNode.substring(0, 8)}... (${endNode?.coord.x.toFixed(0)}, ${endNode?.coord.y.toFixed(0)}), ${e.link.length.toFixed(0)}m`);
});

