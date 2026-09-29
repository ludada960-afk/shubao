import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ImagePlus, Library, Maximize2, RotateCcw, X } from 'lucide-react';

import MediaAssetCard from './MediaAssetCard.jsx';
/* 2026-09-28 批 DC 续-7：`variant:'model'` 的字段渲染成**站内那一套模型行**，
   与首页/六个面板共用同一个组件（改前这里是全站唯一一处原生 <select>）。 */
import ModelOptionRows from './ModelOptionRows.jsx';
import ConfigTriggers from './ConfigTriggers.jsx';
/* 「模型选择」那一格要显示**模型名与品牌**（触发器上是 logo + 名字），值要从目录取，
   不能自己认那一串 id —— 与 ModelOptionRows 读的是同一份目录（选项只有一处真相）。 */
import { SELECTABLE_IMAGE_MODELS, normalizeImageModel } from '../../services/imageModelCatalog.js';
import PromptMetaRow from './PromptMetaRow.jsx';
import ProjectAssetPicker from '../ProjectAssetPicker.jsx';
import { uploadEcommerceAsset } from '../../services/api';
/* ═══ 2026-09-27 批 DC（M2）：`disabledWhen` 的判据只有一份，在 skillRun 里 ═══════════════════
   真事（「构图方向」那一格）：实测没有人物时几乎不出方向，所以选了「空镜」之后这一格要锁住。
   ⚠️ 渲染与取值**必须问同一份判据**（渲染禁用 + 取值夹回默认档）——
      两处各写一遍就会出现"界面锁着、请求里还带着旧方向"（看着是 A、跑的是 B）。 */
import { skillFieldLocked } from '../../skills/skillRun.js';

/* ═══ FieldRenderer：Skill 工作台的字段渲染器（唯一实现）══════════════════════════
   来源：docs/design/43-media-architecture.md §5（Skill 契约）与 §4.3（门禁化）。
   为什么必须有它：现在同一批配置（模型 / 清晰度 / 比例 / 数量）在 41 个面板文件里
   各写了一遍（实测 model 41 处、resolution 42 处、count 77 处、ratio 61 处），
   结果就是"图片侧和视频侧的控件长得不一样"。
   从今往后：**页面只声明字段，控件由这里统一渲染** —— 这也是能批量做 40+ 个 Skill 的前提
   （新增 Skill 只加声明，不加页面）。

   档位刻意保持少而够用：
     select / segmented / stepper / textarea / text —— 常见配置
     upload —— 上传位（图片）。**上传与失败重试都在这里统一实现**：
              先出本地预览（立刻可见），再上传换服务端地址；失败留在原地可主动重试，
              不做瞬时 Toast（本项目铁律：失败态必须就近、持久、可 deliberate retry）。
     slot   —— 打开一个面板的槽位（如「套图结构」），面板由调用方提供。

   ⚠️ upload 的值形状（唯一约定，页面不许自己拼）：
      Array<{ url, previewUrl?, name?, assetId?, status: 'uploading' | 'ready' | 'error', progress?, error? }>
      只有 status === 'ready' 且带 url 的条目会进入生成请求。 */
const REQUIRED_MARK = '*';

/* 条目的实际宽高（批 R）：上传就绪后量一次，写进条目（width / height）。
   为什么要量：比例里的「自适应」= 按**主图实际宽高**就近取一档
   （知渔自己的 help 原文：「「自适应」将根据模特图自动匹配最接近的比例」），
   而请求组装（skills/skillRun.js）是纯函数、不碰 DOM —— 量宽高只能在这一层做。
   量不到（跨域失败 / 地址失效）就不写：取值侧回落 1:1，绝不猜一个尺寸出来。 */
function measureBox(url) {
  return new Promise(resolve => {
    if (!url || typeof Image === 'undefined') { resolve(null); return; }
    const image = new Image();
    image.onload = () => resolve({ width: image.naturalWidth || 0, height: image.naturalHeight || 0 });
    image.onerror = () => resolve(null);
    image.src = url;
  });
}

/* 量**用户本地选的那张文件**（批 R）：object URL 一定加载得出来 ——
   不依赖上传后的地址能不能被浏览器读回（跨域 / 防盗链 / CDN 变换都量不到）。
   上传位有两个入口（选文件 / 从资产库选择），资产库那条没有 File，走 measureBox(url)。 */
function measureFile(file) {
  return new Promise(resolve => {
    if (!file || typeof Image === 'undefined' || typeof URL === 'undefined' || !URL.createObjectURL) { resolve(null); return; }
    const objectUrl = URL.createObjectURL(file);
    const done = box => { try { URL.revokeObjectURL(objectUrl); } catch { /* 已回收则忽略 */ } resolve(box); };
    const image = new Image();
    image.onload = () => done({ width: image.naturalWidth || 0, height: image.naturalHeight || 0 });
    image.onerror = () => done(null);
    image.src = objectUrl;
  });
}

/* blob 预览地址在替换/移除时统一回收，避免长会话里泄漏 */
function revoke(item) {
  const url = item && item.previewUrl;
  if (url && String(url).startsWith('blob:') && typeof URL !== 'undefined' && URL.revokeObjectURL) {
    try { URL.revokeObjectURL(url); } catch { /* 已回收则忽略 */ }
  }
}

/* 上传位的说明文案：**照竞品实测原文**（43 §10.2「上传卡文案统一」）——
   他们每一张上传卡下面都写着同一句，用户一眼就知道能传什么、能传多大，
   不用先失败一次才知道。我们原来什么都没写。 */
const UPLOAD_HINT = '支持 JPG、JPEG、PNG，单张不超过 10MB';
/* 上传框内的两行文案现在是**固定原文**（「点击或拖拽上传图片」+「支持 JPG…」），
   照知渔实测；技能自己的说明走 field.hint 挂在框下面（批 Q）。
   ⇒ 原来的 uploadCopy(maxImages) 拼串实现已无调用方，删掉（死代码不留）。 */

