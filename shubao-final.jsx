import { useState, useEffect, useRef, useMemo } from "react";
import { Sparkles, Copy, Check, RefreshCw, User, Zap, Image as Img, FileText, Hash, Clock, ArrowLeft, ArrowRight, Heart, Eye, LogIn, CreditCard, Bookmark, RotateCcw, ChevronRight, ExternalLink, Star, Target, Layers, MousePointerClick, ShieldCheck, Palette, Maximize2, Download, X, Loader2 } from "lucide-react";

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

const GALLERY=[{id:1,title:"反向旅游🔥这5个小县城比大理舒服100倍",cat:"旅游攻略",grad:"linear-gradient(135deg,#FF6B35,#F7C59F)",likes:3852,body:"谁懂啊！不去大理人挤人了，这5个小县城真的绝了\n📍 贵州黔东南·肇兴侗寨 人均300住3天\n📍 云南·芒市 东南亚风情满满的边境小城\n📍 福建·霞浦 摄影师天堂 日出美哭\n📍 浙江·松阳 最后的江南秘境\n📍 四川·西昌 邛海边的慢生活\n\n全部高铁可达周末就能出发\n物价感人100块吃一天不重样\n\n有问题评论区问我～点赞收藏不迷路👇\n#反向旅游 #小众旅行地 #小县城旅游 #周末去哪儿 #躺平旅行",tags:["#反向旅游","#小众旅行地","#小县城","#周末去哪儿","#旅行攻略"],hint:"反向旅游5个小县城"},{id:2,title:"拼多多30元以下好物🧧这8件真的物超所值",cat:"好物评测",grad:"linear-gradient(135deg,#FF61D2,#FE9090)",likes:2290,body:"PDD用了3年挖到的宝藏！全部30元以内\n🎯 手机支架 9.9元 追剧神器\n🎯 磁吸充电线 15元 再也不用插拔\n🎯 桌面收纳盒 12元 桌面瞬间整洁\n🎯 硅胶冰格 8元 夏天快乐水必备\n🎯 可撕美甲贴 6.8元 手残党福音\n\n每个都亲自用过的不好用来骂我\n#拼多多好物 #平价好物 #学生党 #省钱 #居家好物",tags:["#拼多多好物","#平价好物","#学生党","#省钱","#居家好物"],hint:"拼多多30元好物推荐"},{id:3,title:"社区咖啡店探店☕藏在小区里的神仙小店",cat:"美食探店",grad:"linear-gradient(135deg,#F97316,#FBBF24)",likes:4523,body:"小区楼下新开的咖啡店差点错过！\n☕ 招牌 Dirty 28元 一口惊艳\n🍰 巴斯克蛋糕 35元 不甜不腻刚刚好\n📸 每个角落都出片！胶片风装修\n📍 藏在老小区里导航到xx路再走3分钟\n\n店主是韩国回来的咖啡师\n自己烘焙的豆子风味太绝了\n#咖啡探店 #社区咖啡店 #小众咖啡 #上海探店 #周末去哪儿",tags:["#咖啡探店","#社区咖啡","#小众咖啡馆","#上海美食","#周末去哪"],hint:"小区宝藏咖啡店"},{id:4,title:"Clean Fit穿搭法则👔基础款也能穿出高级感",cat:"穿搭分享",grad:"linear-gradient(135deg,#EC4899,#8B5CF6)",likes:5103,body:"Clean Fit真的太适合普通人了！不用买大牌\n👕 上装必备：白T恤条纹衫衬衫选重磅面料\n👖 下装：直筒牛仔裤卡其裤阔腿西装裤\n👟 鞋子：德训鞋帆布鞋乐福鞋\n🎨 配色公式：黑白灰蓝卡其三色就够了\n\n全部基本款MUJI和优衣库搞定\n不挑身材不挑人干净就是最好的穿搭\n#CleanFit #穿搭公式 #基础款穿搭 #极简穿搭 #优衣库穿搭",tags:["#CleanFit","#穿搭公式","#基础款","#极简穿搭","#优衣库穿搭"],hint:"Clean Fit基础款穿搭"},{id:5,title:"2025年最值得买的AI工具合集🤖打工人必备",cat:"数码3C",grad:"linear-gradient(135deg,#3B82F6,#6366F1)",likes:3120,body:"用了半年AI工具这6个真的能提升效率\n🤖 DeepSeek 国产之光写作翻译代码都强\n🎨 Midjourney V7 做设计太方便了\n📝 Notion AI 写周报会议纪要神器\n📊 Gamma AI 做PPT只要5分钟\n🎵 Suno AI 音乐生成做视频BGM\n💻 Cursor 写代码比GitHub Copilot好用\n\n每个我都深度用过的不是标题党\n#AI工具 #效率神器 #打工人 #DeepSeek #AI",tags:["#AI工具","#效率神器","#打工人","#DeepSeek","#AI"],hint:"2025年值得买的AI工具"},{id:6,title:"考研英语85分｜我做了这5件事上岸985📚",cat:"学习干货",grad:"linear-gradient(135deg,#7C3AED,#A78BFA)",likes:6890,body:"英语一85分！我的方法真的适合基础差的\n📌 单词：不背单词APP每天200个用艾宾浩斯记忆法\n📌 阅读：唐迟方法论+真题逐句分析\n📌 完型：放弃！最后做随便选\n📌 作文：整理5个万能模板+高级替换词\n📌 翻译：每天精翻2个长难句\n\n坚持4个月从四级飘到85分\n别问来不来得及现在开始就是最早\n#考研英语 #考研 #上岸 #985 #学习经验",tags:["#考研英语","#考研","#上岸","#985","#学习经验"],hint:"考研英语85分方法"},{id:7,title:"300元爆改出租屋🛏️房东看了想涨房租",cat:"租房改造",grad:"linear-gradient(135deg,#38B2AC,#81E6D9)",likes:3421,body:"月租800的老破小300块改造后不想出门了\n🛏️ 床头罩+靠枕 50元 遮丑效果绝了\n💡 日落灯+串灯 40元 氛围感拉满\n📦 PDD收纳柜 80元 乱的东西全藏起来\n🏮 仿真绿植+花瓶 35元 生机感翻倍\n🪞 全身镜 60元 空间瞬间变大\n\n全部PDD买的退房时拆走不心疼\n#出租屋改造 #租房改造 #老破小改造 #独居 #氛围感",tags:["#出租屋改造","#租房改造","#老破小改造","#独居","#氛围感"],hint:"300元爆改出租屋"},{id:8,title:"精简护肤｜25岁后我只用这5样就够了🧴",cat:"美妆护肤",grad:"linear-gradient(135deg,#F472B6,#F9A8D4)",likes:4560,body:"以前护肤十几道工序现在精简到5步皮肤反而变好了\n🧼 洁面：氨基酸洁面晨间清水就够了\n💧 精华：VC早上+A醇晚上\n🧴 面霜：修护屏障的保湿霜就够了\n☀️ 防晒：每天都要涂！阴天也要\n\n精简半年痘痘少了皮肤反而更稳定\n别再被柜姐忽悠买一堆了\n#精简护肤 #护肤干货 #25岁护肤 #敏感肌 #早C晚A",tags:["#精简护肤","#护肤干货","#早C晚A","#敏感肌","#极简护肤"],hint:"精简护肤5样就够了"},{id:9,title:"上班族带饭🍱10分钟搞定的5道快手便当",cat:"一人食",grad:"linear-gradient(135deg,#F59E0B,#FCD34D)",likes:2310,body:"每天带饭上班省了1000块外卖钱\n📅 周一：照烧鸡腿饭 提前腌好早上煎一下\n📅 周二：蛋炒饭+炒时蔬 剩米饭拯救\n📅 周三：番茄意面 15分钟搞定\n📅 周四：咖喱鸡肉饭 一次做两天的量\n📅 周五：牛油果三明治 5分钟快手\n\n全部可以前一天晚上准备好\n早上10分钟装盒就能出门\n#上班族带饭 #便当 #一人食 #快手菜 #省钱",tags:["#上班族带饭","#便当","#一人食","#快手菜","#省钱"],hint:"上班族5天便当不重样"},{id:10,title:"居家普拉提30天变化🔥肚子小了腰围瘦了8cm",cat:"健身减肥",grad:"linear-gradient(135deg,#10B981,#6EE7B7)",likes:7340,body:"坚持30天居家普拉提真的会谢！\n📌 Week1：每天10分钟基础核心训练\n📌 Week2：15分钟腹部+臀部专项\n📌 Week3：20分钟全身燃脂\n📌 Week4：25分钟高强度进阶\n\n✅ 腰围从72到64cm\n✅ 体态肉眼可见变好\n✅ 肩颈酸痛也改善了\n\nB站搜普拉提跟练免费教程一堆\n跟着做就行不用去健身房\n#普拉提 #居家健身 #瘦腰 #减肥 #体态矫正",tags:["#普拉提","#居家健身","#瘦腰","#减肥","#体态矫正"],hint:"30天居家普拉提变化"},{id:11,title:"极简风客厅改造🪴只花了500块像换了套房",cat:"家居家装",grad:"linear-gradient(135deg,#8B5CF6,#A78BFA)",likes:2890,body:"出租屋客厅改造没砸墙没装修只靠软装\n🛋️ 沙发套换色 90元 灰色换米白瞬间变明亮\n📦 藤编收纳筐4个 60元 零碎全藏起来\n🪴 大号仿真绿植 80元 客厅有了呼吸感\n💡 落地灯 100元 取代顶部主灯\n🖼️ 装饰画2幅 50元 墙面不空了\n\n改造理念：留白比填满更重要\n#极简风 #客厅改造 #出租屋改造 #软装 #家居美学",tags:["#极简风","#客厅改造","#出租屋改造","#软装","#家居美学"],hint:"500元极简客厅改造"},{id:12,title:"2025国产剧天花板😭这5部熬夜追完了",cat:"影视推荐",grad:"linear-gradient(135deg,#EF4444,#FCA5A5)",likes:8910,body:"今年的国产剧也太能打了！每部都值得N刷\n🎬 1.《繁花》 王家卫拍电视剧真的降维打击\n🎬 2.《漫长的季节》悬疑剧天花板没有之一\n🎬 3.《我的阿勒泰》治愈到想去新疆定居\n🎬 4.《玫瑰的故事》刘亦菲真的美到发光\n🎬 5.《新生》井柏然演技炸裂反转不断\n\n你今年的top1是什么剧？评论区告诉我👇\n#国产剧 #好剧推荐 #豆瓣高分 #追剧 #2025好剧",tags:["#国产剧","#好剧推荐","#豆瓣高分","#追剧","#2025必看"],hint:"2025国产剧天花板"},{id:13,title:"裸辞后我做自媒体月入2w+🌟分享我的搞钱思路",cat:"职场干货",grad:"linear-gradient(135deg,#6366F1,#818CF8)",likes:10520,body:"35岁裸辞半年月收入反而比上班还高了\n\n✅ 搞钱思路1：知识付费\n把工作10年的经验做成课程定价99元\n卖了300+份纯利3w+\n\n✅ 搞钱思路2：自媒体\n在小红书分享行业干货3个月涨粉5w\n接广子+带货月均1.5w\n\n✅ 搞钱思路3：咨询服务\n1v1付费咨询299/小时每月接10个左右\n\n不是教你一夜暴富\n是想告诉你上班不是唯一的路\n#裸辞 #副业 #搞钱 #自媒体 #自由职业",tags:["#裸辞","#副业","#搞钱","#自媒体","#自由职业"],hint:"裸辞搞钱月入2万"},{id:14,title:"写给30岁的自己📮谢谢你没有放弃",cat:"情感共鸣",grad:"linear-gradient(135deg,#EC4899,#F472B6)",likes:14520,body:"30岁这年我想对自己说：\n\n1. 谢谢你没有在至暗时刻放弃\n2. 那些以为过不去的坎现在看都是铺垫\n3. 不用和别人比较你走的是自己的路\n4. 爸妈的白发越来越多了多回家吧\n5. 朋友不在多三五个知心的就够了\n6. 学会拒绝后生活轻松了十倍\n7. 存钱不是为了买房是为了有说「不」的底气\n8. 孤独不可怕假热闹才是消耗\n9. 身体是1其他都是0\n10. 30岁你比25岁更好了\n\n送给所有正在20+挣扎的朋友\n你们已经很棒了❤️\n#30岁 #写给自己的话 #成长 #治愈 #人生感悟",tags:["#30岁","#写给自己的话","#成长","#治愈","#人生感悟"],hint:"写给30岁的自己"},];
const QUICK_HINTS=["🏘️ 反向旅游5个小县城","🧧 拼多多30元好物","☕ 小区宝藏咖啡店","👔 Clean Fit基础穿搭","🤖 2025AI工具合集","📚 考研英语85分方法","🛏️ 300元出租屋改造","🧴 精简护肤5样就够了","🍱 上班族5天便当","💪 30天普拉提变化","🪴 极简客厅500元改造","🎬 2025国产剧天花板","🌟 裸辞月入2万","📮 写给30岁的自己"];
const PRICING=[{name:"入门",price:18,sets:7,regen:3,desc:"适合偶尔创作",per:"2.6"},{name:"进阶",price:42,sets:20,regen:5,pop:true,desc:"个人博主首选",per:"2.1"},{name:"创作者",price:78,sets:45,regen:8,desc:"高频创作者",per:"1.7"},{name:"工作室",price:148,sets:100,regen:"不限",desc:"团队批量使用",per:"1.5"},];
const TIPS=["标题带数字的笔记，点击率平均高出47%","发布时间建议：周四/周五晚上8-9点","正文前3行决定80%用户是否继续阅读","每篇笔记建议5-7个精准标签","封面图配色统一度直接影响账号调性","评论区互动率高的笔记更容易被推荐","带价格的种草笔记收藏率高出60%","干货笔记的生命周期比日常分享长3倍","小红书流量池推荐机制最多有8层","视频笔记平均互动率比图文高23%","首图加文字标签的笔记收藏率高35%","互动数据好的笔记会被推荐到更大流量池","真诚的标题比夸张的标题更受平台推荐","9张配图比单张图片完播率高2倍","笔记发布后1小时内是流量关键期","合适的发布时间能让曝光翻倍","正文前3行一定要吸引人否则用户直接划走","带定位的探店笔记曝光率高出50%","有对比的干货笔记更容易被收藏","用提问式结尾能提升评论区互动率"];
const CHAR_CYCLE=["ready","wave","walk","stand","jump","sit","meditate","cook","success","curator","analyze","surf","superhero","paint","dance","welcome","lift","inspect","upgrade"];
const STAGES=[{img:"s1",label:"研读素材",desc:"小薯包正在认真分析你的内容..."},{img:"s2",label:"撰写文案",desc:"灵感爆发！正在打磨爆款文案"},{img:"s3",label:"生成配图",desc:"正在精心绘制第 {n}/9 张图片"},{img:"s4",label:"质量检查",desc:"最后检查一下，确保每张都完美"},{img:"s5",label:"打包完成",desc:"搞定！你的爆款图文来啦"},];
const FEATURES=[{icon:Target,title:"智能识别赛道",desc:"粘贴任意素材，AI自动判断旅游、美食、好物等最佳内容策略，不需要手动选择"},{icon:Zap,title:"爆款公式驱动",desc:"内置数字结果式、反差痛点式等经过验证的爆款标题和正文公式"},{icon:Layers,title:"9张完整配图",desc:"1张封面+8张内容页，带拼图排版和文字标注，下载即可发布"},{icon:RotateCcw,title:"单张可重新生成",desc:"对某张图不满意？单独刷新这一张，不浪费整套额度"},{icon:MousePointerClick,title:"一键复制文案",desc:"标题、正文、标签分别复制或一键全部复制，打开小红书直接粘贴发布"},{icon:ShieldCheck,title:"按套计费不套路",desc:"用多少买多少，不搞自动续费，新用户免费体验1套"},];

