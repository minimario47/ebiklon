export interface Point3D {
    x: number;
    y: number;
    z: number;
}
export interface Link {
    id: string;
    startNodeOid: string;
    endNodeOid: string;
    length: number;
    coords: Point3D[];
    elementId: string;
}
export interface Node {
    oid: string;
    coord: Point3D;
}
export interface Edge {
    fromNode: string;
    toNode: string;
    link: Link;
    reversed: boolean;
}
export interface Signal {
    nummer: string;
    elementId: string;
    coord: Point3D;
    riktning: '<' | '>' | '><';
}
export interface Stoppbock {
    nummer?: string;
    elementId: string;
    coord: Point3D;
}
export interface Vaxel {
    vaxelnr: string;
    elementId: string;
    coords: Point3D[];
}
export interface DCR {
    nummer: string;
    elementId: string;
    coord: Point3D;
}
export interface SnappedObject {
    type: 'signal' | 'stoppbock' | 'ssy' | 'poi' | 'dcr';
    id: string;
    originalId: string;
    elementId: string;
    coord: Point3D;
    edgeId: string;
    distanceAlongEdge: number;
    snapDistance: number;
}
export interface Path {
    edges: Edge[];
    totalLength: number;
    crossedObjects: CrossedObject[];
}
export interface CrossedObject {
    type: 'signal' | 'poi' | 'dcr' | 'tci' | 'ssy' | 'stoppbock';
    id: string;
    distanceAlongPath: number;
}
export interface Config {
    snapToleranceMeters: number;
    angleRejectDegMin: number;
    angleRejectDegMax: number;
    uTurnDeg: number;
    maxNodes: number;
    maxPathLengthMeters: number;
    kPathsPerPair: number;
    maxSearchRadiusMeters: number;
}
//# sourceMappingURL=types.d.ts.map