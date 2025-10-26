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

const start = graph.findObjectById('862');
const end = graph.findObjectById('872');

console.log('\n📍 Start 862:', start);
console.log('\n📍 End 872:', end);

if (start && end) {
  const edges = graph.getEdges();
  
  // Hitta startEdge
  const [from, to] = start.edgeId.split('->');
  const startEdge = edges.find(e => e.fromNode === from && e.toNode === to);
  
  console.log('\n🔗 StartEdge:', startEdge);
  console.log(`   from: ${from}`);
  console.log(`   to: ${to}`);
  
  // Hitta grannar till startEdge.toNode
  const neighbors = edges.filter(e => e.fromNode === to);
  console.log(`\n👥 Grannar från ${to}:`, neighbors.length);
  neighbors.slice(0, 5).forEach(n => {
    console.log(`   → ${n.toNode} (${n.link.length.toFixed(2)}m)`);
  });
  
  // Kontrollera riktning
  if (startEdge) {
    const line = startEdge.link.coords;
    const p0 = line[0];
    const p1 = line[1];
    const dy = p1.y - p0.y;
    
    console.log(`\n🧭 Riktning från start:`);
    console.log(`   dy = ${dy.toFixed(3)}`);
    console.log(`   862 är jämn → förväntar norr (dy > 0): ${dy > 0 ? 'OK' : 'NEJ'}`);
  }
}

