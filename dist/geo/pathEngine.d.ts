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
    private collectCrossedObjects;
    private mergePaths;
    private getObjectsOnEdge;
    private logNearbyObjects;
    /**
     * Validera att alla objekt i vägen är inom 1.5x direktavstånd från start
     */
    private validatePathSequence;
    /**
     * Print detailed path information for debugging
     */
    private printDetailedPath;
}
//# sourceMappingURL=pathEngine.d.ts.map