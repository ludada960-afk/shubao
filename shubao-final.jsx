import React, { useState, useEffect, useRef, useMemo } from "react";
import { Sparkles, Copy, Check, RefreshCw, User, Zap, Image as Img, FileText, Hash, Clock, ArrowLeft, ArrowRight, Heart, Eye, LogIn, CreditCard, Bookmark, RotateCcw, ChevronRight, ExternalLink, Star, Target, Layers, MousePointerClick, ShieldCheck, Palette, Maximize2, Download, X, Loader2 } from "lucide-react";
import NoteModal from './src/NoteModal.jsx';

const _b=(n)=>new URL('/images/'+n,import.meta.url).href;
const I={s1:_b('准备好了吗？.png'),s2:_b('视角挥手.png'),s3:_b('侧面行走.png'),s4:_b('坐着.png'),s5:_b('跳跃兴奋.png'),
  wave:_b('视角挥手.png'),stand:_b('写作.png'),excited:_b('跳跃兴奋.png'),happy:_b('绘画.png'),
  appicon:_b('cropped.png'),welcome:_b('欢迎光临.png'),think:_b('睡觉.png'),upgrade:_b('升级提示.png'),
  loading:_b('举重.png'),result:_b('烹饪.png'),publish:_b('冥想.png'),tip:_b('跳舞.png'),
  banner:_b('超级英雄.png'),idea:_b('画廊策展人.png'),success:_b('批准印章.png'),protect:_b('摄影师.png'),
  scene:_b('小薯包.png'),walk:_b('侧面行走.png'),'wave-hand':_b('视角挥手.png'),jump:_b('跳跃兴奋.png'),
  ready:_b('准备好了吗？.png'),sit:_b('坐着.png'),surf:_b('冲浪.png'),meditate:_b('冥想.png'),
  cook:_b('烹饪.png'),dance:_b('跳舞.png'),done:_b('完成.png'),superhero:_b('超级英雄.png'),
  curator:_b('画廊策展人.png'),inspect:_b('检查.png'),photographer:_b('摄影师.png'),lift:_b('举重.png'),
  empty:_b('空状态.png'),error:_b('错误状态.png'),crash:_b('崩溃.png'),sleep:_b('睡觉.png'),
  logo_lg:_b('LOGO.png'),paint:_b('绘画.png'),analyze:_b('分析.png'),};

const R="#FF4757",R2="#FF6B81",G="#7EC882",BG="#FFFAF9";

const API='http://localhost:3099';
const proxyImg = (url)=>url?API+'/api/proxy-image?url='+encodeURIComponent(url):'';
const _IMG=(id,file)=>API+'/api/gallery-image?id='+id+'&file='+file;
const GALLERY=[{id:'xm',title:'熬夜总结🔥厦门3天2夜精华攻略！人均800+玩到爽！',cat:'旅游攻略',grad:'linear-gradient(135deg,#FF6B35,#F7C59F)',likes:3890,body:'谁懂啊！之前去厦门玩三天两夜，回来被问了800遍攻略！今天熬夜帮各位总结好，人均800左右就能玩得超满足～\n\n✅行程概览\nD1：鼓浪屿全天（日光岩、菽庄花园、龙头路小吃）\nD2：厦门大学+南普陀寺+沙坡尾艺术西区+猫街\nD3：黄厝沙滩日出+曾厝垵+环岛路骑行\n\n💰预算清单（人均）\n交通：约200（高铁+岛内公交）\n住宿：约300（两晚民宿，提前订）\n门票：约80（鼓浪屿船票+日光岩）\n美食：约220（沙茶面、海蛎煎、姜母鸭等）\n总计：约800起，丰俭由人\n\n⚠️实用Tips\n1️⃣ 鼓浪屿船票提前3天在「厦门轮渡」公众号买，人多时秒没！\n2️⃣ 厦大需预约，周末难约，建议工作日去。\n3️⃣ 曾厝垵小吃不踩雷推荐：阿杰五香、八婆婆烧仙草。\n4️⃣ 环岛路租电动车约30元/小时，吹海风超舒服～\n\n家人们，赶紧存下来，周末就出发！一起看海吃沙茶面！🌊',tags:['#厦门旅游','#厦门攻略','#旅游攻略','#3天2夜','#人均800'],hint:'厦门旅游攻略',cover_url:_IMG('xm','01-封面.png'),image_urls:[2,3,4,5,6,7,8,9].map(n=>_IMG('xm','0'+n+'.png'))},{id:'ep',title:'实测5款百元蓝牙耳机🔥闭眼入不踩雷',cat:'好物评测',grad:'linear-gradient(135deg,#3B82F6,#6366F1)',likes:2290,body:'家人们谁懂啊！想买个百元蓝牙耳机看花眼？我帮你实测了5款热门款，直接抄作业！\n\n🎧 漫步者X2：约100元，音质均衡，续航6小时，佩戴舒适，入门首选。\n🎧 小米Air2 SE：约120元，低音强劲，触控灵敏，适合听流行。\n🎧 绿联HiTune：约90元，续航7小时，降噪意外好，性价比炸裂。\n🎧 倍思WM01：约80元，半入耳设计，通话清晰，适合运动。\n🎧 网易云蓝牙耳机：约110元，外观潮，音质中规中矩，适合颜控。\n\n总结：百元价位首选漫步者X2，预算紧张选倍思WM01。快艾特你的冤种闺蜜一起抄作业！',tags:['#蓝牙耳机推荐','#百元耳机','#数码好物','#学生党必备'],hint:'百元蓝牙耳机推荐',cover_url:_IMG('ep','01-封面.png'),image_urls:[2,3,4,5,6,7,8,9].map(n=>_IMG('ep','0'+n+'.png'))},{id:'crab',title:'人均80吃帝王蟹🦀？这家大排档也太狠了吧！',cat:'美食探店',grad:'linear-gradient(135deg,#F97316,#FBBF24)',likes:4523,body:'谁懂啊！以前总觉得海鲜大排档又贵又坑，结果被闺蜜拉去吃了一顿，直接刷新认知😱！人均才80左右，就能炫到整只帝王蟹，还有各种鲜活海鲜，性价比炸裂！\n\n🦀【招牌帝王蟹】\n整只清蒸或避风塘做法，肉质鲜甜Q弹，蟹黄满满！一份约4斤，足够3-4人吃，单点价格约280元，人均才70多！\n\n🦐【椒盐皮皮虾】\n只只带膏，椒盐味超香，外壳酥脆，肉质紧实。一份约68元，必点！\n\n🦪【蒜蓉烤生蚝】\n现开现烤，蒜蓉酱调得绝了，生蚝肥美多汁。一打约58元，性价比超高！\n\n🔥【避风塘炒蟹】\n如果帝王蟹吃腻了，还可以点避风塘炒蟹，香辣入味，锅气十足，一份约128元。\n\n💡【省钱Tips】\n建议下午4点前到店，有早鸟折扣；人多点套餐更划算，人均约80-100元就能吃到撑！还有免费停车位哦～\n\n快艾特你的饭搭子，周末去这家大排档实现海鲜自由吧！🦀✨',tags:['#海鲜大排档','#帝王蟹','#人均80','#美食探店','#性价比海鲜'],hint:'帝王蟹探店推荐',cover_url:_IMG('crab','01-封面.png'),image_urls:[2,3,4,5,6,7,8,9].map(n=>_IMG('crab','0'+n+'.png'))},];
const QUICK_HINTS=["📍厦门3天2夜旅游攻略","🎧百元蓝牙耳机测评","🦀海鲜大排档人均80吃帝王蟹","🎀JK穿搭分享","🤖最新AI工具推荐合集","📚考研英语85分方法","🛏️300元出租屋改造攻略","🧴25岁精简护肤步骤","🍱上班族5天带饭食谱","🏋️30天居家普拉提计划","🪴500元极简客厅改造","🎬2026必看国产剧推荐","💰裸辞做自媒体搞钱思路","📖改变认知的6本好书推荐"];
const PRICING=[{name:"入门",price:19,sets:6,regen:3,desc:"适合偶尔创作",per:"3.2"},{name:"进阶",price:49,sets:18,regen:5,pop:true,desc:"个人博主首选",per:"2.7"},{name:"创作者",price:89,sets:38,regen:8,desc:"高频创作者",per:"2.3"},{name:"工作室",price:169,sets:80,regen:15,desc:"团队批量使用",per:"2.1"},];
const TIPS=["标题带数字的笔记，点击率平均高出47%","发布时间建议：周四/周五晚上8-9点","正文前3行决定80%用户是否继续阅读","每篇笔记建议5-7个精准标签","封面图配色统一度直接影响账号调性","评论区互动率高的笔记更容易被推荐","带价格的种草笔记收藏率高出60%","干货笔记的生命周期比日常分享长3倍","小红书流量池推荐机制最多有8层","视频笔记平均互动率比图文高23%","首图加文字标签的笔记收藏率高35%","互动数据好的笔记会被推荐到更大流量池","真诚的标题比夸张的标题更受平台推荐","9张配图比单张图片完播率高2倍","笔记发布后1小时内是流量关键期","合适的发布时间能让曝光翻倍","正文前3行一定要吸引人否则用户直接划走","带定位的探店笔记曝光率高出50%","有对比的干货笔记更容易被收藏","用提问式结尾能提升评论区互动率"];
const CHAR_CYCLE=["ready","wave","walk","stand","jump","sit","meditate","cook","success","curator","analyze","surf","superhero","paint","dance","welcome","lift","inspect","upgrade"];
const STAGES=[{img:"s1",label:"研读素材",desc:"小薯包正在认真分析你的内容..."},{img:"s2",label:"撰写文案",desc:"灵感爆发！正在打磨爆款文案"},{img:"s3",label:"生成配图",desc:"正在精心绘制第 {n}/9 张图片"},{img:"s4",label:"品质优化",desc:"正在精修图片细节，确保每一张都精致出彩"},{img:"s5",label:"打包完成",desc:"搞定！你的爆款图文来啦"},];
const FEATURES=[{icon:Target,title:"智能识别赛道",desc:"粘贴任意素材，AI自动判断旅游、美食、好物等最佳内容策略，不需要手动选择"},{icon:Zap,title:"爆款公式驱动",desc:"内置数字结果式、反差痛点式等经过验证的爆款标题和正文公式"},{icon:Layers,title:"9张完整配图",desc:"1张封面+8张内容页，带拼图排版和文字标注，下载即可发布"},{icon:RotateCcw,title:"单张可重新生成",desc:"对某张图不满意？单独刷新这一张，不浪费整套额度"},{icon:MousePointerClick,title:"一键复制文案",desc:"标题、正文、标签分别复制或一键全部复制，打开小红书直接粘贴发布"},{icon:ShieldCheck,title:"按套计费不套路",desc:"用多少买多少，不搞自动续费，新用户免费体验1套"},];
/* ═══════ API ═══════ */
async function genAPI(t,onImg,onProg){const r=await fetch(API+"/api/generate",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({text:t})});if(!r.ok){const e=await r.text().catch(()=>r.statusText);throw new Error(e.slice(0,200));}const reader=r.body.getReader();const dec=new TextDecoder();let buf="";const result={cover_url:"",image_urls:[]};while(true){const{done,value}=await reader.read();if(done)break;buf+=dec.decode(value,{stream:true});const lines=buf.split(String.fromCharCode(10));buf=lines.pop()||"";for(const line of lines){if(!line.startsWith("data: "))continue;try{const d=JSON.parse(line.slice(6));if(d.type==="progress"&&onProg)onProg(d);else if(d.type==="image"){if(d.id==="cover")result.cover_url=d.url;else if(d.url)result.image_urls.push(d.url);if(onImg)onImg(d);}else if(d.type==="complete"){Object.assign(result,d);result.image_count=d.image_urls?.length||0;}else if(d.type==="error")throw new Error(d.error||"生成失败");}catch(e){}}}return result;}

