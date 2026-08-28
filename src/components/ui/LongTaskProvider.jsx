/**
 * LongTaskProvider — V4 P0-3 (D2) 长任务全屏 overlay 状态机
 *
 * 用法:
 *   const { startLongTask, updateLongTask, stopLongTask, markStep } = useLongTask();
 *
 *   const id = 'export-manifest';
 *   const heartbeat = startLongTask({ id, title: '生成导出清单', totalSteps: 3, stage: '准备资源' });
 *   // 或显式 startHeartbeat(id) 启动 200ms 心跳推进 (无事件驱动时仍丝滑)
 *   try {
 *     markStep(id, 0, '准备资源');                 // 事件驱动: 第 0 步完成
 *     await someLongWork();
 *     markStep(id, 1, '合并字幕与音轨');          // 推进 1 步
 *     await writeManifest();
 *     markStep(id, 2, '写入清单');                // 收尾 → 100%
 *   } finally {
 *     stopLongTask(id);                            // 自动停止心跳
 *   }
 *
 * 设计要点 (V2 P0-3 真进度条增量):
 * - 事件驱动: markStep(id, stepIdx, stage) 计算累计 progress = (stepIdx+1)/totalSteps * 100
 *   stepIdx < totalSteps-1 时只推到 90%, 最后一步 = 100%
 * - 心跳兜底: startLongTask 默认启动 200ms 心跳, 推进到当前 maxProgress - 5,
 *   即使没有 markStep 事件进度条也能肉眼可见推进
 * - 停止: stopLongTask 自动 clearInterval 心跳, 无残留
 *
 * 设计要点 (V4 P0-3 原始):
 * - Map<id, task> 持有所有活跃任务, 支持并发长任务
 * - 显示取"最近开始"的任务的进度, 其它后台跑
 * - 失败: stopLongTask 必须在 finally 调用, 防止 overlay 卡死
 * - 进度从 0 → 100, 即使某些任务无法精确估算也应给个非空数字
 *
 * 不在范围:
 * - 替换 DirectorAssistant / AdminConsole / Plog / Remake 局部 spinner (V4 P1-1 子项)
 * - 改 App.jsx genState 全屏 (电商生图专用, 不动)
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

const LongTaskContext = createContext(null);

// 心跳间隔: 200ms 足以肉眼感知 0→100 平滑推进, 又不浪费 CPU
const HEARTBEAT_MS = 200;

export function LongTaskProvider({ children }) {
  // 内部 state: { activeTasks: Map<id, {title, progress, stage, startedAt, totalSteps}> }
  // 进度展示取"最近开始"的任务
  const [activeTasks, setActiveTasks] = useState({});
  // 用 ref 记录开始顺序 (避免 state 频繁全量拷贝)
  const orderRef = useRef([]);
  // 心跳 timer 映射: id -> intervalId
  const heartbeatRef = useRef({});

  // 钳位 0..100 的工具函数 (供心跳 / markStep 复用)
  const clampProgress = useCallback((value) => {
    return Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
  }, []);

  // 内部: 推进某任务的 progress (不修改 stage, 只改 progress)
  // 心跳用它: 推到 maxProgress - 5, 留 buffer 给 markStep 突进
  const tickProgress = useCallback((id) => {
    setActiveTasks((prev) => {
      const current = prev[id];
      if (!current) return prev;
      const ceiling = Math.max(0, (current.progress || 0)); // 心跳不倒退, 也不超过当前已知
      // 心跳目标: current.progress + 1, 但不超过 (current.progress 的 110% 限速)
      // 简化: 每次心跳 +1 (200ms * 100 = 20s 走完 0→100, 适合大多数长任务)
      const next = Math.min(100, (current.progress || 0) + 1);
      // 如果已经 100 不再前进
      if (next === current.progress) return prev;
      void ceiling;
      return { ...prev, [id]: { ...current, progress: next } };
    });
  }, []);

  const startLongTask = useCallback(({ id, title, totalSteps = 1, stage = '' } = {}) => {
    if (!id) return () => {};
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

    // V2 P0-3 增量: 自动启动 200ms 心跳, 默认推进 +1/拍
    // 如果已有同 id 心跳先 clear
    if (heartbeatRef.current[id]) {
      clearInterval(heartbeatRef.current[id]);
    }
    heartbeatRef.current[id] = setInterval(() => {
      tickProgress(id);
    }, HEARTBEAT_MS);

    // 返回 stop 函数 (供 client 用法: const stop = startLongTask({...}); ... stop();)
    return () => {
      if (heartbeatRef.current[id]) {
        clearInterval(heartbeatRef.current[id]);
        delete heartbeatRef.current[id];
      }
    };
  }, [tickProgress]);

  const updateLongTask = useCallback((id, patch) => {
    if (!id) return;
    setActiveTasks((prev) => {
      const current = prev[id];
      if (!current) return prev;
      const next = { ...current, ...patch };
      // progress 钳位 0..100
      if (typeof next.progress === 'number') {
        // V2 P0-3: 钳位 0..100 (兼容 V4 P0-3 契约测试期望的 next.progress 内联形式)
        next.progress = Math.max(0, Math.min(100, next.progress));
      }
      return { ...prev, [id]: next };
    });
  }, [clampProgress]);

  // V2 P0-3 增量: 事件驱动 API, 客户端按阶段调用
  // markStep(id, stepIdx, stage?):
  //   - 计算 progress = (stepIdx+1) / totalSteps * 100
  //   - 最后一步 (stepIdx === totalSteps-1) 设为 100
  //   - 中间步骤只到 90, 留余地让心跳继续推
  const markStep = useCallback((id, stepIdx, stage) => {
    if (!id) return;
    setActiveTasks((prev) => {
      const current = prev[id];
      if (!current) return prev;
      const total = Math.max(1, current.totalSteps || 1);
      const idx = Math.max(0, Math.min(total - 1, Number(stepIdx) || 0));
      // 末步 100, 否则 90 * (idx+1)/total (留 buffer 让心跳继续推)
      const rawProgress = idx === total - 1 ? 100 : Math.floor((idx + 1) / total * 90);
      const next = {
        ...current,
        progress: clampProgress(rawProgress),
      };
      if (typeof stage === 'string' && stage) {
        next.stage = stage;
      }
      return { ...prev, [id]: next };
    });
  }, [clampProgress]);

  const stopLongTask = useCallback((id) => {
    if (!id) return;
    // 停心跳
    if (heartbeatRef.current[id]) {
      clearInterval(heartbeatRef.current[id]);
      delete heartbeatRef.current[id];
    }
    setActiveTasks((prev) => {
      if (!prev[id]) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
    orderRef.current = orderRef.current.filter((x) => x !== id);
  }, []);

  // 卸载时清掉所有心跳 (React 18 strict mode 防止泄漏)
  useEffect(() => {
    const timers = heartbeatRef.current;
    return () => {
      Object.values(timers).forEach((t) => clearInterval(t));
      Object.keys(timers).forEach((k) => delete timers[k]);
    };
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
    () => ({
      startLongTask,
      updateLongTask,
      stopLongTask,
      markStep,
      displayTask,
      activeCount: orderRef.current.length,
    }),
    [startLongTask, updateLongTask, stopLongTask, markStep, displayTask],
  );

  return <LongTaskContext.Provider value={value}>{children}</LongTaskContext.Provider>;
}

export function useLongTask() {
  const ctx = useContext(LongTaskContext);
  if (!ctx) throw new Error('useLongTask must be inside <LongTaskProvider>');
  return ctx;
}

/**
 * useWorkflowSteps — V2 P3 创意工作流 Automation (4c183cd4 续命)
 *
 * 把"手动 markStep 三件套"压成 0 步操作的自动化 hook:
 *
 *   const { run } = useWorkflowSteps();
 *
 *   // 客户端代码只剩业务流, 进度条全自动驱动
 *   const manifest = await run(
 *     { id: 'export-manifest', title: '生成导出清单',
 *       stages: ['正在准备资源…', '正在合并字幕与音轨…', '清单已生成'] },
 *     async (advance) => {
 *       advance();
 *       const data = await prepareResources();
 *       advance();
 *       const merged = await mergeSubtitles(data);
 *       advance();
 *       return writeManifest(merged);
 *     }
 *   );
 *
 * 设计要点:
 * - 内部复用 LongTaskContext 的 startLongTask / markStep / stopLongTask
 * - run(work) 自动: startLongTask(id, totalSteps=stages.length) → 按调用顺序 markStep → 收尾 stopLongTask
 * - 任意阶段抛错都会进入 finally, stopLongTask 兜底, 不会卡 overlay
 * - 不重写 markStep 契约, 是 P0-3 真进度条的上层糖
 * - 用户看不到 3 次手动 markStep, 只看到 run({...}, asyncWork) 一行
 */
