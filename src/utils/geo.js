// Client-side location helpers. Distances use the same straight-line formula as the server.

export const DEFAULT_RATE_PER_KM = 10; // keep equal to utils/geo.js on the server
export const MAX_GPS_ACCURACY_M = 300;  // a pickup fix worse than this is not trusted

const INDIA = { latMin: 6, latMax: 37.5, lonMin: 68, lonMax: 98 };

export function haversineKm(lat1, lon1, lat2, lon2) {
  const toRad = d => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function isIndiaCoord(lat, lon) {
  return Number.isFinite(lat) && Number.isFinite(lon) &&
    lat >= INDIA.latMin && lat <= INDIA.latMax && lon >= INDIA.lonMin && lon <= INDIA.lonMax;
}

/**
 * Looks up places in India with OpenStreetMap Nominatim.
 * Returns up to `limit` matches: [{ label, lat, lon }]. Usage policy: about one request per second.
 */
export async function searchPlaces(query, limit = 5) {
  const q = (query || '').trim();
  if (q.length < 2) return [];
  const url = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=0&countrycodes=in&limit=${limit}&q=${encodeURIComponent(q)}`;
  const res = await fetch(url, { headers: { 'Accept-Language': 'en' } });
  if (!res.ok) throw new Error('Place search is unavailable right now');
  const data = await res.json();
  return data
    .map(r => ({ label: r.display_name, lat: parseFloat(r.lat), lon: parseFloat(r.lon) }))
    .filter(p => isIndiaCoord(p.lat, p.lon));
}

/**
 * Reads the device position once. Resolves { lat, lon, accuracy } where accuracy is in metres.
 * Rejects with a clear message if the position is unavailable.
 */
export function getCurrentLocation(timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('Location is not available on this device.'));
    navigator.geolocation.getCurrentPosition(
      pos => {
        const { latitude: lat, longitude: lon, accuracy } = pos.coords;
        if (!isIndiaCoord(lat, lon)) return reject(new Error('Your device location is outside India. Type your pickup spot instead.'));
        resolve({ lat, lon, accuracy: Math.round(accuracy) });
      },
      err => reject(new Error(err && err.code === 1 ? 'Location permission was denied.' : 'Could not get your location.')),
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 0 }
    );
  });
}
