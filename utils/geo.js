/**
 * Single place for distance and location rules used by the server.
 *
 * Distances are STRAIGHT-LINE (great-circle, haversine) kilometres between two
 * points. They are a lower bound on the road distance. Every fare, detour and
 * route calculation in the app uses this same function so results agree.
 */

const EARTH_RADIUS_KM = 6371;
const DEFAULT_RATE_PER_KM = 10; // ₹ per km, used by server and client
const INDIA_BOUNDS = { latMin: 6, latMax: 37.5, lonMin: 68, lonMax: 98 };

function haversineKm(lat1, lon1, lat2, lon2) {
    const toRad = d => d * Math.PI / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// True for real coordinates inside India. Rejects 0,0 and swapped lat/lon.
function isValidIndiaCoord(lat, lon) {
    return typeof lat === 'number' && typeof lon === 'number' &&
        isFinite(lat) && isFinite(lon) &&
        lat >= INDIA_BOUNDS.latMin && lat <= INDIA_BOUNDS.latMax &&
        lon >= INDIA_BOUNDS.lonMin && lon <= INDIA_BOUNDS.lonMax;
}

module.exports = { haversineKm, isValidIndiaCoord, DEFAULT_RATE_PER_KM, INDIA_BOUNDS };

/**
 * Price quote for a ride from its two points and a per-km rate.
 * Used by POST /api/rides/create so the server, not the browser, sets the price.
 */
function quoteRide({ fromLat, fromLon, toLat, toLon, ratePerKm }) {
    const coords = [fromLat, fromLon, toLat, toLon].map(Number);
    if (!coords.every(Number.isFinite) || !isValidIndiaCoord(coords[0], coords[1]) || !isValidIndiaCoord(coords[2], coords[3])) {
        return { ok: false, error: 'Please pick valid From and To places from the suggestions.' };
    }
    const rate = Math.min(Math.max(Number(ratePerKm) || DEFAULT_RATE_PER_KM, 1), 50);
    const distanceKm = Math.round(haversineKm(coords[0], coords[1], coords[2], coords[3]) * 100) / 100;
    if (distanceKm < 0.1) return { ok: false, error: 'From and To are the same place.' };
    return { ok: true, distanceKm, ratePerKm: rate, price: Math.round(distanceKm * rate) };
}

module.exports.quoteRide = quoteRide;
