/* ═══ P7 方案入画布 (用户 9-11: 独立「第二步设计方案」整页退役, 方案 = 画布对象) ═══
   首页发射器化: 素材 + 提示词 + 方案对象一起带进画布, 画布内确认方案 → 生成;
   快速通道 (quick) 跳过方案直接可生成。
   计费不变式①: 方案分析/刷新在画布内先报价后扣费; 快速通道不拉方案、不扣费。
   本模块只产纯数据 (节点/连线图), 由 index.jsx 装配进画布状态。 */

import { createCanvasSuiteComposerNode } from './canvasStudioModel.js';
import { createChildConnection } from './nodeWorkflow.js';

export function isPlanLaunch(launch) {
  return Boolean(launch) && launch.kind === 'ec-plan-launch';
}

/* 首页已上传的素材 (realShots/refShots/personShots/sceneShots 均为服务器资产对象) → 画布素材节点 */
export function planLaunchMaterialNodes({ launch = {}, x = 60, y = 80, now = Date.now(), namer = null } = {}) {
  const groups = [
    ['product', launch.realShots || launch.productImages || [], '产品图'],
    ['reference', launch.refShots || [], '参考图'],
    ['person', launch.personShots || [], '模特图'],
    ['scene', launch.sceneShots || [], '场景图'],
  ];
  const width = 190;
  const gap = 26;
  const nodes = [];
  let index = 0;
  for (const [role, list, label] of groups) {
    for (const asset of (Array.isArray(list) ? list : [])) {
      const url = String(asset?.url || asset?.stableUrl || '').trim();
      if (!url) continue;
      index += 1;
      nodes.push({
        id: `plan_launch_${now}_${role}_${index}`,
        assetId: asset.assetId || '',
        kind: 'image',
        provenance: 'source',
        status: 'ready',
        url,
        name: asset.name || `${label} ${index}`,
        displayLabel: label,
        group: label,
        role,
        w: width,
        h: 240,
        x: x + index * (width + gap),
        y,
        rotation: 0,
        flipX: false,
        flipY: false,
        locked: false,
        hidden: false,
        editable: true,
        showMeta: true,
      });
    }
  }
  return nodes;
}

/* 方案对象节点 (P7 核心: 设计方案是画布里的一个可编辑/可重跑对象, 不是独立整页) */
export function createCanvasDirectionNode({ x = 600, y = 80, prompt = '', productName = '', ecParams = {}, now = Date.now() } = {}) {
  return {
    id: `design_direction_${now}`,
    kind: 'design-direction',
    status: 'draft',
    x: Number.isFinite(x) ? x : 600,
    y: Number.isFinite(y) ? y : 80,
    w: 400,
    h: 260,
    name: '设计方案',
    displayLabel: '设计方案',
    prompt: String(prompt || ''),
    productName: String(productName || ''),
    /* 首页发射 payload (DesignDirection 同款 params): 方案分析/刷新的请求真源 */
    ecParams,
    /* 方案对象本体: 生成后填充; 可编辑 (方向逐张规划) + 可重跑 (刷新) */
    directions: [],
    directionRefreshes: 0,
    sourceNodeIds: [],
  };
}

/* 完整发射图: 素材行 + 方案节点 (连线 素材→方案)。quick 通道: 素材行 + 套图生成器 (跳过方案)。 */
export function createPlanLaunchGraph({ launch = {}, now = Date.now(), viewport = null } = {}) {
  const materials = planLaunchMaterialNodes({ launch, now });
  const quick = launch.quick === true;
  const prompt = String(launch.description || launch.prompt || '').trim();
  const productName = String(launch.productName || '').trim();
  const rowEndX = materials.length
    ? materials[materials.length - 1].x + materials[materials.length - 1].w + 60
    : 60;
  const target = quick
    ? {
      ...createCanvasSuiteComposerNode({ x: rowEndX, y: 80, now }),
      id: `suite_composer_${now}`,
      prompt,
      productName,
      platform: launch.platform || 'taobao',
      configuration: {
        ...createCanvasSuiteComposerNode({ x: rowEndX, y: 80, now }).configuration,
        ...(launch.sizing ? { sizing: launch.sizing } : {}),
        ...(launch.genSettings ? { genSettings: launch.genSettings } : {}),
        ...(launch.productParams ? { productParams: launch.productParams } : {}),
        ...(launch.copywriting ? { copywriting: launch.copywriting } : {}),
        ...(Array.isArray(launch.skus) ? { skus: launch.skus } : {}),
      },
    }
    : createCanvasDirectionNode({
      x: rowEndX,
      y: 80,
      prompt,
      productName,
      ecParams: launch,
      now,
    });
  target.sourceNodeIds = materials.map(node => node.id);
  const connections = materials.map(node => createChildConnection(node.id, target.id));
  return {
    nodes: [...materials, target],
    connections,
    targetId: target.id,
    targetKind: target.kind,
    viewport: viewport || null,
  };
}
