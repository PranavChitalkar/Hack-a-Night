# SwiftWheels: Justification Against the Evaluation Criteria

Total: 25 marks. Mentor evaluation 15 (Logic & Code Quality 5, Innovation & Problem-Solution Fit 5, UI/UX & Visual Polish 5). Judge evaluation 10 (Presentation, Pitch & Q&A).

The ratings below are our honest self-assessment, out of 5 for each mentor criterion and out of 10 for the judge criterion. Each one lists the evidence we can show and the gaps we should name before a judge finds them.

---

## 1. Logic & Code Quality (5 marks) — self-rating 4 / 5

**What a mentor looks for:** correct logic, clear structure, tests, and no obvious bugs.

**Evidence we can show**
- **Correctness is tested against an independent checker.** `tests/algorithm.test.js` compares the route solver with a brute-force search on 300 random pools. It finds the same optimum every time, and every route stays within the 15% detour bound.
- **Fairness is checked on every pool.** The Shapley shares add up exactly to the pooled fare (efficiency), and nobody pays more than riding alone (individual rationality). `tests/fare.test.js` covers both, plus the driver-verification rules.
- **Pooling is checked for validity.** `tests/dispatch.test.js` runs 40 random waiting lists and confirms every proposed pool is feasible, within the 15% bound, and women-only compliant.
- **Distance is checked against known values.** `tests/distance.test.js` compares Delhi to Mumbai (about 1,148 km) and other city pairs, and checks that the server and the route solver use the same formula.
- **Clear structure.** Each concern lives in its own module: `utils/vrptw.js` (routing), `utils/shapley.js` (fares), `utils/poolPlanner.js` and `utils/dispatchWorker.js` (pooling), `utils/driverStatus.js` (verification), `utils/geo.js` (distance and pricing), `utils/fareSplit.js` (per-passenger shares).
- **Bugs we found and fixed during development:** the 15% bound was silently relaxed; a fallback route could break it. Cancelling a booking never worked because a generic route swallowed the request. Payments marked a whole ride as paid. Random distances were used for prices. The server now sets prices from stored coordinates.
- **One rule in each place.** Driver approval is decided by one function on the server and mirrored on the client. Distance and pricing come from one module.

**Gaps to name honestly**
- The database flows (bookings, payments, approvals, SOS) have been checked by code review and a live server start, but not run end to end against MongoDB. Say this and offer to run it live.
- The frontend has no automated UI tests and no linter. Logic is tested; screens are checked by hand.
- Some logic is duplicated on the server and the client (the driver-status rule and the distance formula). Both copies are kept identical and labelled.
- Native browser dialogs (`alert`, `confirm`, `prompt`) are still used in 8 places.

**How to strengthen before the review:** run `npm test` live during the presentation. It takes seconds and shows the evidence directly.

---

## 2. Innovation & Problem–Solution Fit (5 marks) — self-rating 4 / 5

**What a mentor looks for:** does the project solve the stated problem, and is the approach new or better?

**Problem statement, requirement by requirement**

| Requirement | How SwiftWheels meets it |
|---|---|
| Pool rides with dynamic sliding-window batching | A background worker runs every 15 seconds and pools all waiting commuter requests. Requests expire after 30 minutes; pools release after 10 minutes if no driver takes them. |
| Solve VRPTW with detours of 15% or less | Exact branch-and-bound search with pickup and drop-off order, capacity, time windows, and a hard 15% detour bound for every rider. |
| Cooperative game theory: Shapley value for fair cost sharing | Each rider's share is their Shapley value, scaled so the shares add up exactly to the ride price. Checked for efficiency and individual rationality. |
| Real-time dispatch dashboard | Shared Rides page: commuters track their request; drivers see live pools with stop order and fares and accept one. |
| Interactive map routing | Driver route planner and live tracking map (OpenStreetMap, Leaflet). |
| Asynchronous batching of requests | Requests are queued and pooled by the worker, independent of the user's session. |
| Dynamic multi-passenger pickup and drop-off sequencing | The solver orders pickups and drop-offs; the itinerary panel shows the order with estimated times. |
| Live itinerary updates | The driver dashboard refreshes the itinerary every 10 seconds, and the driver's position is shared while a trip is active. |
| Game-theoretically fair fare-splitting breakdown | The Fare Breakdown table shows solo fare, extra for sharing, each rider's fare, savings, and the total. |
| Mobile interface | **Partly.** The web app is responsive in a phone browser. There is no native mobile app. |

**What makes it different**
- **A guaranteed detour bound per rider, not an average.** Many pooling services optimise for average travel time. We reject any pool where a single rider's detour exceeds 15%.
- **Fair, provable cost sharing.** Each rider's share is their Shapley value. We can explain why it is fair, not just say that it is.
- **Built-in safety for riders who need it.** Women-only pools are enforced by the matching worker, not just a filter. Emergency contacts, SOS alerts, and shareable trip links are part of the same flow.
- **Drivers are checked before they can take passengers.** Approval covers both the license and the vehicle, and one admin decision approves both.

**Honest positioning:** ride-pooling already exists commercially. Our claim is not that we invented pooling. Our claim is that the detour and fairness guarantees are explicit, tested, and explainable.

