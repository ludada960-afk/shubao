import { useState, useEffect, useRef } from "react";
import { Sparkles, Copy, Check, RefreshCw, User, Zap, Image as Img, FileText, Hash, Clock, ArrowLeft, ArrowRight, Heart, Eye, LogIn, CreditCard, Bookmark, RotateCcw, ChevronRight, ExternalLink, Star, Target, Layers, MousePointerClick, ShieldCheck, Palette } from "lucide-react";

const I = (()=>{const m={};const entries={"s1":"/images/cropped_13.png","s2":"/images/cropped_14.png","s3":"/images/cropped_15.png","s4":"/images/cropped_16.png","s5":"/images/cropped_17.png","wave":"/images/cropped_8.png","stand":"/images/cropped_9.png","excited":"/images/cropped_10.png","happy":"/images/cropped_11.png","appicon":"/images/cropped.png","logo":"/images/cropped_2.png","welcome":"/images/cropped_12.png","think":"/images/cropped_18.png","upgrade":"/images/cropped_19.png","loading":"/images/cropped_20.png","result":"/images/cropped_21.png","publish":"/images/cropped_22.png","tip":"/images/cropped_23.png","banner":"/images/cropped_24.png","idea":"/images/cropped_25.png","success":"/images/cropped_26.png","protect":"/images/cropped_27.png","scene":"/images/cropped_1.png","walk":"/images/walk.png","wave-hand":"/images/wave-hand.png","jump":"/images/jump.png","ready":"/images/ready.png","sit":"/images/sit.png","surf":"/images/surf.png","meditate":"/images/meditate.png","cook":"/images/cook.png","dance":"/images/dance.png","done":"/images/done.png","superhero":"/images/superhero.png","curator":"/images/curator.png","inspect":"/images/inspect.png","photographer":"/images/photographer.png","lift":"/images/lift.png"};for(const[k,v]of Object.entries(entries)){m[k]=new URL(v,import.meta.url).href}return m;})();;
const R="#FF4757",R2="#FF6B81",G="#7EC882",BG="#FFFAF9";

const GALLERY=[
  {id:1,title:"云南3天2夜攻略🔥人均800玩到爽",cat:"旅游攻略",grad:"linear-gradient(135deg,#FF6B35,#F7C59F)",likes:2847,body:"家人们谁懂啊！刚从云南回来，3天2夜人均才800...\n✅ Day1：大理古城→洱海骑行→双廊\n⭐ Day2：苍山洗马潭索道→喜洲古镇\n📌 Day3：丽江古城→束河古镇\n💰 住宿推荐洱海边民宿，看日出太美了，人均100/晚\n\n⚠️ 防晒一定带够！高原紫外线真的猛\n\n有问题评论区问我～点赞收藏不迷路👇\n#云南旅游 #大理攻略 #穷游 #旅行干货 #三天两夜",tags:["#云南旅游","#大理","#穷游攻略","#旅行干货","#三天两夜"],hint:"云南3天2夜旅游攻略"},
  {id:2,title:"5款百元蓝牙耳机测评✨学生党冲",cat:"好物评测",grad:"linear-gradient(135deg,#FF61D2,#FE9090)",likes:1563,body:"谁懂啊这个价格这个音质！花了一个月测了5款百元耳机\n🎧 漫步者LolliPods Mini 89元 入门首选\n🔥 QCY T13 69元 性价比之王\n💡 倍思Bowie E8 129元 颜值担当\n🎯 Redmi Buds 4 99元 小米生态\n⚡ 联想TC3303 59元 极致低价\n\n从音质、续航、降噪、佩戴四个维度对比\n#蓝牙耳机 #学生党 #数码测评 #好物推荐 #平价好物",tags:["#蓝牙耳机","#学生党","#好物推荐","#数码测评"],hint:"百元蓝牙耳机测评"},
  {id:3,title:"上海探店｜藏在弄堂里的宝藏居酒屋😱",cat:"美食探店",grad:"linear-gradient(135deg,#F97316,#FBBF24)",likes:3201,body:"这家店我真的私藏很久了！人均才80！\n🍶 招牌烤串配日式酸梅酒绝了\n🐟 刺身拼盘新鲜到发光\n📍 地址：思南路xx弄\n⏰ 营业到凌晨2点\n\n老板是日本回来的大厨，每天限量供应\n别信大众点评前排的，跟着我走\n#上海美食 #居酒屋 #探店 #上海生活 #美食推荐",tags:["#上海探店","#美食","#居酒屋","#上海生活"],hint:"上海弄堂宝藏居酒屋"},
  {id:4,title:"秋冬通勤穿搭💼5套不重样高级感look",cat:"穿搭分享",grad:"linear-gradient(135deg,#EC4899,#8B5CF6)",likes:4102,body:"打工人也要精致上班！预算500搞定一周穿搭\n👗 核心单品：驼色大衣（百搭神器）\n✅ 周一：大衣+针织裙+乐福鞋\n✅ 周二：西装外套+阔腿裤\n✅ 周三：卫衣+半裙+马丁靴\n\n全部平价单品，打工人友好\n#穿搭分享 #通勤穿搭 #秋冬穿搭 #高级感 #平价穿搭",tags:["#穿搭","#通勤","#秋冬穿搭","#高级感"],hint:"秋冬5套通勤穿搭"},
  {id:5,title:"iPad Pro M4两个月真实体验📱值不值",cat:"数码3C",grad:"linear-gradient(135deg,#3B82F6,#6366F1)",likes:1890,body:"设计师用了两个月的真实感受！\n🎨 画画：Procreate丝滑到飞起\n💡 续航：重度使用撑8小时\n📱 屏幕：OLED太绝了暗部细节拉满\n⚠️ 缺点：价格确实贵、配件另算\n\n如果你是设计师/插画师，闭眼入\n#iPad #数码测评 #设计师 #iPadPro #生产力工具",tags:["#iPad","#数码","#设计师","#数码测评"],hint:"iPad Pro两个月使用体验"},
  {id:6,title:"考研英语从38到82📚我的逆袭方法",cat:"学习干货",grad:"linear-gradient(135deg,#7C3AED,#A78BFA)",likes:5630,body:"家人们我真的做到了！四个月英语逆袭44分！\n📌 阶段一：单词（墨墨背单词每天200个）\n📌 阶段二：长难句（田静网课跟完）\n📌 阶段三：真题（近15年反复刷3遍）\n\n最重要的是每天固定3小时英语时间\n别看经验贴焦虑，执行力才是一切\n#考研 #考研英语 #学习方法 #逆袭 #学习干货",tags:["#考研","#英语","#学习干货","#逆袭"],hint:"考研英语逆袭方法"},
];
const QUICK_HINTS=["☀️ 云南3天2夜旅游攻略","🎧 百元蓝牙耳机测评","🍜 上海宝藏居酒屋探店","👗 秋冬5套通勤穿搭","📱 iPad Pro使用体验","📚 考研英语逆袭方法","🏠 租房改造花了500块","🧴 油皮护肤品合集","🍳 一人食快手晚餐"];
const PRICING=[
  {name:"入门",price:18,sets:7,regen:3,desc:"适合偶尔创作",per:"2.6"},
  {name:"进阶",price:42,sets:20,regen:5,pop:true,desc:"个人博主首选",per:"2.1"},
  {name:"创作者",price:78,sets:45,regen:8,desc:"高频创作者",per:"1.7"},
  {name:"工作室",price:148,sets:100,regen:"不限",desc:"团队批量使用",per:"1.5"},
];
const TIPS=["标题带数字的笔记，点击率平均高出47%","发布时间建议：周四/周五晚上8-9点","正文前3行决定80%用户是否继续阅读","每篇笔记建议5-7个精准标签","封面图配色统一度直接影响账号调性","评论区互动率高的笔记更容易被推荐","带价格的种草笔记收藏率高出60%","干货笔记的生命周期比日常分享长3倍"];
const STAGES=[
  {img:"s1",label:"研读素材",desc:"小薯包正在认真分析你的内容..."},
  {img:"s2",label:"撰写文案",desc:"灵感爆发！正在打磨爆款文案"},
  {img:"s3",label:"生成配图",desc:"正在精心绘制第 {n}/9 张图片"},
  {img:"s4",label:"质量检查",desc:"最后检查一下，确保每张都完美"},
  {img:"s5",label:"打包完成",desc:"搞定！你的爆款图文来啦"},
];
const FEATURES=[
  {icon:Target,title:"智能识别赛道",desc:"粘贴任意素材，AI自动判断旅游、美食、好物等最佳内容策略，不需要手动选择"},
  {icon:Zap,title:"爆款公式驱动",desc:"内置数字结果式、反差痛点式等经过验证的爆款标题和正文公式"},
  {icon:Layers,title:"9张完整配图",desc:"1张封面+8张内容页，带拼图排版和文字标注，下载即可发布"},
  {icon:RotateCcw,title:"单张可重新生成",desc:"对某张图不满意？单独刷新这一张，不浪费整套额度"},
  {icon:MousePointerClick,title:"一键复制文案",desc:"标题、正文、标签分别复制或一键全部复制，打开小红书直接粘贴发布"},
  {icon:ShieldCheck,title:"按套计费不套路",desc:"用多少买多少，不搞自动续费，新用户免费体验1套"},
];

