/**
 * LongTaskProvider — V4 P0-3 (D2) 长任务全屏 overlay 状态机
 *
 * 用法:
 *   const { startLongTask, updateLongTask, stopLongTask } = useLongTask();
 *
 *   const id = 'export-manifest';
 *   startLongTask({ id, title: '生成导出清单', totalSteps: 3, stage: '准备资源' });
 *   try {
 *     await someLongWork();
 *     updateLongTask(id, { progress: 100, stage: '完成' });
 *   } finally {
 *     stopLongTask(id);
 *   }
 *
 * 设计要点:
 * - Map<id, task> 持有所有活跃任务, 支持并发长任务
 * - 显示取"最近开始"的任务的进度, 其它后台跑
 * - 失败: stopLongTask 必须在 finally 调用, 防止 overlay 卡死
 * - 进度从 0 → 100, 即使某些任务无法精确估算也应给个非空数字
 *
 * 不在范围:
 * - 替换 DirectorAssistant / AdminConsole / Plog / Remake 局部 spinner (V4 P1-1 子项)
 * - 改 App.jsx genState 全屏 (电商生图专用, 不动)
 */
import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

const LongTaskContext = createContext(null);

export function LongTaskProvider({ children }) {
  // 内部 state: { activeTasks: Map<id, {title, progress, stage, startedAt}> }
  // 进度展示取"最近开始"的任务
  const [activeTasks, setActiveTasks] = useState({});
  // 用 ref 记录开始顺序 (避免 state 频繁全量拷贝)
  const orderRef = useRef([]);

  const startLongTask = useCallback(({ id, title, totalSteps = 1, stage = '' }) => {
    if (!id) return;
    setActiveTasks((prev) => ({
      ...prev,
      [id]: {
        title: title || '长任务',
        totalSteps: Math.max(1, Number(totalSteps) || 1),
        progress: 0,
        stage: stage || '准备中…',
        startedAt: Date.now(),
      },
    }));
    orderRef.current = [...orderRef.current.filter((x) => x !== id), id];
  }, []);

  const updateLongTask = useCallback((id, patch) => {
    if (!id) return;
    setActiveTasks((prev) => {
      const current = prev[id];
      if (!current) return prev;
      const next = { ...current, ...patch };
      // progress 钳位 0..100
      if (typeof next.progress === 'number') {
        next.progress = Math.max(0, Math.min(100, next.progress));
      }
      return { ...prev, [id]: next };
    });
  }, []);

  const stopLongTask = useCallback((id) => {
    if (!id) return;
    setActiveTasks((prev) => {
      if (!prev[id]) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
    orderRef.current = orderRef.current.filter((x) => x !== id);
  }, []);

  // 取"最近开始"的任务展示 (并发时只显示一个主导任务)
  const displayTask = useMemo(() => {
    if (!orderRef.current.length) return null;
    const latestId = orderRef.current[orderRef.current.length - 1];
    const task = activeTasks[latestId];
    if (!task) return null;
    return { id: latestId, ...task };
  }, [activeTasks]);

  const value = useMemo(
    () => ({ startLongTask, updateLongTask, stopLongTask, displayTask, activeCount: orderRef.current.length }),
    [startLongTask, updateLongTask, stopLongTask, displayTask],
  );

  return <LongTaskContext.Provider value={value}>{children}</LongTaskContext.Provider>;
}

export function useLongTask() {
  const ctx = useContext(LongTaskContext);
  if (!ctx) throw new Error('useLongTask must be inside <LongTaskProvider>');
  return ctx;
}
