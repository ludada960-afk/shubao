const DEFAULT_CONFIG = Object.freeze({ mode: 'images', format: 'PNG' });

export function createExportDeliveryState(config = {}) {
  return {
    status: 'configuring',
    config: { ...DEFAULT_CONFIG, ...config },
    destination: null,
    progress: { completed: 0, total: 0 },
    result: null,
    error: '',
  };
}

export function exportDeliveryReducer(state, action = {}) {
  switch (action.type) {
    case 'reset':
      return createExportDeliveryState(action.config || state?.config);
    case 'configure':
      return {
        ...state,
        status: 'configuring',
        config: { ...state.config, ...action.config },
        destination: null,
        progress: { completed: 0, total: 0 },
        result: null,
        error: '',
      };
    case 'destination-ready':
      return {
        ...state,
        status: 'destination-ready',
        destination: action.destination,
        progress: { completed: 0, total: 0 },
        result: null,
        error: '',
      };
    case 'preparing':
      return { ...state, status: 'preparing', progress: { completed: 0, total: action.total || 0 }, error: '' };
    case 'writing':
      return { ...state, status: 'writing', progress: { completed: 0, total: action.total || 0 }, error: '' };
    case 'progress':
      return { ...state, progress: { completed: action.completed || 0, total: action.total || state.progress.total || 0 } };
    case 'success':
      return { ...state, status: 'success', result: { count: action.count || 0, verification: action.verification || 'download-started' }, progress: { completed: action.count || 0, total: action.count || state.progress.total || 0 }, error: '' };
    case 'cancelled':
      return { ...state, status: 'cancelled', error: '' };
    case 'error':
      return { ...state, status: 'error', error: action.error || '导出失败' };
    default:
      return state;
  }
}

export function isExportDeliveryBusy(state) {
  return state?.status === 'preparing' || state?.status === 'writing';
}
