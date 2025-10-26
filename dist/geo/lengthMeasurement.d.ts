import type { Point3D } from './types.js';
/**
 * Längdmätningsdata från langdmatning.geojson
 * Innehåller exakta längder mellan punkter på spåret
 */
export interface LengthMeasurement {
    id: number;
    elementId: string;
    konnektLangd: number;
    startMeasure: number;
    endMeasure: number;
    lnkLangd: number;
    skalfaktor: number;
    coords: Point3D[];
    lgmKod: string;
    lgmNamn: string;
    km: number;
    mFr: number;
    mTi: number;
    plsigFr: string;
    plsigTi: string;
    nodsigFr: string;
    nodsigTi: string;
}
export declare class LengthMeasurementManager {
    private measurements;
    private byElementId;
    /**
     * Ladda längdmätningsdata från GeoJSON
     */
    loadFromGeoJSON(geojson: any): void;
    /**
     * Hitta längdmätning för en specifik länk (elementId)
     * och position (startMeasure till endMeasure)
     */
    findMeasurementForSegment(elementId: string, startPos: number, endPos: number): number | null;
    /**
     * Beräkna längd för en hel länk
     */
    getLinkLength(elementId: string): number | null;
    /**
     * Hitta närmaste längdmätning till en koordinat
     */
    findNearestMeasurement(coord: Point3D, maxDistance?: number): LengthMeasurement | null;
    /**
     * Debug: Visa statistik
     */
    printStats(): void;
}
//# sourceMappingURL=lengthMeasurement.d.ts.map