/* ═══════ STORAGE ═══════ */
async function saveWork(w){try{var local=JSON.parse(localStorage.getItem("sb-works")||"[]");local.unshift({...w,id:Date.now(),at:new Date().toLocaleDateString("zh-CN")});localStorage.setItem("sb-works",JSON.stringify(local.slice(0,50)));}catch(e){}try{var r=await fetch(API+"/api/save-work",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({work:w})});if(!r.ok)console.warn("saveWork server:",r.status);else{var j=await r.json();console.log("saveWork: server saved",j.count,"works");}}catch(e){console.warn("saveWork:",e.message);try{await new Promise(function(r){return setTimeout(r,500);});var r2=await fetch(API+"/api/save-work",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({work:w})});if(r2.ok)console.log("saveWork: retry ok");else console.warn("saveWork retry:",r2.status);}catch(e2){console.warn("saveWork retry:",e2.message);}}}
async function loadWorks(){try{const r=await fetch(API+"/api/works");if(r.ok){var d=await r.json();try{var local=JSON.parse(localStorage.getItem("sb-works")||"[]");var seenKeys=new Set(d.map(function(x){return x._saveKey;}));var missing=local.filter(function(x){return x._saveKey&&!seenKeys.has(x._saveKey);});if(missing.length>0){d=[...missing,...d].slice(0,50);}}catch(e){}try{localStorage.setItem("sb-works",JSON.stringify(d));}catch(e){}return d;}}catch(e){console.warn("loadWorks:",e.message);}try{return JSON.parse(localStorage.getItem("sb-works")||"[]");}catch(e){}return[];}
async function getPts(){try{return parseInt(localStorage.getItem("sb-p")||"1");}catch{return 1;}}
async function setPts(n){try{localStorage.setItem("sb-p",String(n));}catch{}}

/* ═══════ UI ATOMS ═══════ */
const s={card:{background:"#fff",borderRadius:16,border:"1px solid #f0f0f0",overflow:"hidden"},cardP:{background:"#fff",borderRadius:16,border:"1px solid #f0f0f0",padding:"20px 22px"},section:{maxWidth:800,margin:"0 auto",padding:"40px 20px"},sectionTitle:{fontSize:22,fontWeight:700,textAlign:"center",margin:"0 0 6px",fontFamily:"'PingFang SC','Microsoft YaHei','Noto Sans SC',sans-serif"},sectionSub:{fontSize:13,color:"#999",textAlign:"center",margin:"0 0 28px"}};

function Btn({children,primary,small,onClick,disabled,full,sx={}}){const[h,setH]=useState(false);return <button style={{display:"inline-flex",alignItems:"center",justifyContent:"center",gap:7,border:primary?"none":"1px solid #e8e8e8",borderRadius:small?8:12,fontSize:small?12:15,fontWeight:600,cursor:disabled?"not-allowed":"pointer",fontFamily:"inherit",transition:"all 0.2s",transform:h&&!disabled?"translateY(-1px)":"none",padding:small?"6px 14px":"13px 28px",width:full?"100%":"auto",background:primary?(disabled?"#FFB3BD":R):(h?"#f8f8f8":"#fff"),color:primary?"#fff":"#555",boxShadow:primary&&h&&!disabled?"0 6px 24px rgba(255,71,87,0.25)":"none",...sx}} onClick={onClick} disabled={disabled} onMouseEnter={()=>setH(true)} onMouseLeave={()=>setH(false)}>{children}</button>;}

