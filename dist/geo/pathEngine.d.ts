import type { Path } from './types.js';
import { GraphBuilder } from './graphBuilder.js';
export declare class PathEngine {
    private graph;
    constructor(graph: GraphBuilder);
    /**
     * Hitta alla vägar från start till mål, med optional via-objekt.
     * Riktning bestäms av udda/jämn-regeln: jämna=norr (>0 Y), udda=söder (<0 Y).
     */
    findPaths(startId: string, endId: string, viaId?: string): Path[];
    private searchPaths;
    private dfs;
    private findEdgeBySnapped;
    private reverseEdge;
    private getDirectionFromNumber;
    private checkStartDirection;
    private checkArrivalDirection;
    private isAtTarget;
    private getNeighbors;
    private deflectionAngle;
    private isSwitchNode;
    private firstSignalParityOnEdge;
    private collectCrossedObjects;
    private mergePaths;
    private getObjectsOnEdge;
    private logNearbyObjects;
    private dijkstraSearch;
    private isAtTargetNode;
    private dfsSearch;
    private dfsSimple;
}
//# sourceMappingURL=pathEngine.d.ts.map