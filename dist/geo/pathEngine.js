export class PathEngine {
    constructor(graph) {
        this.graph = graph;
    }
    /**
     * Hitta alla vägar från start till mål, med optional via-objekt.
     * Riktning bestäms av udda/jämn-regeln: jämna=norr (>0 Y), udda=söder (<0 Y).
     */
    findPaths(startId, endId, viaId) {
        const start = this.graph.findObjectById(startId);
        const end = this.graph.findObjectById(endId);
        if (!start || !end)
            return [];
        if (viaId) {
            const via = this.graph.findObjectById(viaId);
            if (!via)
                return [];
            // Dela i två sökningar
            const pathsA = this.searchPaths(start, via);
            const pathsB = this.searchPaths(via, end);
            // Kombinera
            const combined = [];
            for (const pA of pathsA) {
                for (const pB of pathsB) {
                    combined.push(this.mergePaths(pA, pB));
                }
            }
            return combined.slice(0, this.graph.getConfig().kPathsPerPair);
        }
        else {
            return this.searchPaths(start, end);
        }
    }
    searchPaths(start, end) {
        const cfg = this.graph.getConfig();
        const allPaths = [];
        console.log(`🔍 Söker väg: ${start.id} → ${end.id}`);
        // SPECIALFALL: Om start och mål är på samma kant, lägg till den direkta vägen
        if (start.edgeId === end.edgeId) {
            const edge = this.findEdgeBySnapped(start);
            if (edge) {
                const length = this.graph.getCorrectedSegmentLength(edge.link, start.distanceAlongEdge, end.distanceAlongEdge);
                const crossed = this.collectCrossedObjects([edge], start, end);
                console.log(`✅ Hittade direkt väg (samma kant): ${length.toFixed(0)}m`);
                allPaths.push({
                    edges: [edge],
                    totalLength: length,
                    crossedObjects: crossed,
                });
            }
        }
        // Använd DFS med mjukare begränsningar för att hitta vägar
        const dfsPaths = this.dfsSearch(start, end, cfg);
        allPaths.push(...dfsPaths);
        console.log(`✅ Hittade ${allPaths.length} vägar`);
        // Rankning och dedup
        allPaths.sort((a, b) => a.totalLength - b.totalLength);
        return allPaths.slice(0, cfg.kPathsPerPair);
    }
    dfs(current, target, startObj, pathSoFar, visitedState, lengthSoFar, results, cfg, depth, startParity) {
        // Pruning: Stoppa om vi har tillräckligt med vägar eller om vägen är för lång
        if (results.length >= cfg.kPathsPerPair)
            return;
        if (lengthSoFar > cfg.maxPathLengthMeters)
            return;
        if (pathSoFar.length > cfg.maxNodes)
            return;
        // Viktigt: markera besök med riktning (arrived via edge)
        const arriveKey = `${current.fromNode}->${current.toNode}`;
        if (visitedState.has(arriveKey))
            return; // cykel i samma riktning
        const newPath = [...pathSoFar, current];
        const newVisited = new Set(visitedState);
        newVisited.add(arriveKey);
        const isOnTargetEdge = this.isAtTarget(current, target);
        // Om vi är på målkanten, räkna bara längden fram till målet
        let edgeLengthToAdd;
        if (isOnTargetEdge) {
            const [tFrom, tTo] = target.edgeId.split('->');
            const goingForward = current.fromNode === tFrom && current.toNode === tTo;
            const goingReverse = current.fromNode === tTo && current.toNode === tFrom;
            // Använd korrigerad längd från längdmätningsdata
            if (goingForward) {
                edgeLengthToAdd = this.graph.getCorrectedSegmentLength(current.link, 0, target.distanceAlongEdge);
            }
            else if (goingReverse) {
                edgeLengthToAdd = this.graph.getCorrectedSegmentLength(current.link, target.distanceAlongEdge, 1);
            }
            else {
                edgeLengthToAdd = this.graph.getCorrectedLinkLength(current.link);
            }
        }
        else {
            // Använd korrigerad längd för hela länken
            edgeLengthToAdd = this.graph.getCorrectedLinkLength(current.link);
        }
        const newLength = lengthSoFar + edgeLengthToAdd;
        // Är vi vid målet?
        if (isOnTargetEdge) {
            const crossed = this.collectCrossedObjects(newPath, startObj, target);
            const signals = crossed.filter(o => o.type === 'signal');
            console.log(`  ✅ Väg ${results.length + 1}: ${newLength.toFixed(0)}m, ${signals.map(s => s.id).join(' → ')}`);
            const startObjInPath = crossed.some(o => o.id === startObj.id && o.type === startObj.type);
            if (startObjInPath) {
                results.push({
                    edges: newPath,
                    totalLength: newLength,
                    crossedObjects: crossed,
                });
            }
            return; // VIKTIGT: Stoppa denna gren av sökningen, vi har nått målet.
        }
        // Fortsätt BARA till grannar om vi INTE är på målkanten
        const neighbors = this.getNeighbors(current.toNode);
        for (const next of neighbors) {
            // Förbjud U-turn tillbaka samma kant direkt
            if (next.toNode === current.fromNode && next.link.id === current.link.id) {
                continue;
            }
            // Vinkelbegränsning: tillåt båda grenar från start-växlar, begränsa andra
            const angle = this.deflectionAngle(current, next);
            // U-turn ska alltid blockeras
            if (angle >= cfg.uTurnDeg) {
                console.log(`    ❌ U-turn blockerad: ${angle.toFixed(0)}°`);
                continue;
            }
            // För stora vinklar: tillåt endast vid växlar nära start
            if (angle > 60) {
                const atSwitch = this.isSwitchNode(current.toNode);
                const nearStart = pathSoFar.length <= 2; // Fösta 2 stegen från start
                if (!atSwitch || !nearStart) {
                    console.log(`    ❌ Stor vinkel blockerad: ${angle.toFixed(0)}° (växel: ${atSwitch}, nära start: ${nearStart})`);
                    continue;
                }
                else {
                    console.log(`    ✓ Stor vinkel tillåten vid växel: ${angle.toFixed(0)}°`);
                }
            }
            // Paritetsstyrning: tillfälligt avaktiverad för att testa
            // const firstParity = this.firstSignalParityOnEdge(next);
            // if (firstParity !== null && firstParity !== startParity) {
            //   continue;
            // }
            // Växelfilter med paritet: om växel finns vid denna nod, tillåt två val
            // när startsignalens paritet matchar växelns, annars begränsa inte (merge tillåten).
            // Här tillåter vi båda grenar – vårt vinkel/U-turn-filter skyddar ändå.
            this.dfs(next, target, startObj, newPath, newVisited, newLength, results, cfg, depth + 1, startParity);
        }
    }
    findEdgeBySnapped(obj) {
        const edges = this.graph.getEdges();
        const [from, to] = obj.edgeId.split('->');
        return edges.find((e) => e.fromNode === from && e.toNode === to) || null;
    }
    reverseEdge(edge) {
        return {
            fromNode: edge.toNode,
            toNode: edge.fromNode,
            link: edge.link,
            reversed: !edge.reversed,
        };
    }
    getDirectionFromNumber(nummer) {
        const n = parseInt(nummer, 10);
        if (isNaN(n))
            return 'any';
        return n % 2 === 0 ? 'north' : 'south';
    }
    checkStartDirection(edge, dir) {
        if (dir === 'any')
            return true;
        const line = edge.link.coords;
        const start = edge.reversed ? line[line.length - 1] : line[0];
        const next = edge.reversed ? line[line.length - 2] : line[1];
        if (!next)
            return true;
        const dy = next.y - start.y;
        if (dir === 'north')
            return dy > 0;
        if (dir === 'south')
            return dy < 0;
        return true;
    }
    checkArrivalDirection(edge, targetDir) {
        // För nu: acceptera alla ankomstriktningar
        // Korrekt logik kräver mer information om hur signaler är orienterade
        return true;
        /* Original strikt logik:
        if (targetDir === 'any') return true;
    
        const line = edge.link.coords;
        const end = edge.reversed ? line[0] : line[line.length - 1];
        const prev = edge.reversed ? line[1] : line[line.length - 2];
        if (!prev) return true;
    
        const dy = end.y - prev.y;
        // Ankomst bakifrån: om signal är norr, ska sista segment vara +Y
        if (targetDir === 'north') return dy > 0;
        if (targetDir === 'south') return dy < 0;
        return true;
        */
    }
    isAtTarget(edge, target) {
        // Kolla om vi är på samma kant som målet
        const [targetFrom, targetTo] = target.edgeId.split('->');
        // Måste vara på samma kant (antingen A→B eller B→A)
        const sameEdgeForward = edge.fromNode === targetFrom && edge.toNode === targetTo;
        const sameEdgeReverse = edge.fromNode === targetTo && edge.toNode === targetFrom;
        return sameEdgeForward || sameEdgeReverse;
    }
    getNeighbors(nodeOid) {
        return this.graph.getEdges().filter((e) => e.fromNode === nodeOid);
    }
    deflectionAngle(e1, e2) {
        const line1 = e1.link.coords;
        const line2 = e2.link.coords;
        // Sista segment av e1
        const a = e1.reversed ? line1[1] : line1[line1.length - 2];
        const b = e1.reversed ? line1[0] : line1[line1.length - 1];
        // Första segment av e2
        const c = e2.reversed ? line2[line2.length - 1] : line2[0];
        const d = e2.reversed ? line2[line2.length - 2] : line2[1];
        if (!a || !b || !c || !d)
            return 0;
        const v1 = { x: b.x - a.x, y: b.y - a.y };
        const v2 = { x: d.x - c.x, y: d.y - c.y };
        // Beräkna svängvinkel mellan "ut ur noden" och nästa riktning:
        // invertera v1 så att den pekar ut från noden (in-i nod -> ut-från nod)
        const v1f = { x: -v1.x, y: -v1.y };
        const dot = v1f.x * v2.x + v1f.y * v2.y;
        const mag1 = Math.sqrt(v1f.x * v1f.x + v1f.y * v1f.y);
        const mag2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);
        if (mag1 === 0 || mag2 === 0)
            return 0;
        const cosTheta = dot / (mag1 * mag2);
        const angle = Math.acos(Math.max(-1, Math.min(1, cosTheta))) * (180 / Math.PI);
        return angle;
    }
    isSwitchNode(nodeOid) {
        const edges = this.graph.getEdges();
        let out = 0;
        let incoming = 0;
        for (const e of edges) {
            if (e.fromNode === nodeOid)
                out++;
            if (e.toNode === nodeOid)
                incoming++;
        }
        // Med dubbla riktningar blir 2 normalt; >=3 antyder växel/kvist
        return out >= 3 || incoming >= 3;
    }
    firstSignalParityOnEdge(edge) {
        const edgeId = `${edge.fromNode}->${edge.toNode}`;
        const objs = this.getObjectsOnEdge(edge).filter(o => o.type === 'signal' && `${o.edgeId}` === edgeId);
        if (objs.length === 0)
            return null;
        objs.sort((a, b) => a.distanceAlongEdge - b.distanceAlongEdge);
        const num = parseInt(objs[0].id, 10);
        if (isNaN(num))
            return null;
        return num % 2;
    }
    collectCrossedObjects(path, startObj, endObj) {
        const objects = [];
        const snapped = this.graph.getSnappedObjects();
        const seen = new Set(); // Deduplicera baserat på type:id
        // VIKTIGT: Inkludera ALLA signaler på vägen, oavsett paritet (udda/jämn)
        // Paritet indikerar bara åt vilket håll signalen är vänd, inte vilket spår den är på
        // Tåget passerar fysiskt alla signaler på vägen
        for (const obj of snapped) {
            const [from, to] = obj.edgeId.split('->');
            const objKey = `${obj.type}:${obj.id}`;
            // Skippa om redan sett
            if (seen.has(objKey))
                continue;
            for (let i = 0; i < path.length; i++) {
                const edge = path[i];
                // Kolla både framåt och bakåt kant
                const matchForward = edge.fromNode === from && edge.toNode === to;
                const matchReverse = edge.fromNode === to && edge.toNode === from;
                if (matchForward || matchReverse) {
                    const distanceAlongPath = i + obj.distanceAlongEdge;
                    // För samma-kant-fall: filtrera baserat på position mellan start och slut
                    if (startObj && endObj && path.length === 1 && i === 0) {
                        const [startFrom, startTo] = startObj.edgeId.split('->');
                        const sameEdge = (from === startFrom && to === startTo) || (from === startTo && to === startFrom);
                        if (sameEdge) {
                            const minPos = Math.min(startObj.distanceAlongEdge, endObj.distanceAlongEdge);
                            const maxPos = Math.max(startObj.distanceAlongEdge, endObj.distanceAlongEdge);
                            // Inkludera bara objekt mellan start och slut
                            if (obj.distanceAlongEdge < minPos || obj.distanceAlongEdge > maxPos) {
                                break;
                            }
                        }
                    }
                    else {
                        // Filtrera bort objekt som är FÖRE start-objektet på första kanten
                        if (startObj && i === 0) {
                            const [startFrom, startTo] = startObj.edgeId.split('->');
                            const sameEdge = (from === startFrom && to === startTo) || (from === startTo && to === startFrom);
                            if (sameEdge && obj.distanceAlongEdge < startObj.distanceAlongEdge) {
                                // Objektet är bakom startsignalen
                                break;
                            }
                        }
                        // Filtrera bort objekt som är EFTER mål-objektet på sista kanten
                        if (endObj && i === path.length - 1) {
                            const [endFrom, endTo] = endObj.edgeId.split('->');
                            const sameEdge = (from === endFrom && to === endTo) || (from === endTo && to === endFrom);
                            // Inkludera BARA objekt på sista kanten som är FÖRE eller PRECIS PÅ målet
                            if (sameEdge && obj.distanceAlongEdge > endObj.distanceAlongEdge) {
                                continue; // Hoppa över detta objekt, det är efter målet
                            }
                        }
                    }
                    objects.push({
                        type: obj.type,
                        id: obj.id,
                        distanceAlongPath,
                    });
                    seen.add(objKey);
                    break;
                }
            }
        }
        // Sortera efter distans
        objects.sort((a, b) => a.distanceAlongPath - b.distanceAlongPath);
        return objects;
    }
    mergePaths(a, b) {
        return {
            edges: [...a.edges, ...b.edges],
            totalLength: a.totalLength + b.totalLength,
            crossedObjects: [...a.crossedObjects, ...b.crossedObjects].sort((x, y) => x.distanceAlongPath - y.distanceAlongPath),
        };
    }
    getObjectsOnEdge(edge) {
        const snapped = this.graph.getSnappedObjects();
        const edgeId = `${edge.fromNode}->${edge.toNode}`;
        const edgeIdRev = `${edge.toNode}->${edge.fromNode}`;
        return snapped.filter(obj => obj.edgeId === edgeId || obj.edgeId === edgeIdRev);
    }
    logNearbyObjects(coord, label) {
        const snapped = this.graph.getSnappedObjects();
        const nearby = snapped
            .map(obj => ({
            obj,
            dist: Math.sqrt(Math.pow(obj.coord.x - coord.x, 2) +
                Math.pow(obj.coord.y - coord.y, 2))
        }))
            .filter(item => item.dist < 100) // Inom 100m
            .sort((a, b) => a.dist - b.dist)
            .slice(0, 10);
        console.log(`\n📍 Närliggande objekt vid ${label} (inom 100m):`);
        for (const { obj, dist } of nearby) {
            console.log(`   ${obj.type.toUpperCase()} ${obj.id} - ${dist.toFixed(0)}m bort`);
        }
    }
    dijkstraSearch(start, end, cfg) {
        const paths = [];
        // K-snabbaste vägar: håll koll på flera vägar till varje nod
        const bestPaths = new Map();
        const visited = new Set();
        const queue = [];
        // Start från båda noderna på startkanten
        const [startFrom, startTo] = start.edgeId.split('->');
        const startNodes = [startFrom, startTo];
        for (const startNode of startNodes) {
            bestPaths.set(startNode, [{ distance: 0, path: [] }]);
            queue.push({ nodeId: startNode, distance: 0, path: [] });
        }
        let iterations = 0;
        while (queue.length > 0 && paths.length < cfg.kPathsPerPair && iterations < 100) {
            iterations++;
            // Hitta noden med kortast avstånd
            queue.sort((a, b) => a.distance - b.distance);
            const current = queue.shift();
            if (iterations <= 10) {
                console.log(`  Iteration ${iterations}: Besöker nod ${current.nodeId.substring(0, 8)}... (${current.distance.toFixed(0)}m, ${current.path.length} kanter)`);
            }
            // Kontrollera om vi har nått målet
            const isAtTarget = this.isAtTargetNode(current.nodeId, end);
            if (isAtTarget) {
                console.log(`🎯 Nådde mål vid nod ${current.nodeId.substring(0, 8)}... med ${current.path.length} kanter`);
                if (current.path.length > 0) {
                    const crossed = this.collectCrossedObjects(current.path, start, end);
                    paths.push({
                        edges: current.path,
                        totalLength: current.distance,
                        crossedObjects: crossed,
                    });
                }
                continue;
            }
            // Debug: visa om vi är nära målet
            const [targetFrom, targetTo] = end.edgeId.split('->');
            if (current.nodeId === targetFrom || current.nodeId === targetTo) {
                console.log(`  🔍 Nära mål: nod ${current.nodeId.substring(0, 8)}... (målnoder: ${targetFrom.substring(0, 8)}..., ${targetTo.substring(0, 8)}...)`);
            }
            // Markera som besökt om vi redan har tillräckligt många vägar till denna nod
            const nodePaths = bestPaths.get(current.nodeId) || [];
            if (nodePaths.length >= 3) { // Max 3 vägar per nod
                visited.add(current.nodeId);
            }
            if (visited.has(current.nodeId))
                continue;
            // Utforska grannar
            const neighbors = this.getNeighbors(current.nodeId);
            for (const edge of neighbors) {
                // Beräkna nytt avstånd
                const edgeLength = this.graph.getCorrectedLinkLength(edge.link);
                const newDistance = current.distance + edgeLength;
                // Kontrollera vinkelbegränsning - tillfälligt avaktiverad för debugging
                // if (current.path.length > 0) {
                //   const lastEdge = current.path[current.path.length - 1];
                //   const angle = this.deflectionAngle(lastEdge, edge);
                //   
                //   // Blockera U-turns och för stora vinklar
                //   if (angle >= cfg.uTurnDeg) continue;
                //   if (angle > 90 && current.path.length > 2) continue; // Tillåt stora vinklar nära start
                // }
                const newPath = [...current.path, edge];
                const existingPaths = bestPaths.get(edge.toNode) || [];
                // Lägg till ny väg om den är tillräckligt bra
                if (existingPaths.length < 3 || newDistance < existingPaths[existingPaths.length - 1].distance) {
                    const updatedPaths = [...existingPaths, { distance: newDistance, path: newPath }]
                        .sort((a, b) => a.distance - b.distance)
                        .slice(0, 3); // Behåll bara de 3 bästa
                    bestPaths.set(edge.toNode, updatedPaths);
                    queue.push({ nodeId: edge.toNode, distance: newDistance, path: newPath });
                }
            }
        }
        return paths;
    }
    isAtTargetNode(nodeId, target) {
        const [targetFrom, targetTo] = target.edgeId.split('->');
        return nodeId === targetFrom || nodeId === targetTo;
    }
    dfsSearch(start, end, cfg) {
        const paths = [];
        // Start från båda noderna på startkanten
        const [startFrom, startTo] = start.edgeId.split('->');
        const startNodes = [startFrom, startTo];
        for (const startNode of startNodes) {
            const outgoing = this.getNeighbors(startNode);
            for (const edge of outgoing) {
                this.dfsSimple(edge, end, start, [edge], new Set([startNode]), 0, paths, cfg, 0);
            }
        }
        return paths;
    }
    dfsSimple(current, target, startObj, pathSoFar, visitedNodes, lengthSoFar, results, cfg, depth) {
        // Pruning
        if (results.length >= cfg.kPathsPerPair)
            return;
        if (lengthSoFar > cfg.maxPathLengthMeters)
            return;
        if (pathSoFar.length > cfg.maxNodes)
            return;
        if (depth > 20)
            return; // Max djup för att undvika oändliga loopar
        const edgeLength = this.graph.getCorrectedLinkLength(current.link);
        const newLength = lengthSoFar + edgeLength;
        // Kontrollera om vi har nått målet
        const isOnTargetEdge = this.isAtTarget(current, target);
        if (isOnTargetEdge) {
            const crossed = this.collectCrossedObjects(pathSoFar, startObj, target);
            results.push({
                edges: pathSoFar,
                totalLength: newLength,
                crossedObjects: crossed,
            });
            return;
        }
        // Utforska grannar
        const neighbors = this.getNeighbors(current.toNode);
        for (const next of neighbors) {
            if (visitedNodes.has(next.toNode))
                continue;
            // Inga begränsningar för debugging
            // if (pathSoFar.length > 0) {
            //   const lastEdge = pathSoFar[pathSoFar.length - 1];
            //   const angle = this.deflectionAngle(lastEdge, next);
            //   if (angle >= 170) continue; // Blockera bara U-turns
            // }
            const newVisited = new Set(visitedNodes);
            newVisited.add(next.toNode);
            this.dfsSimple(next, target, startObj, [...pathSoFar, next], newVisited, newLength, results, cfg, depth + 1);
        }
    }
}
//# sourceMappingURL=pathEngine.js.map