import React, { useMemo } from 'react';
import { ReactFlow, Background, Controls, MiniMap, ReactFlowProvider } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { toFlowNodes, toFlowEdges, canvasIsValidConnection } from './videoCanvasFlowModel.js';

function ShubaoAssetNode({ data }) {
  return (
    <article className={'vcb-node is-asset' + (data.kind === 'video' ? ' is-video' : data.kind === 'audio' ? ' is-audio' : '')}>
      <header><span>{String(data.title || '素材').slice(0, 18)}</span></header>
      {data.previewUrl ? <img src={data.previewUrl} alt="" loading="lazy" /> : null}
      <footer>{data.source === 'upload' ? '上传素材' : data.source === 'library' ? '项目素材库' : '已确认'}</footer>
    </article>
  );
}
function ShubaoShotNode({ data }) {
  return (
    <article className="vcb-node is-shot">
      <header><span>{String(data.title || '镜头').slice(0, 18)}</span></header>
      <footer>{'镜头 #' + String(data.shotId || '').slice(0, 8)}</footer>
    </article>
  );
}
function ShubaoCandidateNode({ data }) {
  return (
    <article className="vcb-node is-candidate">
      <header><span>候选</span></header>
      {data.previewUrl ? <img src={data.previewUrl} alt="" loading="lazy" /> : null}
    </article>
  );
}

const NODE_TYPES = Object.freeze({
  shubaoAsset: ShubaoAssetNode,
  shubaoShot: ShubaoShotNode,
  shubaoCandidate: ShubaoCandidateNode,
});

function FlowCanvasInner({ domainNodes = [], domainEdges = [], workbenchShots = [] }) {
  const initialNodes = useMemo(() => toFlowNodes(domainNodes), [domainNodes]);
  const knownIds = useMemo(() => new Set(initialNodes.map(n => n.id)), [initialNodes]);
  const initialEdges = useMemo(() => toFlowEdges(domainEdges, knownIds), [domainEdges, knownIds]);
  const [nodes, setNodes, onNodesChange] = (() => {
    let value = initialNodes;
    return [value, updater => { value = typeof updater === 'function' ? updater(value) : updater; }, () => {}];
  })();
  void setNodes; void onNodesChange;
  return (
    <div className="vcb-flow-root" role="application" aria-label="React Flow 画布视图（实验）">
      <ReactFlow
        nodes={initialNodes}
        edges={initialEdges}
        nodeTypes={NODE_TYPES}
        isValidConnection={candidate => canvasIsValidConnection(candidate, { nodes: initialNodes })}
        fitView
        minZoom={0.2}
        proOptions={{ hideAttribution: false }}
      >
        <Background gap={18} />
        <Controls showInteractive={false} />
        <MiniMap pannable zoomable style={{ width: 132, height: 92 }} />
      </ReactFlow>
      <small className="vcb-flow-hint">React Flow 实验视图 · 节点 {initialNodes.length} / 连线 {initialEdges.length}{workbenchShots.length ? ' · 镜头 ' + workbenchShots.length : ''}</small>
    </div>
  );
}

export default function VideoCanvasFlowCanvas(props) {
  return <ReactFlowProvider><FlowCanvasInner {...props} /></ReactFlowProvider>;
}