function CopyBtn({text,label="复制"}){const[ok,setOk]=useState(false);return <Btn small onClick={()=>{navigator.clipboard?.writeText(text);setOk(true);setTimeout(()=>setOk(false),1500);}} sx={{color:ok?G:"#aaa",background:ok?"#F0FFF4":"#f8f8f8",border:"none"}}>{ok?<><Check size={12}/>已复制</>:<><Copy size={12}/>{label}</>}</Btn>;}

function Card({children,sx={},hover,onClick}){const[h,setH]=useState(false);return <div onClick={onClick} style={{...s.card,transition:"all 0.25s ease",transform:h&&hover?"translateY(-4px)":"none",boxShadow:h&&hover?"0 12px 40px rgba(0,0,0,0.08)":"0 1px 3px rgba(0,0,0,0.02)",cursor:hover?"pointer":"default",...sx}} onMouseEnter={()=>setH(true)} onMouseLeave={()=>setH(false)}>{children}</div>;}

function CharImg({ src, alt = '', style = {}, margin, filter }) {
  return <div style={{ display:'inline-flex', alignItems:'center', justifyContent:'center', margin:margin||0, filter:filter||'drop-shadow(0 4px 12px rgba(255,71,87,0.12))', lineHeight:0 }}>
    <img src={src} alt={alt} style={{ ...style, display:'block', maxWidth:'100%', objectFit:'contain' }} />
  </div>;
}

function Modal({children,onClose}){return <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:999,display:"flex",alignItems:"center",justifyContent:"center",backdropFilter:"blur(6px)",animation:"fadeIn 0.15s"}} onClick={onClose}><div onClick={e=>e.stopPropagation()} style={{background:"#fff",borderRadius:24,padding:"36px 30px",width:400,maxWidth:"92vw",animation:"slideUp 0.25s ease",maxHeight:"90vh",overflow:"auto"}}>{children}</div></div>;}

/* ═══════ ZIP DOWNLOAD ═══════ */
async function downloadZip(coverUrl,imageUrls,title,bodyText,hashtags){
  if(!coverUrl&&!imageUrls?.length)return alert("暂无图片可下载");
  try{
    const JSZip=(await import('jszip')).default;
    const zip=new JSZip();
    const all=[coverUrl,...(imageUrls||[])].filter(Boolean);
    let ok=0;
    // 加入文章文本文件
    if(bodyText||title){
      var textContent = (title||'') + '\n\n' + (bodyText||'') + '\n\n' + ((hashtags||[]).join(' '));
      zip.file("00-文章内容.txt", textContent);
    }
    const results=await Promise.all(all.map(async function(url,i){
      try{
        const resp=await fetch(API+"/api/proxy-image?url="+encodeURIComponent(url));
        if(!resp.ok)return null;
        const blob=await resp.blob();
        return{name:i===0?"01-封面":"0"+(i+1),blob};
      }catch(e){return null;}
    }));
    results.forEach(function(r){if(r){zip.file(r.name+".png",r.blob);ok++;}});
    if(!ok)return alert("下载失败，图片可能已过期");
    const content=await zip.generateAsync({type:"blob"});
    const link=document.createElement("a");
    link.href=URL.createObjectURL(content);
    link.download=(title||"薯包AI").slice(0,20)+"图文.zip";
    link.click();
    URL.revokeObjectURL(link.href);
  }catch(e){alert("下载失败，请重试");}
}

