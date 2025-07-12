let map = null;
let baseLayers = null;
let currentLayer = null;

export function initMap() {
  map = L.map('map').setView([48.7758, 9.1829], 13);

  baseLayers = {
    osm: L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19, attribution: '© OpenStreetMap'
    }),
    topo: L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
      maxZoom: 17, attribution: '© OpenTopoMap, © OpenStreetMap'
    }),
    esri: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 18, attribution: 'Tiles © Esri'
    }),
    carto: L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 19, attribution: '© OpenStreetMap, © CartoDB'
    }),
    stamen: L.tileLayer('https://stamen-tiles.a.ssl.fastly.net/terrain/{z}/{x}/{y}.jpg', {
      maxZoom: 18, attribution: '© Stamen Design, © OpenStreetMap'
    })
  };

  currentLayer = baseLayers.osm.addTo(map);
  return map;
}

export function switchBaseLayer(key) {
  if (!map || !baseLayers[key]) return;
  map.removeLayer(currentLayer);
  currentLayer = baseLayers[key].addTo(map);
}

export function getMap() {
  return map;
}
