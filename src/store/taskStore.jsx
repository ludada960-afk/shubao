/**
 * 薯包AI 任务状态管理
 *
 * 独立于 AppContext，与页面路由完全解耦。
 * 任务后台常驻，切换页面、折叠弹窗不影响运行。
 *
 * 任务生命周期：
 *   queued → reading → parsing → generating [→ done | error]
 *           └──────── batch: { total, done } ────────┘
 *   error → 自动重试3次 → 标记 error
 */

import { createContext, useContext, useReducer, useCallback, useRef } from 'react';

const TaskContext = createContext(null);

// ── 任务状态机 ──
const STATUS_ORDER = ['queued', 'reading', 'parsing', 'generating', 'done', 'error'];

/**
 * 判断从 from 到 to 的状态转换是否合法
 */
function isValidTransition(from, to) {
  const fi = STATUS_ORDER.indexOf(from);
  const ti = STATUS_ORDER.indexOf(to);
  if (from === 'error') return to === 'queued';  // 重试 → 重新入队
  if (from === 'generating' && to === 'error') return true;
  if (from === 'queued' && to === 'generating') return true; // 跳过读图直出
  if (from === 'queued' && to === 'error') return true;
  // 正常递进
  return ti > fi && ti - fi <= 2;  // 最多跳1中间态
}

// ── Reducer ──
function taskReducer(state, action) {
  switch (action.type) {
    case 'ADD_TASK': {
      const task = {
        id: 'task_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
        type: action.taskType,     // 'xhs' | 'ec'
        status: 'queued',
        stage: '',                 // 当前阶段描述
        progress: null,            // { total, done }
        error: null,
        result: null,
        retryCount: 0,
        maxRetries: 3,
        createdAt: Date.now(),
        params: action.params || {},  // 生图参数
      };
      return { ...state, tasks: [...state.tasks, task] };
    }

    case 'UPDATE_TASK': {
      const { id, ...updates } = action;
      const tasks = state.tasks.map(t => {
        if (t.id !== id) return t;
        const newStatus = updates.status || t.status;
        if (updates.status && !isValidTransition(t.status, newStatus)) {
          console.warn(`[Task] 非法状态转换: ${t.status} → ${newStatus} (task=${id})`);
          return t;
        }
        return { ...t, ...updates };
      });
      return { ...state, tasks };
    }

    case 'REMOVE_TASK':
      return { ...state, tasks: state.tasks.filter(t => t.id !== action.id) };

    case 'CLEAR_DONE':
      return { ...state, tasks: state.tasks.filter(t => t.status !== 'done') };

    case 'RETRY_TASK': {
      const tasks = state.tasks.map(t => {
        if (t.id !== action.id) return t;
        return {
          ...t,
          status: 'queued',
          stage: '重试中…',
          error: null,
          retryCount: t.retryCount + 1,
        };
      });
      return { ...state, tasks };
    }

    default:
      return state;
  }
}

const initialTaskState = { tasks: [] };

// ── Provider ──
export function TaskProvider({ children }) {
  const [state, dispatch] = useReducer(taskReducer, initialTaskState);
  // 保存 dispatch 引用以便在组件外使用
  const dispatchRef = useRef(dispatch);
  dispatchRef.current = dispatch;

  const addTask = useCallback((taskType, params) => {
    dispatch({ type: 'ADD_TASK', taskType, params });
  }, []);

  const updateTask = useCallback((id, updates) => {
    dispatch({ type: 'UPDATE_TASK', id, ...updates });
  }, []);

  const removeTask = useCallback((id) => {
    dispatch({ type: 'REMOVE_TASK', id });
  }, []);

  const retryTask = useCallback((id) => {
    dispatch({ type: 'RETRY_TASK', id });
  }, []);

  const clearDone = useCallback(() => {
    dispatch({ type: 'CLEAR_DONE' });
  }, []);

  // 获取活跃任务数（排队/进行中）
  const activeCount = state.tasks.filter(t =>
    ['queued', 'reading', 'parsing', 'generating'].includes(t.status)
  ).length;

  // 获取可展示的失败数
  const errorCount = state.tasks.filter(t => t.status === 'error').length;

  return (
    <TaskContext.Provider value={{
      tasks: state.tasks,
      activeCount,
      errorCount,
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
  const ctx = useContext(TaskContext);
  if (!ctx) throw new Error('useTasks must be inside TaskProvider');
  return ctx;
}

export { initialTaskState, taskReducer };