const API='http://localhost:3099';
/* ═══════ API ═══════ */
;
async function genAPI(t){try{const r=await fetch(API+"/api/generate",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({text:t})});if(r.ok)return await r.json();const errText=await r.text().catch(()=>r.statusText);throw new Error(errText.slice(0,200));}catch(e){throw new Error("生成失败："+e.message);}}

/* ═══════ STORAGE ═══════ */
async function saveWork(w){try{await fetch(API+"/api/save-work",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({work:w})});}catch(e){console.warn("saveWork error:",e.message);}}
async function loadWorks(){try{const r=await fetch(API+"/api/works");if(r.ok)return await r.json();}catch(e){console.warn("loadWorks error:",e.message);}return[];}
function getPts(){try{return parseInt(localStorage.getItem("sb-p")||"1");}catch{return 1;}}
async function setPts(n){try{localStorage.setItem("sb-p",String(n));}catch{}}

/* ═══════ UI ATOMS ═══════ */

/* ═══════ UI ATOMS ═══════ */
const s={card:{background:"#fff",borderRadius:16,border:"1px solid #f0f0f0",overflow:"hidden"},
  cardP:{background:"#fff",borderRadius:16,border:"1px solid #f0f0f0",padding:"20px 22px"},
  section:{maxWidth:800,margin:"0 auto",padding:"40px 20px"},
  sectionTitle:{fontSize:22,fontWeight:700,textAlign:"center",margin:"0 0 6px"},
  sectionSub:{fontSize:13,color:"#999",textAlign:"center",margin:"0 0 28px"}};

function Btn({children,primary,small,onClick,disabled,full,sx={}}){const[h,setH]=useState(false);
  return <button style={{display:"inline-flex",alignItems:"center",justifyContent:"center",gap:7,border:primary?"none":"1px solid #e8e8e8",borderRadius:small?8:12,fontSize:small?12:15,fontWeight:600,cursor:disabled?"not-allowed":"pointer",fontFamily:"inherit",transition:"all 0.2s",transform:h&&!disabled?"translateY(-1px)":"none",padding:small?"6px 14px":"13px 28px",width:full?"100%":"auto",background:primary?(disabled?"#FFB3BD":R):(h?"#f8f8f8":"#fff"),color:primary?"#fff":"#555",boxShadow:primary&&h&&!disabled?"0 6px 24px rgba(255,71,87,0.25)":"none",...sx}} onClick={onClick} disabled={disabled} onMouseEnter={()=>setH(true)} onMouseLeave={()=>setH(false)}>{children}</button>;}

function CopyBtn({text,label="复制"}){const[ok,setOk]=useState(false);return <Btn small onClick={()=>{navigator.clipboard?.writeText(text);setOk(true);setTimeout(()=>setOk(false),1500);}} sx={{color:ok?G:"#aaa",background:ok?"#F0FFF4":"#f8f8f8",border:"none"}}>{ok?<><Check size={12}/>已复制</>:<><Copy size={12}/>{label}</>}</Btn>;}

