/**
 * UI-modul för vägsökning mellan signaler/stoppbock/SSY
 * Hanterar klick-sekvens, visualisering och popups
 */

class PathfindingUI {
  constructor(map, graphBuilder, pathEngine) {
    this.map = map;
    this.graphBuilder = graphBuilder;
    this.pathEngine = pathEngine;
    
    // Klick-sekvens för vägsökning
    this.selectedObjects = [];
    
    // Aktiva vägar och visualisering
    this.foundPaths = [];
    this.pathLayers = [];
    this.selectedPathIndex = null;
    
    // Popup-referenser
    this.currentPopup = null;
    this.pathPopup = null;
  }

  /**
   * Lägg till objekt i klick-sekvensen
   * @param {Object} obj - Objekt med {type, id, coord, ...}
   */
  addToSequence(obj) {
    // Validera att objektet är tillåtet (signal, stoppbock, SSY)
    if (!this.isValidPathObject(obj)) {
      console.warn('Objektet kan inte användas för vägsökning:', obj.type);
      return;
    }

    this.selectedObjects.push(obj);
    console.log(`Objekt ${this.selectedObjects.length}: ${obj.type} ${obj.id}`);

    // Uppdatera popup med "Väg"-knapp om 2+ objekt
    if (this.selectedObjects.length >= 2) {
      this.showPathButton();
    }
  }

  /**
   * Kontrollera om objekttyp är giltig för vägsökning
   */
  isValidPathObject(obj) {
    const validTypes = ['signal', 'stoppbock', 'ssy'];
    return validTypes.includes(obj.type?.toLowerCase());
  }

  /**
   * Visa "Väg"-knapp i aktuell popup
   */
  showPathButton() {
    if (!this.currentPopup) return;

    const popupContent = this.currentPopup.getElement();
    if (!popupContent) return;

    // Kolla om knappen redan finns
    if (popupContent.querySelector('.path-search-btn')) return;

    // Skapa "Väg"-knapp
    const button = document.createElement('button');
    button.className = 'path-search-btn';
    button.textContent = '🛤️ Väg';
    button.style.cssText = `
      margin-top: 10px;
      padding: 8px 16px;
      background: #4CAF50;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-weight: bold;
      width: 100%;
    `;

    button.addEventListener('click', () => this.executePathSearch());

    // Lägg till knappen i popup
    const contentDiv = popupContent.querySelector('.popup-content') || popupContent;
    contentDiv.appendChild(button);
  }

  /**
   * Utför vägsökning mellan valda objekt
   */
  async executePathSearch() {
    if (this.selectedObjects.length < 2) {
      alert('Välj minst 2 objekt för vägsökning');
      return;
    }

    const start = this.selectedObjects[0];
    const end = this.selectedObjects[this.selectedObjects.length - 1];
    const via = this.selectedObjects.length === 3 ? this.selectedObjects[1] : null;

    console.log(`Söker väg: ${start.type} ${start.id} → ${end.type} ${end.id}${via ? ` via ${via.type} ${via.id}` : ''}`);

    try {
      // Hitta vägar (via stöds inte än)
      if (via) {
        alert('Via-punkter stöds inte än. Välj bara start och slut.');
        return;
      }
      
      this.foundPaths = this.pathEngine.findPaths(start.id, end.id);

      if (this.foundPaths.length === 0) {
        alert('Inga vägar hittades mellan de valda objekten');
        return;
      }

      console.log(`Hittade ${this.foundPaths.length} vägar`);

      // Markera en av vägarna i SVG (välj kortaste)
      this.highlightFirstPath();
      // Visa enkel sammanfattning
      this.showPathResults();

    } catch (error) {
      console.error('Fel vid vägsökning:', error);
      alert('Ett fel uppstod vid vägsökning: ' + error.message);
    }
  }

