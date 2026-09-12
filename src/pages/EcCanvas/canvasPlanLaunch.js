/* ═══ P7 方案入画布 (用户 9-11: 独立「第二步设计方案」整页退役, 方案 = 画布对象) ═══
   首页发射器化: 素材 + 提示词 + 方案对象一起带进画布, 画布内确认方案 → 生成;
   快速通道 (quick) 跳过方案直接可生成。
   计费不变式①: 方案分析/刷新在画布内先报价后扣费; 快速通道不拉方案、不扣费。
   本模块只产纯数据 (节点/连线图), 由 index.jsx 装配进画布状态。 */

import { createCanvasSuiteComposerNode, createCanvasTextNode } from './canvasStudioModel.js';
import { createChildConnection } from './nodeWorkflow.js';

export function isPlanLaunch(launch) {
  return Boolean(launch) && launch.kind === 'ec-plan-launch';
}

/* 首页已上传的素材 (realShots/refShots/personShots/sceneShots 均为服务器资产对象) → 画布素材节点。
   9-12 用户批注：布局要按「**每种来源一列、列内自上而下排列**」——
   产品图一列、参考图在其右边一列（模特图/场景图依次再往右），
   而不是全部横着铺成一长排。返回每列最后一列的右边缘，供下游节点接着摆。 */
export function planLaunchMaterialNodes({ launch = {}, x = 60, y = 80, now = Date.now(), namer = null, columnWidth = 190, columnGap = 72, rowGap = 28, cardHeight = 240 } = {}) {
  const groups = [
    ['product', launch.realShots || launch.productImages || [], '产品图'],
    ['reference', launch.refShots || [], '参考图'],
    ['person', launch.personShots || [], '模特图'],
    ['scene', launch.sceneShots || [], '场景图'],
  ];
  const nodes = [];
  let index = 0;
  let columnX = x;
  for (const [role, list, label] of groups) {
    const usable = (Array.isArray(list) ? list : []).filter(asset => String(asset?.url || asset?.stableUrl || '').trim());
    if (!usable.length) continue;
    let rowY = y;
    for (const asset of usable) {
      index += 1;
      nodes.push({
        id: `plan_launch_${now}_${role}_${index}`,
        assetId: asset.assetId || '',
        kind: 'image',
        provenance: 'source',
        status: 'ready',
        url: String(asset.url || asset.stableUrl).trim(),
        name: asset.name || `${label} ${index}`,
        displayLabel: label,
        group: label,
        role,
        w: columnWidth,
        h: cardHeight,
        x: columnX,
        y: rowY,
        rotation: 0,
        flipX: false,
        flipY: false,
        locked: false,
        hidden: false,
        editable: true,
        showMeta: true,
      });
      rowY += cardHeight + rowGap;
    }
    columnX += columnWidth + columnGap;
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
  /* 9-12 用户批注：素材按列排完之后，右侧依次是「提示词文字节点」→「设计方案节点」。
     提示词本身也是一个节点（原来漏了），它和素材一起喂给方案节点。 */
  const columnRight = materials.length
    ? Math.max(...materials.map(node => node.x + (Number(node.w) || 190)))
    : 60;
  const promptNode = createCanvasTextNode({ x: columnRight + 72, y: 80, now });
  promptNode.id = `plan_prompt_${now}`;
  promptNode.text = prompt || '描述你想要的画面与要求';
  promptNode.name = '生成要求';
  promptNode.displayLabel = '生成要求';
  promptNode.w = 420;
  promptNode.h = 140;
  const rowEndX = promptNode.x + promptNode.w + 72;
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
  target.sourceNodeIds = [...materials.map(node => node.id), promptNode.id];
  const connections = [
    ...materials.map(node => createChildConnection(node.id, target.id)),
    createChildConnection(promptNode.id, target.id),
  ];
  return {
    nodes: [...materials, promptNode, target],
    connections,
    targetId: target.id,
    targetKind: target.kind,
    viewport: viewport || null,
  };
}
