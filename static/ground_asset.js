export function createGroundAsset(map, position) {
  const icon = L.icon({
    iconUrl: 'https://cdn-icons-png.flaticon.com/512/148/148767.png',
    iconSize: [32, 32],
    className: 'unit-icon'
  });

  const marker = L.marker(position, { icon, draggable: true }).addTo(map).bindPopup('Bodenfahrzeug');

  const asset = {
    marker,
    interval: null,
    pathLine: null,
    target: null,
    targetMarker: null,
    isAir: false,
    onSelect: null,
    onDragEnd: null,
    moveTo: (target) => moveGroundTo(marker, target, asset)
  };

  marker.on('click', () => {
    if (asset.onSelect) asset.onSelect(asset);
  });

  marker.on('dragstart', () => {
    if (asset.interval) clearInterval(asset.interval);
  });

  marker.on('dragend', () => {
    if (asset.onDragEnd) asset.onDragEnd(asset);
  });

  return asset;
}


function moveGroundTo(marker, target, asset) {
  if (asset.interval) clearInterval(asset.interval);

  const map = marker._map;

  if (asset.pathLine) {
    map.removeLayer(asset.pathLine);
  }

  asset.target = target;

  const control = L.Routing.control({
    waypoints: [marker.getLatLng(), target],
    createMarker: () => null,
    routeWhileDragging: false,
    addWaypoints: false
  }).on('routesfound', function (e) {
    map.removeControl(control);  // sauber entfernen
    const coords = e.routes[0].coordinates;
    asset.pathLine = L.polyline(coords, { color: 'blue' }).addTo(map);
    let i = 0;
    asset.interval = setInterval(() => {
      if (i >= coords.length) {
        clearInterval(asset.interval);
        if (asset.pathLine) {
          map.removeLayer(asset.pathLine);
          asset.pathLine = null;
        }
        return;
      }
      marker.setLatLng(coords[i]);
      i++;
    }, 80);
  }).addTo(map);
}
