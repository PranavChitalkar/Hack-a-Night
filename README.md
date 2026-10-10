# 🚗 SwiftWheels | Smart Urban Carpooling Platform

![Project Status](https://img.shields.io/badge/Status-Active-success)
![License](https://img.shields.io/badge/License-MIT-blue)
![Tech Stack](https://img.shields.io/badge/Stack-MERN-yellow)

**SwiftWheels** is a full-stack web application designed to solve urban traffic congestion through efficient carpooling. It connects daily commuters with verified drivers, featuring real-time route optimization, secure email notifications, and an administrative dashboard for safety monitoring.

---

## 🌟 Key Features

### 🚦 Core Functionality
- **Smart Ride Matching**: Algorithms to match passengers with drivers going the same way.
- **Live Route Tracking**: Integration with **Leaflet.js** and **OSRM** for real-time maps and turn-by-turn navigation.
- **Ride Scheduling**: Users can book rides in advance or find instant matches.

### 🛡️ Security & Trust
- **Dual-Authentication**: Secure login system with hashed passwords (Bcrypt).
- **Verified Drivers**: Admin approval required for all driver accounts.
- **Instant Alerts**: Automated email confirmations for bookings, OTPs, and ride status updates using **Nodemailer**.

### 💻 Admin Dashboard
- Centralized control panel to view all users, approve drivers, and monitor active rides.

---

## 🛠️ Tech Stack

| Domain | Technologies Used |
| :--- | :--- |
| **Frontend** | HTML5, CSS3 (Glassmorphism UI), JavaScript (ES6+), Bootstrap 5 |
| **Backend** | Node.js, Express.js |
| **Database** | MongoDB (Atlas Cloud), Mongoose ODM |
| **APIs & Maps** | OpenStreetMap, Leaflet.js, OSRM (Open Source Routing Machine) |
| **Utilities** | Nodemailer (Email), Bcrypt (Security), Dotenv (Config) |

---

## 🚀 Installation & Setup

Follow these steps to run the project locally on your machine.

### 1. Clone the Repository
```bash
git clone [https://github.com/svjadhav2010-hub/SwiftWheels.git](https://github.com/svjadhav2010-hub/SwiftWheels.git)
cd SwiftWheels
```
2. Install Dependencies
Bash
npm install

3. Configure Environment Variables
Create a file named .env in the root directory. Add the following credentials:

Code snippet
# Server Configuration
PORT=3000

# Database Connection (MongoDB Atlas)
MONGO_URI=your_mongodb_connection_string

# Email Service (Gmail SMTP)
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password

# Application Settings
SYSTEM_EMAIL="SwiftWheels <your_email@gmail.com>"
ADMIN_EMAIL=your_admin_email@gmail.com
SESSION_SECRET=your_random_secret_key

4. Run the Server
Bash
# Start the application
node server.js
Visit http://localhost:3000 in your browser to see the app live.

SwiftWheels/
├── models/             # Mongoose Database Schemas (User, Ride, Booking)
├── public/             # Static Assets (HTML, CSS, Client-side JS) # Frontend logic (Map integration, Forms)
│   ├── index.html         
├── admin.html     
├── server.js           # Main Express App & Route Handlers
├── .env                # Environment Variables (Not pushed to Git)
├── .gitignore          # Files to ignore (node_modules, .env)
└── README.md           # Project Documentation
# Internship-Project

---

## 🧠 Ride-Pooling Engine

- **Batching** (`utils/batcher.js`, `utils/poolPlanner.js`): requests are grouped into fixed 15-second windows and pooled greedily into feasible groups of up to 4.
- **Routing** (`utils/vrptw.js`): exact branch-and-bound VRPTW. Enforces precedence, capacity, time windows, and a hard **15% detour bound** for every passenger. Verified against brute force in `tests/algorithm.test.js`.
- **Fare split** (`utils/shapley.js`, `utils/fareSplit.js`): Shapley value cost sharing. Shares add up exactly to the ride price, and nobody pays more than their solo fare. Verified in `tests/fare.test.js`.
- **Acceptance gate**: a driver cannot accept a passenger if it would push a co-passenger past 15% or break a time window.

## 🛡️ Safety

- Women-only rides (only passengers with gender set to female can book).
- Emergency contacts (up to 3) and an SOS alert that is recorded and emailed to admin and to contacts with email.
- Shareable live-trip link for family and friends (`/share/<token>`), which shows no phone numbers or emails.

## 🪪 Driver Verification

One rule everywhere: a driver can post rides only after an **admin approves both the driving license and the vehicle**. OCR only submits details for review. Rejections include a reason the driver can see.

## Commands

```bash
npm install
npm test            # algorithm, fare, distance and dispatch tests
npm run build       # rebuild the frontend into public/
npm run seed        # demo accounts, a ride and waiting commuters (password Demo@123)
npm start           # run the server on http://localhost:3000
```

See `DEMO_AND_PRESENTATION.md` for the demo script and judging notes.

## 🔁 Shared Rides

Commuters post a request. A background worker runs every 15 seconds, pools waiting requests on overlapping routes (detour within 15%, pickup windows respected, women-only pools single-gender), and publishes open pools. Approved drivers accept a pool, which creates the ride and one booking per commuter.
