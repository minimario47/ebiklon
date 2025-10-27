/**
 * Integration av pathfinding med befintlig diagram-UI
 * Kopplar ihop klick-events med vägsökning
 */

// Globala variabler för pathfinding
let pathfindingUI = null;
let graphBuilder = null;
let pathEngine = null;
let geodataLoaded = false;

/**
 * Initiera pathfinding-system
 */
async function initializePathfinding() {
  try {
    console.log('Laddar geodata för vägsökning...');
    
    // Ladda geodata (inkl. längdmätningsdata)
    const [netLinks, netNodes, signalsAtc, signalsEjAtc, stoppbock, vaxlar, dcr, lengthMeasurements] = await Promise.all([
      fetch('./EbiklonGeodata/net_jvg_link.geojson').then(r => r.json()),
      fetch('./EbiklonGeodata/net_jvg_node.geojson').then(r => r.json()),
      fetch('./EbiklonGeodata/signal_framst_atc.geojson').then(r => r.json()),
      fetch('./EbiklonGeodata/signal_ej_atc.geojson').then(r => r.json()),
      fetch('./EbiklonGeodata/stoppbock.geojson').then(r => r.json()),
      fetch('./EbiklonGeodata/sparvaxel.geojson').then(r => r.json()),
      fetch('./EbiklonGeodata/sparkors.geojson').then(r => r.json()),
      fetch('./EbiklonGeodata/Langdmatning.geojson').then(r => r.json())
    ]);

    // Bygg graf (behöver importera från dist/)
    const { GraphBuilder } = await import('../dist/geo/graphBuilder.js');
    const { PathEngine } = await import('../dist/geo/pathEngine.js');

    graphBuilder = new GraphBuilder();
    
    // Kombinera signaler
    const allSignals = [
      ...(signalsAtc?.features || []),
      ...(signalsEjAtc?.features || [])
    ];

    // Bygg graf (inkl. längdmätningsdata)
    graphBuilder.buildFromGeoJSON(
      netLinks,
      netNodes,
      allSignals,
      stoppbock?.features || [],
      vaxlar?.features || [],
      dcr?.features || [],
      lengthMeasurements
    );

    pathEngine = new PathEngine(graphBuilder);
    
    // Skapa UI (ingen karta i detta läge, vi använder SVG-diagram)
    pathfindingUI = new PathfindingUI(null, graphBuilder, pathEngine);
    
    // Gör tillgänglig globalt
    window.pathfindingUI = pathfindingUI;
    
    geodataLoaded = true;
    console.log('✅ Geodata laddad och pathfinding redo!');
    
  } catch (error) {
    console.error('❌ Fel vid laddning av geodata:', error);
    alert('Kunde inte ladda geodata för vägsökning');
  }
}

/**
 * Hantera klick på objekt i diagram
 * Anropas från befintlig handleGroupClick
 */
function handlePathfindingClick(objType, objId, iframe, element) {
  if (!geodataLoaded || !pathfindingUI) {
    console.log('Pathfinding inte redo ännu');
    return false;
  }

  // Normalisera objekttyp
  const normalizedType = normalizeObjectType(objType);
  
  // Kolla om objektet är giltigt för vägsökning
  if (!pathfindingUI.isValidPathObject({ type: normalizedType })) {
    return false; // Inte ett vägsökningsobjekt
  }

  // Hitta objektet i geodata
  const snappedObj = graphBuilder.findObjectById(objId);
  if (!snappedObj) {
    console.warn(`Objekt ${objId} finns inte i geodata`);
    return false;
  }

  // Lägg till i sekvens
  pathfindingUI.addToSequence({
    ...snappedObj,
    iframe,
    element
  });

  return true; // Objektet hanterades av pathfinding
}

/**
 * Normalisera objekttyp från diagram-kod
 */
function normalizeObjectType(objType) {
  const typeMap = {
    'MSI': 'signal',
    'CSI': 'signal',
    'SSI': 'signal',
    'BST': 'stoppbock',
    'SSY': 'ssy'
  };
  
  return typeMap[objType] || objType.toLowerCase();
}

