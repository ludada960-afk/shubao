/**
 * Places derived nodes to the right of source nodes
 * @param {Array} nodes - Array of all nodes
 * @param {string} sourceNodeId - ID of the source node
 * @param {string} derivedNodeId - ID of the derived node to place
 * @returns {Array} - Updated nodes array with derived node positioned
 */
export function placeDerivedRightOfSources(nodes, sourceNodeId, derivedNodeId) {
  const sourceNode = nodes.find(n => n.id === sourceNodeId);
  if (!sourceNode) return nodes;
  
  const derivedNode = nodes.find(n => n.id === derivedNodeId);
  if (!derivedNode) return nodes;
  
  // Create a copy of the nodes array to avoid mutation
  const newNodes = [...nodes];
  
  // Find the position to place the derived node (to the right of source node)
  const sourceRightX = sourceNode.x + sourceNode.w + 20; // 20px gap
  const derivedPosition = {
    ...derivedNode,
    x: sourceRightX,
    y: sourceNode.y + (sourceNode.h - derivedNode.h) / 2, // Vertically center
  };
  
  // Update the derived node with new position
  const index = newNodes.findIndex(n => n.id === derivedNodeId);
  if (index !== -1) {
    newNodes[index] = { ...newNodes[index], ...derivedPosition };
  } else {
    // If derived node doesn't exist yet, add it
    newNodes.push({ ...derivedNode, x: sourceRightX, y: sourceNode.y + (sourceNode.h - derivedNode.h) / 2 });
  }
  
  return newNodes;
}