/* ═══════ RESULT MODAL (left image + right text) ═══════ */
function ResultDisplay({result,logged,onLogin,onPrice,loginModal,priceModal,textRegen,text,setResult,setGen}){
  const [imgIdx,setImgIdx]=useState(0);
  const [zoom,setZoom]=useState(null);
  const [rgIdx,setRgIdx]=useState(null); // which image is regenerating
  const allImages=useMemo(()=>{const a=[];if(result?.cover_url)a.push(proxyImg(result.cover_url));if(result?.image_urls)a.push(...result.image_urls.map(u=>proxyImg(u)));return a;},[result]);
  const pages=result?.pages||[];
  const curPage=pages[imgIdx]||pages[0]||{};
  const maxI=allImages.length;

  // keyboard nav
  useEffect(()=>{
    if(zoom)return; // zoom has its own keyboard handler
    const h=(e)=>{
      if(e.key==='ArrowLeft'){setImgIdx(i=>Math.max(0,i-1));e.preventDefault();}
      if(e.key==='ArrowRight'){setImgIdx(i=>Math.min(maxI-1,i+1));e.preventDefault();}
    };
    window.addEventListener('keydown',h);
    return ()=>window.removeEventListener('keydown',h);
  },[zoom,maxI]);

  // zoom keyboard + slide
  useEffect(()=>{
    if(!zoom)return;
    const h=(e)=>{
      if(e.key==='Escape'){setZoom(null);e.preventDefault();}
      if(e.key==='ArrowLeft'){setImgIdx(i=>{const n=Math.max(0,i-1);setZoom(allImages[n]);return n;});e.preventDefault();}
      if(e.key==='ArrowRight'){setImgIdx(i=>{const n=Math.min(maxI-1,i+1);setZoom(allImages[n]);return n;});e.preventDefault();}
    };
    window.addEventListener('keydown',h);
    return ()=>window.removeEventListener('keydown',h);
  },[zoom,allImages,maxI]);

  const regenSingle=async(i)=>{
    if(!confirm("重新生成这张图片将消耗1次额度，确定？"))return;
    setRgIdx(i);
    try{
      // find the prompt for this page
      let prompt='';
      if(i===0&&result?.cover_prompt)prompt=result.cover_prompt;
      else if(i>0){
        const pi=result?.image_prompts?.find?.(p=>p.page_id===i+1);
        if(pi)prompt=pi.prompt;
      }
      if(!prompt)throw new Error('未找到该页的图片描述');
      const r=await fetch(API+"/api/regenerate-image",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({prompt})});
      if(!r.ok)throw new Error('请求失败');
      const d=await r.json();
      if(!d.url)throw new Error('生成失败');
      setResult(prev=>{
        if(i===0)return{...prev,cover_url:d.url};
        const u=[...(prev.image_urls||[])];
        if(u[i-1])u[i-1]=d.url;
        return{...prev,image_urls:u};
      });
    }catch(e){alert('图片生成失败：'+e.message);}
    setRgIdx(null);
  };

  if(!result||!curPage)return null;

  const C=css();
  return <div style={{minHeight:"100vh",background:BG}}>
    {C}
    {/* ZOOM OVERLAY */}
    {zoom&&<div style={{position:"fixed",inset:0,zIndex:9999,background:"rgba(0,0,0,0.92)",display:"flex",alignItems:"center",justifyContent:"center",animation:"fadeIn .15s",cursor:"zoom-out"}} onClick={()=>setZoom(null)}>
      <button onClick={(e)=>{e.stopPropagation();setImgIdx(i=>{const n=Math.max(0,i-1);setZoom(allImages[n]);return n;});}} style={{position:"absolute",left:12,top:"50%",transform:"translateY(-50%)",width:40,height:40,borderRadius:"50%",background:"rgba(255,255,255,0.15)",border:"none",color:"#fff",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,zIndex:10,backdropFilter:"blur(4px)",transition:"background .2s"}} onMouseEnter={e=>e.target.style.background="rgba(255,255,255,0.25)"} onMouseLeave={e=>e.target.style.background="rgba(255,255,255,0.15)"}>{'‹'}</button>
      <img src={zoom} alt="" style={{maxWidth:"92%",maxHeight:"92%",objectFit:"contain",borderRadius:12,boxShadow:"0 20px 60px rgba(0,0,0,0.5)",cursor:"default"}} onClick={e=>e.stopPropagation()}/>
      <button onClick={(e)=>{e.stopPropagation();setImgIdx(i=>{const n=Math.min(maxI-1,i+1);setZoom(allImages[n]);return n;});}} style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",width:40,height:40,borderRadius:"50%",background:"rgba(255,255,255,0.15)",border:"none",color:"#fff",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,zIndex:10,backdropFilter:"blur(4px)",transition:"background .2s"}} onMouseEnter={e=>e.target.style.background="rgba(255,255,255,0.25)"} onMouseLeave={e=>e.target.style.background="rgba(255,255,255,0.15)"}>{'›'}</button>
      <div style={{position:"absolute",bottom:20,left:"50%",transform:"translateX(-50%)",color:"rgba(255,255,255,0.5)",fontSize:12}}>{imgIdx+1}/{maxI} · ↑↓ ← → 切换 · ESC 关闭</div>
    </div>}

    {/* LOGIN BANNER */}
    {!logged&&<div style={{display:"none"}}>
      <span style={{fontSize:13,color:"#333"}}>登录即可把作品保存到「我的作品」</span>
      <Btn small onClick={onLogin} sx={{background:R,color:"#fff",border:"none",whiteSpace:"nowrap"}}><LogIn size={12}/>登录</Btn>
    </div>}

    {/* TOP NAV */}
    <div style={{display:"none"}}>
      <div style={{display:"flex",alignItems:"center",gap:8}}>
        <Btn small onClick={()=>{setGen("idle");setResult(null);}}><ArrowLeft size={14}/> 返回</Btn>
        <span style={{fontSize:12,background:"#FFF1F3",color:R,padding:"4px 12px",borderRadius:20,fontWeight:600}}>{result.category}</span>
        <span style={{fontSize:11,color:"#999"}}>{result.audience||''}{result.tip?(' · '+result.tip):''}</span>
      </div>
      <div style={{display:"flex",gap:6}}>
        <Btn small onClick={()=>downloadZip(result.cover_url,result.image_urls,result.title,result.body_text,result.hashtags)} sx={{background:"#f8f8f8",color:"#555",border:"none"}}><Download size={12}/> 下载图片</Btn>
      </div>
    </div>

    {/* MAIN CONTENT: LEFT IMAGE + RIGHT TEXT */}
    <div style={{maxWidth:960,margin:"0 auto",padding:"16px 16px 60px"}}>
      <div style={{display:"flex",gap:16,alignItems:"flex-start"}}>
        {/* LEFT: IMAGE */}
        <div style={{flex:"0 0 auto",position:"relative",width:"50%",maxWidth:420}}>
          <div style={{position:"relative",borderRadius:12,overflow:"hidden",background:"#f5f5f5",boxShadow:"0 4px 20px rgba(0,0,0,0.06)"}}
            onMouseEnter={function(e){e.currentTarget.querySelectorAll('.xhs-nav').forEach(function(b){b.style.opacity='1'})}}
            onMouseLeave={function(e){e.currentTarget.querySelectorAll('.xhs-nav').forEach(function(b){b.style.opacity='0'})}}>
            {/* IMAGE */}
            {allImages[imgIdx]?<><img src={allImages[imgIdx]} alt="" style={{width:"100%",display:"block",cursor:"pointer",aspectRatio:"3/4",objectFit:"cover"}} onClick={()=>setZoom(allImages[imgIdx])}/>
            {/* 文字叠加层 */}
            {(()=>{
              const p = imgIdx===0 ? {title:result.title, hook:result.category} : (pages[imgIdx-1]||{});
              return <>
                {/* 顶部标题 */}
                {p?.title ? <div style={{position:"absolute",top:0,left:0,right:0,padding:"14px 14px 40px",background:"linear-gradient(180deg,rgba(0,0,0,0.65) 0%,transparent 100%)",color:"#fff",fontSize:15,fontWeight:700,lineHeight:1.5,textShadow:"0 2px 8px rgba(0,0,0,0.4)",pointerEvents:"none",zIndex:3}}>{p.title}</div> : null}
                {/* 中部信息标签 */}
                {imgIdx>0 && p?.info_blocks?.length>0 ? <div style={{position:"absolute",bottom:44,left:0,right:0,padding:"8px 12px",display:"flex",flexWrap:"wrap",gap:4,pointerEvents:"none",zIndex:3}}>
                  {p.info_blocks.slice(0,4).map((b,i)=>(
                    <span key={i} style={{background:"rgba(0,0,0,0.55)",backdropFilter:"blur(4px)",borderRadius:6,padding:"2px 8px",fontSize:10,color:"#fff",lineHeight:1.6}}>{b.label}: <strong>{b.value}</strong></span>
                  ))}
                </div> : null}
                {/* 底部钩子 */}
                {p?.hook ? <div style={{position:"absolute",bottom:8,left:0,right:0,padding:"4px 14px",color:"#ffd700",fontSize:11,fontStyle:"italic",textShadow:"0 1px 6px rgba(0,0,0,0.5)",pointerEvents:"none",textAlign:"center",zIndex:3}}>{p.hook}</div> : null}
              </>;
            })()}
            </>:<div style={{width:"100%",aspectRatio:"3/4",display:"flex",alignItems:"center",justifyContent:"center",color:"#ccc",fontSize:13}}>暂无图片</div>}

            {/* HOVER ARROWS */}
            <div className="xhs-nav" style={{position:"absolute",top:0,left:0,right:0,bottom:0,opacity:0,transition:"opacity 0.2s",pointerEvents:"none"}}>
              {imgIdx>0&&<button style={{position:"absolute",left:6,top:"50%",transform:"translateY(-50%)",pointerEvents:"auto",width:32,height:32,borderRadius:"50%",background:"rgba(255,255,255,0.9)",border:"none",boxShadow:"0 2px 8px rgba(0,0,0,0.1)",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,color:"#555",transition:"all .15s"}} onMouseEnter={e=>e.currentTarget.style.background="#fff"} onMouseLeave={e=>e.currentTarget.style.background="rgba(255,255,255,0.9)"} onClick={()=>setImgIdx(i=>i-1)}>{'‹'}</button>}
              {imgIdx<maxI-1&&<button style={{position:"absolute",right:6,top:"50%",transform:"translateY(-50%)",pointerEvents:"auto",width:32,height:32,borderRadius:"50%",background:"rgba(255,255,255,0.9)",border:"none",boxShadow:"0 2px 8px rgba(0,0,0,0.1)",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,color:"#555",transition:"all .15s"}} onMouseEnter={e=>e.currentTarget.style.background="#fff"} onMouseLeave={e=>e.currentTarget.style.background="rgba(255,255,255,0.9)"} onClick={()=>setImgIdx(i=>i+1)}>{'›'}</button>}
            </div>

            {/* REGEN SINGLE BUTTON */}
            <button onClick={(e)=>{e.stopPropagation();regenSingle(imgIdx);}} disabled={rgIdx===imgIdx} style={{position:"absolute",left:8,bottom:8,background:"rgba(0,0,0,0.55)",backdropFilter:"blur(4px)",border:"none",borderRadius:8,padding:"5px 10px",color:"#fff",fontSize:11,cursor:"pointer",display:"flex",alignItems:"center",gap:4,transition:"background .2s",zIndex:5}} onMouseEnter={e=>e.currentTarget.style.background="rgba(0,0,0,0.7)"} onMouseLeave={e=>e.currentTarget.style.background="rgba(0,0,0,0.55)"}>
              {rgIdx===imgIdx?<><Loader2 size={11} className="spin"/> 刷新中...</>:<><RefreshCw size={11}/> 重生成</>}
            </button>

            {/* PAGE COUNTER */}
            <div style={{position:"absolute",right:8,bottom:8,background:"rgba(0,0,0,0.45)",backdropFilter:"blur(4px)",borderRadius:6,padding:"3px 8px",color:"#fff",fontSize:10,zIndex:5}}>{imgIdx+1}/{maxI}</div>
          </div>

          {/* THUMBNAIL STRIP */}
          <div style={{display:"flex",gap:4,marginTop:8,overflowX:"auto",paddingBottom:4}}>
            {allImages.map((url,i)=>(
              <div key={i} onClick={()=>setImgIdx(i)} style={{flex:"0 0 auto",width:44,height:59,borderRadius:6,overflow:"hidden",border:i===imgIdx?"2px solid "+R:"2px solid transparent",cursor:"pointer",opacity:i===imgIdx?1:0.5,transition:"all .15s"}} onMouseEnter={e=>e.currentTarget.style.opacity="1"} onMouseLeave={e=>{if(i!==imgIdx)e.currentTarget.style.opacity="0.5"}}>
                <img src={url} alt="" style={{width:"100%",height:"100%",objectFit:"cover",display:"block"}}/>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT: TEXT CONTENT */}
        <div style={{flex:1,minWidth:0}}>
          {/* CREATOR */}<div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}><img src={I.appicon} alt="" style={{width:34,height:34,borderRadius:"50%",objectFit:"cover",flex:"0 0 auto"}}/><div><div style={{fontSize:13,fontWeight:600,color:"#222"}}>薯包AI</div><div style={{fontSize:11,color:"#999"}}>AI创作 · 一键生成</div></div><span style={{marginLeft:"auto",fontSize:11,color:"#888",background:"#f5f5f5",padding:"3px 10px",borderRadius:20}}>{result.category||""}</span></div>{/* TITLE */}
          <div style={{...s.cardP,marginBottom:12}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8}}>
              <h2 style={{fontSize:18,fontWeight:700,color:"#222",margin:0,lineHeight:1.5}}>{result.title}</h2>
              <span style={{display:"none"}}/>
            </div>
          </div>

          {/* CURRENT PAGE */}
          {curPage.page_type==='cover'?<div style={{...s.cardP,marginBottom:12}}>
            <div style={{display:"none"}}>📌 封面</div>
            <div style={{fontSize:15,fontWeight:700,color:"#333",marginBottom:4}}>{curPage.hook||curPage.title}</div>
            {curPage.text&&<div style={{fontSize:13,color:"#666",lineHeight:1.7,whiteSpace:"pre-wrap"}}>{curPage.text}</div>}
            <div style={{marginTop:8,fontSize:12,color:"#999",lineHeight:1.6}}><strong>排版提示：</strong>{curPage.layout_hint||curPage.story||'—'}</div>
          </div>:<div style={{...s.cardP,marginBottom:12}}>
            <div style={{display:"none"}}>📄 P{curPage.page_id||(imgIdx+1)} {curPage.emoji||''}</div>
            <div style={{fontSize:16,fontWeight:700,color:"#333",marginBottom:6}}>{curPage.title}</div>
            {curPage.hook&&<div style={{fontSize:13,color:R,background:"#FFF1F3",padding:"6px 12px",borderRadius:8,marginBottom:8,display:"inline-block",fontWeight:500}}>{curPage.hook}</div>}
            <div style={{fontSize:13,color:"#555",lineHeight:1.8,whiteSpace:"pre-wrap"}}>{curPage.text||curPage.story||''}</div>
            {curPage.info_blocks?.length>0&&<div style={{display:"none"}}></div>}
          </div>}

          {/* TAGS */}
          <div style={{...s.cardP,marginBottom:12}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
              <span style={{fontSize:13,fontWeight:600,display:"flex",alignItems:"center",gap:5}}><Hash size={14} color={R}/>标签</span>
              <span style={{display:"none"}}/>
            </div>
            <div style={{display:"flex",flexWrap:"wrap",gap:5}}>{(result.hashtags||[]).map((h,i)=><span key={i} style={{fontSize:12,color:R,background:"#FFF1F3",padding:"4px 12px",borderRadius:20,fontWeight:500}}>{h}</span>)}</div>
          </div>

          {/* BODY TEXT (collapsible) */}
          {result.body_text&&<div style={{...s.cardP,marginBottom:12}}>
            <details style={{fontSize:14,color:"#555",lineHeight:2}}>
              <summary style={{fontSize:13,fontWeight:600,cursor:"pointer",color:"#888",marginBottom:4}}>📝 查看完整正文</summary>
              <div style={{whiteSpace:"pre-wrap",marginTop:8,fontSize:13,lineHeight:2,color:"#555"}}>{result.body_text}</div>
            </details>
          </div>}

          {/* ACTION BUTTONS */}
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            <Btn small onClick={textRegen} sx={{background:"#fff",color:R,border:"1.5px solid "+R,fontSize:12}}><RefreshCw size={12}/> 重新生成文案</Btn>
            <Btn small onClick={()=>{navigator.clipboard?.writeText(result.title+"\n\n"+result.body_text+"\n\n"+(result.hashtags||[]).join(" ")).catch(()=>{});}} sx={{background:R,color:"#fff",border:"none",fontSize:12}}><span style={{display:"none"}}/></Btn>
            <Btn small onClick={()=>{setGen("idle");setResult(null);}} sx={{display:"none"}}></Btn>
          </div>
        </div>
      </div>

      {/* PAGE NAV — grid of all pages */}
      <div style={{display:"none"}}>
        {pages.map((pg,i)=>(
          <div key={i} onClick={()=>setImgIdx(i)} style={{padding:"8px 4px",borderRadius:10,border:imgIdx===i?"2px solid "+R:"1.5px solid #f0f0f0",cursor:"pointer",background:imgIdx===i?"#FFF8F9":"#FAFAFA",textAlign:"center",transition:"all .15s"}}>
            <div style={{fontSize:16,marginBottom:2}}>{pg.emoji||'📄'}</div>
            <div style={{fontSize:9,fontWeight:600,color:imgIdx===i?R:"#777",lineHeight:1.2}}>{pg.title?.slice(0,6)||'P'+(i+1)}</div>
          </div>
        ))}
      </div>
    </div>
  {loginModal}{priceModal}</div>;
}