/**
 * Lägg till "Väg"-knapp i popup-innehåll
 */
function addPathButtonToPopup(contentNode, objType, objId) {
  if (!geodataLoaded || !pathfindingUI) {
    console.log('Pathfinding inte redo:', { geodataLoaded, pathfindingUI: !!pathfindingUI });
    return;
  }
  
  const normalizedType = normalizeObjectType(objType);
  if (!pathfindingUI.isValidPathObject({ type: normalizedType })) {
    console.log('Objekttyp inte giltig för vägsökning:', normalizedType);
    return;
  }
  
  console.log('Sekvens längd:', pathfindingUI.selectedObjects.length);
  
  // Visa info om sekvens om vi har minst 1 objekt
  if (pathfindingUI.selectedObjects.length >= 1) {
    const infoDiv = document.createElement('div');
    infoDiv.style.cssText = `
      margin-top: 10px;
      padding: 8px;
      background: #e3f2fd;
      border-radius: 4px;
      font-size: 12px;
    `;
    
    const objList = pathfindingUI.selectedObjects.map(o => `${o.type} ${o.id}`).join(' → ');
    infoDiv.textContent = `Sekvens: ${objList}`;
    contentNode.appendChild(infoDiv);
  }
  
  // Kolla om vi har 2+ objekt i sekvensen
  if (pathfindingUI.selectedObjects.length >= 2) {
    console.log('Lägger till Väg-knapp');
    const button = document.createElement('button');
    button.className = 'path-search-btn';
    button.textContent = 'Sök väg';
    button.style.cssText = `
      margin-top: 8px;
      padding: 10px 16px;
      background: #f5f5f5;
      color: #333;
      border: 1px solid #d0d0d0;
      border-radius: 6px;
      cursor: pointer;
      font-weight: 500;
      width: 100%;
      font-size: 13px;
      transition: all 0.2s;
    `;
    
    button.addEventListener('click', (e) => {
      e.stopPropagation();
      pathfindingUI.executePathSearch();
    });
    
    contentNode.appendChild(button);
  }
  
  // Lägg alltid till återställ-knapp om vi har objekt i sekvensen
  if (pathfindingUI.selectedObjects.length >= 1) {
    const resetBtn = document.createElement('button');
    resetBtn.textContent = 'Återställ sekvens';
    resetBtn.style.cssText = `
      margin-top: 6px;
      padding: 8px 12px;
      background: #f5f5f5;
      color: #666;
      border: 1px solid #d0d0d0;
      border-radius: 6px;
      cursor: pointer;
      width: 100%;
      font-size: 12px;
      font-weight: 500;
      transition: all 0.2s;
    `;
    
    resetBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      pathfindingUI.selectedObjects = [];
      console.log('Sekvens återställd');
      // Stäng popup
      if (typeof hidePopover === 'function') {
        hidePopover();
      }
    });
    
    contentNode.appendChild(resetBtn);
  }
}

/**
 * Återställ pathfinding vid clearSelection
 */
function resetPathfindingOnClear() {
  if (pathfindingUI && pathfindingUI.selectedObjects.length > 0) {
    // Bara återställ om vi inte har aktiva vägar
    if (pathfindingUI.foundPaths.length === 0) {
      console.log('Återställer pathfinding-sekvens');
      pathfindingUI.selectedObjects = [];
    }
  }
}

/**
 * Visa pathfinding-resultat i element-stil popup (samma som signaler)
 */
