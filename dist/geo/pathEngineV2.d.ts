/**
 * PathEngine V2 - Edge-based Dijkstra pathfinding
 * Implementerar Stack Overflow-lösningen: edge-state tracking istället för node-only
 */
import { GraphBuilder } from './graphBuilder.js';
import { Path } from './types.js';
export declare class PathEngineV2 {
    private graph;
    constructor(graph: GraphBuilder);
    /**
     * Hitta alla vägar mellan två signaler/objekt
     */
    findPaths(startId: string, endId: string): Path[];
    /**
     * Dijkstra-sökning med edge-state tracking
     */
    private dijkstraSearch;
    /**
     * Kolla om vi kan göra övergången från en kant till nästa
     */
    private canTransition;
    /**
     * Beräkna vinkel mellan två kanter
     */
    private calculateAngle;
    /**
     * Samla objekt på en kant (signaler, växlar, DCR, TCI)
     */
    private collectObjectsOnEdge;
    /**
     * Kolla om vi är på målkanten
     */
    private isAtTarget;
    /**
     * Kolla om en kant är målkanten
     */
    private isTargetEdge;
    /**
     * Rekonstruera väg från search state
     */
    private reconstructPath;
    /**
     * Hitta kant från snapped object
     */
    private findEdgeBySnapped;
    /**
     * Beräkna partiell längd från object till nod
     */
    private getPartialLengthToNode;
    /**
     * Beräkna partiell längd till object på kant
     */
    private getPartialLengthToObject;
    /**
     * Hämta paritet för objekt (jämn/udda)
     */
    private getObjectParity;
}
//# sourceMappingURL=pathEngineV2.d.ts.map