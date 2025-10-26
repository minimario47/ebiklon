/**
 * PathEngine V2 - Edge-based Dijkstra pathfinding
 * Implementerar Stack Overflow-lösningen: edge-state tracking istället för node-only
 */
export class PathEngineV2 {
    constructor(graph) {
        this.graph = graph;
    }
    /**
     * Hitta alla vägar mellan två signaler/objekt
     */
    findPaths(startId, endId) {
        const start = this.graph.findObjectById(startId);
        const end = this.graph.findObjectById(endId);
        if (!start || !end) {
            console.error(`Kan inte hitta objekt: ${startId} eller ${endId}`);
            return [];
        }
        console.log(`\n🚂 PathEngine V2: ${start.id} → ${end.id}`);
        console.log(`   Start: ${start.type} på kant ${start.edgeId}`);
        console.log(`   Slut: ${end.type} på kant ${end.edgeId}`);
        return this.dijkstraSearch(start, end);
    }
    /**
     * Dijkstra-sökning med edge-state tracking
     */
    dijkstraSearch(start, end) {
        const allPaths = [];
        const trainParity = this.getObjectParity(start);
        console.log(`   Tågparitet: ${trainParity} (${trainParity === 'even' ? 'JÄMN' : 'UDDA'})`);
        // Priority queue (sorterad efter längd)
        const openSet = [];
        const visited = new Set();
        // Hitta startkant och startnod
        const startEdge = this.findEdgeBySnapped(start);
        if (!startEdge) {
            console.error('Kan inte hitta startkant');
            return [];
        }
        // Starta från båda noderna på startkanten
        const [fromNode, toNode] = start.edgeId.split('->');
        const nodes = [fromNode, toNode];
        for (const startNode of nodes) {
            const partialLength = this.getPartialLengthToNode(start, startNode, startEdge);
            openSet.push({
                currentNode: startNode,
                arrivedViaEdge: startEdge,
                pathSoFar: [startEdge],
                lengthSoFar: partialLength,
                crossedObjects: []
            });
        }
        let iterations = 0;
        const maxIterations = 5000;
        const maxPathLength = 3000; // Max 3km väg
        while (openSet.length > 0 && iterations < maxIterations) {
            iterations++;
            // Sortera och ta minsta
            openSet.sort((a, b) => a.lengthSoFar - b.lengthSoFar);
            const current = openSet.shift();
            // Skippa för långa vägar
            if (current.lengthSoFar > maxPathLength) {
                continue;
            }
            // Är vi framme?
            if (this.isAtTarget(current, end)) {
                const path = this.reconstructPath(current, start, end);
                allPaths.push(path);
                console.log(`   ✅ Väg ${allPaths.length}: ${path.totalLength.toFixed(0)}m`);
                // Hitta max 5 vägar
                if (allPaths.length >= 5)
                    break;
                continue;
            }
            // State key: node + riktning vi kom från
            const stateKey = current.arrivedViaEdge
                ? `${current.currentNode}:${current.arrivedViaEdge.fromNode}->${current.arrivedViaEdge.toNode}`
                : current.currentNode;
            if (visited.has(stateKey))
                continue;
            visited.add(stateKey);
            // Hitta utgående kanter
            const outgoingEdges = this.graph.getEdges().filter(e => e.fromNode === current.currentNode);
            for (const nextEdge of outgoingEdges) {
                // Kolla om övergången är tillåten
                if (!this.canTransition(current.arrivedViaEdge, nextEdge, trainParity)) {
                    continue;
                }
                // Beräkna ny längd
                const edgeLength = this.isTargetEdge(nextEdge, end)
                    ? this.getPartialLengthToObject(end, nextEdge)
                    : this.graph.getCorrectedLinkLength(nextEdge.link);
                const newLength = current.lengthSoFar + edgeLength;
                // Samla korsade objekt på denna kant
                const objectsOnEdge = this.collectObjectsOnEdge(nextEdge, trainParity);
                openSet.push({
                    currentNode: nextEdge.toNode,
                    arrivedViaEdge: nextEdge,
                    pathSoFar: [...current.pathSoFar, nextEdge],
                    lengthSoFar: newLength,
                    crossedObjects: [...current.crossedObjects, ...objectsOnEdge]
                });
            }
        }
        console.log(`   Iterationer: ${iterations}, Hittade ${allPaths.length} vägar`);
        return allPaths;
    }
    /**
     * Kolla om vi kan göra övergången från en kant till nästa
     */
    canTransition(fromEdge, toEdge, trainParity) {
        if (!fromEdge)
            return true;
        // Förbjud U-turns (gå tillbaka samma väg)
        if (toEdge.toNode === fromEdge.fromNode) {
            return false;
        }
        // Förbjud skarpa svängar (>120° = U-turn, 80-100° = 90°)
        const angle = this.calculateAngle(fromEdge, toEdge);
        if (angle > 120 || (angle > 80 && angle < 100)) {
            return false;
        }
        return true;
    }
    /**
     * Beräkna vinkel mellan två kanter
     */
    calculateAngle(edge1, edge2) {
        const coords1 = edge1.link.coords;
        const coords2 = edge2.link.coords;
        if (coords1.length < 2 || coords2.length < 2)
            return 0;
        // Riktning för edge1 (sista segmentet)
        const p1 = coords1[coords1.length - 2];
        const p2 = coords1[coords1.length - 1];
        const v1 = { x: p2.x - p1.x, y: p2.y - p1.y };
        // Riktning för edge2 (första segmentet)
        const p3 = coords2[0];
        const p4 = coords2[1];
        const v2 = { x: p4.x - p3.x, y: p4.y - p3.y };
        // Beräkna vinkel
        const dot = v1.x * v2.x + v1.y * v2.y;
        const len1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
        const len2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);
        if (len1 === 0 || len2 === 0)
            return 0;
        const cosTheta = dot / (len1 * len2);
        const angle = Math.acos(Math.max(-1, Math.min(1, cosTheta))) * (180 / Math.PI);
        return angle;
    }
    /**
     * Samla objekt på en kant (signaler, växlar, DCR, TCI)
     */
    collectObjectsOnEdge(edge, trainParity) {
        const objects = [];
        const edgeId = `${edge.fromNode}->${edge.toNode}`;
        const snapped = this.graph.getSnappedObjects();
        for (const obj of snapped) {
            if (obj.edgeId !== edgeId)
                continue;
            // För signaler: bara inkludera de med rätt paritet
            if (obj.type === 'signal') {
                const objParity = this.getObjectParity(obj);
                if (objParity !== trainParity) {
                    continue; // Motsignal, föraren ser bara baksidan
                }
            }
            // Inkludera alla typer: signal, poi (växel), dcr, tci (spårledning)
            objects.push({
                type: obj.type,
                id: obj.id,
                coord: obj.coord
            });
        }
        return objects;
    }
    /**
     * Kolla om vi är på målkanten
     */
    isAtTarget(state, target) {
        if (!state.arrivedViaEdge)
            return false;
        const currentEdgeId = `${state.arrivedViaEdge.fromNode}->${state.arrivedViaEdge.toNode}`;
        return currentEdgeId === target.edgeId;
    }
    /**
     * Kolla om en kant är målkanten
     */
    isTargetEdge(edge, target) {
        const edgeId = `${edge.fromNode}->${edge.toNode}`;
        return edgeId === target.edgeId;
    }
    /**
     * Rekonstruera väg från search state
     */
    reconstructPath(state, start, end) {
        // Filtrera och sortera korsade objekt
        const allObjects = state.crossedObjects;
        const seen = new Set();
        const unique = [];
        for (const obj of allObjects) {
            const key = `${obj.type}:${obj.id}`;
            if (!seen.has(key)) {
                seen.add(key);
                unique.push(obj);
            }
        }
        // Lägg till start och slut
        unique.unshift({ type: start.type, id: start.id, coord: start.coord });
        unique.push({ type: end.type, id: end.id, coord: end.coord });
        return {
            edges: state.pathSoFar,
            totalLength: state.lengthSoFar,
            crossedObjects: unique
        };
    }
    /**
     * Hitta kant från snapped object
     */
    findEdgeBySnapped(obj) {
        const [from, to] = obj.edgeId.split('->');
        return this.graph.getEdges().find(e => e.fromNode === from && e.toNode === to) || null;
    }
    /**
     * Beräkna partiell längd från object till nod
     */
    getPartialLengthToNode(obj, targetNode, edge) {
        const [from, to] = obj.edgeId.split('->');
        if (targetNode === to) {
            // Gå framåt till toNode
            return this.graph.getCorrectedSegmentLength(edge.link, obj.distanceAlongEdge, 1.0);
        }
        else {
            // Gå bakåt till fromNode
            return this.graph.getCorrectedSegmentLength(edge.link, 0.0, obj.distanceAlongEdge);
        }
    }
    /**
     * Beräkna partiell längd till object på kant
     */
    getPartialLengthToObject(obj, edge) {
        return this.graph.getCorrectedSegmentLength(edge.link, 0.0, obj.distanceAlongEdge);
    }
    /**
     * Hämta paritet för objekt (jämn/udda)
     */
    getObjectParity(obj) {
        const num = parseInt(obj.id, 10);
        if (isNaN(num))
            return 'even';
        return num % 2 === 0 ? 'even' : 'odd';
    }
}
//# sourceMappingURL=pathEngineV2.js.map