function showPathfindingResultsPopup(paths) {
  // Stäng eventuell befintlig popup först
  if (typeof hidePopover === 'function') {
    hidePopover();
  }
  
  if (paths.length === 0) {
    // Visa "inga resultat"-meddelande i element-stil popup
    const contentNode = document.createElement('div');
    contentNode.innerHTML = `
      <div style="font-weight: 600; margin-bottom: 8px; color: #333;">Ebiklon</div>
      <div style="color: #666; font-size: 11px; margin-bottom: 8px;">Inga vägar hittades</div>
      <div style="color: #999; font-size: 10px; line-height: 1.3;">
        Det gick inte att hitta en väg mellan de valda objekten. 
        Kontrollera att objekten är korrekt markerade och försök igen.
      </div>
    `;
    
    // Visa popup nära första valda objekt eller i mitten av skärmen
    const firstObj = pathfindingUI.selectedObjects[0];
    if (firstObj && firstObj.iframe && firstObj.element) {
      showPopoverNearIframeElement(firstObj.iframe, firstObj.element, contentNode);
    } else {
      // Fallback: visa i mitten av skärmen
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
        hidePopover();
      });
      pop.appendChild(closeBtn);
      pop.appendChild(contentNode);
      pop.classList.remove('hidden');
      pop.style.left = '50%';
      pop.style.top = '50%';
      pop.style.transform = 'translate(-50%, -50%)';
    }
    return;
  }
  
  const path = paths[0]; // Visa första vägen
  const signals = path.crossedObjects.filter(o => o.type === 'signal');
  const switches = path.crossedObjects.filter(o => o.type === 'poi');
  const dcrs = path.crossedObjects.filter(o => o.type === 'dcr');
  
  // Skapa popup-innehåll i samma stil som element-popups
  const contentNode = document.createElement('div');
  
  // Huvudrubrik
  const header = document.createElement('div');
  header.style.cssText = 'font-weight: 600; margin-bottom: 8px; color: #333;';
  header.textContent = `Ebiklon - Hittade ${paths.length} väg(ar)!`;
  contentNode.appendChild(header);
  
  // Väginformation
  const pathInfo = document.createElement('div');
  pathInfo.style.cssText = 'margin-bottom: 8px;';
  pathInfo.innerHTML = `
    <div style="font-weight: 500; color: #555; margin-bottom: 4px;">Väg 1:</div>
    <div style="color: #666; font-size: 11px; margin-bottom: 2px;">Längd: ${Math.round(path.totalLength)}m</div>
    <div style="color: #666; font-size: 11px;">Element: ${path.crossedObjects.length} st</div>
  `;
  contentNode.appendChild(pathInfo);
  
  // Signaler
  if (signals.length > 0) {
    const signalsDiv = document.createElement('div');
    signalsDiv.style.cssText = 'margin-bottom: 6px;';
    signalsDiv.innerHTML = `
      <div style="font-weight: 500; color: #555; font-size: 11px; margin-bottom: 2px;">Signaler:</div>
      <div style="color: #2196F3; font-family: monospace; font-size: 10px; background: #f5f5f5; padding: 4px; border-radius: 3px; word-break: break-word;">
        ${signals.map(s => s.id).join(' → ')}
      </div>
    `;
    contentNode.appendChild(signalsDiv);
  }
  
  // Växlar
  if (switches.length > 0) {
    const switchesDiv = document.createElement('div');
    switchesDiv.style.cssText = 'margin-bottom: 6px;';
    switchesDiv.innerHTML = `
      <div style="font-weight: 500; color: #555; font-size: 11px; margin-bottom: 2px;">Växlar:</div>
      <div style="color: #FF9800; font-family: monospace; font-size: 10px; background: #fff3e0; padding: 4px; border-radius: 3px; word-break: break-word;">
        ${switches.map(s => s.id).join(', ')}
      </div>
    `;
    contentNode.appendChild(switchesDiv);
  }
  
  // DCR
  if (dcrs.length > 0) {
    const dcrsDiv = document.createElement('div');
    dcrsDiv.style.cssText = 'margin-bottom: 6px;';
    dcrsDiv.innerHTML = `
      <div style="font-weight: 500; color: #555; font-size: 11px; margin-bottom: 2px;">DCR:</div>
      <div style="color: #00bcd4; font-family: monospace; font-size: 10px; background: #e3f2fd; padding: 4px; border-radius: 3px; word-break: break-word;">
        ${dcrs.map(d => d.id).join(', ')}
      </div>
    `;
    contentNode.appendChild(dcrsDiv);
  }
  
  // Åtgärdsknappar
  const actionsDiv = document.createElement('div');
  actionsDiv.style.cssText = 'margin-top: 10px; display: flex; gap: 6px;';
  
  const highlightBtn = document.createElement('button');
  highlightBtn.textContent = 'Markera';
  highlightBtn.style.cssText = `
    flex: 1;
    padding: 6px 8px;
    background: #f5f5f5;
    color: #333;
    border: 1px solid #d0d0d0;
    border-radius: 4px;
    cursor: pointer;
    font-size: 11px;
    font-weight: 500;
    transition: all 0.2s;
  `;
  highlightBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    highlightPathInSVG();
  });
  
  const exportBtn = document.createElement('button');
  exportBtn.textContent = 'Exportera';
  exportBtn.style.cssText = `
    flex: 1;
    padding: 6px 8px;
    background: #f5f5f5;
    color: #333;
    border: 1px solid #d0d0d0;
    border-radius: 4px;
    cursor: pointer;
    font-size: 11px;
    font-weight: 500;
    transition: all 0.2s;
  `;
  exportBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    exportPathData();
  });
  
  actionsDiv.appendChild(highlightBtn);
  actionsDiv.appendChild(exportBtn);
  contentNode.appendChild(actionsDiv);
  
  // Visa popup nära första valda objekt
  const firstObj = pathfindingUI.selectedObjects[0];
  if (firstObj && firstObj.iframe && firstObj.element) {
    showPopoverNearIframeElement(firstObj.iframe, firstObj.element, contentNode);
  } else {
    // Fallback: visa i mitten av skärmen
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
      hidePopover();
    });
    pop.appendChild(closeBtn);
    pop.appendChild(contentNode);
    pop.classList.remove('hidden');
    pop.style.left = '50%';
    pop.style.top = '50%';
    pop.style.transform = 'translate(-50%, -50%)';
  }
}

