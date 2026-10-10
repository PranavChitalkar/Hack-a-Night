# SwiftWheels: Demo and Presentation Guide

## 1. One-line pitch
SwiftWheels pools commuters on overlapping routes in real time, keeps every rider's detour within 15%, and splits the fare fairly with a Shapley value, so that each rider pays only their share.

## 2. Before the judges arrive (checklist)
- [ ] `.env` has `MONGO_URI` (MongoDB Atlas) and email settings.
- [ ] `npm install`, then `npm run build`, then `npm run seed`, then `npm start`.
- [ ] `npm test` passes (algorithm, fare, distance, dispatch tests).
- [ ] Open http://localhost:3000 in Chrome. Allow location when asked.
- [ ] Internet is working. Place search and map tiles need it.
- [ ] Keep a second browser window in private mode for the commuter side.
- [ ] Keep a backup copy of the project zip on a USB drive.

Demo accounts (password `Demo@123` for all):
| User | Role | Notes |
|---|---|---|
| `asha` | Commuter, female | Women-only pool |
| `bina` | Commuter, female | Pools with Asha |
| `rohan` | Commuter, male | Stays waiting: cannot join a women-only pool |
| `driver1` | Approved car driver (3 seats) | Accepts pools |
| `driver2` | Approved bike driver (1 seat) | Cannot accept pools |
| `admin` | Admin | Approvals, SOS alerts |

## 3. Live demo script (about 6 minutes)
1. **Commuter request (1 min).** Log in as `asha`. Open *Shared Rides*. Find "College Road" to "Ozar", pick the suggestion, set "pickup within 20 minutes", and submit. Point out that the request is waiting.
2. **Second commuter (30 s).** In the private window, log in as `bina`. Request "Dwarka Circle" to "Ozar". Both are waiting.
3. **Women-only rule (30 s).** Log in as `rohan` and request "Nashik Road Station" to "Ozar". Show that he is not pooled with the women-only group.
4. **Dispatch (1 min).** Log in as `driver1`. Open *Shared Rides* and press **Run matching now**. An open pool of Asha and Bina appears, with the stop order (pick-ups before drop-offs), the total distance, and the total fare.
5. **Accept (30 s).** Press **Accept pool**. Asha and Bina are booked on one ride. Log in as `asha` and open *My Trips* to show her share, the payment button, and the **Share trip link** button.
6. **Route and fare planner (1.5 min).** Open *Route & Fare Planner*. Show the map and the stop order, the detour table (every rider under 15%), and the Shapley breakdown. Point to the fairness line: the shares add up to the pooled fare.
7. **Safety (30 s).** Open *Safety Center*. Show the women-only option, emergency contacts, and the SOS button (describe it; do not press it in front of judges unless asked).
8. **Admin (30 s, optional).** Log in as `admin`. Show pending driver approvals (one approval covers license and vehicle) and the SOS alert list.

## 4. Slide outline (5 slides)
1. **Problem.** Commuters on the same corridor drive alone. Naive matching ignores multi-stop routes and fair cost sharing.
2. **Solution.** Four parts: dynamic pooling every 15 seconds, exact multi-stop routing with a 15% detour bound, Shapley fare sharing, and a live dispatch board.
3. **How it works.** Request → pool → route → accept → share fare → track. Show the flow diagram from the demo.
4. **Proof.** Test results (see section 5) and the guarantees: no pool breaks the 15% bound, shares always add up, nobody pays more than riding alone.
5. **Impact and next steps.** Fewer cars and lower fares per commuter. Next: road-distance routing, native mobile app, SMS alerts.

## 5. Evidence to show (what is actually tested)
- The route solver matches an independent brute-force search on 300 random pools.
- Every proposed pool stays within the 15% detour bound and the pickup time windows.
- Shapley shares add up exactly to the pooled fare, and nobody pays more than riding alone.
- Distances match known city pairs (Delhi to Mumbai about 1,148 km).
- Women-only pools never mix genders.

Run `npm test` during the presentation if a judge asks for proof.

## 6. Likely judge questions and answers

**Why Shapley value?**
It is the standard fair way to split a shared cost. Each rider pays their average marginal cost across all the ways they could join the group. It is the only split that is efficient (everyone's share adds up), symmetric, and never charges a rider more than riding alone. We check all three on every pool.

**Why exact search and not a heuristic?**
Pools are at most 4 riders, which is 8 stops. An exact branch-and-bound search finishes in milliseconds at that size, and we verified it against brute force. A heuristic could miss the cheapest route or break the 15% bound.

**What is the 15% rule exactly?**
For every rider, the distance they travel in the shared vehicle (from pickup to drop-off) must be at most 1.15 times their direct distance. The search cuts any branch that breaks this as soon as it happens.

**What happens if nobody can be pooled?**
The request stays waiting for up to 30 minutes, then expires. Commuters can cancel at any time. Pools that no driver accepts within 10 minutes are released, and the riders go back to waiting.

**Why is distance straight-line and not road distance?**
Straight-line distance is exact and free, and it is the same everywhere in the app, so fares and detours agree. Road distance is usually 20 to 40 percent longer. Adding it needs a routing service, which is our next step. We say "straight-line" on every screen so nothing is misleading.

**Is the payment real?**
No. The payment step is a demo and no money moves. The fare calculation (each passenger's share) is real and is what a payment gateway would charge.

**Can someone fake being a woman to join a women-only ride?**
Gender is self-declared, so this is a preference, not a verified identity check. The safeguard is that a women-only pool can only contain riders who declared female. Identity verification would be a separate step, for example phone or document checks, and is listed as next steps.

**How do you know drivers are safe?**
A driver can post or accept rides only after an admin approves both the driving license and the vehicle. The license is read automatically from a photo, but only an admin can approve it. Passengers see the driver's verified status and can share their trip with family.

**What about the SOS button?**
It records an alert, shows it to admins, and emails the admin and any emergency contact with an email address, with the passenger's location if they allow it. Contacts without email must be called directly. It shows 112 (emergency) and 1091 (women's helpline).

**Does it scale?**
The pool search runs only on pools of up to 4, and the dispatch worker handles at most 200 waiting requests per tick. For larger cities we would split requests by area before pooling, which is a straightforward change.

**Why did you not use Mapbox?**
We use OpenStreetMap and Leaflet, which are free and need no billing. Nothing in the algorithm depends on the map provider.

**Is there a mobile app?**
The web app is responsive and works in a phone browser. A native app is the next step; the backend is already an API that a mobile client can use.

**How would you explain the algorithm in one minute?**
Say: "The routing is a vehicle-routing problem with time windows and a detour constraint. We solve it exactly for small pools and verify it with a brute-force checker. The fare split is cooperative game theory, specifically the Shapley value, and we check efficiency and individual rationality."

## 7. Honest limitations (say these before judges find them)
- Road distance is not used; straight-line distance is.
- Payments are a demo.
- Gender for women-only pools is self-declared.
- The app has been tested with unit tests and a live server start, but the full database flow has not been run against a real MongoDB in our test environment. Run the demo once before judging.
- The vehicle is assumed to start at the first pickup. We do not model the driver's own starting point yet.
- SMS alerts are not sent; SOS uses email only.
- No native mobile app.

## 8. Mentor scoring: what to point at
- **Logic and code quality (5):** separate modules for routing, fare split, verification, and dispatch; tests for each; one place for distance rules.
- **Innovation and problem fit (5):** dynamic pooling with a hard detour guarantee, fair Shapley fares, and women-only pooling, all in one flow.
- **UI and visual polish (5):** one dashboard with the map, stop order, and fare breakdown; a commuter page with live status; the same status colours across pages.