function UploadControl({ field, value, onChange, disabled }) {
  const inputRef = useRef(null);
  /* ⚠️ 上传位有**两个**入口（竞品实测：选择文件 / 从资产库选择）：
     只给「选择文件」的话，用户上一轮刚生成的成品想再用一次就得先下载再上传 ——
     而资产库里的东西本来就是可以直接引用的。 */
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const items = Array.isArray(value) ? value : [];
  /* ⚠️ 上传是异步的：回调回来时闭包里的 items 已经是旧数组了。
     曾经因此把"上传完成"写回成**上传之前**的数组 —— 缩略图上传成功后消失（E2E 抓到）。
     所以所有改动都基于 itemsRef（随每次提交同步更新），而不是渲染期的闭包。 */
  const itemsRef = useRef(items);
  useEffect(() => { itemsRef.current = items; }, [items]);
  const commit = next => { itemsRef.current = next; onChange(next); };
  /* 量过宽高的地址记账：失败也记账，避免每次渲染都重试同一个地址（死循环）。 */
  const measuredRef = useRef(new Set());
  useEffect(() => {
    items.forEach(item => {
      const url = item && item.status === 'ready' ? String(item.url || '') : '';
      if (!url) return;
      if (Number(item.width) > 0 && Number(item.height) > 0) return;
      if (measuredRef.current.has(url)) return;
      measuredRef.current.add(url);
      measureBox(url).then(box => {
        if (!box || !(box.width > 0) || !(box.height > 0)) return;
        /* 按地址回填（不按下标：异步回来时数组可能已经变过） */
        const base = itemsRef.current;
        if (!base.some(entry => entry && String(entry.url || '') === url)) return;
        commit(base.map(entry => (entry && String(entry.url || '') === url ? { ...entry, width: box.width, height: box.height } : entry)));
      });
    });
  }, [items]);

  const maxImages = Math.max(1, Number(field.maxImages || 1));
  const multiple = maxImages > 1;
  const full = items.length >= maxImages;

  const patchAt = (index, next) => {
    const base = itemsRef.current;
    if (index < 0 || index >= base.length) return;
    commit(base.map((item, i) => (i === index ? { ...item, ...next } : item)));
  };

  const uploadAt = async (index, file) => {
    if (!file) { patchAt(index, { status: 'error', error: '文件已失效，请重新选择' }); return; }
    try {
      const asset = await uploadEcommerceAsset({ file, role: field.role || 'product' });
      const url = String(asset?.url || asset?.stableUrl || '').trim();
      if (!url) throw new Error('上传后没有拿到可用地址');
      const previous = itemsRef.current[index];
      if (previous && previous.previewUrl !== url) revoke(previous);
      patchAt(index, { url, previewUrl: asset?.previewUrl || url, name: asset?.name || file.name, assetId: asset?.assetId || '', status: 'ready', progress: 100, error: '', file: undefined });
    } catch (error) {
      patchAt(index, { status: 'error', error: (error && error.message) || '上传失败' });
    }
  };

  const handleFiles = selected => {
    const files = Array.from(selected || []).filter(file => file && String(file.type || '').startsWith('image/'));
    if (!files.length) return;
    const base = itemsRef.current;
    const accepted = files.slice(0, Math.max(0, maxImages - base.length));
    if (!accepted.length) return;
    const start = base.length;
    /* uid：这一次上传尝试的稳定标记（批 R）。异步量宽高回来时要靠它确认"这一格还是刚才那张"——
       上传成功会把 previewUrl 从 blob 换成服务端地址，所以**不能**用 previewUrl 当标记。 */
    const stamp = Date.now().toString(36);
    const drafts = accepted.map((file, offset) => ({
      uid: stamp + '-' + offset,
      url: '',
      previewUrl: (typeof URL !== 'undefined' && URL.createObjectURL) ? URL.createObjectURL(file) : '',
      name: file.name,
      status: 'uploading',
      progress: 30,
      file,
    }));
    commit([...base, ...drafts]);
    accepted.forEach((file, offset) => { uploadAt(start + offset, file); });
    /* 本地量一次宽高（与上传并行，互不依赖）：量到了就回填 —— 回填前先确认这一格还是原来那张
       （previewUrl 变了说明位置被换过，宁可不回填，也不要把尺寸写到别的图上）。 */
    accepted.forEach((file, offset) => {
      const index = start + offset;
      const uid = drafts[offset].uid;
      measureFile(file).then(box => {
        if (!box || !(box.width > 0) || !(box.height > 0)) return;
        const current = itemsRef.current[index];
        if (!current || current.uid !== uid) return;
        commit(itemsRef.current.map((entry, i) => (i === index ? { ...entry, width: box.width, height: box.height } : entry)));
      });
    });
  };

  const removeAt = index => {
    const base = itemsRef.current;
    revoke(base[index]);
    commit(base.filter((_, i) => i !== index));
  };

  return (
    <span
      className={'media-field-upload' + (dragging ? ' is-dragging' : '')}
      data-empty={items.length ? 'false' : 'true'}
      /* 拖拽上传：与「选择文件」共用同一条 handleFiles（不另写一条上传逻辑） */
      onDragOver={event => { if (disabled) return; event.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={event => {
        if (disabled) return;
        event.preventDefault();
        setDragging(false);
        const dropped = Array.from(event.dataTransfer?.files || []).filter(file => /^image\//.test(file.type));
        if (dropped.length) handleFiles(dropped);
      }}
    >
      {/* ═══ 2026-09-19 批 Q：**一个框**（照知渔实测，用户批注 #2-5）═══════════════════════════
         用户原话：「他们这个部分是一体的，你知道吗？就是上传素材，还有从资产库里面选择，
           他们是在同一个地方的呀。同一个框里面去进行的呀。同一个框里面有这么两个按钮，
           然后它还有一些文案是在说可以上传哪些素材，然后大小是多少，这些东西你也没有抄到位呀。」
         知渔实测（docs/design/data/quantv-image-builtin-pages.json 同批量的 .tmp/laoyu2/qy-suite-layout.json）：
           虚线框 432x168、radius 18px、dashed 1.6px、padding 20.96/16.768，**框内**从上到下是
           ① 图标 ② 「点击或拖拽上传图片」(14.672px/500) ③ 「支持 JPG、JPEG、PNG，单张不超过 10MB」(12.576px)
           ④ **两颗按钮同一排**：「选择文件」88x37 + 「从资产库选择」138x37。
         我们原来是：一个  卡（按钮文案是"上传商品图"）+ 框**外**一颗「从资产库选择」+ 框外一行说明 ⇒ 就是用户说的"没抄到位"。 */}
      <span className="media-field-upload-box">
        {items.length === 0 ? (
          <>
            <ImagePlus size={30} strokeWidth={1.4} className="media-field-upload-icon" />
            <strong className="media-field-upload-title">点击或拖拽上传图片</strong>
            <small className="media-field-upload-hint">{field.acceptHint || UPLOAD_HINT}</small>
          </>
        ) : (
          <span className="media-field-upload-items">
            {/* data-box（批 R）：量到的实际宽高。这是**真实状态**，不是给测试用的假钩子 ——
                比例选「自适应」时出图比例就是按它就近取的；E2E 用它当"量宽高已完成"的等待锚点
                （异步 Image 加载，没有别的可观测信号）。 */}
            {items.map((item, index) => (
              <span
                className="media-field-upload-item"
                key={(item.name || 'item') + '-' + index}
                data-box={item.width > 0 && item.height > 0 ? item.width + 'x' + item.height : undefined}
              >
                <MediaAssetCard
                  kind="image"
                  src={item.previewUrl || item.url || ''}
                  label={item.status === 'error' ? '' : (item.name || '')}
                  status={item.status === 'ready' ? 'ready' : (item.status === 'error' ? 'error' : 'uploading')}
                  progress={item.status === 'uploading' ? (item.progress || 40) : 0}
                  onRemove={() => removeAt(index)}
                />
                {item.status === 'error' && (
                  <button type="button" className="media-field-upload-retry" onClick={() => { patchAt(index, { status: 'uploading', progress: 40, error: '' }); uploadAt(index, item.file); }}>
                    <RotateCcw size={12} />{item.error || '重试'}
                  </button>
                )}
              </span>
            ))}
          </span>
        )}
        <span className="media-field-upload-actions">
          <button type="button" className="media-field-upload-add" disabled={disabled || full} onClick={() => inputRef.current?.click()}>
            选择文件
          </button>
          {/* 第二个入口：从资产库选（与竞品一致）。选中的资产已经是服务端稳定地址，
              直接进生成请求，不重新上传一遍。 */}
          <button type="button" className="media-field-upload-library" disabled={disabled || full} onClick={() => setLibraryOpen(true)}>
            <Library size={15} />从资产库选择
          </button>
        </span>
      </span>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple={multiple}
        hidden
        onChange={event => { handleFiles(event.target.files); event.target.value = ''; }}
      />
      {/* ⚠️ 技能自己的说明（如「商品图会作为一组打包参考，最多 6 张」）由**外层统一的 field.hint**
          渲染（就在控件下面那行）——这里**不能**再渲染一次，实测会连出两行一样的说明。 */}
      <ProjectAssetPicker
        open={libraryOpen}
        onClose={() => setLibraryOpen(false)}
        mediaKind="image"
        multi={multiple}
        title={(field.slotLabel || '素材') + ' · 从资产库选择'}
        onPick={assets => {
          const picked = (Array.isArray(assets) ? assets : [])
            .map(asset => ({
              url: String(asset?.stableUrl || asset?.url || ''),
              assetId: String(asset?.projectAssetId || asset?.assetId || ''),
              name: String(asset?.name || '资产库素材'),
              status: 'ready',
            }))
            .filter(item => item.url);
          if (picked.length) commit([...itemsRef.current, ...picked].slice(0, maxImages));
          setLibraryOpen(false);
        }}
      />
    </span>
  );
}

/* ═══ segmented：选项药丸 + 「更多」收折（2026-09-19 批 P，照知渔实测形态）══════════════
   用户第 20 轮原话：「工作台**该滑动的地方要滑动，要选项的地方要选项，该切换的地方要切换，抄到位**」。
   知渔实测（docs/design/data/quantv-image-pages.json 逐页实采）：
     选项超过 6 个时**只铺前 6 个**，第 7 个位置是一颗「更多」——
     · 中文海报：用途(8)=6+更多、颜色(15)=6+更多、效果(18)=6+更多、字体(6)=**不折**、选择分辨率(2)=不折；
     · 图片换风格：风格选择(22)=6+更多；相似图生成的比例(7)=6+更多；
     · 批量出图：比例(10)=6+更多。
   ⇒ 判据就是「多于 6 档 → 折」，不是拍脑袋：他们那 6 档及以下都铺满、没有「更多」。
   为什么必须做：18 颗药丸铺开来会把左栏撑成一面墙（他们的左栏永远只有 6 颗高）。
   ⚠️ 例外要能声明：field.maxVisible 可以逐字段改（例如「光影氛围」实测 8 档是铺满的）；
   ⚠️ 当前选中的那一档若落在折叠区里，**必须继续显示** —— 否则界面会假装"没选"。
      所以 expanded 的判据是「点过更多」**或**「选中的档位不在前 6 个里」。 */
function SegmentedControl({ field, value, onChange, disabled }) {
  const options = Array.isArray(field.options) ? field.options : [];
  const limit = Math.max(1, Number(field.maxVisible ?? 6) || 6);
  /* ═══ 2026-09-24 批 BB：**"更多"只藏着一档时不折**（用户改向，逐字）════════════════════════════
     用户原话：「然后你这里的比例我实在是搞不明白，你点击**更多，为什么只有一个比例出来**呢？
     更多，如果只有一个的话，那你为什么一定要有这个更多呢？你**不如就全部给他排版进来直接展示**
     不就好了吗？」
     诊断：比例那一格正好是 **7 档**（RATIO / RATIO_BARE），判据是"多于 6 档 → 折"，
     于是"更多"点开只多出来一格 —— 用户要的是**一眼看全**，不是多一次点击。
     ⇒ 只有"藏起来的档位 ≥ 2"才值得收折（`options.length > limit + 1`）；差一档就直铺。
       知渔那批数据里真正该折的是 8/10/15/18/22 档那几格，这条改动**不影响**它们。 */
  const collapsible = field.collapsible !== false && options.length > limit + 1;
  /* ═══ 多选（2026-09-19 批 P）═══════════════════════════════════════════════════════════
     知渔「商品多角度多视图」那一格叫「**选择视角（多选）**」—— 正面/侧面/背面/俯视/仰视/45度角
     可以同时选中几个，出的是一组多角度的图。我们原来只能单选，等于把他们的玩法砍了一半。
     声明源写 field.multiple = true，这里就把值当**数组**处理（skillRun 侧负责拼进提示词）。 */
  const multiple = field.multiple === true;
  const selectedList = multiple ? (Array.isArray(value) ? value : []) : [];
  const isOn = option => (multiple ? selectedList.some(v => String(v) === String(option.value)) : String(value) === String(option.value));
  const pick = option => {
    if (!multiple) { onChange(option.value); return; }
    const exists = selectedList.some(v => String(v) === String(option.value));
    onChange(exists ? selectedList.filter(v => String(v) !== String(option.value)) : [...selectedList, option.value]);
  };
  /* 折叠时若**有任一**选中项落在折叠区，同样要铺开（否则用户看不到自己选了什么） */
  const selectedIndex = multiple ? options.findIndex(option => isOn(option)) : options.findIndex(option => isOn(option));
  const [expanded, setExpanded] = useState(false);
  const mustShowAll = !collapsible || expanded || selectedIndex >= limit;
  const shown = mustShowAll ? options : options.slice(0, limit);
  return (
    <span
      className={'media-field-segmented' + (multiple ? ' is-multiple' : '')}
      role="group"
      aria-label={field.label}
      /* ⚠️ 2026-09-28 批 DC 续-7：`columns` 是**声明侧**给的轨道数，不是页面里手写的样式。
         为什么需要它：默认列宽是 `minmax(min(140px,100%),1fr)`，在 386px 的内容列里是 **2 列** ——
         「本篇张数」那三档于是排成 2+1，第三颗孤零零占一行、右侧留一个洞（真机截图抓到的）。
         这一栏是"三选一"，就该读成**一行三颗**。写死成 3 列会波及所有分段字段，
         所以走声明：字段说"我要 3 列"，这里只把数字透出去，样式仍由 CSS 那一层给。 */
      data-columns={Number(field.columns) > 0 ? Number(field.columns) : undefined}
    >
      {shown.map(option => (
        <button
          key={option.value}
          type="button"
          disabled={disabled}
          aria-pressed={isOn(option)}
          className={isOn(option) ? 'is-active' : ''}
          onClick={() => pick(option)}
        >{option.label}</button>
      ))}
      {collapsible && !mustShowAll && (
        <button
          type="button"
          className="media-field-more"
          aria-expanded="false"
          aria-label={(field.label || '选项') + ' 展开全部 ' + options.length + ' 项'}
          disabled={disabled}
          onClick={() => setExpanded(true)}
        >更多</button>
      )}
      {collapsible && expanded && selectedIndex < limit && (
        <button
          type="button"
          className="media-field-more is-open"
          aria-expanded="true"
          aria-label={(field.label || '选项') + ' 收起'}
          disabled={disabled}
          onClick={() => setExpanded(false)}
        >收起</button>
      )}
    </span>
  );
}

/* ═══ cards：整幅选项卡（2026-09-19 批 Q，照知渔「套图结构配置」实测）══════════════════
   用户批注 #3-3：「你不需要把这些说明写出来的，没有意义呀……他们也没有做这些呀」+
   #3-4：「你下面一整块的排版都是乱的」。
   知渔实测（.tmp/laoyu2/qy-suite-layout.json）：
     两张卡各 **437×82**、圆角、白底、选中那颗右上角一个 ✓，
     说明文字**写在卡片里面**（「AI智能分析商品图，匹配合适的 Listing 套图」/「可自由调整各类型图片数量，至少选择7张」），
     不是像我们那样在卡片下面另起一段说明。
   ⇒ 声明源写 field.kind = 'cards'，options 带 hint，控件把 hint 放进卡里。 */
function CardsControl({ field, value, onChange, disabled }) {
  return (
    <span className="media-field-cards" role="radiogroup" aria-label={field.label}>
      {(field.options || []).map(option => {
        const on = String(value) === String(option.value);
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={on}
            disabled={disabled}
            className={'media-field-card' + (on ? ' is-active' : '')}
            onClick={() => onChange(option.value)}
          >
            <span className="media-field-card-copy">
              <strong>{option.label}</strong>
              {option.hint ? <small>{option.hint}</small> : null}
            </span>
            <span className="media-field-card-check" aria-hidden="true">{on ? '✓' : ''}</span>
          </button>
        );
      })}
    </span>
  );
}

/* 多行文本 + 「放大」：放大框要有自己的开合状态，所以单独成一个组件
   （control() 是普通函数，不能在它里面用 useState —— 那是 hooks 规则，会整页崩）。 */
function TextareaControl({ field, value, onChange, disabled, assets }) {
  const [expanded, setExpanded] = useState(false);
  const id = 'field-' + field.key;
  const common = { id, disabled, 'aria-label': field.label };
  return (
    <span className="media-field-textarea">
      <textarea
        {...common}
        className="media-field-control"
        rows={field.rows || 3}
        maxLength={field.maxLength || 2000}
        placeholder={field.placeholder || ''}
        value={value ?? ''}
        onChange={event => onChange(event.target.value)}
      />
      {/* ═══ 2026-09-27 批 CP：**「放大」从框里搬到框下面那一行**（用户原话，逐字）══════════════════
          「我右边这个放大按钮，我觉得其实不能放在提示词框里面。图片生成那边好像也是放的位置在这个
          位置，但我觉得这个位置是不对的。你其实也可以把它考虑放到提示词框的下面。就是你把 @ 和放大
          按钮，还有字数的限制是多少？这三个东西都**放到同一行**去。」「这个按钮图片生成那边应该是
          没有的，如果你这边要做的话，那边是不是也可以考虑做呢？」
          ⇒ 与视频侧**共用同一个组件**（PromptMetaRow）：@ / 放大 / 字数一行，图片侧从"没有 @"到有。
          原位置（框内右上角绝对定位）会压住首行文字（用户实测指出），这条同时把它解掉。 */}
      <PromptMetaRow
        label={field.label}
        value={value ?? ''}
        maxLength={field.maxLength || 2000}
        assets={assets}
        disabled={disabled}
        onInsert={next => onChange(next)}
        onExpand={field.expandable === false ? undefined : () => setExpanded(true)}
      />
      {expanded && createPortal(
        <div
          className="media-field-expand-modal"
          role="dialog"
          aria-modal="true"
          aria-label={(field.label || '文本') + '放大编辑'}
          onMouseDown={event => { if (event.target === event.currentTarget) setExpanded(false); }}
        >
          <div className="media-field-expand-body">
            <header>
              <strong>{field.label || '编辑'}</strong>
              <span>{String(value ?? '').length}/{field.maxLength || 2000}</span>
              <button type="button" className="media-field-expand-close" aria-label="关闭放大编辑" onClick={() => setExpanded(false)}><X size={16} /></button>
            </header>
            <textarea
              autoFocus
              className="media-field-control"
              maxLength={field.maxLength || 2000}
              placeholder={field.placeholder || ''}
              value={value ?? ''}
              onChange={event => onChange(event.target.value)}
              onKeyDown={event => { if (event.key === 'Escape') setExpanded(false); }}
            />
            <footer>
              <button type="button" className="media-field-expand-done" onClick={() => setExpanded(false)}>完成</button>
            </footer>
          </div>
        </div>,
        document.body,
      )}
    </span>
  );
}

/* ═══ counts：一组「类型 × 张数」的步进器（2026-09-19 用户批注 #13）════════════════════
   竞品套图工作台底部那两张大卡「智能匹配 / 自定义配置」，选中**自定义配置**之后
   下面会展开一组按类型配张数的步进器（用户原话：「自定义配置选中之后，里面还有其他的配置
   可以做呀，这些你都没深度的调研吗」）。
   本档位就是那一组：每一行 = 类型名 + 一句用途 + 张数步进器；末尾一行合计，
   合计数字直接来自用户当前的选择（**不是**写死的文案）。
   ⚠️ 类型取值范围由**声明源**给（field.rows），这里不写死任何业务类型 ——
      图片类型是方案真源 IMAGE_TYPES 的事，控件只负责渲染。 */
function CountsControl({ field, value, onChange, disabled }) {
  const rows = Array.isArray(field.rows) ? field.rows : [];
  /* ═══ 2026-09-25 批 BM：**刚展开出来的这一块要自己滚进视野**（用户原话，逐字）══════════════════════
     「而且我点击这个自定义配置的话，它张开的面板**并没有自动适配下去**呀，我点击这个按钮的话，
       我根本就**看不到下面的东西**，我得**自己往下挪**才能看到，你是不是应该**自动张开下面的东西
       适配到当前画面**呢？」
     实测：点完之后 scrollTop 仍是 0，新块在 y=1508（视口 1000）⇒ 用户确实得自己往下拽。
     ⚠️ 用 block:'nearest' —— 已经在视野里就**不动**（避免"点一下画面就跳"）；
        滚动容器是左栏，浏览器会自己找最近的滚动祖先。 */
  const hostRef = useRef(null);
  useEffect(() => {
    const node = hostRef.current;
    if (!node || typeof node.scrollIntoView !== 'function') return;
    node.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, []);
  /* ⚠️ 值的形状由 skillRun.initialSkillValues 落地（counts 分支把每行的 default 播种进去），
     这里的 row.default 是**兜底**：万一某条调用方没走 initialSkillValues，
     也不至于把整组显示成 0（那会让用户以为"它坏了"）。 */
  const current = value && typeof value === 'object' ? value : {};
  const countOf = row => Math.max(0, Number(current[row.key] ?? row.default) || 0);
  const total = rows.reduce((sum, row) => sum + countOf(row), 0);
  const minTotal = Math.max(1, Number(field.minTotal) || 1);
  const setOne = (key, next) => {
    const max = Math.max(0, Number(rows.find(row => row.key === key)?.max) || 9);
    const clamped = Math.max(0, Math.min(max, next));
    onChange({ ...current, [key]: clamped });
  };
  return (
    <span className="media-field-counts" ref={hostRef}>
      {rows.map(row => {
        const count = countOf(row);
        const max = Math.max(0, Number(row.max) || 9);
        return (
          <span className="media-field-count-row" key={row.key}>
            <span className="media-field-count-copy">
              <strong>{row.label}{row.smart ? <em>AI智能匹配</em> : null}</strong>
              {row.hint ? <small>{row.hint}</small> : null}
            </span>
            <span className="media-field-stepper">
              <button type="button" disabled={disabled || count <= 0} aria-label={row.label + ' 减少'} onClick={() => setOne(row.key, count - 1)}>−</button>
              <output>{count}</output>
              <button type="button" disabled={disabled || count >= max} aria-label={row.label + ' 增加'} onClick={() => setOne(row.key, count + 1)}>+</button>
            </span>
          </span>
        );
      })}
      <p className="media-field-counts-total" data-ok={total >= minTotal ? 'true' : 'false'}>
        当前共 <b>{total}</b> 张{minTotal > 1 ? '，至少 ' + minTotal + ' 张' : ''}
      </p>
    </span>
  );
}

/* ═══ optionsFrom：这一格的选项**跟着另一个字段变**（2026-09-19 批 R）═══════════════════════
   真事：模型目录里 Midjourney 上游只有 1K/2K（imageModelCatalog 的 resolutions），
   而「分辨率」是静态的 1K/2K/4K —— 选了它再点 4K，就是给了一个我们做不到的档。
   判据写在**声明源**里：field.optionsFrom = { key: 'imageModel', map: { midjourney: ['1K','2K'] } }；
   没列进 map 的取值 = 不限制（其余模型三档全支持）。声明里没有这条就完全照旧。 */
function resolveFieldOptions(field, values) {
  const options = Array.isArray(field.options) ? field.options : [];
  const rule = field.optionsFrom;
  if (!rule || !rule.key || !values) return options;
  const allowed = rule.map ? rule.map[String(values[rule.key] ?? '')] : null;
  if (!Array.isArray(allowed) || !allowed.length) return options;
  return options.filter(option => allowed.some(value => String(value) === String(option.value)));
}

/* `allFields`：这条技能的**全部字段声明**。`kind:'config'` 那一格要按 key 取回被它收起的几格
   （`values` 是取值表，里面没有声明本身）。⚠️ 这个参数**必须一路传进来** ——
   漏传时 `allFields` 在这个函数作用域里是未声明的名字，esbuild 只查语法查不出来，
   运行期直接 ReferenceError → 整页落错误边界（第一版就是这么炸的：
   端到端里 `.media-workbench-submit` 20s 超时、页面显示「页面出了点问题」）。 */
function control(kind, field, value, onChange, disabled, assets, allFields, allValues) {
  const id = 'field-' + field.key;
  const common = { id, disabled, 'aria-label': field.label };
  /* ═══ 2026-09-29 批 DC 续-8：**`kind: 'config'`** —— 把一组生成设置收成两颗触发器 ════════════════
     用户 2026-09-29 逐字（指概念视觉方案那一页的左栏被 8 行模型列表 + 两排药丸撑爆）：
       「你不可以像首页这样就是做成一个**生图模型的按钮和面板**，还有一个**画面规格的一个按钮和面板**吗？
         你就只排两个按钮进去子页面里面不就好了吗？……你为什么要把子页面的规划搞得乱七八糟呢？」
     声明侧这么写（`covers` 是它替身的那几格）：
       { key: 'genConfig', kind: 'config', covers: ['imageModel', 'ratio', 'clarity'], … }
     ⚠️ **页面里不许手写这一格** —— 它由 FieldRenderer 渲染（与全站"字段一律经 FieldRenderer"同一条纪律）；
        被 `covers` 的那几格由 WorkbenchShell 从网格里剔掉，不是"藏起来"（藏起来用户就找不到了）。
     ⚠️ 面板里的比例/清晰度仍是**原来那一份 FieldRenderer 渲染**（ConfigTriggers 内部回调回来），
        所以药丸外观、折叠、必填标记、禁用逻辑一个字都没变。 */
  if (kind === 'config') {
    /* ⚠️ 面板内容在这里**就地渲染**（递归调用本组件），**不是**让 ConfigTriggers 去 import FieldRenderer ——
       那样会形成 `FieldRenderer → ConfigTriggers → FieldRenderer` 的**循环依赖**，
       而 esbuild 只查语法、查不出这个：模块初始化顺序一变，工作台整块白屏
       （第一次写就是这么炸的：端到端里 `.media-workbench-submit` 20s 超时不到）。
       触发器只负责"两颗按钮 + 一个浮层 + 坐标"，控件一律由本组件渲染。 */
    const byKey = key => (allFields || []).find(item => item && item.key === key) || null;
    const modelDecl = byKey(field.modelKey);
    const specDecls = (field.specKeys || []).map(byKey).filter(Boolean);
    const table = allValues || {};
    const modelId = normalizeImageModel(field.modelKey ? table[field.modelKey] : '');
    const modelMeta = SELECTABLE_IMAGE_MODELS.find(item => item.id === modelId);
    const labelOf = decl => {
      const raw = table[decl.key];
      const option = (decl.options || []).find(item => String(item.value) === String(raw));
      return option ? option.label : raw;
    };
    return (
      <ConfigTriggers
        modelKey={field.modelKey || ''}
        modelLabel={(modelMeta && modelMeta.label) || modelId}
        modelBrand={(modelMeta && modelMeta.brand) || 'openai'}
        modelNode={modelDecl
          ? <ModelOptionRows
              value={modelId}
              onPick={item => onChange(item.id)}
              desc="full"
              disabled={disabled}
            />
          : null}
        specNodes={specDecls.map(decl => (
          <FieldRenderer
            key={decl.key}
            field={decl}
            value={table[decl.key]}
            values={allValues}
            disabled={disabled}
            onChange={next => onChange(decl.key, next)}
          />
        ))}
        specSummaries={specDecls.map(labelOf).filter(Boolean)}
        values={table}
        disabled={disabled}
        coverLabels={(field.covers || []).map(key => (byKey(key) || {}).label).filter(Boolean)}
        onChange={onChange}
      />
    );
  }
  if (kind === 'select') {
    /* ═══ 2026-09-28 批 DC 续-7：声明了 `variant: 'model'` 的那一格走**站内事实标准** ==========
       用户批注图1-① 原话：「模型选择这个你为什么**不用其他地方那个选模型的样式**呀，你又自己发明了一个。」
       改前这一支渲染的是**原生 <select>** —— 无 logo、无描述、无选中勾，全站只有这一处是这样。
       ⇒ 走共用组件 ModelOptionRows（首页/六个面板那一套 `.sb-opt` 行的**同一份实现**），
          选项直接读模型目录（`SELECTABLE_IMAGE_MODELS`），不摊第二份名单。
       ⚠️ 其余 `select` 字段（主题意象那 20 条母体、平台/语言）**一个字不变**：
          它们是"从一长串里选一个值"，本来就该是一颗原生下拉。 */
    if (field.variant === 'model') {
      /* ⚠️ 外面这一层 role=group + aria-label 不是装饰：换掉原生 `<select>` 之后，
         这一格就没有任何带字段名的可编程钩子了 —— 读屏会念成一堆没有名字的按钮，
         端到端也没法再问"页面上现在选的是哪一档"。
         同族做法见画布那次（`data-canvas-config-trigger`）：**给语义标记，不给位置**。 */
      return (
        <div id={id} role="group" aria-label={field.label} className="media-field-model-list">
          <ModelOptionRows value={value} onPick={model => onChange(model.id)} desc="full" disabled={disabled} />
          {/* ⚠️ `disabled` 是真的传下去：生成中这一格必须点不动，否则用户能在跑着的时候换模型，
              而这一单已经按旧模型报价冻结了。 */}
        </div>
      );
    }
    return (
      <select {...common} className="media-field-control" value={value ?? ''} onChange={event => onChange(event.target.value)}>
        {(field.options || []).map(option => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    );
  }
  if (kind === 'segmented') {
    /* 选项药丸 + 「更多」收折（照知渔；见上面 SegmentedControl 的注释） */
    return <SegmentedControl field={field} value={value} onChange={onChange} disabled={disabled} />;
  }
  if (kind === 'stepper') {
    const min = Number(field.min ?? 1);
    const max = Number(field.max ?? 99);
    const step = Number(field.step ?? 1);
    const current = Number(value ?? min);
    const clamp = next => Math.max(min, Math.min(max, next));
    return (
      <span className="media-field-stepper">
        <button type="button" disabled={disabled || current <= min} aria-label={(field.label || '') + ' 减少'} onClick={() => onChange(clamp(current - step))}>−</button>
        <output>{current}</output>
        <button type="button" disabled={disabled || current >= max} aria-label={(field.label || '') + ' 增加'} onClick={() => onChange(clamp(current + step))}>+</button>
      </span>
    );
  }
  if (kind === 'textarea') return <TextareaControl field={field} value={value} onChange={onChange} disabled={disabled} assets={assets} />;
  if (kind === 'counts') {
    return <CountsControl field={field} value={value} onChange={onChange} disabled={disabled} />;
  }
  if (kind === 'cards') {
    return <CardsControl field={field} value={value} onChange={onChange} disabled={disabled} />;
  }
  if (kind === 'upload') {
    return <UploadControl field={field} value={value} onChange={onChange} disabled={disabled} />;
  }
  if (kind === 'slot') {
    /* 没有面板可开的槽位**不做成一个点了没反应的按钮** —— 那是死控件。
       如实告诉用户"这一步在别处配置"，把入口指向真正能改的地方。 */
    if (!field.onPick) {
      return <span className="media-field-slot is-static">{field.slotLabel || '待配置'}</span>;
    }
    return (
      <button type="button" className="media-field-slot" disabled={disabled} onClick={() => field.onPick()}>
        {field.slotLabel || '选择文件'}
      </button>
    );
  }
  return (
    <input
      {...common}
      type="text"
      className="media-field-control"
      maxLength={field.maxLength || 200}
      placeholder={field.placeholder || ''}
      value={value ?? ''}
      onChange={event => onChange(event.target.value)}
    />
  );
}

/* labelOverride：调用方可以**整块替换标签行**（2026-09-19 批 O-⑪）。
   用途只有一个 —— 把付费动作渲染成"贴着字段标签右端"的行内胶囊（照知渔的形态）。
   不传 = 与从前完全一致。 */
/* `allFields`：这条技能的**全部字段声明**。
   ⚠️ 为什么需要它：`kind: 'config'` 那一格只按 **key** 引用被它收起的几格（不嵌副本 ——
   嵌副本会造成"同一个 key 声明两次"，且改选项会漏改一处、漏改的那处**静默不生效**）。
   而 `values` 是**取值表**（key → 值），里面没有声明本身，所以取回声明要另给一份。 */
export default function FieldRenderer({ field = {}, value, onChange = () => {}, disabled = false, values = null, labelOverride = null, allFields = [] }) {
  const kind = field.kind || 'text';
  /* 选项可能随别的字段变（optionsFrom，见上）——控件拿到的是**过滤后**的那一份 */
  const renderField = field.optionsFrom ? { ...field, options: resolveFieldOptions(field, values) } : field;
  const uploadCount = Array.isArray(value) ? value.length : 0;
  /* ═══ visibleWhen：字段的条件显示（2026-09-19 用户批注 #13）═════════════════════════
     竞品的「自定义配置」选中之后才会展开下面那组张数配置 —— 未选中时它不该占地方。
     判据写在**声明源**里（field.visibleWhen = { key, equals }），不散在页面里。 */
  if (field.visibleWhen && values && String(values[field.visibleWhen.key] ?? '') !== String(field.visibleWhen.equals ?? '')) {
    return null;
  }
  /* ═══ 2026-09-28 批 CY-⑪ 的 `hideWhenEmpty`（"AI 结论框空态不渲染"）已于 2026-09-29 批 DC 续-8 删除。══
     那条规则把「内容由付费动作产出」的字段在空态整格不渲染，于是页面上只剩那颗居中按钮。
     同一位用户两天后当面改回（逐字）：
       「你看他们的做法是这里会有一个相应的**提示词输入框的一个背景**……**用户可以随时去改这个你
         生成出来的文字。你现在的情况就做的是不对的，就是你把这个文字输入框给拿掉了。**」
     支撑反转的证据在**竞品自己的 DOM**（docs/design/data/quantv-image-builtin-pages.json:46）：
     那个具名结论框在分析之前就渲染，按钮在它下面。
     ⚠️ 判据"哪一档才出现"仍由上一行的 `visibleWhen` 管 —— 那一半是对的，保留。
     ⚠️ 引擎里这条分支**一并删掉**（不留死代码）：三处声明都去了标记，它已无人调用。 */
  /* ═══ 2026-09-27 批 CI：**按钮组的字段不能用 `<label>` 包**（用户现场复现的真 bug）═══════════════
     用户原话：「我鼠标放到现在这个区域的右下角这块空白的地方，它**第一个按钮的确会有一个灰色的
     显示**……所有带按钮的区域只要我把鼠标放到这块区域的空地上，它的第一个按钮都会有这个灰色的
     交互出现。」复现路径他给的是 /image-creation?id=image.concept_set。
     实测（.qa/ci-hover-empty4.mjs，1440 视口）：鼠标停在「比例」网格右下角的空地（那里没有按钮，
     elementsFromPoint 命中的是 `span.media-field-segmented`），而 **第一颗按钮 `概念静物` 的
     `matches(':hover') === true`**、底色从选中紫 `rgb(245,243,255)` 变成悬停灰 `rgba(12,10,9,.03)`。
     根因：`<button>` 是 **labelable 元素** —— 整格被 `<label className="media-field">` 包着时，
     浏览器会把**整格的悬停**转给它的**第一个 labelable 后代**（也就是第一颗按钮）。
     ⇒ 凡是"一组按钮"的字段（segmented / choice / 多选卡 / 档位胶囊），外层改用 `<div role="group">`
       + `aria-labelledby` 指向标题 —— 语义不变（读屏照读"比例"这一组的名字），
       悬停也不会再串到第一颗按钮上。单控件字段（文本/下拉/数字/上传）继续用 `<label>`（那才是它该有的关联）。 */
  const isOptionGroup = kind === 'segmented' || kind === 'choice' || kind === 'cards' || kind === 'multi';
  /* 批 CP：这条技能里**已经上传的素材**（上传类字段的值都是 {id,url,name} 的数组）——
     提示词框下面那一行的 @ 用它列素材（用户：「点击这个按钮就可以随时去 @ 我们现在上传的任意素材」）。 */
  const uploadedAssets = Object.values(values || {})
    .flatMap(v => (Array.isArray(v) ? v : []))
    .filter(a => a && typeof a === 'object' && (a.id || a.url))
    .filter((a, i, arr) => arr.findIndex(x => (x.id || x.url) === (a.id || a.url)) === i);
  const labelId = isOptionGroup ? `${field.key || kind}-group-label` : undefined;
  /* ═══ 批 DC（M2）：这一格被声明锁住了（disabledWhen）══════════════════════════════════════
     锁住 = 禁用控件 + **就地说明为什么**（判据与"取值夹回默认档"同源，见 skillRun.skillFieldLocked）。
     ⚠️ 不给说明的禁用控件等于死控件 —— 用户只会觉得点不动、不知道为什么（本项目铁律）。 */
  const locked = skillFieldLocked(field, values);
  const Wrapper = isOptionGroup ? 'div' : 'label';
  const wrapperProps = isOptionGroup
    ? { role: 'group', 'aria-labelledby': labelId }
    : {};
  return (
    <Wrapper className="media-field" data-kind={kind} data-span={field.span || undefined} {...wrapperProps}>
      {/* hideLabel：声明里仍要写 label（契约与读屏都用它），但这一格**页面上不画标题** ——
          知渔「套图结构配置」那一组只有组标题 + 两张卡，卡片上面没有第二个标题（批 Q）。 */}
      {labelOverride ? labelOverride : (field.hideLabel ? null : (
        <span className="media-field-label" id={labelId}>
          {field.label}
          {field.required ? <b aria-hidden="true">{REQUIRED_MARK}</b> : null}
          {/* ═══ 批 Q：上传位的计数在**标题行右端**（照知渔：「上传图片 0/6」都在同一行）
              ——我们原来把它塞进框里那颗按钮上（"上传商品图 0/6"），位置就不是他们的了。 */}
          {kind === 'upload' && Number(field.maxImages) > 1 && (
            <em className="media-field-count">{uploadCount}/{field.maxImages}</em>
          )}
        </span>
      ))}
      {/* 批 CP：把"这条技能里已经上传的素材"传给控件 —— 提示词框下面那一行的 @ 用它列素材 */}
      {control(kind, renderField, value, onChange, disabled || locked, uploadedAssets, allFields, values)}
      {field.hint ? <small className="media-field-hint">{field.hint}</small> : null}
      {/* 锁住时的那句说明（disabledHint）：说清"为什么现在选不了、想选要先改哪一格" */}
      {locked && field.disabledHint ? <small className="media-field-hint is-locked">{field.disabledHint}</small> : null}
    </Wrapper>
  );
}