function positiveCapacity(value, fallback = 1) {
  const number = Number(value);
  return Number.isSafeInteger(number) && number >= 0 ? number : fallback;
}

function routeState(routeId, capacity) {
  return {
    routeId,
    capacity: positiveCapacity(capacity),
    owners: [],
    buckets: new Map(),
    cursor: 0,
    active: new Map(),
    queued: new Map(),
    pumpScheduled: false,
  };
}

export function createOwnerFairVideoQueue({ capacities = {}, onError } = {}) {
  const routes = new Map();
  const allItems = new Map();
  let closed = false;

  function getRoute(routeId) {
    const key = String(routeId || '').trim();
    if (!key) throw new TypeError('routeId is required');
    if (!routes.has(key)) routes.set(key, routeState(key, capacities[key]));
    return routes.get(key);
  }

  function nextItem(state) {
    if (!state.owners.length) return null;
    for (let offset = 0; offset < state.owners.length; offset += 1) {
      const index = (state.cursor + offset) % state.owners.length;
      const owner = state.owners[index];
      const bucket = state.buckets.get(owner);
      if (bucket?.length) {
        state.cursor = (index + 1) % state.owners.length;
        const item = bucket.shift();
        state.queued.delete(item.jobId);
        return item;
      }
    }
    return null;
  }

  function schedulePump(state) {
    if (state.pumpScheduled || closed) return;
    state.pumpScheduled = true;
    queueMicrotask(() => {
      state.pumpScheduled = false;
      pump(state);
    });
  }

  function pump(state) {
    if (closed) return;
    while (state.active.size < state.capacity) {
      const item = nextItem(state);
      if (!item) break;
      state.active.set(item.jobId, item);
      allItems.set(`${state.routeId}:${item.jobId}`, item);
      Promise.resolve()
        .then(() => item.task())
        .catch(error => {
          try { onError?.(error, item); } catch {}
        })
        .finally(() => {
          state.active.delete(item.jobId);
          allItems.delete(`${state.routeId}:${item.jobId}`);
          schedulePump(state);
        });
    }
  }

  function enqueue({ routeId, ownerEmail, jobId, task } = {}) {
    if (closed) return false;
    const route = getRoute(routeId);
    const owner = String(ownerEmail || '').trim().toLowerCase();
    const id = String(jobId || '').trim();
    if (!owner || !id || typeof task !== 'function') throw new TypeError('ownerEmail, jobId, and task are required');
    const key = `${route.routeId}:${id}`;
    if (allItems.has(key) || route.queued.has(id) || route.active.has(id)) return false;
    if (!route.buckets.has(owner)) {
      route.buckets.set(owner, []);
      route.owners.push(owner);
    }
    const item = { routeId: route.routeId, ownerEmail: owner, jobId: id, task };
    route.buckets.get(owner).push(item);
    route.queued.set(id, item);
    allItems.set(key, item);
    schedulePump(route);
    return true;
  }

  function stats(routeId) {
    const route = getRoute(routeId);
    return {
      routeId: route.routeId,
      capacity: route.capacity,
      running: route.active.size,
      queued: route.queued.size,
      owners: route.owners.filter(owner => route.buckets.get(owner)?.length).length,
    };
  }

  async function idle(routeId) {
    const matches = routeId ? [getRoute(routeId)] : [...routes.values()];
    while (matches.some(route => route.active.size || route.queued.size || route.pumpScheduled)) {
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  }

  function close() {
    closed = true;
    for (const route of routes.values()) {
      for (const item of route.queued.values()) allItems.delete(`${route.routeId}:${item.jobId}`);
      route.queued.clear();
      for (const bucket of route.buckets.values()) bucket.length = 0;
    }
  }

  return { enqueue, stats, idle, close };
}