/**
 * Markera väg i SVG-diagram
 */
function highlightPathInSVG() {
  if (!pathfindingUI || !pathfindingUI.foundPaths || pathfindingUI.foundPaths.length === 0) {
    console.warn('Inga vägar att markera');
    return;
  }
  
  console.log('Markerar väg i SVG-diagram...');
  
  // Använd befintlig highlightFirstPath-metod från PathfindingUI
  pathfindingUI.highlightFirstPath();
  
  // Visa bekräftelse genom att uppdatera knappen
  const pop = getOrCreatePopover();
  const buttons = pop.querySelectorAll('button');
  const highlightBtn = Array.from(buttons).find(btn => btn.textContent.includes('Markera'));
  if (highlightBtn) {
    const originalText = highlightBtn.textContent;
    highlightBtn.textContent = '✓ Markerad';
    highlightBtn.style.background = '#4CAF50';
    highlightBtn.style.color = 'white';
    
    setTimeout(() => {
      highlightBtn.textContent = originalText;
      highlightBtn.style.background = '';
      highlightBtn.style.color = '';
    }, 2000);
  }
}

/**
 * Rensa vägmarkering i SVG-diagram
 */
function clearPathHighlighting() {
  if (!pathfindingUI) {
    console.warn('PathfindingUI inte tillgänglig');
    return;
  }
  
  console.log('Rensar vägmarkering...');
  
  // Använd befintlig clearPathLayers-metod från PathfindingUI
  if (typeof pathfindingUI.clearPathLayers === 'function') {
    pathfindingUI.clearPathLayers();
  } else {
    // Fallback: rensa manuellt
    const frames = Array.from(document.querySelectorAll('iframe.diagram-frame'));
    frames.forEach(iframe => {
      const doc = iframe.contentDocument || iframe.contentWindow?.document;
      if (!doc) return;
      const svg = doc.querySelector('svg');
      if (!svg) return;
      
      // Rensa alla trainpath-klasser
      const highlightedElements = svg.querySelectorAll('.trainpath-signal, .trainpath-switch, .trainpath-dcr');
      highlightedElements.forEach(el => {
        el.classList.remove('trainpath-signal', 'trainpath-switch', 'trainpath-dcr');
      });
    });
  }
  
  // Visa bekräftelse genom att uppdatera knappen
  const pop = getOrCreatePopover();
  const buttons = pop.querySelectorAll('button');
  const clearButton = Array.from(buttons).find(btn => btn.textContent.includes('Rensa'));
  if (clearButton) {
    const originalText = clearButton.textContent;
    clearButton.textContent = '✓ Rensad';
    clearButton.style.background = '#4CAF50';
    clearButton.style.color = 'white';
    
    setTimeout(() => {
      clearButton.textContent = originalText;
      clearButton.style.background = '';
      clearButton.style.color = '';
    }, 2000);
  }
}

