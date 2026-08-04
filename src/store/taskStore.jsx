import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useReducer,
  useRef,
} from 'react';
import { listEcommerceTasks } from '../services/api.js';
import { getSessionToken } from '../services/auth.js';
import { useApp } from './AppContext.jsx';
import { hasActiveDurableTasks, normalizeDurableTask } from './durableTaskModel.js';
import { taskSyncMessage } from '../services/taskSync.js';

const TaskContext = createContext(null);

const LOCAL_STATUS_ORDER = ['queued', 'reading', 'parsing', 'generating', 'done', 'error'];
const ACTIVE_SERVER_STATES = new Set(['queued', 'analyzing', 'generating']);
const FAILED_SERVER_STATES = new Set(['needs_review', 'failed']);

function isValidLocalTransition(from, to) {
  const fromIndex = LOCAL_STATUS_ORDER.indexOf(from);
  const toIndex = LOCAL_STATUS_ORDER.indexOf(to);
  if (from === 'error') return to === 'queued';
  if (from === 'generating' && to === 'error') return true;
  if (from === 'queued' && ['generating', 'error'].includes(to)) return true;
  return toIndex > fromIndex && toIndex - fromIndex <= 2;
}

function serverTaskView(job) {
  const task = normalizeDurableTask(job);
  return {
    ...task,
    source: 'server',
    type: 'ec',
    stage: task.status,
    progress: { done: task.done, total: task.total },
    params: { product_name: task.title },
  };
}

function taskReducer(state, action) {
  switch (action.type) {
    case 'HYDRATE_DURABLE_TASKS': {
      const localTasks = state.tasks.filter(task => task.source !== 'server');
      return { ...state, tasks: [...action.tasks, ...localTasks], loadError: '' };
    }

    case 'CLEAR_DURABLE_TASKS':
      return {
        ...state,
        tasks: state.tasks.filter(task => task.source !== 'server'),
        loadError: '',
      };

    case 'DURABLE_TASKS_ERROR':
      return { ...state, loadError: action.error || '任务列表暂时无法刷新' };

    case 'ADD_TASK': {
      const task = {
        id: `task_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        source: 'local',
        type: action.taskType,
        status: 'queued',
        stage: '',
        progress: null,
        error: null,
        result: null,
        retryCount: 0,
        maxRetries: 3,
        createdAt: Date.now(),
        params: action.params || {},
      };
      return { ...state, tasks: [...state.tasks, task] };
    }

    case 'UPDATE_TASK': {
      const { id, ...updates } = action;
      const tasks = state.tasks.map(t => {
        if (t.id !== id) return t;
        if (t.source === 'server') return t;
        const newStatus = updates.status || t.status;
        if (updates.status && !isValidLocalTransition(t.status, newStatus)) return t;
        return { ...t, ...updates };
      });
      return { ...state, tasks };
    }

    case 'REMOVE_TASK':
      return { ...state, tasks: state.tasks.filter(task => task.id !== action.id || task.source === 'server') };

    case 'CLEAR_DONE':
      return { ...state, tasks: state.tasks.filter(task => task.source === 'server' || task.status !== 'done') };

    case 'RETRY_TASK': {
      const tasks = state.tasks.map(task => {
        if (task.id !== action.id || task.source === 'server') return task;
        return {
          ...task,
          status: 'queued',
          stage: '重试中…',
          error: null,
          retryCount: task.retryCount + 1,
        };
      });
      return { ...state, tasks };
    }

    default:
      return state;
  }
}

const initialTaskState = { tasks: [], loadError: '' };

export function TaskProvider({ children }) {
  const { state: appState } = useApp();
  const [state, dispatch] = useReducer(taskReducer, initialTaskState);
  const requestRef = useRef(null);

  const refreshTasks = useCallback(async () => {
    if (!getSessionToken()) {
      dispatch({ type: 'CLEAR_DURABLE_TASKS' });
      return;
    }

    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    try {
      const jobs = await listEcommerceTasks({ signal: controller.signal });
      if (controller.signal.aborted) return;
      dispatch({
        type: 'HYDRATE_DURABLE_TASKS',
        tasks: jobs.map(serverTaskView).filter(task => task.id),
      });
    } catch (error) {
      if (controller.signal.aborted || error?.name === 'AbortError') return;
      if (error?.status === 401) {
        dispatch({ type: 'CLEAR_DURABLE_TASKS' });
        return;
      }
      dispatch({ type: 'DURABLE_TASKS_ERROR', error: taskSyncMessage(error) });
    } finally {
      if (requestRef.current === controller) requestRef.current = null;
    }
  }, []);

  const durableTasks = state.tasks.filter(task => task.source === 'server');
  const hasActiveTasks = hasActiveDurableTasks(durableTasks);

  useEffect(() => {
    if (!appState.logged || !getSessionToken()) {
      requestRef.current?.abort();
      dispatch({ type: 'CLEAR_DURABLE_TASKS' });
      return undefined;
    }

    refreshTasks();
    const interval = globalThis.setInterval(refreshTasks, hasActiveTasks ? 3000 : 15000);
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') refreshTasks();
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      globalThis.clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      requestRef.current?.abort();
    };
  }, [appState.logged, appState.phone, hasActiveTasks, refreshTasks]);

  const addTask = useCallback((taskType, params) => {
    dispatch({ type: 'ADD_TASK', taskType, params });
  }, []);
  const updateTask = useCallback((id, updates) => {
    dispatch({ type: 'UPDATE_TASK', id, ...updates });
  }, []);
  const removeTask = useCallback(id => dispatch({ type: 'REMOVE_TASK', id }), []);
  const retryTask = useCallback(id => dispatch({ type: 'RETRY_TASK', id }), []);
  const clearDone = useCallback(() => dispatch({ type: 'CLEAR_DONE' }), []);

  const activeCount = state.tasks.filter(task => (
    task.source === 'server'
      ? ACTIVE_SERVER_STATES.has(task.status)
      : ['queued', 'reading', 'parsing', 'generating'].includes(task.status)
  )).length;
  const errorCount = state.tasks.filter(task => (
    task.source === 'server'
      ? FAILED_SERVER_STATES.has(task.status) || task.failed > 0
      : task.status === 'error'
  )).length;

  return (
    <TaskContext.Provider value={{
      tasks: state.tasks,
      activeCount,
      errorCount,
      loadError: state.loadError,
      refreshTasks,
      addTask,
      updateTask,
      removeTask,
      retryTask,
      clearDone,
      dispatch,
    }}>
      {children}
    </TaskContext.Provider>
  );
}

export function useTasks() {
  const context = useContext(TaskContext);
  if (!context) throw new Error('useTasks must be inside TaskProvider');
  return context;
}

export { initialTaskState, taskReducer };
