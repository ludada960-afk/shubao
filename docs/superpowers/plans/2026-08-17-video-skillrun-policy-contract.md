# Video SkillRun Policy Contract Plan

1. Add failing tests for bounded budget, guard, retry, and compensation policies.
2. Implement normalization in `server/videoSkillRun.mjs` without changing provider or billing
   code paths.
3. Run focused tests, full regression, `npm run check`, production build, and diff checks.
4. Commit the isolated contract slice and record the local-only deployment status in the
   progress ledger.

The slice deliberately stops before execution side effects. The next implementation must
consume these policies in a provider-free execution preview before any paid route is opened.