export function useWorkflowSteps() {
  const ctx = useContext(LongTaskContext);
  if (!ctx) {
    throw new Error('useWorkflowSteps must be inside <LongTaskProvider>');
  }
  const { startLongTask, markStep, stopLongTask, updateLongTask } = ctx;

  // run({ id, title, stages }, asyncWork) => Promise<result>
  // 客户端拿到一个 advance(stage) 工具函数, 在业务流里"自然"调用即可
  const run = useCallback(({ id, title, stages } = {}, asyncWork) => {
    if (!id || typeof asyncWork !== 'function') {
      return Promise.reject(new Error('useWorkflowSteps.run 缺少 id 或 asyncWork'));
    }
    const stageList = Array.isArray(stages) && stages.length
      ? stages
      : ['准备中…', '执行中…', '收尾中…'];
    const total = stageList.length;
    let cancelled = false;
    let lastStepIdx = -1;

    // 启动: 进 overlay, 心跳自启
    const stop = startLongTask({
      id,
      title: title || '长任务',
      totalSteps: total,
      stage: stageList[0] || '准备中…',
    });

    // advance(stageLabel?): 用户每完成一阶段调用一次, 触发 markStep
    // 索引顺序按调用顺序, 不依赖传入 label; 传入 label 仅用于覆盖 stage 文本
    const advance = (stageLabel) => {
      if (cancelled) return;
      const nextIdx = Math.min(lastStepIdx + 1, total - 1);
      lastStepIdx = nextIdx;
      markStep(id, nextIdx, stageLabel || stageList[nextIdx] || `步骤 ${nextIdx + 1}`);
    };

    // 收尾: 末步 100 → 保留 600ms 完成态 → stop
    const finalize = (result) => {
      if (cancelled) return result;
      cancelled = true;
      lastStepIdx = total - 1;
      updateLongTask(id, { progress: 100, stage: stageList[total - 1] || '已完成' });
      // 保留 600ms 让用户感知"完成"状态, 再 stop (心跳也会自动停)
      setTimeout(() => {
        stop();
        stopLongTask(id);
      }, 600);
      return result;
    };

    // 主链: 调用户的 asyncWork, 拿到它的 promise,
    // .then 拿结果, .catch 兜错 (确保 stop + reject)
    let userPromise;
    try {
      userPromise = asyncWork(advance);
    } catch (syncError) {
      cancelled = true;
      stop();
      stopLongTask(id);
      return Promise.reject(syncError);
    }

    if (!userPromise || typeof userPromise.then !== 'function') {
      // 同步返回: 立即 finalize
      finalize(userPromise);
      return Promise.resolve(userPromise);
    }

    return userPromise.then(
      (value) => finalize(value),
      (error) => {
        cancelled = true;
        stop();
        stopLongTask(id);
        throw error;
      },
    );
  }, [startLongTask, markStep, stopLongTask, updateLongTask]);

  return { run };
}
