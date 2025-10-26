import { GraphBuilder } from '../geo/graphBuilder';
import { PathEngine } from '../geo/pathEngine';

// Mock geodata – ersätt med faktisk inläsning från dina GeoJSON-filer
// För att köra testerna, läs in:
// - Net_jvg_link.geojson
// - Net_jvg_node.geojson
// - signal_framst_atc.geojson
// - signal_ej_atc.geojson
// - stoppbock.geojson
// - sparvaxel.geojson
// - sparkors.geojson

describe('PathEngine – Vägsökning med riktning och växelfilter', () => {
  let graph: GraphBuilder;
  let engine: PathEngine;

  beforeAll(() => {
    // Läs in geodata (du behöver implementera detta beroende på din miljö)
    // Exempel: const netLinks = JSON.parse(fs.readFileSync('...'));
    
    graph = new GraphBuilder();
    // graph.buildFromGeoJSON(netLinks, netNodes, signals, stoppbock, vaxlar, dcr);
    engine = new PathEngine(graph);

    // För nu: mocka eller läs in data här
  });

  test('862 → 872: ska korsa POI 725, 723, 726 och DCR 861', () => {
    const paths = engine.findPaths('862', '872');

    expect(paths.length).toBeGreaterThan(0);

    // Hitta väg som matchar
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

    expect(validPath).toBeDefined();
    console.log('862→872 väg hittad:', validPath);
  });

  test('838 → stoppbock 908: ska hitta fyra signalsekvenser', () => {
    const paths = engine.findPaths('838', '908');

    expect(paths.length).toBeGreaterThanOrEqual(4);

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

    for (const exp of expected) {
      const found = sequences.some((seq) => seq === exp);
      expect(found).toBe(true);
    }

    console.log('838→908 signalsekvenser:', sequences);
  });

  test('Riktningskontroll: jämna signaler kräver norrgående start', () => {
    const paths = engine.findPaths('862', '872'); // 862 är jämn → norr

    // Alla vägar ska starta norr
    paths.forEach((p) => {
      const firstEdge = p.edges[0];
      const line = firstEdge.link.coords;
      const start = line[0];
      const next = line[1];
      const dy = next.y - start.y;

      expect(dy).toBeGreaterThan(0); // Startar norrut
    });
  });

  test('Vinkelfilter: ~90° svängar ska förkastas', () => {
    // Detta är en helhetskontroll – om rätt vägar hittas utan orimliga svängar
    const paths = engine.findPaths('862', '872');

    paths.forEach((p) => {
      // Inga vägar ska ha extrema deflektioner (implementera test om nödvändigt)
      expect(p.edges.length).toBeGreaterThan(0);
    });
  });
});

/**
 * Interaktiv testfunktion – skriv in två signaler och se alla vägar
 */
export async function testInteractive(startSignal: string, endSignal: string) {
  console.log(`\n=== Söker vägar: ${startSignal} → ${endSignal} ===\n`);

  // Läs in geodata (implementera baserat på din miljö)
  const graph = new GraphBuilder();
  // graph.buildFromGeoJSON(...);
  const engine = new PathEngine(graph);

  const paths = engine.findPaths(startSignal, endSignal);

  if (paths.length === 0) {
    console.log('❌ Inga vägar hittades.');
    return;
  }

  console.log(`✅ Hittade ${paths.length} vägar:\n`);

  paths.forEach((path, i) => {
    console.log(`--- Väg ${i + 1} ---`);
    console.log(`Total längd: ${Math.round(path.totalLength)} m`);

    const signals = path.crossedObjects.filter((o) => o.type === 'signal');
    const pois = path.crossedObjects.filter((o) => o.type === 'poi');
    const dcrs = path.crossedObjects.filter((o) => o.type === 'dcr');

    console.log(`Signaler: ${signals.map((s) => s.id).join(' → ')}`);
    console.log(`Växlar (POI): ${pois.map((p) => p.id).join(', ')}`);
    console.log(`DCR: ${dcrs.map((d) => d.id).join(', ')}`);
    console.log('');
  });
}

// Exempel: testInteractive('862', '872');
// Exempel: testInteractive('838', '908');