const API='http://localhost:3099';

/* ═══════ API ═══════ */
async function genAPI(t){try{const r=await fetch(API+"/api/generate",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({text:t})});if(r.ok)return await r.json();const errText=await r.text().catch(()=>r.statusText);throw new Error(errText.slice(0,200));}catch(e){throw new Error("生成失败："+e.message);}}

/* ═══════ STORAGE ═══════ */
async function saveWork(w){try{await fetch(API+"/api/save-work",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({work:w})});}catch(e){console.warn("saveWork error:",e.message);}}
async function loadWorks(){try{const r=await fetch(API+"/api/works");if(r.ok)return await r.json();}catch(e){console.warn("loadWorks error:",e.message);}return[];}
async function getPts(){try{return parseInt(localStorage.getItem("sb-p")||"1");}catch{return 1;}}
async function setPts(n){try{localStorage.setItem("sb-p",String(n));}catch{}}

/* ═══════ UI ATOMS ═══════ */
const s={card:{background:"#fff",borderRadius:16,border:"1px solid #f0f0f0",overflow:"hidden"},cardP:{background:"#fff",borderRadius:16,border:"1px solid #f0f0f0",padding:"20px 22px"},section:{maxWidth:800,margin:"0 auto",padding:"40px 20px"},sectionTitle:{fontSize:22,fontWeight:700,textAlign:"center",margin:"0 0 6px"},sectionSub:{fontSize:13,color:"#999",textAlign:"center",margin:"0 0 28px"}};

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
async function downloadZip(coverUrl,imageUrls,title){
  if(!coverUrl&&!imageUrls?.length)return alert("暂无图片可下载");
  try{
    const JSZip=(await import('jszip')).default;
    const zip=new JSZip();
    const all=[coverUrl,...(imageUrls||[])].filter(Boolean);
    let ok=0;
    for(let i=0;i<all.length;i++){
      try{
        const resp=await fetch(API+"/api/proxy-image?url="+encodeURIComponent(all[i]));
        if(!resp.ok)continue;
        const blob=await resp.blob();
        const name=i===0?"01-封面":"0"+(i+1);
        zip.file(name+".png",blob);
        ok++;
      }catch(e){}
    }
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
  const allImages=useMemo(()=>{const a=[];if(result?.cover_url)a.push(result.cover_url);if(result?.image_urls)a.push(...result.image_urls);return a;},[result]);
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
    {!logged&&<div style={{background:"linear-gradient(135deg,#FFE0E4,#FFF0F2)",borderRadius:0,padding:"10px 18px",display:"flex",alignItems:"center",justifyContent:"center",gap:12}}>
      <span style={{fontSize:13,color:"#333"}}>登录即可把作品保存到「我的作品」</span>
      <Btn small onClick={onLogin} sx={{background:R,color:"#fff",border:"none",whiteSpace:"nowrap"}}><LogIn size={12}/>登录</Btn>
    </div>}

    {/* TOP NAV */}
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 20px",borderBottom:"1px solid #f0f0f0",background:"#fff"}}>
      <div style={{display:"flex",alignItems:"center",gap:8}}>
        <Btn small onClick={()=>{setGen("idle");setResult(null);}}><ArrowLeft size={14}/> 返回</Btn>
        <span style={{fontSize:12,background:"#FFF1F3",color:R,padding:"4px 12px",borderRadius:20,fontWeight:600}}>{result.category}</span>
        <span style={{fontSize:11,color:"#999"}}>{result.audience||''}{result.tip?(' · '+result.tip):''}</span>
      </div>
      <div style={{display:"flex",gap:6}}>
        <Btn small onClick={()=>downloadZip(result.cover_url,result.image_urls,result.title)} sx={{background:"#f8f8f8",color:"#555",border:"none"}}><Download size={12}/> 下载图片</Btn>
      </div>
    </div>

    {/* MAIN CONTENT: LEFT IMAGE + RIGHT TEXT */}
    <div style={{maxWidth:960,margin:"0 auto",padding:"16px 16px 60px"}}>
      <div style={{display:"flex",gap:16,alignItems:"flex-start"}}>
        {/* LEFT: IMAGE */}
        <div style={{flex:"0 0 auto",position:"relative",width:"50%",maxWidth:420}}>
          <div style={{position:"relative",borderRadius:12,overflow:"hidden",background:"#f5f5f5",boxShadow:"0 4px 20px rgba(0,0,0,0.06)"}}
            onMouseEnter={e=>{const a=e.currentTarget.querySelector('.nav-arrows');if(a)a.style.opacity='1';}}
            onMouseLeave={e=>{const a=e.currentTarget.querySelector('.nav-arrows');if(a)a.style.opacity='0';}}>
            {/* IMAGE */}
            {allImages[imgIdx]?<img src={allImages[imgIdx]} alt="" style={{width:"100%",display:"block",cursor:"pointer",aspectRatio:"3/4",objectFit:"cover"}} onClick={()=>setZoom(allImages[imgIdx])}/>:<div style={{width:"100%",aspectRatio:"3/4",display:"flex",alignItems:"center",justifyContent:"center",color:"#ccc",fontSize:13}}>暂无图片</div>}

            {/* HOVER ARROWS */}
            <div className="nav-arrows" style={{position:"absolute",top:0,left:0,right:0,bottom:0,opacity:0,transition:"opacity 0.2s",pointerEvents:"none"}}>
              {imgIdx>0&&<button style={{position:"absolute",left:6,top:"50%",transform:"translateY(-50%)",pointerEvents:"auto",width:32,height:32,borderRadius:"50%",background:"rgba(255,255,255,0.9)",border:"none",boxShadow:"0 2px 8px rgba(0,0,0,0.1)",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,color:"#555",transition:"all .15s"}} onMouseEnter={e=>e.currentTarget.style.background="#fff"} onMouseLeave={e=>e.currentTarget.style.background="rgba(255,255,255,0.9)"} onClick={()=>setImgIdx(i=>i-1)}>{'‹'}</button>}
              {imgIdx<maxI-1&&<button style={{position:"absolute",right:6,top:"50%",transform:"translateY(-50%)",pointerEvents:"auto",width:32,height:32,borderRadius:"50%",background:"rgba(255,255,255,0.9)",border:"none",boxShadow:"0 2px 8px rgba(0,0,0,0.1)",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,color:"#555",transition:"all .15s"}} onMouseEnter={e=>e.currentTarget.style.background="#fff"} onMouseLeave={e=>e.currentTarget.style.background="rgba(255,255,255,0.9)"} onClick={()=>setImgIdx(i=>i+1)}>{'›'}</button>}
            </div>

            {/* REGEN SINGLE BUTTON */}
            <button onClick={(e)=>{e.stopPropagation();regenSingle(imgIdx);}} disabled={rgIdx===imgIdx} style={{position:"absolute",left:8,bottom:8,background:"rgba(0,0,0,0.55)",backdropFilter:"blur(4px)",border:"none",borderRadius:8,padding:"5px 10px",color:"#fff",fontSize:11,cursor:"pointer",display:"flex",alignItems:"center",gap:4,transition:"background .2s",zIndex:5}} onMouseEnter={e=>e.currentTarget.style.background="rgba(0,0,0,0.7)"} onMouseLeave={e=>e.currentTarget.style.background="rgba(0,0,0,0.55)"}>
              {rgIdx===imgIdx?<><Loader2 size={11} className="spin"/> 刷新中...</>:<><RefreshCw size={11}/> 重新生成单张</>}
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
          {/* TITLE */}
          <div style={{...s.cardP,marginBottom:12}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8}}>
              <h2 style={{fontSize:18,fontWeight:800,color:R,margin:0,lineHeight:1.4}}>{result.title}</h2>
              <CopyBtn text={result.title} label="复制标题"/>
            </div>
          </div>

          {/* CURRENT PAGE */}
          {curPage.page_type==='cover'?<div style={{...s.cardP,marginBottom:12}}>
            <div style={{fontSize:11,color:"#bbb",marginBottom:6,fontWeight:600}}>📌 封面</div>
            <div style={{fontSize:15,fontWeight:700,color:"#333",marginBottom:4}}>{curPage.hook||curPage.title}</div>
            {curPage.text&&<div style={{fontSize:13,color:"#666",lineHeight:1.7,whiteSpace:"pre-wrap"}}>{curPage.text}</div>}
            <div style={{marginTop:8,fontSize:12,color:"#999",lineHeight:1.6}}><strong>排版提示：</strong>{curPage.layout_hint||curPage.story||'—'}</div>
          </div>:<div style={{...s.cardP,marginBottom:12}}>
            <div style={{fontSize:11,color:"#bbb",marginBottom:6,fontWeight:600}}>📄 P{curPage.page_id||(imgIdx+1)} {curPage.emoji||''}</div>
            <div style={{fontSize:16,fontWeight:700,color:"#333",marginBottom:6}}>{curPage.title}</div>
            {curPage.hook&&<div style={{fontSize:13,color:R,background:"#FFF1F3",padding:"6px 12px",borderRadius:8,marginBottom:8,display:"inline-block",fontWeight:500}}>{curPage.hook}</div>}
            <div style={{fontSize:13,color:"#555",lineHeight:1.8,whiteSpace:"pre-wrap"}}>{curPage.text||curPage.story||''}</div>
            {curPage.info_blocks?.length>0&&<div style={{marginTop:8,padding:10,background:"#FAFAFA",borderRadius:10,fontSize:12,lineHeight:1.7,color:"#888"}}>{curPage.info_blocks.map((b,i)=><div key={i}>{b}</div>)}</div>}
          </div>}

          {/* TAGS */}
          <div style={{...s.cardP,marginBottom:12}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
              <span style={{fontSize:13,fontWeight:600,display:"flex",alignItems:"center",gap:5}}><Hash size={14} color={R}/>标签</span>
              <CopyBtn text={(result.hashtags||[]).join(" ")} label="复制全部"/>
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
            <Btn small onClick={textRegen} sx={{background:"#fff",color:R,border:"1.5px solid "+R,fontSize:12}}><RefreshCw size={12}/> 重新生成文章</Btn>
            <Btn small onClick={()=>{navigator.clipboard?.writeText(result.title+"\n\n"+result.body_text+"\n\n"+(result.hashtags||[]).join(" ")).catch(()=>{});}} sx={{background:R,color:"#fff",border:"none",fontSize:12}}><Copy size={12}/> 一键复制全部</Btn>
            <Btn small onClick={()=>{setGen("idle");setResult(null);}} sx={{fontSize:12}}><RotateCcw size={12}/> 新生成</Btn>
          </div>
        </div>
      </div>

      {/* PAGE NAV — grid of all pages */}
      <div style={{marginTop:20,display:"grid",gridTemplateColumns:"repeat(9,1fr)",gap:6}}>
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
    <div style={{fontSize:13,fontWeight:600,lineHeight:1.5,marginBottom:6,display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical",overflow:"hidden"}}>{item.title}</div>
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
      if(logged){const np=pts-1;setPtsS(np);await setPts(np);await saveWork({title:r.title,category:r.category,body_text:r.body_text,hashtags:r.hashtags,pages:r.pages,_inputText:text,cover_url:r.cover_url||'',image_urls:r.image_urls||[],cover_prompt:r.cover_prompt||'',image_prompts:r.image_prompts||[]});setWorks(await loadWorks());}
    }catch(e){tm.current.forEach(clearTimeout);setErr(e.message);setGen("idle");}};

  const textRegen=async()=>{
    var inp=result?._inputText||text;
    if(!inp){alert("无法找到原始输入");return;}
    if(!confirm("重新生成文章将消耗额度，确定？"))return;
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
  const nav=<nav style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 28px",background:"rgba(255,255,255,0.92)",borderBottom:"1px solid #f0f0f0",position:"sticky",top:0,zIndex:100,backdropFilter:"blur(14px)"}}>
    <div style={{display:"flex",alignItems:"center",gap:20}}>
      <div style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer"}} onClick={()=>{setPg("home");setGen("idle");setResult(null);setGItem(null);}}>
        <img src={I.appicon} alt="薯包AI" style={{width:30,height:30,borderRadius:8}}/>
        <span style={{fontSize:16,fontWeight:700}}>薯包AI</span>
      </div>
      <div style={{display:"flex",gap:4}}>{[["home","首页"],["gallery","薯包出品"],["pricing","价格方案"],["works","我的作品"]].map(([k,v])=><button key={k} onClick={()=>setPg(k)} style={{fontSize:13,color:pg===k?R:"#777",fontWeight:pg===k?600:400,background:"none",border:"none",padding:"6px 12px",cursor:"pointer",borderRadius:8,transition:"all 0.15s"}}>{v}</button>)}</div>
    </div>
    <div style={{display:"flex",alignItems:"center",gap:8}}>{logged&&<span style={{fontSize:11,color:R,background:"#FFF1F3",padding:"4px 12px",borderRadius:20,fontWeight:600,display:"flex",alignItems:"center",gap:4}}><Sparkles size={11}/>{pts}套</span>}<Btn small onClick={()=>logged?setLogged(false):setShowLogin(true)} sx={{background:logged?"#F0FFF4":"#f5f5f5",color:logged?G:"#777",border:"none"}}>{logged?<><Check size={12}/>已登录</>:<><LogIn size={12}/>登录</>}</Btn></div>
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
    return <ResultDisplay result={result} logged={logged} onLogin={()=>setShowLogin(true)} onPrice={()=>setShowPrice(true)} loginModal={loginModal} priceModal={priceModal} textRegen={textRegen} text={text} setResult={setResult} setGen={setGen}/>;
  }

  /* ═══════ FULL GALLERY PAGE ═══════ */
  if(pg==="gallery"&&!gItem){return <div style={{minHeight:"100vh",background:BG}}>{nav}
    <div style={{...s.section}}>
      <h1 style={{...s.sectionTitle}}>薯包出品</h1>
      <p style={{...s.sectionSub}}>以下内容全部由薯包AI一键生成，点击任意作品查看完整图文</p>
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14}}>{GALLERY.map(g=><GCard key={g.id} item={g} onClick={()=>setGItem(g)}/>)}</div>
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
      <h1 style={{...s.sectionTitle}}>我的作品</h1>
      <p style={{...s.sectionSub}}>{works.length?works.length+"个作品":"还没有作品，去创作第一套爆款图文吧"}</p>
      {!works.length?<div style={{textAlign:"center",padding:"40px 0"}}><CharImg src={I.empty} alt="" style={{height:100}} filter="none" margin="0 0 16px"/>
        {logged?<Btn primary onClick={()=>setPg("home")}><Sparkles size={14}/>开始创作</Btn>:<><p style={{fontSize:13,color:"#999",margin:"0 0 12px"}}>登录后，生成的内容会自动保存到这里</p><Btn primary onClick={()=>setShowLogin(true)}><LogIn size={14}/>登录查看作品</Btn></>}
      </div>
      :<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>{works.map((w,i)=><Card key={w.id||i} hover onClick={()=>{setResult(w);setGen("result");setPg("home");}} sx={{padding:16,display:"flex",gap:12,alignItems:"center"}}>
        {w.cover_url?<img src={w.cover_url} alt="" style={{width:56,height:75,borderRadius:8,objectFit:"cover",flex:"0 0 auto"}}/>:<div style={{width:56,height:75,borderRadius:8,background:"#f5f5f5",flex:"0 0 auto",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20}}>📄</div>}
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

  {css()}{loginModal}{priceModal}</div>;
}