/**
 * Exportera vägdata
 */
function exportPathData() {
  if (!pathfindingUI || !pathfindingUI.foundPaths || pathfindingUI.foundPaths.length === 0) {
    console.warn('Inga vägar att exportera');
    return;
  }
  
  console.log('Exporterar vägdata...');
  
  const path = pathfindingUI.foundPaths[0];
  const signals = path.crossedObjects.filter(o => o.type === 'signal');
  const switches = path.crossedObjects.filter(o => o.type === 'poi');
  const dcrs = path.crossedObjects.filter(o => o.type === 'dcr');
  
  // Skapa strukturerad data
  const exportData = {
    timestamp: new Date().toISOString(),
    path: {
      totalLength: Math.round(path.totalLength),
      elementCount: path.crossedObjects.length,
      signals: signals.map(s => ({ id: s.id, type: s.type })),
      switches: switches.map(s => ({ id: s.id, type: s.type })),
      dcrs: dcrs.map(d => ({ id: d.id, type: d.type })),
      fullPath: path.crossedObjects.map(obj => ({ id: obj.id, type: obj.type }))
    },
    metadata: {
      source: 'Ebiklon',
      version: '1.0'
    }
  };
  
  // Skapa och ladda ner JSON-fil
  const dataStr = JSON.stringify(exportData, null, 2);
  const dataBlob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(dataBlob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = `ebiklon_${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  
  // Visa bekräftelse genom att uppdatera knappen
  const pop = getOrCreatePopover();
  const buttons = pop.querySelectorAll('button');
  const exportBtn = Array.from(buttons).find(btn => btn.textContent.includes('Exportera'));
  if (exportBtn) {
    const originalText = exportBtn.textContent;
    exportBtn.textContent = '✓ Exporterad';
    exportBtn.style.background = '#4CAF50';
    exportBtn.style.color = 'white';
    
    setTimeout(() => {
      exportBtn.textContent = originalText;
      exportBtn.style.background = '';
      exportBtn.style.color = '';
    }, 2000);
  }
}

/**
 * Visualisera vägar i SVG-diagram
 * (Uppdaterad version som använder professionell popup)
 */
function visualizePathsInSVG(paths) {
  console.log('Hittade vägar:', paths);
  showPathfindingResultsPopup(paths);
}

// Exportera omedelbart för att undvika timing-problem
window.visualizePathsInSVG = visualizePathsInSVG;

// Initiera vid sidladdning
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializePathfinding);
} else {
  initializePathfinding();
}

// Exportera för användning
window.handlePathfindingClick = handlePathfindingClick;
window.addPathButtonToPopup = addPathButtonToPopup;
window.resetPathfindingOnClear = resetPathfindingOnClear;
window.showPathfindingResultsPopup = showPathfindingResultsPopup;
window.highlightPathInSVG = highlightPathInSVG;
window.clearPathHighlighting = clearPathHighlighting;
window.exportPathData = exportPathData;

