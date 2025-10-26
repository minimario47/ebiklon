document.addEventListener('DOMContentLoaded', function () {
    const POPOVER_OFFSET = 8;
    let currentSelection = null; // { element }

    function getOrCreatePopover() {
        let pop = document.getElementById('svg-popover');
        if (!pop) {
            pop = document.createElement('div');
            pop.id = 'svg-popover';
            pop.className = 'popover hidden';
            pop.addEventListener('mousedown', e => e.stopPropagation());
            pop.addEventListener('click', e => e.stopPropagation());
            document.body.appendChild(pop);
        }
        return pop;
    }

    function hidePopover() {
        const pop = getOrCreatePopover();
        pop.classList.add('hidden');
        pop.innerHTML = '';
    }

    function positionPopoverForSvgTarget(svgEl, targetEl) {
        const pop = getOrCreatePopover();
        const tRect = targetEl.getBoundingClientRect();
        const sRect = svgEl.getBoundingClientRect();
        let left = window.scrollX + sRect.left + tRect.right + POPOVER_OFFSET;
        let top = window.scrollY + sRect.top + tRect.top;
        pop.style.left = left + 'px';
        pop.style.top = top + 'px';
        requestAnimationFrame(() => {
            const pr = pop.getBoundingClientRect();
            const vw = window.innerWidth;
            const vh = window.innerHeight;
            if (pr.right > vw - 8) {
                left = window.scrollX + sRect.left + tRect.left - pr.width - POPOVER_OFFSET;
            }
            if (left < window.scrollX + 8) left = window.scrollX + 8;
            if (pr.bottom > vh - 8) {
                top = window.scrollY + sRect.top + tRect.bottom - pr.height;
            }
            if (top < window.scrollY + 8) top = window.scrollY + 8;
            pop.style.left = left + 'px';
            pop.style.top = top + 'px';
        });
    }

    // Railway element data structures for neighbor detection
    let railwayElements = new Map(); // Map of element ID -> element data
    let signalsByTrack = new Map(); // Map of track ExtNum -> signals on that track

    function formatElementDataNode(g) {
        const wrap = document.createElement('div');
        const title = document.createElement('div');
        title.style.fontWeight = '600';
        title.style.marginBottom = '6px';
        const descEl = g.querySelector('desc');
        const attrs = parseDescAttributes(descEl ? descEl.textContent || '' : '');
        const objType = attrs.ObjType || '';
        const objTypeSv = mapObjTypeToSwedish(objType);
        const extNum = attrs.ExtNum || '';
        title.textContent = `${objTypeSv}${objType ? ` (${objType})` : ''}`;
        const textEl = g.querySelector('text');
        const pre = document.createElement('pre');
        pre.style.whiteSpace = 'pre-wrap';
        pre.style.margin = '0';
        pre.style.fontFamily = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
        pre.style.fontSize = '11px';
        const lines = [];
        if (extNum) {
            lines.push(`ExtNum: ${extNum}`);
        }
        lines.push(`ID: ${g.id}`);
        if (textEl && textEl.textContent && textEl.textContent.trim()) {
            lines.push(`text: ${textEl.textContent.trim()}`);
        }
        
        // Add neighbor information
        const neighbors = getElementNeighbors(g.id);
        if (neighbors.length > 0) {
            lines.push('');
            lines.push('Grannar:');
            neighbors.forEach(neighborId => {
                const neighbor = railwayElements.get(neighborId);
                if (neighbor) {
                    lines.push(`  ${neighbor.extNum || neighborId} (${neighbor.swedishName || neighbor.objType})`);
                }
            });
        }
        
        if (descEl && descEl.textContent && descEl.textContent.trim()) {
            lines.push('');
            lines.push(descEl.textContent.trim());
        }
        if (!lines.length) {
            lines.push('(Inget metadata hittades)');
        }
        pre.textContent = lines.join('\n');
        wrap.appendChild(title);
        wrap.appendChild(pre);
        return wrap;
    }

    function parseDescAttributes(descText) {
        const out = {};
        if (!descText) return out;
        const regex = /(\w+)="([^"]*)"/g;
        let m;
        while ((m = regex.exec(descText)) !== null) {
            out[m[1]] = m[2];
        }
        return out;
    }

    function mapObjTypeToSwedish(code) {
        switch (code) {
            case 'TCI': return 'Spårledning';
            case 'CSI': return 'Huvuddvärgsignal';
            case 'SSI': return 'Dvärgsignal';
            case 'MSI': return 'Huvudsignal';
            case 'SSY': return 'Slutpunkt';
            case 'BST': return 'Stoppbock';
            case 'POI': return 'Växel';
            case 'DER': return 'Spårspärr';
            case 'DCR': return 'engelsk växel';
            case 'LBC': return 'Vägskyddsanläggning';
            case 'SPO': return 'bro';
            default: return code || 'Okänt objekt';
        }
    }

    function buildRailwayNetwork(svgElement) {
        // Parse all railway elements from SVG
        const groups = svgElement.querySelectorAll('g[id^="A"]');
        
        groups.forEach(group => {
            const desc = group.querySelector('desc');
            if (!desc) return;
            
            const descText = desc.textContent;
            const extNumMatch = descText.match(/ExtNum="([^"]+)"/);
            const objTypeMatch = descText.match(/ObjType="([^"]+)"/);
            
            if (extNumMatch && objTypeMatch) {
                const elementData = {
                    id: group.id,
                    extNum: extNumMatch[1],
                    objType: objTypeMatch[1],
                    swedishName: mapObjTypeToSwedish(objTypeMatch[1]),
                    element: group,
                    neighbors: new Set(),
                    position: getElementPosition(group)
                };

                railwayElements.set(group.id, elementData);
                
                // For tracks, add to track index
                if (objTypeMatch[1] === 'TCI') {
                    if (!signalsByTrack.has(extNumMatch[1])) {
                        signalsByTrack.set(extNumMatch[1], { track: elementData, signals: [] });
                    }
                }
                
                // For signals, find associated track
                if (['CSI', 'SSI', 'MSI'].includes(objTypeMatch[1])) {
                    findSignalTrackAssociation(elementData);
                }
            }
        });
        
        // Build neighbor relationships
        buildNeighborRelationships();
    }

    function getElementPosition(element) {
        const bbox = element.getBBox();
        return {
            x: bbox.x + bbox.width / 2,
            y: bbox.y + bbox.height / 2,
            bbox: bbox
        };
    }

    function findSignalTrackAssociation(signalData) {
        // Find closest track by examining ExtNum patterns and proximity
        let bestMatch = null;
        let minDistance = Infinity;
        
        // Extract track identifier from signal's ExtNum (e.g., "GBG 711 C" -> track "GBG 711 A/B")
        const signalExtNum = signalData.extNum;
        const parts = signalExtNum.split(' ');
        if (parts.length >= 2) {
            const trackPattern = parts.slice(0, -1).join(' '); // Remove last part (usually direction)
            
            // Look for tracks with similar ExtNum
            signalsByTrack.forEach((trackInfo, trackExtNum) => {
                if (trackExtNum.startsWith(trackPattern)) {
                    const distance = calculateDistance(signalData.position, trackInfo.track.position);
                    if (distance < minDistance && distance < 100) { // Within reasonable distance
                        minDistance = distance;
                        bestMatch = trackInfo;
                    }
                }
            });
            
            // If no pattern match, find closest track by proximity
            if (!bestMatch) {
                signalsByTrack.forEach((trackInfo, trackExtNum) => {
                    const distance = calculateDistance(signalData.position, trackInfo.track.position);
                    if (distance < minDistance && distance < 50) { // Closer proximity for fallback
                        minDistance = distance;
                        bestMatch = trackInfo;
                    }
                });
            }
        }
        
        if (bestMatch) {
            signalData.controlledTrack = bestMatch.track.id;
            bestMatch.signals.push(signalData.id);
        }
    }

    function calculateDistance(pos1, pos2) {
        return Math.sqrt(Math.pow(pos1.x - pos2.x, 2) + Math.pow(pos1.y - pos2.y, 2));
    }

    function buildNeighborRelationships() {
        railwayElements.forEach((elementData, elementId) => {
            findElementNeighbors(elementData);
        });
    }

    function findElementNeighbors(elementData) {
        if (elementData.objType === 'TCI') {
            // For tracks: find signals on this track and connected elements
            findTrackNeighbors(elementData);
        } else if (['CSI', 'SSI', 'MSI'].includes(elementData.objType)) {
            // For signals: find controlled track and related signals
            findSignalNeighbors(elementData);
        } else if (elementData.objType === 'POI') {
            // For switches: find connected tracks and signals
            findSwitchNeighbors(elementData);
        } else {
            // For other elements: find nearby elements by proximity
            findProximityNeighbors(elementData, 30);
        }
    }

    function findTrackNeighbors(trackData) {
        // Find signals associated with this track
        signalsByTrack.forEach((trackInfo, trackExtNum) => {
            if (trackInfo.track.id === trackData.id) {
                trackInfo.signals.forEach(signalId => {
                    trackData.neighbors.add(signalId);
                    const signalData = railwayElements.get(signalId);
                    if (signalData) {
                        signalData.neighbors.add(trackData.id);
                    }
                });
            }
        });
        
        // Find nearby tracks, switches, and other elements
        findProximityNeighbors(trackData, 40);
    }

    function findSignalNeighbors(signalData) {
        if (signalData.controlledTrack) {
            // Add controlled track as neighbor
            signalData.neighbors.add(signalData.controlledTrack);
            
            // Find other signals on the same track sequence
            const trackData = railwayElements.get(signalData.controlledTrack);
            if (trackData) {
                const trackExtNum = trackData.extNum;
                const trackBase = trackExtNum.split(' ').slice(0, -1).join(' ');
                
                // Find signals on related tracks (same base number, different directions)
                signalsByTrack.forEach((trackInfo, extNum) => {
                    if (extNum.startsWith(trackBase) && trackInfo.track.id !== signalData.controlledTrack) {
                        trackInfo.signals.forEach(otherSignalId => {
                            if (otherSignalId !== signalData.id) {
                                signalData.neighbors.add(otherSignalId);
                            }
                        });
                    }
                });
            }
        }
        
        // Find nearby signals and other elements
        findProximityNeighbors(signalData, 50);
    }

    function findSwitchNeighbors(switchData) {
        // Switches connect multiple tracks, so find all nearby tracks and signals
        findProximityNeighbors(switchData, 60);
    }

    function findProximityNeighbors(elementData, maxDistance) {
        railwayElements.forEach((otherData, otherId) => {
            if (otherId === elementData.id) return;
            
            const distance = calculateDistance(elementData.position, otherData.position);
            if (distance <= maxDistance) {
                elementData.neighbors.add(otherId);
                otherData.neighbors.add(elementData.id);
            }
        });
    }

    function getElementNeighbors(elementId) {
        const elementData = railwayElements.get(elementId);
        return elementData ? Array.from(elementData.neighbors) : [];
    }

    function showPopoverNearSvgElement(svgEl, targetEl, contentNode) {
        const pop = getOrCreatePopover();
        pop.innerHTML = '';
        const closeBtn = document.createElement('button');
        closeBtn.type = 'button';
        closeBtn.className = 'popover-close';
        closeBtn.setAttribute('aria-label', 'Stäng');
        closeBtn.textContent = '×';
        closeBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (currentSelection) {
                currentSelection.classList.remove('blinking');
                currentSelection = null;
            }
            hidePopover();
        });
        pop.appendChild(closeBtn);
        pop.appendChild(contentNode);
        pop.classList.remove('hidden');
        positionPopoverForSvgTarget(svgEl, targetEl);
    }

    fetch('gbg.svg')
        .then(response => response.text())
        .then(svgData => {
            const parser = new DOMParser();
            const svgDoc = parser.parseFromString(svgData, "image/svg+xml");
            const svgElement = svgDoc.documentElement;

            // --- Define default colors ---
            const defaultTrackColor = 'rgb(130,150,150)';
            const safeColors = [
                defaultTrackColor,
                'rgb(176,175,169)', // background grey
                'rgb(0,0,0)',         // black text
                'rgb(55,60,60)',      // dark grey text
                'rgb(120,135,135)', // another grey
                'none',
                'white',
                '#f1c40f', // from NOTE symbol
                '#0088ff', // from NOTE symbol
                '#0066dd', // from NOTE symbol
                'red' // for arrows in markers
            ];

            // --- Clean track/signal colors ---
            const elements = svgElement.querySelectorAll('*');
            elements.forEach(el => {
                const fill = el.getAttribute('fill');
                const stroke = el.getAttribute('stroke');

                if (fill && !safeColors.includes(fill)) {
                     // Don't change text colors that are not black
                    if (el.tagName.toLowerCase() !== 'text') {
                        el.setAttribute('fill', defaultTrackColor);
                    }
                }
                if (stroke && !safeColors.includes(stroke)) {
                    el.setAttribute('stroke', defaultTrackColor);
                }
            });

            // --- Remove train numbers ---
            // Train numbers seem to be in groups with ObjType="TDB"
            const trainDataBlocks = svgElement.querySelectorAll('g[id^="A"]');
            trainDataBlocks.forEach(g => {
                const descElement = g.querySelector('desc');
                if (descElement && descElement.textContent.includes('ObjType="TDB"')) {
                    const textElement = g.querySelector('text');
                    if (textElement) {
                        textElement.textContent = ''; // Clear train number
                    }
                }
            });


            // --- Build railway network for neighbor detection ---
            buildRailwayNetwork(svgElement);

            // --- Add interactivity ---
            const clickableGroups = svgElement.querySelectorAll('g[id^="A"]');
            clickableGroups.forEach(g => {
                g.style.cursor = 'pointer';
                g.addEventListener('click', (ev) => {
                    ev.preventDefault();
                    ev.stopPropagation();
                    const parentG = findTopObjectGroup(g);
                    if (!parentG) return;
                    if (currentSelection && currentSelection !== parentG) {
                        currentSelection.classList.remove('blinking');
                        hidePopover();
                    }
                    parentG.classList.add('blinking');
                    currentSelection = parentG;
                    const content = formatElementDataNode(parentG);
                    showPopoverNearSvgElement(svgElement, parentG, content);
                });
            });

            function findTopObjectGroup(el) {
                let node = el;
                let candidate = null;
                while (node && node.tagName && node.tagName.toLowerCase() !== 'svg') {
                    if (node.tagName.toLowerCase() === 'g' && /^A\d+$/.test(node.id || '')) {
                        candidate = node;
                    }
                    node = node.parentElement;
                }
                return candidate;
            }

            // Background click clears selection
            document.addEventListener('click', () => {
                if (currentSelection) {
                    currentSelection.classList.remove('blinking');
                    currentSelection = null;
                }
                hidePopover();
            });

            window.addEventListener('scroll', () => {
                if (currentSelection) {
                    positionPopoverForSvgTarget(svgElement, currentSelection);
                }
            }, { passive: true });
            window.addEventListener('resize', () => {
                if (currentSelection) {
                    positionPopoverForSvgTarget(svgElement, currentSelection);
                }
            });

            // Append the modified SVG to the container
            document.getElementById('svg-container').appendChild(svgElement);
        })
        .catch(error => console.error('Error loading SVG:', error));
});
