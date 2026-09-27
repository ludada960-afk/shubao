import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ImagePlus, Library, Maximize2, RotateCcw, X } from 'lucide-react';

import MediaAssetCard from './MediaAssetCard.jsx';
import ProjectAssetPicker from '../ProjectAssetPicker.jsx';
import { uploadEcommerceAsset } from '../../services/api';

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
    <span className={'media-field-segmented' + (multiple ? ' is-multiple' : '')} role="group" aria-label={field.label}>
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
function TextareaControl({ field, value, onChange, disabled }) {
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
      {/* 「放大」：竞品在卖点框右上角那一颗 —— 点开一个居中的大编辑框。
          为什么值得做：他们的 placeholder 是一份**多行字段模板**（产品名/核心卖点/…），
          在 150px 高的框里写五段字确实憋屈；他们做了放大，我们也得有。 */}
      {field.expandable !== false && (
        <button
          type="button"
          className="media-field-expand"
          disabled={disabled}
          aria-label={(field.label || '文本') + '放大编辑'}
          title="放大编辑"
          onClick={() => setExpanded(true)}
        ><Maximize2 size={13} />放大</button>
      )}
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

function control(kind, field, value, onChange, disabled) {
  const id = 'field-' + field.key;
  const common = { id, disabled, 'aria-label': field.label };
  if (kind === 'select') {
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
  if (kind === 'textarea') return <TextareaControl field={field} value={value} onChange={onChange} disabled={disabled} />;
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
export default function FieldRenderer({ field = {}, value, onChange = () => {}, disabled = false, values = null, labelOverride = null }) {
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
  const labelId = isOptionGroup ? `${field.key || kind}-group-label` : undefined;
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
      {control(kind, renderField, value, onChange, disabled)}
      {field.hint ? <small className="media-field-hint">{field.hint}</small> : null}
    </Wrapper>
  );
}