# AI Video P2: SkillRun Replay Snapshot

## Goal

让“做同款/克隆项目”能够复用一次 SkillRun 的可执行配方，而不复制运行时身份、供应商任务或计费状态。

## Scope

- 在回放清单中保存受限的 SkillRun 配方快照：Skill 标识、输入、步骤、检查点、模型策略、输出契约，以及已完成步骤和当前状态。
- 对快照做稳定排序、大小上限和字段白名单，排除 owner、project/run/step-event ID、provider job、账务和会话字段。
- 创建回放清单时按 owner/project 解析 SkillRun；克隆时把快照写入新项目版本的 `plan_snapshot`，不复用旧运行实例。
- 保持接口幂等、owner 隔离和现有无计费回放行为。

## Non-goals

- 本切片不启动 SkillRun 的 provider 执行，不创建 generation job，不写 usage、wallet 或 billing。
- 本切片不改变电商、图库、Home、Canvas 或生产展示代码。
- 本切片不开放公共视频工作台或修改生产 feature flag。

## Verification

- 回放清单、store、route、client 定向测试通过。
- `npm test`、`npm run check`、`npm run build`、`npm run verify:video-workbench-pilot` 和 `git diff --check` 通过。
- 发布仍须经过 `scripts/deploy-production.ps1` 及独立 600 秒 Canary；受控 SSH 凭据不可读时保持未部署。

## Acceptance

同一 SkillRun 生成的回放清单在克隆后仍能还原完整配方和执行进度，但无法借此冒用原用户、复用原运行 ID、重放供应商任务或绕过计费门禁。
