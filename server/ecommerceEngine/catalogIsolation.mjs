const ISOLATION_ROLES = new Set(['white_background', 'white_bg', 'transparent']);

export function isCatalogIsolationRole(role) {
  return ISOLATION_ROLES.has(typeof role === 'string' ? role.trim().toLowerCase() : '');
}

export function catalogIsolationContract(role) {
  const normalizedRole = typeof role === 'string' ? role.trim().toLowerCase() : '';
  if (normalizedRole === 'transparent') {
    return Object.freeze({
      background: 'Render on a true transparent alpha canvas. Every background and edge-adjacent non-product pixel must be transparent.',
      lighting: 'Use neutral edge-safe illumination only. No cast shadow, contact shadow, reflection, glow, floor, horizon, or atmospheric light.',
      composition: 'Preserve the complete product with all visible components inside the canvas and clear edge clearance. Do not crop or occlude it.',
      edgePolicy: 'Produce clean antialiased product edges with no white matte, dark halo, color fringe, jagged edge, feathered residue, or missing transparent detail.',
      sourcePreservation: 'When the authoritative source is already a correct transparent cutout, preserve its product pixels, geometry, color, labels, alpha edge, and framing; do not restyle it.',
    });
  }
  if (normalizedRole === 'white_background' || normalizedRole === 'white_bg') {
    return Object.freeze({
      background: 'Use a uniform pure white #FFFFFF background from edge to edge. No gradient, gray tint, texture, floor, wall, horizon, prop, or backdrop seam.',
      lighting: 'Use neutral even catalog illumination that preserves real material response. No cast shadow, contact shadow, drop shadow, reflection, glow, or ambient pool is allowed.',
      composition: 'Preserve the complete product with all visible components inside the canvas and clear edge clearance. Do not crop or occlude it.',
      edgePolicy: 'Produce clean antialiased product edges with no white matte, dark halo, color fringe, jagged edge, blur fringe, or missing fine detail.',
      sourcePreservation: 'When the authoritative source is already a compliant white-background catalog image, preserve its product pixels, geometry, color, labels, clean edges, and framing; make no decorative or stylistic change.',
    });
  }
  return null;
}
