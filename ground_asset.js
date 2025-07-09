const activeGroundAssets = [];

export function createGroundAsset(map, position) {
  const icon = L.icon({
    iconUrl: 'https://cdn-icons-png.flaticon.com/512/148/148767.png',
    iconSize: [32, 32]
  });

  const marker = L.marker(position, { icon }).addTo(map).bindPopup("Bodenfahrzeug");

  const asset = {
    marker,
    interval: null,
    moveTo: (target) => moveGroundTo(marker, target, asset)
  };

  return asset;
}


function moveGroundTo(marker, target, asset) {
  if (asset.interval) clearInterval(asset.interval);

  const map = marker._map;

  const control = L.Routing.control({
    waypoints: [marker.getLatLng(), target],
    createMarker: () => null,
    routeWhileDragging: false,
    addWaypoints: false
  }).on('routesfound', function (e) {
    map.removeControl(control);  // sauber entfernen
    const coords = e.routes[0].coordinates;
    let i = 0;
    asset.interval = setInterval(() => {
      if (i >= coords.length) {
        clearInterval(asset.interval);
        return;
      }
      marker.setLatLng(coords[i]);
      i++;
    }, 80);
  }).addTo(map);
}