function Card({children,sx={},hover,onClick}){const[h,setH]=useState(false);return <div onClick={onClick} style={{...s.card,transition:"all 0.25s ease",transform:h&&hover?"translateY(-4px)":"none",boxShadow:h&&hover?"0 12px 40px rgba(0,0,0,0.08)":"0 1px 3px rgba(0,0,0,0.02)",cursor:hover?"pointer":"default",...sx}} onMouseEnter={()=>setH(true)} onMouseLeave={()=>setH(false)}>{children}</div>;}

/* ═══════ CHARACTER IMAGE — Canvas 真实抠白底 ═══════ */
const _rmBg = {};
async function _removeWhiteBg(dataUrl) {
  if (_rmBg[dataUrl]) return _rmBg[dataUrl];
  try {
    const img = new Image();
    await new Promise((r, rej) => { img.onload = r; img.onerror = rej; img.src = dataUrl; });
    const c = document.createElement('canvas'), ctx = c.getContext('2d');
    c.width = img.naturalWidth; c.height = img.naturalHeight;
    ctx.drawImage(img, 0, 0);
    const d = ctx.getImageData(0, 0, c.width, c.height), a = d.data;
    // 采样四角像素取背景色
    const corner = (x, y) => { const i = (y * c.width + x) * 4; return [a[i], a[i + 1], a[i + 2]]; };
    const corners = [corner(0, 0), corner(c.width - 1, 0), corner(0, c.height - 1), corner(c.width - 1, c.height - 1)];
    const bgR = corners.reduce((s, p) => s + p[0], 0) / 4;
    const bgG = corners.reduce((s, p) => s + p[1], 0) / 4;
    const bgB = corners.reduce((s, p) => s + p[2], 0) / 4;
    const THRESHOLD = 30;      // 色差距离小于此 = 背景
    const FEATHER = 20;        // 羽化过渡带宽度
    for (let i = 0; i < a.length; i += 4) {
      const dr = a[i] - bgR, dg = a[i + 1] - bgG, db = a[i + 2] - bgB;
      const dist = Math.sqrt(dr * dr + dg * dg + db * db);
      if (dist < THRESHOLD) {
        a[i + 3] = 0;
      } else if (dist < THRESHOLD + FEATHER) {
        a[i + 3] = Math.floor(255 * (dist - THRESHOLD) / FEATHER);
      }
    }
    ctx.putImageData(d, 0, 0);
    _rmBg[dataUrl] = c.toDataURL('image/png');
    return _rmBg[dataUrl];
  } catch (e) {
    console.warn('CharImg bg removal failed, fallback to original:', e);
    _rmBg[dataUrl] = dataUrl;
    return dataUrl;
  }
}

function CharImg({ src, alt, style = {}, margin, filter = "drop-shadow(0 4px 12px rgba(255,71,87,0.12))" }) {
  const [clean, setClean] = useState(() => _rmBg[src] || null);
  useEffect(() => { if (!_rmBg[src]) _removeWhiteBg(src).then(setClean); }, [src]);
  const wStyle = { display: "inline-flex", alignItems: "center", justifyContent: "center", margin: margin || 0, filter: filter || "none", lineHeight: 0 };
  return <div style={wStyle}>
    <img src={clean || src} alt={alt || ""} style={{ ...style, display: "block", maxWidth: "100%", objectFit: "contain", mixBlendMode: clean ? "normal" : "multiply" }} />
  </div>;
}

function Modal({children,onClose}){return <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:999,display:"flex",alignItems:"center",justifyContent:"center",backdropFilter:"blur(6px)",animation:"fadeIn 0.15s"}} onClick={onClose}><div onClick={e=>e.stopPropagation()} style={{background:"#fff",borderRadius:24,padding:"36px 30px",width:400,maxWidth:"92vw",animation:"slideUp 0.25s ease",maxHeight:"90vh",overflow:"auto"}}>{children}</div></div>;}

