import React from 'react';
import CompactProcessNodeCard from './CompactProcessNodeCard';
import LayerWorkbenchNodeCard from './LayerWorkbenchNodeCard';
import SmartRemixNodeCard from './SmartRemixNodeCard';
import { normalizeActions } from './workflowNodeViewModel';

export default function CanvasWorkflowNode({
  node,
  sourceNode,
  actions = [],
  selected = false,
  onRetry,
  smartRemixProps = {},
  layerProps = {},
  compactProps = {},
  onPointerDown,
  onContextMenu,
  onPortPointerDown,
  onPortPointerUp,
}) {
  if (node?.kind === 'smart-remix') {
    return (
      <SmartRemixNodeCard
        node={node}
        sourceImage={sourceNode}
        {...smartRemixProps}
        selected={selected}
        status={node.status}
        onRetry={onRetry}
        onPointerDown={onPointerDown}
        onContextMenu={onContextMenu}
        onPortPointerDown={onPortPointerDown}
        onPortPointerUp={onPortPointerUp}
      />
    );
  }

  if (node?.kind === 'layer-workbench') {
    return (
      <LayerWorkbenchNodeCard
        {...layerProps}
        error={node.error}
        selected={selected}
        status={node.status}
        onRetry={onRetry}
        onPointerDown={onPointerDown}
        onContextMenu={onContextMenu}
        onPortPointerDown={onPortPointerDown}
        onPortPointerUp={onPortPointerUp}
      />
    );
  }

  const action = normalizeActions(actions).find(item => item.id === node?.actionId);
  return (
    <CompactProcessNodeCard
      title={action?.label || node?.title || '电商处理'}
      description={action?.description || node?.description}
      {...compactProps}
      selected={selected}
      status={node?.status}
      onRetry={onRetry}
      onPointerDown={onPointerDown}
      onContextMenu={onContextMenu}
      onPortPointerDown={onPortPointerDown}
      onPortPointerUp={onPortPointerUp}
    />
  );
}
