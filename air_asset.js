let airInterval = null;

export function initAirAsset(map) {
  const icon = L.icon({
    iconUrl: 'https://cdn-icons-png.flaticon.com/512/684/684908.png',
    iconSize: [32, 32]
  });
  const marker = L.marker([48.7758, 9.1829], { icon }).addTo(map).bindPopup("Fluggerät");
  return marker;
}

export function moveAirTo(marker, target) {
  if (airInterval) clearInterval(airInterval);

  airInterval = setInterval(() => {
    const next = moveTowards(marker.getLatLng(), target, 0.0012);
    marker.setLatLng(next);
    if (next.lat === target.lat && next.lng === target.lng) clearInterval(airInterval);
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
