import type { Link, Node, Edge, Signal, Stoppbock, Vaxel, DCR, SnappedObject, Config, Point3D } from './types.js';
import { LengthMeasurementManager } from './lengthMeasurement.js';

export class GraphBuilder {
  private nodes: Map<string, Node> = new Map();
  private edges: Edge[] = [];
  private snappedObjects: SnappedObject[] = [];
  private lengthManager: LengthMeasurementManager = new LengthMeasurementManager();

  private config: Config = {
    snapToleranceMeters: 10,
    angleRejectDegMin: 80,
    angleRejectDegMax: 100,
    uTurnDeg: 150,
    maxNodes: 2000,
    maxPathLengthMeters: 10000,
    kPathsPerPair: 10,
  };

  buildFromGeoJSON(
    netLinks: any,
    netNodes: any,
    signals: any[],
    stoppbock: any[],
    vaxlar: any[],
    dcr: any[],
    lengthMeasurements?: any
  ) {
    // 0. Ladda längdmätningsdata om tillgänglig
    if (lengthMeasurements) {
      this.lengthManager.loadFromGeoJSON(lengthMeasurements);
      this.lengthManager.printStats();
    }

    // 1. Bygg noder
    for (const feat of netNodes.features) {
      const coords = feat.geometry.coordinates;
      const oid = feat.properties.OID || feat.properties.id;
      this.nodes.set(oid, {
        oid,
        coord: { x: coords[0], y: coords[1], z: coords[2] || 0 },
      });
    }

    // 2. Bygg kanter (båda riktningar)
    for (const feat of netLinks.features) {
      const coords = feat.geometry.coordinates.map((c: number[]) => ({
        x: c[0],
        y: c[1],
        z: c[2] || 0,
      }));
      const link: Link = {
        id: feat.properties.id || feat.properties.ELEMENT_ID,
        startNodeOid: feat.properties.START_NODE_OID,
        endNodeOid: feat.properties.END_NODE_OID,
        length: feat.properties.LENGTH || 0,
        coords,
        elementId: feat.properties.ELEMENT_ID,
      };

      // A→B
      this.edges.push({
        fromNode: link.startNodeOid,
        toNode: link.endNodeOid,
        link,
        reversed: false,
      });

      // B→A
      this.edges.push({
        fromNode: link.endNodeOid,
        toNode: link.startNodeOid,
        link,
        reversed: true,
      });
    }

    // 3. Snappa objekt
    this.snapSignals(signals);
    this.snapStoppbock(stoppbock);
    this.snapVaxlar(vaxlar);
    this.snapDCR(dcr);
  }

  private snapSignals(signals: any[]) {
    for (const sig of signals) {
      const coords = sig.geometry.coordinates;
      const coord: Point3D = { x: coords[0], y: coords[1], z: coords[2] || 0 };
      const nummer = this.normalizeNummer(sig.properties.Signalnr || sig.properties.Nummer);
      if (!nummer) continue;

      const snapped = this.snapToEdge(coord, nummer, 'signal', sig.properties.ELEMENT_ID || sig.properties.id);
      if (snapped) {
        this.snappedObjects.push(snapped);
      }
    }
  }

  private snapStoppbock(stoppbock: any[]) {
    for (const sb of stoppbock) {
      const coords = sb.geometry.coordinates;
      const coord: Point3D = { x: coords[0], y: coords[1], z: coords[2] || 0 };
      const nummer = this.normalizeNummer(sb.properties.Nummer || sb.properties.id);

      const snapped = this.snapToEdge(coord, nummer || 'sb_' + sb.properties.id, 'stoppbock', sb.properties.ELEMENT_ID || sb.properties.id);
      if (snapped) {
        this.snappedObjects.push(snapped);
      }
    }
  }

