import type { Link, Node, Edge, SnappedObject, Config } from './types.js';
export declare class GraphBuilder {
    private nodes;
    private edges;
    private snappedObjects;
    private lengthManager;
    private config;
    buildFromGeoJSON(netLinks: any, netNodes: any, signals: any[], stoppbock: any[], vaxlar: any[], dcr: any[], lengthMeasurements?: any): void;
    private snapSignals;
    private snapStoppbock;
    private snapVaxlar;
    private snapDCR;
    private snapToEdge;
    private projectPointToSegment;
    private dist;
    private normalizeNummer;
    getNodes(): Map<string, Node>;
    getEdges(): Edge[];
    getSnappedObjects(): SnappedObject[];
    getConfig(): Config;
    findObjectById(id: string): SnappedObject | undefined;
    /**
     * Hämta korrigerad längd för en länk baserat på längdmätningsdata
     * Om längdmätning finns, använd den. Annars fallback till link.length
     */
    getCorrectedLinkLength(link: Link): number;
    /**
     * Hämta korrigerad längd för ett segment av en länk
     */
    getCorrectedSegmentLength(link: Link, startFraction: number, endFraction: number): number;
}
//# sourceMappingURL=graphBuilder.d.ts.map