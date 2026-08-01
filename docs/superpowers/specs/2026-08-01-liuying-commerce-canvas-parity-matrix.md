# Liuying commerce canvas parity matrix

## Scope

Rebuild the Shubao commerce canvas around the interaction model observed in
Liuying Canvas Studio. The implementation must preserve Shubao's ecommerce
generation, works, billing, and persistence contracts. Video, workflow import,
and batch-task features are explicitly out of scope.

## Acceptance matrix

| Area | Required behavior | Shubao adaptation | Verification |
| --- | --- | --- | --- |
| Empty canvas | Double-click and primary empty-state action open the native image picker | Direct upload, no asset-role gate | Browser: picker is requested from both entry points |
| Add rail | One prominent plus opens a generous menu | Upload image, import from works, generate image, generate text, ecommerce suite | DOM contract and browser click coverage |
| Bottom tools | Pointer, hand, image, text tools | Image opens picker; text creates a movable text object | Browser drag and toolbar-follow checks |
| Image node | Image is fully visible at its native aspect ratio | Generated images retain a footer with purpose, ratio, and pixel size; uploads stay visually clean | Pixel screenshot and ratio contract |
| Hover | Active node and directly related nodes remain prominent | Unrelated nodes and edges dim without layout movement | Browser hover screenshot |
| Single selection | Large toolbar appears above the object | Edit text, grid split, layers, remove background, move/scale, reverse prompt, annotation, crop, split, download, delete | Registry order and live clicks |
| Derive port | Plus is attached to the selected node | Text generation, image generation/editing, ecommerce suite | Menu position follows node after drag |
| Text object | Movable object with rich toolbar | Color, H1/H2/H3/body, bold, italic, lists, divider, duplicate, expand, delete | Drag, edit, formatting, persistence |
| Text generation | Composer is anchored to its text node | Product image references, prompt, quantity, generate | Composer follows node and remains in viewport |
| Image generation | Placeholder and composer are connected to source | Product/reference images, ratio, quantity, prompt, generate | New outputs appear as connected siblings |
| Ecommerce suite | Suite composer is connected to source | Platform, output plan, prompt, product/reference roles, generation progress | Generated assets enter categorized rows |
| Multi-select | Toolbar appears above the selection bounds | Left/center/right align, auto layout, bind, group, export, merge, delete | Pure geometry tests and browser marquee |
| Context menu | Right-click menu is clamped to viewport | Copy, paste, duplicate, layer order, visibility, lock, flips, export, delete | Registry and browser edge-position checks |
| Crop | Full-canvas focused crop mode | Cancel, original/free/fixed ratio, live dimensions, confirm | Mode exclusivity and browser screenshot |
| Split | Full-canvas focused split mode | Vertical/horizontal split, cancel, confirm | Derived connected images |
| Annotation | Full-canvas annotation mode | Pen, rectangle, arrow, text, color, width, undo/redo, delete, save | Mode toolbar contract |
| Background removal | Inline pending state and connected output | Original node is never destructively replaced | Async generation test |
| Layer analysis | Inline pending state and connected layer-workbench node | Existing pixel-layer and PSD export capability retained | API and workflow tests |
| Reverse prompt | Connected editable text node | Detailed prompt is never shown in a detached viewport modal | Async and drag tests |
| Persistence | Geometry, style, visibility, lock, grouping, and edges survive reload | Local draft plus server canvas session | Snapshot round-trip test |
| Responsive | Controls remain reachable at desktop and mobile widths | Menus clamp; top bar can scroll; no overlapping text | Desktop/mobile screenshots |
| Accessibility | Every icon command has a name and keyboard focus | Escape closes transient surfaces; Delete removes selection | DOM and keyboard coverage |

## Non-negotiable defect guards

- Category labels are node metadata, never independent absolutely positioned
  canvas objects.
- A node, its port, its toolbar, and its composer derive their position from the
  same node geometry.
- Uploaded images are individual image nodes. They are not wrapped in a
  `商品素材` card and are not forced through a role-selection dialog.
- Opening a creation surface never navigates away or places a form at the
  viewport center without an owning node.
- Every visible action either performs a real local transform, invokes an
  existing backend route, or enters a complete focused editing mode.
- Connections read live node geometry on every render; no edge endpoint is
  cached separately from node state.
