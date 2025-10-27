// Gemensamma typer för vägsökning

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

// Graf – både riktningar för varje länk
export interface Edge {
  fromNode: string;
  toNode: string;
  link: Link;
  reversed: boolean;  // Om B→A istället för A→B
}

export interface Signal {
  nummer: string;
  elementId: string;
  coord: Point3D;
  riktning: '<' | '>' | '><';  // mot, med, dubbelriktad
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

// Snappat objekt med projekterad position på graf
export interface SnappedObject {
  type: 'signal' | 'stoppbock' | 'ssy' | 'poi' | 'dcr';
  id: string;  // Nummer normaliserat
  originalId: string;
  elementId: string;
  coord: Point3D;
  // Snappning
  edgeId: string;  // edge-id (from→to)
  distanceAlongEdge: number;  // 0-1
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
  maxSearchRadiusMeters: number;  // Bird's eye radius limit
}

