let airInterval = null;

export function initAirAsset(map) {
  const icon = L.icon({
    iconUrl: 'https://cdn-icons-png.flaticon.com/512/684/684908.png',
    iconSize: [32, 32],
    className: 'unit-icon'
  });
  const marker = L.marker([48.7758, 9.1829], { icon }).addTo(map).bindPopup('Fluggerät');
  const asset = {
    marker,
    interval: null,
    pathLine: null,
    target: null,
    targetMarker: null,
    isAir: true,
    moveTo: (target) => moveAirTo(marker, target, asset),
    onSelect: null,
    onDragEnd: null,
  };

  marker.on('click', () => {
    if (asset.onSelect) asset.onSelect(asset);
  });

  return asset;
}

export function moveAirTo(marker, target, asset) {
  if (airInterval) clearInterval(airInterval);

  const map = marker._map;
  if (asset.pathLine) {
    map.removeLayer(asset.pathLine);
  }

  asset.target = target;
  asset.pathLine = L.polyline([marker.getLatLng(), target], { color: 'red' }).addTo(map);

  airInterval = setInterval(() => {
    const next = moveTowards(marker.getLatLng(), target, 0.0012);
    marker.setLatLng(next);
    if (next.lat === target.lat && next.lng === target.lng) {
      clearInterval(airInterval);
      if (asset.pathLine) {
        map.removeLayer(asset.pathLine);
        asset.pathLine = null;
      }
    }
  }, 100);
}

function moveTowards(current, target, step) {
  const latDiff = target.lat - current.lat;
  const lngDiff = target.lng - current.lng;
  const dist = Math.sqrt(latDiff * latDiff + lngDiff * lngDiff);
  if (dist < step) return target;
  const factor = step / dist;
  return {
    lat: current.lat + latDiff * factor,
    lng: current.lng + lngDiff * factor
  };
}