  /**
   * Visa resultat i alert (enkel version)
   */
  showPathResults() {
    let message = `Hittade ${this.foundPaths.length} väg(ar)!\n\n`;
    
    this.foundPaths.forEach((path, index) => {
      const signals = path.crossedObjects.filter(o => o.type === 'signal');
      const pois = path.crossedObjects.filter(o => o.type === 'poi');
      const dcrs = path.crossedObjects.filter(o => o.type === 'dcr');
      
      message += `Väg ${index + 1}:\n`;
      message += `  Längd: ${Math.round(path.totalLength)}m\n`;
      message += `  Signaler: ${signals.map(s => s.id).join(' → ')}\n`;
      if (pois.length > 0) message += `  Växlar: ${pois.map(p => p.id).join(', ')}\n`;
      if (dcrs.length > 0) message += `  DCR: ${dcrs.map(d => d.id).join(', ')}\n`;
      message += '\n';
    });
    
    alert(message);
    
    // Låt markering vara kvar tills användaren klickar X (rensa)
  }

  // SVG-visualisering kommer senare
  /**
   * Markera kortaste vägen i aktuella SVG-diagram
   */
  highlightFirstPath() {
    if (!this.foundPaths || this.foundPaths.length === 0) return;
    // Ta kortaste
    const path = [...this.foundPaths].sort((a,b)=>a.totalLength-b.totalLength)[0];

    // Rensa tidigare markeringar
    this.clearPathLayers();

    // Markera korsade objekt (signaler, växlar, dcr)
    // Begränsa markering till diagram där användaren faktiskt klickade objekten
    const framesSet = new Set(this.selectedObjects.map(o => o.iframe).filter(Boolean));
    const frames = framesSet.size > 0 ? Array.from(framesSet) : Array.from(document.querySelectorAll('iframe.diagram-frame'));

    const markByExtNum = (extNum, cls) => {
      frames.forEach(iframe => {
        const doc = iframe.contentDocument || iframe.contentWindow?.document;
        if (!doc) return;
        const svg = doc.querySelector('svg');
        if (!svg) return;
        // Hitta grupper som innehåller text som matchar extNum (våra diagram visar ofta numret som text)
        const candidates = Array.from(svg.querySelectorAll('g[id^="A"]'));
        candidates.forEach(g => {
          const t = g.querySelector('text');
          const desc = g.querySelector('desc');
          const hasMatch = (t && t.textContent && t.textContent.trim() === extNum) ||
                           (desc && desc.textContent && desc.textContent.includes(`ExtNum="${extNum}"`));
          if (hasMatch) {
            g.classList.add(cls);
          }
        });
      });
    };

    path.crossedObjects.forEach(obj => {
      if (obj.type === 'signal') markByExtNum(obj.id, 'trainpath-signal');
      if (obj.type === 'poi') markByExtNum(obj.id, 'trainpath-switch');
      if (obj.type === 'dcr') markByExtNum(obj.id, 'trainpath-dcr');
    });

    // För kanter: markera båda ändarnas grupper lätt (heuristik)
    // Detta ger visuell hint om spåret mellan dem, tills vi har explicit edge->SVG geometri
    path.edges.forEach(e => {
      // markera närliggande signaler/POI på kanten (de brukar ligga nära)
      // redan markerade ovan om de finns; lämna som är.
    });
  }

  /**
   * Återställ vägsökning och rensa visualisering
   */
  resetPathSearch() {
    console.log('Återställer vägsökning');
    
    // Rensa sekvens
    this.selectedObjects = [];
    
    // Rensa vägar
    this.foundPaths = [];
    this.selectedPathIndex = null;
    
    // Ta bort visualisering
    this.clearPathLayers();
    
    // Stäng popups
    this.closeCurrentPopup();
    if (this.pathPopup) {
      this.map.closePopup(this.pathPopup);
      this.pathPopup = null;
    }
  }

  /**
   * Rensa visualisering (placeholder)
   */
  clearPathLayers() {
    this.pathLayers = [];
    // Ta bort alla trainpath-klasser i alla iframes
    document.querySelectorAll('iframe.diagram-frame').forEach(iframe => {
      const doc = iframe.contentDocument || iframe.contentWindow?.document;
      if (!doc) return;
      const svg = doc.querySelector('svg');
      if (!svg) return;
      svg.querySelectorAll('.trainpath-signal, .trainpath-switch, .trainpath-dcr, .trainpath-edge')
        .forEach(el => el.classList.remove('trainpath-signal','trainpath-switch','trainpath-dcr','trainpath-edge'));
    });
  }

  // Popup-hantering tas bort (används inte med SVG)
}

// Exportera för användning i index.html
window.PathfindingUI = PathfindingUI;