function css(){return <style>{`@keyframes fadeIn{from{opacity:0}to{opacity:1}}@keyframes slideUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}@keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}@keyframes scroll-h{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}@keyframes spin{0%{transform:rotate(0)}100%{transform:rotate(360deg)}}.spin{animation:spin 1s linear infinite}*::-webkit-scrollbar{width:4px}*::-webkit-scrollbar-thumb{background:#e8e8e8;border-radius:2px}::selection{background:#FFE0E4}`}</style>;}

/* ═══════ GALLERY CARD ═══════ */
function GCard({item,onClick}){const[h,setH]=useState(false);return <Card hover onClick={onClick} sx={{overflow:"hidden"}}>
  <div style={{background:item.grad,height:140,position:"relative"}} onMouseEnter={()=>setH(true)} onMouseLeave={()=>setH(false)}>
    <div style={{position:"absolute",inset:0,background:"linear-gradient(transparent 40%,rgba(0,0,0,0.5))"}}/>
    <span style={{position:"absolute",top:10,left:10,fontSize:10,background:"rgba(255,255,255,0.2)",color:"#fff",padding:"3px 10px",borderRadius:8,backdropFilter:"blur(4px)"}}>{item.cat}</span>
    {h&&<div style={{position:"absolute",inset:0,background:"rgba(0,0,0,0.25)",display:"flex",alignItems:"center",justifyContent:"center",animation:"fadeIn 0.15s"}}><span style={{background:"rgba(255,255,255,0.95)",color:R,fontSize:12,fontWeight:600,padding:"8px 18px",borderRadius:10,display:"flex",alignItems:"center",gap:5,boxShadow:"0 4px 12px rgba(0,0,0,0.1)"}}><Eye size={13}/>查看全套内容</span></div>}
  </div>
  <div style={{padding:"12px 14px"}}>
    <div style={{fontSize:13,fontWeight:600,lineHeight:1.5,marginBottom:6,display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical",overflow:"hidden",fontFamily:"'PingFang SC','Microsoft YaHei','Noto Sans SC',sans-serif"}}>{item.title}</div>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}><span style={{fontSize:10,color:"#ccc",display:"flex",alignItems:"center",gap:3}}><Heart size={10}/>{item.likes}</span><span style={{fontSize:9,color:"#e0e0e0",fontStyle:"italic"}}>薯包AI出品</span></div>
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
  const[regenState,setRegenState]=useState({active:false,msg:''});
  const lastWorkIdRef=useRef('');
  useEffect(function(){if(result?._inputText)lastWorkIdRef.current=result._inputText;},[result?._inputText]);
  // Floating regen indicator (DOM direct — survives early returns & modal close)
  useEffect(function(){
    var el=document.getElementById('__regen_bar');
    if(!el){el=document.createElement('div');el.id='__regen_bar';document.body.appendChild(el);}
    if(regenState.active){
      el.style.cssText='position:fixed;bottom:24px;left:50%;transform:translateX(-50%);z-index:99999;background:#1a1a2e;color:#fff;padding:12px 24px;border-radius:14px;font-size:13px;font-weight:500;display:flex;align-items:center;gap:10px;box-shadow:0 8px 32px rgba(0,0,0,0.25);animation:fadeIn .2s';
      el.innerHTML='<span style="width:16px;height:16px;border:2.5px solid rgba(255,255,255,0.25);border-top-color:#fff;border-radius:50%;animation:spin .6s linear infinite;display:inline-block;flex-shrink:0"></span>'+regenState.msg+'<span style="font-size:11;color:rgba(255,255,255,0.5);margin-left:4px">生成完成后自动更新</span>';
      el.style.display='flex';
    } else { el.style.display='none'; }
  },[regenState.active,regenState.msg]);
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
  // 切换到"我的作品"页时自动加载最新数据
  useEffect(()=>{if(pg==="works")loadWorks().then(setWorks);},[pg]);

  const doGen=async()=>{if(!text.trim())return;
    if(!logged&&freeUsed.current){setShowLogin(true);return;}
    if(pts<=0&&logged){setShowPrice(true);return;}
    setGen("loading");setErr("");setStage(0);setResult(null);tm.current.forEach(clearTimeout);
    tm.current=[setTimeout(()=>setStage(1),3e3),setTimeout(()=>setStage(2),8e3),setTimeout(()=>setStage(3),14e3)];
    try{const r=await genAPI(text,
      // onImg: 每生成一张图就显示到弹窗，不等全部完成
      function(d){
        // ① 预加载原图（开始下载到浏览器缓存）
        if(d.url){var i=new Image();i.src=d.url;}
        // ② 代理预热（本地缓存，弹窗秒开）
        if(d.url){fetch(proxyImg(d.url)).catch(function(){});}
        setResult(function(prev){
          if(prev?.title)return prev;
          if(!prev){
            var init={_inputText:text, cover_url:d.id==='cover'?d.url:'', image_urls:d.id!=='cover'&&d.url?[d.url]:[]};
            // 不提前展示弹窗，等complete事件再显示
            return init;
          }
          if(d.id==='cover')return{...prev,cover_url:d.url};
          if(d.url)return{...prev,image_urls:[...(prev.image_urls||[]),d.url]};
          return prev;
        });
      });
      tm.current.forEach(clearTimeout);setStage(4);
      // 先保存，再展示弹窗（防止保存失败）
      try{const np=pts-1;setPtsS(np);await setPts(np);var wd={title:r.title,category:r.category,body_text:r.body_text,hashtags:r.hashtags,pages:r.pages,_inputText:text,cover_url:r.cover_url||'',image_urls:r.image_urls||[],cover_prompt:r.cover_prompt||'',image_prompts:r.image_prompts||[],_saveKey:Date.now()};
      // 强写 localStorage 保底（每个作品独立新增，不覆盖旧的）
      (function(){
        try { var _a = JSON.parse(localStorage.getItem('sb-works')||'[]');
          _a.unshift({...wd, id:Date.now(), at:new Date().toLocaleDateString('zh-CN')});
          localStorage.setItem('sb-works', JSON.stringify(_a.slice(0,50)));
        } catch(_) {}
      })();
      await saveWork(wd);setWorks(function(prev){return[{...wd,id:Date.now(),at:new Date().toLocaleDateString('zh-CN')},...prev].slice(0,50);});}catch(e){console.warn('saveWork error:',e);}
      setResult(function(){return {...r,_inputText:text};});
      setGen("result"); // 保存完成后再展示弹窗
    }catch(e){tm.current.forEach(clearTimeout);setErr(e.message);setGen("idle");}};

  const textRegen=async()=>{
    var inp=result?._inputText||text;
    if(!inp){alert("无法找到原始输入");return;}
    if(!confirm("重新生成文案将消耗额度，确定？"))return;
    var ov=document.createElement("div");
    ov.style.cssText="position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.55);display:flex;flex-direction:column;align-items:center;justify-content:center;backdrop-filter:blur(6px);animation:fadeIn .15s";
    ov.innerHTML='<div style="background:#fff;border-radius:20px;padding:32px 40px;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,0.3);animation:slideUp .25s"><svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="#FF4757" stroke-width="2.5" stroke-linecap="round" class="spin"><path d="M12 2v4"/><path d="M12 18v4"/><path d="M4.93 4.93l2.83 2.83"/><path d="M16.24 16.24l2.83 2.83"/><path d="M2 12h4"/><path d="M18 12h4"/><path d="M4.93 19.07l2.83-2.83"/><path d="M16.24 7.76l2.83-2.83"/></svg><div style="font-size:17px;font-weight:700;margin-top:16px;color:#333">✍️ 正在重新生成文章</div><div style="font-size:13px;color:#999;margin-top:6px">请勿刷新或关闭页面，否则会消耗额度</div></div>';
    document.body.appendChild(ov);
    try{
      var r=await fetch(API+"/api/regenerate-text",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({text:inp})});
      if(!r.ok)throw Error("E");
      var d2=await r.json();
      setResult(p=>({...p,title:d2.title,body_text:d2.body_text,hashtags:d2.hashtags,category:d2.category,_inputText}));
    }catch(e){alert("重新生成失败");}
    ov.remove();
  };

  /* ═══════ NAV ═══════ */
  const nav=<nav style={{display:"flex",alignItems:"center",justifyContent:"center",padding:"10px 28px",background:"rgba(255,255,255,0.92)",borderBottom:"1px solid #f0f0f0",position:"sticky",top:0,zIndex:100,backdropFilter:"blur(14px)"}}>
    <div style={{maxWidth:1100,width:"100%",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
    <div style={{display:"flex",alignItems:"center",gap:20}}>
      <div style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer"}} onClick={()=>{setPg("home");setGen("idle");setResult(null);setGItem(null);}}>
        <img src={I.appicon} alt="薯包AI" style={{width:30,height:30,borderRadius:8}}/>
        <span style={{fontSize:16,fontWeight:700,color:R,fontFamily:"PingFang SC,Microsoft YaHei,sans-serif",letterSpacing:"0.5px"}}>薯包AI</span>
      </div>
      <div style={{display:"flex",gap:4}}>{[["home","首页"],["gallery","薯包出品"],["pricing","价格方案"],["works","我的作品"]].map(([k,v])=><button key={k} onClick={()=>{setPg(k);if(k==="works")loadWorks().then(setWorks);}} style={{fontSize:13,fontFamily:"'PingFang SC','Microsoft YaHei','Noto Sans SC',sans-serif",color:pg===k?R:"#777",fontWeight:pg===k?600:400,background:"none",border:"none",padding:"6px 12px",cursor:"pointer",borderRadius:8,transition:"all 0.15s"}}>{v}</button>)}</div>
    </div>
    <div style={{display:"flex",alignItems:"center",gap:8}}>{logged&&<span style={{fontSize:11,color:R,background:"#FFF1F3",padding:"4px 12px",borderRadius:20,fontWeight:600,display:"flex",alignItems:"center",gap:4}}><Sparkles size={11}/>{pts}套</span>}<Btn small onClick={()=>logged?setLogged(false):setShowLogin(true)} sx={{background:logged?"#F0FFF4":"#f5f5f5",color:logged?G:"#777",border:"none"}}>{logged?<><Check size={12}/>已登录</>:<><LogIn size={12}/>登录</>}</Btn></div>
    </div>
  </nav>;

  const loginModal=showLogin&&<Modal onClose={()=>setShowLogin(false)}><div style={{textAlign:"center",marginBottom:24}}><CharImg src={I.wave} alt="" style={{height:64}}/><div style={{fontSize:20,fontWeight:700,marginTop:8}}>欢迎来到薯包AI</div><div style={{fontSize:13,color:"#999"}}>小红书爆款图文，一键生成</div></div>
    <input placeholder="手机号" style={{width:"100%",padding:"12px 16px",border:"1.5px solid #eee",borderRadius:12,fontSize:14,marginBottom:10,boxSizing:"border-box",outline:"none"}}/><input placeholder="验证码" style={{width:"100%",padding:"12px 16px",border:"1.5px solid #eee",borderRadius:12,fontSize:14,marginBottom:20,boxSizing:"border-box",outline:"none"}}/><Btn primary full onClick={()=>{setLogged(true);setShowLogin(false);}}><LogIn size={15}/>登录 / 注册</Btn><div style={{textAlign:"center",marginTop:10,fontSize:10,color:"#ddd"}}>登录后可把作品保存到个人作品集</div></Modal>;
  const priceModal=showPrice&&<Modal onClose={()=>setShowPrice(false)}><div style={{textAlign:"center",marginBottom:20}}><CharImg src={I.upgrade} alt="" style={{height:80}} filter="drop-shadow(0 6px 16px rgba(255,71,87,0.15))"/><div style={{fontSize:20,fontWeight:700,marginTop:8}}>选择套餐充值</div><div style={{fontSize:12,color:"#999"}}>按套收费，不自动续费，用多少买多少</div></div>
    <div style={{display:"flex",flexDirection:"column",gap:8}}>{PRICING.map((p,i)=><div key={i} onClick={()=>{setPtsS(pts+p.sets);setPts(pts+p.sets);setShowPrice(false);}} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 18px",borderRadius:14,border:p.pop?"2px solid "+R:"1px solid #f0f0f0",cursor:"pointer",background:p.pop?"#FFF8F9":"#fff",transition:"all 0.2s"}}><div><div style={{fontSize:14,fontWeight:700}}>{p.name}{p.pop&&<span style={{fontSize:10,color:"#fff",background:R,padding:"2px 8px",borderRadius:6,marginLeft:8}}>推荐</span>}</div><div style={{fontSize:11,color:"#999"}}>{p.sets}套 · 单张重生成{p.regen}次/套 · ¥{p.per}/套</div></div><div style={{fontSize:22,fontWeight:800,color:R}}>¥{p.price}</div></div>)}</div></Modal>;

  /* ═══════ LOADING ═══════ */
  if(gen==="loading"){const st=STAGES[stage]||STAGES[0];const charKey=CHAR_CYCLE[tipIdx%CHAR_CYCLE.length];
    return <div style={{minHeight:"100vh",background:BG}}>{nav}
      <div style={{maxWidth:440,margin:"0 auto",padding:"50px 20px",textAlign:"center",animation:"fadeIn 0.3s"}}>
        <CharImg src={I[charKey]} alt={st.label} style={{height:170,animation:"float 2s ease-in-out infinite"}} filter="drop-shadow(0 8px 24px rgba(255,71,87,0.12))" margin="0 0 20px"/>
        <div style={{fontSize:22,fontWeight:700,marginBottom:6}}>{st.label}</div>
        <div style={{fontSize:14,color:"#888",marginBottom:28}}>{st.desc.replace("{n}",String(Math.min(stage*3+1,9)))}</div>
        <div style={{display:"flex",gap:3,marginBottom:24,padding:"0 30px"}}>{STAGES.map((_,i)=><div key={i} style={{flex:1,height:5,borderRadius:3,background:i<=stage?R:"#f0f0f0",transition:"background 0.5s"}}/>)}</div>
        <div style={{background:"#FFF5F5",borderRadius:12,padding:"12px 18px",marginBottom:20,fontSize:12,color:"#C53030",display:"flex",alignItems:"center",gap:6,justifyContent:"center"}}><Clock size={13}/>生成中请勿刷新页面，否则会浪费1套额度</div>
        <div style={{...s.cardP,textAlign:"left"}}><div style={{fontSize:10,color:"#ccc",marginBottom:4,display:"flex",alignItems:"center",gap:4}}><Zap size={10}/>小红书冷知识</div><div style={{fontSize:13,color:"#666",lineHeight:1.7,minHeight:32}}>{TIPS[tipIdx]}</div></div>
        <div style={{fontSize:11,color:"#ddd",marginTop:16}}>预计需要 15-30 秒</div>
      </div>{css()}</div>;}

  /* ═══════ RESULT ═══════ */
  if(gen==="result"&&result){
    return <NoteModal item={result} onClose={()=>{setGen("idle");setResult(null);}} textRegen={textRegen}
      onDownload={downloadZip}
      onRegenStart={function(i){setRegenState({active:true,msg:'正在重新生成第 '+(i+1)+' 张图片...'});}}
      onItemUpdate={function(i,url,workId){
        // Update result if modal still open
        setResult(function(prev){
          if(!prev)return prev;
          if(i===0)return{...prev,cover_url:url};
          var u=[...(prev.image_urls||[])];if(u[i-1])u[i-1]=url;
          return{...prev,image_urls:u};
        });
        // Always update works list (survives modal close)
        var wid=workId||lastWorkIdRef.current;
        if(wid){
          setWorks(function(prev){
            return prev.map(function(w){
              if(w._inputText===wid){
                var nw={...w};
                if(i===0)nw.cover_url=url;
                else{var u=nw.image_urls||[];if(u[i-1])u[i-1]=url;nw.image_urls=u;}
                setTimeout(function(){saveWork(nw);},0);
                return nw;
              }
              return w;
            });
          });
        }
        setRegenState({active:false,msg:''});
      }}/>;
  }

  /* ═══════ FULL GALLERY PAGE ═══════ */
  if(pg==="gallery"&&!gItem){return <div style={{minHeight:"100vh",background:BG}}>{nav}
    <div style={{...s.section}}>
      <h1 style={{...s.sectionTitle}}>薯包出品</h1>
      <p style={{...s.sectionSub}}>以下内容全部由薯包AI一键生成，点击任意作品查看完整图文</p>
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14}}>{GALLERY.map(g=><GCard key={g.id} item={g} onClick={function(){if(g.cover_url){setResult({...g,body_text:g.body,hashtags:g.tags,category:g.cat,_inputText:g.hint});setGen("result");}else{setGItem(g);}}}/>)}</div>
    </div>{css()}{loginModal}{priceModal}</div>;}

  /* ═══════ GALLERY DETAIL ═══════ */
  if(gItem){return <div style={{minHeight:"100vh",background:BG}}>{nav}
    <div style={{maxWidth:640,margin:"0 auto",padding:"20px 20px 60px",animation:"slideUp 0.3s ease"}}>
      <Btn small onClick={()=>setGItem(null)} sx={{marginBottom:14}}><ArrowLeft size={14}/>返回</Btn>
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
    </div>{css()}{loginModal}{priceModal}</div>;}

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
    </div>{css()}{loginModal}{priceModal}</div>;}

  /* ═══════ WORKS PAGE ═══════ */
  if(pg==="works"){return <div style={{minHeight:"100vh",background:BG}}>{nav}
    <div style={{...s.section}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:8,marginBottom:4}}>
        <h1 style={{...s.sectionTitle,margin:0}}>我的作品</h1>
        <button onClick={()=>{loadWorks().then(setWorks);}} style={{background:"#f5f5f5",border:"none",borderRadius:8,padding:"6px 12px",fontSize:12,color:"#888",cursor:"pointer",display:"flex",alignItems:"center",gap:4,fontFamily:"inherit"}}>
          <RefreshCw size={12}/> 刷新
        </button>
      </div>
      <p style={{...s.sectionSub}}>{works.length?works.length+"个作品":"还没有作品，去创作第一套爆款图文吧"}</p>
      {!works.length?<div style={{textAlign:"center",padding:"40px 0"}}><CharImg src={I.empty} alt="" style={{height:100}} filter="none" margin="0 0 16px"/>
        {logged?<Btn primary onClick={()=>setPg("home")}><Sparkles size={14}/>开始创作</Btn>:<><p style={{fontSize:13,color:"#999",margin:"0 0 12px"}}>登录后，生成的内容会自动保存到这里</p><Btn primary onClick={()=>setShowLogin(true)}><LogIn size={14}/>登录查看作品</Btn></>}
      </div>
      :<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>{works.map((w,i)=><Card key={w.id||i} hover onClick={()=>{setResult(w);setGen("result");}} sx={{padding:16,display:"flex",gap:12,alignItems:"center"}}>
        {w.cover_url?<img src={proxyImg(w.cover_url)} alt="" style={{width:56,height:75,borderRadius:8,objectFit:"cover",flex:"0 0 auto"}}/>:<div style={{width:56,height:75,borderRadius:8,background:"#f5f5f5",flex:"0 0 auto",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20}}>📄</div>}
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:14,fontWeight:600,lineHeight:1.5,marginBottom:4,display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical",overflow:"hidden"}}>{w.title}</div>
          <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:"#ccc"}}><span>{w.category}</span><span>{w.at}</span></div>
          {w.cover_url&&<div style={{fontSize:10,color:"#ddd",marginTop:2}}>{w.image_urls?.length||0}张配图</div>}
        </div>
      </Card>)}</div>}
    </div>{css()}{loginModal}{priceModal}</div>;}

  /* ═══════ HOME PAGE ═══════ */
  return <div style={{minHeight:"100vh",background:BG}}>{nav}

    {/* HERO */}
    <section style={{maxWidth:680,margin:"0 auto",padding:"36px 20px 0",textAlign:"center"}}>
      <CharImg src={I.wave} alt="小薯包" style={{height:64}} margin="0 0 12px"/>
      <h1 style={{fontSize:28,fontWeight:800,margin:"0 0 8px",lineHeight:1.4,color:"#1a1a1a"}}>一句话主题，AI帮你生成<br/><span style={{color:R}}>小红书爆款图文</span></h1>
      <p style={{fontSize:14,color:"#999",margin:"0 0 24px",lineHeight:1.7}}>输入任意主题或素材，薯包AI自动识别赛道，一键生成爆款标题+种草文案+9张精美配图</p>

      <Card sx={{padding:24,textAlign:"left",border:"1.5px solid #f0f0f0"}}>
        <textarea value={text} onChange={e=>setText(e.target.value)} placeholder={"输入你想创作的主题，一句话就够了\n例如：📍厦门3天2夜旅游攻略、🎧百元蓝牙耳机测评..."} style={{width:"100%",minHeight:110,padding:16,border:"2px solid #f0f0f0",borderRadius:14,fontSize:14,lineHeight:1.8,fontFamily:"inherit",resize:"vertical",boxSizing:"border-box",outline:"none",transition:"border-color 0.2s"}} onFocus={e=>e.target.style.borderColor=R2} onBlur={e=>e.target.style.borderColor="#f0f0f0"}/>
        <div style={{margin:"12px 0 16px"}}>
          <div style={{fontSize:11,color:"#999",marginBottom:6}}>热门主题</div>
          <div style={{display:"flex",alignItems:"center",gap:4}}>
            <button onClick={()=>setCarouselIdx(i=>(i-1+QUICK_HINTS.length)%QUICK_HINTS.length)} style={{flex:"0 0 auto",background:"none",border:"none",fontSize:18,color:"#aaa",cursor:"pointer",padding:"4px 2px"}}>{String.fromCharCode(8249)}</button>
            <div style={{flex:1,overflow:"hidden",borderRadius:10,background:"#f5f5f5",border:"1px solid #eee"}}>
              <div style={{textAlign:"center",padding:"8px 0"}}>
                <button onClick={()=>setText(QUICK_HINTS[carouselIdx])} style={{fontSize:14,color:"#555",background:"none",border:"none",cursor:"pointer",fontFamily:"inherit"}}>
                  {QUICK_HINTS[carouselIdx]}
                </button>
              </div>
            </div>
            <button onClick={()=>setCarouselIdx(i=>(i+1)%QUICK_HINTS.length)} style={{flex:"0 0 auto",background:"none",border:"none",fontSize:18,color:"#aaa",cursor:"pointer",padding:"4px 2px"}}>{String.fromCharCode(8250)}</button>
          </div>
          <div style={{display:"flex",justifyContent:"center",gap:3,marginTop:6}}>{QUICK_HINTS.map(function(_,i){return <div key={i} style={{width:i===carouselIdx?16:4,height:3,borderRadius:2,background:i===carouselIdx?"#888":"#ddd",transition:"all .3s"}}/>})}</div>
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
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14}}>{GALLERY.slice(0,6).map(g=><GCard key={g.id} item={g} onClick={function(){if(g.cover_url){setResult({...g,body_text:g.body,hashtags:g.tags,category:g.cat,_inputText:g.hint});setGen("result");}else{setGItem(g);}}}/>)}</div>
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

    {/* HOW IT WORKS */}
    <section style={{...s.section,paddingTop:24}}>
      <h2 style={{...s.sectionTitle}}>3步搞定小红书爆款图文</h2>
      <p style={{...s.sectionSub}}>比你想象的更简单</p>
      <div style={{display:"flex",gap:16,justifyContent:"center",flexWrap:"wrap"}}>
        {[{n:"1",t:"粘贴素材",d:"旅行经历、产品体验、探店笔记...任何形式的原始素材都行",icon:"✍️",bg:"#FFF0F2"},{n:"2",t:"薯包创作",d:"AI自动识别赛道，生成爆款标题+文案+9张配图",icon:"✨",bg:"#F0F4FF"},{n:"3",t:"直接发布",d:"一键复制文案、下载图片，打开小红书就能发",icon:"🚀",bg:"#F0FFF4"},].map((st,i)=><Card key={i} sx={{flex:"1 1 200px",padding:"28px 20px",textAlign:"center",maxWidth:240,position:"relative",overflow:"hidden"}}>
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
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}><img src={I.appicon} style={{width:24,height:24,borderRadius:6}} alt=""/><span style={{fontSize:14,fontWeight:700,fontFamily:"PingFang SC,Microsoft YaHei,sans-serif"}}>薯包AI</span></div>
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

  {css()}{loginModal}{priceModal}</div>;
}
