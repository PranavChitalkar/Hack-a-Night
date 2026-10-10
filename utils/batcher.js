/**
 * Asynchronous request batcher.
 *
 * Requests are queued as they arrive. Every `windowSeconds` the queue is flushed:
 * requests are grouped into time windows and then pooled into feasible groups
 * (see utils/poolPlanner.js). Each pool gets a full route plan and fare split.
 */

const { groupIntoWindows, formFeasiblePools, buildPoolPlan, DEFAULT_MAX_DETOUR } = require('./poolPlanner');

class SlidingWindowBatcher {
    constructor(windowSeconds = 15) {
        this.windowSeconds = windowSeconds;
        this.queue = [];
        this.history = [];
    }

    addRequest(request) {
        if (!request.pickup || !request.dropoff) {
            throw new Error('Each request needs pickup and dropoff coordinates');
        }
        const entry = {
            id: String(request.id || `req-${Date.now()}-${Math.floor(Math.random() * 1000)}`),
            name: request.passengerName || request.name || 'Commuter',
            pickup: request.pickup,
            dropoff: request.dropoff,
            gender: request.gender || '',
            womenOnly: !!request.womenOnly,
            timestamp: request.timestamp || Date.now()
        };
        this.queue.push(entry);
        return entry;
    }

    /**
     * Flush the queue: returns the planned pools for every window.
     * `ratePerKm` and `maxDetourRatio` apply to all pools in this flush.
     */
    flush({ ratePerKm = 10, maxDetourRatio = DEFAULT_MAX_DETOUR } = {}) {
        const requests = this.queue.splice(0, this.queue.length);
        const windows = groupIntoWindows(requests, this.windowSeconds);

        const pools = [];
        for (const w of windows) {
            const { pools: formed, unpooled } = formFeasiblePools(w.requests, { maxDetourRatio });
            for (const group of formed) {
                pools.push({
                    windowOpenedAt: w.openedAt,
                    passengers: group,
                    plan: buildPoolPlan(group, { ratePerKm, maxDetourRatio })
                });
            }
            unpooled.forEach(u => pools.push({
                windowOpenedAt: w.openedAt,
                passengers: [u.passenger],
                plan: { success: false, feasible: false, error: u.reason }
            }));
        }

        const record = { processedAt: new Date(), requestCount: requests.length, pools };
        this.history.unshift(record);
        if (this.history.length > 20) this.history.pop();
        return record;
    }

    getBufferStatus() {
        return { bufferedCount: this.queue.length, windowSeconds: this.windowSeconds };
    }
}

module.exports = new SlidingWindowBatcher(15);