/* ═══════ GALLERY CARD ═══════ */
function GCard({item,onClick}){const[h,setH]=useState(false);
  return <Card hover onClick={onClick} sx={{overflow:"hidden"}} >
    <div style={{background:item.grad,height:140,position:"relative"}} onMouseEnter={()=>setH(true)} onMouseLeave={()=>setH(false)}>
      <div style={{position:"absolute",inset:0,background:"linear-gradient(transparent 40%,rgba(0,0,0,0.5))"}}/>
      <span style={{position:"absolute",top:10,left:10,fontSize:10,background:"rgba(255,255,255,0.2)",color:"#fff",padding:"3px 10px",borderRadius:8,backdropFilter:"blur(4px)"}}>{item.cat}</span>
      {h&&<div style={{position:"absolute",inset:0,background:"rgba(0,0,0,0.25)",display:"flex",alignItems:"center",justifyContent:"center",animation:"fadeIn 0.15s"}}>
        <span style={{background:"rgba(255,255,255,0.95)",color:R,fontSize:12,fontWeight:600,padding:"8px 18px",borderRadius:10,display:"flex",alignItems:"center",gap:5,boxShadow:"0 4px 12px rgba(0,0,0,0.1)"}}><Eye size={13}/>查看全套内容</span>
      </div>}
    </div>
    <div style={{padding:"12px 14px"}}>
      <div style={{fontSize:13,fontWeight:600,lineHeight:1.5,marginBottom:6,display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical",overflow:"hidden"}}>{item.title}</div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <span style={{fontSize:10,color:"#ccc",display:"flex",alignItems:"center",gap:3}}><Heart size={10}/>{item.likes}</span>
        <span style={{fontSize:9,color:"#e0e0e0",fontStyle:"italic"}}>薯包AI出品</span>
      </div>
    </div>
  </Card>;}

/* ═══════ MAIN APP ═══════ */
export default function App(){
  const[pg,setPg]=useState("home");
  const[logged,setLogged]=useState(false);
  const[showLogin,setShowLogin]=useState(false);
  const[showPrice,setShowPrice]=useState(false);
  const[text,setText]=useState("");
  const[gen,setGen]=useState("idle");
  const[stage,setStage]=useState(0);
  const[result,setResult]=useState(null);
  const[works,setWorks]=useState([]);
  const[pts,setPtsS]=useState(1);
  const[tipIdx,setTipIdx]=useState(0);
  const[aPg,setAPg]=useState(null);
  const[gItem,setGItem]=useState(null);
  const[err,setErr]=useState("");
  const[carouselIdx,setCarouselIdx]=useState(0);
  const freeUsed=useRef(false);
  const tm=useRef([]);

  useEffect(()=>{loadWorks().then(setWorks);getPts().then(setPtsS);},[]);
  useEffect(()=>{if(gen==="loading"){const t=setInterval(()=>setTipIdx(i=>(i+1)%TIPS.length),4000);return()=>clearInterval(t);}},[gen]);
  useEffect(()=>{if(gen!=="loading"){const t=setInterval(()=>setCarouselIdx(i=>(i+1)%QUICK_HINTS.length),3000);return()=>clearInterval(t);}},[gen]);

  const doGen=async()=>{if(!text.trim())return;
    if(!logged&&freeUsed.current){setShowLogin(true);return;}
    if(pts<=0&&logged){setShowPrice(true);return;}
    setGen("loading");setErr("");setStage(0);setResult(null);tm.current.forEach(clearTimeout);
    tm.current=[setTimeout(()=>setStage(1),3e3),setTimeout(()=>setStage(2),8e3),setTimeout(()=>setStage(3),14e3)];
    try{const r=await genAPI(text);tm.current.forEach(clearTimeout);setStage(4);
      setTimeout(()=>{setResult(r);setGen("result");setAPg(null);setPg("home");},600);
      var np=(pts||1)-1;setPtsS(Math.max(0,np));try{await setPts(Math.max(0,np));}catch(e){}await saveWork({title:r.title,category:r.category,body_text:r.body_text,hashtags:r.hashtags,pages:r.pages,_inputText:text});setWorks(await loadWorks());freeUsed.current=true;
      
    }catch(e){tm.current.forEach(clearTimeout);setErr(e.message);setGen("idle");}};
  const textRegen=async()=>{
    var inp=result?._inputText||text;
    if(!inp){alert("无法找到原始输入");return;}
    if(!confirm("重新生成将消耗额度，确定？"))return;
    var ov=document.createElement("div");
    ov.style.cssText="position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.55);display:flex;flex-direction:column;align-items:center;justify-content:center;backdrop-filter:blur(6px);animation:fadeIn .15s";
    ov.innerHTML='<div style="background:#fff;border-radius:20px;padding:32px 40px;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,0.3);animation:slideUp .25s"><svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="#FF4757" stroke-width="2.5" stroke-linecap="round" class="spin"><path d="M12 2v4"/><path d="M12 18v4"/><path d="M4.93 4.93l2.83 2.83"/><path d="M16.24 16.24l2.83 2.83"/><path d="M2 12h4"/><path d="M18 12h4"/><path d="M4.93 19.07l2.83-2.83"/><path d="M16.24 7.76l2.83-2.83"/></svg><div style="font-size:17px;font-weight:700;margin-top:16px;color:#333">✍️ 正在重新生成文章</div><div style="font-size:13px;color:#999;margin-top:6px">请勿刷新或关闭页面，否则会消耗额度</div></div>';
    document.body.appendChild(ov);
    try{
      var r=await fetch(API+"/api/regenerate-text",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({text:inp})});
      if(!r.ok)throw Error("E");
      var d2=await r.json();
      setResult(p=>({...p,title:d2.title,body_text:d2.body_text,hashtags:d2.hashtags,category:d2.category,_inputText}));
    }catch(err){alert("重新生成失败");}
    ov.remove();
  };

  /* ═══════ NAV ═══════ */
  const nav=<nav style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 28px",background:"rgba(255,255,255,0.92)",borderBottom:"1px solid #f0f0f0",position:"sticky",top:0,zIndex:100,backdropFilter:"blur(14px)"}}>
    <div style={{display:"flex",alignItems:"center",gap:20}}>
      <div style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer"}} onClick={()=>{setPg("home");setGen("idle");setResult(null);setGItem(null);}}>
        <img src={I.appicon} alt="薯包AI" style={{width:30,height:30,borderRadius:8}}/>
        <span style={{fontSize:16,fontWeight:700}}>薯包AI</span>
      </div>
      <div style={{display:"flex",gap:4}}>
        {[["home","首页"],["gallery","薯包出品"],["pricing","价格方案"],["works","我的作品"]].map(([k,v])=>
          <button key={k} onClick={()=>setPg(k)} style={{fontSize:13,color:pg===k?R:"#777",fontWeight:pg===k?600:400,background:"none",border:"none",padding:"6px 12px",cursor:"pointer",borderRadius:8,transition:"all 0.15s"}}>{v}</button>)}
      </div>
    </div>
    <div style={{display:"flex",alignItems:"center",gap:8}}>
      {logged&&<span style={{fontSize:11,color:R,background:"#FFF1F3",padding:"4px 12px",borderRadius:20,fontWeight:600,display:"flex",alignItems:"center",gap:4}}><Sparkles size={11}/>{pts}套</span>}
      <Btn small onClick={()=>logged?setLogged(false):setShowLogin(true)} sx={{background:logged?"#F0FFF4":"#f5f5f5",color:logged?G:"#777",border:"none"}}>{logged?<><Check size={12}/>已登录</>:<><LogIn size={12}/>登录</>}</Btn>
    </div>
  </nav>;

  const css=<style>{`@keyframes fadeIn{from{opacity:0}to{opacity:1}}@keyframes slideUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}@keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}@keyframes scroll-h{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}*::-webkit-scrollbar{width:4px}*::-webkit-scrollbar-thumb{background:#e8e8e8;border-radius:2px}::selection{background:#FFE0E4}`}</style>;

  const loginModal=showLogin&&<Modal onClose={()=>setShowLogin(false)}>
    <div style={{textAlign:"center",marginBottom:24}}><CharImg src={I.wave} alt="" style={{height:64}}/><div style={{fontSize:20,fontWeight:700,marginTop:8}}>欢迎来到薯包AI</div><div style={{fontSize:13,color:"#999"}}>小红书爆款图文，一键生成</div></div>
    <input placeholder="手机号" style={{width:"100%",padding:"12px 16px",border:"1.5px solid #eee",borderRadius:12,fontSize:14,marginBottom:10,boxSizing:"border-box",outline:"none"}}/>
    <input placeholder="验证码" style={{width:"100%",padding:"12px 16px",border:"1.5px solid #eee",borderRadius:12,fontSize:14,marginBottom:20,boxSizing:"border-box",outline:"none"}}/>
    <Btn primary full onClick={()=>{setLogged(true);setShowLogin(false);}}><LogIn size={15}/>登录 / 注册</Btn>
    <div style={{textAlign:"center",marginTop:10,fontSize:10,color:"#ddd"}}>登录后可把作品保存到个人作品集</div>
  </Modal>;

  const priceModal=showPrice&&<Modal onClose={()=>setShowPrice(false)}>
    <div style={{textAlign:"center",marginBottom:20}}><CharImg src={I.upgrade} alt="" style={{height:80}} filter="drop-shadow(0 6px 16px rgba(255,71,87,0.15))"/><div style={{fontSize:20,fontWeight:700,marginTop:8}}>选择套餐充值</div><div style={{fontSize:12,color:"#999"}}>按套收费，不自动续费，用多少买多少</div></div>
    <div style={{display:"flex",flexDirection:"column",gap:8}}>{PRICING.map((p,i)=><div key={i} onClick={()=>{setPtsS(pts+p.sets);setPts(pts+p.sets);setShowPrice(false);}} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 18px",borderRadius:14,border:p.pop?"2px solid "+R:"1px solid #f0f0f0",cursor:"pointer",background:p.pop?"#FFF8F9":"#fff",transition:"all 0.2s"}}><div><div style={{fontSize:14,fontWeight:700}}>{p.name}{p.pop&&<span style={{fontSize:10,color:"#fff",background:R,padding:"2px 8px",borderRadius:6,marginLeft:8}}>推荐</span>}</div><div style={{fontSize:11,color:"#999"}}>{p.sets}套 · 单张重生成{p.regen}次/套 · ¥{p.per}/套</div></div><div style={{fontSize:22,fontWeight:800,color:R}}>¥{p.price}</div></div>)}</div>
  </Modal>;

  /* ═══════ LOADING ═══════ */
  if(gen==="loading"){const st=STAGES[stage]||STAGES[0];
    return <div style={{minHeight:"100vh",background:BG}}>{nav}
      <div style={{maxWidth:440,margin:"0 auto",padding:"50px 20px",textAlign:"center",animation:"fadeIn 0.3s"}}>
        <CharImg src={I[st.img]} alt={st.label} style={{height:170,animation:"float 2s ease-in-out infinite"}} filter="drop-shadow(0 8px 24px rgba(255,71,87,0.12))" margin="0 0 20px"/>
        <div style={{fontSize:22,fontWeight:700,marginBottom:6}}>{st.label}</div>
        <div style={{fontSize:14,color:"#888",marginBottom:28}}>{st.desc.replace("{n}",String(Math.min(stage*3+1,9)))}</div>
        <div style={{display:"flex",gap:3,marginBottom:24,padding:"0 30px"}}>{STAGES.map((_,i)=><div key={i} style={{flex:1,height:5,borderRadius:3,background:i<=stage?R:"#f0f0f0",transition:"background 0.5s"}}/>)}</div>
        <div style={{background:"#FFF5F5",borderRadius:12,padding:"12px 18px",marginBottom:20,fontSize:12,color:"#C53030",display:"flex",alignItems:"center",gap:6,justifyContent:"center"}}><Clock size={13}/>生成中请勿刷新页面，否则会浪费1套额度</div>
        <div style={{...s.cardP,textAlign:"left"}}><div style={{fontSize:10,color:"#ccc",marginBottom:4,display:"flex",alignItems:"center",gap:4}}><Zap size={10}/>小红书冷知识</div><div style={{fontSize:13,color:"#666",lineHeight:1.7,minHeight:32}}>{TIPS[tipIdx]}</div></div>
        <div style={{fontSize:11,color:"#ddd",marginTop:16}}>预计需要 15-30 秒</div>
      </div>{css}</div>;}

  /* ═══════ RESULT ═══════ */
  if(gen==="result"&&result){const p=result.pages?.[aPg];
    return <div style={{minHeight:"100vh",background:BG}}>{nav}
      <div style={{maxWidth:760,margin:"0 auto",padding:"20px 20px 60px",animation:"slideUp 0.4s ease"}}>
        {!logged&&<div style={{background:"linear-gradient(135deg,#FFE0E4,#FFF0F2)",borderRadius:14,padding:"14px 18px",marginBottom:16,display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,animation:"slideUp 0.3s"}}><div style={{display:"flex",alignItems:"center",gap:8}}><LogIn size={16} color={R}/><span style={{fontSize:13,color:"#333"}}><strong>登录</strong>即可把作品保存到「我的作品」</span></div><Btn small onClick={()=>setShowLogin(true)} sx={{background:R,color:"#fff",border:"none",whiteSpace:"nowrap"}}>登录 / 注册</Btn></div>}
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:16}}><Btn small onClick={()=>{setGen("idle");setResult(null);}}><ArrowLeft size={14}/>返回</Btn><span style={{fontSize:12,background:"#FFF1F3",color:R,padding:"4px 12px",borderRadius:20,fontWeight:600}}>{result.category}</span><span style={{fontSize:11,color:"#ccc"}}>{result.audience} · {result.tip}</span></div>
        <div style={{...s.cardP,marginBottom:14}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12}}><h2 style={{fontSize:20,fontWeight:800,color:R,margin:0,lineHeight:1.4,flex:1}}>{result.title}</h2><CopyBtn text={result.title} label="复制标题"/></div></div>
        <div style={{...s.cardP,marginBottom:14}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}><span style={{fontSize:15,fontWeight:600,display:"flex",alignItems:"center",gap:6}}><FileText size={16} color={R}/>正文</span><CopyBtn text={result.body_text} label="复制正文"/></div><div style={{fontSize:14,lineHeight:2.1,color:"#333",whiteSpace:"pre-wrap"}}>{result.body_text}</div></div>
        <div style={{...s.cardP,marginBottom:14}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}><span style={{fontSize:15,fontWeight:600,display:"flex",alignItems:"center",gap:6}}><Hash size={16} color={R}/>推荐标签</span><CopyBtn text={(result.hashtags||[]).join(" ")} label="复制标签"/></div><div style={{display:"flex",flexWrap:"wrap",gap:6}}>{(result.hashtags||[]).map((h,i)=><span key={i} style={{fontSize:13,color:R,background:"#FFF1F3",padding:"5px 14px",borderRadius:20,fontWeight:500}}>{h}</span>)}</div></div>
        <div style={{...s.cardP,marginBottom:14}}><div style={{fontSize:15,fontWeight:600,marginBottom:12,display:"flex",alignItems:"center",gap:6}}><Img size={16} color={R}/>8页图文内容规划</div><div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8}}>{(result.pages||[]).map((pg,i)=><div key={i} onClick={()=>setAPg(aPg===i?null:i)} style={{padding:12,borderRadius:12,border:aPg===i?"2px solid "+R:"1.5px solid #f0f0f0",cursor:"pointer",background:aPg===i?"#FFF8F9":"#FAFAFA",transition:"all 0.2s",textAlign:"center"}}><div style={{fontSize:18,marginBottom:2}}>{pg.emoji}</div><div style={{fontSize:11,fontWeight:600,color:aPg===i?R:"#555"}}>{pg.title}</div></div>)}</div>{p&&<div style={{marginTop:12,padding:16,background:"#FAFAFA",borderRadius:12,fontSize:13,lineHeight:1.8,color:"#555",animation:"fadeIn 0.2s",borderLeft:"3px solid "+R}}><strong style={{color:R}}>P{p.id} {p.title}</strong><br/>{p.text}</div>}</div>
        <div style={{display:"flex",gap:10}}><Btn small onClick={textRegen} sx={{background:"#fff",color:R,border:"1.5px solid "+R,fontSize:12,padding:"6px 12px"}}><RefreshCw size={12}/> 重新生成文章</Btn><Btn primary full onClick={()=>{navigator.clipboard?.writeText(result.title+"\n\n"+result.body_text+"\n\n"+(result.hashtags||[]).join(" "));}}><Copy size={15}/>一键复制全部文案</Btn><Btn onClick={()=>{setGen("idle");setResult(null);}}><RotateCcw size={14}/></Btn></div>
      </div>{css}{loginModal}{priceModal}</div>;}

  /* ═══════ FULL GALLERY PAGE ═══════ */
  if(pg==="gallery"&&!gItem){return <div style={{minHeight:"100vh",background:BG}}>{nav}
    <div style={{...s.section}}>
      <h1 style={{...s.sectionTitle}}>薯包出品</h1>
      <p style={{...s.sectionSub}}>以下内容全部由薯包AI一键生成，点击任意作品查看完整图文</p>
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14}}>{GALLERY.map(g=><GCard key={g.id} item={g} onClick={()=>setGItem(g)}/>)}</div>
    </div>{css}{loginModal}{priceModal}</div>;}

  /* ═══════ GALLERY DETAIL ═══════ */
  if(gItem){return <div style={{minHeight:"100vh",background:BG}}>{nav}
    <div style={{maxWidth:640,margin:"0 auto",padding:"20px 20px 60px",animation:"slideUp 0.3s ease"}}>
      <Btn small onClick={()=>setGItem(null)} sx={{marginBottom:14}}><ArrowLeft size={14}/>返回{pg==="gallery"?"薯包出品":"首页"}</Btn>
      <Card sx={{overflow:"hidden"}}>
        <div style={{background:gItem.grad,height:200,display:"flex",alignItems:"flex-end",padding:24,position:"relative"}}>
          <div style={{position:"absolute",inset:0,background:"linear-gradient(transparent 30%,rgba(0,0,0,0.6))"}}/>
          <div style={{position:"relative"}}><span style={{fontSize:11,background:"rgba(255,255,255,0.2)",color:"#fff",padding:"3px 10px",borderRadius:8,backdropFilter:"blur(4px)"}}>{gItem.cat}</span><h2 style={{color:"#fff",fontSize:20,fontWeight:700,margin:"8px 0 0",textShadow:"0 2px 8px rgba(0,0,0,0.3)",lineHeight:1.4}}>{gItem.title}</h2></div>
        </div>
        <div style={{padding:24}}>
          <div style={{fontSize:14,lineHeight:2.1,color:"#333",whiteSpace:"pre-wrap",marginBottom:20}}>{gItem.body}</div>
          <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:20}}>{gItem.tags.map((t,i)=><span key={i} style={{fontSize:12,color:R,background:"#FFF1F3",padding:"4px 14px",borderRadius:20}}>{t}</span>)}</div>
          <div style={{display:"flex",gap:10}}><Btn primary full onClick={()=>{setText(gItem.hint||gItem.body.split("\n")[0]);setGItem(null);setPg("home");}}><Sparkles size={14}/>一键同款</Btn><Btn onClick={()=>setGItem(null)}>返回</Btn></div>
        </div>
      </Card>
    </div>{css}{loginModal}{priceModal}</div>;}

  /* ═══════ PRICING PAGE ═══════ */
  if(pg==="pricing"){return <div style={{minHeight:"100vh",background:BG}}>{nav}
    <div style={{...s.section}}>
      <h1 style={{...s.sectionTitle}}>价格方案</h1>
      <p style={{...s.sectionSub}}>按套收费，不搞自动续费。每套包含完整的标题+正文+标签+9张配图</p>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12}}>{PRICING.map((p,i)=><Card key={i} sx={{padding:20,textAlign:"center",border:p.pop?"2px solid "+R:"1px solid #f0f0f0",position:"relative"}}>
        {p.pop&&<div style={{position:"absolute",top:-11,left:"50%",transform:"translateX(-50%)",background:R,color:"#fff",fontSize:10,padding:"3px 14px",borderRadius:10,fontWeight:600}}>推荐</div>}
        <div style={{fontSize:15,fontWeight:700,marginBottom:4}}>{p.name}</div>
        <div style={{fontSize:11,color:"#999",marginBottom:12}}>{p.desc}</div>
        <div style={{fontSize:32,fontWeight:800,color:R,marginBottom:2}}>¥{p.price}</div>
        <div style={{fontSize:12,color:"#bbb",marginBottom:12}}>{p.sets}套图文</div>
        <div style={{fontSize:11,color:"#ccc",marginBottom:4}}>单张重生成 {p.regen}次/套</div>
        <div style={{fontSize:11,color:"#ccc",marginBottom:14}}>约 ¥{p.per}/套</div>
        <Btn primary={p.pop} full small onClick={()=>{if(!logged)setShowLogin(true);else{setPtsS(pts+p.sets);setPts(pts+p.sets);}}}>{p.pop?<><Sparkles size={12}/>立即购买</>:"选择"}</Btn>
      </Card>)}</div>
      <div style={{textAlign:"center",marginTop:24,fontSize:12,color:"#ccc"}}>所有套餐均为一次性购买，不自动续费，不限使用时间</div>
    </div>{css}{loginModal}{priceModal}</div>;}

  /* ═══════ WORKS PAGE ═══════ */
  if(pg==="works"){return <div style={{minHeight:"100vh",background:BG}}>{nav}
    <div style={{...s.section}}>
      <h1 style={{...s.sectionTitle}}>我的作品</h1>
      <p style={{...s.sectionSub}}>{works.length?works.length+"个作品":"还没有作品，去创作第一套爆款图文吧"}</p>
      {!works.length?<div style={{textAlign:"center",padding:"40px 0"}}><CharImg src={I.welcome} alt="" style={{height:120}} filter="none" margin="0 0 16px"/>
        {logged?<Btn primary onClick={()=>setPg("home")}><Sparkles size={14}/>开始创作</Btn>:<><p style={{fontSize:13,color:"#999",margin:"0 0 12px"}}>登录后，生成的内容会自动保存到这里</p><Btn primary onClick={()=>setShowLogin(true)}><LogIn size={14}/>登录查看作品</Btn></>}
      </div>
      :<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>{works.map(w=><Card key={w.id} hover onClick={()=>{setResult(w);setGen("result");setPg("home");}} sx={{padding:16}}>
        <div style={{fontSize:14,fontWeight:600,lineHeight:1.5,marginBottom:6,display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical",overflow:"hidden"}}>{w.title}</div>
        <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:"#ccc"}}><span>{w.category}</span><span>{w.at}</span></div>
      </Card>)}</div>}
    </div>{css}{loginModal}{priceModal}</div>;}

  /* ═══════ HOME PAGE ═══════ */
  return <div style={{minHeight:"100vh",background:BG}}>{nav}

    {/* HERO + GENERATOR */}
    <section style={{maxWidth:680,margin:"0 auto",padding:"36px 20px 0",textAlign:"center"}}>
      <CharImg src={I.wave} alt="小薯包" style={{height:64}} margin="0 0 12px"/>
      <h1 style={{fontSize:28,fontWeight:800,margin:"0 0 8px",lineHeight:1.4,color:"#1a1a1a"}}>一句话主题，AI帮你生成<br/><span style={{color:R}}>小红书爆款图文</span></h1>
      <p style={{fontSize:14,color:"#999",margin:"0 0 24px",lineHeight:1.7}}>输入任意主题或素材，薯包AI自动识别赛道，一键生成爆款标题+种草文案+9张精美配图</p>

      <Card sx={{padding:24,textAlign:"left",border:"1.5px solid #f0f0f0"}}>
        <textarea value={text} onChange={e=>setText(e.target.value)} placeholder={"输入你想创作的主题，一句话就够了\n例如：云南3天2夜旅游攻略、百元蓝牙耳机测评..."} style={{width:"100%",minHeight:110,padding:16,border:"2px solid #f0f0f0",borderRadius:14,fontSize:14,lineHeight:1.8,fontFamily:"inherit",resize:"vertical",boxSizing:"border-box",outline:"none",transition:"border-color 0.2s"}} onFocus={e=>e.target.style.borderColor=R2} onBlur={e=>e.target.style.borderColor="#f0f0f0"}/>
        <div style={{margin:"10px 0 14px"}}>
          <div style={{fontSize:11,color:"#ccc",marginBottom:8,display:"flex",alignItems:"center",gap:4}}><Hash size={10}/>热门主题轮播 → 点击即可创作</div>
          <div style={{position:"relative",overflow:"hidden",borderRadius:12,background:"#fafafa",border:"1px solid #f5f5f5",height:38}}>
            <div style={{display:"flex",transition:"transform 0.5s cubic-bezier(0.4,0,0.2,1)",transform:`translateX(-${carouselIdx*100}%)`,whiteSpace:"nowrap"}}>
              {QUICK_HINTS.map((h,i)=><button key={i} onClick={()=>setText(h.slice(2))} style={{minWidth:"100%",fontSize:12,color:"#555",background:"none",border:"none",padding:"10px 16px",cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"center",gap:6,transition:"all 0.15s"}} onMouseEnter={e=>{e.target.style.color=R;e.target.style.background="#FFF5F5"}} onMouseLeave={e=>{e.target.style.color="#555";e.target.style.background="none"}}><span style={{fontSize:16}}>{h.slice(0,2)}</span><span>{h.slice(2)}</span><span style={{fontSize:10,color:"#ddd",marginLeft:4}}>点击使用</span></button>)}
            </div>
            <div style={{position:"absolute",bottom:3,left:"50%",transform:"translateX(-50%)",display:"flex",gap:3}}>{QUICK_HINTS.map((_,i)=><div key={i} style={{width:i===carouselIdx?14:4,height:3,borderRadius:2,background:i===carouselIdx?R:"#ddd",transition:"all 0.3s"}}/>)}</div>
          </div>
        </div>
        {err&&<div style={{background:"#FFF5F5",border:"1px solid #FED7D7",borderRadius:10,padding:"10px 14px",marginBottom:12,fontSize:12,color:"#C53030"}}>{err}</div>}
        <Btn primary full disabled={!text.trim()} onClick={doGen}><Sparkles size={16}/>{logged?"一键生成爆款图文":"新用户免费生成"}</Btn>
        <div style={{textAlign:"center",fontSize:11,color:"#bbb",marginTop:8}}>{logged?`剩余 ${pts} 套额度`:"新用户专享 · 登录后可保存到作品集"}</div>
      </Card>
    </section>

    {/* GALLERY PREVIEW */}
    <section style={{...s.section,paddingTop:48}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18}}>
        <div><h2 style={{fontSize:20,fontWeight:700,margin:"0 0 4px",display:"flex",alignItems:"center",gap:8}}><img src={I.appicon} style={{width:22,height:22,borderRadius:6}} alt=""/>薯包出品</h2><p style={{fontSize:12,color:"#bbb",margin:0}}>以下内容全部由薯包AI一键生成，点击查看完整图文</p></div>
        <Btn small onClick={()=>setPg("gallery")} sx={{color:R,border:"1px solid "+R}}>更多作品 <ChevronRight size={13}/></Btn>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14}}>{GALLERY.slice(0,6).map(g=><GCard key={g.id} item={g} onClick={()=>setGItem(g)}/>)}</div>
    </section>

    {/* FEATURES */}
    <section style={{...s.section,paddingTop:24}}>
      <h2 style={{...s.sectionTitle}}>为什么选薯包AI生成小红书图文</h2>
      <p style={{...s.sectionSub}}>从种草笔记到干货攻略，3分钟交付可直接发布的完整图文套件</p>
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12}}>{FEATURES.map((f,i)=>{const Icon=f.icon;return <Card key={i} sx={{padding:20}}>
        <div style={{width:36,height:36,borderRadius:10,background:"#FFF1F3",display:"flex",alignItems:"center",justifyContent:"center",marginBottom:10}}><Icon size={18} color={R}/></div>
        <div style={{fontSize:14,fontWeight:700,marginBottom:4}}>{f.title}</div>
        <div style={{fontSize:12,color:"#999",lineHeight:1.6}}>{f.desc}</div>
      </Card>;})}</div>
    </section>

    {/* HOW IT WORKS — 动态过程图示 */}
    <section style={{...s.section,paddingTop:24}}>
      <h2 style={{...s.sectionTitle}}>3步搞定小红书爆款图文</h2>
      <p style={{...s.sectionSub}}>比你想象的更简单</p>
      <div style={{display:"flex",gap:16,justifyContent:"center",flexWrap:"wrap"}}>
        {[
          {n:"1",t:"粘贴素材",d:"旅行经历、产品体验、探店笔记...任何形式的原始素材都行",icon:"✍️",bg:"#FFF0F2",anim:"typing 1.2s ease-out infinite"},
          {n:"2",t:"薯包创作",d:"AI自动识别赛道，生成爆款标题+文案+9张配图",icon:"✨",bg:"#F0F4FF",anim:"sparkle 1.5s ease-in-out infinite"},
          {n:"3",t:"直接发布",d:"一键复制文案、下载图片，打开小红书就能发",icon:"🚀",bg:"#F0FFF4",anim:"rocket 1s ease-in-out infinite"},
        ].map((st,i)=><Card key={i} sx={{flex:"1 1 200px",padding:"28px 20px",textAlign:"center",maxWidth:240,position:"relative",overflow:"hidden"}}>
          <div style={{position:"absolute",top:0,left:0,right:0,height:4,background:`linear-gradient(90deg,${[R,"#667EEA","#48BB78"][i]},transparent)`}}/>
          <div style={{fontSize:48,lineHeight:1,marginBottom:8}}>{st.icon}</div>
          <div style={{width:28,height:28,borderRadius:"50%",background:R,color:"#fff",fontSize:13,fontWeight:700,display:"inline-flex",alignItems:"center",justifyContent:"center",marginBottom:8,boxShadow:"0 4px 12px rgba(255,71,87,0.2)"}}>{st.n}</div>
          <div style={{fontSize:15,fontWeight:700,marginBottom:6}}>{st.t}</div>
          <div style={{fontSize:12,color:"#999",lineHeight:1.7}}>{st.d}</div>
        </Card>)}
      </div>
      <p style={{textAlign:"center",fontSize:12,color:"#d0d0d0",marginTop:16}}>⏱ 全程约15-30秒 · 不满意可免费重新生成</p>
    </section>

    {/* CTA */}
    <section style={{textAlign:"center",padding:"40px 20px 20px"}}>
      <CharImg src={I.excited} alt="" style={{height:56}} filter="drop-shadow(0 4px 12px rgba(255,71,87,0.12))" margin="0 0 10px"/>
      <h2 style={{fontSize:22,fontWeight:700,margin:"0 0 6px"}}>准备好了吗？</h2>
      <p style={{fontSize:13,color:"#999",margin:"0 0 16px"}}>{logged?"还有更多次数，继续生成":"新用户免费生成 · 不满意不收费"}</p>
      <Btn primary onClick={()=>window.scrollTo({top:0,behavior:"smooth"})}><Sparkles size={15}/>立即免费体验</Btn>
    </section>

    {/* FOOTER */}
    <footer style={{padding:"32px 20px",background:"#f9f9f9",borderTop:"1px solid #f0f0f0",marginTop:40}}>
      <div style={{maxWidth:800,margin:"0 auto",display:"flex",justifyContent:"space-between",flexWrap:"wrap",gap:20}}>
        <div style={{flex:"1 1 280px"}}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}><img src={I.appicon} style={{width:24,height:24,borderRadius:6}} alt=""/><span style={{fontSize:14,fontWeight:700}}>薯包AI</span></div>
          <p style={{fontSize:12,color:"#999",lineHeight:1.8,margin:0}}>专注小红书内容创作的AI工具。覆盖旅游攻略、好物评测、美食探店、穿搭分享、学习干货等热门赛道。AI智能生成爆款标题、种草文案和精美配图，一键生成可直接发布的小红书爆款笔记。</p>
        </div>
        <div style={{flex:"0 0 auto"}}>
          <div style={{fontSize:12,fontWeight:600,marginBottom:8}}>产品</div>
          <div style={{fontSize:11,color:"#999",lineHeight:2}}><span style={{cursor:"pointer"}} onClick={()=>setPg("gallery")}>薯包出品</span><br/><span style={{cursor:"pointer"}} onClick={()=>setPg("pricing")}>价格方案</span><br/><span style={{cursor:"pointer"}} onClick={()=>setPg("works")}>我的作品</span></div>
        </div>
        <div style={{flex:"0 0 auto"}}>
          <div style={{fontSize:12,fontWeight:600,marginBottom:8}}>关键词</div>
          <div style={{fontSize:11,color:"#ccc",lineHeight:2}}>小红书图文生成 · AI种草笔记<br/>爆款内容创作 · 小红书配图<br/>干货笔记 · 一键生成图文</div>
        </div>
      </div>
      <div style={{textAlign:"center",fontSize:10,color:"#e0e0e0",marginTop:20}}>© 2026 薯包AI · 小红书爆款图文一键AI生成工具</div>
    </footer>

  {css}{loginModal}{priceModal}</div>;
}
