import React from 'react';
import EcRefImages from './EcRefImages';
import EcProductParams from './EcProductParams';
import EcSkuPanel from './EcSkuPanel';
import EcCopywriting from './EcCopywriting';
import EcPlatformPicker from './EcPlatformPicker';

/**
 * 精修工坊折叠面板（5步严格排序）
 */
export default function EcExpertPanel({
  refShots, setRefShots,
  refStyles, setRefStyles,
  productParams, setProductParams,
  skus, setSkus,
  copywriting, setCopywriting,
  platform, setPlatform,
}) {
  const sections = [
    {
      id: 'refs',
      label: '① 双栏参考图上传区',
      desc: '左侧锁定产品主体 · 右侧提取光影/色调/构图',
      component: (
        <EcRefImages
          refShots={refShots}
          setRefShots={setRefShots}
          refStyles={refStyles}
          setRefStyles={setRefStyles}
        />
      ),
    },
    {
      id: 'params',
      label: '② 产品基础参数配置区',
      desc: '尺寸 / 底色 / 配色 / 材质 / 工艺',
      component: (
        <EcProductParams
          params={productParams}
          onChange={setProductParams}
        />
      ),
    },
    {
      id: 'skus',
      label: '③ SKU 多变体配置模块',
      desc: '颜色 / 规格 / 款式 / 工艺多维度批量配置',
      component: (
        <EcSkuPanel skus={skus} onChange={setSkus} />
      ),
    },
    {
      id: 'copy',
      label: '④ 配套文案策划输入模块',
      desc: '策划思路 / 卖点 / 质检 / 细节 / 售后',
      component: (
        <EcCopywriting
          copywriting={copywriting}
          onChange={setCopywriting}
        />
      ),
    },
    {
      id: 'platform',
      label: '⑤ 目标电商平台尺寸配置',
      desc: '直接复用内置各平台默认尺寸参数',
      component: (
        <EcPlatformPicker platform={platform} onChange={setPlatform} />
      ),
    },
  ];

  return (
    <div style={{
      background: 'var(--bg-card-solid)',
      borderRadius: 'var(--radius-md)',
      border: '1px solid var(--border)',
      overflow: 'hidden',
      animation: 'slideDown 0.3s var(--ease-out)',
    }}>
      {sections.map((sec, i) => (
        <div key={sec.id}>
          <SectionHeader
            label={sec.label}
            desc={sec.desc}
            isLast={i === sections.length - 1}
          />
          <div style={{ padding: '0 20px 20px' }}>
            {sec.component}
          </div>
        </div>
      ))}
    </div>
  );
}

function SectionHeader({ label, desc, isLast }) {
  const borderStyle = isLast ? {} : { borderBottom: '1px solid var(--border-light)' };
  return (
    <div style={{
      padding: '18px 20px 14px',
      ...borderStyle,
    }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
        {label}
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 2 }}>
        {desc}
      </div>
    </div>
  );
}
