# Structured Ecommerce Engine Task 10 Report

## Implementation

- Removed the production `referenceContactSheet` import and all Canvas Contact Sheet calls.
- Canvas regeneration now submits the original and supplementary images as separate indexed multipart inputs through the durable provider adapter.
- Added `resolveGenerationSize()` to the shared ecommerce model catalog.
- Removed the duplicate Canvas size table and routed Canvas regeneration/transform sizing through the legal shared model catalog.
- Preserved existing Canvas prompts, stable generated-asset persistence, supplementary references, 1K/2K/4K user choices, and output responses.

## TDD evidence

The new Canvas contract tests were written before production changes and initially failed because:

- `server/index.mjs` imported and called `buildReferenceContactSheet`;
- Canvas used a local illegal size table;
- Canvas regeneration did not submit individual indexed multipart inputs;
- the shared model catalog did not expose a Canvas-safe size resolver.

After implementation:

```powershell
node --test --test-concurrency=1 test/canvas-generation-contract.test.mjs test/api-contract.test.mjs test/ecommerce-model-routing.test.mjs
```

Result: 20 passed, 0 failed.

## Full verification

```powershell
npm test
```

Result: 403 passed, 0 failed.

```powershell
npm run build
node --check server/index.mjs
git diff --check
```

Result: production build, syntax, and diff hygiene passed.

```powershell
rg -n "Math\.random\(\).*quality|4096x4096|4096x7280|2048x2730|quality:\s*'high'|referenceContactSheet" server/ecommerceEngine server/index.mjs
```

Result: no matches.

## Concerns

None within Task 10 scope.

## Review follow-up: Canvas provider reliability

### Implementation

- Added `createCanvasGenerationService(deps)` and a dedicated SQLite-backed
  `canvas_generation_jobs` authority, isolated from ecommerce parent/asset jobs.
- Canvas request identity and provider idempotency keys are deterministic hashes
  of the normalized owner, prompt, ordered image inputs, ratio, and legal size.
- The provider job ID is persisted immediately after submit and before polling.
  Retryable failures release the durable lease so the identical owner/request
  resumes the persisted provider job without another submit.
- Provider submit and poll execute inside the shared `imageGenerationPool`.
- The temporary provider output URL is persisted before stable-asset download,
  and completed stable URLs replay through the existing successful `{ url }`
  contract with an additional durable `taskId`.
- Poll results whose `jobId` differs from the persisted provider job ID are
  rejected before output persistence.
- Added structured Canvas handler mapping for provider status, code, retryable,
  resumeable, Retry-After, task ID, and provider job ID semantics. Shared pool
  saturation maps to retryable HTTP 503 instead of becoming a terminal request.
- Extended the provider adapter to preserve numeric or HTTP-date `Retry-After`
  semantics on submit and poll failures.
- Replaced the Canvas route body with a thin service handler while preserving
  the shared legal-size resolver and forbidden-pattern scan.

### RED/GREEN evidence

Executable service/handler tests were added first and observed failing for the
expected missing behavior:

- missing focused service/store modules;
- provider submit/poll running outside the shared pool;
- retry after a persisted provider job remaining locked and unable to resume;
- mismatched poll `jobId` being accepted and persisted;
- missing structured handler export and status mapping;
- missing provider `Retry-After` propagation;
- shared pool saturation collapsing to a terminal unstructured failure;
- production Canvas route still containing provider execution logic.

After the minimal implementations, focused verification passed:

```powershell
node --test --test-concurrency=1 test/canvas-generation-service.test.mjs test/canvas-generation-handler.test.mjs test/canvas-generation-contract.test.mjs test/ecommerce-provider-adapter.test.mjs
```

Result: 19 passed, 0 failed.

### Final verification

```powershell
npm test
```

Result: 411 passed, 0 failed.

```powershell
npm run build
node --check server/canvasGenerationService.mjs
node --check server/canvasGenerationStore.mjs
node --check server/ecommerceEngine/providerAdapter.mjs
node --check server/index.mjs
git diff --check
```

Result: production build, all syntax checks, and diff hygiene passed.

```powershell
rg -n "Math\.random\(\).*quality|4096x4096|4096x7280|2048x2730|quality:\s*'high'|referenceContactSheet" server/ecommerceEngine server/index.mjs
```

Result: 0 matches.

### Follow-up concerns

None within the requested Canvas backend reliability scope.
