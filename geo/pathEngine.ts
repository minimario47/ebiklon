import type { Edge, Node, SnappedObject, Path, CrossedObject, Config, Point3D } from './types.js';
import { GraphBuilder } from './graphBuilder.js';

export class PathEngine {
  constructor(private graph: GraphBuilder) {}

  /**
   * Hitta alla vägar från start till mål, med optional via-objekt.
   * Riktning bestäms av udda/jämn-regeln: jämna=norr (>0 Y), udda=söder (<0 Y).
   */
  findPaths(startId: string, endId: string, viaId?: string): Path[] {
    const start = this.graph.findObjectById(startId);
    const end = this.graph.findObjectById(endId);
    if (!start || !end) return [];

    if (viaId) {
      const via = this.graph.findObjectById(viaId);
      if (!via) return [];

      // Dela i två sökningar
      const pathsA = this.searchPaths(start, via);
      const pathsB = this.searchPaths(via, end);

      // Kombinera
      const combined: Path[] = [];
      for (const pA of pathsA) {
        for (const pB of pathsB) {
          combined.push(this.mergePaths(pA, pB));
        }
      }
      return combined.slice(0, this.graph.getConfig().kPathsPerPair);
    } else {
      return this.searchPaths(start, end);
    }
  }

  private searchPaths(start: SnappedObject, end: SnappedObject): Path[] {
    const cfg = this.graph.getConfig();
    const allPaths: Path[] = [];
    const pathSignatures = new Set<string>(); // För att undvika duplicerade vägar

    console.log(`🔍 Söker väg: ${start.id} → ${end.id}`);
    
    // Beräkna bird's eye avstånd för radius-kontroll
    const directDistance = this.graph.getBirdEyeDistance(start.coord, end.coord);
    const maxRadius = Math.max(cfg.maxSearchRadiusMeters, directDistance * 1.5); // Minst 1.5x direktavstånd
    
    console.log(`📏 Direktavstånd: ${directDistance.toFixed(0)}m, max sökradius: ${maxRadius.toFixed(0)}m`);
    
    // SPECIALFALL: Om start och mål är på samma kant, lägg till den direkta vägen
    if (start.edgeId === end.edgeId) {
      const edge = this.findEdgeBySnapped(start);
      if (edge) {
        const length = this.graph.getCorrectedSegmentLength(
          edge.link,
          start.distanceAlongEdge,
          end.distanceAlongEdge
        );
        const crossed = this.collectCrossedObjects([edge], start, end);
        
        // Skapa signatur för direktvägen
        const pathSignature = `${edge.fromNode}→${edge.toNode}:${edge.link.id}`;
        if (!pathSignatures.has(pathSignature)) {
          console.log(`✅ Hittade direkt väg (samma kant): ${length.toFixed(0)}m`);
          pathSignatures.add(pathSignature);
          allPaths.push({
            edges: [edge],
            totalLength: length,
            crossedObjects: crossed,
          });
        }
      }
    }
    
    // Startnod är där objektet är snappat
    const [startFrom, startTo] = start.edgeId.split('->');
    
    // VIKTIGT: Sök från BÅDA noderna på startkanten för att hitta alla vägar
    const startNodes = [startFrom, startTo];
    
    // Hitta start-kanten (där start-objektet ligger)
    const startEdge = this.findEdgeBySnapped(start);
    if (!startEdge) {
      console.log('❌ Kunde inte hitta start-kant');
      return [];
    }

    for (const nodeOid of startNodes) {
      const outgoing = this.getNeighbors(nodeOid);
      // console.log(`\n  Nod ${nodeOid.substring(0, 8)}... har ${outgoing.length} utgående kanter`);

      let validCount = 0;
      for (const edge of outgoing) {
        // Udda/jämn är INTE geografisk riktning - det är vilken sida av spåret!
        // Ingen riktningsfiltrering behövs här.

        validCount++;
        // if (validCount <= 3) {
        //   const nearbyOnEdge = this.getObjectsOnEdge(edge);
        //   console.log(`    ✓ Kant ${validCount}: ${edge.link.length.toFixed(0)}m → nod ${edge.toNode.substring(0, 8)}...`);
        //   if (nearbyOnEdge.length > 0) {
        //     console.log(`      Objekt på kant: ${nearbyOnEdge.map(o => `${o.type}:${o.id}`).join(', ')}`);
        //   }
        // }

        // Börja med start-kanten i vägen
        // Räkna bara längden från start-objektets position till den start-nod vi faktiskt går mot
        const [sFrom, sTo] = start.edgeId.split('->');
        const startTowardFrom = nodeOid === sFrom;
        
        // Använd korrigerad längd från längdmätningsdata
        const startEdgePartialLength = startTowardFrom
          ? this.graph.getCorrectedSegmentLength(startEdge.link, 0, start.distanceAlongEdge)
          : this.graph.getCorrectedSegmentLength(startEdge.link, start.distanceAlongEdge, 1);
        
        this.dfs(edge, end, start, [startEdge], new Set([nodeOid]), startEdgePartialLength, allPaths, cfg, 0, start.coord, end.coord, maxRadius, directDistance, pathSignatures);
      }
      
      // if (validCount > 3) {
      //   console.log(`    ... och ${validCount - 3} till`);
      // }
      // if (validCount === 0) {
      //   console.log(`    ❌ Inga giltiga kanter (riktningsfilter blockerade alla)`);
      // }
    }

    console.log(`✅ Hittade ${allPaths.length} vägar`);

    // Rankning och dedup
    allPaths.sort((a, b) => a.totalLength - b.totalLength);
    return allPaths.slice(0, cfg.kPathsPerPair);
  }

