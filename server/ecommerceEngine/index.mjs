/**
 * 薯包AI v4 ecommerceEngine 统一入口
 *
 * 所有模块从这里导出，外部只 import 这个文件。
 */

// VLM 架构
export {
  parseRealShot, parseStyleRef,
  buildVlmPrompt, aggregateAnalyses, getInputMode,
  DEFAULT_REAL_SHOT, DEFAULT_STYLE_REF, DEFAULT_QUALITY,
} from './vlmSchema.mjs';

// VLM 客户端
export {
  analyzeImages, runFullAnalysis, VLM_CONFIG,
} from './vlmClient.mjs';

// Style Skill 包
export {
  getSkillList, getSkillByKey, recommendSkill,
  getCampaignLock, getRoleOverride, buildSkillDescription,
  STYLE_SKILL_DEFS,
} from './styleSkills.mjs';

// 品类知识库
export {
  getCategoryInfo, getCategoryList, getGenStrategy, buildCategoryDescription,
  CATEGORY_KNOWLEDGE,
} from './categoryKnowledge.mjs';

// 分层 Prompt 构建
export {
  assemblePrompt,
} from './promptAssembler.mjs';

// 双图融合
export {
  fuseDualAnalysis, buildQualityCheckPrompt, buildReversePrompt,
} from './imageFusion.mjs';

// 质检
export {
  checkQuality, batchCheck, formatQualityReport, QC_CONFIG,
} from './qualityCheck.mjs';

// 后处理
export {
  removeBackground, stitchVertical, packToZip, runPostProcess,
} from './postProcessor.mjs';

// Agent 决策
export {
  decide, classifyInput, smartDecide,
} from './agentDecider.mjs';

// 流水线
export {
  runPipeline,
} from './pipeline.mjs';