**Gaps to name honestly**
- Distances are straight-line, not road distance, so fares are lower than a road-based fare would be.
- Payments are a demo. The fare calculation is real.
- Gender for women-only pools is self-declared.
- The planner page still runs on sample passengers. The live data is on the Shared Rides page.

---

## 3. UI/UX & Visual Polish (5 marks) — self-rating 3 / 5

**What a mentor looks for:** is the interface clear, consistent, easy to use, and visually finished?

**What already works**
- One visual language across pages: cards, status badges with the same colours, and clear headings.
- Each role sees only what they need: commuters, drivers, and admins each have their own pages.
- Empty states explain what to do next (for example, "Pools appear when commuters on overlapping routes are matched").
- Live pages refresh on their own (My Trips, Shared Rides, the itinerary, and tracking).
- The map shows stops in order, and the fare table adds up visibly.
- Plain language for users. Technical names such as "PaddleOCR", "Shapley", and "VRPTW" are removed from the screens.

**Fixed in this round**
- Removed the technical names from all user-facing text, including the landing page and error messages.
- Fixed a search message that reported the previous result count.
- Fixed invalid attributes in three dialogs that caused React warnings.
- Pickup location now shows its accuracy and refuses a rough GPS fix.

**Priority improvements (most impact first)**

| # | Improvement | Why it matters | Effort |
|---|---|---|---|
| 1 | Replace the 8 native `alert`/`confirm`/`prompt` dialogs with in-app dialogs | Native dialogs look unfinished and break the design | Medium |
| 2 | Connect the planner page to live pool data | Judges will ask whether the dashboard is real; right now the planner uses sample passengers | Medium |
| 3 | Test and tune the layout at phone width (about 390 px) | The problem asks for a mobile interface; this is the cheapest way to show it | Low–medium |
| 4 | Loading placeholders on Marketplace, My Trips, and Shared Rides | Avoids blank screens while data loads | Low |
| 5 | Format money consistently (₹1,644, not ₹1644) and dates as "Today, 08:00" | Small details that judges notice | Low |
| 6 | Add a map legend on the planner (green = pick-up, red = drop-off) | Makes the map readable without the popups | Low |
| 7 | Accessibility: label every input, give icon-only buttons text for screen readers, and keep focus inside modals | Strong polish signal and a common reviewer check | Low–medium |
| 8 | One navigation control on small screens (two currently exist) | Reduces confusion on phones | Low |
| 9 | Three-role overview on the landing page: commuter, driver, admin | Helps a judge understand the product in ten seconds | Low |

---

## 4. Presentation, Pitch & Q&A (10 marks) — self-rating depends on rehearsal

**What a judge looks for:** a clear story, a working demo, and confident answers.

**Pitch (about 3 minutes)**
1. **Problem (20 s).** Commuters on the same corridor drive alone, and naive matching cannot handle several stops or split costs fairly.
2. **Idea (20 s).** Pool commuters every 15 seconds, keep every rider within 15% of their direct distance, and split the fare by each rider's fair share.
3. **Live demo (2 min).** Follow the script in `DEMO_AND_PRESENTATION.md`: two commuters request, a driver pools and accepts, the fares add up, the planner shows the route and the 15% check.
4. **Proof (30 s).** Show `npm test`. Say: "Every route is checked against an independent brute-force search, and every fare split adds up."
5. **Impact and next steps (20 s).** Fewer cars and lower fares. Next: road-distance routing, a native mobile app, and identity checks for women-only pools.

**Rehearsal checklist**
- Run the whole demo twice on the machine you will use on the day.
- Check the internet connection before judges arrive (place search and map tiles need it).
- Keep a backup copy of the project zip on a USB drive.
- Know which claims to avoid (below), and say the limitations before being asked.

**Claims to avoid**
- "Production-ready" or "ready for a city". Say "working prototype" and name what is next.
- "Real payments". Say the payment step is a demo and the fare calculation is real.
- "Verified identity for women-only pools". Say gender is self-declared.
- "Road-distance fares". Say straight-line distances are used.
- "Native mobile app". Say the web app works on phones and a native app is next.

**Likely judge questions** (more answers are in `DEMO_AND_PRESENTATION.md`)
- *How do you know the routes are correct?* Brute-force comparison and the 15% check on every pool.
- *What is the Shapley value in plain words?* Each rider pays their average share of the extra cost they add, across every order they could have joined the group. It is fair and it never charges more than riding alone.
- *What if no pool is possible?* The request waits up to 30 minutes, then expires. The commuter can cancel at any time.
- *How do you verify drivers?* Admin approves the license and vehicle together. The license is read automatically from a photo, but only an admin can approve it.
- *What would you do with another month?* Road-distance routing, live database testing, UI tests, and a mobile app.
- *Who else could use this?* Office and campus commuters on fixed corridors, where the routes overlap every day.

---

## 5. Summary of self-ratings

| Criterion | Marks | Self-rating | What would raise it |
|---|---|---|---|
| Logic & Code Quality | 5 | 4 | Run the database flows live; add UI tests |
| Innovation & Problem Fit | 5 | 4 | Show the live dashboard fed by real requests (done); add road distance |
| UI/UX & Visual Polish | 5 | 3 | Priority items 1–4 in the UI table |
| Presentation, Pitch & Q&A | 10 | depends on rehearsal | Two full rehearsals; practise the Q&A |
