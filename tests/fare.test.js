const assert = require('assert');
const { splitFare } = require('../utils/fareSplit');
const { getDriverStatus, isDriverApproved } = require('../utils/driverStatus');

// Ride with posted price ₹300; three passengers with different segments
const ride = { price: 300, fromLat: 19.99, fromLon: 73.79, toLat: 19.91, toLon: 73.86, from: 'Nashik', to: 'Ozar' };
const booking = (id, name, pl, pn, dl, dn) => ({
    _id: id, passenger: name, pickupLat: pl[0], pickupLon: pl[1], dropoffLat: dl[0], dropoffLon: dl[1], passengerGender: 'female'
});
const group = [
    booking('a', 'Asha', [19.9975, 73.7898], 0, [19.9204, 73.8567], 0),
    booking('b', 'Bina', [19.9850, 73.7950], 0, [19.9300, 73.8400], 0),
    booking('c', 'Chitra', [19.9700, 73.8050], 0, [19.9100, 73.8600], 0)
];

const res = splitFare(group, ride);
assert.strictEqual(res.method, 'shapley');
const total = res.shares.reduce((s, x) => s + x.share, 0);
assert.ok(Math.abs(total - 300) < 0.005, 'shares must add up exactly to the posted price, got ' + total);
res.shares.forEach(s => assert.ok(s.share > 0, 'every share positive'));
console.log('shares:', res.shares.map(s => `${s.passenger}=₹${s.share}`).join(', '));
console.log('checks:', JSON.stringify(res.checks));

// Single passenger pays the full posted price
const solo = splitFare([group[0]], ride);
assert.strictEqual(solo.shares[0].share, 300);

// Missing coordinates fall back to an equal split that still adds up
const noCoords = [{ _id: 'x', passenger: 'X' }, { _id: 'y', passenger: 'Y' }, { _id: 'z', passenger: 'Z' }];
const eq = splitFare(noCoords, { price: 100, from: 'A', to: 'B' });
assert.strictEqual(eq.method, 'equal');
assert.ok(Math.abs(eq.shares.reduce((s, x) => s + x.share, 0) - 100) < 0.005);
console.log('equal fallback:', eq.shares.map(s => s.share).join(' + '), '=100');

// Driver verification: one consistent rule
assert.strictEqual(getDriverStatus({}), 'not_submitted');
assert.strictEqual(getDriverStatus({ driverLicense: { licenseNumber: 'MH12' }, vehicle: { model: 'Swift' } }), 'pending_review');
// Legacy auto-verified flags are NOT trusted: still pending admin review
assert.strictEqual(getDriverStatus({ driverLicense: { isVerified: true, licenseNumber: 'x' }, vehicle: { isVerified: true, model: 'y' } }), 'pending_review');
assert.strictEqual(isDriverApproved({ driverLicense: { status: 'verified', licenseNumber: 'x' }, vehicle: { status: 'verified', model: 'y' } }), true);
assert.strictEqual(isDriverApproved({ driverLicense: { status: 'verified', licenseNumber: 'x' }, vehicle: { status: 'pending', model: 'y' } }), false);
assert.strictEqual(getDriverStatus({ driverLicense: { status: 'verified', licenseNumber: 'x' }, vehicle: { status: 'rejected', model: 'y' } }), 'rejected');
console.log('driver verification rules hold');
console.log('FARE TESTS PASSED');