  private dfs(
    current: Edge,
    target: SnappedObject,
    startObj: SnappedObject,
    pathSoFar: Edge[],
    visitedState: Set<string>,
    lengthSoFar: number,
    results: Path[],
    cfg: Config,
    depth: number,
    startCoord: Point3D,
    endCoord: Point3D,
    maxRadius: number,
    directDistance: number,
    pathSignatures: Set<string>
  ) {
    // Pruning: Stoppa om vi har tillräckligt med vägar eller om vägen är för lång
    if (results.length >= cfg.kPathsPerPair) return;
    if (lengthSoFar > cfg.maxPathLengthMeters) return;
    if (pathSoFar.length > cfg.maxNodes) return;
    
    // Radius-kontroll: Stoppa om vi är för långt från start- eller målpunkt
    const currentNode = this.graph.getNodes().get(current.toNode);
    if (currentNode) {
      const distFromStart = this.graph.getBirdEyeDistance(startCoord, currentNode.coord);
      const distFromEnd = this.graph.getBirdEyeDistance(endCoord, currentNode.coord);
      if (distFromStart > maxRadius || distFromEnd > maxRadius) {
        return; // För långt bort
      }
    }
    
    // Viktigt: markera besök med riktning (arrived via edge)
    const arriveKey = `${current.fromNode}->${current.toNode}`;
    if (visitedState.has(arriveKey)) return; // cykel i samma riktning

    const newPath = [...pathSoFar, current];
    const newVisited = new Set(visitedState);
    newVisited.add(arriveKey);
    
    const isOnTargetEdge = this.isAtTarget(current, target);
    
    // Om vi är på målkanten, räkna bara längden fram till målet
    let edgeLengthToAdd: number;
    if (isOnTargetEdge) {
      const [tFrom, tTo] = target.edgeId.split('->');
      const goingForward = current.fromNode === tFrom && current.toNode === tTo;
      const goingReverse = current.fromNode === tTo && current.toNode === tFrom;
      
      // Använd korrigerad längd från längdmätningsdata
      if (goingForward) {
        edgeLengthToAdd = this.graph.getCorrectedSegmentLength(current.link, 0, target.distanceAlongEdge);
      } else if (goingReverse) {
        edgeLengthToAdd = this.graph.getCorrectedSegmentLength(current.link, target.distanceAlongEdge, 1);
      } else {
        edgeLengthToAdd = this.graph.getCorrectedLinkLength(current.link);
      }
    } else {
      // Använd korrigerad längd för hela länken
      edgeLengthToAdd = this.graph.getCorrectedLinkLength(current.link);
    }
    
    const newLength = lengthSoFar + edgeLengthToAdd;

    // Är vi vid målet?
    if (isOnTargetEdge) {
      const crossed = this.collectCrossedObjects(newPath, startObj, target);
      const signals = crossed.filter(o => o.type === 'signal');
      
      // Validera att alla objekt i vägen är inom 1.5x direktavstånd från start
      if (!this.validatePathSequence(crossed, startCoord, directDistance)) {
        console.log(`  ❌ Väg avvisad: objekt för långt från start`);
        return;
      }
      
      // Skapa en unik signatur för vägen baserat på kanter
      const pathSignature = newPath.map(e => `${e.fromNode}→${e.toNode}:${e.link.id}`).join('|');
      
      // Kontrollera om denna väg redan finns
      if (pathSignatures.has(pathSignature)) {
        console.log(`  ❌ Duplicerad väg avvisad: ${newLength.toFixed(0)}m`);
        return;
      }
      
      // Debug: Print detailed path information
      console.log(`  ✅ Väg ${results.length + 1}: ${newLength.toFixed(0)}m, ${signals.map(s => s.id).join(' → ')}`);
      this.printDetailedPath(newPath, crossed, startCoord);
      
      const startObjInPath = crossed.some(o => o.id === startObj.id && o.type === startObj.type);
      if (startObjInPath) {
        pathSignatures.add(pathSignature);
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
      
      // Förbjud att gå igenom samma kant två gånger i rad
      if (pathSoFar.length > 0 && next.link.id === current.link.id) {
        continue;
      }
      // Vinkelfilter
      if (pathSoFar.length > 0) {
        const angle = this.deflectionAngle(current, next);
        if (angle >= cfg.angleRejectDegMin && angle <= cfg.angleRejectDegMax) {
          if (depth < 3) {
            console.log(`    ⚠️ Blockerad ~90° vinkel (${angle.toFixed(0)}°)`);
          }
          continue;
        }
        if (angle >= cfg.uTurnDeg) {
          if (depth < 3) {
            console.log(`    ⚠️ Blockerad U-turn (${angle.toFixed(0)}°)`);
          }
          continue;
        }
      }

      // Växelfilter med paritet: om växel finns vid denna nod, tillåt två val
      // när startsignalens paritet matchar växelns, annars begränsa inte (merge tillåten).
      // Här tillåter vi båda grenar – vårt vinkel/U-turn-filter skyddar ändå.
      this.dfs(next, target, startObj, newPath, newVisited, newLength, results, cfg, depth + 1, startCoord, endCoord, maxRadius, directDistance, pathSignatures);
    }
  }

  private findEdgeBySnapped(obj: SnappedObject): Edge | null {
    const edges = this.graph.getEdges();
    const [from, to] = obj.edgeId.split('->');
    return edges.find((e) => e.fromNode === from && e.toNode === to) || null;
  }

  private reverseEdge(edge: Edge): Edge {
    return {
      fromNode: edge.toNode,
      toNode: edge.fromNode,
      link: edge.link,
      reversed: !edge.reversed,
    };
  }

  private getDirectionFromNumber(nummer: string): 'north' | 'south' | 'any' {
    const n = parseInt(nummer, 10);
    if (isNaN(n)) return 'any';
    return n % 2 === 0 ? 'north' : 'south';
  }

  private checkStartDirection(edge: Edge, dir: 'north' | 'south' | 'any'): boolean {
    if (dir === 'any') return true;

    const line = edge.link.coords;
    const start = edge.reversed ? line[line.length - 1] : line[0];
    const next = edge.reversed ? line[line.length - 2] : line[1];
    if (!next) return true;

    const dy = next.y - start.y;
    if (dir === 'north') return dy > 0;
    if (dir === 'south') return dy < 0;
    return true;
  }

  private checkArrivalDirection(edge: Edge, targetDir: 'north' | 'south' | 'any'): boolean {
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

  private isAtTarget(edge: Edge, target: SnappedObject): boolean {
    // Kolla om vi är på samma kant som målet
    const [targetFrom, targetTo] = target.edgeId.split('->');
    
    // Måste vara på samma kant (antingen A→B eller B→A)
    const sameEdgeForward = edge.fromNode === targetFrom && edge.toNode === targetTo;
    const sameEdgeReverse = edge.fromNode === targetTo && edge.toNode === targetFrom;
    
    return sameEdgeForward || sameEdgeReverse;
  }

  private getNeighbors(nodeOid: string): Edge[] {
    return this.graph.getEdges().filter((e) => e.fromNode === nodeOid);
  }

  private deflectionAngle(e1: Edge, e2: Edge): number {
    const line1 = e1.link.coords;
    const line2 = e2.link.coords;

    // Sista segment av e1
    const a = e1.reversed ? line1[1] : line1[line1.length - 2];
    const b = e1.reversed ? line1[0] : line1[line1.length - 1];

    // Första segment av e2
    const c = e2.reversed ? line2[line2.length - 1] : line2[0];
    const d = e2.reversed ? line2[line2.length - 2] : line2[1];

    if (!a || !b || !c || !d) return 0;

    const v1 = { x: b.x - a.x, y: b.y - a.y };
    const v2 = { x: d.x - c.x, y: d.y - c.y };

    const dot = v1.x * v2.x + v1.y * v2.y;
    const mag1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
    const mag2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);

    if (mag1 === 0 || mag2 === 0) return 0;

    const cosTheta = dot / (mag1 * mag2);
    const angle = Math.acos(Math.max(-1, Math.min(1, cosTheta))) * (180 / Math.PI);

    return angle;
  }

  private collectCrossedObjects(path: Edge[], startObj?: SnappedObject, endObj?: SnappedObject): CrossedObject[] {
    const objects: CrossedObject[] = [];
    const snapped = this.graph.getSnappedObjects();
    const seen = new Set<string>(); // Deduplicera baserat på type:id

    // VIKTIGT: Inkludera ALLA signaler på vägen, oavsett paritet (udda/jämn)
    // Paritet indikerar bara åt vilket håll signalen är vänd, inte vilket spår den är på
    // Tåget passerar fysiskt alla signaler på vägen

    for (const obj of snapped) {
      const [from, to] = obj.edgeId.split('->');
      const objKey = `${obj.type}:${obj.id}`;

      // Skippa om redan sett
      if (seen.has(objKey)) continue;

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
          } else {
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

  private mergePaths(a: Path, b: Path): Path {
    return {
      edges: [...a.edges, ...b.edges],
      totalLength: a.totalLength + b.totalLength,
      crossedObjects: [...a.crossedObjects, ...b.crossedObjects].sort(
        (x, y) => x.distanceAlongPath - y.distanceAlongPath
      ),
    };
  }

  private getObjectsOnEdge(edge: Edge): SnappedObject[] {
    const snapped = this.graph.getSnappedObjects();
    const edgeId = `${edge.fromNode}->${edge.toNode}`;
    const edgeIdRev = `${edge.toNode}->${edge.fromNode}`;
    
    return snapped.filter(obj => 
      obj.edgeId === edgeId || obj.edgeId === edgeIdRev
    );
  }

  private logNearbyObjects(coord: Point3D, label: string) {
    const snapped = this.graph.getSnappedObjects();
    const nearby = snapped
      .map(obj => ({
        obj,
        dist: Math.sqrt(
          Math.pow(obj.coord.x - coord.x, 2) + 
          Math.pow(obj.coord.y - coord.y, 2)
        )
      }))
      .filter(item => item.dist < 100) // Inom 100m
      .sort((a, b) => a.dist - b.dist)
      .slice(0, 10);

    console.log(`\n📍 Närliggande objekt vid ${label} (inom 100m):`);
    for (const { obj, dist } of nearby) {
      console.log(`   ${obj.type.toUpperCase()} ${obj.id} - ${dist.toFixed(0)}m bort`);
    }
  }

  /**
   * Validera att alla objekt i vägen är inom 1.5x direktavstånd från start
   */
  private validatePathSequence(crossedObjects: CrossedObject[], startCoord: Point3D, directDistance: number): boolean {
    const maxAllowedDistance = directDistance * 1.5;
    
    for (const obj of crossedObjects) {
      // Hitta objektets koordinater
      const objData = this.graph.findObjectById(obj.id);
      if (!objData) continue;
      
      const distance = this.graph.getBirdEyeDistance(startCoord, objData.coord);
      if (distance > maxAllowedDistance) {
        console.log(`    ❌ ${obj.type.toUpperCase()} ${obj.id} är ${distance.toFixed(0)}m från start (max ${maxAllowedDistance.toFixed(0)}m)`);
        return false;
      }
    }
    
    return true;
  }

  /**
   * Print detailed path information for debugging
   */
  private printDetailedPath(edges: Edge[], crossedObjects: CrossedObject[], startCoord: Point3D): void {
    console.log(`    📍 Detaljerad väg:`);
    
    // Print edges
    for (let i = 0; i < edges.length; i++) {
      const edge = edges[i];
      const fromNode = this.graph.getNodes().get(edge.fromNode);
      const toNode = this.graph.getNodes().get(edge.toNode);
      
      if (fromNode && toNode) {
        const fromDist = this.graph.getBirdEyeDistance(startCoord, fromNode.coord);
        const toDist = this.graph.getBirdEyeDistance(startCoord, toNode.coord);
        console.log(`      Kant ${i + 1}: ${edge.fromNode.substring(0, 8)}... → ${edge.toNode.substring(0, 8)}... (${fromDist.toFixed(0)}m → ${toDist.toFixed(0)}m, ${edge.link.length.toFixed(0)}m)`);
      }
    }
    
    // Print crossed objects with distances
    console.log(`    🎯 Objekt på vägen:`);
    for (const obj of crossedObjects) {
      const objData = this.graph.findObjectById(obj.id);
      if (objData) {
        const distance = this.graph.getBirdEyeDistance(startCoord, objData.coord);
        console.log(`      ${obj.type.toUpperCase()} ${obj.id}: ${distance.toFixed(0)}m från start`);
      }
    }
  }
}


