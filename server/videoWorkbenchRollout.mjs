function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function ownerEmailFrom(value) {
  if (typeof value === 'string') return normalizeEmail(value);
  return normalizeEmail(value?.email);
}

function unavailable() {
  return Object.assign(new Error('video workbench is not available'), {
    code: 'VIDEO_WORKBENCH_UNAVAILABLE',
  });
}

export function createVideoWorkbenchRollout({ enabled = false, authorizeOwner } = {}) {
  if (typeof authorizeOwner !== 'function') throw new TypeError('authorizeOwner is required');
  const globalEnabled = enabled === true;

  function isEligible(value) {
    if (!globalEnabled) return false;
    const email = normalizeEmail(value);
    if (!email) return false;
    try {
      const access = authorizeOwner(email);
      return access?.ok === true && ownerEmailFrom(access) === email;
    } catch {
      return false;
    }
  }

  function enabledForRequest(req, authenticateOwner) {
    if (!globalEnabled || typeof authenticateOwner !== 'function') return false;
    try {
      return isEligible(ownerEmailFrom(authenticateOwner(req)));
    } catch {
      return false;
    }
  }

  return Object.freeze({
    isEligible,
    enabledForRequest,
    requireEligible(value) {
      const email = normalizeEmail(value);
      if (!isEligible(email)) throw unavailable();
      return email;
    },
    status() {
      return { enabled: globalEnabled, cohort: 'owner' };
    },
  });
}
