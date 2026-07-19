import React from 'react';
import EcRefImages from './EcRefImages';
import EcProductParams from './EcProductParams';
import EcSkuPanel from './EcSkuPanel';
import EcCopywriting from './EcCopywriting';
import EcPlatformPicker from './EcPlatformPicker';

/**
 * 精修工坊 — 各配置区独立导出，供 EcMode 折叠行直接引用
 */
function SectionRefs({ refShots, setRefShots, refStyles, setRefStyles }) {
  return <EcRefImages refShots={refShots} setRefShots={setRefShots} refStyles={refStyles} setRefStyles={setRefStyles} />;
}

function SectionParams({ params, onChange }) {
  return <EcProductParams params={params} onChange={onChange} />;
}

function SectionSkus({ skus, onChange }) {
  return <EcSkuPanel skus={skus} onChange={onChange} />;
}

function SectionCopy({ copywriting, onChange }) {
  return <EcCopywriting copywriting={copywriting} onChange={onChange} />;
}

function SectionPlatform({ platform, onChange }) {
  return <EcPlatformPicker platform={platform} onChange={onChange} />;
}

// 挂载为静态方法，供 EcMode 通过 EcExpertPanel.SectionRefs 等方式调用
EcExpertPanel.SectionRefs = SectionRefs;
EcExpertPanel.SectionParams = SectionParams;
EcExpertPanel.SectionSkus = SectionSkus;
EcExpertPanel.SectionCopy = SectionCopy;
EcExpertPanel.SectionPlatform = SectionPlatform;

export default EcExpertPanel;

function EcExpertPanel() {
  return null; // 不再使用整体面板，各 Section 独立引用
}
