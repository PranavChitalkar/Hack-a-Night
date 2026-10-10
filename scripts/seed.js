/**
 * Demo data for judging. Safe to run more than once.
 *   npm run seed
 * Needs MONGO_URI in .env.
 *
 * Creates:
 *  - admin          (password: Demo@123)  admin panel
 *  - driver1        (password: Demo@123)  approved car driver, Nashik
 *  - driver2        (password: Demo@123)  approved bike driver (1 seat)
 *  - asha, bina     women, commuters (women-only pools)
 *  - rohan, kiran   commuters
 *  - three commuter requests on overlapping routes, so the next dispatch run pools them
 */
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Ride = require('../models/Ride');
const PoolRequest = require('../models/PoolRequest');
const { quoteRide } = require('../utils/geo');

const PASSWORD = 'Demo@123';

const places = {
  nashikStation: { label: 'Nashik Road Station', lat: 19.9477, lon: 73.8475 },
  collegeRoad: { label: 'College Road, Nashik', lat: 19.9850, lon: 73.7950 },
  dwarka: { label: 'Dwarka Circle, Nashik', lat: 19.9700, lon: 73.8050 },
  mainStation: { label: 'Nashik Main Station', lat: 19.9975, lon: 73.7898 },
  ozar: { label: 'Ozar, Nashik', lat: 19.9204, lon: 73.8567 },
  pune: { label: 'Pune Airport, Lohegaon', lat: 18.5793, lon: 73.9089 }
};

const users = [
  { username: 'admin', fullName: 'SwiftWheels Admin', email: 'admin@demo.local', isAdmin: true, gender: '' },
  { username: 'driver1', fullName: 'Vikas Patil', email: 'driver1@demo.local', gender: 'male', phone: '9000000001',
    vehicle: { type: 'Car', model: 'Maruti Swift', plateNumber: 'MH15 AB 1234', status: 'verified', isVerified: true },
    driverLicense: { licenseNumber: 'MH1520100001234', nameOnLicense: 'Vikas Patil', dob: '01-01-1990', expiryDate: '01-01-2035', cov: 'LMV', status: 'verified', isVerified: true, verifiedAt: new Date() } },
  { username: 'driver2', fullName: 'Sunil More', email: 'driver2@demo.local', gender: 'male', phone: '9000000002',
    vehicle: { type: 'Bike', model: 'Honda Activa', plateNumber: 'MH15 CD 5678', status: 'verified', isVerified: true },
    driverLicense: { licenseNumber: 'MH1520100005678', nameOnLicense: 'Sunil More', dob: '02-02-1988', expiryDate: '02-02-2033', cov: 'LMV', status: 'verified', isVerified: true, verifiedAt: new Date() } },
  { username: 'asha', fullName: 'Asha Sharma', email: 'asha@demo.local', gender: 'female', phone: '9000000011',
    emergencyContacts: [{ name: 'Mother', phone: '9000000099', email: '' }] },
  { username: 'bina', fullName: 'Bina Verma', email: 'bina@demo.local', gender: 'female', phone: '9000000012' },
  { username: 'rohan', fullName: 'Rohan Mehta', email: 'rohan@demo.local', gender: 'male', phone: '9000000013' },
  { username: 'kiran', fullName: 'Kiran Joshi', email: 'kiran@demo.local', gender: 'male', phone: '9000000014' }
];

async function main() {
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI is missing in .env');
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected. Seeding demo data...');

  const hash = await bcrypt.hash(PASSWORD, 10);
  for (const u of users) {
    const { username, ...rest } = u;
    await User.updateOne(
      { username },
      { $set: { ...rest, username, password: hash, isVerified: true, isPhoneVerified: !!rest.phone } },
      { upsert: true }
    );
  }
  console.log(`Users ready (password for all: ${PASSWORD})`);

  // A posted ride with real coordinates, priced by the server rules
  const q = quoteRide({ fromLat: places.mainStation.lat, fromLon: places.mainStation.lon, toLat: places.pune.lat, toLon: places.pune.lon, ratePerKm: 10 });
  const rideExists = await Ride.findOne({ driverUsername: 'driver1', from: places.mainStation.label, to: places.pune.label });
  if (!rideExists) {
    await Ride.create({
      driver: 'driver1', driverUsername: 'driver1',
      from: places.mainStation.label, to: places.pune.label,
      fromLat: places.mainStation.lat, fromLon: places.mainStation.lon,
      toLat: places.pune.lat, toLon: places.pune.lon,
      distanceKm: q.distanceKm, ratePerKm: q.ratePerKm, price: q.price,
      travelDate: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
      travelTime: '08:00', vehicleType: 'Car', vehicleModel: 'Maruti Swift',
      seats: 3, status: 'scheduled', stops: ['Ozar, Nashik']
    });
  }
  console.log(`Demo ride: ${q.distanceKm} km, ₹${q.price}`);

  // Three commuters on overlapping routes, waiting to be pooled
  const requests = [
    { username: 'asha', pickup: places.collegeRoad, dropoff: places.ozar, womenOnly: true },
    { username: 'bina', pickup: places.dwarka, dropoff: places.ozar, womenOnly: true },
    { username: 'rohan', pickup: places.nashikStation, dropoff: places.ozar, womenOnly: false }
  ];
  for (const r of requests) {
    const user = await User.findOne({ username: r.username }).lean();
    const active = await PoolRequest.findOne({ username: r.username, status: { $in: ['waiting', 'pooled'] } });
    if (active) continue;
    await PoolRequest.create({
      username: r.username, passengerName: user.fullName, gender: user.gender,
      womenOnly: r.womenOnly,
      pickup: { lat: r.pickup.lat, lon: r.pickup.lon, label: r.pickup.label },
      dropoff: { lat: r.dropoff.lat, lon: r.dropoff.lon, label: r.dropoff.label },
      pickupWithinMinutes: 20
    });
  }
  console.log('Commuter requests waiting. Open the Shared Rides page and press "Run matching now".');

  await mongoose.disconnect();
  console.log('Seed complete.');
}

main().catch(err => { console.error('Seed failed:', err.message); process.exit(1); });
