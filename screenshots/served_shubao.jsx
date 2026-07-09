import { createHotContext as __vite__createHotContext } from "/@vite/client";import.meta.hot = __vite__createHotContext("/shubao-final.jsx");import __vite__cjsImport0_react_jsxDevRuntime from "/node_modules/.vite/deps/react_jsx-dev-runtime.js?v=41afaabb"; const Fragment = __vite__cjsImport0_react_jsxDevRuntime["Fragment"]; const jsxDEV = __vite__cjsImport0_react_jsxDevRuntime["jsxDEV"];
import * as RefreshRuntime from "/@react-refresh";
const inWebWorker = typeof WorkerGlobalScope !== "undefined" && self instanceof WorkerGlobalScope;
let prevRefreshReg;
let prevRefreshSig;
if (import.meta.hot && !inWebWorker) {
  if (!window.$RefreshReg$) {
    throw new Error(
      "@vitejs/plugin-react can't detect preamble. Something is wrong."
    );
  }
  prevRefreshReg = window.$RefreshReg$;
  prevRefreshSig = window.$RefreshSig$;
  window.$RefreshReg$ = RefreshRuntime.getRefreshReg("D:/AI网站/shubao/shubao-final.jsx");
  window.$RefreshSig$ = RefreshRuntime.createSignatureFunctionForTransform;
}
var _s = $RefreshSig$(), _s2 = $RefreshSig$(), _s3 = $RefreshSig$(), _s4 = $RefreshSig$(), _s5 = $RefreshSig$(), _s6 = $RefreshSig$();
import __vite__cjsImport3_react from "/node_modules/.vite/deps/react.js?v=41afaabb"; const React = __vite__cjsImport3_react.__esModule ? __vite__cjsImport3_react.default : __vite__cjsImport3_react; const useState = __vite__cjsImport3_react["useState"]; const useEffect = __vite__cjsImport3_react["useEffect"]; const useRef = __vite__cjsImport3_react["useRef"]; const useMemo = __vite__cjsImport3_react["useMemo"];
import { Sparkles, Copy, Check, RefreshCw, User, Zap, Image as Img, FileText, Hash, Clock, ArrowLeft, ArrowRight, Heart, Eye, LogIn, CreditCard, Bookmark, RotateCcw, ChevronRight, ExternalLink, Star, Target, Layers, MousePointerClick, ShieldCheck, Palette, Maximize2, Download, X, Loader2 } from "/node_modules/.vite/deps/lucide-react.js?v=41afaabb";
import NoteModal from "/src/NoteModal.jsx";
const _b = (n) => new URL("/images/" + n, import.meta.url).href;
const I = {
  s1: _b("准备好了吗？.png"),
  s2: _b("视角挥手.png"),
  s3: _b("侧面行走.png"),
  s4: _b("坐着.png"),
  s5: _b("跳跃兴奋.png"),
  wave: _b("视角挥手.png"),
  stand: _b("写作.png"),
  excited: _b("跳跃兴奋.png"),
  happy: _b("绘画.png"),
  appicon: _b("cropped.png"),
  welcome: _b("欢迎光临.png"),
  think: _b("睡觉.png"),
  upgrade: _b("升级提示.png"),
  loading: _b("举重.png"),
  result: _b("烹饪.png"),
  publish: _b("冥想.png"),
  tip: _b("跳舞.png"),
  banner: _b("超级英雄.png"),
  idea: _b("画廊策展人.png"),
  success: _b("批准印章.png"),
  protect: _b("摄影师.png"),
  scene: _b("小薯包.png"),
  walk: _b("侧面行走.png"),
  "wave-hand": _b("视角挥手.png"),
  jump: _b("跳跃兴奋.png"),
  ready: _b("准备好了吗？.png"),
  sit: _b("坐着.png"),
  surf: _b("冲浪.png"),
  meditate: _b("冥想.png"),
  cook: _b("烹饪.png"),
  dance: _b("跳舞.png"),
  done: _b("完成.png"),
  superhero: _b("超级英雄.png"),
  curator: _b("画廊策展人.png"),
  inspect: _b("检查.png"),
  photographer: _b("摄影师.png"),
  lift: _b("举重.png"),
  empty: _b("空状态.png"),
  error: _b("错误状态.png"),
  crash: _b("崩溃.png"),
  sleep: _b("睡觉.png"),
  logo_lg: _b("LOGO.png"),
  paint: _b("绘画.png"),
  analyze: _b("分析.png")
};
const R = "#FF4757", R2 = "#FF6B81", G = "#7EC882", BG = "#FFFAF9";
const API = "http://localhost:3099";
const _IMG = (id, file) => API + "/api/gallery-image?id=" + id + "&file=" + file;
const GALLERY = [{ id: "xm", title: "熬夜总结🔥厦门3天2夜精华攻略！人均800+玩到爽！", cat: "旅游攻略", grad: "linear-gradient(135deg,#FF6B35,#F7C59F)", likes: 3890, body: "谁懂啊！之前去厦门玩三天两夜，回来被问了800遍攻略！今天熬夜帮各位总结好，人均800左右就能玩得超满足～\n\n✅行程概览\nD1：鼓浪屿全天（日光岩、菽庄花园、龙头路小吃）\nD2：厦门大学+南普陀寺+沙坡尾艺术西区+猫街\nD3：黄厝沙滩日出+曾厝垵+环岛路骑行\n\n💰预算清单（人均）\n交通：约200（高铁+岛内公交）\n住宿：约300（两晚民宿，提前订）\n门票：约80（鼓浪屿船票+日光岩）\n美食：约220（沙茶面、海蛎煎、姜母鸭等）\n总计：约800起，丰俭由人\n\n⚠️实用Tips\n1️⃣ 鼓浪屿船票提前3天在「厦门轮渡」公众号买，人多时秒没！\n2️⃣ 厦大需预约，周末难约，建议工作日去。\n3️⃣ 曾厝垵小吃不踩雷推荐：阿杰五香、八婆婆烧仙草。\n4️⃣ 环岛路租电动车约30元/小时，吹海风超舒服～\n\n家人们，赶紧存下来，周末就出发！一起看海吃沙茶面！🌊", tags: ["#厦门旅游", "#厦门攻略", "#旅游攻略", "#3天2夜", "#人均800"], hint: "厦门旅游攻略", cover_url: _IMG("xm", "01-封面.png"), image_urls: [2, 3, 4, 5, 6, 7, 8, 9].map((n) => _IMG("xm", "0" + n + ".png")) }, { id: "ep", title: "实测5款百元蓝牙耳机🔥闭眼入不踩雷", cat: "好物评测", grad: "linear-gradient(135deg,#3B82F6,#6366F1)", likes: 2290, body: "家人们谁懂啊！想买个百元蓝牙耳机看花眼？我帮你实测了5款热门款，直接抄作业！\n\n🎧 漫步者X2：约100元，音质均衡，续航6小时，佩戴舒适，入门首选。\n🎧 小米Air2 SE：约120元，低音强劲，触控灵敏，适合听流行。\n🎧 绿联HiTune：约90元，续航7小时，降噪意外好，性价比炸裂。\n🎧 倍思WM01：约80元，半入耳设计，通话清晰，适合运动。\n🎧 网易云蓝牙耳机：约110元，外观潮，音质中规中矩，适合颜控。\n\n总结：百元价位首选漫步者X2，预算紧张选倍思WM01。快艾特你的冤种闺蜜一起抄作业！", tags: ["#蓝牙耳机推荐", "#百元耳机", "#数码好物", "#学生党必备"], hint: "百元蓝牙耳机推荐", cover_url: _IMG("ep", "01-封面.png"), image_urls: [2, 3, 4, 5, 6, 7, 8, 9].map((n) => _IMG("ep", "0" + n + ".png")) }, { id: "crab", title: "人均80吃帝王蟹🦀？这家大排档也太狠了吧！", cat: "美食探店", grad: "linear-gradient(135deg,#F97316,#FBBF24)", likes: 4523, body: "谁懂啊！以前总觉得海鲜大排档又贵又坑，结果被闺蜜拉去吃了一顿，直接刷新认知😱！人均才80左右，就能炫到整只帝王蟹，还有各种鲜活海鲜，性价比炸裂！\n\n🦀【招牌帝王蟹】\n整只清蒸或避风塘做法，肉质鲜甜Q弹，蟹黄满满！一份约4斤，足够3-4人吃，单点价格约280元，人均才70多！\n\n🦐【椒盐皮皮虾】\n只只带膏，椒盐味超香，外壳酥脆，肉质紧实。一份约68元，必点！\n\n🦪【蒜蓉烤生蚝】\n现开现烤，蒜蓉酱调得绝了，生蚝肥美多汁。一打约58元，性价比超高！\n\n🔥【避风塘炒蟹】\n如果帝王蟹吃腻了，还可以点避风塘炒蟹，香辣入味，锅气十足，一份约128元。\n\n💡【省钱Tips】\n建议下午4点前到店，有早鸟折扣；人多点套餐更划算，人均约80-100元就能吃到撑！还有免费停车位哦～\n\n快艾特你的饭搭子，周末去这家大排档实现海鲜自由吧！🦀✨", tags: ["#海鲜大排档", "#帝王蟹", "#人均80", "#美食探店", "#性价比海鲜"], hint: "帝王蟹探店推荐", cover_url: _IMG("crab", "01-封面.png"), image_urls: [2, 3, 4, 5, 6, 7, 8, 9].map((n) => _IMG("crab", "0" + n + ".png")) }];
const QUICK_HINTS = ["📍厦门3天2夜旅游攻略", "🎧百元蓝牙耳机测评", "🦀海鲜大排档人均80吃帝王蟹", "🎀JK穿搭分享", "🤖最新AI工具推荐合集", "📚考研英语85分方法", "🛏️300元出租屋改造攻略", "🧴25岁精简护肤步骤", "🍱上班族5天带饭食谱", "🏋️30天居家普拉提计划", "🪴500元极简客厅改造", "🎬2026必看国产剧推荐", "💰裸辞做自媒体搞钱思路", "📖改变认知的6本好书推荐"];
const PRICING = [{ name: "入门", price: 19, sets: 6, regen: 3, desc: "适合偶尔创作", per: "3.2" }, { name: "进阶", price: 49, sets: 18, regen: 5, pop: true, desc: "个人博主首选", per: "2.7" }, { name: "创作者", price: 89, sets: 38, regen: 8, desc: "高频创作者", per: "2.3" }, { name: "工作室", price: 169, sets: 80, regen: 15, desc: "团队批量使用", per: "2.1" }];
const TIPS = ["标题带数字的笔记，点击率平均高出47%", "发布时间建议：周四/周五晚上8-9点", "正文前3行决定80%用户是否继续阅读", "每篇笔记建议5-7个精准标签", "封面图配色统一度直接影响账号调性", "评论区互动率高的笔记更容易被推荐", "带价格的种草笔记收藏率高出60%", "干货笔记的生命周期比日常分享长3倍", "小红书流量池推荐机制最多有8层", "视频笔记平均互动率比图文高23%", "首图加文字标签的笔记收藏率高35%", "互动数据好的笔记会被推荐到更大流量池", "真诚的标题比夸张的标题更受平台推荐", "9张配图比单张图片完播率高2倍", "笔记发布后1小时内是流量关键期", "合适的发布时间能让曝光翻倍", "正文前3行一定要吸引人否则用户直接划走", "带定位的探店笔记曝光率高出50%", "有对比的干货笔记更容易被收藏", "用提问式结尾能提升评论区互动率"];
const CHAR_CYCLE = ["ready", "wave", "walk", "stand", "jump", "sit", "meditate", "cook", "success", "curator", "analyze", "surf", "superhero", "paint", "dance", "welcome", "lift", "inspect", "upgrade"];
const STAGES = [{ img: "s1", label: "研读素材", desc: "小薯包正在认真分析你的内容..." }, { img: "s2", label: "撰写文案", desc: "灵感爆发！正在打磨爆款文案" }, { img: "s3", label: "生成配图", desc: "正在精心绘制第 {n}/9 张图片" }, { img: "s4", label: "品质优化", desc: "正在精修图片细节，确保每一张都精致出彩" }, { img: "s5", label: "打包完成", desc: "搞定！你的爆款图文来啦" }];
const FEATURES = [{ icon: Target, title: "智能识别赛道", desc: "粘贴任意素材，AI自动判断旅游、美食、好物等最佳内容策略，不需要手动选择" }, { icon: Zap, title: "爆款公式驱动", desc: "内置数字结果式、反差痛点式等经过验证的爆款标题和正文公式" }, { icon: Layers, title: "9张完整配图", desc: "1张封面+8张内容页，带拼图排版和文字标注，下载即可发布" }, { icon: RotateCcw, title: "单张可重新生成", desc: "对某张图不满意？单独刷新这一张，不浪费整套额度" }, { icon: MousePointerClick, title: "一键复制文案", desc: "标题、正文、标签分别复制或一键全部复制，打开小红书直接粘贴发布" }, { icon: ShieldCheck, title: "按套计费不套路", desc: "用多少买多少，不搞自动续费，新用户免费体验1套" }];
async function genAPI(t, onImg, onProg) {
  const r = await fetch(API + "/api/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: t }) });
  if (!r.ok) {
    const e = await r.text().catch(() => r.statusText);
    throw new Error(e.slice(0, 200));
  }
  const reader = r.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  const result = { cover_url: "", image_urls: [] };
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split(String.fromCharCode(10));
    buf = lines.pop() || "";
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      try {
        const d = JSON.parse(line.slice(6));
        if (d.type === "progress" && onProg) onProg(d);
        else if (d.type === "image") {
          if (d.id === "cover") result.cover_url = d.url;
          else if (d.url) result.image_urls.push(d.url);
          if (onImg) onImg(d);
        } else if (d.type === "complete") {
          Object.assign(result, d);
          result.image_count = d.image_urls?.length || 0;
        } else if (d.type === "error") throw new Error(d.error || "生成失败");
      } catch (e) {
      }
    }
  }
  return result;
}
async function saveWork(w) {
  try {
    var local = JSON.parse(localStorage.getItem("sb-works") || "[]");
    var idx = local.findIndex(function(x) {
      return x._inputText === w._inputText;
    });
    if (idx >= 0) {
      local[idx] = { ...local[idx], ...w, id: local[idx].id, at: local[idx].at };
    } else {
      local.unshift({ ...w, id: Date.now(), at: (/* @__PURE__ */ new Date()).toLocaleDateString("zh-CN") });
    }
    localStorage.setItem("sb-works", JSON.stringify(local.slice(0, 50)));
  } catch (e) {
  }
  try {
    await fetch(API + "/api/save-work", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ work: w }) });
  } catch (e) {
    console.warn("saveWork:", e.message);
    try {
      await new Promise(function(r) {
        return setTimeout(r, 500);
      });
      await fetch(API + "/api/save-work", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ work: w }) });
    } catch (e2) {
      console.warn("saveWork retry:", e2.message);
    }
  }
}
async function loadWorks() {
  try {
    const r = await fetch(API + "/api/works");
    if (r.ok) {
      var d = await r.json();
      try {
        var local = JSON.parse(localStorage.getItem("sb-works") || "[]");
        var sk = new Set(d.map(function(x) {
          return x._inputText;
        }));
        var missing = local.filter(function(x) {
          return x._saveKey && !sk.has(x._inputText);
        });
        if (missing.length > 0) {
          d = [...missing, ...d].slice(0, 50);
        }
      } catch (e) {
      }
      try {
        localStorage.setItem("sb-works", JSON.stringify(d));
      } catch (e) {
      }
      return d;
    }
  } catch (e) {
    console.warn("loadWorks:", e.message);
  }
  try {
    return JSON.parse(localStorage.getItem("sb-works") || "[]");
  } catch (e) {
  }
  return [];
}
async function getPts() {
  try {
    return parseInt(localStorage.getItem("sb-p") || "1");
  } catch {
    return 1;
  }
}
async function setPts(n) {
  try {
    localStorage.setItem("sb-p", String(n));
  } catch {
  }
}
const s = { card: { background: "#fff", borderRadius: 16, border: "1px solid #f0f0f0", overflow: "hidden" }, cardP: { background: "#fff", borderRadius: 16, border: "1px solid #f0f0f0", padding: "20px 22px" }, section: { maxWidth: 800, margin: "0 auto", padding: "40px 20px" }, sectionTitle: { fontSize: 22, fontWeight: 700, textAlign: "center", margin: "0 0 6px", fontFamily: "'PingFang SC','Microsoft YaHei','Noto Sans SC',sans-serif" }, sectionSub: { fontSize: 13, color: "#999", textAlign: "center", margin: "0 0 28px" } };
function Btn({ children, primary, small, onClick, disabled, full, sx = {} }) {
  _s();
  const [h, setH] = useState(false);
  return /* @__PURE__ */ jsxDEV("button", { style: { display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7, border: primary ? "none" : "1px solid #e8e8e8", borderRadius: small ? 8 : 12, fontSize: small ? 12 : 15, fontWeight: 600, cursor: disabled ? "not-allowed" : "pointer", fontFamily: "inherit", transition: "all 0.2s", transform: h && !disabled ? "translateY(-1px)" : "none", padding: small ? "6px 14px" : "13px 28px", width: full ? "100%" : "auto", background: primary ? disabled ? "#FFB3BD" : R : h ? "#f8f8f8" : "#fff", color: primary ? "#fff" : "#555", boxShadow: primary && h && !disabled ? "0 6px 24px rgba(255,71,87,0.25)" : "none", ...sx }, onClick, disabled, onMouseEnter: () => setH(true), onMouseLeave: () => setH(false), children }, void 0, false, {
    fileName: "D:/AI网站/shubao/shubao-final.jsx",
    lineNumber: 60,
    columnNumber: 125
  }, this);
}
_s(Btn, "8q/03bBkK6j37jGZcAIxBqNwQHQ=");
_c = Btn;
function CopyBtn({ text, label = "复制" }) {
  _s2();
  const [ok, setOk] = useState(false);
  return /* @__PURE__ */ jsxDEV(Btn, { small: true, onClick: () => {
    navigator.clipboard?.writeText(text);
    setOk(true);
    setTimeout(() => setOk(false), 1500);
  }, sx: { color: ok ? G : "#aaa", background: ok ? "#F0FFF4" : "#f8f8f8", border: "none" }, children: ok ? /* @__PURE__ */ jsxDEV(Fragment, { children: [
    /* @__PURE__ */ jsxDEV(Check, { size: 12 }, void 0, false, {
      fileName: "D:/AI网站/shubao/shubao-final.jsx",
      lineNumber: 62,
      columnNumber: 304
    }, this),
    "已复制"
  ] }, void 0, true, {
    fileName: "D:/AI网站/shubao/shubao-final.jsx",
    lineNumber: 62,
    columnNumber: 302
  }, this) : /* @__PURE__ */ jsxDEV(Fragment, { children: [
    /* @__PURE__ */ jsxDEV(Copy, { size: 12 }, void 0, false, {
      fileName: "D:/AI网站/shubao/shubao-final.jsx",
      lineNumber: 62,
      columnNumber: 334
    }, this),
    label
  ] }, void 0, true, {
    fileName: "D:/AI网站/shubao/shubao-final.jsx",
    lineNumber: 62,
    columnNumber: 332
  }, this) }, void 0, false, {
    fileName: "D:/AI网站/shubao/shubao-final.jsx",
    lineNumber: 62,
    columnNumber: 92
  }, this);
}
_s2(CopyBtn, "PB0jEj4PXkZNBC+OeIuthLI053c=");
_c2 = CopyBtn;
function Card({ children, sx = {}, hover, onClick }) {
  _s3();
  const [h, setH] = useState(false);
  return /* @__PURE__ */ jsxDEV("div", { onClick, style: { ...s.card, transition: "all 0.25s ease", transform: h && hover ? "translateY(-4px)" : "none", boxShadow: h && hover ? "0 12px 40px rgba(0,0,0,0.08)" : "0 1px 3px rgba(0,0,0,0.02)", cursor: hover ? "pointer" : "default", ...sx }, onMouseEnter: () => setH(true), onMouseLeave: () => setH(false), children }, void 0, false, {
    fileName: "D:/AI网站/shubao/shubao-final.jsx",
    lineNumber: 64,
    columnNumber: 102
  }, this);
}
_s3(Card, "8q/03bBkK6j37jGZcAIxBqNwQHQ=");
_c3 = Card;
function CharImg({ src, alt = "", style = {}, margin, filter }) {
  return /* @__PURE__ */ jsxDEV("div", { style: { display: "inline-flex", alignItems: "center", justifyContent: "center", margin: margin || 0, filter: filter || "drop-shadow(0 4px 12px rgba(255,71,87,0.12))", lineHeight: 0 }, children: /* @__PURE__ */ jsxDEV("img", { src, alt, style: { ...style, display: "block", maxWidth: "100%", objectFit: "contain" } }, void 0, false, {
    fileName: "D:/AI网站/shubao/shubao-final.jsx",
    lineNumber: 68,
    columnNumber: 5
  }, this) }, void 0, false, {
    fileName: "D:/AI网站/shubao/shubao-final.jsx",
    lineNumber: 67,
    columnNumber: 10
  }, this);
}
_c4 = CharImg;
function Modal({ children, onClose }) {
  return /* @__PURE__ */ jsxDEV("div", { style: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 999, display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(6px)", animation: "fadeIn 0.15s" }, onClick: onClose, children: /* @__PURE__ */ jsxDEV("div", { onClick: (e) => e.stopPropagation(), style: { background: "#fff", borderRadius: 24, padding: "36px 30px", width: 400, maxWidth: "92vw", animation: "slideUp 0.25s ease", maxHeight: "90vh", overflow: "auto" }, children }, void 0, false, {
    fileName: "D:/AI网站/shubao/shubao-final.jsx",
    lineNumber: 72,
    columnNumber: 275
  }, this) }, void 0, false, {
    fileName: "D:/AI网站/shubao/shubao-final.jsx",
    lineNumber: 72,
    columnNumber: 47
  }, this);
}
_c5 = Modal;
async function downloadZip(coverUrl, imageUrls, title, bodyText, hashtags) {
  if (!coverUrl && !imageUrls?.length) return alert("暂无图片可下载");
  try {
    const JSZip = (await import('/node_modules/.vite/deps/jszip.js?v=41afaabb').then(m => ((m) => m?.__esModule ? m : { ...typeof m === "object" && !Array.isArray(m) || typeof m === "function" ? m : {}, default: m })(m.default))).default;
    const zip = new JSZip();
    const all = [coverUrl, ...imageUrls || []].filter(Boolean);
    let ok = 0;
    if (bodyText || title) {
      var textContent = (title || "") + "\n\n" + (bodyText || "") + "\n\n" + (hashtags || []).join(" ");
      zip.file("00-文章内容.txt", textContent);
    }
    const results = await Promise.all(all.map(async function(url, i) {
      try {
        const resp = await fetch(API + "/api/proxy-image?url=" + encodeURIComponent(url));
        if (!resp.ok) return null;
        const blob = await resp.blob();
        return { name: i === 0 ? "01-封面" : "0" + (i + 1), blob };
      } catch (e) {
        return null;
      }
    }));
    results.forEach(function(r) {
      if (r) {
        zip.file(r.name + ".png", r.blob);
        ok++;
      }
    });
    if (!ok) return alert("下载失败，图片可能已过期");
    const content = await zip.generateAsync({ type: "blob" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(content);
    link.download = (title || "薯包AI").slice(0, 20) + "图文.zip";
    link.click();
    URL.revokeObjectURL(link.href);
  } catch (e) {
    alert("下载失败，请重试");
  }
}
function ResultDisplay({ result, logged, onLogin, onPrice, loginModal, priceModal, textRegen, text, setResult, setGen }) {
  _s4();
  const [imgIdx, setImgIdx] = useState(0);
  const [zoom, setZoom] = useState(null);
  const [rgIdx, setRgIdx] = useState(null);
  const allImages = useMemo(() => {
    const a = [];
    if (result?.cover_url) a.push(result.cover_url);
    if (result?.image_urls) a.push(...result.image_urls);
    return a;
  }, [result]);
  const pages = result?.pages || [];
  const curPage = pages[imgIdx] || pages[0] || {};
  const maxI = allImages.length;
  useEffect(() => {
    if (zoom) return;
    const h = (e) => {
      if (e.key === "ArrowLeft") {
        setImgIdx((i) => Math.max(0, i - 1));
        e.preventDefault();
      }
      if (e.key === "ArrowRight") {
        setImgIdx((i) => Math.min(maxI - 1, i + 1));
        e.preventDefault();
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [zoom, maxI]);
  useEffect(() => {
    if (!zoom) return;
    const h = (e) => {
      if (e.key === "Escape") {
        setZoom(null);
        e.preventDefault();
      }
      if (e.key === "ArrowLeft") {
        setImgIdx((i) => {
          const n = Math.max(0, i - 1);
          setZoom(allImages[n]);
          return n;
        });
        e.preventDefault();
      }
      if (e.key === "ArrowRight") {
        setImgIdx((i) => {
          const n = Math.min(maxI - 1, i + 1);
          setZoom(allImages[n]);
          return n;
        });
        e.preventDefault();
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [zoom, allImages, maxI]);
  const regenSingle = async (i) => {
    if (!confirm("重新生成这张图片将消耗1次额度，确定？")) return;
    setRgIdx(i);
    try {
      let prompt = "";
      if (i === 0 && result?.cover_prompt) prompt = result.cover_prompt;
      else if (i > 0) {
        const pi = result?.image_prompts?.find?.((p) => p.page_id === i + 1);
        if (pi) prompt = pi.prompt;
      }
      if (!prompt) throw new Error("未找到该页的图片描述");
      const r = await fetch(API + "/api/regenerate-image", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt }) });
      if (!r.ok) throw new Error("请求失败");
      const d = await r.json();
      if (!d.url) throw new Error("生成失败");
      setResult((prev) => {
        if (i === 0) return { ...prev, cover_url: d.url };
        const u = [...prev.image_urls || []];
        if (u[i - 1]) u[i - 1] = d.url;
        return { ...prev, image_urls: u };
      });
    } catch (e) {
      alert("图片生成失败：" + e.message);
    }
    setRgIdx(null);
  };
  if (!result || !curPage) return null;
  const C = css();
  return /* @__PURE__ */ jsxDEV("div", { style: { minHeight: "100vh", background: BG }, children: [
    C,
    zoom && /* @__PURE__ */ jsxDEV("div", { style: { position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.92)", display: "flex", alignItems: "center", justifyContent: "center", animation: "fadeIn .15s", cursor: "zoom-out" }, onClick: () => setZoom(null), children: [
      /* @__PURE__ */ jsxDEV("button", { onClick: (e) => {
        e.stopPropagation();
        setImgIdx((i) => {
          const n = Math.max(0, i - 1);
          setZoom(allImages[n]);
          return n;
        });
      }, style: { position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", width: 40, height: 40, borderRadius: "50%", background: "rgba(255,255,255,0.15)", border: "none", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, zIndex: 10, backdropFilter: "blur(4px)", transition: "background .2s" }, onMouseEnter: (e) => e.target.style.background = "rgba(255,255,255,0.25)", onMouseLeave: (e) => e.target.style.background = "rgba(255,255,255,0.15)", children: "‹" }, void 0, false, {
        fileName: "D:/AI网站/shubao/shubao-final.jsx",
        lineNumber: 172,
        columnNumber: 7
      }, this),
      /* @__PURE__ */ jsxDEV("img", { src: zoom, alt: "", style: { maxWidth: "92%", maxHeight: "92%", objectFit: "contain", borderRadius: 12, boxShadow: "0 20px 60px rgba(0,0,0,0.5)", cursor: "default" }, onClick: (e) => e.stopPropagation() }, void 0, false, {
        fileName: "D:/AI网站/shubao/shubao-final.jsx",
        lineNumber: 173,
        columnNumber: 7
      }, this),
      /* @__PURE__ */ jsxDEV("button", { onClick: (e) => {
        e.stopPropagation();
        setImgIdx((i) => {
          const n = Math.min(maxI - 1, i + 1);
          setZoom(allImages[n]);
          return n;
        });
      }, style: { position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", width: 40, height: 40, borderRadius: "50%", background: "rgba(255,255,255,0.15)", border: "none", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, zIndex: 10, backdropFilter: "blur(4px)", transition: "background .2s" }, onMouseEnter: (e) => e.target.style.background = "rgba(255,255,255,0.25)", onMouseLeave: (e) => e.target.style.background = "rgba(255,255,255,0.15)", children: "›" }, void 0, false, {
        fileName: "D:/AI网站/shubao/shubao-final.jsx",
        lineNumber: 174,
        columnNumber: 7
      }, this),
      /* @__PURE__ */ jsxDEV("div", { style: { position: "absolute", bottom: 20, left: "50%", transform: "translateX(-50%)", color: "rgba(255,255,255,0.5)", fontSize: 12 }, children: [
        imgIdx + 1,
        "/",
        maxI,
        " · ↑↓ ← → 切换 · ESC 关闭"
      ] }, void 0, true, {
        fileName: "D:/AI网站/shubao/shubao-final.jsx",
        lineNumber: 175,
        columnNumber: 7
      }, this)
    ] }, void 0, true, {
      fileName: "D:/AI网站/shubao/shubao-final.jsx",
      lineNumber: 171,
      columnNumber: 14
    }, this),
    !logged && /* @__PURE__ */ jsxDEV("div", { style: { display: "none" }, children: [
      /* @__PURE__ */ jsxDEV("span", { style: { fontSize: 13, color: "#333" }, children: "登录即可把作品保存到「我的作品」" }, void 0, false, {
        fileName: "D:/AI网站/shubao/shubao-final.jsx",
        lineNumber: 180,
        columnNumber: 7
      }, this),
      /* @__PURE__ */ jsxDEV(Btn, { small: true, onClick: onLogin, sx: { background: R, color: "#fff", border: "none", whiteSpace: "nowrap" }, children: [
        /* @__PURE__ */ jsxDEV(LogIn, { size: 12 }, void 0, false, {
          fileName: "D:/AI网站/shubao/shubao-final.jsx",
          lineNumber: 181,
          columnNumber: 112
        }, this),
        "登录"
      ] }, void 0, true, {
        fileName: "D:/AI网站/shubao/shubao-final.jsx",
        lineNumber: 181,
        columnNumber: 7
      }, this)
    ] }, void 0, true, {
      fileName: "D:/AI网站/shubao/shubao-final.jsx",
      lineNumber: 179,
      columnNumber: 17
    }, this),
    /* @__PURE__ */ jsxDEV("div", { style: { display: "none" }, children: [
      /* @__PURE__ */ jsxDEV("div", { style: { display: "flex", alignItems: "center", gap: 8 }, children: [
        /* @__PURE__ */ jsxDEV(Btn, { small: true, onClick: () => {
          setGen("idle");
          setResult(null);
        }, children: [
          /* @__PURE__ */ jsxDEV(ArrowLeft, { size: 14 }, void 0, false, {
            fileName: "D:/AI网站/shubao/shubao-final.jsx",
            lineNumber: 187,
            columnNumber: 70
          }, this),
          " 返回"
        ] }, void 0, true, {
          fileName: "D:/AI网站/shubao/shubao-final.jsx",
          lineNumber: 187,
          columnNumber: 9
        }, this),
        /* @__PURE__ */ jsxDEV("span", { style: { fontSize: 12, background: "#FFF1F3", color: R, padding: "4px 12px", borderRadius: 20, fontWeight: 600 }, children: result.category }, void 0, false, {
          fileName: "D:/AI网站/shubao/shubao-final.jsx",
          lineNumber: 188,
          columnNumber: 9
        }, this),
        /* @__PURE__ */ jsxDEV("span", { style: { fontSize: 11, color: "#999" }, children: [
          result.audience || "",
          result.tip ? " · " + result.tip : ""
        ] }, void 0, true, {
          fileName: "D:/AI网站/shubao/shubao-final.jsx",
          lineNumber: 189,
          columnNumber: 9
        }, this)
      ] }, void 0, true, {
        fileName: "D:/AI网站/shubao/shubao-final.jsx",
        lineNumber: 186,
        columnNumber: 7
      }, this),
      /* @__PURE__ */ jsxDEV("div", { style: { display: "flex", gap: 6 }, children: /* @__PURE__ */ jsxDEV(Btn, { small: true, onClick: () => downloadZip(result.cover_url, result.image_urls, result.title, result.body_text, result.hashtags), sx: { background: "#f8f8f8", color: "#555", border: "none" }, children: [
        /* @__PURE__ */ jsxDEV(Download, { size: 12 }, void 0, false, {
          fileName: "D:/AI网站/shubao/shubao-final.jsx",
          lineNumber: 192,
          columnNumber: 196
        }, this),
        " 下载图片"
      ] }, void 0, true, {
        fileName: "D:/AI网站/shubao/shubao-final.jsx",
        lineNumber: 192,
        columnNumber: 9
      }, this) }, void 0, false, {
        fileName: "D:/AI网站/shubao/shubao-final.jsx",
        lineNumber: 191,
        columnNumber: 7
      }, this)
    ] }, void 0, true, {
      fileName: "D:/AI网站/shubao/shubao-final.jsx",
      lineNumber: 185,
      columnNumber: 5
    }, this),
    /* @__PURE__ */ jsxDEV("div", { style: { maxWidth: 960, margin: "0 auto", padding: "16px 16px 60px" }, children: [
      /* @__PURE__ */ jsxDEV("div", { style: { display: "flex", gap: 16, alignItems: "flex-start" }, children: [
        /* @__PURE__ */ jsxDEV("div", { style: { flex: "0 0 auto", position: "relative", width: "50%", maxWidth: 420 }, children: [
          /* @__PURE__ */ jsxDEV(
            "div",
            {
              style: { position: "relative", borderRadius: 12, overflow: "hidden", background: "#f5f5f5", boxShadow: "0 4px 20px rgba(0,0,0,0.06)" },
              onMouseEnter: function(e) {
                e.currentTarget.querySelectorAll(".xhs-nav").forEach(function(b) {
                  b.style.opacity = "1";
                });
              },
              onMouseLeave: function(e) {
                e.currentTarget.querySelectorAll(".xhs-nav").forEach(function(b) {
                  b.style.opacity = "0";
                });
              },
              children: [
                allImages[imgIdx] ? /* @__PURE__ */ jsxDEV(Fragment, { children: [
                  /* @__PURE__ */ jsxDEV("img", { src: allImages[imgIdx], alt: "", style: { width: "100%", display: "block", cursor: "pointer", aspectRatio: "3/4", objectFit: "cover" }, onClick: () => setZoom(allImages[imgIdx]) }, void 0, false, {
                    fileName: "D:/AI网站/shubao/shubao-final.jsx",
                    lineNumber: 205,
                    columnNumber: 36
                  }, this),
                  (() => {
                    const p = imgIdx === 0 ? { title: result.title, hook: result.category } : pages[imgIdx - 1] || {};
                    return /* @__PURE__ */ jsxDEV(Fragment, { children: [
                      p?.title ? /* @__PURE__ */ jsxDEV("div", { style: { position: "absolute", top: 0, left: 0, right: 0, padding: "14px 14px 40px", background: "linear-gradient(180deg,rgba(0,0,0,0.65) 0%,transparent 100%)", color: "#fff", fontSize: 15, fontWeight: 700, lineHeight: 1.5, textShadow: "0 2px 8px rgba(0,0,0,0.4)", pointerEvents: "none", zIndex: 3 }, children: p.title }, void 0, false, {
                        fileName: "D:/AI网站/shubao/shubao-final.jsx",
                        lineNumber: 211,
                        columnNumber: 29
                      }, this) : null,
                      imgIdx > 0 && p?.info_blocks?.length > 0 ? /* @__PURE__ */ jsxDEV("div", { style: { position: "absolute", bottom: 44, left: 0, right: 0, padding: "8px 12px", display: "flex", flexWrap: "wrap", gap: 4, pointerEvents: "none", zIndex: 3 }, children: p.info_blocks.slice(0, 4).map(
                        (b, i) => /* @__PURE__ */ jsxDEV("span", { style: { background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)", borderRadius: 6, padding: "2px 8px", fontSize: 10, color: "#fff", lineHeight: 1.6 }, children: [
                          b.label,
                          ": ",
                          /* @__PURE__ */ jsxDEV("strong", { children: b.value }, void 0, false, {
                            fileName: "D:/AI网站/shubao/shubao-final.jsx",
                            lineNumber: 215,
                            columnNumber: 201
                          }, this)
                        ] }, i, true, {
                          fileName: "D:/AI网站/shubao/shubao-final.jsx",
                          lineNumber: 215,
                          columnNumber: 21
                        }, this)
                      ) }, void 0, false, {
                        fileName: "D:/AI网站/shubao/shubao-final.jsx",
                        lineNumber: 213,
                        columnNumber: 61
                      }, this) : null,
                      p?.hook ? /* @__PURE__ */ jsxDEV("div", { style: { position: "absolute", bottom: 8, left: 0, right: 0, padding: "4px 14px", color: "#ffd700", fontSize: 11, fontStyle: "italic", textShadow: "0 1px 6px rgba(0,0,0,0.5)", pointerEvents: "none", textAlign: "center", zIndex: 3 }, children: p.hook }, void 0, false, {
                        fileName: "D:/AI网站/shubao/shubao-final.jsx",
                        lineNumber: 219,
                        columnNumber: 28
                      }, this) : null
                    ] }, void 0, true, {
                      fileName: "D:/AI网站/shubao/shubao-final.jsx",
                      lineNumber: 209,
                      columnNumber: 24
                    }, this);
                  })()
                ] }, void 0, true, {
                  fileName: "D:/AI网站/shubao/shubao-final.jsx",
                  lineNumber: 205,
                  columnNumber: 34
                }, this) : /* @__PURE__ */ jsxDEV("div", { style: { width: "100%", aspectRatio: "3/4", display: "flex", alignItems: "center", justifyContent: "center", color: "#ccc", fontSize: 13 }, children: "暂无图片" }, void 0, false, {
                  fileName: "D:/AI网站/shubao/shubao-final.jsx",
                  lineNumber: 222,
                  columnNumber: 19
                }, this),
                /* @__PURE__ */ jsxDEV("div", { className: "xhs-nav", style: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, opacity: 0, transition: "opacity 0.2s", pointerEvents: "none" }, children: [
                  imgIdx > 0 && /* @__PURE__ */ jsxDEV("button", { style: { position: "absolute", left: 6, top: "50%", transform: "translateY(-50%)", pointerEvents: "auto", width: 32, height: 32, borderRadius: "50%", background: "rgba(255,255,255,0.9)", border: "none", boxShadow: "0 2px 8px rgba(0,0,0,0.1)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, color: "#555", transition: "all .15s" }, onMouseEnter: (e) => e.currentTarget.style.background = "#fff", onMouseLeave: (e) => e.currentTarget.style.background = "rgba(255,255,255,0.9)", onClick: () => setImgIdx((i) => i - 1), children: "‹" }, void 0, false, {
                    fileName: "D:/AI网站/shubao/shubao-final.jsx",
                    lineNumber: 226,
                    columnNumber: 30
                  }, this),
                  imgIdx < maxI - 1 && /* @__PURE__ */ jsxDEV("button", { style: { position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)", pointerEvents: "auto", width: 32, height: 32, borderRadius: "50%", background: "rgba(255,255,255,0.9)", border: "none", boxShadow: "0 2px 8px rgba(0,0,0,0.1)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, color: "#555", transition: "all .15s" }, onMouseEnter: (e) => e.currentTarget.style.background = "#fff", onMouseLeave: (e) => e.currentTarget.style.background = "rgba(255,255,255,0.9)", onClick: () => setImgIdx((i) => i + 1), children: "›" }, void 0, false, {
                    fileName: "D:/AI网站/shubao/shubao-final.jsx",
                    lineNumber: 227,
                    columnNumber: 37
                  }, this)
                ] }, void 0, true, {
                  fileName: "D:/AI网站/shubao/shubao-final.jsx",
                  lineNumber: 225,
                  columnNumber: 13
                }, this),
                /* @__PURE__ */ jsxDEV("button", { onClick: (e) => {
                  e.stopPropagation();
                  regenSingle(imgIdx);
                }, disabled: rgIdx === imgIdx, style: { position: "absolute", left: 8, bottom: 8, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)", border: "none", borderRadius: 8, padding: "5px 10px", color: "#fff", fontSize: 11, cursor: "pointer", display: "flex", alignItems: "center", gap: 4, transition: "background .2s", zIndex: 5 }, onMouseEnter: (e) => e.currentTarget.style.background = "rgba(0,0,0,0.7)", onMouseLeave: (e) => e.currentTarget.style.background = "rgba(0,0,0,0.55)", children: rgIdx === imgIdx ? /* @__PURE__ */ jsxDEV(Fragment, { children: [
                  /* @__PURE__ */ jsxDEV(Loader2, { size: 11, className: "spin" }, void 0, false, {
                    fileName: "D:/AI网站/shubao/shubao-final.jsx",
                    lineNumber: 232,
                    columnNumber: 37
                  }, this),
                  " 刷新中..."
                ] }, void 0, true, {
                  fileName: "D:/AI网站/shubao/shubao-final.jsx",
                  lineNumber: 232,
                  columnNumber: 35
                }, this) : /* @__PURE__ */ jsxDEV(Fragment, { children: [
                  /* @__PURE__ */ jsxDEV(RefreshCw, { size: 11 }, void 0, false, {
                    fileName: "D:/AI网站/shubao/shubao-final.jsx",
                    lineNumber: 232,
                    columnNumber: 90
                  }, this),
                  " 重生成"
                ] }, void 0, true, {
                  fileName: "D:/AI网站/shubao/shubao-final.jsx",
                  lineNumber: 232,
                  columnNumber: 88
                }, this) }, void 0, false, {
                  fileName: "D:/AI网站/shubao/shubao-final.jsx",
                  lineNumber: 231,
                  columnNumber: 13
                }, this),
                /* @__PURE__ */ jsxDEV("div", { style: { position: "absolute", right: 8, bottom: 8, background: "rgba(0,0,0,0.45)", backdropFilter: "blur(4px)", borderRadius: 6, padding: "3px 8px", color: "#fff", fontSize: 10, zIndex: 5 }, children: [
                  imgIdx + 1,
                  "/",
                  maxI
                ] }, void 0, true, {
                  fileName: "D:/AI网站/shubao/shubao-final.jsx",
                  lineNumber: 236,
                  columnNumber: 13
                }, this)
              ]
            },
            void 0,
            true,
            {
              fileName: "D:/AI网站/shubao/shubao-final.jsx",
              lineNumber: 201,
              columnNumber: 11
            },
            this
          ),
          /* @__PURE__ */ jsxDEV("div", { style: { display: "flex", gap: 4, marginTop: 8, overflowX: "auto", paddingBottom: 4 }, children: allImages.map(
            (url, i) => /* @__PURE__ */ jsxDEV("div", { onClick: () => setImgIdx(i), style: { flex: "0 0 auto", width: 44, height: 59, borderRadius: 6, overflow: "hidden", border: i === imgIdx ? "2px solid " + R : "2px solid transparent", cursor: "pointer", opacity: i === imgIdx ? 1 : 0.5, transition: "all .15s" }, onMouseEnter: (e) => e.currentTarget.style.opacity = "1", onMouseLeave: (e) => {
              if (i !== imgIdx) e.currentTarget.style.opacity = "0.5";
            }, children: /* @__PURE__ */ jsxDEV("img", { src: url, alt: "", style: { width: "100%", height: "100%", objectFit: "cover", display: "block" } }, void 0, false, {
              fileName: "D:/AI网站/shubao/shubao-final.jsx",
              lineNumber: 243,
              columnNumber: 17
            }, this) }, i, false, {
              fileName: "D:/AI网站/shubao/shubao-final.jsx",
              lineNumber: 242,
              columnNumber: 13
            }, this)
          ) }, void 0, false, {
            fileName: "D:/AI网站/shubao/shubao-final.jsx",
            lineNumber: 240,
            columnNumber: 11
          }, this)
        ] }, void 0, true, {
          fileName: "D:/AI网站/shubao/shubao-final.jsx",
          lineNumber: 200,
          columnNumber: 9
        }, this),
        /* @__PURE__ */ jsxDEV("div", { style: { flex: 1, minWidth: 0 }, children: [
          /* @__PURE__ */ jsxDEV("div", { style: { display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }, children: [
            /* @__PURE__ */ jsxDEV("img", { src: I.appicon, alt: "", style: { width: 34, height: 34, borderRadius: "50%", objectFit: "cover", flex: "0 0 auto" } }, void 0, false, {
              fileName: "D:/AI网站/shubao/shubao-final.jsx",
              lineNumber: 251,
              columnNumber: 108
            }, this),
            /* @__PURE__ */ jsxDEV("div", { children: [
              /* @__PURE__ */ jsxDEV("div", { style: { fontSize: 13, fontWeight: 600, color: "#222" }, children: "薯包AI" }, void 0, false, {
                fileName: "D:/AI网站/shubao/shubao-final.jsx",
                lineNumber: 251,
                columnNumber: 236
              }, this),
              /* @__PURE__ */ jsxDEV("div", { style: { fontSize: 11, color: "#999" }, children: "AI创作 · 一键生成" }, void 0, false, {
                fileName: "D:/AI网站/shubao/shubao-final.jsx",
                lineNumber: 251,
                columnNumber: 308
              }, this)
            ] }, void 0, true, {
              fileName: "D:/AI网站/shubao/shubao-final.jsx",
              lineNumber: 251,
              columnNumber: 231
            }, this),
            /* @__PURE__ */ jsxDEV("span", { style: { marginLeft: "auto", fontSize: 11, color: "#888", background: "#f5f5f5", padding: "3px 10px", borderRadius: 20 }, children: result.category || "" }, void 0, false, {
              fileName: "D:/AI网站/shubao/shubao-final.jsx",
              lineNumber: 251,
              columnNumber: 376
            }, this)
          ] }, void 0, true, {
            fileName: "D:/AI网站/shubao/shubao-final.jsx",
            lineNumber: 251,
            columnNumber: 26
          }, this),
          /* @__PURE__ */ jsxDEV("div", { style: { ...s.cardP, marginBottom: 12 }, children: /* @__PURE__ */ jsxDEV("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }, children: [
            /* @__PURE__ */ jsxDEV("h2", { style: { fontSize: 18, fontWeight: 700, color: "#222", margin: 0, lineHeight: 1.5 }, children: result.title }, void 0, false, {
              fileName: "D:/AI网站/shubao/shubao-final.jsx",
              lineNumber: 254,
              columnNumber: 15
            }, this),
            /* @__PURE__ */ jsxDEV("span", { style: { display: "none" } }, void 0, false, {
              fileName: "D:/AI网站/shubao/shubao-final.jsx",
              lineNumber: 255,
              columnNumber: 15
            }, this)
          ] }, void 0, true, {
            fileName: "D:/AI网站/shubao/shubao-final.jsx",
            lineNumber: 253,
            columnNumber: 13
          }, this) }, void 0, false, {
            fileName: "D:/AI网站/shubao/shubao-final.jsx",
            lineNumber: 252,
            columnNumber: 11
          }, this),
          curPage.page_type === "cover" ? /* @__PURE__ */ jsxDEV("div", { style: { ...s.cardP, marginBottom: 12 }, children: [
            /* @__PURE__ */ jsxDEV("div", { style: { display: "none" }, children: "📌 封面" }, void 0, false, {
              fileName: "D:/AI网站/shubao/shubao-final.jsx",
              lineNumber: 261,
              columnNumber: 13
            }, this),
            /* @__PURE__ */ jsxDEV("div", { style: { fontSize: 15, fontWeight: 700, color: "#333", marginBottom: 4 }, children: curPage.hook || curPage.title }, void 0, false, {
              fileName: "D:/AI网站/shubao/shubao-final.jsx",
              lineNumber: 262,
              columnNumber: 13
            }, this),
            curPage.text && /* @__PURE__ */ jsxDEV("div", { style: { fontSize: 13, color: "#666", lineHeight: 1.7, whiteSpace: "pre-wrap" }, children: curPage.text }, void 0, false, {
              fileName: "D:/AI网站/shubao/shubao-final.jsx",
              lineNumber: 263,
              columnNumber: 30
            }, this),
            /* @__PURE__ */ jsxDEV("div", { style: { marginTop: 8, fontSize: 12, color: "#999", lineHeight: 1.6 }, children: [
              /* @__PURE__ */ jsxDEV("strong", { children: "排版提示：" }, void 0, false, {
                fileName: "D:/AI网站/shubao/shubao-final.jsx",
                lineNumber: 264,
                columnNumber: 89
              }, this),
              curPage.layout_hint || curPage.story || "—"
            ] }, void 0, true, {
              fileName: "D:/AI网站/shubao/shubao-final.jsx",
              lineNumber: 264,
              columnNumber: 13
            }, this)
          ] }, void 0, true, {
            fileName: "D:/AI网站/shubao/shubao-final.jsx",
            lineNumber: 260,
            columnNumber: 44
          }, this) : /* @__PURE__ */ jsxDEV("div", { style: { ...s.cardP, marginBottom: 12 }, children: [
            /* @__PURE__ */ jsxDEV("div", { style: { display: "none" }, children: [
              "📄 P",
              curPage.page_id || imgIdx + 1,
              " ",
              curPage.emoji || ""
            ] }, void 0, true, {
              fileName: "D:/AI网站/shubao/shubao-final.jsx",
              lineNumber: 266,
              columnNumber: 13
            }, this),
            /* @__PURE__ */ jsxDEV("div", { style: { fontSize: 16, fontWeight: 700, color: "#333", marginBottom: 6 }, children: curPage.title }, void 0, false, {
              fileName: "D:/AI网站/shubao/shubao-final.jsx",
              lineNumber: 267,
              columnNumber: 13
            }, this),
            curPage.hook && /* @__PURE__ */ jsxDEV("div", { style: { fontSize: 13, color: R, background: "#FFF1F3", padding: "6px 12px", borderRadius: 8, marginBottom: 8, display: "inline-block", fontWeight: 500 }, children: curPage.hook }, void 0, false, {
              fileName: "D:/AI网站/shubao/shubao-final.jsx",
              lineNumber: 268,
              columnNumber: 30
            }, this),
            /* @__PURE__ */ jsxDEV("div", { style: { fontSize: 13, color: "#555", lineHeight: 1.8, whiteSpace: "pre-wrap" }, children: curPage.text || curPage.story || "" }, void 0, false, {
              fileName: "D:/AI网站/shubao/shubao-final.jsx",
              lineNumber: 269,
              columnNumber: 13
            }, this),
            curPage.info_blocks?.length > 0 && /* @__PURE__ */ jsxDEV("div", { style: { display: "none" } }, void 0, false, {
              fileName: "D:/AI网站/shubao/shubao-final.jsx",
              lineNumber: 270,
              columnNumber: 49
            }, this)
          ] }, void 0, true, {
            fileName: "D:/AI网站/shubao/shubao-final.jsx",
            lineNumber: 265,
            columnNumber: 20
          }, this),
          /* @__PURE__ */ jsxDEV("div", { style: { ...s.cardP, marginBottom: 12 }, children: [
            /* @__PURE__ */ jsxDEV("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }, children: [
              /* @__PURE__ */ jsxDEV("span", { style: { fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 5 }, children: [
                /* @__PURE__ */ jsxDEV(Hash, { size: 14, color: R }, void 0, false, {
                  fileName: "D:/AI网站/shubao/shubao-final.jsx",
                  lineNumber: 276,
                  columnNumber: 110
                }, this),
                "标签"
              ] }, void 0, true, {
                fileName: "D:/AI网站/shubao/shubao-final.jsx",
                lineNumber: 276,
                columnNumber: 15
              }, this),
              /* @__PURE__ */ jsxDEV("span", { style: { display: "none" } }, void 0, false, {
                fileName: "D:/AI网站/shubao/shubao-final.jsx",
                lineNumber: 277,
                columnNumber: 15
              }, this)
            ] }, void 0, true, {
              fileName: "D:/AI网站/shubao/shubao-final.jsx",
              lineNumber: 275,
              columnNumber: 13
            }, this),
            /* @__PURE__ */ jsxDEV("div", { style: { display: "flex", flexWrap: "wrap", gap: 5 }, children: (result.hashtags || []).map((h, i) => /* @__PURE__ */ jsxDEV("span", { style: { fontSize: 12, color: R, background: "#FFF1F3", padding: "4px 12px", borderRadius: 20, fontWeight: 500 }, children: h }, i, false, {
              fileName: "D:/AI网站/shubao/shubao-final.jsx",
              lineNumber: 279,
              columnNumber: 111
            }, this)) }, void 0, false, {
              fileName: "D:/AI网站/shubao/shubao-final.jsx",
              lineNumber: 279,
              columnNumber: 13
            }, this)
          ] }, void 0, true, {
            fileName: "D:/AI网站/shubao/shubao-final.jsx",
            lineNumber: 274,
            columnNumber: 11
          }, this),
          result.body_text && /* @__PURE__ */ jsxDEV("div", { style: { ...s.cardP, marginBottom: 12 }, children: /* @__PURE__ */ jsxDEV("details", { style: { fontSize: 14, color: "#555", lineHeight: 2 }, children: [
            /* @__PURE__ */ jsxDEV("summary", { style: { fontSize: 13, fontWeight: 600, cursor: "pointer", color: "#888", marginBottom: 4 }, children: "📝 查看完整正文" }, void 0, false, {
              fileName: "D:/AI网站/shubao/shubao-final.jsx",
              lineNumber: 285,
              columnNumber: 15
            }, this),
            /* @__PURE__ */ jsxDEV("div", { style: { whiteSpace: "pre-wrap", marginTop: 8, fontSize: 13, lineHeight: 2, color: "#555" }, children: result.body_text }, void 0, false, {
              fileName: "D:/AI网站/shubao/shubao-final.jsx",
              lineNumber: 286,
              columnNumber: 15
            }, this)
          ] }, void 0, true, {
            fileName: "D:/AI网站/shubao/shubao-final.jsx",
            lineNumber: 284,
            columnNumber: 13
          }, this) }, void 0, false, {
            fileName: "D:/AI网站/shubao/shubao-final.jsx",
            lineNumber: 283,
            columnNumber: 32
          }, this),
          /* @__PURE__ */ jsxDEV("div", { style: { display: "flex", gap: 8, flexWrap: "wrap" }, children: [
            /* @__PURE__ */ jsxDEV(Btn, { small: true, onClick: textRegen, sx: { background: "#fff", color: R, border: "1.5px solid " + R, fontSize: 12 }, children: [
              /* @__PURE__ */ jsxDEV(RefreshCw, { size: 12 }, void 0, false, {
                fileName: "D:/AI网站/shubao/shubao-final.jsx",
                lineNumber: 292,
                columnNumber: 124
              }, this),
              " 重新生成文案"
            ] }, void 0, true, {
              fileName: "D:/AI网站/shubao/shubao-final.jsx",
              lineNumber: 292,
              columnNumber: 13
            }, this),
            /* @__PURE__ */ jsxDEV(Btn, { small: true, onClick: () => {
              navigator.clipboard?.writeText(result.title + "\n\n" + result.body_text + "\n\n" + (result.hashtags || []).join(" ")).catch(() => {
              });
            }, sx: { background: R, color: "#fff", border: "none", fontSize: 12 }, children: /* @__PURE__ */ jsxDEV("span", { style: { display: "none" } }, void 0, false, {
              fileName: "D:/AI网站/shubao/shubao-final.jsx",
              lineNumber: 293,
              columnNumber: 245
            }, this) }, void 0, false, {
              fileName: "D:/AI网站/shubao/shubao-final.jsx",
              lineNumber: 293,
              columnNumber: 13
            }, this),
            /* @__PURE__ */ jsxDEV(Btn, { small: true, onClick: () => {
              setGen("idle");
              setResult(null);
            }, sx: { display: "none" } }, void 0, false, {
              fileName: "D:/AI网站/shubao/shubao-final.jsx",
              lineNumber: 294,
              columnNumber: 13
            }, this)
          ] }, void 0, true, {
            fileName: "D:/AI网站/shubao/shubao-final.jsx",
            lineNumber: 291,
            columnNumber: 11
          }, this)
        ] }, void 0, true, {
          fileName: "D:/AI网站/shubao/shubao-final.jsx",
          lineNumber: 250,
          columnNumber: 9
        }, this)
      ] }, void 0, true, {
        fileName: "D:/AI网站/shubao/shubao-final.jsx",
        lineNumber: 198,
        columnNumber: 7
      }, this),
      /* @__PURE__ */ jsxDEV("div", { style: { display: "none" }, children: pages.map(
        (pg, i) => /* @__PURE__ */ jsxDEV("div", { onClick: () => setImgIdx(i), style: { padding: "8px 4px", borderRadius: 10, border: imgIdx === i ? "2px solid " + R : "1.5px solid #f0f0f0", cursor: "pointer", background: imgIdx === i ? "#FFF8F9" : "#FAFAFA", textAlign: "center", transition: "all .15s" }, children: [
          /* @__PURE__ */ jsxDEV("div", { style: { fontSize: 16, marginBottom: 2 }, children: pg.emoji || "📄" }, void 0, false, {
            fileName: "D:/AI网站/shubao/shubao-final.jsx",
            lineNumber: 303,
            columnNumber: 13
          }, this),
          /* @__PURE__ */ jsxDEV("div", { style: { fontSize: 9, fontWeight: 600, color: imgIdx === i ? R : "#777", lineHeight: 1.2 }, children: pg.title?.slice(0, 6) || "P" + (i + 1) }, void 0, false, {
            fileName: "D:/AI网站/shubao/shubao-final.jsx",
            lineNumber: 304,
            columnNumber: 13
          }, this)
        ] }, i, true, {
          fileName: "D:/AI网站/shubao/shubao-final.jsx",
          lineNumber: 302,
          columnNumber: 9
        }, this)
      ) }, void 0, false, {
        fileName: "D:/AI网站/shubao/shubao-final.jsx",
        lineNumber: 300,
        columnNumber: 7
      }, this)
    ] }, void 0, true, {
      fileName: "D:/AI网站/shubao/shubao-final.jsx",
      lineNumber: 197,
      columnNumber: 5
    }, this),
    loginModal,
    priceModal
  ] }, void 0, true, {
    fileName: "D:/AI网站/shubao/shubao-final.jsx",
    lineNumber: 168,
    columnNumber: 10
  }, this);
}
_s4(ResultDisplay, "HN8nS6S97r1pFaFF2q0PCuBaLws=");
_c6 = ResultDisplay;
function css() {
  return /* @__PURE__ */ jsxDEV("style", { children: `@keyframes fadeIn{from{opacity:0}to{opacity:1}}@keyframes slideUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}@keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}@keyframes scroll-h{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}@keyframes spin{0%{transform:rotate(0)}100%{transform:rotate(360deg)}}.spin{animation:spin 1s linear infinite}*::-webkit-scrollbar{width:4px}*::-webkit-scrollbar-thumb{background:#e8e8e8;border-radius:2px}::selection{background:#FFE0E4}` }, void 0, false, {
    fileName: "D:/AI网站/shubao/shubao-final.jsx",
    lineNumber: 312,
    columnNumber: 24
  }, this);
}
function GCard({ item, onClick }) {
  _s5();
  const [h, setH] = useState(false);
  return /* @__PURE__ */ jsxDEV(Card, { hover: true, onClick, sx: { overflow: "hidden" }, children: [
    /* @__PURE__ */ jsxDEV("div", { style: { background: item.grad, height: 140, position: "relative" }, onMouseEnter: () => setH(true), onMouseLeave: () => setH(false), children: [
      /* @__PURE__ */ jsxDEV("div", { style: { position: "absolute", inset: 0, background: "linear-gradient(transparent 40%,rgba(0,0,0,0.5))" } }, void 0, false, {
        fileName: "D:/AI网站/shubao/shubao-final.jsx",
        lineNumber: 317,
        columnNumber: 5
      }, this),
      /* @__PURE__ */ jsxDEV("span", { style: { position: "absolute", top: 10, left: 10, fontSize: 10, background: "rgba(255,255,255,0.2)", color: "#fff", padding: "3px 10px", borderRadius: 8, backdropFilter: "blur(4px)" }, children: item.cat }, void 0, false, {
        fileName: "D:/AI网站/shubao/shubao-final.jsx",
        lineNumber: 318,
        columnNumber: 5
      }, this),
      h && /* @__PURE__ */ jsxDEV("div", { style: { position: "absolute", inset: 0, background: "rgba(0,0,0,0.25)", display: "flex", alignItems: "center", justifyContent: "center", animation: "fadeIn 0.15s" }, children: /* @__PURE__ */ jsxDEV("span", { style: { background: "rgba(255,255,255,0.95)", color: R, fontSize: 12, fontWeight: 600, padding: "8px 18px", borderRadius: 10, display: "flex", alignItems: "center", gap: 5, boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }, children: [
        /* @__PURE__ */ jsxDEV(Eye, { size: 13 }, void 0, false, {
          fileName: "D:/AI网站/shubao/shubao-final.jsx",
          lineNumber: 319,
          columnNumber: 406
        }, this),
        "查看全套内容"
      ] }, void 0, true, {
        fileName: "D:/AI网站/shubao/shubao-final.jsx",
        lineNumber: 319,
        columnNumber: 183
      }, this) }, void 0, false, {
        fileName: "D:/AI网站/shubao/shubao-final.jsx",
        lineNumber: 319,
        columnNumber: 11
      }, this)
    ] }, void 0, true, {
      fileName: "D:/AI网站/shubao/shubao-final.jsx",
      lineNumber: 316,
      columnNumber: 3
    }, this),
    /* @__PURE__ */ jsxDEV("div", { style: { padding: "12px 14px" }, children: [
      /* @__PURE__ */ jsxDEV("div", { style: { fontSize: 13, fontWeight: 600, lineHeight: 1.5, marginBottom: 6, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", fontFamily: "'PingFang SC','Microsoft YaHei','Noto Sans SC',sans-serif" }, children: item.title }, void 0, false, {
        fileName: "D:/AI网站/shubao/shubao-final.jsx",
        lineNumber: 322,
        columnNumber: 5
      }, this),
      /* @__PURE__ */ jsxDEV("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center" }, children: [
        /* @__PURE__ */ jsxDEV("span", { style: { fontSize: 10, color: "#ccc", display: "flex", alignItems: "center", gap: 3 }, children: [
          /* @__PURE__ */ jsxDEV(Heart, { size: 10 }, void 0, false, {
            fileName: "D:/AI网站/shubao/shubao-final.jsx",
            lineNumber: 323,
            columnNumber: 186
          }, this),
          item.likes
        ] }, void 0, true, {
          fileName: "D:/AI网站/shubao/shubao-final.jsx",
          lineNumber: 323,
          columnNumber: 93
        }, this),
        /* @__PURE__ */ jsxDEV("span", { style: { fontSize: 9, color: "#e0e0e0", fontStyle: "italic" }, children: "薯包AI出品" }, void 0, false, {
          fileName: "D:/AI网站/shubao/shubao-final.jsx",
          lineNumber: 323,
          columnNumber: 224
        }, this)
      ] }, void 0, true, {
        fileName: "D:/AI网站/shubao/shubao-final.jsx",
        lineNumber: 323,
        columnNumber: 5
      }, this)
    ] }, void 0, true, {
      fileName: "D:/AI网站/shubao/shubao-final.jsx",
      lineNumber: 321,
      columnNumber: 3
    }, this)
  ] }, void 0, true, {
    fileName: "D:/AI网站/shubao/shubao-final.jsx",
    lineNumber: 315,
    columnNumber: 83
  }, this);
}
_s5(GCard, "8q/03bBkK6j37jGZcAIxBqNwQHQ=");
_c7 = GCard;
export default function App() {
  _s6();
  const [pg, setPg] = useState("home");
  const [logged, setLogged] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [showPrice, setShowPrice] = useState(false);
  const [text, setText] = useState("");
  const [gen, setGen] = useState("idle");
  const [stage, setStage] = useState(0);
  const [result, setResult] = useState(null);
  const [works, setWorks] = useState([]);
  const [pts, setPtsS] = useState(1);
  const [regenState, setRegenState] = useState({ active: false, msg: "" });
  const lastWorkIdRef = useRef("");
  useEffect(function() {
    if (result?._inputText) lastWorkIdRef.current = result._inputText;
  }, [result?._inputText]);
  useEffect(function() {
    var el = document.getElementById("__regen_bar");
    if (!el) {
      el = document.createElement("div");
      el.id = "__regen_bar";
      document.body.appendChild(el);
    }
    if (regenState.active) {
      el.style.cssText = "position:fixed;bottom:24px;left:50%;transform:translateX(-50%);z-index:99999;background:#1a1a2e;color:#fff;padding:12px 24px;border-radius:14px;font-size:13px;font-weight:500;display:flex;align-items:center;gap:10px;box-shadow:0 8px 32px rgba(0,0,0,0.25);animation:fadeIn .2s";
      el.innerHTML = '<span style="width:16px;height:16px;border:2.5px solid rgba(255,255,255,0.25);border-top-color:#fff;border-radius:50%;animation:spin .6s linear infinite;display:inline-block;flex-shrink:0"></span>' + regenState.msg + '<span style="font-size:11;color:rgba(255,255,255,0.5);margin-left:4px">生成完成后自动更新</span>';
      el.style.display = "flex";
    } else {
      el.style.display = "none";
    }
  }, [regenState.active, regenState.msg]);
  const [tipIdx, setTipIdx] = useState(0);
  const [aPg, setAPg] = useState(null);
  const [gItem, setGItem] = useState(null);
  const [err, setErr] = useState("");
  const [carouselIdx, setCarouselIdx] = useState(0);
  const freeUsed = useRef(false);
  const tm = useRef([]);
  useEffect(() => {
    loadWorks().then(setWorks);
    getPts().then(setPtsS);
  }, []);
  useEffect(() => {
    if (gen === "loading") {
      const t = setInterval(() => setTipIdx((i) => (i + 1) % TIPS.length), 4e3);
      return () => clearInterval(t);
    }
  }, [gen]);
  useEffect(() => {
    if (gen !== "loading") {
      const t = setInterval(() => setCarouselIdx((i) => (i + 1) % QUICK_HINTS.length), 3e3);
      return () => clearInterval(t);
    }
  }, [gen]);
  const doGen = async () => {
    if (!text.trim()) return;
    if (!logged && freeUsed.current) {
      setShowLogin(true);
      return;
    }
    if (pts <= 0 && logged) {
      setShowPrice(true);
      return;
    }
    setGen("loading");
    setErr("");
    setStage(0);
    setResult(null);
    tm.current.forEach(clearTimeout);
    tm.current = [setTimeout(() => setStage(1), 3e3), setTimeout(() => setStage(2), 8e3), setTimeout(() => setStage(3), 14e3)];
    try {
      const r = await genAPI(
        text,
        // onImg: 每生成一张图就显示到弹窗，不等全部完成
        function(d) {
          setResult(function(prev) {
            if (prev?.title) return prev;
            if (!prev) {
              var init = { _inputText: text, cover_url: d.id === "cover" ? d.url : "", image_urls: d.id !== "cover" && d.url ? [d.url] : [] };
              return init;
            }
            if (d.id === "cover") return { ...prev, cover_url: d.url };
            if (d.url) return { ...prev, image_urls: [...prev.image_urls || [], d.url] };
            return prev;
          });
        }
      );
      tm.current.forEach(clearTimeout);
      setStage(4);
      try {
        const np = pts - 1;
        setPtsS(np);
        await setPts(np);
        var wd = { title: r.title, category: r.category, body_text: r.body_text, hashtags: r.hashtags, pages: r.pages, _inputText: text, cover_url: r.cover_url || "", image_urls: r.image_urls || [], cover_prompt: r.cover_prompt || "", image_prompts: r.image_prompts || [], _saveKey: Date.now() };
        await saveWork(wd);
        setWorks(function(prev) {
          return [{ ...wd, id: Date.now(), at: (/* @__PURE__ */ new Date()).toLocaleDateString("zh-CN") }, ...prev.filter(function(x) {
            return x._inputText !== text || x._saveKey === wd._saveKey;
          })];
        });
      } catch (e) {
        console.warn("saveWork error:", e);
      }
      setResult(function() {
        return { ...r, _inputText: text };
      });
      setGen("result");
    } catch (e) {
      tm.current.forEach(clearTimeout);
      setErr(e.message);
      setGen("idle");
    }
  };
  const textRegen = async () => {
    var inp = result?._inputText || text;
    if (!inp) {
      alert("无法找到原始输入");
      return;
    }
    if (!confirm("重新生成文案将消耗额度，确定？")) return;
    var ov = document.createElement("div");
    ov.style.cssText = "position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.55);display:flex;flex-direction:column;align-items:center;justify-content:center;backdrop-filter:blur(6px);animation:fadeIn .15s";
    ov.innerHTML = '<div style="background:#fff;border-radius:20px;padding:32px 40px;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,0.3);animation:slideUp .25s"><svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="#FF4757" stroke-width="2.5" stroke-linecap="round" class="spin"><path d="M12 2v4"/><path d="M12 18v4"/><path d="M4.93 4.93l2.83 2.83"/><path d="M16.24 16.24l2.83 2.83"/><path d="M2 12h4"/><path d="M18 12h4"/><path d="M4.93 19.07l2.83-2.83"/><path d="M16.24 7.76l2.83-2.83"/></svg><div style="font-size:17px;font-weight:700;margin-top:16px;color:#333">✍️ 正在重新生成文章</div><div style="font-size:13px;color:#999;margin-top:6px">请勿刷新或关闭页面，否则会消耗额度</div></div>';
    document.body.appendChild(ov);
    try {
      var r = await fetch(API + "/api/regenerate-text", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: inp }) });
      if (!r.ok) throw Error("E");
      var d2 = await r.json();
      setResult((p) => ({ ...p, title: d2.title, body_text: d2.body_text, hashtags: d2.hashtags, category: d2.category, _inputText }));
    } catch (e) {
      alert("重新生成失败");
    }
    ov.remove();
  };
  const nav = /* @__PURE__ */ jsxDEV("nav", { style: { display: "flex", alignItems: "center", justifyContent: "center", padding: "10px 28px", background: "rgba(255,255,255,0.92)", borderBottom: "1px solid #f0f0f0", position: "sticky", top: 0, zIndex: 100, backdropFilter: "blur(14px)" }, children: /* @__PURE__ */ jsxDEV("div", { style: { maxWidth: 1100, width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between" }, children: [
    /* @__PURE__ */ jsxDEV("div", { style: { display: "flex", alignItems: "center", gap: 20 }, children: [
      /* @__PURE__ */ jsxDEV("div", { style: { display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }, onClick: () => {
        setPg("home");
        setGen("idle");
        setResult(null);
        setGItem(null);
      }, children: [
        /* @__PURE__ */ jsxDEV("img", { src: I.appicon, alt: "薯包AI", style: { width: 30, height: 30, borderRadius: 8 } }, void 0, false, {
          fileName: "D:/AI网站/shubao/shubao-final.jsx",
          lineNumber: 413,
          columnNumber: 9
        }, this),
        /* @__PURE__ */ jsxDEV("span", { style: { fontSize: 16, fontWeight: 700, color: R, fontFamily: "PingFang SC,Microsoft YaHei,sans-serif", letterSpacing: "0.5px" }, children: "薯包AI" }, void 0, false, {
          fileName: "D:/AI网站/shubao/shubao-final.jsx",
          lineNumber: 414,
          columnNumber: 9
        }, this)
      ] }, void 0, true, {
        fileName: "D:/AI网站/shubao/shubao-final.jsx",
        lineNumber: 412,
        columnNumber: 7
      }, this),
      /* @__PURE__ */ jsxDEV("div", { style: { display: "flex", gap: 4 }, children: [["home", "首页"], ["gallery", "薯包出品"], ["pricing", "价格方案"], ["works", "我的作品"]].map(([k, v]) => /* @__PURE__ */ jsxDEV("button", { onClick: () => {
        setPg(k);
        if (k === "works") loadWorks().then(setWorks);
      }, style: { fontSize: 13, fontFamily: "'PingFang SC','Microsoft YaHei','Noto Sans SC',sans-serif", color: pg === k ? R : "#777", fontWeight: pg === k ? 600 : 400, background: "none", border: "none", padding: "6px 12px", cursor: "pointer", borderRadius: 8, transition: "all 0.15s" }, children: v }, k, false, {
        fileName: "D:/AI网站/shubao/shubao-final.jsx",
        lineNumber: 416,
        columnNumber: 143
      }, this)) }, void 0, false, {
        fileName: "D:/AI网站/shubao/shubao-final.jsx",
        lineNumber: 416,
        columnNumber: 7
      }, this)
    ] }, void 0, true, {
      fileName: "D:/AI网站/shubao/shubao-final.jsx",
      lineNumber: 411,
      columnNumber: 5
    }, this),
    /* @__PURE__ */ jsxDEV("div", { style: { display: "flex", alignItems: "center", gap: 8 }, children: [
      logged && /* @__PURE__ */ jsxDEV("span", { style: { fontSize: 11, color: R, background: "#FFF1F3", padding: "4px 12px", borderRadius: 20, fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }, children: [
        /* @__PURE__ */ jsxDEV(Sparkles, { size: 11 }, void 0, false, {
          fileName: "D:/AI网站/shubao/shubao-final.jsx",
          lineNumber: 418,
          columnNumber: 246
        }, this),
        pts,
        "套"
      ] }, void 0, true, {
        fileName: "D:/AI网站/shubao/shubao-final.jsx",
        lineNumber: 418,
        columnNumber: 79
      }, this),
      /* @__PURE__ */ jsxDEV(Btn, { small: true, onClick: () => logged ? setLogged(false) : setShowLogin(true), sx: { background: logged ? "#F0FFF4" : "#f5f5f5", color: logged ? G : "#777", border: "none" }, children: logged ? /* @__PURE__ */ jsxDEV(Fragment, { children: [
        /* @__PURE__ */ jsxDEV(Check, { size: 12 }, void 0, false, {
          fileName: "D:/AI网站/shubao/shubao-final.jsx",
          lineNumber: 418,
          columnNumber: 464
        }, this),
        "已登录"
      ] }, void 0, true, {
        fileName: "D:/AI网站/shubao/shubao-final.jsx",
        lineNumber: 418,
        columnNumber: 462
      }, this) : /* @__PURE__ */ jsxDEV(Fragment, { children: [
        /* @__PURE__ */ jsxDEV(LogIn, { size: 12 }, void 0, false, {
          fileName: "D:/AI网站/shubao/shubao-final.jsx",
          lineNumber: 418,
          columnNumber: 494
        }, this),
        "登录"
      ] }, void 0, true, {
        fileName: "D:/AI网站/shubao/shubao-final.jsx",
        lineNumber: 418,
        columnNumber: 492
      }, this) }, void 0, false, {
        fileName: "D:/AI网站/shubao/shubao-final.jsx",
        lineNumber: 418,
        columnNumber: 282
      }, this)
    ] }, void 0, true, {
      fileName: "D:/AI网站/shubao/shubao-final.jsx",
      lineNumber: 418,
      columnNumber: 5
    }, this)
  ] }, void 0, true, {
    fileName: "D:/AI网站/shubao/shubao-final.jsx",
    lineNumber: 410,
    columnNumber: 5
  }, this) }, void 0, false, {
    fileName: "D:/AI网站/shubao/shubao-final.jsx",
    lineNumber: 409,
    columnNumber: 15
  }, this);
  const loginModal = showLogin && /* @__PURE__ */ jsxDEV(Modal, { onClose: () => setShowLogin(false), children: [
    /* @__PURE__ */ jsxDEV("div", { style: { textAlign: "center", marginBottom: 24 }, children: [
      /* @__PURE__ */ jsxDEV(CharImg, { src: I.wave, alt: "", style: { height: 64 } }, void 0, false, {
        fileName: "D:/AI网站/shubao/shubao-final.jsx",
        lineNumber: 422,
        columnNumber: 133
      }, this),
      /* @__PURE__ */ jsxDEV("div", { style: { fontSize: 20, fontWeight: 700, marginTop: 8 }, children: "欢迎来到薯包AI" }, void 0, false, {
        fileName: "D:/AI网站/shubao/shubao-final.jsx",
        lineNumber: 422,
        columnNumber: 187
      }, this),
      /* @__PURE__ */ jsxDEV("div", { style: { fontSize: 13, color: "#999" }, children: "小红书爆款图文，一键生成" }, void 0, false, {
        fileName: "D:/AI网站/shubao/shubao-final.jsx",
        lineNumber: 422,
        columnNumber: 262
      }, this)
    ] }, void 0, true, {
      fileName: "D:/AI网站/shubao/shubao-final.jsx",
      lineNumber: 422,
      columnNumber: 78
    }, this),
    /* @__PURE__ */ jsxDEV("input", { placeholder: "手机号", style: { width: "100%", padding: "12px 16px", border: "1.5px solid #eee", borderRadius: 12, fontSize: 14, marginBottom: 10, boxSizing: "border-box", outline: "none" } }, void 0, false, {
      fileName: "D:/AI网站/shubao/shubao-final.jsx",
      lineNumber: 423,
      columnNumber: 5
    }, this),
    /* @__PURE__ */ jsxDEV("input", { placeholder: "验证码", style: { width: "100%", padding: "12px 16px", border: "1.5px solid #eee", borderRadius: 12, fontSize: 14, marginBottom: 20, boxSizing: "border-box", outline: "none" } }, void 0, false, {
      fileName: "D:/AI网站/shubao/shubao-final.jsx",
      lineNumber: 423,
      columnNumber: 200
    }, this),
    /* @__PURE__ */ jsxDEV(Btn, { primary: true, full: true, onClick: () => {
      setLogged(true);
      setShowLogin(false);
    }, children: [
      /* @__PURE__ */ jsxDEV(LogIn, { size: 15 }, void 0, false, {
        fileName: "D:/AI网站/shubao/shubao-final.jsx",
        lineNumber: 423,
        columnNumber: 468
      }, this),
      "登录 / 注册"
    ] }, void 0, true, {
      fileName: "D:/AI网站/shubao/shubao-final.jsx",
      lineNumber: 423,
      columnNumber: 395
    }, this),
    /* @__PURE__ */ jsxDEV("div", { style: { textAlign: "center", marginTop: 10, fontSize: 10, color: "#ddd" }, children: "登录后可把作品保存到个人作品集" }, void 0, false, {
      fileName: "D:/AI网站/shubao/shubao-final.jsx",
      lineNumber: 423,
      columnNumber: 500
    }, this)
  ] }, void 0, true, {
    fileName: "D:/AI网站/shubao/shubao-final.jsx",
    lineNumber: 422,
    columnNumber: 35
  }, this);
  const priceModal = showPrice && /* @__PURE__ */ jsxDEV(Modal, { onClose: () => setShowPrice(false), children: [
    /* @__PURE__ */ jsxDEV("div", { style: { textAlign: "center", marginBottom: 20 }, children: [
      /* @__PURE__ */ jsxDEV(CharImg, { src: I.upgrade, alt: "", style: { height: 80 }, filter: "drop-shadow(0 6px 16px rgba(255,71,87,0.15))" }, void 0, false, {
        fileName: "D:/AI网站/shubao/shubao-final.jsx",
        lineNumber: 424,
        columnNumber: 133
      }, this),
      /* @__PURE__ */ jsxDEV("div", { style: { fontSize: 20, fontWeight: 700, marginTop: 8 }, children: "选择套餐充值" }, void 0, false, {
        fileName: "D:/AI网站/shubao/shubao-final.jsx",
        lineNumber: 424,
        columnNumber: 244
      }, this),
      /* @__PURE__ */ jsxDEV("div", { style: { fontSize: 12, color: "#999" }, children: "按套收费，不自动续费，用多少买多少" }, void 0, false, {
        fileName: "D:/AI网站/shubao/shubao-final.jsx",
        lineNumber: 424,
        columnNumber: 317
      }, this)
    ] }, void 0, true, {
      fileName: "D:/AI网站/shubao/shubao-final.jsx",
      lineNumber: 424,
      columnNumber: 78
    }, this),
    /* @__PURE__ */ jsxDEV("div", { style: { display: "flex", flexDirection: "column", gap: 8 }, children: PRICING.map((p, i) => /* @__PURE__ */ jsxDEV("div", { onClick: () => {
      setPtsS(pts + p.sets);
      setPts(pts + p.sets);
      setShowPrice(false);
    }, style: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", borderRadius: 14, border: p.pop ? "2px solid " + R : "1px solid #f0f0f0", cursor: "pointer", background: p.pop ? "#FFF8F9" : "#fff", transition: "all 0.2s" }, children: [
      /* @__PURE__ */ jsxDEV("div", { children: [
        /* @__PURE__ */ jsxDEV("div", { style: { fontSize: 14, fontWeight: 700 }, children: [
          p.name,
          p.pop && /* @__PURE__ */ jsxDEV("span", { style: { fontSize: 10, color: "#fff", background: R, padding: "2px 8px", borderRadius: 6, marginLeft: 8 }, children: "推荐" }, void 0, false, {
            fileName: "D:/AI网站/shubao/shubao-final.jsx",
            lineNumber: 425,
            columnNumber: 521
          }, this)
        ] }, void 0, true, {
          fileName: "D:/AI网站/shubao/shubao-final.jsx",
          lineNumber: 425,
          columnNumber: 456
        }, this),
        /* @__PURE__ */ jsxDEV("div", { style: { fontSize: 11, color: "#999" }, children: [
          p.sets,
          "套 · 单张重生成",
          p.regen,
          "次/套 · ¥",
          p.per,
          "/套"
        ] }, void 0, true, {
          fileName: "D:/AI网站/shubao/shubao-final.jsx",
          lineNumber: 425,
          columnNumber: 650
        }, this)
      ] }, void 0, true, {
        fileName: "D:/AI网站/shubao/shubao-final.jsx",
        lineNumber: 425,
        columnNumber: 451
      }, this),
      /* @__PURE__ */ jsxDEV("div", { style: { fontSize: 22, fontWeight: 800, color: R }, children: [
        "¥",
        p.price
      ] }, void 0, true, {
        fileName: "D:/AI网站/shubao/shubao-final.jsx",
        lineNumber: 425,
        columnNumber: 749
      }, this)
    ] }, i, true, {
      fileName: "D:/AI网站/shubao/shubao-final.jsx",
      lineNumber: 425,
      columnNumber: 94
    }, this)) }, void 0, false, {
      fileName: "D:/AI网站/shubao/shubao-final.jsx",
      lineNumber: 425,
      columnNumber: 5
    }, this)
  ] }, void 0, true, {
    fileName: "D:/AI网站/shubao/shubao-final.jsx",
    lineNumber: 424,
    columnNumber: 35
  }, this);
  if (gen === "loading") {
    const st = STAGES[stage] || STAGES[0];
    const charKey = CHAR_CYCLE[tipIdx % CHAR_CYCLE.length];
    return /* @__PURE__ */ jsxDEV("div", { style: { minHeight: "100vh", background: BG }, children: [
      nav,
      /* @__PURE__ */ jsxDEV("div", { style: { maxWidth: 440, margin: "0 auto", padding: "50px 20px", textAlign: "center", animation: "fadeIn 0.3s" }, children: [
        /* @__PURE__ */ jsxDEV(CharImg, { src: I[charKey], alt: st.label, style: { height: 170, animation: "float 2s ease-in-out infinite" }, filter: "drop-shadow(0 8px 24px rgba(255,71,87,0.12))", margin: "0 0 20px" }, void 0, false, {
          fileName: "D:/AI网站/shubao/shubao-final.jsx",
          lineNumber: 431,
          columnNumber: 9
        }, this),
        /* @__PURE__ */ jsxDEV("div", { style: { fontSize: 22, fontWeight: 700, marginBottom: 6 }, children: st.label }, void 0, false, {
          fileName: "D:/AI网站/shubao/shubao-final.jsx",
          lineNumber: 432,
          columnNumber: 9
        }, this),
        /* @__PURE__ */ jsxDEV("div", { style: { fontSize: 14, color: "#888", marginBottom: 28 }, children: st.desc.replace("{n}", String(Math.min(stage * 3 + 1, 9))) }, void 0, false, {
          fileName: "D:/AI网站/shubao/shubao-final.jsx",
          lineNumber: 433,
          columnNumber: 9
        }, this),
        /* @__PURE__ */ jsxDEV("div", { style: { display: "flex", gap: 3, marginBottom: 24, padding: "0 30px" }, children: STAGES.map((_, i) => /* @__PURE__ */ jsxDEV("div", { style: { flex: 1, height: 5, borderRadius: 3, background: i <= stage ? R : "#f0f0f0", transition: "background 0.5s" } }, i, false, {
          fileName: "D:/AI网站/shubao/shubao-final.jsx",
          lineNumber: 434,
          columnNumber: 109
        }, this)) }, void 0, false, {
          fileName: "D:/AI网站/shubao/shubao-final.jsx",
          lineNumber: 434,
          columnNumber: 9
        }, this),
        /* @__PURE__ */ jsxDEV("div", { style: { background: "#FFF5F5", borderRadius: 12, padding: "12px 18px", marginBottom: 20, fontSize: 12, color: "#C53030", display: "flex", alignItems: "center", gap: 6, justifyContent: "center" }, children: [
          /* @__PURE__ */ jsxDEV(Clock, { size: 13 }, void 0, false, {
            fileName: "D:/AI网站/shubao/shubao-final.jsx",
            lineNumber: 435,
            columnNumber: 211
          }, this),
          "生成中请勿刷新页面，否则会浪费1套额度"
        ] }, void 0, true, {
          fileName: "D:/AI网站/shubao/shubao-final.jsx",
          lineNumber: 435,
          columnNumber: 9
        }, this),
        /* @__PURE__ */ jsxDEV("div", { style: { ...s.cardP, textAlign: "left" }, children: [
          /* @__PURE__ */ jsxDEV("div", { style: { fontSize: 10, color: "#ccc", marginBottom: 4, display: "flex", alignItems: "center", gap: 4 }, children: [
            /* @__PURE__ */ jsxDEV(Zap, { size: 10 }, void 0, false, {
              fileName: "D:/AI网站/shubao/shubao-final.jsx",
              lineNumber: 436,
              columnNumber: 165
            }, this),
            "小红书冷知识"
          ] }, void 0, true, {
            fileName: "D:/AI网站/shubao/shubao-final.jsx",
            lineNumber: 436,
            columnNumber: 56
          }, this),
          /* @__PURE__ */ jsxDEV("div", { style: { fontSize: 13, color: "#666", lineHeight: 1.7, minHeight: 32 }, children: TIPS[tipIdx] }, void 0, false, {
            fileName: "D:/AI网站/shubao/shubao-final.jsx",
            lineNumber: 436,
            columnNumber: 194
          }, this)
        ] }, void 0, true, {
          fileName: "D:/AI网站/shubao/shubao-final.jsx",
          lineNumber: 436,
          columnNumber: 9
        }, this),
        /* @__PURE__ */ jsxDEV("div", { style: { fontSize: 11, color: "#ddd", marginTop: 16 }, children: "预计需要 15-30 秒" }, void 0, false, {
          fileName: "D:/AI网站/shubao/shubao-final.jsx",
          lineNumber: 437,
          columnNumber: 9
        }, this)
      ] }, void 0, true, {
        fileName: "D:/AI网站/shubao/shubao-final.jsx",
        lineNumber: 430,
        columnNumber: 7
      }, this),
      css()
    ] }, void 0, true, {
      fileName: "D:/AI网站/shubao/shubao-final.jsx",
      lineNumber: 429,
      columnNumber: 12
    }, this);
  }
  if (gen === "result" && result) {
    return /* @__PURE__ */ jsxDEV(
      NoteModal,
      {
        item: result,
        onClose: () => {
          setGen("idle");
          setResult(null);
        },
        textRegen,
        onDownload: downloadZip,
        onRegenStart: function(i) {
          setRegenState({ active: true, msg: "正在重新生成第 " + (i + 1) + " 张图片..." });
        },
        onItemUpdate: function(i, url, workId) {
          setResult(function(prev) {
            if (!prev) return prev;
            if (i === 0) return { ...prev, cover_url: url };
            var u = [...prev.image_urls || []];
            if (u[i - 1]) u[i - 1] = url;
            return { ...prev, image_urls: u };
          });
          var wid = workId || lastWorkIdRef.current;
          if (wid) {
            setWorks(function(prev) {
              return prev.map(function(w) {
                if (w._inputText === wid) {
                  var nw = { ...w };
                  if (i === 0) nw.cover_url = url;
                  else {
                    var u = nw.image_urls || [];
                    if (u[i - 1]) u[i - 1] = url;
                    nw.image_urls = u;
                  }
                  setTimeout(function() {
                    saveWork(nw);
                  }, 0);
                  return nw;
                }
                return w;
              });
            });
          }
          setRegenState({ active: false, msg: "" });
        }
      },
      void 0,
      false,
      {
        fileName: "D:/AI网站/shubao/shubao-final.jsx",
        lineNumber: 442,
        columnNumber: 12
      },
      this
    );
  }
  if (pg === "gallery" && !gItem) {
    return /* @__PURE__ */ jsxDEV("div", { style: { minHeight: "100vh", background: BG }, children: [
      nav,
      /* @__PURE__ */ jsxDEV("div", { style: { ...s.section }, children: [
        /* @__PURE__ */ jsxDEV("h1", { style: { ...s.sectionTitle }, children: "薯包出品" }, void 0, false, {
          fileName: "D:/AI网站/shubao/shubao-final.jsx",
          lineNumber: 476,
          columnNumber: 7
        }, this),
        /* @__PURE__ */ jsxDEV("p", { style: { ...s.sectionSub }, children: "以下内容全部由薯包AI一键生成，点击任意作品查看完整图文" }, void 0, false, {
          fileName: "D:/AI网站/shubao/shubao-final.jsx",
          lineNumber: 477,
          columnNumber: 7
        }, this),
        /* @__PURE__ */ jsxDEV("div", { style: { display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14 }, children: GALLERY.map((g) => /* @__PURE__ */ jsxDEV(GCard, { item: g, onClick: function() {
          if (g.cover_url) {
            setResult({ ...g, body_text: g.body, hashtags: g.tags, category: g.cat, _inputText: g.hint });
            setGen("result");
          } else {
            setGItem(g);
          }
        } }, g.id, false, {
          fileName: "D:/AI网站/shubao/shubao-final.jsx",
          lineNumber: 478,
          columnNumber: 107
        }, this)) }, void 0, false, {
          fileName: "D:/AI网站/shubao/shubao-final.jsx",
          lineNumber: 478,
          columnNumber: 7
        }, this)
      ] }, void 0, true, {
        fileName: "D:/AI网站/shubao/shubao-final.jsx",
        lineNumber: 475,
        columnNumber: 5
      }, this),
      css(),
      loginModal,
      priceModal
    ] }, void 0, true, {
      fileName: "D:/AI网站/shubao/shubao-final.jsx",
      lineNumber: 474,
      columnNumber: 43
    }, this);
  }
  if (gItem) {
    return /* @__PURE__ */ jsxDEV("div", { style: { minHeight: "100vh", background: BG }, children: [
      nav,
      /* @__PURE__ */ jsxDEV("div", { style: { maxWidth: 640, margin: "0 auto", padding: "20px 20px 60px", animation: "slideUp 0.3s ease" }, children: [
        /* @__PURE__ */ jsxDEV(Btn, { small: true, onClick: () => setGItem(null), sx: { marginBottom: 14 }, children: [
          /* @__PURE__ */ jsxDEV(ArrowLeft, { size: 14 }, void 0, false, {
            fileName: "D:/AI网站/shubao/shubao-final.jsx",
            lineNumber: 484,
            columnNumber: 75
          }, this),
          "返回"
        ] }, void 0, true, {
          fileName: "D:/AI网站/shubao/shubao-final.jsx",
          lineNumber: 484,
          columnNumber: 7
        }, this),
        /* @__PURE__ */ jsxDEV(Card, { sx: { overflow: "hidden" }, children: [
          /* @__PURE__ */ jsxDEV("div", { style: { background: gItem.grad, height: 200, display: "flex", alignItems: "flex-end", padding: 24, position: "relative" }, children: [
            /* @__PURE__ */ jsxDEV("div", { style: { position: "absolute", inset: 0, background: "linear-gradient(transparent 30%,rgba(0,0,0,0.6))" } }, void 0, false, {
              fileName: "D:/AI网站/shubao/shubao-final.jsx",
              lineNumber: 487,
              columnNumber: 11
            }, this),
            /* @__PURE__ */ jsxDEV("div", { style: { position: "relative" }, children: [
              /* @__PURE__ */ jsxDEV("span", { style: { fontSize: 11, background: "rgba(255,255,255,0.2)", color: "#fff", padding: "3px 10px", borderRadius: 8, backdropFilter: "blur(4px)" }, children: gItem.cat }, void 0, false, {
                fileName: "D:/AI网站/shubao/shubao-final.jsx",
                lineNumber: 488,
                columnNumber: 49
              }, this),
              /* @__PURE__ */ jsxDEV("h2", { style: { color: "#fff", fontSize: 20, fontWeight: 700, margin: "8px 0 0", textShadow: "0 2px 8px rgba(0,0,0,0.3)", lineHeight: 1.4 }, children: gItem.title }, void 0, false, {
                fileName: "D:/AI网站/shubao/shubao-final.jsx",
                lineNumber: 488,
                columnNumber: 217
              }, this)
            ] }, void 0, true, {
              fileName: "D:/AI网站/shubao/shubao-final.jsx",
              lineNumber: 488,
              columnNumber: 11
            }, this)
          ] }, void 0, true, {
            fileName: "D:/AI网站/shubao/shubao-final.jsx",
            lineNumber: 486,
            columnNumber: 9
          }, this),
          /* @__PURE__ */ jsxDEV("div", { style: { padding: 24 }, children: [
            /* @__PURE__ */ jsxDEV("div", { style: { fontSize: 14, lineHeight: 2.1, color: "#333", whiteSpace: "pre-wrap", marginBottom: 20 }, children: gItem.body }, void 0, false, {
              fileName: "D:/AI网站/shubao/shubao-final.jsx",
              lineNumber: 491,
              columnNumber: 11
            }, this),
            /* @__PURE__ */ jsxDEV("div", { style: { display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 20 }, children: gItem.tags.map((t, i) => /* @__PURE__ */ jsxDEV("span", { style: { fontSize: 12, color: R, background: "#FFF1F3", padding: "4px 14px", borderRadius: 20 }, children: t }, i, false, {
              fileName: "D:/AI网站/shubao/shubao-final.jsx",
              lineNumber: 492,
              columnNumber: 114
            }, this)) }, void 0, false, {
              fileName: "D:/AI网站/shubao/shubao-final.jsx",
              lineNumber: 492,
              columnNumber: 11
            }, this),
            /* @__PURE__ */ jsxDEV("div", { style: { display: "flex", gap: 10 }, children: [
              /* @__PURE__ */ jsxDEV(Btn, { primary: true, full: true, onClick: () => {
                setText(gItem.hint || gItem.body.split("\n")[0]);
                setGItem(null);
                setPg("home");
              }, children: [
                /* @__PURE__ */ jsxDEV(Sparkles, { size: 14 }, void 0, false, {
                  fileName: "D:/AI网站/shubao/shubao-final.jsx",
                  lineNumber: 493,
                  columnNumber: 168
                }, this),
                "一键同款"
              ] }, void 0, true, {
                fileName: "D:/AI网站/shubao/shubao-final.jsx",
                lineNumber: 493,
                columnNumber: 53
              }, this),
              /* @__PURE__ */ jsxDEV(Btn, { onClick: () => setGItem(null), children: "返回" }, void 0, false, {
                fileName: "D:/AI网站/shubao/shubao-final.jsx",
                lineNumber: 493,
                columnNumber: 200
              }, this)
            ] }, void 0, true, {
              fileName: "D:/AI网站/shubao/shubao-final.jsx",
              lineNumber: 493,
              columnNumber: 11
            }, this)
          ] }, void 0, true, {
            fileName: "D:/AI网站/shubao/shubao-final.jsx",
            lineNumber: 490,
            columnNumber: 9
          }, this)
        ] }, void 0, true, {
          fileName: "D:/AI网站/shubao/shubao-final.jsx",
          lineNumber: 485,
          columnNumber: 7
        }, this)
      ] }, void 0, true, {
        fileName: "D:/AI网站/shubao/shubao-final.jsx",
        lineNumber: 483,
        columnNumber: 5
      }, this),
      css(),
      loginModal,
      priceModal
    ] }, void 0, true, {
      fileName: "D:/AI网站/shubao/shubao-final.jsx",
      lineNumber: 482,
      columnNumber: 22
    }, this);
  }
  if (pg === "pricing") {
    return /* @__PURE__ */ jsxDEV("div", { style: { minHeight: "100vh", background: BG }, children: [
      nav,
      /* @__PURE__ */ jsxDEV("div", { style: { ...s.section }, children: [
        /* @__PURE__ */ jsxDEV("h1", { style: { ...s.sectionTitle }, children: "价格方案" }, void 0, false, {
          fileName: "D:/AI网站/shubao/shubao-final.jsx",
          lineNumber: 501,
          columnNumber: 7
        }, this),
        /* @__PURE__ */ jsxDEV("p", { style: { ...s.sectionSub }, children: "按套收费，不搞自动续费。每套包含完整的标题+正文+标签+9张配图" }, void 0, false, {
          fileName: "D:/AI网站/shubao/shubao-final.jsx",
          lineNumber: 502,
          columnNumber: 7
        }, this),
        /* @__PURE__ */ jsxDEV("div", { style: { display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12 }, children: PRICING.map((p, i) => /* @__PURE__ */ jsxDEV(Card, { sx: { padding: 20, textAlign: "center", border: p.pop ? "2px solid " + R : "1px solid #f0f0f0", position: "relative" }, children: [
          p.pop && /* @__PURE__ */ jsxDEV("div", { style: { position: "absolute", top: -11, left: "50%", transform: "translateX(-50%)", background: R, color: "#fff", fontSize: 10, padding: "3px 14px", borderRadius: 10, fontWeight: 600 }, children: "推荐" }, void 0, false, {
            fileName: "D:/AI网站/shubao/shubao-final.jsx",
            lineNumber: 504,
            columnNumber: 19
          }, this),
          /* @__PURE__ */ jsxDEV("div", { style: { fontSize: 15, fontWeight: 700, marginBottom: 4 }, children: p.name }, void 0, false, {
            fileName: "D:/AI网站/shubao/shubao-final.jsx",
            lineNumber: 505,
            columnNumber: 9
          }, this),
          /* @__PURE__ */ jsxDEV("div", { style: { fontSize: 11, color: "#999", marginBottom: 12 }, children: p.desc }, void 0, false, {
            fileName: "D:/AI网站/shubao/shubao-final.jsx",
            lineNumber: 506,
            columnNumber: 9
          }, this),
          /* @__PURE__ */ jsxDEV("div", { style: { fontSize: 32, fontWeight: 800, color: R, marginBottom: 2 }, children: [
            "¥",
            p.price
          ] }, void 0, true, {
            fileName: "D:/AI网站/shubao/shubao-final.jsx",
            lineNumber: 507,
            columnNumber: 9
          }, this),
          /* @__PURE__ */ jsxDEV("div", { style: { fontSize: 12, color: "#bbb", marginBottom: 12 }, children: [
            p.sets,
            "套图文"
          ] }, void 0, true, {
            fileName: "D:/AI网站/shubao/shubao-final.jsx",
            lineNumber: 508,
            columnNumber: 9
          }, this),
          /* @__PURE__ */ jsxDEV("div", { style: { fontSize: 11, color: "#ccc", marginBottom: 4 }, children: [
            "单张重生成 ",
            p.regen,
            "次/套"
          ] }, void 0, true, {
            fileName: "D:/AI网站/shubao/shubao-final.jsx",
            lineNumber: 509,
            columnNumber: 9
          }, this),
          /* @__PURE__ */ jsxDEV("div", { style: { fontSize: 11, color: "#ccc", marginBottom: 14 }, children: [
            "约 ¥",
            p.per,
            "/套"
          ] }, void 0, true, {
            fileName: "D:/AI网站/shubao/shubao-final.jsx",
            lineNumber: 510,
            columnNumber: 9
          }, this),
          /* @__PURE__ */ jsxDEV(Btn, { primary: p.pop, full: true, small: true, onClick: () => {
            if (!logged) setShowLogin(true);
            else {
              setPtsS(pts + p.sets);
              setPts(pts + p.sets);
            }
          }, children: p.pop ? /* @__PURE__ */ jsxDEV(Fragment, { children: [
            /* @__PURE__ */ jsxDEV(Sparkles, { size: 12 }, void 0, false, {
              fileName: "D:/AI网站/shubao/shubao-final.jsx",
              lineNumber: 511,
              columnNumber: 153
            }, this),
            "立即购买"
          ] }, void 0, true, {
            fileName: "D:/AI网站/shubao/shubao-final.jsx",
            lineNumber: 511,
            columnNumber: 151
          }, this) : "选择" }, void 0, false, {
            fileName: "D:/AI网站/shubao/shubao-final.jsx",
            lineNumber: 511,
            columnNumber: 9
          }, this)
        ] }, i, true, {
          fileName: "D:/AI网站/shubao/shubao-final.jsx",
          lineNumber: 503,
          columnNumber: 110
        }, this)) }, void 0, false, {
          fileName: "D:/AI网站/shubao/shubao-final.jsx",
          lineNumber: 503,
          columnNumber: 7
        }, this),
        /* @__PURE__ */ jsxDEV("div", { style: { textAlign: "center", marginTop: 24, fontSize: 12, color: "#ccc" }, children: "所有套餐均为一次性购买，不自动续费，不限使用时间" }, void 0, false, {
          fileName: "D:/AI网站/shubao/shubao-final.jsx",
          lineNumber: 513,
          columnNumber: 7
        }, this)
      ] }, void 0, true, {
        fileName: "D:/AI网站/shubao/shubao-final.jsx",
        lineNumber: 500,
        columnNumber: 5
      }, this),
      css(),
      loginModal,
      priceModal
    ] }, void 0, true, {
      fileName: "D:/AI网站/shubao/shubao-final.jsx",
      lineNumber: 499,
      columnNumber: 33
    }, this);
  }
  if (pg === "works") {
    return /* @__PURE__ */ jsxDEV("div", { style: { minHeight: "100vh", background: BG }, children: [
      nav,
      /* @__PURE__ */ jsxDEV("div", { style: { ...s.section }, children: [
        /* @__PURE__ */ jsxDEV("h1", { style: { ...s.sectionTitle }, children: "我的作品" }, void 0, false, {
          fileName: "D:/AI网站/shubao/shubao-final.jsx",
          lineNumber: 519,
          columnNumber: 7
        }, this),
        /* @__PURE__ */ jsxDEV("p", { style: { ...s.sectionSub }, children: works.length ? works.length + "个作品" : "还没有作品，去创作第一套爆款图文吧" }, void 0, false, {
          fileName: "D:/AI网站/shubao/shubao-final.jsx",
          lineNumber: 520,
          columnNumber: 7
        }, this),
        !works.length ? /* @__PURE__ */ jsxDEV("div", { style: { textAlign: "center", padding: "40px 0" }, children: [
          /* @__PURE__ */ jsxDEV(CharImg, { src: I.empty, alt: "", style: { height: 100 }, filter: "none", margin: "0 0 16px" }, void 0, false, {
            fileName: "D:/AI网站/shubao/shubao-final.jsx",
            lineNumber: 521,
            columnNumber: 80
          }, this),
          logged ? /* @__PURE__ */ jsxDEV(Btn, { primary: true, onClick: () => setPg("home"), children: [
            /* @__PURE__ */ jsxDEV(Sparkles, { size: 14 }, void 0, false, {
              fileName: "D:/AI网站/shubao/shubao-final.jsx",
              lineNumber: 522,
              columnNumber: 62
            }, this),
            "开始创作"
          ] }, void 0, true, {
            fileName: "D:/AI网站/shubao/shubao-final.jsx",
            lineNumber: 522,
            columnNumber: 19
          }, this) : /* @__PURE__ */ jsxDEV(Fragment, { children: [
            /* @__PURE__ */ jsxDEV("p", { style: { fontSize: 13, color: "#999", margin: "0 0 12px" }, children: "登录后，生成的内容会自动保存到这里" }, void 0, false, {
              fileName: "D:/AI网站/shubao/shubao-final.jsx",
              lineNumber: 522,
              columnNumber: 99
            }, this),
            /* @__PURE__ */ jsxDEV(Btn, { primary: true, onClick: () => setShowLogin(true), children: [
              /* @__PURE__ */ jsxDEV(LogIn, { size: 14 }, void 0, false, {
                fileName: "D:/AI网站/shubao/shubao-final.jsx",
                lineNumber: 522,
                columnNumber: 231
              }, this),
              "登录查看作品"
            ] }, void 0, true, {
              fileName: "D:/AI网站/shubao/shubao-final.jsx",
              lineNumber: 522,
              columnNumber: 183
            }, this)
          ] }, void 0, true, {
            fileName: "D:/AI网站/shubao/shubao-final.jsx",
            lineNumber: 522,
            columnNumber: 97
          }, this)
        ] }, void 0, true, {
          fileName: "D:/AI网站/shubao/shubao-final.jsx",
          lineNumber: 521,
          columnNumber: 24
        }, this) : /* @__PURE__ */ jsxDEV("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }, children: works.map((w, i) => /* @__PURE__ */ jsxDEV(Card, { hover: true, onClick: () => {
          setResult(w);
          setGen("result");
        }, sx: { padding: 16, display: "flex", gap: 12, alignItems: "center" }, children: [
          w.cover_url ? /* @__PURE__ */ jsxDEV("img", { src: w.cover_url, alt: "", style: { width: 56, height: 75, borderRadius: 8, objectFit: "cover", flex: "0 0 auto" } }, void 0, false, {
            fileName: "D:/AI网站/shubao/shubao-final.jsx",
            lineNumber: 525,
            columnNumber: 24
          }, this) : /* @__PURE__ */ jsxDEV("div", { style: { width: 56, height: 75, borderRadius: 8, background: "#f5f5f5", flex: "0 0 auto", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }, children: "📄" }, void 0, false, {
            fileName: "D:/AI网站/shubao/shubao-final.jsx",
            lineNumber: 525,
            columnNumber: 148
          }, this),
          /* @__PURE__ */ jsxDEV("div", { style: { flex: 1, minWidth: 0 }, children: [
            /* @__PURE__ */ jsxDEV("div", { style: { fontSize: 14, fontWeight: 600, lineHeight: 1.5, marginBottom: 4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }, children: w.title }, void 0, false, {
              fileName: "D:/AI网站/shubao/shubao-final.jsx",
              lineNumber: 527,
              columnNumber: 11
            }, this),
            /* @__PURE__ */ jsxDEV("div", { style: { display: "flex", justifyContent: "space-between", fontSize: 11, color: "#ccc" }, children: [
              /* @__PURE__ */ jsxDEV("span", { children: w.category }, void 0, false, {
                fileName: "D:/AI网站/shubao/shubao-final.jsx",
                lineNumber: 528,
                columnNumber: 106
              }, this),
              /* @__PURE__ */ jsxDEV("span", { children: w.at }, void 0, false, {
                fileName: "D:/AI网站/shubao/shubao-final.jsx",
                lineNumber: 528,
                columnNumber: 131
              }, this)
            ] }, void 0, true, {
              fileName: "D:/AI网站/shubao/shubao-final.jsx",
              lineNumber: 528,
              columnNumber: 11
            }, this),
            w.cover_url && /* @__PURE__ */ jsxDEV("div", { style: { fontSize: 10, color: "#ddd", marginTop: 2 }, children: [
              w.image_urls?.length || 0,
              "张配图"
            ] }, void 0, true, {
              fileName: "D:/AI网站/shubao/shubao-final.jsx",
              lineNumber: 529,
              columnNumber: 27
            }, this)
          ] }, void 0, true, {
            fileName: "D:/AI网站/shubao/shubao-final.jsx",
            lineNumber: 526,
            columnNumber: 9
          }, this)
        ] }, w.id || i, true, {
          fileName: "D:/AI网站/shubao/shubao-final.jsx",
          lineNumber: 524,
          columnNumber: 104
        }, this)) }, void 0, false, {
          fileName: "D:/AI网站/shubao/shubao-final.jsx",
          lineNumber: 524,
          columnNumber: 9
        }, this)
      ] }, void 0, true, {
        fileName: "D:/AI网站/shubao/shubao-final.jsx",
        lineNumber: 518,
        columnNumber: 5
      }, this),
      css(),
      loginModal,
      priceModal
    ] }, void 0, true, {
      fileName: "D:/AI网站/shubao/shubao-final.jsx",
      lineNumber: 517,
      columnNumber: 31
    }, this);
  }
  return /* @__PURE__ */ jsxDEV("div", { style: { minHeight: "100vh", background: BG }, children: [
    nav,
    /* @__PURE__ */ jsxDEV("section", { style: { maxWidth: 680, margin: "0 auto", padding: "36px 20px 0", textAlign: "center" }, children: [
      /* @__PURE__ */ jsxDEV(CharImg, { src: I.wave, alt: "小薯包", style: { height: 64 }, margin: "0 0 12px" }, void 0, false, {
        fileName: "D:/AI网站/shubao/shubao-final.jsx",
        lineNumber: 539,
        columnNumber: 7
      }, this),
      /* @__PURE__ */ jsxDEV("h1", { style: { fontSize: 28, fontWeight: 800, margin: "0 0 8px", lineHeight: 1.4, color: "#1a1a1a" }, children: [
        "一句话主题，AI帮你生成",
        /* @__PURE__ */ jsxDEV("br", {}, void 0, false, {
          fileName: "D:/AI网站/shubao/shubao-final.jsx",
          lineNumber: 540,
          columnNumber: 119
        }, this),
        /* @__PURE__ */ jsxDEV("span", { style: { color: R }, children: "小红书爆款图文" }, void 0, false, {
          fileName: "D:/AI网站/shubao/shubao-final.jsx",
          lineNumber: 540,
          columnNumber: 125
        }, this)
      ] }, void 0, true, {
        fileName: "D:/AI网站/shubao/shubao-final.jsx",
        lineNumber: 540,
        columnNumber: 7
      }, this),
      /* @__PURE__ */ jsxDEV("p", { style: { fontSize: 14, color: "#999", margin: "0 0 24px", lineHeight: 1.7 }, children: "输入任意主题或素材，薯包AI自动识别赛道，一键生成爆款标题+种草文案+9张精美配图" }, void 0, false, {
        fileName: "D:/AI网站/shubao/shubao-final.jsx",
        lineNumber: 541,
        columnNumber: 7
      }, this),
      /* @__PURE__ */ jsxDEV(Card, { sx: { padding: 24, textAlign: "left", border: "1.5px solid #f0f0f0" }, children: [
        /* @__PURE__ */ jsxDEV("textarea", { value: text, onChange: (e) => setText(e.target.value), placeholder: "输入你想创作的主题，一句话就够了\n例如：📍厦门3天2夜旅游攻略、🎧百元蓝牙耳机测评...", style: { width: "100%", minHeight: 110, padding: 16, border: "2px solid #f0f0f0", borderRadius: 14, fontSize: 14, lineHeight: 1.8, fontFamily: "inherit", resize: "vertical", boxSizing: "border-box", outline: "none", transition: "border-color 0.2s" }, onFocus: (e) => e.target.style.borderColor = R2, onBlur: (e) => e.target.style.borderColor = "#f0f0f0" }, void 0, false, {
          fileName: "D:/AI网站/shubao/shubao-final.jsx",
          lineNumber: 544,
          columnNumber: 9
        }, this),
        /* @__PURE__ */ jsxDEV("div", { style: { margin: "12px 0 16px" }, children: [
          /* @__PURE__ */ jsxDEV("div", { style: { fontSize: 11, color: "#999", marginBottom: 6 }, children: "热门主题" }, void 0, false, {
            fileName: "D:/AI网站/shubao/shubao-final.jsx",
            lineNumber: 546,
            columnNumber: 11
          }, this),
          /* @__PURE__ */ jsxDEV("div", { style: { display: "flex", alignItems: "center", gap: 4 }, children: [
            /* @__PURE__ */ jsxDEV("button", { onClick: () => setCarouselIdx((i) => (i - 1 + QUICK_HINTS.length) % QUICK_HINTS.length), style: { flex: "0 0 auto", background: "none", border: "none", fontSize: 18, color: "#aaa", cursor: "pointer", padding: "4px 2px" }, children: String.fromCharCode(8249) }, void 0, false, {
              fileName: "D:/AI网站/shubao/shubao-final.jsx",
              lineNumber: 548,
              columnNumber: 13
            }, this),
            /* @__PURE__ */ jsxDEV("div", { style: { flex: 1, overflow: "hidden", borderRadius: 10, background: "#f5f5f5", border: "1px solid #eee" }, children: /* @__PURE__ */ jsxDEV("div", { style: { textAlign: "center", padding: "8px 0" }, children: /* @__PURE__ */ jsxDEV("button", { onClick: () => setText(QUICK_HINTS[carouselIdx]), style: { fontSize: 14, color: "#555", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }, children: QUICK_HINTS[carouselIdx] }, void 0, false, {
              fileName: "D:/AI网站/shubao/shubao-final.jsx",
              lineNumber: 551,
              columnNumber: 17
            }, this) }, void 0, false, {
              fileName: "D:/AI网站/shubao/shubao-final.jsx",
              lineNumber: 550,
              columnNumber: 15
            }, this) }, void 0, false, {
              fileName: "D:/AI网站/shubao/shubao-final.jsx",
              lineNumber: 549,
              columnNumber: 13
            }, this),
            /* @__PURE__ */ jsxDEV("button", { onClick: () => setCarouselIdx((i) => (i + 1) % QUICK_HINTS.length), style: { flex: "0 0 auto", background: "none", border: "none", fontSize: 18, color: "#aaa", cursor: "pointer", padding: "4px 2px" }, children: String.fromCharCode(8250) }, void 0, false, {
              fileName: "D:/AI网站/shubao/shubao-final.jsx",
              lineNumber: 556,
              columnNumber: 13
            }, this)
          ] }, void 0, true, {
            fileName: "D:/AI网站/shubao/shubao-final.jsx",
            lineNumber: 547,
            columnNumber: 11
          }, this),
          /* @__PURE__ */ jsxDEV("div", { style: { display: "flex", justifyContent: "center", gap: 3, marginTop: 6 }, children: QUICK_HINTS.map(function(_, i) {
            return /* @__PURE__ */ jsxDEV("div", { style: { width: i === carouselIdx ? 16 : 4, height: 3, borderRadius: 2, background: i === carouselIdx ? "#888" : "#ddd", transition: "all .3s" } }, i, false, {
              fileName: "D:/AI网站/shubao/shubao-final.jsx",
              lineNumber: 558,
              columnNumber: 133
            }, this);
          }) }, void 0, false, {
            fileName: "D:/AI网站/shubao/shubao-final.jsx",
            lineNumber: 558,
            columnNumber: 11
          }, this)
        ] }, void 0, true, {
          fileName: "D:/AI网站/shubao/shubao-final.jsx",
          lineNumber: 545,
          columnNumber: 9
        }, this),
        err && /* @__PURE__ */ jsxDEV("div", { style: { background: "#FFF5F5", border: "1px solid #FED7D7", borderRadius: 10, padding: "10px 14px", marginBottom: 12, fontSize: 12, color: "#C53030" }, children: err }, void 0, false, {
          fileName: "D:/AI网站/shubao/shubao-final.jsx",
          lineNumber: 560,
          columnNumber: 9
        }, this),
        /* @__PURE__ */ jsxDEV(Btn, { primary: true, full: true, disabled: !text.trim(), onClick: doGen, children: [
          /* @__PURE__ */ jsxDEV(Sparkles, { size: 16 }, void 0, false, {
            fileName: "D:/AI网站/shubao/shubao-final.jsx",
            lineNumber: 561,
            columnNumber: 67
          }, this),
          logged ? "一键生成爆款图文" : "新用户免费生成"
        ] }, void 0, true, {
          fileName: "D:/AI网站/shubao/shubao-final.jsx",
          lineNumber: 561,
          columnNumber: 9
        }, this),
        /* @__PURE__ */ jsxDEV("div", { style: { textAlign: "center", fontSize: 11, color: "#bbb", marginTop: 8 }, children: logged ? `剩余 ${pts} 套额度` : "新用户专享 · 登录后可保存到作品集" }, void 0, false, {
          fileName: "D:/AI网站/shubao/shubao-final.jsx",
          lineNumber: 562,
          columnNumber: 9
        }, this)
      ] }, void 0, true, {
        fileName: "D:/AI网站/shubao/shubao-final.jsx",
        lineNumber: 543,
        columnNumber: 7
      }, this)
    ] }, void 0, true, {
      fileName: "D:/AI网站/shubao/shubao-final.jsx",
      lineNumber: 538,
      columnNumber: 5
    }, this),
    /* @__PURE__ */ jsxDEV("section", { style: { ...s.section, paddingTop: 48 }, children: [
      /* @__PURE__ */ jsxDEV("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }, children: [
        /* @__PURE__ */ jsxDEV("div", { children: [
          /* @__PURE__ */ jsxDEV("h2", { style: { fontSize: 20, fontWeight: 700, margin: "0 0 4px", display: "flex", alignItems: "center", gap: 8 }, children: [
            /* @__PURE__ */ jsxDEV("img", { src: I.appicon, style: { width: 22, height: 22, borderRadius: 6 }, alt: "" }, void 0, false, {
              fileName: "D:/AI网站/shubao/shubao-final.jsx",
              lineNumber: 569,
              columnNumber: 126
            }, this),
            "薯包出品"
          ] }, void 0, true, {
            fileName: "D:/AI网站/shubao/shubao-final.jsx",
            lineNumber: 569,
            columnNumber: 14
          }, this),
          /* @__PURE__ */ jsxDEV("p", { style: { fontSize: 12, color: "#bbb", margin: 0 }, children: "以下内容全部由薯包AI一键生成，点击查看完整图文" }, void 0, false, {
            fileName: "D:/AI网站/shubao/shubao-final.jsx",
            lineNumber: 569,
            columnNumber: 216
          }, this)
        ] }, void 0, true, {
          fileName: "D:/AI网站/shubao/shubao-final.jsx",
          lineNumber: 569,
          columnNumber: 9
        }, this),
        /* @__PURE__ */ jsxDEV(Btn, { small: true, onClick: () => setPg("gallery"), sx: { color: R, border: "1px solid " + R }, children: [
          "更多作品 ",
          /* @__PURE__ */ jsxDEV(ChevronRight, { size: 13 }, void 0, false, {
            fileName: "D:/AI网站/shubao/shubao-final.jsx",
            lineNumber: 570,
            columnNumber: 102
          }, this)
        ] }, void 0, true, {
          fileName: "D:/AI网站/shubao/shubao-final.jsx",
          lineNumber: 570,
          columnNumber: 9
        }, this)
      ] }, void 0, true, {
        fileName: "D:/AI网站/shubao/shubao-final.jsx",
        lineNumber: 568,
        columnNumber: 7
      }, this),
      /* @__PURE__ */ jsxDEV("div", { style: { display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14 }, children: GALLERY.slice(0, 6).map((g) => /* @__PURE__ */ jsxDEV(GCard, { item: g, onClick: function() {
        if (g.cover_url) {
          setResult({ ...g, body_text: g.body, hashtags: g.tags, category: g.cat, _inputText: g.hint });
          setGen("result");
        } else {
          setGItem(g);
        }
      } }, g.id, false, {
        fileName: "D:/AI网站/shubao/shubao-final.jsx",
        lineNumber: 572,
        columnNumber: 119
      }, this)) }, void 0, false, {
        fileName: "D:/AI网站/shubao/shubao-final.jsx",
        lineNumber: 572,
        columnNumber: 7
      }, this)
    ] }, void 0, true, {
      fileName: "D:/AI网站/shubao/shubao-final.jsx",
      lineNumber: 567,
      columnNumber: 5
    }, this),
    /* @__PURE__ */ jsxDEV("section", { style: { ...s.section, paddingTop: 24 }, children: [
      /* @__PURE__ */ jsxDEV("h2", { style: { ...s.sectionTitle }, children: "为什么选薯包AI生成小红书图文" }, void 0, false, {
        fileName: "D:/AI网站/shubao/shubao-final.jsx",
        lineNumber: 577,
        columnNumber: 7
      }, this),
      /* @__PURE__ */ jsxDEV("p", { style: { ...s.sectionSub }, children: "从种草笔记到干货攻略，3分钟交付可直接发布的完整图文套件" }, void 0, false, {
        fileName: "D:/AI网站/shubao/shubao-final.jsx",
        lineNumber: 578,
        columnNumber: 7
      }, this),
      /* @__PURE__ */ jsxDEV("div", { style: { display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }, children: FEATURES.map((f, i) => {
        const Icon = f.icon;
        return /* @__PURE__ */ jsxDEV(Card, { sx: { padding: 20 }, children: [
          /* @__PURE__ */ jsxDEV("div", { style: { width: 36, height: 36, borderRadius: 10, background: "#FFF1F3", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 10 }, children: /* @__PURE__ */ jsxDEV(Icon, { size: 18, color: R }, void 0, false, {
            fileName: "D:/AI网站/shubao/shubao-final.jsx",
            lineNumber: 580,
            columnNumber: 172
          }, this) }, void 0, false, {
            fileName: "D:/AI网站/shubao/shubao-final.jsx",
            lineNumber: 580,
            columnNumber: 9
          }, this),
          /* @__PURE__ */ jsxDEV("div", { style: { fontSize: 14, fontWeight: 700, marginBottom: 4 }, children: f.title }, void 0, false, {
            fileName: "D:/AI网站/shubao/shubao-final.jsx",
            lineNumber: 581,
            columnNumber: 9
          }, this),
          /* @__PURE__ */ jsxDEV("div", { style: { fontSize: 12, color: "#999", lineHeight: 1.6 }, children: f.desc }, void 0, false, {
            fileName: "D:/AI网站/shubao/shubao-final.jsx",
            lineNumber: 582,
            columnNumber: 9
          }, this)
        ] }, i, true, {
          fileName: "D:/AI网站/shubao/shubao-final.jsx",
          lineNumber: 579,
          columnNumber: 139
        }, this);
      }) }, void 0, false, {
        fileName: "D:/AI网站/shubao/shubao-final.jsx",
        lineNumber: 579,
        columnNumber: 7
      }, this)
    ] }, void 0, true, {
      fileName: "D:/AI网站/shubao/shubao-final.jsx",
      lineNumber: 576,
      columnNumber: 5
    }, this),
    /* @__PURE__ */ jsxDEV("section", { style: { ...s.section, paddingTop: 24 }, children: [
      /* @__PURE__ */ jsxDEV("h2", { style: { ...s.sectionTitle }, children: "3步搞定小红书爆款图文" }, void 0, false, {
        fileName: "D:/AI网站/shubao/shubao-final.jsx",
        lineNumber: 588,
        columnNumber: 7
      }, this),
      /* @__PURE__ */ jsxDEV("p", { style: { ...s.sectionSub }, children: "比你想象的更简单" }, void 0, false, {
        fileName: "D:/AI网站/shubao/shubao-final.jsx",
        lineNumber: 589,
        columnNumber: 7
      }, this),
      /* @__PURE__ */ jsxDEV("div", { style: { display: "flex", gap: 16, justifyContent: "center", flexWrap: "wrap" }, children: [{ n: "1", t: "粘贴素材", d: "旅行经历、产品体验、探店笔记...任何形式的原始素材都行", icon: "✍️", bg: "#FFF0F2" }, { n: "2", t: "薯包创作", d: "AI自动识别赛道，生成爆款标题+文案+9张配图", icon: "✨", bg: "#F0F4FF" }, { n: "3", t: "直接发布", d: "一键复制文案、下载图片，打开小红书就能发", icon: "🚀", bg: "#F0FFF4" }].map((st, i) => /* @__PURE__ */ jsxDEV(Card, { sx: { flex: "1 1 200px", padding: "28px 20px", textAlign: "center", maxWidth: 240, position: "relative", overflow: "hidden" }, children: [
        /* @__PURE__ */ jsxDEV("div", { style: { position: "absolute", top: 0, left: 0, right: 0, height: 4, background: `linear-gradient(90deg,${[R, "#667EEA", "#48BB78"][i]},transparent)` } }, void 0, false, {
          fileName: "D:/AI网站/shubao/shubao-final.jsx",
          lineNumber: 592,
          columnNumber: 11
        }, this),
        /* @__PURE__ */ jsxDEV("div", { style: { fontSize: 48, lineHeight: 1, marginBottom: 8 }, children: st.icon }, void 0, false, {
          fileName: "D:/AI网站/shubao/shubao-final.jsx",
          lineNumber: 593,
          columnNumber: 11
        }, this),
        /* @__PURE__ */ jsxDEV("div", { style: { width: 28, height: 28, borderRadius: "50%", background: R, color: "#fff", fontSize: 13, fontWeight: 700, display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 8, boxShadow: "0 4px 12px rgba(255,71,87,0.2)" }, children: st.n }, void 0, false, {
          fileName: "D:/AI网站/shubao/shubao-final.jsx",
          lineNumber: 594,
          columnNumber: 11
        }, this),
        /* @__PURE__ */ jsxDEV("div", { style: { fontSize: 15, fontWeight: 700, marginBottom: 6 }, children: st.t }, void 0, false, {
          fileName: "D:/AI网站/shubao/shubao-final.jsx",
          lineNumber: 595,
          columnNumber: 11
        }, this),
        /* @__PURE__ */ jsxDEV("div", { style: { fontSize: 12, color: "#999", lineHeight: 1.7 }, children: st.d }, void 0, false, {
          fileName: "D:/AI网站/shubao/shubao-final.jsx",
          lineNumber: 596,
          columnNumber: 11
        }, this)
      ] }, i, true, {
        fileName: "D:/AI网站/shubao/shubao-final.jsx",
        lineNumber: 591,
        columnNumber: 267
      }, this)) }, void 0, false, {
        fileName: "D:/AI网站/shubao/shubao-final.jsx",
        lineNumber: 590,
        columnNumber: 7
      }, this),
      /* @__PURE__ */ jsxDEV("p", { style: { textAlign: "center", fontSize: 12, color: "#d0d0d0", marginTop: 16 }, children: "⏱ 全程约15-30秒 · 不满意可免费重新生成" }, void 0, false, {
        fileName: "D:/AI网站/shubao/shubao-final.jsx",
        lineNumber: 599,
        columnNumber: 7
      }, this)
    ] }, void 0, true, {
      fileName: "D:/AI网站/shubao/shubao-final.jsx",
      lineNumber: 587,
      columnNumber: 5
    }, this),
    /* @__PURE__ */ jsxDEV("section", { style: { textAlign: "center", padding: "40px 20px 20px" }, children: [
      /* @__PURE__ */ jsxDEV(CharImg, { src: I.excited, alt: "", style: { height: 56 }, filter: "drop-shadow(0 4px 12px rgba(255,71,87,0.12))", margin: "0 0 10px" }, void 0, false, {
        fileName: "D:/AI网站/shubao/shubao-final.jsx",
        lineNumber: 604,
        columnNumber: 7
      }, this),
      /* @__PURE__ */ jsxDEV("h2", { style: { fontSize: 22, fontWeight: 700, margin: "0 0 6px" }, children: "准备好了吗？" }, void 0, false, {
        fileName: "D:/AI网站/shubao/shubao-final.jsx",
        lineNumber: 605,
        columnNumber: 7
      }, this),
      /* @__PURE__ */ jsxDEV("p", { style: { fontSize: 13, color: "#999", margin: "0 0 16px" }, children: logged ? "还有更多次数，继续生成" : "新用户免费生成 · 不满意不收费" }, void 0, false, {
        fileName: "D:/AI网站/shubao/shubao-final.jsx",
        lineNumber: 606,
        columnNumber: 7
      }, this),
      /* @__PURE__ */ jsxDEV(Btn, { primary: true, onClick: () => window.scrollTo({ top: 0, behavior: "smooth" }), children: [
        /* @__PURE__ */ jsxDEV(Sparkles, { size: 15 }, void 0, false, {
          fileName: "D:/AI网站/shubao/shubao-final.jsx",
          lineNumber: 607,
          columnNumber: 84
        }, this),
        "立即免费体验"
      ] }, void 0, true, {
        fileName: "D:/AI网站/shubao/shubao-final.jsx",
        lineNumber: 607,
        columnNumber: 7
      }, this)
    ] }, void 0, true, {
      fileName: "D:/AI网站/shubao/shubao-final.jsx",
      lineNumber: 603,
      columnNumber: 5
    }, this),
    /* @__PURE__ */ jsxDEV("footer", { style: { padding: "32px 20px", background: "#f9f9f9", borderTop: "1px solid #f0f0f0", marginTop: 40 }, children: [
      /* @__PURE__ */ jsxDEV("div", { style: { maxWidth: 800, margin: "0 auto", display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 20 }, children: [
        /* @__PURE__ */ jsxDEV("div", { style: { flex: "1 1 280px" }, children: [
          /* @__PURE__ */ jsxDEV("div", { style: { display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }, children: [
            /* @__PURE__ */ jsxDEV("img", { src: I.appicon, style: { width: 24, height: 24, borderRadius: 6 }, alt: "" }, void 0, false, {
              fileName: "D:/AI网站/shubao/shubao-final.jsx",
              lineNumber: 614,
              columnNumber: 91
            }, this),
            /* @__PURE__ */ jsxDEV("span", { style: { fontSize: 14, fontWeight: 700, fontFamily: "PingFang SC,Microsoft YaHei,sans-serif" }, children: "薯包AI" }, void 0, false, {
              fileName: "D:/AI网站/shubao/shubao-final.jsx",
              lineNumber: 614,
              columnNumber: 172
            }, this)
          ] }, void 0, true, {
            fileName: "D:/AI网站/shubao/shubao-final.jsx",
            lineNumber: 614,
            columnNumber: 11
          }, this),
          /* @__PURE__ */ jsxDEV("p", { style: { fontSize: 12, color: "#999", lineHeight: 1.8, margin: 0 }, children: "专注小红书内容创作的AI工具。覆盖旅游攻略、好物评测、美食探店、穿搭分享、学习干货等热门赛道。AI智能生成爆款标题、种草文案和精美配图，一键生成可直接发布的小红书爆款笔记。" }, void 0, false, {
            fileName: "D:/AI网站/shubao/shubao-final.jsx",
            lineNumber: 615,
            columnNumber: 11
          }, this)
        ] }, void 0, true, {
          fileName: "D:/AI网站/shubao/shubao-final.jsx",
          lineNumber: 613,
          columnNumber: 9
        }, this),
        /* @__PURE__ */ jsxDEV("div", { style: { flex: "0 0 auto" }, children: [
          /* @__PURE__ */ jsxDEV("div", { style: { fontSize: 12, fontWeight: 600, marginBottom: 8 }, children: "产品" }, void 0, false, {
            fileName: "D:/AI网站/shubao/shubao-final.jsx",
            lineNumber: 618,
            columnNumber: 11
          }, this),
          /* @__PURE__ */ jsxDEV("div", { style: { fontSize: 11, color: "#999", lineHeight: 2 }, children: [
            /* @__PURE__ */ jsxDEV("span", { style: { cursor: "pointer" }, onClick: () => setPg("gallery"), children: "薯包出品" }, void 0, false, {
              fileName: "D:/AI网站/shubao/shubao-final.jsx",
              lineNumber: 619,
              columnNumber: 71
            }, this),
            /* @__PURE__ */ jsxDEV("br", {}, void 0, false, {
              fileName: "D:/AI网站/shubao/shubao-final.jsx",
              lineNumber: 619,
              columnNumber: 151
            }, this),
            /* @__PURE__ */ jsxDEV("span", { style: { cursor: "pointer" }, onClick: () => setPg("pricing"), children: "价格方案" }, void 0, false, {
              fileName: "D:/AI网站/shubao/shubao-final.jsx",
              lineNumber: 619,
              columnNumber: 157
            }, this),
            /* @__PURE__ */ jsxDEV("br", {}, void 0, false, {
              fileName: "D:/AI网站/shubao/shubao-final.jsx",
              lineNumber: 619,
              columnNumber: 237
            }, this),
            /* @__PURE__ */ jsxDEV("span", { style: { cursor: "pointer" }, onClick: () => setPg("works"), children: "我的作品" }, void 0, false, {
              fileName: "D:/AI网站/shubao/shubao-final.jsx",
              lineNumber: 619,
              columnNumber: 243
            }, this)
          ] }, void 0, true, {
            fileName: "D:/AI网站/shubao/shubao-final.jsx",
            lineNumber: 619,
            columnNumber: 11
          }, this)
        ] }, void 0, true, {
          fileName: "D:/AI网站/shubao/shubao-final.jsx",
          lineNumber: 617,
          columnNumber: 9
        }, this),
        /* @__PURE__ */ jsxDEV("div", { style: { flex: "0 0 auto" }, children: [
          /* @__PURE__ */ jsxDEV("div", { style: { fontSize: 12, fontWeight: 600, marginBottom: 8 }, children: "关键词" }, void 0, false, {
            fileName: "D:/AI网站/shubao/shubao-final.jsx",
            lineNumber: 622,
            columnNumber: 11
          }, this),
          /* @__PURE__ */ jsxDEV("div", { style: { fontSize: 11, color: "#ccc", lineHeight: 2 }, children: [
            "小红书图文生成 · AI种草笔记",
            /* @__PURE__ */ jsxDEV("br", {}, void 0, false, {
              fileName: "D:/AI网站/shubao/shubao-final.jsx",
              lineNumber: 623,
              columnNumber: 87
            }, this),
            "爆款内容创作 · 小红书配图",
            /* @__PURE__ */ jsxDEV("br", {}, void 0, false, {
              fileName: "D:/AI网站/shubao/shubao-final.jsx",
              lineNumber: 623,
              columnNumber: 107
            }, this),
            "干货笔记 · 一键生成图文"
          ] }, void 0, true, {
            fileName: "D:/AI网站/shubao/shubao-final.jsx",
            lineNumber: 623,
            columnNumber: 11
          }, this)
        ] }, void 0, true, {
          fileName: "D:/AI网站/shubao/shubao-final.jsx",
          lineNumber: 621,
          columnNumber: 9
        }, this)
      ] }, void 0, true, {
        fileName: "D:/AI网站/shubao/shubao-final.jsx",
        lineNumber: 612,
        columnNumber: 7
      }, this),
      /* @__PURE__ */ jsxDEV("div", { style: { textAlign: "center", fontSize: 10, color: "#e0e0e0", marginTop: 20 }, children: "© 2026 薯包AI · 小红书爆款图文一键AI生成工具" }, void 0, false, {
        fileName: "D:/AI网站/shubao/shubao-final.jsx",
        lineNumber: 626,
        columnNumber: 7
      }, this)
    ] }, void 0, true, {
      fileName: "D:/AI网站/shubao/shubao-final.jsx",
      lineNumber: 611,
      columnNumber: 5
    }, this),
    css(),
    loginModal,
    priceModal
  ] }, void 0, true, {
    fileName: "D:/AI网站/shubao/shubao-final.jsx",
    lineNumber: 535,
    columnNumber: 10
  }, this);
}
_s6(App, "YcRac7j1mX6QoHI5GZQOVmpRelE=");
_c8 = App;
var _c, _c2, _c3, _c4, _c5, _c6, _c7, _c8;
$RefreshReg$(_c, "Btn");
$RefreshReg$(_c2, "CopyBtn");
$RefreshReg$(_c3, "Card");
$RefreshReg$(_c4, "CharImg");
$RefreshReg$(_c5, "Modal");
$RefreshReg$(_c6, "ResultDisplay");
$RefreshReg$(_c7, "GCard");
$RefreshReg$(_c8, "App");
if (import.meta.hot && !inWebWorker) {
  window.$RefreshReg$ = prevRefreshReg;
  window.$RefreshSig$ = prevRefreshSig;
}
if (import.meta.hot && !inWebWorker) {
  RefreshRuntime.__hmr_import(import.meta.url).then((currentExports) => {
    RefreshRuntime.registerExportsForReactRefresh("D:/AI网站/shubao/shubao-final.jsx", currentExports);
    import.meta.hot.accept((nextExports) => {
      if (!nextExports) return;
      const invalidateMessage = RefreshRuntime.validateRefreshBoundaryAndEnqueueUpdate("D:/AI网站/shubao/shubao-final.jsx", currentExports, nextExports);
      if (invalidateMessage) import.meta.hot.invalidate(invalidateMessage);
    });
  });
}

//# sourceMappingURL=data:application/json;base64,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O0FBQUE7QUFBQSxZQUFnQix1QkFBQyxVQUFEO0FBQUE7QUFBQTtBQUFBO0FBQUEsbUJBQUc7QUFBQSxZQUFFO0FBQUEsWUFBYyx1QkFBQyxVQUFEO0FBQUE7QUFBQTtBQUFBO0FBQUEsbUJBQUc7QUFBQSxZQUFFO0FBQUEsZUFBN0Y7QUFBQTtBQUFBO0FBQUE7QUFBQSxpQkFBMEc7QUFBQSxhQUY1RztBQUFBO0FBQUE7QUFBQTtBQUFBLGVBR0E7QUFBQSxXQVpGO0FBQUE7QUFBQTtBQUFBO0FBQUEsYUFhQTtBQUFBLE1BQ0EsdUJBQUMsU0FBSSxPQUFPLEVBQUNyQyxXQUFVLFVBQVNGLFVBQVMsSUFBR0ssT0FBTSxXQUFVNEksV0FBVSxHQUFFLEdBQUcsNkNBQTNFO0FBQUE7QUFBQTtBQUFBO0FBQUEsYUFBd0c7QUFBQSxTQWYxRztBQUFBO0FBQUE7QUFBQTtBQUFBLFdBZ0JBO0FBQUEsSUFFRHhCLElBQUk7QUFBQSxJQUFHckM7QUFBQUEsSUFBWUM7QUFBQUEsT0E5RmI7QUFBQTtBQUFBO0FBQUE7QUFBQSxTQThGd0I7QUFDakM7QUFBQzZFLElBOVN1QkQsS0FBRztBQUFBLE1BQUhBO0FBQUcsSUFBQThFLElBQUFDLEtBQUFDLEtBQUF4TSxLQUFBVSxLQUFBK0wsS0FBQUMsS0FBQUM7QUFBQSxhQUFBTCxJQUFBO0FBQUEsYUFBQUMsS0FBQTtBQUFBLGFBQUFDLEtBQUE7QUFBQSxhQUFBeE0sS0FBQTtBQUFBLGFBQUFVLEtBQUE7QUFBQSxhQUFBK0wsS0FBQTtBQUFBLGFBQUFDLEtBQUE7QUFBQSxhQUFBQyxLQUFBIiwibmFtZXMiOlsiUmVhY3QiLCJ1c2VTdGF0ZSIsInVzZUVmZmVjdCIsInVzZVJlZiIsInVzZU1lbW8iLCJTcGFya2xlcyIsIkNvcHkiLCJDaGVjayIsIlJlZnJlc2hDdyIsIlVzZXIiLCJaYXAiLCJJbWFnZSIsIkltZyIsIkZpbGVUZXh0IiwiSGFzaCIsIkNsb2NrIiwiQXJyb3dMZWZ0IiwiQXJyb3dSaWdodCIsIkhlYXJ0IiwiRXllIiwiTG9nSW4iLCJDcmVkaXRDYXJkIiwiQm9va21hcmsiLCJSb3RhdGVDY3ciLCJDaGV2cm9uUmlnaHQiLCJFeHRlcm5hbExpbmsiLCJTdGFyIiwiVGFyZ2V0IiwiTGF5ZXJzIiwiTW91c2VQb2ludGVyQ2xpY2siLCJTaGllbGRDaGVjayIsIlBhbGV0dGUiLCJNYXhpbWl6ZTIiLCJEb3dubG9hZCIsIlgiLCJMb2FkZXIyIiwiTm90ZU1vZGFsIiwiX2IiLCJuIiwiVVJMIiwiaW1wb3J0IiwidXJsIiwiaHJlZiIsIkkiLCJzMSIsInMyIiwiczMiLCJzNCIsInM1Iiwid2F2ZSIsInN0YW5kIiwiZXhjaXRlZCIsImhhcHB5IiwiYXBwaWNvbiIsIndlbGNvbWUiLCJ0aGluayIsInVwZ3JhZGUiLCJsb2FkaW5nIiwicmVzdWx0IiwicHVibGlzaCIsInRpcCIsImJhbm5lciIsImlkZWEiLCJzdWNjZXNzIiwicHJvdGVjdCIsInNjZW5lIiwid2FsayIsImp1bXAiLCJyZWFkeSIsInNpdCIsInN1cmYiLCJtZWRpdGF0ZSIsImNvb2siLCJkYW5jZSIsImRvbmUiLCJzdXBlcmhlcm8iLCJjdXJhdG9yIiwiaW5zcGVjdCIsInBob3RvZ3JhcGhlciIsImxpZnQiLCJlbXB0eSIsImVycm9yIiwiY3Jhc2giLCJzbGVlcCIsImxvZ29fbGciLCJwYWludCIsImFuYWx5emUiLCJSIiwiUjIiLCJHIiwiQkciLCJBUEkiLCJfSU1HIiwiaWQiLCJmaWxlIiwiR0FMTEVSWSIsInRpdGxlIiwiY2F0IiwiZ3JhZCIsImxpa2VzIiwiYm9keSIsInRhZ3MiLCJoaW50IiwiY292ZXJfdXJsIiwiaW1hZ2VfdXJscyIsIm1hcCIsIlFVSUNLX0hJTlRTIiwiUFJJQ0lORyIsIm5hbWUiLCJwcmljZSIsInNldHMiLCJyZWdlbiIsImRlc2MiLCJwZXIiLCJwb3AiLCJUSVBTIiwiQ0hBUl9DWUNMRSIsIlNUQUdFUyIsImltZyIsImxhYmVsIiwiRkVBVFVSRVMiLCJpY29uIiwiZ2VuQVBJIiwidCIsIm9uSW1nIiwib25Qcm9nIiwiciIsImZldGNoIiwibWV0aG9kIiwiaGVhZGVycyIsIkpTT04iLCJzdHJpbmdpZnkiLCJ0ZXh0Iiwib2siLCJlIiwiY2F0Y2giLCJzdGF0dXNUZXh0IiwiRXJyb3IiLCJzbGljZSIsInJlYWRlciIsImdldFJlYWRlciIsImRlYyIsIlRleHREZWNvZGVyIiwiYnVmIiwidmFsdWUiLCJyZWFkIiwiZGVjb2RlIiwic3RyZWFtIiwibGluZXMiLCJzcGxpdCIsIlN0cmluZyIsImZyb21DaGFyQ29kZSIsImxpbmUiLCJzdGFydHNXaXRoIiwiZCIsInBhcnNlIiwidHlwZSIsInB1c2giLCJPYmplY3QiLCJhc3NpZ24iLCJpbWFnZV9jb3VudCIsImxlbmd0aCIsInNhdmVXb3JrIiwidyIsImxvY2FsIiwibG9jYWxTdG9yYWdlIiwiZ2V0SXRlbSIsImlkeCIsImZpbmRJbmRleCIsIngiLCJfaW5wdXRUZXh0IiwiYXQiLCJ1bnNoaWZ0IiwiRGF0ZSIsIm5vdyIsInRvTG9jYWxlRGF0ZVN0cmluZyIsInNldEl0ZW0iLCJ3b3JrIiwiY29uc29sZSIsIndhcm4iLCJtZXNzYWdlIiwiUHJvbWlzZSIsInNldFRpbWVvdXQiLCJlMiIsImxvYWRXb3JrcyIsImpzb24iLCJzayIsIlNldCIsIm1pc3NpbmciLCJmaWx0ZXIiLCJfc2F2ZUtleSIsImhhcyIsImdldFB0cyIsInBhcnNlSW50Iiwic2V0UHRzIiwicyIsImNhcmQiLCJiYWNrZ3JvdW5kIiwiYm9yZGVyUmFkaXVzIiwiYm9yZGVyIiwib3ZlcmZsb3ciLCJjYXJkUCIsInBhZGRpbmciLCJzZWN0aW9uIiwibWF4V2lkdGgiLCJtYXJnaW4iLCJzZWN0aW9uVGl0bGUiLCJmb250U2l6ZSIsImZvbnRXZWlnaHQiLCJ0ZXh0QWxpZ24iLCJmb250RmFtaWx5Iiwic2VjdGlvblN1YiIsImNvbG9yIiwiQnRuIiwiY2hpbGRyZW4iLCJwcmltYXJ5Iiwic21hbGwiLCJvbkNsaWNrIiwiZGlzYWJsZWQiLCJmdWxsIiwic3giLCJfcyIsImgiLCJzZXRIIiwiZGlzcGxheSIsImFsaWduSXRlbXMiLCJqdXN0aWZ5Q29udGVudCIsImdhcCIsImN1cnNvciIsInRyYW5zaXRpb24iLCJ0cmFuc2Zvcm0iLCJ3aWR0aCIsImJveFNoYWRvdyIsIkNvcHlCdG4iLCJfczIiLCJzZXRPayIsIm5hdmlnYXRvciIsImNsaXBib2FyZCIsIndyaXRlVGV4dCIsIkNhcmQiLCJob3ZlciIsIl9zMyIsIkNoYXJJbWciLCJzcmMiLCJhbHQiLCJzdHlsZSIsImxpbmVIZWlnaHQiLCJvYmplY3RGaXQiLCJfYzQiLCJNb2RhbCIsIm9uQ2xvc2UiLCJwb3NpdGlvbiIsImluc2V0IiwiekluZGV4IiwiYmFja2Ryb3BGaWx0ZXIiLCJhbmltYXRpb24iLCJzdG9wUHJvcGFnYXRpb24iLCJtYXhIZWlnaHQiLCJfYzUiLCJkb3dubG9hZFppcCIsImNvdmVyVXJsIiwiaW1hZ2VVcmxzIiwiYm9keVRleHQiLCJoYXNodGFncyIsImFsZXJ0IiwiSlNaaXAiLCJkZWZhdWx0IiwiemlwIiwiYWxsIiwiQm9vbGVhbiIsInRleHRDb250ZW50Iiwiam9pbiIsInJlc3VsdHMiLCJpIiwicmVzcCIsImVuY29kZVVSSUNvbXBvbmVudCIsImJsb2IiLCJmb3JFYWNoIiwiY29udGVudCIsImdlbmVyYXRlQXN5bmMiLCJsaW5rIiwiZG9jdW1lbnQiLCJjcmVhdGVFbGVtZW50IiwiY3JlYXRlT2JqZWN0VVJMIiwiZG93bmxvYWQiLCJjbGljayIsInJldm9rZU9iamVjdFVSTCIsIlJlc3VsdERpc3BsYXkiLCJsb2dnZWQiLCJvbkxvZ2luIiwib25QcmljZSIsImxvZ2luTW9kYWwiLCJwcmljZU1vZGFsIiwidGV4dFJlZ2VuIiwic2V0UmVzdWx0Iiwic2V0R2VuIiwiX3M0IiwiaW1nSWR4Iiwic2V0SW1nSWR4Iiwiem9vbSIsInNldFpvb20iLCJyZ0lkeCIsInNldFJnSWR4IiwiYWxsSW1hZ2VzIiwiYSIsInBhZ2VzIiwiY3VyUGFnZSIsIm1heEkiLCJrZXkiLCJNYXRoIiwibWF4IiwicHJldmVudERlZmF1bHQiLCJtaW4iLCJ3aW5kb3ciLCJhZGRFdmVudExpc3RlbmVyIiwicmVtb3ZlRXZlbnRMaXN0ZW5lciIsInJlZ2VuU2luZ2xlIiwiY29uZmlybSIsInByb21wdCIsImNvdmVyX3Byb21wdCIsInBpIiwiaW1hZ2VfcHJvbXB0cyIsImZpbmQiLCJwIiwicGFnZV9pZCIsInByZXYiLCJ1IiwiQyIsImNzcyIsIm1pbkhlaWdodCIsImxlZnQiLCJ0b3AiLCJoZWlnaHQiLCJ0YXJnZXQiLCJyaWdodCIsImJvdHRvbSIsIndoaXRlU3BhY2UiLCJjYXRlZ29yeSIsImF1ZGllbmNlIiwiYm9keV90ZXh0IiwiZmxleCIsImN1cnJlbnRUYXJnZXQiLCJxdWVyeVNlbGVjdG9yQWxsIiwiYiIsIm9wYWNpdHkiLCJhc3BlY3RSYXRpbyIsImhvb2siLCJ0ZXh0U2hhZG93IiwicG9pbnRlckV2ZW50cyIsImluZm9fYmxvY2tzIiwiZmxleFdyYXAiLCJmb250U3R5bGUiLCJtYXJnaW5Ub3AiLCJvdmVyZmxvd1giLCJwYWRkaW5nQm90dG9tIiwibWluV2lkdGgiLCJtYXJnaW5Cb3R0b20iLCJtYXJnaW5MZWZ0IiwicGFnZV90eXBlIiwibGF5b3V0X2hpbnQiLCJzdG9yeSIsImVtb2ppIiwicGciLCJHQ2FyZCIsIml0ZW0iLCJfczUiLCJXZWJraXRMaW5lQ2xhbXAiLCJXZWJraXRCb3hPcmllbnQiLCJBcHAiLCJfczYiLCJzZXRQZyIsInNldExvZ2dlZCIsInNob3dMb2dpbiIsInNldFNob3dMb2dpbiIsInNob3dQcmljZSIsInNldFNob3dQcmljZSIsInNldFRleHQiLCJnZW4iLCJzdGFnZSIsInNldFN0YWdlIiwid29ya3MiLCJzZXRXb3JrcyIsInB0cyIsInNldFB0c1MiLCJyZWdlblN0YXRlIiwic2V0UmVnZW5TdGF0ZSIsImFjdGl2ZSIsIm1zZyIsImxhc3RXb3JrSWRSZWYiLCJjdXJyZW50IiwiZWwiLCJnZXRFbGVtZW50QnlJZCIsImFwcGVuZENoaWxkIiwiY3NzVGV4dCIsImlubmVySFRNTCIsInRpcElkeCIsInNldFRpcElkeCIsImFQZyIsInNldEFQZyIsImdJdGVtIiwic2V0R0l0ZW0iLCJlcnIiLCJzZXRFcnIiLCJjYXJvdXNlbElkeCIsInNldENhcm91c2VsSWR4IiwiZnJlZVVzZWQiLCJ0bSIsInRoZW4iLCJzZXRJbnRlcnZhbCIsImNsZWFySW50ZXJ2YWwiLCJkb0dlbiIsInRyaW0iLCJjbGVhclRpbWVvdXQiLCJpbml0IiwibnAiLCJ3ZCIsImlucCIsIm92IiwiZDIiLCJyZW1vdmUiLCJuYXYiLCJib3JkZXJCb3R0b20iLCJsZXR0ZXJTcGFjaW5nIiwiayIsInYiLCJib3hTaXppbmciLCJvdXRsaW5lIiwiZmxleERpcmVjdGlvbiIsInN0IiwiY2hhcktleSIsInJlcGxhY2UiLCJfIiwid29ya0lkIiwid2lkIiwibnciLCJncmlkVGVtcGxhdGVDb2x1bW5zIiwiZyIsInJlc2l6ZSIsImJvcmRlckNvbG9yIiwicGFkZGluZ1RvcCIsImYiLCJJY29uIiwiYmciLCJzY3JvbGxUbyIsImJlaGF2aW9yIiwiYm9yZGVyVG9wIiwiX2MiLCJfYzIiLCJfYzMiLCJfYzYiLCJfYzciLCJfYzgiXSwiaWdub3JlTGlzdCI6W10sInNvdXJjZXMiOlsic2h1YmFvLWZpbmFsLmpzeCJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgUmVhY3QsIHsgdXNlU3RhdGUsIHVzZUVmZmVjdCwgdXNlUmVmLCB1c2VNZW1vIH0gZnJvbSBcInJlYWN0XCI7XHJcbmltcG9ydCB7IFNwYXJrbGVzLCBDb3B5LCBDaGVjaywgUmVmcmVzaEN3LCBVc2VyLCBaYXAsIEltYWdlIGFzIEltZywgRmlsZVRleHQsIEhhc2gsIENsb2NrLCBBcnJvd0xlZnQsIEFycm93UmlnaHQsIEhlYXJ0LCBFeWUsIExvZ0luLCBDcmVkaXRDYXJkLCBCb29rbWFyaywgUm90YXRlQ2N3LCBDaGV2cm9uUmlnaHQsIEV4dGVybmFsTGluaywgU3RhciwgVGFyZ2V0LCBMYXllcnMsIE1vdXNlUG9pbnRlckNsaWNrLCBTaGllbGRDaGVjaywgUGFsZXR0ZSwgTWF4aW1pemUyLCBEb3dubG9hZCwgWCwgTG9hZGVyMiB9IGZyb20gXCJsdWNpZGUtcmVhY3RcIjtcclxuaW1wb3J0IE5vdGVNb2RhbCBmcm9tICcuL3NyYy9Ob3RlTW9kYWwuanN4JztcclxuXHJcbmNvbnN0IF9iPShuKT0+bmV3IFVSTCgnL2ltYWdlcy8nK24saW1wb3J0Lm1ldGEudXJsKS5ocmVmO1xyXG5jb25zdCBJPXtzMTpfYign5YeG5aSH5aW95LqG5ZCX77yfLnBuZycpLHMyOl9iKCfop4bop5LmjKXmiYsucG5nJyksczM6X2IoJ+S+p+mdouihjOi1sC5wbmcnKSxzNDpfYign5Z2Q552ALnBuZycpLHM1Ol9iKCfot7Pot4PlhbTlpYsucG5nJyksXHJcbiAgd2F2ZTpfYign6KeG6KeS5oyl5omLLnBuZycpLHN0YW5kOl9iKCflhpnkvZwucG5nJyksZXhjaXRlZDpfYign6Lez6LeD5YW05aWLLnBuZycpLGhhcHB5Ol9iKCfnu5jnlLsucG5nJyksXHJcbiAgYXBwaWNvbjpfYignY3JvcHBlZC5wbmcnKSx3ZWxjb21lOl9iKCfmrKLov47lhYnkuLQucG5nJyksdGhpbms6X2IoJ+edoeiniS5wbmcnKSx1cGdyYWRlOl9iKCfljYfnuqfmj5DnpLoucG5nJyksXHJcbiAgbG9hZGluZzpfYign5Li+6YeNLnBuZycpLHJlc3VsdDpfYign54O56aWqLnBuZycpLHB1Ymxpc2g6X2IoJ+WGpeaDsy5wbmcnKSx0aXA6X2IoJ+i3s+iIni5wbmcnKSxcclxuICBiYW5uZXI6X2IoJ+i2hee6p+iLsembhC5wbmcnKSxpZGVhOl9iKCfnlLvlu4rnrZblsZXkuroucG5nJyksc3VjY2VzczpfYign5om55YeG5Y2w56ugLnBuZycpLHByb3RlY3Q6X2IoJ+aRhOW9seW4iC5wbmcnKSxcclxuICBzY2VuZTpfYign5bCP6Jav5YyFLnBuZycpLHdhbGs6X2IoJ+S+p+mdouihjOi1sC5wbmcnKSwnd2F2ZS1oYW5kJzpfYign6KeG6KeS5oyl5omLLnBuZycpLGp1bXA6X2IoJ+i3s+i3g+WFtOWliy5wbmcnKSxcclxuICByZWFkeTpfYign5YeG5aSH5aW95LqG5ZCX77yfLnBuZycpLHNpdDpfYign5Z2Q552ALnBuZycpLHN1cmY6X2IoJ+WGsua1qi5wbmcnKSxtZWRpdGF0ZTpfYign5Yal5oOzLnBuZycpLFxyXG4gIGNvb2s6X2IoJ+eDuemlqi5wbmcnKSxkYW5jZTpfYign6Lez6IieLnBuZycpLGRvbmU6X2IoJ+WujOaIkC5wbmcnKSxzdXBlcmhlcm86X2IoJ+i2hee6p+iLsembhC5wbmcnKSxcclxuICBjdXJhdG9yOl9iKCfnlLvlu4rnrZblsZXkuroucG5nJyksaW5zcGVjdDpfYign5qOA5p+lLnBuZycpLHBob3RvZ3JhcGhlcjpfYign5pGE5b2x5biILnBuZycpLGxpZnQ6X2IoJ+S4vumHjS5wbmcnKSxcclxuICBlbXB0eTpfYign56m654q25oCBLnBuZycpLGVycm9yOl9iKCfplJnor6/nirbmgIEucG5nJyksY3Jhc2g6X2IoJ+W0qea6gy5wbmcnKSxzbGVlcDpfYign552h6KeJLnBuZycpLFxyXG4gIGxvZ29fbGc6X2IoJ0xPR08ucG5nJykscGFpbnQ6X2IoJ+e7mOeUuy5wbmcnKSxhbmFseXplOl9iKCfliIbmnpAucG5nJyksfTtcclxuXHJcbmNvbnN0IFI9XCIjRkY0NzU3XCIsUjI9XCIjRkY2QjgxXCIsRz1cIiM3RUM4ODJcIixCRz1cIiNGRkZBRjlcIjtcclxuXHJcbmNvbnN0IEFQST0naHR0cDovL2xvY2FsaG9zdDozMDk5JztcclxuY29uc3QgX0lNRz0oaWQsZmlsZSk9PkFQSSsnL2FwaS9nYWxsZXJ5LWltYWdlP2lkPScraWQrJyZmaWxlPScrZmlsZTtcclxuY29uc3QgR0FMTEVSWT1be2lkOid4bScsdGl0bGU6J+eGrOWknOaAu+e7k/CflKXljqbpl6gz5aSpMuWknOeyvuWNjuaUu+eVpe+8geS6uuWdhzgwMCvnjqnliLDniL3vvIEnLGNhdDon5peF5ri45pS755WlJyxncmFkOidsaW5lYXItZ3JhZGllbnQoMTM1ZGVnLCNGRjZCMzUsI0Y3QzU5RiknLGxpa2VzOjM4OTAsYm9keTon6LCB5oeC5ZWK77yB5LmL5YmN5Y675Y6m6Zeo546p5LiJ5aSp5Lik5aSc77yM5Zue5p2l6KKr6Zeu5LqGODAw6YGN5pS755Wl77yB5LuK5aSp54as5aSc5biu5ZCE5L2N5oC757uT5aW977yM5Lq65Z2HODAw5bem5Y+z5bCx6IO9546p5b6X6LaF5ruh6Laz772eXFxuXFxu4pyF6KGM56iL5qaC6KeIXFxuRDHvvJrpvJPmtarlsb/lhajlpKnvvIjml6XlhYnlsqnjgIHoj73luoToirHlm63jgIHpvpnlpLTot6/lsI/lkIPvvIlcXG5EMu+8muWOpumXqOWkp+WtpivljZfmma7pmYDlr7or5rKZ5Z2h5bC+6Im65pyv6KW/5Yy6K+eMq+ihl1xcbkQz77ya6buE5Y6d5rKZ5rup5pel5Ye6K+abvuWOneWetSvnjq/lspvot6/pqpHooYxcXG5cXG7wn5Kw6aKE566X5riF5Y2V77yI5Lq65Z2H77yJXFxu5Lqk6YCa77ya57qmMjAw77yI6auY6ZOBK+Wym+WGheWFrOS6pO+8iVxcbuS9j+Wuv++8mue6pjMwMO+8iOS4pOaZmuawkeWuv++8jOaPkOWJjeiuou+8iVxcbumXqOelqO+8mue6pjgw77yI6byT5rWq5bG/6Ii556WoK+aXpeWFieWyqe+8iVxcbue+jumjn++8mue6pjIyMO+8iOaymeiMtumdouOAgea1t+ibjueFjuOAgeWnnOavjem4reetie+8iVxcbuaAu+iuoe+8mue6pjgwMOi1t++8jOS4sOS/reeUseS6ulxcblxcbuKaoO+4j+WunueUqFRpcHNcXG4x77iP4oOjIOm8k+a1quWxv+iIueelqOaPkOWJjTPlpKnlnKjjgIzljqbpl6jova7muKHjgI3lhazkvJflj7fkubDvvIzkurrlpJrml7bnp5LmsqHvvIFcXG4y77iP4oOjIOWOpuWkp+mcgOmihOe6pu+8jOWRqOacq+mavue6pu+8jOW7uuiuruW3peS9nOaXpeWOu+OAglxcbjPvuI/ig6Mg5pu+5Y6d5Z615bCP5ZCD5LiN6Lip6Zu35o6o6I2Q77ya6Zi/5p2w5LqU6aaZ44CB5YWr5amG5amG54On5LuZ6I2J44CCXFxuNO+4j+KDoyDnjq/lspvot6/np5/nlLXliqjovabnuqYzMOWFgy/lsI/ml7bvvIzlkLnmtbfpo47otoXoiJLmnI3vvZ5cXG5cXG7lrrbkurrku6zvvIzotbbntKflrZjkuIvmnaXvvIzlkajmnKvlsLHlh7rlj5HvvIHkuIDotbfnnIvmtbflkIPmspnojLbpnaLvvIHwn4yKJyx0YWdzOlsnI+WOpumXqOaXhea4uCcsJyPljqbpl6jmlLvnlaUnLCcj5peF5ri45pS755WlJywnIzPlpKky5aScJywnI+S6uuWdhzgwMCddLGhpbnQ6J+WOpumXqOaXhea4uOaUu+eVpScsY292ZXJfdXJsOl9JTUcoJ3htJywnMDEt5bCB6Z2iLnBuZycpLGltYWdlX3VybHM6WzIsMyw0LDUsNiw3LDgsOV0ubWFwKG49Pl9JTUcoJ3htJywnMCcrbisnLnBuZycpKX0se2lkOidlcCcsdGl0bGU6J+Wunua1izXmrL7nmb7lhYPok53niZnogLPmnLrwn5Sl6Zet55y85YWl5LiN6Lip6Zu3JyxjYXQ6J+WlveeJqeivhOa1iycsZ3JhZDonbGluZWFyLWdyYWRpZW50KDEzNWRlZywjM0I4MkY2LCM2MzY2RjEpJyxsaWtlczoyMjkwLGJvZHk6J+WutuS6uuS7rOiwgeaHguWViu+8geaDs+S5sOS4queZvuWFg+iTneeJmeiAs+acuueci+iKseecvO+8n+aIkeW4ruS9oOWunua1i+S6hjXmrL7ng63pl6jmrL7vvIznm7TmjqXmioTkvZzkuJrvvIFcXG5cXG7wn46nIOa8q+atpeiAhVgy77ya57qmMTAw5YWD77yM6Z+z6LSo5Z2H6KGh77yM57ut6IiqNuWwj+aXtu+8jOS9qeaItOiIkumAgu+8jOWFpemXqOmmlumAieOAglxcbvCfjqcg5bCP57GzQWlyMiBTRe+8mue6pjEyMOWFg++8jOS9jumfs+W8uuWKsu+8jOinpuaOp+eBteaVj++8jOmAguWQiOWQrOa1geihjOOAglxcbvCfjqcg57u/6IGUSGlUdW5l77ya57qmOTDlhYPvvIznu63oiKo35bCP5pe277yM6ZmN5Zmq5oSP5aSW5aW977yM5oCn5Lu35q+U54K46KOC44CCXFxu8J+OpyDlgI3mgJ1XTTAx77ya57qmODDlhYPvvIzljYrlhaXogLPorr7orqHvvIzpgJror53muIXmmbDvvIzpgILlkIjov5DliqjjgIJcXG7wn46nIOe9keaYk+S6keiTneeJmeiAs+acuu+8mue6pjExMOWFg++8jOWkluingua9ru+8jOmfs+i0qOS4reinhOS4reefqe+8jOmAguWQiOminOaOp+OAglxcblxcbuaAu+e7k++8mueZvuWFg+S7t+S9jemmlumAiea8q+atpeiAhVgy77yM6aKE566X57Sn5byg6YCJ5YCN5oCdV00wMeOAguW/q+iJvueJueS9oOeahOWGpOenjemXuuicnOS4gOi1t+aKhOS9nOS4mu+8gScsdGFnczpbJyPok53niZnogLPmnLrmjqjojZAnLCcj55m+5YWD6ICz5py6JywnI+aVsOeggeWlveeJqScsJyPlrabnlJ/lhZrlv4XlpIcnXSxoaW50Oifnmb7lhYPok53niZnogLPmnLrmjqjojZAnLGNvdmVyX3VybDpfSU1HKCdlcCcsJzAxLeWwgemdoi5wbmcnKSxpbWFnZV91cmxzOlsyLDMsNCw1LDYsNyw4LDldLm1hcChuPT5fSU1HKCdlcCcsJzAnK24rJy5wbmcnKSl9LHtpZDonY3JhYicsdGl0bGU6J+S6uuWdhzgw5ZCD5bid546L6J+58J+mgO+8n+i/meWutuWkp+aOkuaho+S5n+WkqueLoOS6huWQp++8gScsY2F0Oifnvo7po5/mjqLlupcnLGdyYWQ6J2xpbmVhci1ncmFkaWVudCgxMzVkZWcsI0Y5NzMxNiwjRkJCRjI0KScsbGlrZXM6NDUyMyxib2R5OifosIHmh4LllYrvvIHku6XliY3mgLvop4nlvpfmtbfpspzlpKfmjpLmoaPlj4jotLXlj4jlnZHvvIznu5Pmnpzooqvpl7ronJzmi4nljrvlkIPkuobkuIDpob/vvIznm7TmjqXliLfmlrDorqTnn6Xwn5ix77yB5Lq65Z2H5omNODDlt6blj7PvvIzlsLHog73ngqvliLDmlbTlj6rluJ3njovon7nvvIzov5jmnInlkITnp43pspzmtLvmtbfpspzvvIzmgKfku7fmr5Tngrjoo4LvvIFcXG5cXG7wn6aA44CQ5oub54mM5bid546L6J+544CRXFxu5pW05Y+q5riF6JK45oiW6YG/6aOO5aGY5YGa5rOV77yM6IKJ6LSo6bKc55ScUeW8ue+8jOifuem7hOa7oea7oe+8geS4gOS7vee6pjTmlqTvvIzotrPlpJ8zLTTkurrlkIPvvIzljZXngrnku7fmoLznuqYyODDlhYPvvIzkurrlnYfmiY03MOWkmu+8gVxcblxcbvCfppDjgJDmpJLnm5Dnmq7nmq7omb7jgJFcXG7lj6rlj6rluKboho/vvIzmpJLnm5DlkbPotoXpppnvvIzlpJblo7PphaXohIbvvIzogonotKjntKflrp7jgILkuIDku73nuqY2OOWFg++8jOW/heeCue+8gVxcblxcbvCfpqrjgJDokpzok4nng6TnlJ/omp3jgJFcXG7njrDlvIDnjrDng6TvvIzokpzok4nphbHosIPlvpfnu53kuobvvIznlJ/omp3ogqXnvo7lpJrmsYHjgILkuIDmiZPnuqY1OOWFg++8jOaAp+S7t+avlOi2hemrmO+8gVxcblxcbvCflKXjgJDpgb/po47loZjngpLon7njgJFcXG7lpoLmnpzluJ3njovon7nlkIPohbvkuobvvIzov5jlj6/ku6Xngrnpgb/po47loZjngpLon7nvvIzpppnovqPlhaXlkbPvvIzplIXmsJTljYHotrPvvIzkuIDku73nuqYxMjjlhYPjgIJcXG5cXG7wn5Kh44CQ55yB6ZKxVGlwc+OAkVxcbuW7uuiuruS4i+WNiDTngrnliY3liLDlupfvvIzmnInml6npuJ/mipjmiaPvvJvkurrlpJrngrnlpZfppJDmm7TliJLnrpfvvIzkurrlnYfnuqY4MC0xMDDlhYPlsLHog73lkIPliLDmkpHvvIHov5jmnInlhY3otLnlgZzovabkvY3lk6bvvZ5cXG5cXG7lv6voib7nibnkvaDnmoTppa3mkK3lrZDvvIzlkajmnKvljrvov5nlrrblpKfmjpLmoaPlrp7njrDmtbfpspzoh6rnlLHlkKfvvIHwn6aA4pyoJyx0YWdzOlsnI+a1t+mynOWkp+aOkuahoycsJyPluJ3njovon7knLCcj5Lq65Z2HODAnLCcj576O6aOf5o6i5bqXJywnI+aAp+S7t+avlOa1t+mynCddLGhpbnQ6J+W4neeOi+ifueaOouW6l+aOqOiNkCcsY292ZXJfdXJsOl9JTUcoJ2NyYWInLCcwMS3lsIHpnaIucG5nJyksaW1hZ2VfdXJsczpbMiwzLDQsNSw2LDcsOCw5XS5tYXAobj0+X0lNRygnY3JhYicsJzAnK24rJy5wbmcnKSl9LF07XHJcbmNvbnN0IFFVSUNLX0hJTlRTPVtcIvCfk43ljqbpl6gz5aSpMuWknOaXhea4uOaUu+eVpVwiLFwi8J+Op+eZvuWFg+iTneeJmeiAs+acuua1i+ivhFwiLFwi8J+mgOa1t+mynOWkp+aOkuaho+S6uuWdhzgw5ZCD5bid546L6J+5XCIsXCLwn46ASkvnqb/mkK3liIbkuqtcIixcIvCfpJbmnIDmlrBBSeW3peWFt+aOqOiNkOWQiOmbhlwiLFwi8J+TmuiAg+eglOiLseivrTg15YiG5pa55rOVXCIsXCLwn5uP77iPMzAw5YWD5Ye656ef5bGL5pS56YCg5pS755WlXCIsXCLwn6e0MjXlsoHnsr7nroDmiqTogqTmraXpqqRcIixcIvCfjbHkuIrnj63ml4815aSp5bim6aWt6aOf6LCxXCIsXCLwn4+L77iPMzDlpKnlsYXlrrbmma7mi4nmj5DorqHliJJcIixcIvCfqrQ1MDDlhYPmnoHnroDlrqLljoXmlLnpgKBcIixcIvCfjqwyMDI25b+F55yL5Zu95Lqn5Ymn5o6o6I2QXCIsXCLwn5Kw6KO46L6e5YGa6Ieq5aqS5L2T5pCe6ZKx5oCd6LevXCIsXCLwn5OW5pS55Y+Y6K6k55+l55qENuacrOWlveS5puaOqOiNkFwiXTtcclxuY29uc3QgUFJJQ0lORz1be25hbWU6XCLlhaXpl6hcIixwcmljZToxOSxzZXRzOjYscmVnZW46MyxkZXNjOlwi6YCC5ZCI5YG25bCU5Yib5L2cXCIscGVyOlwiMy4yXCJ9LHtuYW1lOlwi6L+b6Zi2XCIscHJpY2U6NDksc2V0czoxOCxyZWdlbjo1LHBvcDp0cnVlLGRlc2M6XCLkuKrkurrljZrkuLvpppbpgIlcIixwZXI6XCIyLjdcIn0se25hbWU6XCLliJvkvZzogIVcIixwcmljZTo4OSxzZXRzOjM4LHJlZ2VuOjgsZGVzYzpcIumrmOmikeWIm+S9nOiAhVwiLHBlcjpcIjIuM1wifSx7bmFtZTpcIuW3peS9nOWupFwiLHByaWNlOjE2OSxzZXRzOjgwLHJlZ2VuOjE1LGRlc2M6XCLlm6LpmJ/mibnph4/kvb/nlKhcIixwZXI6XCIyLjFcIn0sXTtcclxuY29uc3QgVElQUz1bXCLmoIfpopjluKbmlbDlrZfnmoTnrJTorrDvvIzngrnlh7vnjoflubPlnYfpq5jlh7o0NyVcIixcIuWPkeW4g+aXtumXtOW7uuiuru+8muWRqOWbmy/lkajkupTmmZrkuIo4LTnngrlcIixcIuato+aWh+WJjTPooYzlhrPlrpo4MCXnlKjmiLfmmK/lkKbnu6fnu63pmIXor7tcIixcIuavj+evh+eslOiusOW7uuiurjUtN+S4queyvuWHhuagh+etvlwiLFwi5bCB6Z2i5Zu+6YWN6Imy57uf5LiA5bqm55u05o6l5b2x5ZON6LSm5Y+36LCD5oCnXCIsXCLor4TorrrljLrkupLliqjnjofpq5jnmoTnrJTorrDmm7TlrrnmmJPooqvmjqjojZBcIixcIuW4puS7t+agvOeahOenjeiNieeslOiusOaUtuiXj+eOh+mrmOWHujYwJVwiLFwi5bmy6LSn56yU6K6w55qE55Sf5ZG95ZGo5pyf5q+U5pel5bi45YiG5Lqr6ZW/M+WAjVwiLFwi5bCP57qi5Lmm5rWB6YeP5rGg5o6o6I2Q5py65Yi25pyA5aSa5pyJOOWxglwiLFwi6KeG6aKR56yU6K6w5bmz5Z2H5LqS5Yqo546H5q+U5Zu+5paH6auYMjMlXCIsXCLpppblm77liqDmloflrZfmoIfnrb7nmoTnrJTorrDmlLbol4/njofpq5gzNSVcIixcIuS6kuWKqOaVsOaNruWlveeahOeslOiusOS8muiiq+aOqOiNkOWIsOabtOWkp+a1gemHj+axoFwiLFwi55yf6K+a55qE5qCH6aKY5q+U5aS45byg55qE5qCH6aKY5pu05Y+X5bmz5Y+w5o6o6I2QXCIsXCI55byg6YWN5Zu+5q+U5Y2V5byg5Zu+54mH5a6M5pKt546H6auYMuWAjVwiLFwi56yU6K6w5Y+R5biD5ZCOMeWwj+aXtuWGheaYr+a1gemHj+WFs+mUruacn1wiLFwi5ZCI6YCC55qE5Y+R5biD5pe26Ze06IO96K6p5pud5YWJ57+75YCNXCIsXCLmraPmlofliY0z6KGM5LiA5a6a6KaB5ZC45byV5Lq65ZCm5YiZ55So5oi355u05o6l5YiS6LWwXCIsXCLluKblrprkvY3nmoTmjqLlupfnrJTorrDmm53lhYnnjofpq5jlh7o1MCVcIixcIuacieWvueavlOeahOW5sui0p+eslOiusOabtOWuueaYk+iiq+aUtuiXj1wiLFwi55So5o+Q6Zeu5byP57uT5bC+6IO95o+Q5Y2H6K+E6K665Yy65LqS5Yqo546HXCJdO1xyXG5jb25zdCBDSEFSX0NZQ0xFPVtcInJlYWR5XCIsXCJ3YXZlXCIsXCJ3YWxrXCIsXCJzdGFuZFwiLFwianVtcFwiLFwic2l0XCIsXCJtZWRpdGF0ZVwiLFwiY29va1wiLFwic3VjY2Vzc1wiLFwiY3VyYXRvclwiLFwiYW5hbHl6ZVwiLFwic3VyZlwiLFwic3VwZXJoZXJvXCIsXCJwYWludFwiLFwiZGFuY2VcIixcIndlbGNvbWVcIixcImxpZnRcIixcImluc3BlY3RcIixcInVwZ3JhZGVcIl07XHJcbmNvbnN0IFNUQUdFUz1be2ltZzpcInMxXCIsbGFiZWw6XCLnoJTor7vntKDmnZBcIixkZXNjOlwi5bCP6Jav5YyF5q2j5Zyo6K6k55yf5YiG5p6Q5L2g55qE5YaF5a65Li4uXCJ9LHtpbWc6XCJzMlwiLGxhYmVsOlwi5pKw5YaZ5paH5qGIXCIsZGVzYzpcIueBteaEn+eIhuWPke+8geato+WcqOaJk+ejqOeIhuasvuaWh+ahiFwifSx7aW1nOlwiczNcIixsYWJlbDpcIueUn+aIkOmFjeWbvlwiLGRlc2M6XCLmraPlnKjnsr7lv4Pnu5jliLbnrKwge259Lzkg5byg5Zu+54mHXCJ9LHtpbWc6XCJzNFwiLGxhYmVsOlwi5ZOB6LSo5LyY5YyWXCIsZGVzYzpcIuato+WcqOeyvuS/ruWbvueJh+e7huiKgu+8jOehruS/neavj+S4gOW8oOmDveeyvuiHtOWHuuW9qVwifSx7aW1nOlwiczVcIixsYWJlbDpcIuaJk+WMheWujOaIkFwiLGRlc2M6XCLmkJ7lrprvvIHkvaDnmoTniIbmrL7lm77mlofmnaXllaZcIn0sXTtcclxuY29uc3QgRkVBVFVSRVM9W3tpY29uOlRhcmdldCx0aXRsZTpcIuaZuuiDveivhuWIq+i1m+mBk1wiLGRlc2M6XCLnspjotLTku7vmhI/ntKDmnZDvvIxBSeiHquWKqOWIpOaWreaXhea4uOOAgee+jumjn+OAgeWlveeJqeetieacgOS9s+WGheWuueetlueVpe+8jOS4jemcgOimgeaJi+WKqOmAieaLqVwifSx7aWNvbjpaYXAsdGl0bGU6XCLniIbmrL7lhazlvI/pqbHliqhcIixkZXNjOlwi5YaF572u5pWw5a2X57uT5p6c5byP44CB5Y+N5beu55eb54K55byP562J57uP6L+H6aqM6K+B55qE54iG5qy+5qCH6aKY5ZKM5q2j5paH5YWs5byPXCJ9LHtpY29uOkxheWVycyx0aXRsZTpcIjnlvKDlrozmlbTphY3lm75cIixkZXNjOlwiMeW8oOWwgemdois45byg5YaF5a656aG177yM5bim5ou85Zu+5o6S54mI5ZKM5paH5a2X5qCH5rOo77yM5LiL6L295Y2z5Y+v5Y+R5biDXCJ9LHtpY29uOlJvdGF0ZUNjdyx0aXRsZTpcIuWNleW8oOWPr+mHjeaWsOeUn+aIkFwiLGRlc2M6XCLlr7nmn5DlvKDlm77kuI3mu6HmhI/vvJ/ljZXni6zliLfmlrDov5nkuIDlvKDvvIzkuI3mtarotLnmlbTlpZfpop3luqZcIn0se2ljb246TW91c2VQb2ludGVyQ2xpY2ssdGl0bGU6XCLkuIDplK7lpI3liLbmlofmoYhcIixkZXNjOlwi5qCH6aKY44CB5q2j5paH44CB5qCH562+5YiG5Yir5aSN5Yi25oiW5LiA6ZSu5YWo6YOo5aSN5Yi277yM5omT5byA5bCP57qi5Lmm55u05o6l57KY6LS05Y+R5biDXCJ9LHtpY29uOlNoaWVsZENoZWNrLHRpdGxlOlwi5oyJ5aWX6K6h6LS55LiN5aWX6LevXCIsZGVzYzpcIueUqOWkmuWwkeS5sOWkmuWwke+8jOS4jeaQnuiHquWKqOe7rei0ue+8jOaWsOeUqOaIt+WFjei0ueS9k+mqjDHlpZdcIn0sXTtcclxuLyog4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQIEFQSSDilZDilZDilZDilZDilZDilZDilZAgKi9cclxuYXN5bmMgZnVuY3Rpb24gZ2VuQVBJKHQsb25JbWcsb25Qcm9nKXtjb25zdCByPWF3YWl0IGZldGNoKEFQSStcIi9hcGkvZ2VuZXJhdGVcIix7bWV0aG9kOlwiUE9TVFwiLGhlYWRlcnM6e1wiQ29udGVudC1UeXBlXCI6XCJhcHBsaWNhdGlvbi9qc29uXCJ9LGJvZHk6SlNPTi5zdHJpbmdpZnkoe3RleHQ6dH0pfSk7aWYoIXIub2spe2NvbnN0IGU9YXdhaXQgci50ZXh0KCkuY2F0Y2goKCk9PnIuc3RhdHVzVGV4dCk7dGhyb3cgbmV3IEVycm9yKGUuc2xpY2UoMCwyMDApKTt9Y29uc3QgcmVhZGVyPXIuYm9keS5nZXRSZWFkZXIoKTtjb25zdCBkZWM9bmV3IFRleHREZWNvZGVyKCk7bGV0IGJ1Zj1cIlwiO2NvbnN0IHJlc3VsdD17Y292ZXJfdXJsOlwiXCIsaW1hZ2VfdXJsczpbXX07d2hpbGUodHJ1ZSl7Y29uc3R7ZG9uZSx2YWx1ZX09YXdhaXQgcmVhZGVyLnJlYWQoKTtpZihkb25lKWJyZWFrO2J1Zis9ZGVjLmRlY29kZSh2YWx1ZSx7c3RyZWFtOnRydWV9KTtjb25zdCBsaW5lcz1idWYuc3BsaXQoU3RyaW5nLmZyb21DaGFyQ29kZSgxMCkpO2J1Zj1saW5lcy5wb3AoKXx8XCJcIjtmb3IoY29uc3QgbGluZSBvZiBsaW5lcyl7aWYoIWxpbmUuc3RhcnRzV2l0aChcImRhdGE6IFwiKSljb250aW51ZTt0cnl7Y29uc3QgZD1KU09OLnBhcnNlKGxpbmUuc2xpY2UoNikpO2lmKGQudHlwZT09PVwicHJvZ3Jlc3NcIiYmb25Qcm9nKW9uUHJvZyhkKTtlbHNlIGlmKGQudHlwZT09PVwiaW1hZ2VcIil7aWYoZC5pZD09PVwiY292ZXJcIilyZXN1bHQuY292ZXJfdXJsPWQudXJsO2Vsc2UgaWYoZC51cmwpcmVzdWx0LmltYWdlX3VybHMucHVzaChkLnVybCk7aWYob25JbWcpb25JbWcoZCk7fWVsc2UgaWYoZC50eXBlPT09XCJjb21wbGV0ZVwiKXtPYmplY3QuYXNzaWduKHJlc3VsdCxkKTtyZXN1bHQuaW1hZ2VfY291bnQ9ZC5pbWFnZV91cmxzPy5sZW5ndGh8fDA7fWVsc2UgaWYoZC50eXBlPT09XCJlcnJvclwiKXRocm93IG5ldyBFcnJvcihkLmVycm9yfHxcIueUn+aIkOWksei0pVwiKTt9Y2F0Y2goZSl7fX19cmV0dXJuIHJlc3VsdDt9XHJcblxyXG4vKiDilZDilZDilZDilZDilZDilZDilZAgU1RPUkFHRSDilZDilZDilZDilZDilZDilZDilZAgKi9cclxuYXN5bmMgZnVuY3Rpb24gc2F2ZVdvcmsodyl7dHJ5e3ZhciBsb2NhbD1KU09OLnBhcnNlKGxvY2FsU3RvcmFnZS5nZXRJdGVtKFwic2Itd29ya3NcIil8fFwiW11cIik7dmFyIGlkeD1sb2NhbC5maW5kSW5kZXgoZnVuY3Rpb24oeCl7cmV0dXJuIHguX2lucHV0VGV4dD09PXcuX2lucHV0VGV4dDt9KTtpZihpZHg+PTApe2xvY2FsW2lkeF09ey4uLmxvY2FsW2lkeF0sLi4udyxpZDpsb2NhbFtpZHhdLmlkLGF0OmxvY2FsW2lkeF0uYXR9O31lbHNle2xvY2FsLnVuc2hpZnQoey4uLncsaWQ6RGF0ZS5ub3coKSxhdDpuZXcgRGF0ZSgpLnRvTG9jYWxlRGF0ZVN0cmluZyhcInpoLUNOXCIpfSk7fWxvY2FsU3RvcmFnZS5zZXRJdGVtKFwic2Itd29ya3NcIixKU09OLnN0cmluZ2lmeShsb2NhbC5zbGljZSgwLDUwKSkpO31jYXRjaChlKXt9dHJ5e2F3YWl0IGZldGNoKEFQSStcIi9hcGkvc2F2ZS13b3JrXCIse21ldGhvZDpcIlBPU1RcIixoZWFkZXJzOntcIkNvbnRlbnQtVHlwZVwiOlwiYXBwbGljYXRpb24vanNvblwifSxib2R5OkpTT04uc3RyaW5naWZ5KHt3b3JrOnd9KX0pO31jYXRjaChlKXtjb25zb2xlLndhcm4oXCJzYXZlV29yazpcIixlLm1lc3NhZ2UpO3RyeXthd2FpdCBuZXcgUHJvbWlzZShmdW5jdGlvbihyKXtyZXR1cm4gc2V0VGltZW91dChyLDUwMCk7fSk7YXdhaXQgZmV0Y2goQVBJK1wiL2FwaS9zYXZlLXdvcmtcIix7bWV0aG9kOlwiUE9TVFwiLGhlYWRlcnM6e1wiQ29udGVudC1UeXBlXCI6XCJhcHBsaWNhdGlvbi9qc29uXCJ9LGJvZHk6SlNPTi5zdHJpbmdpZnkoe3dvcms6d30pfSk7fWNhdGNoKGUyKXtjb25zb2xlLndhcm4oXCJzYXZlV29yayByZXRyeTpcIixlMi5tZXNzYWdlKTt9fX1cclxuYXN5bmMgZnVuY3Rpb24gbG9hZFdvcmtzKCl7dHJ5e2NvbnN0IHI9YXdhaXQgZmV0Y2goQVBJK1wiL2FwaS93b3Jrc1wiKTtpZihyLm9rKXt2YXIgZD1hd2FpdCByLmpzb24oKTt0cnl7dmFyIGxvY2FsPUpTT04ucGFyc2UobG9jYWxTdG9yYWdlLmdldEl0ZW0oXCJzYi13b3Jrc1wiKXx8XCJbXVwiKTt2YXIgc2s9bmV3IFNldChkLm1hcChmdW5jdGlvbih4KXtyZXR1cm4geC5faW5wdXRUZXh0O30pKTt2YXIgbWlzc2luZz1sb2NhbC5maWx0ZXIoZnVuY3Rpb24oeCl7cmV0dXJuIHguX3NhdmVLZXkmJiFzay5oYXMoeC5faW5wdXRUZXh0KTt9KTtpZihtaXNzaW5nLmxlbmd0aD4wKXtkPVsuLi5taXNzaW5nLC4uLmRdLnNsaWNlKDAsNTApO319Y2F0Y2goZSl7fXRyeXtsb2NhbFN0b3JhZ2Uuc2V0SXRlbShcInNiLXdvcmtzXCIsSlNPTi5zdHJpbmdpZnkoZCkpO31jYXRjaChlKXt9cmV0dXJuIGQ7fX1jYXRjaChlKXtjb25zb2xlLndhcm4oXCJsb2FkV29ya3M6XCIsZS5tZXNzYWdlKTt9dHJ5e3JldHVybiBKU09OLnBhcnNlKGxvY2FsU3RvcmFnZS5nZXRJdGVtKFwic2Itd29ya3NcIil8fFwiW11cIik7fWNhdGNoKGUpe31yZXR1cm5bXTt9XHJcbmFzeW5jIGZ1bmN0aW9uIGdldFB0cygpe3RyeXtyZXR1cm4gcGFyc2VJbnQobG9jYWxTdG9yYWdlLmdldEl0ZW0oXCJzYi1wXCIpfHxcIjFcIik7fWNhdGNoe3JldHVybiAxO319XHJcbmFzeW5jIGZ1bmN0aW9uIHNldFB0cyhuKXt0cnl7bG9jYWxTdG9yYWdlLnNldEl0ZW0oXCJzYi1wXCIsU3RyaW5nKG4pKTt9Y2F0Y2h7fX1cclxuXHJcbi8qIOKVkOKVkOKVkOKVkOKVkOKVkOKVkCBVSSBBVE9NUyDilZDilZDilZDilZDilZDilZDilZAgKi9cclxuY29uc3Qgcz17Y2FyZDp7YmFja2dyb3VuZDpcIiNmZmZcIixib3JkZXJSYWRpdXM6MTYsYm9yZGVyOlwiMXB4IHNvbGlkICNmMGYwZjBcIixvdmVyZmxvdzpcImhpZGRlblwifSxjYXJkUDp7YmFja2dyb3VuZDpcIiNmZmZcIixib3JkZXJSYWRpdXM6MTYsYm9yZGVyOlwiMXB4IHNvbGlkICNmMGYwZjBcIixwYWRkaW5nOlwiMjBweCAyMnB4XCJ9LHNlY3Rpb246e21heFdpZHRoOjgwMCxtYXJnaW46XCIwIGF1dG9cIixwYWRkaW5nOlwiNDBweCAyMHB4XCJ9LHNlY3Rpb25UaXRsZTp7Zm9udFNpemU6MjIsZm9udFdlaWdodDo3MDAsdGV4dEFsaWduOlwiY2VudGVyXCIsbWFyZ2luOlwiMCAwIDZweFwiLGZvbnRGYW1pbHk6XCInUGluZ0ZhbmcgU0MnLCdNaWNyb3NvZnQgWWFIZWknLCdOb3RvIFNhbnMgU0MnLHNhbnMtc2VyaWZcIn0sc2VjdGlvblN1Yjp7Zm9udFNpemU6MTMsY29sb3I6XCIjOTk5XCIsdGV4dEFsaWduOlwiY2VudGVyXCIsbWFyZ2luOlwiMCAwIDI4cHhcIn19O1xyXG5cclxuZnVuY3Rpb24gQnRuKHtjaGlsZHJlbixwcmltYXJ5LHNtYWxsLG9uQ2xpY2ssZGlzYWJsZWQsZnVsbCxzeD17fX0pe2NvbnN0W2gsc2V0SF09dXNlU3RhdGUoZmFsc2UpO3JldHVybiA8YnV0dG9uIHN0eWxlPXt7ZGlzcGxheTpcImlubGluZS1mbGV4XCIsYWxpZ25JdGVtczpcImNlbnRlclwiLGp1c3RpZnlDb250ZW50OlwiY2VudGVyXCIsZ2FwOjcsYm9yZGVyOnByaW1hcnk/XCJub25lXCI6XCIxcHggc29saWQgI2U4ZThlOFwiLGJvcmRlclJhZGl1czpzbWFsbD84OjEyLGZvbnRTaXplOnNtYWxsPzEyOjE1LGZvbnRXZWlnaHQ6NjAwLGN1cnNvcjpkaXNhYmxlZD9cIm5vdC1hbGxvd2VkXCI6XCJwb2ludGVyXCIsZm9udEZhbWlseTpcImluaGVyaXRcIix0cmFuc2l0aW9uOlwiYWxsIDAuMnNcIix0cmFuc2Zvcm06aCYmIWRpc2FibGVkP1widHJhbnNsYXRlWSgtMXB4KVwiOlwibm9uZVwiLHBhZGRpbmc6c21hbGw/XCI2cHggMTRweFwiOlwiMTNweCAyOHB4XCIsd2lkdGg6ZnVsbD9cIjEwMCVcIjpcImF1dG9cIixiYWNrZ3JvdW5kOnByaW1hcnk/KGRpc2FibGVkP1wiI0ZGQjNCRFwiOlIpOihoP1wiI2Y4ZjhmOFwiOlwiI2ZmZlwiKSxjb2xvcjpwcmltYXJ5P1wiI2ZmZlwiOlwiIzU1NVwiLGJveFNoYWRvdzpwcmltYXJ5JiZoJiYhZGlzYWJsZWQ/XCIwIDZweCAyNHB4IHJnYmEoMjU1LDcxLDg3LDAuMjUpXCI6XCJub25lXCIsLi4uc3h9fSBvbkNsaWNrPXtvbkNsaWNrfSBkaXNhYmxlZD17ZGlzYWJsZWR9IG9uTW91c2VFbnRlcj17KCk9PnNldEgodHJ1ZSl9IG9uTW91c2VMZWF2ZT17KCk9PnNldEgoZmFsc2UpfT57Y2hpbGRyZW59PC9idXR0b24+O31cclxuXHJcbmZ1bmN0aW9uIENvcHlCdG4oe3RleHQsbGFiZWw9XCLlpI3liLZcIn0pe2NvbnN0W29rLHNldE9rXT11c2VTdGF0ZShmYWxzZSk7cmV0dXJuIDxCdG4gc21hbGwgb25DbGljaz17KCk9PntuYXZpZ2F0b3IuY2xpcGJvYXJkPy53cml0ZVRleHQodGV4dCk7c2V0T2sodHJ1ZSk7c2V0VGltZW91dCgoKT0+c2V0T2soZmFsc2UpLDE1MDApO319IHN4PXt7Y29sb3I6b2s/RzpcIiNhYWFcIixiYWNrZ3JvdW5kOm9rP1wiI0YwRkZGNFwiOlwiI2Y4ZjhmOFwiLGJvcmRlcjpcIm5vbmVcIn19Pntvaz88PjxDaGVjayBzaXplPXsxMn0vPuW3suWkjeWItjwvPjo8PjxDb3B5IHNpemU9ezEyfS8+e2xhYmVsfTwvPn08L0J0bj47fVxyXG5cclxuZnVuY3Rpb24gQ2FyZCh7Y2hpbGRyZW4sc3g9e30saG92ZXIsb25DbGlja30pe2NvbnN0W2gsc2V0SF09dXNlU3RhdGUoZmFsc2UpO3JldHVybiA8ZGl2IG9uQ2xpY2s9e29uQ2xpY2t9IHN0eWxlPXt7Li4ucy5jYXJkLHRyYW5zaXRpb246XCJhbGwgMC4yNXMgZWFzZVwiLHRyYW5zZm9ybTpoJiZob3Zlcj9cInRyYW5zbGF0ZVkoLTRweClcIjpcIm5vbmVcIixib3hTaGFkb3c6aCYmaG92ZXI/XCIwIDEycHggNDBweCByZ2JhKDAsMCwwLDAuMDgpXCI6XCIwIDFweCAzcHggcmdiYSgwLDAsMCwwLjAyKVwiLGN1cnNvcjpob3Zlcj9cInBvaW50ZXJcIjpcImRlZmF1bHRcIiwuLi5zeH19IG9uTW91c2VFbnRlcj17KCk9PnNldEgodHJ1ZSl9IG9uTW91c2VMZWF2ZT17KCk9PnNldEgoZmFsc2UpfT57Y2hpbGRyZW59PC9kaXY+O31cclxuXHJcbmZ1bmN0aW9uIENoYXJJbWcoeyBzcmMsIGFsdCA9ICcnLCBzdHlsZSA9IHt9LCBtYXJnaW4sIGZpbHRlciB9KSB7XHJcbiAgcmV0dXJuIDxkaXYgc3R5bGU9e3sgZGlzcGxheTonaW5saW5lLWZsZXgnLCBhbGlnbkl0ZW1zOidjZW50ZXInLCBqdXN0aWZ5Q29udGVudDonY2VudGVyJywgbWFyZ2luOm1hcmdpbnx8MCwgZmlsdGVyOmZpbHRlcnx8J2Ryb3Atc2hhZG93KDAgNHB4IDEycHggcmdiYSgyNTUsNzEsODcsMC4xMikpJywgbGluZUhlaWdodDowIH19PlxyXG4gICAgPGltZyBzcmM9e3NyY30gYWx0PXthbHR9IHN0eWxlPXt7IC4uLnN0eWxlLCBkaXNwbGF5OidibG9jaycsIG1heFdpZHRoOicxMDAlJywgb2JqZWN0Rml0Oidjb250YWluJyB9fSAvPlxyXG4gIDwvZGl2PjtcclxufVxyXG5cclxuZnVuY3Rpb24gTW9kYWwoe2NoaWxkcmVuLG9uQ2xvc2V9KXtyZXR1cm4gPGRpdiBzdHlsZT17e3Bvc2l0aW9uOlwiZml4ZWRcIixpbnNldDowLGJhY2tncm91bmQ6XCJyZ2JhKDAsMCwwLDAuNSlcIix6SW5kZXg6OTk5LGRpc3BsYXk6XCJmbGV4XCIsYWxpZ25JdGVtczpcImNlbnRlclwiLGp1c3RpZnlDb250ZW50OlwiY2VudGVyXCIsYmFja2Ryb3BGaWx0ZXI6XCJibHVyKDZweClcIixhbmltYXRpb246XCJmYWRlSW4gMC4xNXNcIn19IG9uQ2xpY2s9e29uQ2xvc2V9PjxkaXYgb25DbGljaz17ZT0+ZS5zdG9wUHJvcGFnYXRpb24oKX0gc3R5bGU9e3tiYWNrZ3JvdW5kOlwiI2ZmZlwiLGJvcmRlclJhZGl1czoyNCxwYWRkaW5nOlwiMzZweCAzMHB4XCIsd2lkdGg6NDAwLG1heFdpZHRoOlwiOTJ2d1wiLGFuaW1hdGlvbjpcInNsaWRlVXAgMC4yNXMgZWFzZVwiLG1heEhlaWdodDpcIjkwdmhcIixvdmVyZmxvdzpcImF1dG9cIn19PntjaGlsZHJlbn08L2Rpdj48L2Rpdj47fVxyXG5cclxuLyog4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQIFpJUCBET1dOTE9BRCDilZDilZDilZDilZDilZDilZDilZAgKi9cclxuYXN5bmMgZnVuY3Rpb24gZG93bmxvYWRaaXAoY292ZXJVcmwsaW1hZ2VVcmxzLHRpdGxlLGJvZHlUZXh0LGhhc2h0YWdzKXtcclxuICBpZighY292ZXJVcmwmJiFpbWFnZVVybHM/Lmxlbmd0aClyZXR1cm4gYWxlcnQoXCLmmoLml6Dlm77niYflj6/kuIvovb1cIik7XHJcbiAgdHJ5e1xyXG4gICAgY29uc3QgSlNaaXA9KGF3YWl0IGltcG9ydCgnanN6aXAnKSkuZGVmYXVsdDtcclxuICAgIGNvbnN0IHppcD1uZXcgSlNaaXAoKTtcclxuICAgIGNvbnN0IGFsbD1bY292ZXJVcmwsLi4uKGltYWdlVXJsc3x8W10pXS5maWx0ZXIoQm9vbGVhbik7XHJcbiAgICBsZXQgb2s9MDtcclxuICAgIC8vIOWKoOWFpeaWh+eroOaWh+acrOaWh+S7tlxyXG4gICAgaWYoYm9keVRleHR8fHRpdGxlKXtcclxuICAgICAgdmFyIHRleHRDb250ZW50ID0gKHRpdGxlfHwnJykgKyAnXFxuXFxuJyArIChib2R5VGV4dHx8JycpICsgJ1xcblxcbicgKyAoKGhhc2h0YWdzfHxbXSkuam9pbignICcpKTtcclxuICAgICAgemlwLmZpbGUoXCIwMC3mlofnq6DlhoXlrrkudHh0XCIsIHRleHRDb250ZW50KTtcclxuICAgIH1cclxuICAgIGNvbnN0IHJlc3VsdHM9YXdhaXQgUHJvbWlzZS5hbGwoYWxsLm1hcChhc3luYyBmdW5jdGlvbih1cmwsaSl7XHJcbiAgICAgIHRyeXtcclxuICAgICAgICBjb25zdCByZXNwPWF3YWl0IGZldGNoKEFQSStcIi9hcGkvcHJveHktaW1hZ2U/dXJsPVwiK2VuY29kZVVSSUNvbXBvbmVudCh1cmwpKTtcclxuICAgICAgICBpZighcmVzcC5vaylyZXR1cm4gbnVsbDtcclxuICAgICAgICBjb25zdCBibG9iPWF3YWl0IHJlc3AuYmxvYigpO1xyXG4gICAgICAgIHJldHVybntuYW1lOmk9PT0wP1wiMDEt5bCB6Z2iXCI6XCIwXCIrKGkrMSksYmxvYn07XHJcbiAgICAgIH1jYXRjaChlKXtyZXR1cm4gbnVsbDt9XHJcbiAgICB9KSk7XHJcbiAgICByZXN1bHRzLmZvckVhY2goZnVuY3Rpb24ocil7aWYocil7emlwLmZpbGUoci5uYW1lK1wiLnBuZ1wiLHIuYmxvYik7b2srKzt9fSk7XHJcbiAgICBpZighb2spcmV0dXJuIGFsZXJ0KFwi5LiL6L295aSx6LSl77yM5Zu+54mH5Y+v6IO95bey6L+H5pyfXCIpO1xyXG4gICAgY29uc3QgY29udGVudD1hd2FpdCB6aXAuZ2VuZXJhdGVBc3luYyh7dHlwZTpcImJsb2JcIn0pO1xyXG4gICAgY29uc3QgbGluaz1kb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiYVwiKTtcclxuICAgIGxpbmsuaHJlZj1VUkwuY3JlYXRlT2JqZWN0VVJMKGNvbnRlbnQpO1xyXG4gICAgbGluay5kb3dubG9hZD0odGl0bGV8fFwi6Jav5YyFQUlcIikuc2xpY2UoMCwyMCkrXCLlm77mlocuemlwXCI7XHJcbiAgICBsaW5rLmNsaWNrKCk7XHJcbiAgICBVUkwucmV2b2tlT2JqZWN0VVJMKGxpbmsuaHJlZik7XHJcbiAgfWNhdGNoKGUpe2FsZXJ0KFwi5LiL6L295aSx6LSl77yM6K+36YeN6K+VXCIpO31cclxufVxyXG5cclxuLyog4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQIFJFU1VMVCBNT0RBTCAobGVmdCBpbWFnZSArIHJpZ2h0IHRleHQpIOKVkOKVkOKVkOKVkOKVkOKVkOKVkCAqL1xyXG5mdW5jdGlvbiBSZXN1bHREaXNwbGF5KHtyZXN1bHQsbG9nZ2VkLG9uTG9naW4sb25QcmljZSxsb2dpbk1vZGFsLHByaWNlTW9kYWwsdGV4dFJlZ2VuLHRleHQsc2V0UmVzdWx0LHNldEdlbn0pe1xyXG4gIGNvbnN0IFtpbWdJZHgsc2V0SW1nSWR4XT11c2VTdGF0ZSgwKTtcclxuICBjb25zdCBbem9vbSxzZXRab29tXT11c2VTdGF0ZShudWxsKTtcclxuICBjb25zdCBbcmdJZHgsc2V0UmdJZHhdPXVzZVN0YXRlKG51bGwpOyAvLyB3aGljaCBpbWFnZSBpcyByZWdlbmVyYXRpbmdcclxuICBjb25zdCBhbGxJbWFnZXM9dXNlTWVtbygoKT0+e2NvbnN0IGE9W107aWYocmVzdWx0Py5jb3Zlcl91cmwpYS5wdXNoKHJlc3VsdC5jb3Zlcl91cmwpO2lmKHJlc3VsdD8uaW1hZ2VfdXJscylhLnB1c2goLi4ucmVzdWx0LmltYWdlX3VybHMpO3JldHVybiBhO30sW3Jlc3VsdF0pO1xyXG4gIGNvbnN0IHBhZ2VzPXJlc3VsdD8ucGFnZXN8fFtdO1xyXG4gIGNvbnN0IGN1clBhZ2U9cGFnZXNbaW1nSWR4XXx8cGFnZXNbMF18fHt9O1xyXG4gIGNvbnN0IG1heEk9YWxsSW1hZ2VzLmxlbmd0aDtcclxuXHJcbiAgLy8ga2V5Ym9hcmQgbmF2XHJcbiAgdXNlRWZmZWN0KCgpPT57XHJcbiAgICBpZih6b29tKXJldHVybjsgLy8gem9vbSBoYXMgaXRzIG93biBrZXlib2FyZCBoYW5kbGVyXHJcbiAgICBjb25zdCBoPShlKT0+e1xyXG4gICAgICBpZihlLmtleT09PSdBcnJvd0xlZnQnKXtzZXRJbWdJZHgoaT0+TWF0aC5tYXgoMCxpLTEpKTtlLnByZXZlbnREZWZhdWx0KCk7fVxyXG4gICAgICBpZihlLmtleT09PSdBcnJvd1JpZ2h0Jyl7c2V0SW1nSWR4KGk9Pk1hdGgubWluKG1heEktMSxpKzEpKTtlLnByZXZlbnREZWZhdWx0KCk7fVxyXG4gICAgfTtcclxuICAgIHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKCdrZXlkb3duJyxoKTtcclxuICAgIHJldHVybiAoKT0+d2luZG93LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ2tleWRvd24nLGgpO1xyXG4gIH0sW3pvb20sbWF4SV0pO1xyXG5cclxuICAvLyB6b29tIGtleWJvYXJkICsgc2xpZGVcclxuICB1c2VFZmZlY3QoKCk9PntcclxuICAgIGlmKCF6b29tKXJldHVybjtcclxuICAgIGNvbnN0IGg9KGUpPT57XHJcbiAgICAgIGlmKGUua2V5PT09J0VzY2FwZScpe3NldFpvb20obnVsbCk7ZS5wcmV2ZW50RGVmYXVsdCgpO31cclxuICAgICAgaWYoZS5rZXk9PT0nQXJyb3dMZWZ0Jyl7c2V0SW1nSWR4KGk9Pntjb25zdCBuPU1hdGgubWF4KDAsaS0xKTtzZXRab29tKGFsbEltYWdlc1tuXSk7cmV0dXJuIG47fSk7ZS5wcmV2ZW50RGVmYXVsdCgpO31cclxuICAgICAgaWYoZS5rZXk9PT0nQXJyb3dSaWdodCcpe3NldEltZ0lkeChpPT57Y29uc3Qgbj1NYXRoLm1pbihtYXhJLTEsaSsxKTtzZXRab29tKGFsbEltYWdlc1tuXSk7cmV0dXJuIG47fSk7ZS5wcmV2ZW50RGVmYXVsdCgpO31cclxuICAgIH07XHJcbiAgICB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcigna2V5ZG93bicsaCk7XHJcbiAgICByZXR1cm4gKCk9PndpbmRvdy5yZW1vdmVFdmVudExpc3RlbmVyKCdrZXlkb3duJyxoKTtcclxuICB9LFt6b29tLGFsbEltYWdlcyxtYXhJXSk7XHJcblxyXG4gIGNvbnN0IHJlZ2VuU2luZ2xlPWFzeW5jKGkpPT57XHJcbiAgICBpZighY29uZmlybShcIumHjeaWsOeUn+aIkOi/meW8oOWbvueJh+Wwhua2iOiAlzHmrKHpop3luqbvvIznoa7lrprvvJ9cIikpcmV0dXJuO1xyXG4gICAgc2V0UmdJZHgoaSk7XHJcbiAgICB0cnl7XHJcbiAgICAgIC8vIGZpbmQgdGhlIHByb21wdCBmb3IgdGhpcyBwYWdlXHJcbiAgICAgIGxldCBwcm9tcHQ9Jyc7XHJcbiAgICAgIGlmKGk9PT0wJiZyZXN1bHQ/LmNvdmVyX3Byb21wdClwcm9tcHQ9cmVzdWx0LmNvdmVyX3Byb21wdDtcclxuICAgICAgZWxzZSBpZihpPjApe1xyXG4gICAgICAgIGNvbnN0IHBpPXJlc3VsdD8uaW1hZ2VfcHJvbXB0cz8uZmluZD8uKHA9PnAucGFnZV9pZD09PWkrMSk7XHJcbiAgICAgICAgaWYocGkpcHJvbXB0PXBpLnByb21wdDtcclxuICAgICAgfVxyXG4gICAgICBpZighcHJvbXB0KXRocm93IG5ldyBFcnJvcign5pyq5om+5Yiw6K+l6aG155qE5Zu+54mH5o+P6L+wJyk7XHJcbiAgICAgIGNvbnN0IHI9YXdhaXQgZmV0Y2goQVBJK1wiL2FwaS9yZWdlbmVyYXRlLWltYWdlXCIse21ldGhvZDpcIlBPU1RcIixoZWFkZXJzOntcIkNvbnRlbnQtVHlwZVwiOlwiYXBwbGljYXRpb24vanNvblwifSxib2R5OkpTT04uc3RyaW5naWZ5KHtwcm9tcHR9KX0pO1xyXG4gICAgICBpZighci5vayl0aHJvdyBuZXcgRXJyb3IoJ+ivt+axguWksei0pScpO1xyXG4gICAgICBjb25zdCBkPWF3YWl0IHIuanNvbigpO1xyXG4gICAgICBpZighZC51cmwpdGhyb3cgbmV3IEVycm9yKCfnlJ/miJDlpLHotKUnKTtcclxuICAgICAgc2V0UmVzdWx0KHByZXY9PntcclxuICAgICAgICBpZihpPT09MClyZXR1cm57Li4ucHJldixjb3Zlcl91cmw6ZC51cmx9O1xyXG4gICAgICAgIGNvbnN0IHU9Wy4uLihwcmV2LmltYWdlX3VybHN8fFtdKV07XHJcbiAgICAgICAgaWYodVtpLTFdKXVbaS0xXT1kLnVybDtcclxuICAgICAgICByZXR1cm57Li4ucHJldixpbWFnZV91cmxzOnV9O1xyXG4gICAgICB9KTtcclxuICAgIH1jYXRjaChlKXthbGVydCgn5Zu+54mH55Sf5oiQ5aSx6LSl77yaJytlLm1lc3NhZ2UpO31cclxuICAgIHNldFJnSWR4KG51bGwpO1xyXG4gIH07XHJcblxyXG4gIGlmKCFyZXN1bHR8fCFjdXJQYWdlKXJldHVybiBudWxsO1xyXG5cclxuICBjb25zdCBDPWNzcygpO1xyXG4gIHJldHVybiA8ZGl2IHN0eWxlPXt7bWluSGVpZ2h0OlwiMTAwdmhcIixiYWNrZ3JvdW5kOkJHfX0+XHJcbiAgICB7Q31cclxuICAgIHsvKiBaT09NIE9WRVJMQVkgKi99XHJcbiAgICB7em9vbSYmPGRpdiBzdHlsZT17e3Bvc2l0aW9uOlwiZml4ZWRcIixpbnNldDowLHpJbmRleDo5OTk5LGJhY2tncm91bmQ6XCJyZ2JhKDAsMCwwLDAuOTIpXCIsZGlzcGxheTpcImZsZXhcIixhbGlnbkl0ZW1zOlwiY2VudGVyXCIsanVzdGlmeUNvbnRlbnQ6XCJjZW50ZXJcIixhbmltYXRpb246XCJmYWRlSW4gLjE1c1wiLGN1cnNvcjpcInpvb20tb3V0XCJ9fSBvbkNsaWNrPXsoKT0+c2V0Wm9vbShudWxsKX0+XHJcbiAgICAgIDxidXR0b24gb25DbGljaz17KGUpPT57ZS5zdG9wUHJvcGFnYXRpb24oKTtzZXRJbWdJZHgoaT0+e2NvbnN0IG49TWF0aC5tYXgoMCxpLTEpO3NldFpvb20oYWxsSW1hZ2VzW25dKTtyZXR1cm4gbjt9KTt9fSBzdHlsZT17e3Bvc2l0aW9uOlwiYWJzb2x1dGVcIixsZWZ0OjEyLHRvcDpcIjUwJVwiLHRyYW5zZm9ybTpcInRyYW5zbGF0ZVkoLTUwJSlcIix3aWR0aDo0MCxoZWlnaHQ6NDAsYm9yZGVyUmFkaXVzOlwiNTAlXCIsYmFja2dyb3VuZDpcInJnYmEoMjU1LDI1NSwyNTUsMC4xNSlcIixib3JkZXI6XCJub25lXCIsY29sb3I6XCIjZmZmXCIsY3Vyc29yOlwicG9pbnRlclwiLGRpc3BsYXk6XCJmbGV4XCIsYWxpZ25JdGVtczpcImNlbnRlclwiLGp1c3RpZnlDb250ZW50OlwiY2VudGVyXCIsZm9udFNpemU6MjAsekluZGV4OjEwLGJhY2tkcm9wRmlsdGVyOlwiYmx1cig0cHgpXCIsdHJhbnNpdGlvbjpcImJhY2tncm91bmQgLjJzXCJ9fSBvbk1vdXNlRW50ZXI9e2U9PmUudGFyZ2V0LnN0eWxlLmJhY2tncm91bmQ9XCJyZ2JhKDI1NSwyNTUsMjU1LDAuMjUpXCJ9IG9uTW91c2VMZWF2ZT17ZT0+ZS50YXJnZXQuc3R5bGUuYmFja2dyb3VuZD1cInJnYmEoMjU1LDI1NSwyNTUsMC4xNSlcIn0+eyfigLknfTwvYnV0dG9uPlxyXG4gICAgICA8aW1nIHNyYz17em9vbX0gYWx0PVwiXCIgc3R5bGU9e3ttYXhXaWR0aDpcIjkyJVwiLG1heEhlaWdodDpcIjkyJVwiLG9iamVjdEZpdDpcImNvbnRhaW5cIixib3JkZXJSYWRpdXM6MTIsYm94U2hhZG93OlwiMCAyMHB4IDYwcHggcmdiYSgwLDAsMCwwLjUpXCIsY3Vyc29yOlwiZGVmYXVsdFwifX0gb25DbGljaz17ZT0+ZS5zdG9wUHJvcGFnYXRpb24oKX0vPlxyXG4gICAgICA8YnV0dG9uIG9uQ2xpY2s9eyhlKT0+e2Uuc3RvcFByb3BhZ2F0aW9uKCk7c2V0SW1nSWR4KGk9Pntjb25zdCBuPU1hdGgubWluKG1heEktMSxpKzEpO3NldFpvb20oYWxsSW1hZ2VzW25dKTtyZXR1cm4gbjt9KTt9fSBzdHlsZT17e3Bvc2l0aW9uOlwiYWJzb2x1dGVcIixyaWdodDoxMix0b3A6XCI1MCVcIix0cmFuc2Zvcm06XCJ0cmFuc2xhdGVZKC01MCUpXCIsd2lkdGg6NDAsaGVpZ2h0OjQwLGJvcmRlclJhZGl1czpcIjUwJVwiLGJhY2tncm91bmQ6XCJyZ2JhKDI1NSwyNTUsMjU1LDAuMTUpXCIsYm9yZGVyOlwibm9uZVwiLGNvbG9yOlwiI2ZmZlwiLGN1cnNvcjpcInBvaW50ZXJcIixkaXNwbGF5OlwiZmxleFwiLGFsaWduSXRlbXM6XCJjZW50ZXJcIixqdXN0aWZ5Q29udGVudDpcImNlbnRlclwiLGZvbnRTaXplOjIwLHpJbmRleDoxMCxiYWNrZHJvcEZpbHRlcjpcImJsdXIoNHB4KVwiLHRyYW5zaXRpb246XCJiYWNrZ3JvdW5kIC4yc1wifX0gb25Nb3VzZUVudGVyPXtlPT5lLnRhcmdldC5zdHlsZS5iYWNrZ3JvdW5kPVwicmdiYSgyNTUsMjU1LDI1NSwwLjI1KVwifSBvbk1vdXNlTGVhdmU9e2U9PmUudGFyZ2V0LnN0eWxlLmJhY2tncm91bmQ9XCJyZ2JhKDI1NSwyNTUsMjU1LDAuMTUpXCJ9Pnsn4oC6J308L2J1dHRvbj5cclxuICAgICAgPGRpdiBzdHlsZT17e3Bvc2l0aW9uOlwiYWJzb2x1dGVcIixib3R0b206MjAsbGVmdDpcIjUwJVwiLHRyYW5zZm9ybTpcInRyYW5zbGF0ZVgoLTUwJSlcIixjb2xvcjpcInJnYmEoMjU1LDI1NSwyNTUsMC41KVwiLGZvbnRTaXplOjEyfX0+e2ltZ0lkeCsxfS97bWF4SX0gwrcg4oaR4oaTIOKGkCDihpIg5YiH5o2iIMK3IEVTQyDlhbPpl608L2Rpdj5cclxuICAgIDwvZGl2Pn1cclxuXHJcbiAgICB7LyogTE9HSU4gQkFOTkVSICovfVxyXG4gICAgeyFsb2dnZWQmJjxkaXYgc3R5bGU9e3tkaXNwbGF5Olwibm9uZVwifX0+XHJcbiAgICAgIDxzcGFuIHN0eWxlPXt7Zm9udFNpemU6MTMsY29sb3I6XCIjMzMzXCJ9fT7nmbvlvZXljbPlj6/miorkvZzlk4Hkv53lrZjliLDjgIzmiJHnmoTkvZzlk4HjgI08L3NwYW4+XHJcbiAgICAgIDxCdG4gc21hbGwgb25DbGljaz17b25Mb2dpbn0gc3g9e3tiYWNrZ3JvdW5kOlIsY29sb3I6XCIjZmZmXCIsYm9yZGVyOlwibm9uZVwiLHdoaXRlU3BhY2U6XCJub3dyYXBcIn19PjxMb2dJbiBzaXplPXsxMn0vPueZu+W9lTwvQnRuPlxyXG4gICAgPC9kaXY+fVxyXG5cclxuICAgIHsvKiBUT1AgTkFWICovfVxyXG4gICAgPGRpdiBzdHlsZT17e2Rpc3BsYXk6XCJub25lXCJ9fT5cclxuICAgICAgPGRpdiBzdHlsZT17e2Rpc3BsYXk6XCJmbGV4XCIsYWxpZ25JdGVtczpcImNlbnRlclwiLGdhcDo4fX0+XHJcbiAgICAgICAgPEJ0biBzbWFsbCBvbkNsaWNrPXsoKT0+e3NldEdlbihcImlkbGVcIik7c2V0UmVzdWx0KG51bGwpO319PjxBcnJvd0xlZnQgc2l6ZT17MTR9Lz4g6L+U5ZuePC9CdG4+XHJcbiAgICAgICAgPHNwYW4gc3R5bGU9e3tmb250U2l6ZToxMixiYWNrZ3JvdW5kOlwiI0ZGRjFGM1wiLGNvbG9yOlIscGFkZGluZzpcIjRweCAxMnB4XCIsYm9yZGVyUmFkaXVzOjIwLGZvbnRXZWlnaHQ6NjAwfX0+e3Jlc3VsdC5jYXRlZ29yeX08L3NwYW4+XHJcbiAgICAgICAgPHNwYW4gc3R5bGU9e3tmb250U2l6ZToxMSxjb2xvcjpcIiM5OTlcIn19PntyZXN1bHQuYXVkaWVuY2V8fCcnfXtyZXN1bHQudGlwPygnIMK3ICcrcmVzdWx0LnRpcCk6Jyd9PC9zcGFuPlxyXG4gICAgICA8L2Rpdj5cclxuICAgICAgPGRpdiBzdHlsZT17e2Rpc3BsYXk6XCJmbGV4XCIsZ2FwOjZ9fT5cclxuICAgICAgICA8QnRuIHNtYWxsIG9uQ2xpY2s9eygpPT5kb3dubG9hZFppcChyZXN1bHQuY292ZXJfdXJsLHJlc3VsdC5pbWFnZV91cmxzLHJlc3VsdC50aXRsZSxyZXN1bHQuYm9keV90ZXh0LHJlc3VsdC5oYXNodGFncyl9IHN4PXt7YmFja2dyb3VuZDpcIiNmOGY4ZjhcIixjb2xvcjpcIiM1NTVcIixib3JkZXI6XCJub25lXCJ9fT48RG93bmxvYWQgc2l6ZT17MTJ9Lz4g5LiL6L295Zu+54mHPC9CdG4+XHJcbiAgICAgIDwvZGl2PlxyXG4gICAgPC9kaXY+XHJcblxyXG4gICAgey8qIE1BSU4gQ09OVEVOVDogTEVGVCBJTUFHRSArIFJJR0hUIFRFWFQgKi99XHJcbiAgICA8ZGl2IHN0eWxlPXt7bWF4V2lkdGg6OTYwLG1hcmdpbjpcIjAgYXV0b1wiLHBhZGRpbmc6XCIxNnB4IDE2cHggNjBweFwifX0+XHJcbiAgICAgIDxkaXYgc3R5bGU9e3tkaXNwbGF5OlwiZmxleFwiLGdhcDoxNixhbGlnbkl0ZW1zOlwiZmxleC1zdGFydFwifX0+XHJcbiAgICAgICAgey8qIExFRlQ6IElNQUdFICovfVxyXG4gICAgICAgIDxkaXYgc3R5bGU9e3tmbGV4OlwiMCAwIGF1dG9cIixwb3NpdGlvbjpcInJlbGF0aXZlXCIsd2lkdGg6XCI1MCVcIixtYXhXaWR0aDo0MjB9fT5cclxuICAgICAgICAgIDxkaXYgc3R5bGU9e3twb3NpdGlvbjpcInJlbGF0aXZlXCIsYm9yZGVyUmFkaXVzOjEyLG92ZXJmbG93OlwiaGlkZGVuXCIsYmFja2dyb3VuZDpcIiNmNWY1ZjVcIixib3hTaGFkb3c6XCIwIDRweCAyMHB4IHJnYmEoMCwwLDAsMC4wNilcIn19XHJcbiAgICAgICAgICAgIG9uTW91c2VFbnRlcj17ZnVuY3Rpb24oZSl7ZS5jdXJyZW50VGFyZ2V0LnF1ZXJ5U2VsZWN0b3JBbGwoJy54aHMtbmF2JykuZm9yRWFjaChmdW5jdGlvbihiKXtiLnN0eWxlLm9wYWNpdHk9JzEnfSl9fVxyXG4gICAgICAgICAgICBvbk1vdXNlTGVhdmU9e2Z1bmN0aW9uKGUpe2UuY3VycmVudFRhcmdldC5xdWVyeVNlbGVjdG9yQWxsKCcueGhzLW5hdicpLmZvckVhY2goZnVuY3Rpb24oYil7Yi5zdHlsZS5vcGFjaXR5PScwJ30pfX0+XHJcbiAgICAgICAgICAgIHsvKiBJTUFHRSAqL31cclxuICAgICAgICAgICAge2FsbEltYWdlc1tpbWdJZHhdPzw+PGltZyBzcmM9e2FsbEltYWdlc1tpbWdJZHhdfSBhbHQ9XCJcIiBzdHlsZT17e3dpZHRoOlwiMTAwJVwiLGRpc3BsYXk6XCJibG9ja1wiLGN1cnNvcjpcInBvaW50ZXJcIixhc3BlY3RSYXRpbzpcIjMvNFwiLG9iamVjdEZpdDpcImNvdmVyXCJ9fSBvbkNsaWNrPXsoKT0+c2V0Wm9vbShhbGxJbWFnZXNbaW1nSWR4XSl9Lz5cclxuICAgICAgICAgICAgey8qIOaWh+Wtl+WPoOWKoOWxgiAqL31cclxuICAgICAgICAgICAgeygoKT0+e1xyXG4gICAgICAgICAgICAgIGNvbnN0IHAgPSBpbWdJZHg9PT0wID8ge3RpdGxlOnJlc3VsdC50aXRsZSwgaG9vazpyZXN1bHQuY2F0ZWdvcnl9IDogKHBhZ2VzW2ltZ0lkeC0xXXx8e30pO1xyXG4gICAgICAgICAgICAgIHJldHVybiA8PlxyXG4gICAgICAgICAgICAgICAgey8qIOmhtumDqOagh+mimCAqL31cclxuICAgICAgICAgICAgICAgIHtwPy50aXRsZSA/IDxkaXYgc3R5bGU9e3twb3NpdGlvbjpcImFic29sdXRlXCIsdG9wOjAsbGVmdDowLHJpZ2h0OjAscGFkZGluZzpcIjE0cHggMTRweCA0MHB4XCIsYmFja2dyb3VuZDpcImxpbmVhci1ncmFkaWVudCgxODBkZWcscmdiYSgwLDAsMCwwLjY1KSAwJSx0cmFuc3BhcmVudCAxMDAlKVwiLGNvbG9yOlwiI2ZmZlwiLGZvbnRTaXplOjE1LGZvbnRXZWlnaHQ6NzAwLGxpbmVIZWlnaHQ6MS41LHRleHRTaGFkb3c6XCIwIDJweCA4cHggcmdiYSgwLDAsMCwwLjQpXCIscG9pbnRlckV2ZW50czpcIm5vbmVcIix6SW5kZXg6M319PntwLnRpdGxlfTwvZGl2PiA6IG51bGx9XHJcbiAgICAgICAgICAgICAgICB7Lyog5Lit6YOo5L+h5oGv5qCH562+ICovfVxyXG4gICAgICAgICAgICAgICAge2ltZ0lkeD4wICYmIHA/LmluZm9fYmxvY2tzPy5sZW5ndGg+MCA/IDxkaXYgc3R5bGU9e3twb3NpdGlvbjpcImFic29sdXRlXCIsYm90dG9tOjQ0LGxlZnQ6MCxyaWdodDowLHBhZGRpbmc6XCI4cHggMTJweFwiLGRpc3BsYXk6XCJmbGV4XCIsZmxleFdyYXA6XCJ3cmFwXCIsZ2FwOjQscG9pbnRlckV2ZW50czpcIm5vbmVcIix6SW5kZXg6M319PlxyXG4gICAgICAgICAgICAgICAgICB7cC5pbmZvX2Jsb2Nrcy5zbGljZSgwLDQpLm1hcCgoYixpKT0+KFxyXG4gICAgICAgICAgICAgICAgICAgIDxzcGFuIGtleT17aX0gc3R5bGU9e3tiYWNrZ3JvdW5kOlwicmdiYSgwLDAsMCwwLjU1KVwiLGJhY2tkcm9wRmlsdGVyOlwiYmx1cig0cHgpXCIsYm9yZGVyUmFkaXVzOjYscGFkZGluZzpcIjJweCA4cHhcIixmb250U2l6ZToxMCxjb2xvcjpcIiNmZmZcIixsaW5lSGVpZ2h0OjEuNn19PntiLmxhYmVsfTogPHN0cm9uZz57Yi52YWx1ZX08L3N0cm9uZz48L3NwYW4+XHJcbiAgICAgICAgICAgICAgICAgICkpfVxyXG4gICAgICAgICAgICAgICAgPC9kaXY+IDogbnVsbH1cclxuICAgICAgICAgICAgICAgIHsvKiDlupXpg6jpkqnlrZAgKi99XHJcbiAgICAgICAgICAgICAgICB7cD8uaG9vayA/IDxkaXYgc3R5bGU9e3twb3NpdGlvbjpcImFic29sdXRlXCIsYm90dG9tOjgsbGVmdDowLHJpZ2h0OjAscGFkZGluZzpcIjRweCAxNHB4XCIsY29sb3I6XCIjZmZkNzAwXCIsZm9udFNpemU6MTEsZm9udFN0eWxlOlwiaXRhbGljXCIsdGV4dFNoYWRvdzpcIjAgMXB4IDZweCByZ2JhKDAsMCwwLDAuNSlcIixwb2ludGVyRXZlbnRzOlwibm9uZVwiLHRleHRBbGlnbjpcImNlbnRlclwiLHpJbmRleDozfX0+e3AuaG9va308L2Rpdj4gOiBudWxsfVxyXG4gICAgICAgICAgICAgIDwvPjtcclxuICAgICAgICAgICAgfSkoKX1cclxuICAgICAgICAgICAgPC8+OjxkaXYgc3R5bGU9e3t3aWR0aDpcIjEwMCVcIixhc3BlY3RSYXRpbzpcIjMvNFwiLGRpc3BsYXk6XCJmbGV4XCIsYWxpZ25JdGVtczpcImNlbnRlclwiLGp1c3RpZnlDb250ZW50OlwiY2VudGVyXCIsY29sb3I6XCIjY2NjXCIsZm9udFNpemU6MTN9fT7mmoLml6Dlm77niYc8L2Rpdj59XHJcblxyXG4gICAgICAgICAgICB7LyogSE9WRVIgQVJST1dTICovfVxyXG4gICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cInhocy1uYXZcIiBzdHlsZT17e3Bvc2l0aW9uOlwiYWJzb2x1dGVcIix0b3A6MCxsZWZ0OjAscmlnaHQ6MCxib3R0b206MCxvcGFjaXR5OjAsdHJhbnNpdGlvbjpcIm9wYWNpdHkgMC4yc1wiLHBvaW50ZXJFdmVudHM6XCJub25lXCJ9fT5cclxuICAgICAgICAgICAgICB7aW1nSWR4PjAmJjxidXR0b24gc3R5bGU9e3twb3NpdGlvbjpcImFic29sdXRlXCIsbGVmdDo2LHRvcDpcIjUwJVwiLHRyYW5zZm9ybTpcInRyYW5zbGF0ZVkoLTUwJSlcIixwb2ludGVyRXZlbnRzOlwiYXV0b1wiLHdpZHRoOjMyLGhlaWdodDozMixib3JkZXJSYWRpdXM6XCI1MCVcIixiYWNrZ3JvdW5kOlwicmdiYSgyNTUsMjU1LDI1NSwwLjkpXCIsYm9yZGVyOlwibm9uZVwiLGJveFNoYWRvdzpcIjAgMnB4IDhweCByZ2JhKDAsMCwwLDAuMSlcIixjdXJzb3I6XCJwb2ludGVyXCIsZGlzcGxheTpcImZsZXhcIixhbGlnbkl0ZW1zOlwiY2VudGVyXCIsanVzdGlmeUNvbnRlbnQ6XCJjZW50ZXJcIixmb250U2l6ZToxOCxjb2xvcjpcIiM1NTVcIix0cmFuc2l0aW9uOlwiYWxsIC4xNXNcIn19IG9uTW91c2VFbnRlcj17ZT0+ZS5jdXJyZW50VGFyZ2V0LnN0eWxlLmJhY2tncm91bmQ9XCIjZmZmXCJ9IG9uTW91c2VMZWF2ZT17ZT0+ZS5jdXJyZW50VGFyZ2V0LnN0eWxlLmJhY2tncm91bmQ9XCJyZ2JhKDI1NSwyNTUsMjU1LDAuOSlcIn0gb25DbGljaz17KCk9PnNldEltZ0lkeChpPT5pLTEpfT57J+KAuSd9PC9idXR0b24+fVxyXG4gICAgICAgICAgICAgIHtpbWdJZHg8bWF4SS0xJiY8YnV0dG9uIHN0eWxlPXt7cG9zaXRpb246XCJhYnNvbHV0ZVwiLHJpZ2h0OjYsdG9wOlwiNTAlXCIsdHJhbnNmb3JtOlwidHJhbnNsYXRlWSgtNTAlKVwiLHBvaW50ZXJFdmVudHM6XCJhdXRvXCIsd2lkdGg6MzIsaGVpZ2h0OjMyLGJvcmRlclJhZGl1czpcIjUwJVwiLGJhY2tncm91bmQ6XCJyZ2JhKDI1NSwyNTUsMjU1LDAuOSlcIixib3JkZXI6XCJub25lXCIsYm94U2hhZG93OlwiMCAycHggOHB4IHJnYmEoMCwwLDAsMC4xKVwiLGN1cnNvcjpcInBvaW50ZXJcIixkaXNwbGF5OlwiZmxleFwiLGFsaWduSXRlbXM6XCJjZW50ZXJcIixqdXN0aWZ5Q29udGVudDpcImNlbnRlclwiLGZvbnRTaXplOjE4LGNvbG9yOlwiIzU1NVwiLHRyYW5zaXRpb246XCJhbGwgLjE1c1wifX0gb25Nb3VzZUVudGVyPXtlPT5lLmN1cnJlbnRUYXJnZXQuc3R5bGUuYmFja2dyb3VuZD1cIiNmZmZcIn0gb25Nb3VzZUxlYXZlPXtlPT5lLmN1cnJlbnRUYXJnZXQuc3R5bGUuYmFja2dyb3VuZD1cInJnYmEoMjU1LDI1NSwyNTUsMC45KVwifSBvbkNsaWNrPXsoKT0+c2V0SW1nSWR4KGk9PmkrMSl9Pnsn4oC6J308L2J1dHRvbj59XHJcbiAgICAgICAgICAgIDwvZGl2PlxyXG5cclxuICAgICAgICAgICAgey8qIFJFR0VOIFNJTkdMRSBCVVRUT04gKi99XHJcbiAgICAgICAgICAgIDxidXR0b24gb25DbGljaz17KGUpPT57ZS5zdG9wUHJvcGFnYXRpb24oKTtyZWdlblNpbmdsZShpbWdJZHgpO319IGRpc2FibGVkPXtyZ0lkeD09PWltZ0lkeH0gc3R5bGU9e3twb3NpdGlvbjpcImFic29sdXRlXCIsbGVmdDo4LGJvdHRvbTo4LGJhY2tncm91bmQ6XCJyZ2JhKDAsMCwwLDAuNTUpXCIsYmFja2Ryb3BGaWx0ZXI6XCJibHVyKDRweClcIixib3JkZXI6XCJub25lXCIsYm9yZGVyUmFkaXVzOjgscGFkZGluZzpcIjVweCAxMHB4XCIsY29sb3I6XCIjZmZmXCIsZm9udFNpemU6MTEsY3Vyc29yOlwicG9pbnRlclwiLGRpc3BsYXk6XCJmbGV4XCIsYWxpZ25JdGVtczpcImNlbnRlclwiLGdhcDo0LHRyYW5zaXRpb246XCJiYWNrZ3JvdW5kIC4yc1wiLHpJbmRleDo1fX0gb25Nb3VzZUVudGVyPXtlPT5lLmN1cnJlbnRUYXJnZXQuc3R5bGUuYmFja2dyb3VuZD1cInJnYmEoMCwwLDAsMC43KVwifSBvbk1vdXNlTGVhdmU9e2U9PmUuY3VycmVudFRhcmdldC5zdHlsZS5iYWNrZ3JvdW5kPVwicmdiYSgwLDAsMCwwLjU1KVwifT5cclxuICAgICAgICAgICAgICB7cmdJZHg9PT1pbWdJZHg/PD48TG9hZGVyMiBzaXplPXsxMX0gY2xhc3NOYW1lPVwic3BpblwiLz4g5Yi35paw5LitLi4uPC8+Ojw+PFJlZnJlc2hDdyBzaXplPXsxMX0vPiDph43nlJ/miJA8Lz59XHJcbiAgICAgICAgICAgIDwvYnV0dG9uPlxyXG5cclxuICAgICAgICAgICAgey8qIFBBR0UgQ09VTlRFUiAqL31cclxuICAgICAgICAgICAgPGRpdiBzdHlsZT17e3Bvc2l0aW9uOlwiYWJzb2x1dGVcIixyaWdodDo4LGJvdHRvbTo4LGJhY2tncm91bmQ6XCJyZ2JhKDAsMCwwLDAuNDUpXCIsYmFja2Ryb3BGaWx0ZXI6XCJibHVyKDRweClcIixib3JkZXJSYWRpdXM6NixwYWRkaW5nOlwiM3B4IDhweFwiLGNvbG9yOlwiI2ZmZlwiLGZvbnRTaXplOjEwLHpJbmRleDo1fX0+e2ltZ0lkeCsxfS97bWF4SX08L2Rpdj5cclxuICAgICAgICAgIDwvZGl2PlxyXG5cclxuICAgICAgICAgIHsvKiBUSFVNQk5BSUwgU1RSSVAgKi99XHJcbiAgICAgICAgICA8ZGl2IHN0eWxlPXt7ZGlzcGxheTpcImZsZXhcIixnYXA6NCxtYXJnaW5Ub3A6OCxvdmVyZmxvd1g6XCJhdXRvXCIscGFkZGluZ0JvdHRvbTo0fX0+XHJcbiAgICAgICAgICAgIHthbGxJbWFnZXMubWFwKCh1cmwsaSk9PihcclxuICAgICAgICAgICAgICA8ZGl2IGtleT17aX0gb25DbGljaz17KCk9PnNldEltZ0lkeChpKX0gc3R5bGU9e3tmbGV4OlwiMCAwIGF1dG9cIix3aWR0aDo0NCxoZWlnaHQ6NTksYm9yZGVyUmFkaXVzOjYsb3ZlcmZsb3c6XCJoaWRkZW5cIixib3JkZXI6aT09PWltZ0lkeD9cIjJweCBzb2xpZCBcIitSOlwiMnB4IHNvbGlkIHRyYW5zcGFyZW50XCIsY3Vyc29yOlwicG9pbnRlclwiLG9wYWNpdHk6aT09PWltZ0lkeD8xOjAuNSx0cmFuc2l0aW9uOlwiYWxsIC4xNXNcIn19IG9uTW91c2VFbnRlcj17ZT0+ZS5jdXJyZW50VGFyZ2V0LnN0eWxlLm9wYWNpdHk9XCIxXCJ9IG9uTW91c2VMZWF2ZT17ZT0+e2lmKGkhPT1pbWdJZHgpZS5jdXJyZW50VGFyZ2V0LnN0eWxlLm9wYWNpdHk9XCIwLjVcIn19PlxyXG4gICAgICAgICAgICAgICAgPGltZyBzcmM9e3VybH0gYWx0PVwiXCIgc3R5bGU9e3t3aWR0aDpcIjEwMCVcIixoZWlnaHQ6XCIxMDAlXCIsb2JqZWN0Rml0OlwiY292ZXJcIixkaXNwbGF5OlwiYmxvY2tcIn19Lz5cclxuICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgKSl9XHJcbiAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICA8L2Rpdj5cclxuXHJcbiAgICAgICAgey8qIFJJR0hUOiBURVhUIENPTlRFTlQgKi99XHJcbiAgICAgICAgPGRpdiBzdHlsZT17e2ZsZXg6MSxtaW5XaWR0aDowfX0+XHJcbiAgICAgICAgICB7LyogQ1JFQVRPUiAqL308ZGl2IHN0eWxlPXt7ZGlzcGxheTpcImZsZXhcIixhbGlnbkl0ZW1zOlwiY2VudGVyXCIsZ2FwOjEwLG1hcmdpbkJvdHRvbToxMn19PjxpbWcgc3JjPXtJLmFwcGljb259IGFsdD1cIlwiIHN0eWxlPXt7d2lkdGg6MzQsaGVpZ2h0OjM0LGJvcmRlclJhZGl1czpcIjUwJVwiLG9iamVjdEZpdDpcImNvdmVyXCIsZmxleDpcIjAgMCBhdXRvXCJ9fS8+PGRpdj48ZGl2IHN0eWxlPXt7Zm9udFNpemU6MTMsZm9udFdlaWdodDo2MDAsY29sb3I6XCIjMjIyXCJ9fT7olq/ljIVBSTwvZGl2PjxkaXYgc3R5bGU9e3tmb250U2l6ZToxMSxjb2xvcjpcIiM5OTlcIn19PkFJ5Yib5L2cIMK3IOS4gOmUrueUn+aIkDwvZGl2PjwvZGl2PjxzcGFuIHN0eWxlPXt7bWFyZ2luTGVmdDpcImF1dG9cIixmb250U2l6ZToxMSxjb2xvcjpcIiM4ODhcIixiYWNrZ3JvdW5kOlwiI2Y1ZjVmNVwiLHBhZGRpbmc6XCIzcHggMTBweFwiLGJvcmRlclJhZGl1czoyMH19PntyZXN1bHQuY2F0ZWdvcnl8fFwiXCJ9PC9zcGFuPjwvZGl2PnsvKiBUSVRMRSAqL31cclxuICAgICAgICAgIDxkaXYgc3R5bGU9e3suLi5zLmNhcmRQLG1hcmdpbkJvdHRvbToxMn19PlxyXG4gICAgICAgICAgICA8ZGl2IHN0eWxlPXt7ZGlzcGxheTpcImZsZXhcIixqdXN0aWZ5Q29udGVudDpcInNwYWNlLWJldHdlZW5cIixhbGlnbkl0ZW1zOlwiZmxleC1zdGFydFwiLGdhcDo4fX0+XHJcbiAgICAgICAgICAgICAgPGgyIHN0eWxlPXt7Zm9udFNpemU6MTgsZm9udFdlaWdodDo3MDAsY29sb3I6XCIjMjIyXCIsbWFyZ2luOjAsbGluZUhlaWdodDoxLjV9fT57cmVzdWx0LnRpdGxlfTwvaDI+XHJcbiAgICAgICAgICAgICAgPHNwYW4gc3R5bGU9e3tkaXNwbGF5Olwibm9uZVwifX0vPlxyXG4gICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgIDwvZGl2PlxyXG5cclxuICAgICAgICAgIHsvKiBDVVJSRU5UIFBBR0UgKi99XHJcbiAgICAgICAgICB7Y3VyUGFnZS5wYWdlX3R5cGU9PT0nY292ZXInPzxkaXYgc3R5bGU9e3suLi5zLmNhcmRQLG1hcmdpbkJvdHRvbToxMn19PlxyXG4gICAgICAgICAgICA8ZGl2IHN0eWxlPXt7ZGlzcGxheTpcIm5vbmVcIn19PvCfk4wg5bCB6Z2iPC9kaXY+XHJcbiAgICAgICAgICAgIDxkaXYgc3R5bGU9e3tmb250U2l6ZToxNSxmb250V2VpZ2h0OjcwMCxjb2xvcjpcIiMzMzNcIixtYXJnaW5Cb3R0b206NH19PntjdXJQYWdlLmhvb2t8fGN1clBhZ2UudGl0bGV9PC9kaXY+XHJcbiAgICAgICAgICAgIHtjdXJQYWdlLnRleHQmJjxkaXYgc3R5bGU9e3tmb250U2l6ZToxMyxjb2xvcjpcIiM2NjZcIixsaW5lSGVpZ2h0OjEuNyx3aGl0ZVNwYWNlOlwicHJlLXdyYXBcIn19PntjdXJQYWdlLnRleHR9PC9kaXY+fVxyXG4gICAgICAgICAgICA8ZGl2IHN0eWxlPXt7bWFyZ2luVG9wOjgsZm9udFNpemU6MTIsY29sb3I6XCIjOTk5XCIsbGluZUhlaWdodDoxLjZ9fT48c3Ryb25nPuaOkueJiOaPkOekuu+8mjwvc3Ryb25nPntjdXJQYWdlLmxheW91dF9oaW50fHxjdXJQYWdlLnN0b3J5fHwn4oCUJ308L2Rpdj5cclxuICAgICAgICAgIDwvZGl2Pjo8ZGl2IHN0eWxlPXt7Li4ucy5jYXJkUCxtYXJnaW5Cb3R0b206MTJ9fT5cclxuICAgICAgICAgICAgPGRpdiBzdHlsZT17e2Rpc3BsYXk6XCJub25lXCJ9fT7wn5OEIFB7Y3VyUGFnZS5wYWdlX2lkfHwoaW1nSWR4KzEpfSB7Y3VyUGFnZS5lbW9qaXx8Jyd9PC9kaXY+XHJcbiAgICAgICAgICAgIDxkaXYgc3R5bGU9e3tmb250U2l6ZToxNixmb250V2VpZ2h0OjcwMCxjb2xvcjpcIiMzMzNcIixtYXJnaW5Cb3R0b206Nn19PntjdXJQYWdlLnRpdGxlfTwvZGl2PlxyXG4gICAgICAgICAgICB7Y3VyUGFnZS5ob29rJiY8ZGl2IHN0eWxlPXt7Zm9udFNpemU6MTMsY29sb3I6UixiYWNrZ3JvdW5kOlwiI0ZGRjFGM1wiLHBhZGRpbmc6XCI2cHggMTJweFwiLGJvcmRlclJhZGl1czo4LG1hcmdpbkJvdHRvbTo4LGRpc3BsYXk6XCJpbmxpbmUtYmxvY2tcIixmb250V2VpZ2h0OjUwMH19PntjdXJQYWdlLmhvb2t9PC9kaXY+fVxyXG4gICAgICAgICAgICA8ZGl2IHN0eWxlPXt7Zm9udFNpemU6MTMsY29sb3I6XCIjNTU1XCIsbGluZUhlaWdodDoxLjgsd2hpdGVTcGFjZTpcInByZS13cmFwXCJ9fT57Y3VyUGFnZS50ZXh0fHxjdXJQYWdlLnN0b3J5fHwnJ308L2Rpdj5cclxuICAgICAgICAgICAge2N1clBhZ2UuaW5mb19ibG9ja3M/Lmxlbmd0aD4wJiY8ZGl2IHN0eWxlPXt7ZGlzcGxheTpcIm5vbmVcIn19PjwvZGl2Pn1cclxuICAgICAgICAgIDwvZGl2Pn1cclxuXHJcbiAgICAgICAgICB7LyogVEFHUyAqL31cclxuICAgICAgICAgIDxkaXYgc3R5bGU9e3suLi5zLmNhcmRQLG1hcmdpbkJvdHRvbToxMn19PlxyXG4gICAgICAgICAgICA8ZGl2IHN0eWxlPXt7ZGlzcGxheTpcImZsZXhcIixqdXN0aWZ5Q29udGVudDpcInNwYWNlLWJldHdlZW5cIixhbGlnbkl0ZW1zOlwiY2VudGVyXCIsbWFyZ2luQm90dG9tOjh9fT5cclxuICAgICAgICAgICAgICA8c3BhbiBzdHlsZT17e2ZvbnRTaXplOjEzLGZvbnRXZWlnaHQ6NjAwLGRpc3BsYXk6XCJmbGV4XCIsYWxpZ25JdGVtczpcImNlbnRlclwiLGdhcDo1fX0+PEhhc2ggc2l6ZT17MTR9IGNvbG9yPXtSfS8+5qCH562+PC9zcGFuPlxyXG4gICAgICAgICAgICAgIDxzcGFuIHN0eWxlPXt7ZGlzcGxheTpcIm5vbmVcIn19Lz5cclxuICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgIDxkaXYgc3R5bGU9e3tkaXNwbGF5OlwiZmxleFwiLGZsZXhXcmFwOlwid3JhcFwiLGdhcDo1fX0+eyhyZXN1bHQuaGFzaHRhZ3N8fFtdKS5tYXAoKGgsaSk9PjxzcGFuIGtleT17aX0gc3R5bGU9e3tmb250U2l6ZToxMixjb2xvcjpSLGJhY2tncm91bmQ6XCIjRkZGMUYzXCIscGFkZGluZzpcIjRweCAxMnB4XCIsYm9yZGVyUmFkaXVzOjIwLGZvbnRXZWlnaHQ6NTAwfX0+e2h9PC9zcGFuPil9PC9kaXY+XHJcbiAgICAgICAgICA8L2Rpdj5cclxuXHJcbiAgICAgICAgICB7LyogQk9EWSBURVhUIChjb2xsYXBzaWJsZSkgKi99XHJcbiAgICAgICAgICB7cmVzdWx0LmJvZHlfdGV4dCYmPGRpdiBzdHlsZT17ey4uLnMuY2FyZFAsbWFyZ2luQm90dG9tOjEyfX0+XHJcbiAgICAgICAgICAgIDxkZXRhaWxzIHN0eWxlPXt7Zm9udFNpemU6MTQsY29sb3I6XCIjNTU1XCIsbGluZUhlaWdodDoyfX0+XHJcbiAgICAgICAgICAgICAgPHN1bW1hcnkgc3R5bGU9e3tmb250U2l6ZToxMyxmb250V2VpZ2h0OjYwMCxjdXJzb3I6XCJwb2ludGVyXCIsY29sb3I6XCIjODg4XCIsbWFyZ2luQm90dG9tOjR9fT7wn5OdIOafpeeci+WujOaVtOato+aWhzwvc3VtbWFyeT5cclxuICAgICAgICAgICAgICA8ZGl2IHN0eWxlPXt7d2hpdGVTcGFjZTpcInByZS13cmFwXCIsbWFyZ2luVG9wOjgsZm9udFNpemU6MTMsbGluZUhlaWdodDoyLGNvbG9yOlwiIzU1NVwifX0+e3Jlc3VsdC5ib2R5X3RleHR9PC9kaXY+XHJcbiAgICAgICAgICAgIDwvZGV0YWlscz5cclxuICAgICAgICAgIDwvZGl2Pn1cclxuXHJcbiAgICAgICAgICB7LyogQUNUSU9OIEJVVFRPTlMgKi99XHJcbiAgICAgICAgICA8ZGl2IHN0eWxlPXt7ZGlzcGxheTpcImZsZXhcIixnYXA6OCxmbGV4V3JhcDpcIndyYXBcIn19PlxyXG4gICAgICAgICAgICA8QnRuIHNtYWxsIG9uQ2xpY2s9e3RleHRSZWdlbn0gc3g9e3tiYWNrZ3JvdW5kOlwiI2ZmZlwiLGNvbG9yOlIsYm9yZGVyOlwiMS41cHggc29saWQgXCIrUixmb250U2l6ZToxMn19PjxSZWZyZXNoQ3cgc2l6ZT17MTJ9Lz4g6YeN5paw55Sf5oiQ5paH5qGIPC9CdG4+XHJcbiAgICAgICAgICAgIDxCdG4gc21hbGwgb25DbGljaz17KCk9PntuYXZpZ2F0b3IuY2xpcGJvYXJkPy53cml0ZVRleHQocmVzdWx0LnRpdGxlK1wiXFxuXFxuXCIrcmVzdWx0LmJvZHlfdGV4dCtcIlxcblxcblwiKyhyZXN1bHQuaGFzaHRhZ3N8fFtdKS5qb2luKFwiIFwiKSkuY2F0Y2goKCk9Pnt9KTt9fSBzeD17e2JhY2tncm91bmQ6Uixjb2xvcjpcIiNmZmZcIixib3JkZXI6XCJub25lXCIsZm9udFNpemU6MTJ9fT48c3BhbiBzdHlsZT17e2Rpc3BsYXk6XCJub25lXCJ9fS8+PC9CdG4+XHJcbiAgICAgICAgICAgIDxCdG4gc21hbGwgb25DbGljaz17KCk9PntzZXRHZW4oXCJpZGxlXCIpO3NldFJlc3VsdChudWxsKTt9fSBzeD17e2Rpc3BsYXk6XCJub25lXCJ9fT48L0J0bj5cclxuICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgIDwvZGl2PlxyXG4gICAgICA8L2Rpdj5cclxuXHJcbiAgICAgIHsvKiBQQUdFIE5BViDigJQgZ3JpZCBvZiBhbGwgcGFnZXMgKi99XHJcbiAgICAgIDxkaXYgc3R5bGU9e3tkaXNwbGF5Olwibm9uZVwifX0+XHJcbiAgICAgICAge3BhZ2VzLm1hcCgocGcsaSk9PihcclxuICAgICAgICAgIDxkaXYga2V5PXtpfSBvbkNsaWNrPXsoKT0+c2V0SW1nSWR4KGkpfSBzdHlsZT17e3BhZGRpbmc6XCI4cHggNHB4XCIsYm9yZGVyUmFkaXVzOjEwLGJvcmRlcjppbWdJZHg9PT1pP1wiMnB4IHNvbGlkIFwiK1I6XCIxLjVweCBzb2xpZCAjZjBmMGYwXCIsY3Vyc29yOlwicG9pbnRlclwiLGJhY2tncm91bmQ6aW1nSWR4PT09aT9cIiNGRkY4RjlcIjpcIiNGQUZBRkFcIix0ZXh0QWxpZ246XCJjZW50ZXJcIix0cmFuc2l0aW9uOlwiYWxsIC4xNXNcIn19PlxyXG4gICAgICAgICAgICA8ZGl2IHN0eWxlPXt7Zm9udFNpemU6MTYsbWFyZ2luQm90dG9tOjJ9fT57cGcuZW1vaml8fCfwn5OEJ308L2Rpdj5cclxuICAgICAgICAgICAgPGRpdiBzdHlsZT17e2ZvbnRTaXplOjksZm9udFdlaWdodDo2MDAsY29sb3I6aW1nSWR4PT09aT9SOlwiIzc3N1wiLGxpbmVIZWlnaHQ6MS4yfX0+e3BnLnRpdGxlPy5zbGljZSgwLDYpfHwnUCcrKGkrMSl9PC9kaXY+XHJcbiAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICApKX1cclxuICAgICAgPC9kaXY+XHJcbiAgICA8L2Rpdj5cclxuICB7bG9naW5Nb2RhbH17cHJpY2VNb2RhbH08L2Rpdj47XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGNzcygpe3JldHVybiA8c3R5bGU+e2BAa2V5ZnJhbWVzIGZhZGVJbntmcm9te29wYWNpdHk6MH10b3tvcGFjaXR5OjF9fUBrZXlmcmFtZXMgc2xpZGVVcHtmcm9te29wYWNpdHk6MDt0cmFuc2Zvcm06dHJhbnNsYXRlWSgxNnB4KX10b3tvcGFjaXR5OjE7dHJhbnNmb3JtOnRyYW5zbGF0ZVkoMCl9fUBrZXlmcmFtZXMgZmxvYXR7MCUsMTAwJXt0cmFuc2Zvcm06dHJhbnNsYXRlWSgwKX01MCV7dHJhbnNmb3JtOnRyYW5zbGF0ZVkoLTEwcHgpfX1Aa2V5ZnJhbWVzIHB1bHNlezAlLDEwMCV7b3BhY2l0eToxfTUwJXtvcGFjaXR5OjAuNH19QGtleWZyYW1lcyBzY3JvbGwtaHswJXt0cmFuc2Zvcm06dHJhbnNsYXRlWCgwKX0xMDAle3RyYW5zZm9ybTp0cmFuc2xhdGVYKC01MCUpfX1Aa2V5ZnJhbWVzIHNwaW57MCV7dHJhbnNmb3JtOnJvdGF0ZSgwKX0xMDAle3RyYW5zZm9ybTpyb3RhdGUoMzYwZGVnKX19LnNwaW57YW5pbWF0aW9uOnNwaW4gMXMgbGluZWFyIGluZmluaXRlfSo6Oi13ZWJraXQtc2Nyb2xsYmFye3dpZHRoOjRweH0qOjotd2Via2l0LXNjcm9sbGJhci10aHVtYntiYWNrZ3JvdW5kOiNlOGU4ZTg7Ym9yZGVyLXJhZGl1czoycHh9OjpzZWxlY3Rpb257YmFja2dyb3VuZDojRkZFMEU0fWB9PC9zdHlsZT47fVxyXG5cclxuLyog4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQIEdBTExFUlkgQ0FSRCDilZDilZDilZDilZDilZDilZDilZAgKi9cclxuZnVuY3Rpb24gR0NhcmQoe2l0ZW0sb25DbGlja30pe2NvbnN0W2gsc2V0SF09dXNlU3RhdGUoZmFsc2UpO3JldHVybiA8Q2FyZCBob3ZlciBvbkNsaWNrPXtvbkNsaWNrfSBzeD17e292ZXJmbG93OlwiaGlkZGVuXCJ9fT5cclxuICA8ZGl2IHN0eWxlPXt7YmFja2dyb3VuZDppdGVtLmdyYWQsaGVpZ2h0OjE0MCxwb3NpdGlvbjpcInJlbGF0aXZlXCJ9fSBvbk1vdXNlRW50ZXI9eygpPT5zZXRIKHRydWUpfSBvbk1vdXNlTGVhdmU9eygpPT5zZXRIKGZhbHNlKX0+XHJcbiAgICA8ZGl2IHN0eWxlPXt7cG9zaXRpb246XCJhYnNvbHV0ZVwiLGluc2V0OjAsYmFja2dyb3VuZDpcImxpbmVhci1ncmFkaWVudCh0cmFuc3BhcmVudCA0MCUscmdiYSgwLDAsMCwwLjUpKVwifX0vPlxyXG4gICAgPHNwYW4gc3R5bGU9e3twb3NpdGlvbjpcImFic29sdXRlXCIsdG9wOjEwLGxlZnQ6MTAsZm9udFNpemU6MTAsYmFja2dyb3VuZDpcInJnYmEoMjU1LDI1NSwyNTUsMC4yKVwiLGNvbG9yOlwiI2ZmZlwiLHBhZGRpbmc6XCIzcHggMTBweFwiLGJvcmRlclJhZGl1czo4LGJhY2tkcm9wRmlsdGVyOlwiYmx1cig0cHgpXCJ9fT57aXRlbS5jYXR9PC9zcGFuPlxyXG4gICAge2gmJjxkaXYgc3R5bGU9e3twb3NpdGlvbjpcImFic29sdXRlXCIsaW5zZXQ6MCxiYWNrZ3JvdW5kOlwicmdiYSgwLDAsMCwwLjI1KVwiLGRpc3BsYXk6XCJmbGV4XCIsYWxpZ25JdGVtczpcImNlbnRlclwiLGp1c3RpZnlDb250ZW50OlwiY2VudGVyXCIsYW5pbWF0aW9uOlwiZmFkZUluIDAuMTVzXCJ9fT48c3BhbiBzdHlsZT17e2JhY2tncm91bmQ6XCJyZ2JhKDI1NSwyNTUsMjU1LDAuOTUpXCIsY29sb3I6Uixmb250U2l6ZToxMixmb250V2VpZ2h0OjYwMCxwYWRkaW5nOlwiOHB4IDE4cHhcIixib3JkZXJSYWRpdXM6MTAsZGlzcGxheTpcImZsZXhcIixhbGlnbkl0ZW1zOlwiY2VudGVyXCIsZ2FwOjUsYm94U2hhZG93OlwiMCA0cHggMTJweCByZ2JhKDAsMCwwLDAuMSlcIn19PjxFeWUgc2l6ZT17MTN9Lz7mn6XnnIvlhajlpZflhoXlrrk8L3NwYW4+PC9kaXY+fVxyXG4gIDwvZGl2PlxyXG4gIDxkaXYgc3R5bGU9e3twYWRkaW5nOlwiMTJweCAxNHB4XCJ9fT5cclxuICAgIDxkaXYgc3R5bGU9e3tmb250U2l6ZToxMyxmb250V2VpZ2h0OjYwMCxsaW5lSGVpZ2h0OjEuNSxtYXJnaW5Cb3R0b206NixkaXNwbGF5OlwiLXdlYmtpdC1ib3hcIixXZWJraXRMaW5lQ2xhbXA6MixXZWJraXRCb3hPcmllbnQ6XCJ2ZXJ0aWNhbFwiLG92ZXJmbG93OlwiaGlkZGVuXCIsZm9udEZhbWlseTpcIidQaW5nRmFuZyBTQycsJ01pY3Jvc29mdCBZYUhlaScsJ05vdG8gU2FucyBTQycsc2Fucy1zZXJpZlwifX0+e2l0ZW0udGl0bGV9PC9kaXY+XHJcbiAgICA8ZGl2IHN0eWxlPXt7ZGlzcGxheTpcImZsZXhcIixqdXN0aWZ5Q29udGVudDpcInNwYWNlLWJldHdlZW5cIixhbGlnbkl0ZW1zOlwiY2VudGVyXCJ9fT48c3BhbiBzdHlsZT17e2ZvbnRTaXplOjEwLGNvbG9yOlwiI2NjY1wiLGRpc3BsYXk6XCJmbGV4XCIsYWxpZ25JdGVtczpcImNlbnRlclwiLGdhcDozfX0+PEhlYXJ0IHNpemU9ezEwfS8+e2l0ZW0ubGlrZXN9PC9zcGFuPjxzcGFuIHN0eWxlPXt7Zm9udFNpemU6OSxjb2xvcjpcIiNlMGUwZTBcIixmb250U3R5bGU6XCJpdGFsaWNcIn19PuiWr+WMhUFJ5Ye65ZOBPC9zcGFuPjwvZGl2PlxyXG4gIDwvZGl2PlxyXG48L0NhcmQ+O31cclxuXHJcbi8qIOKVkOKVkOKVkOKVkOKVkOKVkOKVkCBNQUlOIEFQUCDilZDilZDilZDilZDilZDilZDilZAgKi9cclxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gQXBwKCl7XHJcbiAgY29uc3RbcGcsc2V0UGddPXVzZVN0YXRlKFwiaG9tZVwiKTtcclxuICBjb25zdFtsb2dnZWQsc2V0TG9nZ2VkXT11c2VTdGF0ZShmYWxzZSk7XHJcbiAgY29uc3Rbc2hvd0xvZ2luLHNldFNob3dMb2dpbl09dXNlU3RhdGUoZmFsc2UpO1xyXG4gIGNvbnN0W3Nob3dQcmljZSxzZXRTaG93UHJpY2VdPXVzZVN0YXRlKGZhbHNlKTtcclxuICBjb25zdFt0ZXh0LHNldFRleHRdPXVzZVN0YXRlKFwiXCIpO1xyXG4gIGNvbnN0W2dlbixzZXRHZW5dPXVzZVN0YXRlKFwiaWRsZVwiKTtcclxuICBjb25zdFtzdGFnZSxzZXRTdGFnZV09dXNlU3RhdGUoMCk7XHJcbiAgY29uc3RbcmVzdWx0LHNldFJlc3VsdF09dXNlU3RhdGUobnVsbCk7XHJcbiAgY29uc3Rbd29ya3Msc2V0V29ya3NdPXVzZVN0YXRlKFtdKTtcclxuICBjb25zdFtwdHMsc2V0UHRzU109dXNlU3RhdGUoMSk7XHJcbiAgY29uc3RbcmVnZW5TdGF0ZSxzZXRSZWdlblN0YXRlXT11c2VTdGF0ZSh7YWN0aXZlOmZhbHNlLG1zZzonJ30pO1xyXG4gIGNvbnN0IGxhc3RXb3JrSWRSZWY9dXNlUmVmKCcnKTtcclxuICB1c2VFZmZlY3QoZnVuY3Rpb24oKXtpZihyZXN1bHQ/Ll9pbnB1dFRleHQpbGFzdFdvcmtJZFJlZi5jdXJyZW50PXJlc3VsdC5faW5wdXRUZXh0O30sW3Jlc3VsdD8uX2lucHV0VGV4dF0pO1xyXG4gIC8vIEZsb2F0aW5nIHJlZ2VuIGluZGljYXRvciAoRE9NIGRpcmVjdCDigJQgc3Vydml2ZXMgZWFybHkgcmV0dXJucyAmIG1vZGFsIGNsb3NlKVxyXG4gIHVzZUVmZmVjdChmdW5jdGlvbigpe1xyXG4gICAgdmFyIGVsPWRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdfX3JlZ2VuX2JhcicpO1xyXG4gICAgaWYoIWVsKXtlbD1kb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtlbC5pZD0nX19yZWdlbl9iYXInO2RvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQoZWwpO31cclxuICAgIGlmKHJlZ2VuU3RhdGUuYWN0aXZlKXtcclxuICAgICAgZWwuc3R5bGUuY3NzVGV4dD0ncG9zaXRpb246Zml4ZWQ7Ym90dG9tOjI0cHg7bGVmdDo1MCU7dHJhbnNmb3JtOnRyYW5zbGF0ZVgoLTUwJSk7ei1pbmRleDo5OTk5OTtiYWNrZ3JvdW5kOiMxYTFhMmU7Y29sb3I6I2ZmZjtwYWRkaW5nOjEycHggMjRweDtib3JkZXItcmFkaXVzOjE0cHg7Zm9udC1zaXplOjEzcHg7Zm9udC13ZWlnaHQ6NTAwO2Rpc3BsYXk6ZmxleDthbGlnbi1pdGVtczpjZW50ZXI7Z2FwOjEwcHg7Ym94LXNoYWRvdzowIDhweCAzMnB4IHJnYmEoMCwwLDAsMC4yNSk7YW5pbWF0aW9uOmZhZGVJbiAuMnMnO1xyXG4gICAgICBlbC5pbm5lckhUTUw9JzxzcGFuIHN0eWxlPVwid2lkdGg6MTZweDtoZWlnaHQ6MTZweDtib3JkZXI6Mi41cHggc29saWQgcmdiYSgyNTUsMjU1LDI1NSwwLjI1KTtib3JkZXItdG9wLWNvbG9yOiNmZmY7Ym9yZGVyLXJhZGl1czo1MCU7YW5pbWF0aW9uOnNwaW4gLjZzIGxpbmVhciBpbmZpbml0ZTtkaXNwbGF5OmlubGluZS1ibG9jaztmbGV4LXNocmluazowXCI+PC9zcGFuPicrcmVnZW5TdGF0ZS5tc2crJzxzcGFuIHN0eWxlPVwiZm9udC1zaXplOjExO2NvbG9yOnJnYmEoMjU1LDI1NSwyNTUsMC41KTttYXJnaW4tbGVmdDo0cHhcIj7nlJ/miJDlrozmiJDlkI7oh6rliqjmm7TmlrA8L3NwYW4+JztcclxuICAgICAgZWwuc3R5bGUuZGlzcGxheT0nZmxleCc7XHJcbiAgICB9IGVsc2UgeyBlbC5zdHlsZS5kaXNwbGF5PSdub25lJzsgfVxyXG4gIH0sW3JlZ2VuU3RhdGUuYWN0aXZlLHJlZ2VuU3RhdGUubXNnXSk7XHJcbiAgY29uc3RbdGlwSWR4LHNldFRpcElkeF09dXNlU3RhdGUoMCk7XHJcbiAgY29uc3RbYVBnLHNldEFQZ109dXNlU3RhdGUobnVsbCk7XHJcbiAgY29uc3RbZ0l0ZW0sc2V0R0l0ZW1dPXVzZVN0YXRlKG51bGwpO1xyXG4gIGNvbnN0W2VycixzZXRFcnJdPXVzZVN0YXRlKFwiXCIpO1xyXG4gIGNvbnN0W2Nhcm91c2VsSWR4LHNldENhcm91c2VsSWR4XT11c2VTdGF0ZSgwKTtcclxuICBjb25zdCBmcmVlVXNlZD11c2VSZWYoZmFsc2UpO1xyXG4gIGNvbnN0IHRtPXVzZVJlZihbXSk7XHJcblxyXG4gIHVzZUVmZmVjdCgoKT0+e2xvYWRXb3JrcygpLnRoZW4oc2V0V29ya3MpO2dldFB0cygpLnRoZW4oc2V0UHRzUyk7fSxbXSk7XHJcbiAgdXNlRWZmZWN0KCgpPT57aWYoZ2VuPT09XCJsb2FkaW5nXCIpe2NvbnN0IHQ9c2V0SW50ZXJ2YWwoKCk9PnNldFRpcElkeChpPT4oaSsxKSVUSVBTLmxlbmd0aCksNDAwMCk7cmV0dXJuKCk9PmNsZWFySW50ZXJ2YWwodCk7fX0sW2dlbl0pO1xyXG4gIHVzZUVmZmVjdCgoKT0+e2lmKGdlbiE9PVwibG9hZGluZ1wiKXtjb25zdCB0PXNldEludGVydmFsKCgpPT5zZXRDYXJvdXNlbElkeChpPT4oaSsxKSVRVUlDS19ISU5UUy5sZW5ndGgpLDMwMDApO3JldHVybigpPT5jbGVhckludGVydmFsKHQpO319LFtnZW5dKTtcclxuXHJcbiAgY29uc3QgZG9HZW49YXN5bmMoKT0+e2lmKCF0ZXh0LnRyaW0oKSlyZXR1cm47XHJcbiAgICBpZighbG9nZ2VkJiZmcmVlVXNlZC5jdXJyZW50KXtzZXRTaG93TG9naW4odHJ1ZSk7cmV0dXJuO31cclxuICAgIGlmKHB0czw9MCYmbG9nZ2VkKXtzZXRTaG93UHJpY2UodHJ1ZSk7cmV0dXJuO31cclxuICAgIHNldEdlbihcImxvYWRpbmdcIik7c2V0RXJyKFwiXCIpO3NldFN0YWdlKDApO3NldFJlc3VsdChudWxsKTt0bS5jdXJyZW50LmZvckVhY2goY2xlYXJUaW1lb3V0KTtcclxuICAgIHRtLmN1cnJlbnQ9W3NldFRpbWVvdXQoKCk9PnNldFN0YWdlKDEpLDNlMyksc2V0VGltZW91dCgoKT0+c2V0U3RhZ2UoMiksOGUzKSxzZXRUaW1lb3V0KCgpPT5zZXRTdGFnZSgzKSwxNGUzKV07XHJcbiAgICB0cnl7Y29uc3Qgcj1hd2FpdCBnZW5BUEkodGV4dCxcclxuICAgICAgLy8gb25JbWc6IOavj+eUn+aIkOS4gOW8oOWbvuWwseaYvuekuuWIsOW8ueeql++8jOS4jeetieWFqOmDqOWujOaIkFxyXG4gICAgICBmdW5jdGlvbihkKXtcclxuICAgICAgICBzZXRSZXN1bHQoZnVuY3Rpb24ocHJldil7XHJcbiAgICAgICAgICBpZihwcmV2Py50aXRsZSlyZXR1cm4gcHJldjtcclxuICAgICAgICAgIGlmKCFwcmV2KXtcclxuICAgICAgICAgICAgdmFyIGluaXQ9e19pbnB1dFRleHQ6dGV4dCwgY292ZXJfdXJsOmQuaWQ9PT0nY292ZXInP2QudXJsOicnLCBpbWFnZV91cmxzOmQuaWQhPT0nY292ZXInJiZkLnVybD9bZC51cmxdOltdfTtcclxuICAgICAgICAgICAgLy8g5LiN5o+Q5YmN5bGV56S65by556qX77yM562JY29tcGxldGXkuovku7blho3mmL7npLpcclxuICAgICAgICAgICAgcmV0dXJuIGluaXQ7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgICBpZihkLmlkPT09J2NvdmVyJylyZXR1cm57Li4ucHJldixjb3Zlcl91cmw6ZC51cmx9O1xyXG4gICAgICAgICAgaWYoZC51cmwpcmV0dXJuey4uLnByZXYsaW1hZ2VfdXJsczpbLi4uKHByZXYuaW1hZ2VfdXJsc3x8W10pLGQudXJsXX07XHJcbiAgICAgICAgICByZXR1cm4gcHJldjtcclxuICAgICAgICB9KTtcclxuICAgICAgfSk7XHJcbiAgICAgIHRtLmN1cnJlbnQuZm9yRWFjaChjbGVhclRpbWVvdXQpO3NldFN0YWdlKDQpO1xyXG4gICAgICAvLyDlhYjkv53lrZjvvIzlho3lsZXnpLrlvLnnqpfvvIjpmLLmraLkv53lrZjlpLHotKXvvIlcclxuICAgICAgdHJ5e2NvbnN0IG5wPXB0cy0xO3NldFB0c1MobnApO2F3YWl0IHNldFB0cyhucCk7dmFyIHdkPXt0aXRsZTpyLnRpdGxlLGNhdGVnb3J5OnIuY2F0ZWdvcnksYm9keV90ZXh0OnIuYm9keV90ZXh0LGhhc2h0YWdzOnIuaGFzaHRhZ3MscGFnZXM6ci5wYWdlcyxfaW5wdXRUZXh0OnRleHQsY292ZXJfdXJsOnIuY292ZXJfdXJsfHwnJyxpbWFnZV91cmxzOnIuaW1hZ2VfdXJsc3x8W10sY292ZXJfcHJvbXB0OnIuY292ZXJfcHJvbXB0fHwnJyxpbWFnZV9wcm9tcHRzOnIuaW1hZ2VfcHJvbXB0c3x8W10sX3NhdmVLZXk6RGF0ZS5ub3coKX07YXdhaXQgc2F2ZVdvcmsod2QpO3NldFdvcmtzKGZ1bmN0aW9uKHByZXYpe3JldHVyblt7Li4ud2QsaWQ6RGF0ZS5ub3coKSxhdDpuZXcgRGF0ZSgpLnRvTG9jYWxlRGF0ZVN0cmluZygnemgtQ04nKX0sLi4ucHJldi5maWx0ZXIoZnVuY3Rpb24oeCl7cmV0dXJuIHguX2lucHV0VGV4dCE9PXRleHR8fHguX3NhdmVLZXk9PT13ZC5fc2F2ZUtleTt9KV19KTt9Y2F0Y2goZSl7Y29uc29sZS53YXJuKCdzYXZlV29yayBlcnJvcjonLGUpO31cclxuICAgICAgc2V0UmVzdWx0KGZ1bmN0aW9uKCl7cmV0dXJuIHsuLi5yLF9pbnB1dFRleHQ6dGV4dH07fSk7XHJcbiAgICAgIHNldEdlbihcInJlc3VsdFwiKTsgLy8g5L+d5a2Y5a6M5oiQ5ZCO5YaN5bGV56S65by556qXXHJcbiAgICB9Y2F0Y2goZSl7dG0uY3VycmVudC5mb3JFYWNoKGNsZWFyVGltZW91dCk7c2V0RXJyKGUubWVzc2FnZSk7c2V0R2VuKFwiaWRsZVwiKTt9fTtcclxuXHJcbiAgY29uc3QgdGV4dFJlZ2VuPWFzeW5jKCk9PntcclxuICAgIHZhciBpbnA9cmVzdWx0Py5faW5wdXRUZXh0fHx0ZXh0O1xyXG4gICAgaWYoIWlucCl7YWxlcnQoXCLml6Dms5Xmib7liLDljp/lp4vovpPlhaVcIik7cmV0dXJuO31cclxuICAgIGlmKCFjb25maXJtKFwi6YeN5paw55Sf5oiQ5paH5qGI5bCG5raI6ICX6aKd5bqm77yM56Gu5a6a77yfXCIpKXJldHVybjtcclxuICAgIHZhciBvdj1kb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpO1xyXG4gICAgb3Yuc3R5bGUuY3NzVGV4dD1cInBvc2l0aW9uOmZpeGVkO2luc2V0OjA7ei1pbmRleDo5OTk5OTtiYWNrZ3JvdW5kOnJnYmEoMCwwLDAsMC41NSk7ZGlzcGxheTpmbGV4O2ZsZXgtZGlyZWN0aW9uOmNvbHVtbjthbGlnbi1pdGVtczpjZW50ZXI7anVzdGlmeS1jb250ZW50OmNlbnRlcjtiYWNrZHJvcC1maWx0ZXI6Ymx1cig2cHgpO2FuaW1hdGlvbjpmYWRlSW4gLjE1c1wiO1xyXG4gICAgb3YuaW5uZXJIVE1MPSc8ZGl2IHN0eWxlPVwiYmFja2dyb3VuZDojZmZmO2JvcmRlci1yYWRpdXM6MjBweDtwYWRkaW5nOjMycHggNDBweDt0ZXh0LWFsaWduOmNlbnRlcjtib3gtc2hhZG93OjAgMjBweCA2MHB4IHJnYmEoMCwwLDAsMC4zKTthbmltYXRpb246c2xpZGVVcCAuMjVzXCI+PHN2ZyB2aWV3Qm94PVwiMCAwIDI0IDI0XCIgd2lkdGg9XCI0MFwiIGhlaWdodD1cIjQwXCIgZmlsbD1cIm5vbmVcIiBzdHJva2U9XCIjRkY0NzU3XCIgc3Ryb2tlLXdpZHRoPVwiMi41XCIgc3Ryb2tlLWxpbmVjYXA9XCJyb3VuZFwiIGNsYXNzPVwic3BpblwiPjxwYXRoIGQ9XCJNMTIgMnY0XCIvPjxwYXRoIGQ9XCJNMTIgMTh2NFwiLz48cGF0aCBkPVwiTTQuOTMgNC45M2wyLjgzIDIuODNcIi8+PHBhdGggZD1cIk0xNi4yNCAxNi4yNGwyLjgzIDIuODNcIi8+PHBhdGggZD1cIk0yIDEyaDRcIi8+PHBhdGggZD1cIk0xOCAxMmg0XCIvPjxwYXRoIGQ9XCJNNC45MyAxOS4wN2wyLjgzLTIuODNcIi8+PHBhdGggZD1cIk0xNi4yNCA3Ljc2bDIuODMtMi44M1wiLz48L3N2Zz48ZGl2IHN0eWxlPVwiZm9udC1zaXplOjE3cHg7Zm9udC13ZWlnaHQ6NzAwO21hcmdpbi10b3A6MTZweDtjb2xvcjojMzMzXCI+4pyN77iPIOato+WcqOmHjeaWsOeUn+aIkOaWh+eroDwvZGl2PjxkaXYgc3R5bGU9XCJmb250LXNpemU6MTNweDtjb2xvcjojOTk5O21hcmdpbi10b3A6NnB4XCI+6K+35Yu/5Yi35paw5oiW5YWz6Zet6aG16Z2i77yM5ZCm5YiZ5Lya5raI6ICX6aKd5bqmPC9kaXY+PC9kaXY+JztcclxuICAgIGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQob3YpO1xyXG4gICAgdHJ5e1xyXG4gICAgICB2YXIgcj1hd2FpdCBmZXRjaChBUEkrXCIvYXBpL3JlZ2VuZXJhdGUtdGV4dFwiLHttZXRob2Q6XCJQT1NUXCIsaGVhZGVyczp7XCJDb250ZW50LVR5cGVcIjpcImFwcGxpY2F0aW9uL2pzb25cIn0sYm9keTpKU09OLnN0cmluZ2lmeSh7dGV4dDppbnB9KX0pO1xyXG4gICAgICBpZighci5vayl0aHJvdyBFcnJvcihcIkVcIik7XHJcbiAgICAgIHZhciBkMj1hd2FpdCByLmpzb24oKTtcclxuICAgICAgc2V0UmVzdWx0KHA9Pih7Li4ucCx0aXRsZTpkMi50aXRsZSxib2R5X3RleHQ6ZDIuYm9keV90ZXh0LGhhc2h0YWdzOmQyLmhhc2h0YWdzLGNhdGVnb3J5OmQyLmNhdGVnb3J5LF9pbnB1dFRleHR9KSk7XHJcbiAgICB9Y2F0Y2goZSl7YWxlcnQoXCLph43mlrDnlJ/miJDlpLHotKVcIik7fVxyXG4gICAgb3YucmVtb3ZlKCk7XHJcbiAgfTtcclxuXHJcbiAgLyog4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQIE5BViDilZDilZDilZDilZDilZDilZDilZAgKi9cclxuICBjb25zdCBuYXY9PG5hdiBzdHlsZT17e2Rpc3BsYXk6XCJmbGV4XCIsYWxpZ25JdGVtczpcImNlbnRlclwiLGp1c3RpZnlDb250ZW50OlwiY2VudGVyXCIscGFkZGluZzpcIjEwcHggMjhweFwiLGJhY2tncm91bmQ6XCJyZ2JhKDI1NSwyNTUsMjU1LDAuOTIpXCIsYm9yZGVyQm90dG9tOlwiMXB4IHNvbGlkICNmMGYwZjBcIixwb3NpdGlvbjpcInN0aWNreVwiLHRvcDowLHpJbmRleDoxMDAsYmFja2Ryb3BGaWx0ZXI6XCJibHVyKDE0cHgpXCJ9fT5cclxuICAgIDxkaXYgc3R5bGU9e3ttYXhXaWR0aDoxMTAwLHdpZHRoOlwiMTAwJVwiLGRpc3BsYXk6XCJmbGV4XCIsYWxpZ25JdGVtczpcImNlbnRlclwiLGp1c3RpZnlDb250ZW50Olwic3BhY2UtYmV0d2VlblwifX0+XHJcbiAgICA8ZGl2IHN0eWxlPXt7ZGlzcGxheTpcImZsZXhcIixhbGlnbkl0ZW1zOlwiY2VudGVyXCIsZ2FwOjIwfX0+XHJcbiAgICAgIDxkaXYgc3R5bGU9e3tkaXNwbGF5OlwiZmxleFwiLGFsaWduSXRlbXM6XCJjZW50ZXJcIixnYXA6OCxjdXJzb3I6XCJwb2ludGVyXCJ9fSBvbkNsaWNrPXsoKT0+e3NldFBnKFwiaG9tZVwiKTtzZXRHZW4oXCJpZGxlXCIpO3NldFJlc3VsdChudWxsKTtzZXRHSXRlbShudWxsKTt9fT5cclxuICAgICAgICA8aW1nIHNyYz17SS5hcHBpY29ufSBhbHQ9XCLolq/ljIVBSVwiIHN0eWxlPXt7d2lkdGg6MzAsaGVpZ2h0OjMwLGJvcmRlclJhZGl1czo4fX0vPlxyXG4gICAgICAgIDxzcGFuIHN0eWxlPXt7Zm9udFNpemU6MTYsZm9udFdlaWdodDo3MDAsY29sb3I6Uixmb250RmFtaWx5OlwiUGluZ0ZhbmcgU0MsTWljcm9zb2Z0IFlhSGVpLHNhbnMtc2VyaWZcIixsZXR0ZXJTcGFjaW5nOlwiMC41cHhcIn19PuiWr+WMhUFJPC9zcGFuPlxyXG4gICAgICA8L2Rpdj5cclxuICAgICAgPGRpdiBzdHlsZT17e2Rpc3BsYXk6XCJmbGV4XCIsZ2FwOjR9fT57W1tcImhvbWVcIixcIummlumhtVwiXSxbXCJnYWxsZXJ5XCIsXCLolq/ljIXlh7rlk4FcIl0sW1wicHJpY2luZ1wiLFwi5Lu35qC85pa55qGIXCJdLFtcIndvcmtzXCIsXCLmiJHnmoTkvZzlk4FcIl1dLm1hcCgoW2ssdl0pPT48YnV0dG9uIGtleT17a30gb25DbGljaz17KCk9PntzZXRQZyhrKTtpZihrPT09XCJ3b3Jrc1wiKWxvYWRXb3JrcygpLnRoZW4oc2V0V29ya3MpO319IHN0eWxlPXt7Zm9udFNpemU6MTMsZm9udEZhbWlseTpcIidQaW5nRmFuZyBTQycsJ01pY3Jvc29mdCBZYUhlaScsJ05vdG8gU2FucyBTQycsc2Fucy1zZXJpZlwiLGNvbG9yOnBnPT09az9SOlwiIzc3N1wiLGZvbnRXZWlnaHQ6cGc9PT1rPzYwMDo0MDAsYmFja2dyb3VuZDpcIm5vbmVcIixib3JkZXI6XCJub25lXCIscGFkZGluZzpcIjZweCAxMnB4XCIsY3Vyc29yOlwicG9pbnRlclwiLGJvcmRlclJhZGl1czo4LHRyYW5zaXRpb246XCJhbGwgMC4xNXNcIn19Pnt2fTwvYnV0dG9uPil9PC9kaXY+XHJcbiAgICA8L2Rpdj5cclxuICAgIDxkaXYgc3R5bGU9e3tkaXNwbGF5OlwiZmxleFwiLGFsaWduSXRlbXM6XCJjZW50ZXJcIixnYXA6OH19Pntsb2dnZWQmJjxzcGFuIHN0eWxlPXt7Zm9udFNpemU6MTEsY29sb3I6UixiYWNrZ3JvdW5kOlwiI0ZGRjFGM1wiLHBhZGRpbmc6XCI0cHggMTJweFwiLGJvcmRlclJhZGl1czoyMCxmb250V2VpZ2h0OjYwMCxkaXNwbGF5OlwiZmxleFwiLGFsaWduSXRlbXM6XCJjZW50ZXJcIixnYXA6NH19PjxTcGFya2xlcyBzaXplPXsxMX0vPntwdHN95aWXPC9zcGFuPn08QnRuIHNtYWxsIG9uQ2xpY2s9eygpPT5sb2dnZWQ/c2V0TG9nZ2VkKGZhbHNlKTpzZXRTaG93TG9naW4odHJ1ZSl9IHN4PXt7YmFja2dyb3VuZDpsb2dnZWQ/XCIjRjBGRkY0XCI6XCIjZjVmNWY1XCIsY29sb3I6bG9nZ2VkP0c6XCIjNzc3XCIsYm9yZGVyOlwibm9uZVwifX0+e2xvZ2dlZD88PjxDaGVjayBzaXplPXsxMn0vPuW3sueZu+W9lTwvPjo8PjxMb2dJbiBzaXplPXsxMn0vPueZu+W9lTwvPn08L0J0bj48L2Rpdj5cclxuICAgIDwvZGl2PlxyXG4gIDwvbmF2PjtcclxuXHJcbiAgY29uc3QgbG9naW5Nb2RhbD1zaG93TG9naW4mJjxNb2RhbCBvbkNsb3NlPXsoKT0+c2V0U2hvd0xvZ2luKGZhbHNlKX0+PGRpdiBzdHlsZT17e3RleHRBbGlnbjpcImNlbnRlclwiLG1hcmdpbkJvdHRvbToyNH19PjxDaGFySW1nIHNyYz17SS53YXZlfSBhbHQ9XCJcIiBzdHlsZT17e2hlaWdodDo2NH19Lz48ZGl2IHN0eWxlPXt7Zm9udFNpemU6MjAsZm9udFdlaWdodDo3MDAsbWFyZ2luVG9wOjh9fT7mrKLov47mnaXliLDolq/ljIVBSTwvZGl2PjxkaXYgc3R5bGU9e3tmb250U2l6ZToxMyxjb2xvcjpcIiM5OTlcIn19PuWwj+e6ouS5pueIhuasvuWbvuaWh++8jOS4gOmUrueUn+aIkDwvZGl2PjwvZGl2PlxyXG4gICAgPGlucHV0IHBsYWNlaG9sZGVyPVwi5omL5py65Y+3XCIgc3R5bGU9e3t3aWR0aDpcIjEwMCVcIixwYWRkaW5nOlwiMTJweCAxNnB4XCIsYm9yZGVyOlwiMS41cHggc29saWQgI2VlZVwiLGJvcmRlclJhZGl1czoxMixmb250U2l6ZToxNCxtYXJnaW5Cb3R0b206MTAsYm94U2l6aW5nOlwiYm9yZGVyLWJveFwiLG91dGxpbmU6XCJub25lXCJ9fS8+PGlucHV0IHBsYWNlaG9sZGVyPVwi6aqM6K+B56CBXCIgc3R5bGU9e3t3aWR0aDpcIjEwMCVcIixwYWRkaW5nOlwiMTJweCAxNnB4XCIsYm9yZGVyOlwiMS41cHggc29saWQgI2VlZVwiLGJvcmRlclJhZGl1czoxMixmb250U2l6ZToxNCxtYXJnaW5Cb3R0b206MjAsYm94U2l6aW5nOlwiYm9yZGVyLWJveFwiLG91dGxpbmU6XCJub25lXCJ9fS8+PEJ0biBwcmltYXJ5IGZ1bGwgb25DbGljaz17KCk9PntzZXRMb2dnZWQodHJ1ZSk7c2V0U2hvd0xvZ2luKGZhbHNlKTt9fT48TG9nSW4gc2l6ZT17MTV9Lz7nmbvlvZUgLyDms6jlhow8L0J0bj48ZGl2IHN0eWxlPXt7dGV4dEFsaWduOlwiY2VudGVyXCIsbWFyZ2luVG9wOjEwLGZvbnRTaXplOjEwLGNvbG9yOlwiI2RkZFwifX0+55m75b2V5ZCO5Y+v5oqK5L2c5ZOB5L+d5a2Y5Yiw5Liq5Lq65L2c5ZOB6ZuGPC9kaXY+PC9Nb2RhbD47XHJcbiAgY29uc3QgcHJpY2VNb2RhbD1zaG93UHJpY2UmJjxNb2RhbCBvbkNsb3NlPXsoKT0+c2V0U2hvd1ByaWNlKGZhbHNlKX0+PGRpdiBzdHlsZT17e3RleHRBbGlnbjpcImNlbnRlclwiLG1hcmdpbkJvdHRvbToyMH19PjxDaGFySW1nIHNyYz17SS51cGdyYWRlfSBhbHQ9XCJcIiBzdHlsZT17e2hlaWdodDo4MH19IGZpbHRlcj1cImRyb3Atc2hhZG93KDAgNnB4IDE2cHggcmdiYSgyNTUsNzEsODcsMC4xNSkpXCIvPjxkaXYgc3R5bGU9e3tmb250U2l6ZToyMCxmb250V2VpZ2h0OjcwMCxtYXJnaW5Ub3A6OH19PumAieaLqeWll+mkkOWFheWAvDwvZGl2PjxkaXYgc3R5bGU9e3tmb250U2l6ZToxMixjb2xvcjpcIiM5OTlcIn19PuaMieWll+aUtui0ue+8jOS4jeiHquWKqOe7rei0ue+8jOeUqOWkmuWwkeS5sOWkmuWwkTwvZGl2PjwvZGl2PlxyXG4gICAgPGRpdiBzdHlsZT17e2Rpc3BsYXk6XCJmbGV4XCIsZmxleERpcmVjdGlvbjpcImNvbHVtblwiLGdhcDo4fX0+e1BSSUNJTkcubWFwKChwLGkpPT48ZGl2IGtleT17aX0gb25DbGljaz17KCk9PntzZXRQdHNTKHB0cytwLnNldHMpO3NldFB0cyhwdHMrcC5zZXRzKTtzZXRTaG93UHJpY2UoZmFsc2UpO319IHN0eWxlPXt7ZGlzcGxheTpcImZsZXhcIixhbGlnbkl0ZW1zOlwiY2VudGVyXCIsanVzdGlmeUNvbnRlbnQ6XCJzcGFjZS1iZXR3ZWVuXCIscGFkZGluZzpcIjE0cHggMThweFwiLGJvcmRlclJhZGl1czoxNCxib3JkZXI6cC5wb3A/XCIycHggc29saWQgXCIrUjpcIjFweCBzb2xpZCAjZjBmMGYwXCIsY3Vyc29yOlwicG9pbnRlclwiLGJhY2tncm91bmQ6cC5wb3A/XCIjRkZGOEY5XCI6XCIjZmZmXCIsdHJhbnNpdGlvbjpcImFsbCAwLjJzXCJ9fT48ZGl2PjxkaXYgc3R5bGU9e3tmb250U2l6ZToxNCxmb250V2VpZ2h0OjcwMH19PntwLm5hbWV9e3AucG9wJiY8c3BhbiBzdHlsZT17e2ZvbnRTaXplOjEwLGNvbG9yOlwiI2ZmZlwiLGJhY2tncm91bmQ6UixwYWRkaW5nOlwiMnB4IDhweFwiLGJvcmRlclJhZGl1czo2LG1hcmdpbkxlZnQ6OH19PuaOqOiNkDwvc3Bhbj59PC9kaXY+PGRpdiBzdHlsZT17e2ZvbnRTaXplOjExLGNvbG9yOlwiIzk5OVwifX0+e3Auc2V0c33lpZcgwrcg5Y2V5byg6YeN55Sf5oiQe3AucmVnZW595qyhL+WllyDCtyDCpXtwLnBlcn0v5aWXPC9kaXY+PC9kaXY+PGRpdiBzdHlsZT17e2ZvbnRTaXplOjIyLGZvbnRXZWlnaHQ6ODAwLGNvbG9yOlJ9fT7CpXtwLnByaWNlfTwvZGl2PjwvZGl2Pil9PC9kaXY+PC9Nb2RhbD47XHJcblxyXG4gIC8qIOKVkOKVkOKVkOKVkOKVkOKVkOKVkCBMT0FESU5HIOKVkOKVkOKVkOKVkOKVkOKVkOKVkCAqL1xyXG4gIGlmKGdlbj09PVwibG9hZGluZ1wiKXtjb25zdCBzdD1TVEFHRVNbc3RhZ2VdfHxTVEFHRVNbMF07Y29uc3QgY2hhcktleT1DSEFSX0NZQ0xFW3RpcElkeCVDSEFSX0NZQ0xFLmxlbmd0aF07XHJcbiAgICByZXR1cm4gPGRpdiBzdHlsZT17e21pbkhlaWdodDpcIjEwMHZoXCIsYmFja2dyb3VuZDpCR319PntuYXZ9XHJcbiAgICAgIDxkaXYgc3R5bGU9e3ttYXhXaWR0aDo0NDAsbWFyZ2luOlwiMCBhdXRvXCIscGFkZGluZzpcIjUwcHggMjBweFwiLHRleHRBbGlnbjpcImNlbnRlclwiLGFuaW1hdGlvbjpcImZhZGVJbiAwLjNzXCJ9fT5cclxuICAgICAgICA8Q2hhckltZyBzcmM9e0lbY2hhcktleV19IGFsdD17c3QubGFiZWx9IHN0eWxlPXt7aGVpZ2h0OjE3MCxhbmltYXRpb246XCJmbG9hdCAycyBlYXNlLWluLW91dCBpbmZpbml0ZVwifX0gZmlsdGVyPVwiZHJvcC1zaGFkb3coMCA4cHggMjRweCByZ2JhKDI1NSw3MSw4NywwLjEyKSlcIiBtYXJnaW49XCIwIDAgMjBweFwiLz5cclxuICAgICAgICA8ZGl2IHN0eWxlPXt7Zm9udFNpemU6MjIsZm9udFdlaWdodDo3MDAsbWFyZ2luQm90dG9tOjZ9fT57c3QubGFiZWx9PC9kaXY+XHJcbiAgICAgICAgPGRpdiBzdHlsZT17e2ZvbnRTaXplOjE0LGNvbG9yOlwiIzg4OFwiLG1hcmdpbkJvdHRvbToyOH19PntzdC5kZXNjLnJlcGxhY2UoXCJ7bn1cIixTdHJpbmcoTWF0aC5taW4oc3RhZ2UqMysxLDkpKSl9PC9kaXY+XHJcbiAgICAgICAgPGRpdiBzdHlsZT17e2Rpc3BsYXk6XCJmbGV4XCIsZ2FwOjMsbWFyZ2luQm90dG9tOjI0LHBhZGRpbmc6XCIwIDMwcHhcIn19PntTVEFHRVMubWFwKChfLGkpPT48ZGl2IGtleT17aX0gc3R5bGU9e3tmbGV4OjEsaGVpZ2h0OjUsYm9yZGVyUmFkaXVzOjMsYmFja2dyb3VuZDppPD1zdGFnZT9SOlwiI2YwZjBmMFwiLHRyYW5zaXRpb246XCJiYWNrZ3JvdW5kIDAuNXNcIn19Lz4pfTwvZGl2PlxyXG4gICAgICAgIDxkaXYgc3R5bGU9e3tiYWNrZ3JvdW5kOlwiI0ZGRjVGNVwiLGJvcmRlclJhZGl1czoxMixwYWRkaW5nOlwiMTJweCAxOHB4XCIsbWFyZ2luQm90dG9tOjIwLGZvbnRTaXplOjEyLGNvbG9yOlwiI0M1MzAzMFwiLGRpc3BsYXk6XCJmbGV4XCIsYWxpZ25JdGVtczpcImNlbnRlclwiLGdhcDo2LGp1c3RpZnlDb250ZW50OlwiY2VudGVyXCJ9fT48Q2xvY2sgc2l6ZT17MTN9Lz7nlJ/miJDkuK3or7fli7/liLfmlrDpobXpnaLvvIzlkKbliJnkvJrmtarotLkx5aWX6aKd5bqmPC9kaXY+XHJcbiAgICAgICAgPGRpdiBzdHlsZT17ey4uLnMuY2FyZFAsdGV4dEFsaWduOlwibGVmdFwifX0+PGRpdiBzdHlsZT17e2ZvbnRTaXplOjEwLGNvbG9yOlwiI2NjY1wiLG1hcmdpbkJvdHRvbTo0LGRpc3BsYXk6XCJmbGV4XCIsYWxpZ25JdGVtczpcImNlbnRlclwiLGdhcDo0fX0+PFphcCBzaXplPXsxMH0vPuWwj+e6ouS5puWGt+efpeivhjwvZGl2PjxkaXYgc3R5bGU9e3tmb250U2l6ZToxMyxjb2xvcjpcIiM2NjZcIixsaW5lSGVpZ2h0OjEuNyxtaW5IZWlnaHQ6MzJ9fT57VElQU1t0aXBJZHhdfTwvZGl2PjwvZGl2PlxyXG4gICAgICAgIDxkaXYgc3R5bGU9e3tmb250U2l6ZToxMSxjb2xvcjpcIiNkZGRcIixtYXJnaW5Ub3A6MTZ9fT7pooTorqHpnIDopoEgMTUtMzAg56eSPC9kaXY+XHJcbiAgICAgIDwvZGl2Pntjc3MoKX08L2Rpdj47fVxyXG5cclxuICAvKiDilZDilZDilZDilZDilZDilZDilZAgUkVTVUxUIOKVkOKVkOKVkOKVkOKVkOKVkOKVkCAqL1xyXG4gIGlmKGdlbj09PVwicmVzdWx0XCImJnJlc3VsdCl7XHJcbiAgICByZXR1cm4gPE5vdGVNb2RhbCBpdGVtPXtyZXN1bHR9IG9uQ2xvc2U9eygpPT57c2V0R2VuKFwiaWRsZVwiKTtzZXRSZXN1bHQobnVsbCk7fX0gdGV4dFJlZ2VuPXt0ZXh0UmVnZW59XHJcbiAgICAgIG9uRG93bmxvYWQ9e2Rvd25sb2FkWmlwfVxyXG4gICAgICBvblJlZ2VuU3RhcnQ9e2Z1bmN0aW9uKGkpe3NldFJlZ2VuU3RhdGUoe2FjdGl2ZTp0cnVlLG1zZzon5q2j5Zyo6YeN5paw55Sf5oiQ56ysICcrKGkrMSkrJyDlvKDlm77niYcuLi4nfSk7fX1cclxuICAgICAgb25JdGVtVXBkYXRlPXtmdW5jdGlvbihpLHVybCx3b3JrSWQpe1xyXG4gICAgICAgIC8vIFVwZGF0ZSByZXN1bHQgaWYgbW9kYWwgc3RpbGwgb3BlblxyXG4gICAgICAgIHNldFJlc3VsdChmdW5jdGlvbihwcmV2KXtcclxuICAgICAgICAgIGlmKCFwcmV2KXJldHVybiBwcmV2O1xyXG4gICAgICAgICAgaWYoaT09PTApcmV0dXJuey4uLnByZXYsY292ZXJfdXJsOnVybH07XHJcbiAgICAgICAgICB2YXIgdT1bLi4uKHByZXYuaW1hZ2VfdXJsc3x8W10pXTtpZih1W2ktMV0pdVtpLTFdPXVybDtcclxuICAgICAgICAgIHJldHVybnsuLi5wcmV2LGltYWdlX3VybHM6dX07XHJcbiAgICAgICAgfSk7XHJcbiAgICAgICAgLy8gQWx3YXlzIHVwZGF0ZSB3b3JrcyBsaXN0IChzdXJ2aXZlcyBtb2RhbCBjbG9zZSlcclxuICAgICAgICB2YXIgd2lkPXdvcmtJZHx8bGFzdFdvcmtJZFJlZi5jdXJyZW50O1xyXG4gICAgICAgIGlmKHdpZCl7XHJcbiAgICAgICAgICBzZXRXb3JrcyhmdW5jdGlvbihwcmV2KXtcclxuICAgICAgICAgICAgcmV0dXJuIHByZXYubWFwKGZ1bmN0aW9uKHcpe1xyXG4gICAgICAgICAgICAgIGlmKHcuX2lucHV0VGV4dD09PXdpZCl7XHJcbiAgICAgICAgICAgICAgICB2YXIgbnc9ey4uLnd9O1xyXG4gICAgICAgICAgICAgICAgaWYoaT09PTApbncuY292ZXJfdXJsPXVybDtcclxuICAgICAgICAgICAgICAgIGVsc2V7dmFyIHU9bncuaW1hZ2VfdXJsc3x8W107aWYodVtpLTFdKXVbaS0xXT11cmw7bncuaW1hZ2VfdXJscz11O31cclxuICAgICAgICAgICAgICAgIHNldFRpbWVvdXQoZnVuY3Rpb24oKXtzYXZlV29yayhudyk7fSwwKTtcclxuICAgICAgICAgICAgICAgIHJldHVybiBudztcclxuICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgcmV0dXJuIHc7XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgfSk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHNldFJlZ2VuU3RhdGUoe2FjdGl2ZTpmYWxzZSxtc2c6Jyd9KTtcclxuICAgICAgfX0vPjtcclxuICB9XHJcblxyXG4gIC8qIOKVkOKVkOKVkOKVkOKVkOKVkOKVkCBGVUxMIEdBTExFUlkgUEFHRSDilZDilZDilZDilZDilZDilZDilZAgKi9cclxuICBpZihwZz09PVwiZ2FsbGVyeVwiJiYhZ0l0ZW0pe3JldHVybiA8ZGl2IHN0eWxlPXt7bWluSGVpZ2h0OlwiMTAwdmhcIixiYWNrZ3JvdW5kOkJHfX0+e25hdn1cclxuICAgIDxkaXYgc3R5bGU9e3suLi5zLnNlY3Rpb259fT5cclxuICAgICAgPGgxIHN0eWxlPXt7Li4ucy5zZWN0aW9uVGl0bGV9fT7olq/ljIXlh7rlk4E8L2gxPlxyXG4gICAgICA8cCBzdHlsZT17ey4uLnMuc2VjdGlvblN1Yn19PuS7peS4i+WGheWuueWFqOmDqOeUseiWr+WMhUFJ5LiA6ZSu55Sf5oiQ77yM54K55Ye75Lu75oSP5L2c5ZOB5p+l55yL5a6M5pW05Zu+5paHPC9wPlxyXG4gICAgICA8ZGl2IHN0eWxlPXt7ZGlzcGxheTpcImdyaWRcIixncmlkVGVtcGxhdGVDb2x1bW5zOlwicmVwZWF0KDMsMWZyKVwiLGdhcDoxNH19PntHQUxMRVJZLm1hcChnPT48R0NhcmQga2V5PXtnLmlkfSBpdGVtPXtnfSBvbkNsaWNrPXtmdW5jdGlvbigpe2lmKGcuY292ZXJfdXJsKXtzZXRSZXN1bHQoey4uLmcsYm9keV90ZXh0OmcuYm9keSxoYXNodGFnczpnLnRhZ3MsY2F0ZWdvcnk6Zy5jYXQsX2lucHV0VGV4dDpnLmhpbnR9KTtzZXRHZW4oXCJyZXN1bHRcIik7fWVsc2V7c2V0R0l0ZW0oZyk7fX19Lz4pfTwvZGl2PlxyXG4gICAgPC9kaXY+e2NzcygpfXtsb2dpbk1vZGFsfXtwcmljZU1vZGFsfTwvZGl2Pjt9XHJcblxyXG4gIC8qIOKVkOKVkOKVkOKVkOKVkOKVkOKVkCBHQUxMRVJZIERFVEFJTCDilZDilZDilZDilZDilZDilZDilZAgKi9cclxuICBpZihnSXRlbSl7cmV0dXJuIDxkaXYgc3R5bGU9e3ttaW5IZWlnaHQ6XCIxMDB2aFwiLGJhY2tncm91bmQ6Qkd9fT57bmF2fVxyXG4gICAgPGRpdiBzdHlsZT17e21heFdpZHRoOjY0MCxtYXJnaW46XCIwIGF1dG9cIixwYWRkaW5nOlwiMjBweCAyMHB4IDYwcHhcIixhbmltYXRpb246XCJzbGlkZVVwIDAuM3MgZWFzZVwifX0+XHJcbiAgICAgIDxCdG4gc21hbGwgb25DbGljaz17KCk9PnNldEdJdGVtKG51bGwpfSBzeD17e21hcmdpbkJvdHRvbToxNH19PjxBcnJvd0xlZnQgc2l6ZT17MTR9Lz7ov5Tlm548L0J0bj5cclxuICAgICAgPENhcmQgc3g9e3tvdmVyZmxvdzpcImhpZGRlblwifX0+XHJcbiAgICAgICAgPGRpdiBzdHlsZT17e2JhY2tncm91bmQ6Z0l0ZW0uZ3JhZCxoZWlnaHQ6MjAwLGRpc3BsYXk6XCJmbGV4XCIsYWxpZ25JdGVtczpcImZsZXgtZW5kXCIscGFkZGluZzoyNCxwb3NpdGlvbjpcInJlbGF0aXZlXCJ9fT5cclxuICAgICAgICAgIDxkaXYgc3R5bGU9e3twb3NpdGlvbjpcImFic29sdXRlXCIsaW5zZXQ6MCxiYWNrZ3JvdW5kOlwibGluZWFyLWdyYWRpZW50KHRyYW5zcGFyZW50IDMwJSxyZ2JhKDAsMCwwLDAuNikpXCJ9fS8+XHJcbiAgICAgICAgICA8ZGl2IHN0eWxlPXt7cG9zaXRpb246XCJyZWxhdGl2ZVwifX0+PHNwYW4gc3R5bGU9e3tmb250U2l6ZToxMSxiYWNrZ3JvdW5kOlwicmdiYSgyNTUsMjU1LDI1NSwwLjIpXCIsY29sb3I6XCIjZmZmXCIscGFkZGluZzpcIjNweCAxMHB4XCIsYm9yZGVyUmFkaXVzOjgsYmFja2Ryb3BGaWx0ZXI6XCJibHVyKDRweClcIn19PntnSXRlbS5jYXR9PC9zcGFuPjxoMiBzdHlsZT17e2NvbG9yOlwiI2ZmZlwiLGZvbnRTaXplOjIwLGZvbnRXZWlnaHQ6NzAwLG1hcmdpbjpcIjhweCAwIDBcIix0ZXh0U2hhZG93OlwiMCAycHggOHB4IHJnYmEoMCwwLDAsMC4zKVwiLGxpbmVIZWlnaHQ6MS40fX0+e2dJdGVtLnRpdGxlfTwvaDI+PC9kaXY+XHJcbiAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgPGRpdiBzdHlsZT17e3BhZGRpbmc6MjR9fT5cclxuICAgICAgICAgIDxkaXYgc3R5bGU9e3tmb250U2l6ZToxNCxsaW5lSGVpZ2h0OjIuMSxjb2xvcjpcIiMzMzNcIix3aGl0ZVNwYWNlOlwicHJlLXdyYXBcIixtYXJnaW5Cb3R0b206MjB9fT57Z0l0ZW0uYm9keX08L2Rpdj5cclxuICAgICAgICAgIDxkaXYgc3R5bGU9e3tkaXNwbGF5OlwiZmxleFwiLGZsZXhXcmFwOlwid3JhcFwiLGdhcDo2LG1hcmdpbkJvdHRvbToyMH19PntnSXRlbS50YWdzLm1hcCgodCxpKT0+PHNwYW4ga2V5PXtpfSBzdHlsZT17e2ZvbnRTaXplOjEyLGNvbG9yOlIsYmFja2dyb3VuZDpcIiNGRkYxRjNcIixwYWRkaW5nOlwiNHB4IDE0cHhcIixib3JkZXJSYWRpdXM6MjB9fT57dH08L3NwYW4+KX08L2Rpdj5cclxuICAgICAgICAgIDxkaXYgc3R5bGU9e3tkaXNwbGF5OlwiZmxleFwiLGdhcDoxMH19PjxCdG4gcHJpbWFyeSBmdWxsIG9uQ2xpY2s9eygpPT57c2V0VGV4dChnSXRlbS5oaW50fHxnSXRlbS5ib2R5LnNwbGl0KFwiXFxuXCIpWzBdKTtzZXRHSXRlbShudWxsKTtzZXRQZyhcImhvbWVcIik7fX0+PFNwYXJrbGVzIHNpemU9ezE0fS8+5LiA6ZSu5ZCM5qy+PC9CdG4+PEJ0biBvbkNsaWNrPXsoKT0+c2V0R0l0ZW0obnVsbCl9Pui/lOWbnjwvQnRuPjwvZGl2PlxyXG4gICAgICAgIDwvZGl2PlxyXG4gICAgICA8L0NhcmQ+XHJcbiAgICA8L2Rpdj57Y3NzKCl9e2xvZ2luTW9kYWx9e3ByaWNlTW9kYWx9PC9kaXY+O31cclxuXHJcbiAgLyog4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQIFBSSUNJTkcgUEFHRSDilZDilZDilZDilZDilZDilZDilZAgKi9cclxuICBpZihwZz09PVwicHJpY2luZ1wiKXtyZXR1cm4gPGRpdiBzdHlsZT17e21pbkhlaWdodDpcIjEwMHZoXCIsYmFja2dyb3VuZDpCR319PntuYXZ9XHJcbiAgICA8ZGl2IHN0eWxlPXt7Li4ucy5zZWN0aW9ufX0+XHJcbiAgICAgIDxoMSBzdHlsZT17ey4uLnMuc2VjdGlvblRpdGxlfX0+5Lu35qC85pa55qGIPC9oMT5cclxuICAgICAgPHAgc3R5bGU9e3suLi5zLnNlY3Rpb25TdWJ9fT7mjInlpZfmlLbotLnvvIzkuI3mkJ7oh6rliqjnu63otLnjgILmr4/lpZfljIXlkKvlrozmlbTnmoTmoIfpopgr5q2j5paHK+agh+etvis55byg6YWN5Zu+PC9wPlxyXG4gICAgICA8ZGl2IHN0eWxlPXt7ZGlzcGxheTpcImdyaWRcIixncmlkVGVtcGxhdGVDb2x1bW5zOlwicmVwZWF0KDQsMWZyKVwiLGdhcDoxMn19PntQUklDSU5HLm1hcCgocCxpKT0+PENhcmQga2V5PXtpfSBzeD17e3BhZGRpbmc6MjAsdGV4dEFsaWduOlwiY2VudGVyXCIsYm9yZGVyOnAucG9wP1wiMnB4IHNvbGlkIFwiK1I6XCIxcHggc29saWQgI2YwZjBmMFwiLHBvc2l0aW9uOlwicmVsYXRpdmVcIn19PlxyXG4gICAgICAgIHtwLnBvcCYmPGRpdiBzdHlsZT17e3Bvc2l0aW9uOlwiYWJzb2x1dGVcIix0b3A6LTExLGxlZnQ6XCI1MCVcIix0cmFuc2Zvcm06XCJ0cmFuc2xhdGVYKC01MCUpXCIsYmFja2dyb3VuZDpSLGNvbG9yOlwiI2ZmZlwiLGZvbnRTaXplOjEwLHBhZGRpbmc6XCIzcHggMTRweFwiLGJvcmRlclJhZGl1czoxMCxmb250V2VpZ2h0OjYwMH19PuaOqOiNkDwvZGl2Pn1cclxuICAgICAgICA8ZGl2IHN0eWxlPXt7Zm9udFNpemU6MTUsZm9udFdlaWdodDo3MDAsbWFyZ2luQm90dG9tOjR9fT57cC5uYW1lfTwvZGl2PlxyXG4gICAgICAgIDxkaXYgc3R5bGU9e3tmb250U2l6ZToxMSxjb2xvcjpcIiM5OTlcIixtYXJnaW5Cb3R0b206MTJ9fT57cC5kZXNjfTwvZGl2PlxyXG4gICAgICAgIDxkaXYgc3R5bGU9e3tmb250U2l6ZTozMixmb250V2VpZ2h0OjgwMCxjb2xvcjpSLG1hcmdpbkJvdHRvbToyfX0+wqV7cC5wcmljZX08L2Rpdj5cclxuICAgICAgICA8ZGl2IHN0eWxlPXt7Zm9udFNpemU6MTIsY29sb3I6XCIjYmJiXCIsbWFyZ2luQm90dG9tOjEyfX0+e3Auc2V0c33lpZflm77mloc8L2Rpdj5cclxuICAgICAgICA8ZGl2IHN0eWxlPXt7Zm9udFNpemU6MTEsY29sb3I6XCIjY2NjXCIsbWFyZ2luQm90dG9tOjR9fT7ljZXlvKDph43nlJ/miJAge3AucmVnZW595qyhL+WllzwvZGl2PlxyXG4gICAgICAgIDxkaXYgc3R5bGU9e3tmb250U2l6ZToxMSxjb2xvcjpcIiNjY2NcIixtYXJnaW5Cb3R0b206MTR9fT7nuqYgwqV7cC5wZXJ9L+WllzwvZGl2PlxyXG4gICAgICAgIDxCdG4gcHJpbWFyeT17cC5wb3B9IGZ1bGwgc21hbGwgb25DbGljaz17KCk9PntpZighbG9nZ2VkKXNldFNob3dMb2dpbih0cnVlKTtlbHNle3NldFB0c1MocHRzK3Auc2V0cyk7c2V0UHRzKHB0cytwLnNldHMpO319fT57cC5wb3A/PD48U3BhcmtsZXMgc2l6ZT17MTJ9Lz7nq4vljbPotK3kubA8Lz46XCLpgInmi6lcIn08L0J0bj5cclxuICAgICAgPC9DYXJkPil9PC9kaXY+XHJcbiAgICAgIDxkaXYgc3R5bGU9e3t0ZXh0QWxpZ246XCJjZW50ZXJcIixtYXJnaW5Ub3A6MjQsZm9udFNpemU6MTIsY29sb3I6XCIjY2NjXCJ9fT7miYDmnInlpZfppJDlnYfkuLrkuIDmrKHmgKfotK3kubDvvIzkuI3oh6rliqjnu63otLnvvIzkuI3pmZDkvb/nlKjml7bpl7Q8L2Rpdj5cclxuICAgIDwvZGl2Pntjc3MoKX17bG9naW5Nb2RhbH17cHJpY2VNb2RhbH08L2Rpdj47fVxyXG5cclxuICAvKiDilZDilZDilZDilZDilZDilZDilZAgV09SS1MgUEFHRSDilZDilZDilZDilZDilZDilZDilZAgKi9cclxuICBpZihwZz09PVwid29ya3NcIil7cmV0dXJuIDxkaXYgc3R5bGU9e3ttaW5IZWlnaHQ6XCIxMDB2aFwiLGJhY2tncm91bmQ6Qkd9fT57bmF2fVxyXG4gICAgPGRpdiBzdHlsZT17ey4uLnMuc2VjdGlvbn19PlxyXG4gICAgICA8aDEgc3R5bGU9e3suLi5zLnNlY3Rpb25UaXRsZX19PuaIkeeahOS9nOWTgTwvaDE+XHJcbiAgICAgIDxwIHN0eWxlPXt7Li4ucy5zZWN0aW9uU3VifX0+e3dvcmtzLmxlbmd0aD93b3Jrcy5sZW5ndGgrXCLkuKrkvZzlk4FcIjpcIui/mOayoeacieS9nOWTge+8jOWOu+WIm+S9nOesrOS4gOWll+eIhuasvuWbvuaWh+WQp1wifTwvcD5cclxuICAgICAgeyF3b3Jrcy5sZW5ndGg/PGRpdiBzdHlsZT17e3RleHRBbGlnbjpcImNlbnRlclwiLHBhZGRpbmc6XCI0MHB4IDBcIn19PjxDaGFySW1nIHNyYz17SS5lbXB0eX0gYWx0PVwiXCIgc3R5bGU9e3toZWlnaHQ6MTAwfX0gZmlsdGVyPVwibm9uZVwiIG1hcmdpbj1cIjAgMCAxNnB4XCIvPlxyXG4gICAgICAgIHtsb2dnZWQ/PEJ0biBwcmltYXJ5IG9uQ2xpY2s9eygpPT5zZXRQZyhcImhvbWVcIil9PjxTcGFya2xlcyBzaXplPXsxNH0vPuW8gOWni+WIm+S9nDwvQnRuPjo8PjxwIHN0eWxlPXt7Zm9udFNpemU6MTMsY29sb3I6XCIjOTk5XCIsbWFyZ2luOlwiMCAwIDEycHhcIn19PueZu+W9leWQju+8jOeUn+aIkOeahOWGheWuueS8muiHquWKqOS/neWtmOWIsOi/memHjDwvcD48QnRuIHByaW1hcnkgb25DbGljaz17KCk9PnNldFNob3dMb2dpbih0cnVlKX0+PExvZ0luIHNpemU9ezE0fS8+55m75b2V5p+l55yL5L2c5ZOBPC9CdG4+PC8+fVxyXG4gICAgICA8L2Rpdj5cclxuICAgICAgOjxkaXYgc3R5bGU9e3tkaXNwbGF5OlwiZ3JpZFwiLGdyaWRUZW1wbGF0ZUNvbHVtbnM6XCIxZnIgMWZyXCIsZ2FwOjEyfX0+e3dvcmtzLm1hcCgodyxpKT0+PENhcmQga2V5PXt3LmlkfHxpfSBob3ZlciBvbkNsaWNrPXsoKT0+e3NldFJlc3VsdCh3KTtzZXRHZW4oXCJyZXN1bHRcIik7fX0gc3g9e3twYWRkaW5nOjE2LGRpc3BsYXk6XCJmbGV4XCIsZ2FwOjEyLGFsaWduSXRlbXM6XCJjZW50ZXJcIn19PlxyXG4gICAgICAgIHt3LmNvdmVyX3VybD88aW1nIHNyYz17dy5jb3Zlcl91cmx9IGFsdD1cIlwiIHN0eWxlPXt7d2lkdGg6NTYsaGVpZ2h0Ojc1LGJvcmRlclJhZGl1czo4LG9iamVjdEZpdDpcImNvdmVyXCIsZmxleDpcIjAgMCBhdXRvXCJ9fS8+OjxkaXYgc3R5bGU9e3t3aWR0aDo1NixoZWlnaHQ6NzUsYm9yZGVyUmFkaXVzOjgsYmFja2dyb3VuZDpcIiNmNWY1ZjVcIixmbGV4OlwiMCAwIGF1dG9cIixkaXNwbGF5OlwiZmxleFwiLGFsaWduSXRlbXM6XCJjZW50ZXJcIixqdXN0aWZ5Q29udGVudDpcImNlbnRlclwiLGZvbnRTaXplOjIwfX0+8J+ThDwvZGl2Pn1cclxuICAgICAgICA8ZGl2IHN0eWxlPXt7ZmxleDoxLG1pbldpZHRoOjB9fT5cclxuICAgICAgICAgIDxkaXYgc3R5bGU9e3tmb250U2l6ZToxNCxmb250V2VpZ2h0OjYwMCxsaW5lSGVpZ2h0OjEuNSxtYXJnaW5Cb3R0b206NCxkaXNwbGF5OlwiLXdlYmtpdC1ib3hcIixXZWJraXRMaW5lQ2xhbXA6MixXZWJraXRCb3hPcmllbnQ6XCJ2ZXJ0aWNhbFwiLG92ZXJmbG93OlwiaGlkZGVuXCJ9fT57dy50aXRsZX08L2Rpdj5cclxuICAgICAgICAgIDxkaXYgc3R5bGU9e3tkaXNwbGF5OlwiZmxleFwiLGp1c3RpZnlDb250ZW50Olwic3BhY2UtYmV0d2VlblwiLGZvbnRTaXplOjExLGNvbG9yOlwiI2NjY1wifX0+PHNwYW4+e3cuY2F0ZWdvcnl9PC9zcGFuPjxzcGFuPnt3LmF0fTwvc3Bhbj48L2Rpdj5cclxuICAgICAgICAgIHt3LmNvdmVyX3VybCYmPGRpdiBzdHlsZT17e2ZvbnRTaXplOjEwLGNvbG9yOlwiI2RkZFwiLG1hcmdpblRvcDoyfX0+e3cuaW1hZ2VfdXJscz8ubGVuZ3RofHwwfeW8oOmFjeWbvjwvZGl2Pn1cclxuICAgICAgICA8L2Rpdj5cclxuICAgICAgPC9DYXJkPil9PC9kaXY+fVxyXG4gICAgPC9kaXY+e2NzcygpfXtsb2dpbk1vZGFsfXtwcmljZU1vZGFsfTwvZGl2Pjt9XHJcblxyXG4gIC8qIOKVkOKVkOKVkOKVkOKVkOKVkOKVkCBIT01FIFBBR0Ug4pWQ4pWQ4pWQ4pWQ4pWQ4pWQ4pWQICovXHJcbiAgcmV0dXJuIDxkaXYgc3R5bGU9e3ttaW5IZWlnaHQ6XCIxMDB2aFwiLGJhY2tncm91bmQ6Qkd9fT57bmF2fVxyXG5cclxuICAgIHsvKiBIRVJPICovfVxyXG4gICAgPHNlY3Rpb24gc3R5bGU9e3ttYXhXaWR0aDo2ODAsbWFyZ2luOlwiMCBhdXRvXCIscGFkZGluZzpcIjM2cHggMjBweCAwXCIsdGV4dEFsaWduOlwiY2VudGVyXCJ9fT5cclxuICAgICAgPENoYXJJbWcgc3JjPXtJLndhdmV9IGFsdD1cIuWwj+iWr+WMhVwiIHN0eWxlPXt7aGVpZ2h0OjY0fX0gbWFyZ2luPVwiMCAwIDEycHhcIi8+XHJcbiAgICAgIDxoMSBzdHlsZT17e2ZvbnRTaXplOjI4LGZvbnRXZWlnaHQ6ODAwLG1hcmdpbjpcIjAgMCA4cHhcIixsaW5lSGVpZ2h0OjEuNCxjb2xvcjpcIiMxYTFhMWFcIn19PuS4gOWPpeivneS4u+mimO+8jEFJ5biu5L2g55Sf5oiQPGJyLz48c3BhbiBzdHlsZT17e2NvbG9yOlJ9fT7lsI/nuqLkuabniIbmrL7lm77mloc8L3NwYW4+PC9oMT5cclxuICAgICAgPHAgc3R5bGU9e3tmb250U2l6ZToxNCxjb2xvcjpcIiM5OTlcIixtYXJnaW46XCIwIDAgMjRweFwiLGxpbmVIZWlnaHQ6MS43fX0+6L6T5YWl5Lu75oSP5Li76aKY5oiW57Sg5p2Q77yM6Jav5YyFQUnoh6rliqjor4bliKvotZvpgZPvvIzkuIDplK7nlJ/miJDniIbmrL7moIfpopgr56eN6I2J5paH5qGIKznlvKDnsr7nvo7phY3lm748L3A+XHJcblxyXG4gICAgICA8Q2FyZCBzeD17e3BhZGRpbmc6MjQsdGV4dEFsaWduOlwibGVmdFwiLGJvcmRlcjpcIjEuNXB4IHNvbGlkICNmMGYwZjBcIn19PlxyXG4gICAgICAgIDx0ZXh0YXJlYSB2YWx1ZT17dGV4dH0gb25DaGFuZ2U9e2U9PnNldFRleHQoZS50YXJnZXQudmFsdWUpfSBwbGFjZWhvbGRlcj17XCLovpPlhaXkvaDmg7PliJvkvZznmoTkuLvpopjvvIzkuIDlj6Xor53lsLHlpJ/kuoZcXG7kvovlpoLvvJrwn5ON5Y6m6ZeoM+WkqTLlpJzml4XmuLjmlLvnlaXjgIHwn46n55m+5YWD6JOd54mZ6ICz5py65rWL6K+ELi4uXCJ9IHN0eWxlPXt7d2lkdGg6XCIxMDAlXCIsbWluSGVpZ2h0OjExMCxwYWRkaW5nOjE2LGJvcmRlcjpcIjJweCBzb2xpZCAjZjBmMGYwXCIsYm9yZGVyUmFkaXVzOjE0LGZvbnRTaXplOjE0LGxpbmVIZWlnaHQ6MS44LGZvbnRGYW1pbHk6XCJpbmhlcml0XCIscmVzaXplOlwidmVydGljYWxcIixib3hTaXppbmc6XCJib3JkZXItYm94XCIsb3V0bGluZTpcIm5vbmVcIix0cmFuc2l0aW9uOlwiYm9yZGVyLWNvbG9yIDAuMnNcIn19IG9uRm9jdXM9e2U9PmUudGFyZ2V0LnN0eWxlLmJvcmRlckNvbG9yPVIyfSBvbkJsdXI9e2U9PmUudGFyZ2V0LnN0eWxlLmJvcmRlckNvbG9yPVwiI2YwZjBmMFwifS8+XHJcbiAgICAgICAgPGRpdiBzdHlsZT17e21hcmdpbjpcIjEycHggMCAxNnB4XCJ9fT5cclxuICAgICAgICAgIDxkaXYgc3R5bGU9e3tmb250U2l6ZToxMSxjb2xvcjpcIiM5OTlcIixtYXJnaW5Cb3R0b206Nn19PueDremXqOS4u+mimDwvZGl2PlxyXG4gICAgICAgICAgPGRpdiBzdHlsZT17e2Rpc3BsYXk6XCJmbGV4XCIsYWxpZ25JdGVtczpcImNlbnRlclwiLGdhcDo0fX0+XHJcbiAgICAgICAgICAgIDxidXR0b24gb25DbGljaz17KCk9PnNldENhcm91c2VsSWR4KGk9PihpLTErUVVJQ0tfSElOVFMubGVuZ3RoKSVRVUlDS19ISU5UUy5sZW5ndGgpfSBzdHlsZT17e2ZsZXg6XCIwIDAgYXV0b1wiLGJhY2tncm91bmQ6XCJub25lXCIsYm9yZGVyOlwibm9uZVwiLGZvbnRTaXplOjE4LGNvbG9yOlwiI2FhYVwiLGN1cnNvcjpcInBvaW50ZXJcIixwYWRkaW5nOlwiNHB4IDJweFwifX0+e1N0cmluZy5mcm9tQ2hhckNvZGUoODI0OSl9PC9idXR0b24+XHJcbiAgICAgICAgICAgIDxkaXYgc3R5bGU9e3tmbGV4OjEsb3ZlcmZsb3c6XCJoaWRkZW5cIixib3JkZXJSYWRpdXM6MTAsYmFja2dyb3VuZDpcIiNmNWY1ZjVcIixib3JkZXI6XCIxcHggc29saWQgI2VlZVwifX0+XHJcbiAgICAgICAgICAgICAgPGRpdiBzdHlsZT17e3RleHRBbGlnbjpcImNlbnRlclwiLHBhZGRpbmc6XCI4cHggMFwifX0+XHJcbiAgICAgICAgICAgICAgICA8YnV0dG9uIG9uQ2xpY2s9eygpPT5zZXRUZXh0KFFVSUNLX0hJTlRTW2Nhcm91c2VsSWR4XSl9IHN0eWxlPXt7Zm9udFNpemU6MTQsY29sb3I6XCIjNTU1XCIsYmFja2dyb3VuZDpcIm5vbmVcIixib3JkZXI6XCJub25lXCIsY3Vyc29yOlwicG9pbnRlclwiLGZvbnRGYW1pbHk6XCJpbmhlcml0XCJ9fT5cclxuICAgICAgICAgICAgICAgICAge1FVSUNLX0hJTlRTW2Nhcm91c2VsSWR4XX1cclxuICAgICAgICAgICAgICAgIDwvYnV0dG9uPlxyXG4gICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgPGJ1dHRvbiBvbkNsaWNrPXsoKT0+c2V0Q2Fyb3VzZWxJZHgoaT0+KGkrMSklUVVJQ0tfSElOVFMubGVuZ3RoKX0gc3R5bGU9e3tmbGV4OlwiMCAwIGF1dG9cIixiYWNrZ3JvdW5kOlwibm9uZVwiLGJvcmRlcjpcIm5vbmVcIixmb250U2l6ZToxOCxjb2xvcjpcIiNhYWFcIixjdXJzb3I6XCJwb2ludGVyXCIscGFkZGluZzpcIjRweCAycHhcIn19PntTdHJpbmcuZnJvbUNoYXJDb2RlKDgyNTApfTwvYnV0dG9uPlxyXG4gICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICA8ZGl2IHN0eWxlPXt7ZGlzcGxheTpcImZsZXhcIixqdXN0aWZ5Q29udGVudDpcImNlbnRlclwiLGdhcDozLG1hcmdpblRvcDo2fX0+e1FVSUNLX0hJTlRTLm1hcChmdW5jdGlvbihfLGkpe3JldHVybiA8ZGl2IGtleT17aX0gc3R5bGU9e3t3aWR0aDppPT09Y2Fyb3VzZWxJZHg/MTY6NCxoZWlnaHQ6Myxib3JkZXJSYWRpdXM6MixiYWNrZ3JvdW5kOmk9PT1jYXJvdXNlbElkeD9cIiM4ODhcIjpcIiNkZGRcIix0cmFuc2l0aW9uOlwiYWxsIC4zc1wifX0vPn0pfTwvZGl2PlxyXG4gICAgICAgIDwvZGl2PlxyXG57ZXJyJiY8ZGl2IHN0eWxlPXt7YmFja2dyb3VuZDpcIiNGRkY1RjVcIixib3JkZXI6XCIxcHggc29saWQgI0ZFRDdEN1wiLGJvcmRlclJhZGl1czoxMCxwYWRkaW5nOlwiMTBweCAxNHB4XCIsbWFyZ2luQm90dG9tOjEyLGZvbnRTaXplOjEyLGNvbG9yOlwiI0M1MzAzMFwifX0+e2Vycn08L2Rpdj59XHJcbiAgICAgICAgPEJ0biBwcmltYXJ5IGZ1bGwgZGlzYWJsZWQ9eyF0ZXh0LnRyaW0oKX0gb25DbGljaz17ZG9HZW59PjxTcGFya2xlcyBzaXplPXsxNn0vPntsb2dnZWQ/XCLkuIDplK7nlJ/miJDniIbmrL7lm77mlodcIjpcIuaWsOeUqOaIt+WFjei0ueeUn+aIkFwifTwvQnRuPlxyXG4gICAgICAgIDxkaXYgc3R5bGU9e3t0ZXh0QWxpZ246XCJjZW50ZXJcIixmb250U2l6ZToxMSxjb2xvcjpcIiNiYmJcIixtYXJnaW5Ub3A6OH19Pntsb2dnZWQ/YOWJqeS9mSAke3B0c30g5aWX6aKd5bqmYDpcIuaWsOeUqOaIt+S4k+S6qyDCtyDnmbvlvZXlkI7lj6/kv53lrZjliLDkvZzlk4Hpm4ZcIn08L2Rpdj5cclxuICAgICAgPC9DYXJkPlxyXG4gICAgPC9zZWN0aW9uPlxyXG5cclxuICAgIHsvKiBHQUxMRVJZIFBSRVZJRVcgKi99XHJcbiAgICA8c2VjdGlvbiBzdHlsZT17ey4uLnMuc2VjdGlvbixwYWRkaW5nVG9wOjQ4fX0+XHJcbiAgICAgIDxkaXYgc3R5bGU9e3tkaXNwbGF5OlwiZmxleFwiLGp1c3RpZnlDb250ZW50Olwic3BhY2UtYmV0d2VlblwiLGFsaWduSXRlbXM6XCJjZW50ZXJcIixtYXJnaW5Cb3R0b206MTh9fT5cclxuICAgICAgICA8ZGl2PjxoMiBzdHlsZT17e2ZvbnRTaXplOjIwLGZvbnRXZWlnaHQ6NzAwLG1hcmdpbjpcIjAgMCA0cHhcIixkaXNwbGF5OlwiZmxleFwiLGFsaWduSXRlbXM6XCJjZW50ZXJcIixnYXA6OH19PjxpbWcgc3JjPXtJLmFwcGljb259IHN0eWxlPXt7d2lkdGg6MjIsaGVpZ2h0OjIyLGJvcmRlclJhZGl1czo2fX0gYWx0PVwiXCIvPuiWr+WMheWHuuWTgTwvaDI+PHAgc3R5bGU9e3tmb250U2l6ZToxMixjb2xvcjpcIiNiYmJcIixtYXJnaW46MH19PuS7peS4i+WGheWuueWFqOmDqOeUseiWr+WMhUFJ5LiA6ZSu55Sf5oiQ77yM54K55Ye75p+l55yL5a6M5pW05Zu+5paHPC9wPjwvZGl2PlxyXG4gICAgICAgIDxCdG4gc21hbGwgb25DbGljaz17KCk9PnNldFBnKFwiZ2FsbGVyeVwiKX0gc3g9e3tjb2xvcjpSLGJvcmRlcjpcIjFweCBzb2xpZCBcIitSfX0+5pu05aSa5L2c5ZOBIDxDaGV2cm9uUmlnaHQgc2l6ZT17MTN9Lz48L0J0bj5cclxuICAgICAgPC9kaXY+XHJcbiAgICAgIDxkaXYgc3R5bGU9e3tkaXNwbGF5OlwiZ3JpZFwiLGdyaWRUZW1wbGF0ZUNvbHVtbnM6XCJyZXBlYXQoMywxZnIpXCIsZ2FwOjE0fX0+e0dBTExFUlkuc2xpY2UoMCw2KS5tYXAoZz0+PEdDYXJkIGtleT17Zy5pZH0gaXRlbT17Z30gb25DbGljaz17ZnVuY3Rpb24oKXtpZihnLmNvdmVyX3VybCl7c2V0UmVzdWx0KHsuLi5nLGJvZHlfdGV4dDpnLmJvZHksaGFzaHRhZ3M6Zy50YWdzLGNhdGVnb3J5OmcuY2F0LF9pbnB1dFRleHQ6Zy5oaW50fSk7c2V0R2VuKFwicmVzdWx0XCIpO31lbHNle3NldEdJdGVtKGcpO319fS8+KX08L2Rpdj5cclxuICAgIDwvc2VjdGlvbj5cclxuXHJcbiAgICB7LyogRkVBVFVSRVMgKi99XHJcbiAgICA8c2VjdGlvbiBzdHlsZT17ey4uLnMuc2VjdGlvbixwYWRkaW5nVG9wOjI0fX0+XHJcbiAgICAgIDxoMiBzdHlsZT17ey4uLnMuc2VjdGlvblRpdGxlfX0+5Li65LuA5LmI6YCJ6Jav5YyFQUnnlJ/miJDlsI/nuqLkuablm77mloc8L2gyPlxyXG4gICAgICA8cCBzdHlsZT17ey4uLnMuc2VjdGlvblN1Yn19PuS7juenjeiNieeslOiusOWIsOW5sui0p+aUu+eVpe+8jDPliIbpkp/kuqTku5jlj6/nm7TmjqXlj5HluIPnmoTlrozmlbTlm77mloflpZfku7Y8L3A+XHJcbiAgICAgIDxkaXYgc3R5bGU9e3tkaXNwbGF5OlwiZ3JpZFwiLGdyaWRUZW1wbGF0ZUNvbHVtbnM6XCJyZXBlYXQoMywxZnIpXCIsZ2FwOjEyfX0+e0ZFQVRVUkVTLm1hcCgoZixpKT0+e2NvbnN0IEljb249Zi5pY29uO3JldHVybiA8Q2FyZCBrZXk9e2l9IHN4PXt7cGFkZGluZzoyMH19PlxyXG4gICAgICAgIDxkaXYgc3R5bGU9e3t3aWR0aDozNixoZWlnaHQ6MzYsYm9yZGVyUmFkaXVzOjEwLGJhY2tncm91bmQ6XCIjRkZGMUYzXCIsZGlzcGxheTpcImZsZXhcIixhbGlnbkl0ZW1zOlwiY2VudGVyXCIsanVzdGlmeUNvbnRlbnQ6XCJjZW50ZXJcIixtYXJnaW5Cb3R0b206MTB9fT48SWNvbiBzaXplPXsxOH0gY29sb3I9e1J9Lz48L2Rpdj5cclxuICAgICAgICA8ZGl2IHN0eWxlPXt7Zm9udFNpemU6MTQsZm9udFdlaWdodDo3MDAsbWFyZ2luQm90dG9tOjR9fT57Zi50aXRsZX08L2Rpdj5cclxuICAgICAgICA8ZGl2IHN0eWxlPXt7Zm9udFNpemU6MTIsY29sb3I6XCIjOTk5XCIsbGluZUhlaWdodDoxLjZ9fT57Zi5kZXNjfTwvZGl2PlxyXG4gICAgICA8L0NhcmQ+O30pfTwvZGl2PlxyXG4gICAgPC9zZWN0aW9uPlxyXG5cclxuICAgIHsvKiBIT1cgSVQgV09SS1MgKi99XHJcbiAgICA8c2VjdGlvbiBzdHlsZT17ey4uLnMuc2VjdGlvbixwYWRkaW5nVG9wOjI0fX0+XHJcbiAgICAgIDxoMiBzdHlsZT17ey4uLnMuc2VjdGlvblRpdGxlfX0+M+atpeaQnuWumuWwj+e6ouS5pueIhuasvuWbvuaWhzwvaDI+XHJcbiAgICAgIDxwIHN0eWxlPXt7Li4ucy5zZWN0aW9uU3VifX0+5q+U5L2g5oOz6LGh55qE5pu0566A5Y2VPC9wPlxyXG4gICAgICA8ZGl2IHN0eWxlPXt7ZGlzcGxheTpcImZsZXhcIixnYXA6MTYsanVzdGlmeUNvbnRlbnQ6XCJjZW50ZXJcIixmbGV4V3JhcDpcIndyYXBcIn19PlxyXG4gICAgICAgIHtbe246XCIxXCIsdDpcIueymOi0tOe0oOadkFwiLGQ6XCLml4XooYznu4/ljobjgIHkuqflk4HkvZPpqozjgIHmjqLlupfnrJTorrAuLi7ku7vkvZXlvaLlvI/nmoTljp/lp4vntKDmnZDpg73ooYxcIixpY29uOlwi4pyN77iPXCIsYmc6XCIjRkZGMEYyXCJ9LHtuOlwiMlwiLHQ6XCLolq/ljIXliJvkvZxcIixkOlwiQUnoh6rliqjor4bliKvotZvpgZPvvIznlJ/miJDniIbmrL7moIfpopgr5paH5qGIKznlvKDphY3lm75cIixpY29uOlwi4pyoXCIsYmc6XCIjRjBGNEZGXCJ9LHtuOlwiM1wiLHQ6XCLnm7TmjqXlj5HluINcIixkOlwi5LiA6ZSu5aSN5Yi25paH5qGI44CB5LiL6L295Zu+54mH77yM5omT5byA5bCP57qi5Lmm5bCx6IO95Y+RXCIsaWNvbjpcIvCfmoBcIixiZzpcIiNGMEZGRjRcIn0sXS5tYXAoKHN0LGkpPT48Q2FyZCBrZXk9e2l9IHN4PXt7ZmxleDpcIjEgMSAyMDBweFwiLHBhZGRpbmc6XCIyOHB4IDIwcHhcIix0ZXh0QWxpZ246XCJjZW50ZXJcIixtYXhXaWR0aDoyNDAscG9zaXRpb246XCJyZWxhdGl2ZVwiLG92ZXJmbG93OlwiaGlkZGVuXCJ9fT5cclxuICAgICAgICAgIDxkaXYgc3R5bGU9e3twb3NpdGlvbjpcImFic29sdXRlXCIsdG9wOjAsbGVmdDowLHJpZ2h0OjAsaGVpZ2h0OjQsYmFja2dyb3VuZDpgbGluZWFyLWdyYWRpZW50KDkwZGVnLCR7W1IsXCIjNjY3RUVBXCIsXCIjNDhCQjc4XCJdW2ldfSx0cmFuc3BhcmVudClgfX0vPlxyXG4gICAgICAgICAgPGRpdiBzdHlsZT17e2ZvbnRTaXplOjQ4LGxpbmVIZWlnaHQ6MSxtYXJnaW5Cb3R0b206OH19PntzdC5pY29ufTwvZGl2PlxyXG4gICAgICAgICAgPGRpdiBzdHlsZT17e3dpZHRoOjI4LGhlaWdodDoyOCxib3JkZXJSYWRpdXM6XCI1MCVcIixiYWNrZ3JvdW5kOlIsY29sb3I6XCIjZmZmXCIsZm9udFNpemU6MTMsZm9udFdlaWdodDo3MDAsZGlzcGxheTpcImlubGluZS1mbGV4XCIsYWxpZ25JdGVtczpcImNlbnRlclwiLGp1c3RpZnlDb250ZW50OlwiY2VudGVyXCIsbWFyZ2luQm90dG9tOjgsYm94U2hhZG93OlwiMCA0cHggMTJweCByZ2JhKDI1NSw3MSw4NywwLjIpXCJ9fT57c3Qubn08L2Rpdj5cclxuICAgICAgICAgIDxkaXYgc3R5bGU9e3tmb250U2l6ZToxNSxmb250V2VpZ2h0OjcwMCxtYXJnaW5Cb3R0b206Nn19PntzdC50fTwvZGl2PlxyXG4gICAgICAgICAgPGRpdiBzdHlsZT17e2ZvbnRTaXplOjEyLGNvbG9yOlwiIzk5OVwiLGxpbmVIZWlnaHQ6MS43fX0+e3N0LmR9PC9kaXY+XHJcbiAgICAgICAgPC9DYXJkPil9XHJcbiAgICAgIDwvZGl2PlxyXG4gICAgICA8cCBzdHlsZT17e3RleHRBbGlnbjpcImNlbnRlclwiLGZvbnRTaXplOjEyLGNvbG9yOlwiI2QwZDBkMFwiLG1hcmdpblRvcDoxNn19PuKPsSDlhajnqIvnuqYxNS0zMOenkiDCtyDkuI3mu6HmhI/lj6/lhY3otLnph43mlrDnlJ/miJA8L3A+XHJcbiAgICA8L3NlY3Rpb24+XHJcblxyXG4gICAgey8qIENUQSAqL31cclxuICAgIDxzZWN0aW9uIHN0eWxlPXt7dGV4dEFsaWduOlwiY2VudGVyXCIscGFkZGluZzpcIjQwcHggMjBweCAyMHB4XCJ9fT5cclxuICAgICAgPENoYXJJbWcgc3JjPXtJLmV4Y2l0ZWR9IGFsdD1cIlwiIHN0eWxlPXt7aGVpZ2h0OjU2fX0gZmlsdGVyPVwiZHJvcC1zaGFkb3coMCA0cHggMTJweCByZ2JhKDI1NSw3MSw4NywwLjEyKSlcIiBtYXJnaW49XCIwIDAgMTBweFwiLz5cclxuICAgICAgPGgyIHN0eWxlPXt7Zm9udFNpemU6MjIsZm9udFdlaWdodDo3MDAsbWFyZ2luOlwiMCAwIDZweFwifX0+5YeG5aSH5aW95LqG5ZCX77yfPC9oMj5cclxuICAgICAgPHAgc3R5bGU9e3tmb250U2l6ZToxMyxjb2xvcjpcIiM5OTlcIixtYXJnaW46XCIwIDAgMTZweFwifX0+e2xvZ2dlZD9cIui/mOacieabtOWkmuasoeaVsO+8jOe7p+e7reeUn+aIkFwiOlwi5paw55So5oi35YWN6LS555Sf5oiQIMK3IOS4jea7oeaEj+S4jeaUtui0uVwifTwvcD5cclxuICAgICAgPEJ0biBwcmltYXJ5IG9uQ2xpY2s9eygpPT53aW5kb3cuc2Nyb2xsVG8oe3RvcDowLGJlaGF2aW9yOlwic21vb3RoXCJ9KX0+PFNwYXJrbGVzIHNpemU9ezE1fS8+56uL5Y2z5YWN6LS55L2T6aqMPC9CdG4+XHJcbiAgICA8L3NlY3Rpb24+XHJcblxyXG4gICAgey8qIEZPT1RFUiAqL31cclxuICAgIDxmb290ZXIgc3R5bGU9e3twYWRkaW5nOlwiMzJweCAyMHB4XCIsYmFja2dyb3VuZDpcIiNmOWY5ZjlcIixib3JkZXJUb3A6XCIxcHggc29saWQgI2YwZjBmMFwiLG1hcmdpblRvcDo0MH19PlxyXG4gICAgICA8ZGl2IHN0eWxlPXt7bWF4V2lkdGg6ODAwLG1hcmdpbjpcIjAgYXV0b1wiLGRpc3BsYXk6XCJmbGV4XCIsanVzdGlmeUNvbnRlbnQ6XCJzcGFjZS1iZXR3ZWVuXCIsZmxleFdyYXA6XCJ3cmFwXCIsZ2FwOjIwfX0+XHJcbiAgICAgICAgPGRpdiBzdHlsZT17e2ZsZXg6XCIxIDEgMjgwcHhcIn19PlxyXG4gICAgICAgICAgPGRpdiBzdHlsZT17e2Rpc3BsYXk6XCJmbGV4XCIsYWxpZ25JdGVtczpcImNlbnRlclwiLGdhcDo4LG1hcmdpbkJvdHRvbTo4fX0+PGltZyBzcmM9e0kuYXBwaWNvbn0gc3R5bGU9e3t3aWR0aDoyNCxoZWlnaHQ6MjQsYm9yZGVyUmFkaXVzOjZ9fSBhbHQ9XCJcIi8+PHNwYW4gc3R5bGU9e3tmb250U2l6ZToxNCxmb250V2VpZ2h0OjcwMCxmb250RmFtaWx5OlwiUGluZ0ZhbmcgU0MsTWljcm9zb2Z0IFlhSGVpLHNhbnMtc2VyaWZcIn19PuiWr+WMhUFJPC9zcGFuPjwvZGl2PlxyXG4gICAgICAgICAgPHAgc3R5bGU9e3tmb250U2l6ZToxMixjb2xvcjpcIiM5OTlcIixsaW5lSGVpZ2h0OjEuOCxtYXJnaW46MH19PuS4k+azqOWwj+e6ouS5puWGheWuueWIm+S9nOeahEFJ5bel5YW344CC6KaG55uW5peF5ri45pS755Wl44CB5aW954mp6K+E5rWL44CB576O6aOf5o6i5bqX44CB56m/5pCt5YiG5Lqr44CB5a2m5Lmg5bmy6LSn562J54Ot6Zeo6LWb6YGT44CCQUnmmbrog73nlJ/miJDniIbmrL7moIfpopjjgIHnp43ojYnmlofmoYjlkoznsr7nvo7phY3lm77vvIzkuIDplK7nlJ/miJDlj6/nm7TmjqXlj5HluIPnmoTlsI/nuqLkuabniIbmrL7nrJTorrDjgII8L3A+XHJcbiAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgPGRpdiBzdHlsZT17e2ZsZXg6XCIwIDAgYXV0b1wifX0+XHJcbiAgICAgICAgICA8ZGl2IHN0eWxlPXt7Zm9udFNpemU6MTIsZm9udFdlaWdodDo2MDAsbWFyZ2luQm90dG9tOjh9fT7kuqflk4E8L2Rpdj5cclxuICAgICAgICAgIDxkaXYgc3R5bGU9e3tmb250U2l6ZToxMSxjb2xvcjpcIiM5OTlcIixsaW5lSGVpZ2h0OjJ9fT48c3BhbiBzdHlsZT17e2N1cnNvcjpcInBvaW50ZXJcIn19IG9uQ2xpY2s9eygpPT5zZXRQZyhcImdhbGxlcnlcIil9PuiWr+WMheWHuuWTgTwvc3Bhbj48YnIvPjxzcGFuIHN0eWxlPXt7Y3Vyc29yOlwicG9pbnRlclwifX0gb25DbGljaz17KCk9PnNldFBnKFwicHJpY2luZ1wiKX0+5Lu35qC85pa55qGIPC9zcGFuPjxici8+PHNwYW4gc3R5bGU9e3tjdXJzb3I6XCJwb2ludGVyXCJ9fSBvbkNsaWNrPXsoKT0+c2V0UGcoXCJ3b3Jrc1wiKX0+5oiR55qE5L2c5ZOBPC9zcGFuPjwvZGl2PlxyXG4gICAgICAgIDwvZGl2PlxyXG4gICAgICAgIDxkaXYgc3R5bGU9e3tmbGV4OlwiMCAwIGF1dG9cIn19PlxyXG4gICAgICAgICAgPGRpdiBzdHlsZT17e2ZvbnRTaXplOjEyLGZvbnRXZWlnaHQ6NjAwLG1hcmdpbkJvdHRvbTo4fX0+5YWz6ZSu6K+NPC9kaXY+XHJcbiAgICAgICAgICA8ZGl2IHN0eWxlPXt7Zm9udFNpemU6MTEsY29sb3I6XCIjY2NjXCIsbGluZUhlaWdodDoyfX0+5bCP57qi5Lmm5Zu+5paH55Sf5oiQIMK3IEFJ56eN6I2J56yU6K6wPGJyLz7niIbmrL7lhoXlrrnliJvkvZwgwrcg5bCP57qi5Lmm6YWN5Zu+PGJyLz7lubLotKfnrJTorrAgwrcg5LiA6ZSu55Sf5oiQ5Zu+5paHPC9kaXY+XHJcbiAgICAgICAgPC9kaXY+XHJcbiAgICAgIDwvZGl2PlxyXG4gICAgICA8ZGl2IHN0eWxlPXt7dGV4dEFsaWduOlwiY2VudGVyXCIsZm9udFNpemU6MTAsY29sb3I6XCIjZTBlMGUwXCIsbWFyZ2luVG9wOjIwfX0+wqkgMjAyNiDolq/ljIVBSSDCtyDlsI/nuqLkuabniIbmrL7lm77mlofkuIDplK5BSeeUn+aIkOW3peWFtzwvZGl2PlxyXG4gICAgPC9mb290ZXI+XHJcblxyXG4gIHtjc3MoKX17bG9naW5Nb2RhbH17cHJpY2VNb2RhbH08L2Rpdj47XHJcbn1cclxuIl0sImZpbGUiOiJEOi9BSee9keermS9zaHViYW8vc2h1YmFvLWZpbmFsLmpzeCJ9