export class LengthMeasurementManager {
    constructor() {
        this.measurements = [];
        this.byElementId = new Map();
    }
    /**
     * Ladda längdmätningsdata från GeoJSON
     */
    loadFromGeoJSON(geojson) {
        console.log(`📏 Laddar längdmätningsdata...`);
        for (const feat of geojson.features) {
            const props = feat.properties;
            const coords = feat.geometry.coordinates.map((c) => ({
                x: c[0],
                y: c[1],
                z: c[2] || 0,
            }));
            const measurement = {
                id: props.id,
                elementId: props.ELEMENT_ID,
                konnektLangd: props.konnektLangd,
                startMeasure: props.START_MEASURE,
                endMeasure: props.END_MEASURE,
                lnkLangd: props.lnkLangd,
                skalfaktor: props.skalfaktor,
                coords,
                lgmKod: props.lgmKod,
                lgmNamn: props.lgmNamn,
                km: props.km,
                mFr: props.mFr,
                mTi: props.mTi,
                plsigFr: props.plsig_fr,
                plsigTi: props.plsig_ti,
                nodsigFr: props.nodsig_fr,
                nodsigTi: props.nodsig_ti,
            };
            this.measurements.push(measurement);
            // Indexera per elementId
            if (!this.byElementId.has(measurement.elementId)) {
                this.byElementId.set(measurement.elementId, []);
            }
            this.byElementId.get(measurement.elementId).push(measurement);
        }
        console.log(`✅ Laddade ${this.measurements.length} längdmätningar`);
        console.log(`   Täcker ${this.byElementId.size} unika element-ID:n`);
    }
    /**
     * Hitta längdmätning för en specifik länk (elementId)
     * och position (startMeasure till endMeasure)
     */
    findMeasurementForSegment(elementId, startPos, endPos) {
        const measurements = this.byElementId.get(elementId);
        if (!measurements || measurements.length === 0) {
            return null;
        }
        // Hitta alla mätningar som överlappar vårt segment
        let totalLength = 0;
        const [segStart, segEnd] = startPos < endPos ? [startPos, endPos] : [endPos, startPos];
        for (const m of measurements) {
            const [mStart, mEnd] = m.startMeasure < m.endMeasure
                ? [m.startMeasure, m.endMeasure]
                : [m.endMeasure, m.startMeasure];
            // Kolla om mätningen överlappar vårt segment
            if (mEnd > segStart && mStart < segEnd) {
                // Beräkna överlappande del
                const overlapStart = Math.max(segStart, mStart);
                const overlapEnd = Math.min(segEnd, mEnd);
                const overlapFraction = (overlapEnd - overlapStart) / (mEnd - mStart);
                totalLength += m.konnektLangd * overlapFraction;
            }
        }
        return totalLength > 0 ? totalLength : null;
    }
    /**
     * Beräkna längd för en hel länk
     */
    getLinkLength(elementId) {
        const measurements = this.byElementId.get(elementId);
        if (!measurements || measurements.length === 0) {
            return null;
        }
        // Summera alla mätningar för denna länk
        return measurements.reduce((sum, m) => sum + m.konnektLangd, 0);
    }
    /**
     * Hitta närmaste längdmätning till en koordinat
     */
    findNearestMeasurement(coord, maxDistance = 50) {
        let nearest = null;
        let minDist = maxDistance;
        for (const m of this.measurements) {
            for (const c of m.coords) {
                const dist = Math.sqrt(Math.pow(c.x - coord.x, 2) +
                    Math.pow(c.y - coord.y, 2));
                if (dist < minDist) {
                    minDist = dist;
                    nearest = m;
                }
            }
        }
        return nearest;
    }
    /**
     * Debug: Visa statistik
     */
    printStats() {
        console.log(`\n📊 Längdmätningsstatistik:`);
        console.log(`   Totalt antal mätningar: ${this.measurements.length}`);
        console.log(`   Unika element-ID:n: ${this.byElementId.size}`);
        // Hitta Göteborg-mätningar
        const goteborgMeasurements = this.measurements.filter(m => m.plsigFr === 'G' || m.plsigTi === 'G' || m.lgmNamn.includes('Göteborg'));
        console.log(`   Göteborg-relaterade: ${goteborgMeasurements.length}`);
        if (goteborgMeasurements.length > 0) {
            console.log(`\n   Exempel (första 3):`);
            for (let i = 0; i < Math.min(3, goteborgMeasurements.length); i++) {
                const m = goteborgMeasurements[i];
                console.log(`     ${m.plsigFr} → ${m.plsigTi}: ${m.konnektLangd.toFixed(1)}m (element: ${m.elementId.substring(0, 8)}...)`);
            }
        }
    }
}
//# sourceMappingURL=lengthMeasurement.js.map