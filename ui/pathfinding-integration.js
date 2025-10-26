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
      fetch('./EbiklonGeodata/langdmatning.geojson').then(r => r.json())
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
    infoDiv.textContent = `📍 Sekvens: ${objList}`;
    contentNode.appendChild(infoDiv);
  }
  
  // Kolla om vi har 2+ objekt i sekvensen
  if (pathfindingUI.selectedObjects.length >= 2) {
    console.log('Lägger till Väg-knapp');
    const button = document.createElement('button');
    button.className = 'path-search-btn';
    button.textContent = `🛤️ Sök väg`;
    button.style.cssText = `
      margin-top: 8px;
      padding: 10px 16px;
      background: #4CAF50;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-weight: bold;
      width: 100%;
      font-size: 14px;
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
    resetBtn.textContent = '🔄 Återställ sekvens';
    resetBtn.style.cssText = `
      margin-top: 6px;
      padding: 6px 12px;
      background: #f44336;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      width: 100%;
      font-size: 12px;
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
 * Visualisera vägar i SVG-diagram
 * (Enklare version utan Leaflet)
 */
function visualizePathsInSVG(paths) {
  // TODO: Implementera SVG-visualisering
  // För nu: visa i console och alert
  console.log('Hittade vägar:', paths);
  
  if (paths.length > 0) {
    const path = paths[0];
    const signals = path.crossedObjects.filter(o => o.type === 'signal');
    const pois = path.crossedObjects.filter(o => o.type === 'poi');
    const dcrs = path.crossedObjects.filter(o => o.type === 'dcr');
    
    let message = `Hittade ${paths.length} väg(ar)!\n\n`;
    message += `Väg 1:\n`;
    message += `Längd: ${Math.round(path.totalLength)}m\n`;
    message += `Signaler: ${signals.map(s => s.id).join(' → ')}\n`;
    if (pois.length > 0) message += `Växlar: ${pois.map(p => p.id).join(', ')}\n`;
    if (dcrs.length > 0) message += `DCR: ${dcrs.map(d => d.id).join(', ')}\n`;
    
    alert(message);
  }
}

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