  private snapVaxlar(vaxlar: any[]) {
    for (const v of vaxlar) {
      const coords = v.geometry.coordinates;
      // Använd mittpunkt om LineString
      let coord: Point3D;
      if (Array.isArray(coords[0])) {
        const mid = coords[Math.floor(coords.length / 2)];
        coord = { x: mid[0], y: mid[1], z: mid[2] || 0 };
      } else {
        coord = { x: coords[0], y: coords[1], z: coords[2] || 0 };
      }

      const vaxelnr = this.normalizeNummer(v.properties.Vaxelnr);
      if (!vaxelnr) continue;

      const snapped = this.snapToEdge(coord, vaxelnr, 'poi', v.properties.ELEMENT_ID || v.properties.id);
      if (snapped) {
        this.snappedObjects.push(snapped);
      }
    }
  }

  private snapDCR(dcr: any[]) {
    for (const d of dcr) {
      const coords = d.geometry.coordinates;
      const coord: Point3D = { x: coords[0], y: coords[1], z: coords[2] || 0 };
      const nummer = this.normalizeNummer(d.properties.Nummer);
      if (!nummer) continue;

      const snapped = this.snapToEdge(coord, nummer, 'dcr', d.properties.ELEMENT_ID || d.properties.id);
      if (snapped) {
        this.snappedObjects.push(snapped);
      }
    }
  }

  private snapToEdge(coord: Point3D, id: string, type: string, elementId: string): SnappedObject | null {
    let bestEdge: Edge | null = null;
    let bestDist = Infinity;
    let bestT = 0;

    for (const edge of this.edges) {
      const line = edge.link.coords;
      for (let i = 0; i < line.length - 1; i++) {
        const [proj, t, dist] = this.projectPointToSegment(coord, line[i], line[i + 1]);
        if (dist < bestDist) {
          bestDist = dist;
          bestEdge = edge;
          // Normalized t för hela linjen
          bestT = (i + t) / (line.length - 1);
        }
      }
    }

    if (bestEdge && bestDist <= this.config.snapToleranceMeters) {
      return {
        type: type as any,
        id,
        originalId: id,
        elementId,
        coord,
        edgeId: `${bestEdge.fromNode}->${bestEdge.toNode}`,
        distanceAlongEdge: bestT,
        snapDistance: bestDist,
      };
    }
    return null;
  }

  private projectPointToSegment(p: Point3D, a: Point3D, b: Point3D): [Point3D, number, number] {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    if (len2 === 0) return [a, 0, this.dist(p, a)];

    let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
    t = Math.max(0, Math.min(1, t));

    const proj = { x: a.x + t * dx, y: a.y + t * dy, z: a.z + t * (b.z - a.z) };
    return [proj, t, this.dist(p, proj)];
  }

  private dist(a: Point3D, b: Point3D): number {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  private normalizeNummer(n: any): string {
    if (!n) return '';
    let s = String(n).trim().toUpperCase();
    // Ta bort "GBG " prefix
    s = s.replace(/^GBG\s+/i, '');
    // Ta bort suffixbokstäver
    s = s.replace(/[A-Z]+$/, '');
    return s;
  }

  getNodes() {
    return this.nodes;
  }

  getEdges() {
    return this.edges;
  }

  getSnappedObjects() {
    return this.snappedObjects;
  }

  getConfig() {
    return this.config;
  }

  findObjectById(id: string): SnappedObject | undefined {
    const norm = this.normalizeNummer(id);
    return this.snappedObjects.find((o) => o.id === norm);
  }

  /**
   * Hämta korrigerad längd för en länk baserat på längdmätningsdata
   * Om längdmätning finns, använd den. Annars fallback till link.length
   */
  getCorrectedLinkLength(link: Link): number {
    // FALLBACK: Använd link.length eftersom geografisk matchning är opålitlig
    return link.length;
  }

  /**
   * Hämta korrigerad längd för ett segment av en länk
   */
  getCorrectedSegmentLength(
    link: Link,
    startFraction: number,
    endFraction: number
  ): number {
    // FALLBACK: Använd link.length * fraction
    return link.length * Math.abs(endFraction - startFraction);
  }
}

