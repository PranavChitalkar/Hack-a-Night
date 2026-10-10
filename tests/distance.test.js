const assert = require('assert');
const { haversineKm, isValidIndiaCoord } = require('../utils/geo');
const { calculateHaversineDistance } = require('../utils/vrptw');

// Known great-circle distances (reference values, ±1%)
const cases = [
    ['Delhi to Mumbai', [28.6139, 77.2090], [19.0760, 72.8777], 1153],
    ['Nashik to Pune', [19.9975, 73.7898], [18.5204, 73.8567], 164],
    ['Mumbai to Pune', [19.0760, 72.8777], [18.5204, 73.8567], 120],
    ['Same point', [19.9975, 73.7898], [19.9975, 73.7898], 0]
];
for (const [name, a, b, expectedKm] of cases) {
    const d = haversineKm(a[0], a[1], b[0], b[1]);
    const tol = Math.max(expectedKm * 0.02, 0.01);
    assert.ok(Math.abs(d - expectedKm) <= tol, `${name}: got ${d.toFixed(1)} km, expected ~${expectedKm}`);
    console.log(`${name}: ${d.toFixed(1)} km (expected ~${expectedKm})`);
}

// Route solver and shared helper must agree
assert.strictEqual(calculateHaversineDistance(19.9975, 73.7898, 18.5204, 73.8567), haversineKm(19.9975, 73.7898, 18.5204, 73.8567));

// Coordinate sanity: swapped or zero coordinates are rejected
assert.strictEqual(isValidIndiaCoord(19.99, 73.79), true);
assert.strictEqual(isValidIndiaCoord(0, 0), false);
assert.strictEqual(isValidIndiaCoord(73.79, 19.99), false, 'swapped lat/lon must be rejected');
console.log('coordinate checks pass');
console.log('DISTANCE TESTS PASSED');

// Ride quote: price is derived from the stored coordinates and the rate
const { quoteRide } = require('../utils/geo');
const q = quoteRide({ fromLat: 19.9975, fromLon: 73.7898, toLat: 18.5204, toLon: 73.8567, ratePerKm: 10 });
assert.strictEqual(q.ok, true);
assert.strictEqual(q.distanceKm, 164.4);
assert.strictEqual(q.price, 1644, 'price = distance x rate');
assert.strictEqual(quoteRide({ fromLat: 19.99, fromLon: 73.79, toLat: 19.99, toLon: 73.79, ratePerKm: 10 }).ok, false, 'same place rejected');
assert.strictEqual(quoteRide({ fromLat: 73.79, fromLon: 19.99, toLat: 18.5, toLon: 73.8, ratePerKm: 10 }).ok, false, 'swapped coordinates rejected');
assert.strictEqual(quoteRide({ fromLat: 19.99, fromLon: 73.79, toLat: 18.5, toLon: 73.8, ratePerKm: 9999 }).ratePerKm, 50, 'rate clamped');
console.log('ride quote checks pass');
