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
const _IMG=(id,file)=>API+'/api/gallery-image?id='+id+'&file='+file+'&t='+Date.now();
const GALLERY=[{id:'xm',title:'熬夜总结🔥厦门3天2夜精华攻略！人均800+玩到爽！',cat:'旅游攻略',grad:'linear-gradient(135deg,#FF6B35,#F7C59F)',likes:3890,body:'谁懂啊！之前去厦门玩三天两夜，回来被问了800遍攻略！今天熬夜帮各位总结好，人均800左右就能玩得超满足～\n\n✅行程概览\nD1：鼓浪屿全天（日光岩、菽庄花园、龙头路小吃）\nD2：厦门大学+南普陀寺+沙坡尾艺术西区+猫街\nD3：黄厝沙滩日出+曾厝垵+环岛路骑行\n\n💰预算清单（人均）\n交通：约200（高铁+岛内公交）\n住宿：约300（两晚民宿，提前订）\n门票：约80（鼓浪屿船票+日光岩）\n美食：约220（沙茶面、海蛎煎、姜母鸭等）\n总计：约800起，丰俭由人\n\n⚠️实用Tips\n1️⃣ 鼓浪屿船票提前3天在「厦门轮渡」公众号买\n2️⃣ 厦大需预约，周末难约\n3️⃣ 曾厝垵推荐阿杰五香、八婆婆烧仙草\n4️⃣ 环岛路租电动车约30元/小时\n\n家人们赶紧存下来周末就出发！🌊',tags:['#厦门旅游','#厦门攻略','#旅游攻略','#3天2夜','#人均800'],hint:'厦门旅游攻略',cover_url:_IMG('xm','01-封面.png'),image_urls:[2,3,4,5,6,7,8,9].map(n=>_IMG('xm','0'+n+'.png'))},
{id:'ep',title:'实测5款百元蓝牙耳机🔥闭眼入不踩雷',cat:'好物评测',grad:'linear-gradient(135deg,#3B82F6,#6366F1)',likes:2290,body:'家人们谁懂啊！想买个百元蓝牙耳机看花眼？我帮你实测了5款热门款，直接抄作业！\n\n🎧 漫步者X2：约100元，音质均衡，续航6小时，入门首选。\n🎧 小米Air2 SE：约120元，低音强劲，触控灵敏。\n🎧 绿联HiTune：约90元，续航7小时，降噪意外好。\n🎧 倍思WM01：约80元，半入耳设计，通话清晰。\n🎧 网易云蓝牙耳机：约110元，外观潮，音质中规中矩。\n\n百元价位首选漫步者X2，预算紧张选倍思WM01！',tags:['#蓝牙耳机推荐','#百元耳机','#数码好物','#学生党必备'],hint:'百元蓝牙耳机推荐',cover_url:_IMG('ep','01-封面.png'),image_urls:[2,3,4,5,6,7,8,9].map(n=>_IMG('ep','0'+n+'.png'))},
{id:'crab',title:'人均80吃帝王蟹🦀？这家大排档也太狠了吧！',cat:'美食探店',grad:'linear-gradient(135deg,#F97316,#FBBF24)',likes:4523,body:'以前总觉得海鲜大排档又贵又坑，结果被闺蜜拉去吃了一顿，直接刷新认知😱人均才80左右就能炫到整只帝王蟹！\n\n🦀招牌帝王蟹：约4斤，清蒸或避风塘，肉质鲜甜Q弹，约280元。\n🦐椒盐皮皮虾：只只带膏，椒盐味超香，约68元。\n🦪蒜蓉烤生蚝：现开现烤，一打约58元。\n🔥避风塘炒蟹：香辣入味，锅气十足，约128元。\n\n建议下午4点前到店有早鸟折扣，人多点套餐更划算，人均约80-100元吃到撑！',tags:['#海鲜大排档','#帝王蟹','#人均80','#美食探店','#性价比海鲜'],hint:'帝王蟹探店推荐',cover_url:_IMG('crab','01-封面.png'),image_urls:[2,3,4,5,6,7,8,9].map(n=>_IMG('crab','0'+n+'.png'))},
{id:'jk',title:'3套JK制服搭配🔥附价格参考！甜酷风一网打尽',cat:'穿搭分享',grad:'linear-gradient(135deg,#FFB6C1,#FF69B4)',likes:3180,body:'JK制服怎么搭才不显土？整理了3套日常又出圈的搭配！\n\n✅第一套：绀色关东襟水手服（约120元）+灰色百褶裙（约80元）+同色领结（15元），清爽乖巧配小白鞋！\n\n✅第二套：白衬衫（约90元）+卡其色开衫（约150元）+红蓝格裙（约100元），温柔有层次！\n\n✅第三套：灰色连帽卫衣（约110元）+深蓝格裙（约90元）+白色堆堆袜（约20元），街头休闲不挑身材！\n\n💡领结选绀色或红色最百搭，袜子选白色中筒袜，蝴蝶结发夹增加细节～',tags:['#JK穿搭','#水手服','#百褶裙','#学生党穿搭','#甜酷风'],hint:'JK制服穿搭分享',cover_url:_IMG('jk','01-封面.png'),image_urls:[3,4,5,6,7,8,9].map(n=>_IMG('jk','0'+n+'.png'))},
{id:'skincare',title:'25岁精简护肤🔥3步养出透亮肌！别再叠涂浪费💰',cat:'美妆护肤',grad:'linear-gradient(135deg,#DDA0DD,#FFB6C1)',likes:2670,body:'家人们谁懂啊！25岁皮肤直线下滑，以前叠加七八层猛药越搞越差！精简到核心三步反而稳定透亮～\n\n🔥温和清洁：早上清水，晚上氨基酸洁面。推荐至本舒颜修护洁面乳（约60元），泡沫细腻不紧绷。\n\n💧保湿修护：水+乳/面霜二选一。油皮选瑷尔博士微晶水（约150元），干皮选珂润面霜（约150元）。\n\n☀️硬防晒为主：通勤用帽檐7cm以上渔夫帽+口罩，户外用薇诺娜清透防晒乳（约80元/50g）。\n\n⚠️不要天天敷面膜（每周最多2次），不要用化妆棉擦拭，不要多种精华叠加。每天5分钟，坚持一个月感谢自己！',tags:['#精简护肤','#25岁护肤','#护肤步骤','#养肤','#干皮护肤','#平价好物'],hint:'25岁精简护肤步骤',cover_url:_IMG('skincare','01-封面.png'),image_urls:[2,3,4,5,6,7,8,9].map(n=>_IMG('skincare','0'+n+'.png'))},
{id:'pilates',title:'30天居家普拉提🔥腰围缩了5cm！体态逆袭',cat:'健身减肥',grad:'linear-gradient(135deg,#32CD32,#20B2AA)',likes:3540,body:'以前总觉得普拉提太温和没效果，坚持30天后，体态肉眼可见变好，腰腹线条超紧致！\n\n🔥一周3次，每次40分钟。百次拍击、卷腹、天鹅臂、侧卧抬腿、骨盆卷动，注意动作要慢感受发力。加上每天10分钟拉伸。\n\n💰配合饮食：早餐燕麦杯，午餐鸡胸肉沙拉，晚餐番茄蔬菜汤，热量控制在1500千卡。\n\n⭐效果：腰围减少5cm，臀线提升2cm！不用办卡，一张瑜伽垫搞定！',tags:['#居家普拉提','#30天蜕变','#瘦身塑形','#健身干货','#体态改善'],hint:'30天居家普拉提计划',cover_url:_IMG('pilates','01-封面.png'),image_urls:[2,3,4,5,6,7,8,9].map(n=>_IMG('pilates','0'+n+'.png'))},
{id:'livingroom',title:'500元爆改极简客厅😱朋友都以为花了几万！',cat:'家居家装',grad:'linear-gradient(135deg,#D2B48C,#F5DEB3)',likes:4120,body:'之前客厅又暗又乱，花了500元做了极简改造，邻居进门直呼高级！\n\n🔥换窗帘：白纱帘+亚麻拼色约120元，光影氛围感拉满！\n💡铺地毯：米色短绒地毯约150元，客厅瞬间温柔。\n✅DIY装饰画：宜家画框+打印极简线条画，不到30元。\n🌿加点绿植：橡皮树+龟背竹约80元，角落有生机。\n💰换暖光射灯+纸灯罩约70元，晚上超温馨。\n\n最后放几个抱枕+香薰，500元搞定！现在每天回家都不想出门～',tags:['#极简客厅','#小预算改造','#客厅改造','#家居好物','#改造前后'],hint:'500元极简客厅改造',cover_url:_IMG('livingroom','01-封面.png'),image_urls:[2,3,4,5,6,7,8,9].map(n=>_IMG('livingroom','0'+n+'.png'))},
{id:'rent',title:'实测300元出租屋改造🆘效果真的绝了',cat:'家居家装',grad:'linear-gradient(135deg,#E6A8D7,#C9A0DC)',likes:2890,body:'出租屋又小又旧，房东不让大改，预算只有300块！改造后邻居都来问链接！\n\n✅地毯铺上瞬间变温馨：短绒款不到50元，赤脚踩超舒服。\n✅魔术贴窗帘拯救窗户：遮光卷帘约30元。\n✅壁纸贴出新天地：自粘壁纸15元一卷。\n✅折叠桌+收纳盒：约40元+15元/个。\n✅LED灯带营造氛围感：约35元，暖色调。\n✅绿植/干花增加生气：绿萝约10元/盆。\n\n改造完每天回家都超开心！',tags:['#出租屋改造','#300元改造','#租房大改造','#家居家装','#租房党'],hint:'300元出租屋改造攻略',cover_url:_IMG('rent','01-封面.png'),image_urls:[2,3,4,5,6,7,8].map(n=>_IMG('rent','0'+n+'.png'))},
{id:'aitools',title:'实测推荐🔥这5款AI工具让我效率翻倍！',cat:'好物评测',grad:'linear-gradient(135deg,#8B5CF6,#A78BFA)',likes:3360,body:'以前写周报要憋一小时，现在用AI工具10分钟搞定！精选5个真正好用的：\n\n🔥豆包（字节）——全能写作助手，免费不限次数，写小红书文案全靠它。\n🚀通义千问（阿里）——上传PDF自动总结要点，读论文真救命。\n💡文心一言（百度）——Excel公式不会写？让它直接生成。\n🎨文心一格——AI绘画免费工具，PPT封面小红书配图都用它。\n⭐Kimi（月之暗面）——一次读20万字PDF，适合读教材写摘要。\n\n别盲目下载太多，选2-3个深度使用就够！',tags:['#AI工具','#效率神器','#免费工具','#学生党必备','#打工人必备'],hint:'AI工具推荐合集',cover_url:_IMG('aitools','01-封面.png'),image_urls:[2,3,4,5,6,7,8,9].map(n=>_IMG('aitools','0'+n+'.png'))},
{id:'mealprep',title:'打工人带饭一周🔥月省800元💰5分钟搞定',cat:'一人食',grad:'linear-gradient(135deg,#FFA500,#FFD700)',likes:2750,body:'每天点外卖三四十，一个月工资都吃没了！不如自己带饭，干净省钱又好吃～\n\n🔥周一番茄炒蛋：3鸡蛋+2番茄，成本不到5块，10分钟。\n💰周二青椒肉丝：瘦肉5元+青椒1元，成本6元。\n✅周三可乐鸡翅：鸡翅8个10元+可乐3元，成本13元。\n⭐周四蒜蓉西兰花：西兰花一颗4元，清炒3分钟。\n💡周五虾仁滑蛋：虾仁15元+鸡蛋3个，成本18元。\n\n💰5天菜钱约56元，外卖至少125元，一周省69元，月省276元！周末集中切菜分装，米饭一次煮一周量冷冻。',tags:['#带饭','#上班族带饭','#省钱午餐','#快手菜','#一周食谱','#一人食'],hint:'上班族5天带饭食谱',cover_url:_IMG('mealprep','01-封面.png'),image_urls:[2,3,4,5,6,7,8,9].map(n=>_IMG('mealprep','0'+n+'.png'))},
{id:'books',title:'改变认知的6本好书🔥读完格局直接炸裂',cat:'书单推荐',grad:'linear-gradient(135deg,#1E3A5F,#3B5998)',likes:4230,body:'以前总觉得读书就是消遣，直到读了这6本书，思维被彻底刷新：\n\n✅《认知觉醒》周岭·豆瓣8.6——用元认知驱动行动，改掉拖延。\n✅《思考，快与慢》丹尼尔·卡尼曼·豆瓣8.2——诺奖得主，避开决策陷阱。\n✅《原则》瑞·达利欧·豆瓣8.3——从随性变成系统思考，少走弯路。\n✅《被讨厌的勇气》岸见一郎·豆瓣8.5——摆脱讨好型人格，自由就是被讨厌的勇气。\n✅《人类简史》尤瓦尔·赫拉利·豆瓣9.1——对金钱国家宗教的认知彻底颠覆。\n✅《刻意练习》安德斯·艾利克森·豆瓣8.0——打破一万小时迷思。\n\n每一本都值得反复读！',tags:['#书单推荐','#改变认知','#好书推荐','#认知升级','#必读书单'],hint:'改变认知的6本好书',cover_url:_IMG('books','01-封面.png'),image_urls:[2,3,4,5,6,7].map(n=>_IMG('books','0'+n+'.png'))},
{id:'tv2026',title:'格局炸裂🤯2026年必看国产剧清单🔥熬夜也得追完',cat:'影视推荐',grad:'linear-gradient(135deg,#8B0000,#FFD700)',likes:5610,body:'2026年国产剧太能打了！高分神剧扎堆上线！\n\n🔥《主角》张嘉益×刘浩存·豆瓣8.2——秦腔名伶逆袭人生，看一集哭一集😭\n🔥《家业》杨紫×韩东君·古装徽墨——非遗题材+复仇爽文，画面美到每一帧都想截图📸\n🔥《低智商犯罪》王骁×田曦薇·豆瓣8.1——悬疑喜剧天花板！反转笑到头掉🤣\n🔥《太平年》历史正剧·豆瓣8.6——史诗级制作，服化道封神！\n🔥《生命树》生态现实·豆瓣8.4——环保题材催泪弹，看完想立刻去种树🌳\n🔥《灵魂摆渡·十年》于毅×刘智扬·奇幻悬疑——十年回归，还是熟悉的味道！\n\n这个夏天别再剧荒了！',tags:['#2026年国产剧','#熬夜追剧','#剧荒推荐','#国产剧推荐','#高分电视剧'],hint:'2026必看国产剧推荐',cover_url:_IMG('tv2026','01-封面.png'),image_urls:[2,3,4,5,6,7].map(n=>_IMG('tv2026','0'+n+'.png'))},
{id:'english',title:'考研英语85分不是梦🔥学姐3个月提分秘诀！',cat:'学习干货',grad:'linear-gradient(135deg,#1E90FF,#87CEEB)',likes:3470,body:'英语基础一般，考研居然考了85分！之前模拟总60多，用了这套方法直接逆袭！\n\n✅词汇是地基：艾宾浩斯记忆表每天刷300个，60天突破6000+。\n✅阅读靠逻辑：唐迟阅读课刷3遍，近20年真题刷3遍。\n✅作文模板：大小作文各5个万能模板，每周写2篇批改后背诵。\n✅完形翻译：完形靠熟词僻义整理小本子，翻译先找主干再补修饰。\n✅时间规划：6-7月词汇→8-9月阅读→10月作文→11-12月全真模拟。每天英语2小时雷打不动。\n\n85分真的不是梦！',tags:['#考研英语','#考研经验','#英语学习方法','#考研85分','#考研上岸'],hint:'考研英语85分方法',cover_url:_IMG('english','01-封面.png'),image_urls:[2,3,4,5,6,7,8].map(n=>_IMG('english','0'+n+'.png'))},
{id:'selfmedia',title:'裸辞做自媒体🔥3个月收入破万，我做了什么？',cat:'职场干货',grad:'linear-gradient(135deg,#C0392B,#E74C3C)',likes:4890,body:'裸辞前月薪5千，现在自媒体月入1万+，后悔没早点辞职！3个月从0到1的搞钱思路：\n\n🔥定位定生死：选一个垂直领域死磕。我选「裸辞搞钱」人设，粉丝3个月涨2万。\n💰内容要有用：每条笔记必须有干货，爆款公式=痛点标题+数字结论+真实案例。\n🚀变现要趁早：前1个月就挂通告平台，报价从200元/条涨到800元/条。\n✅工具要会用：创客贴/醒图作图，剪映剪辑，每天2小时效率翻倍。\n📌心态要稳：前2个月没收入正常，我第3个月才开单，坚持日更2条。\n\n裸辞不是终点，是起点！',tags:['#裸辞','#自媒体','#搞钱','#副业','#职场干货','#月入过万'],hint:'裸辞做自媒体搞钱思路',cover_url:_IMG('selfmedia','01-封面.png'),image_urls:[2,3,4,5,6,7].map(n=>_IMG('selfmedia','0'+n+'.png'))},];
const QUICK_HINTS=["📍厦门3天2夜旅游攻略","🎧百元蓝牙耳机测评","🦀海鲜大排档人均80吃帝王蟹","🎀JK穿搭分享","🤖最新AI工具推荐合集","📚考研英语85分方法","🛏️300元出租屋改造攻略","🧴25岁精简护肤步骤","🍱上班族5天带饭食谱","🏋️30天居家普拉提计划","🪴500元极简客厅改造","🎬2026必看国产剧推荐","💰裸辞做自媒体搞钱思路","📖改变认知的6本好书推荐"];
const PRICING_XHS=[{name:"入门",price:19,sets:3,regen:5,desc:"偶尔创作的博主",per:"6.3",imgs:"约27张配图"},{name:"进阶",price:49,sets:10,regen:8,pop:true,desc:"个人博主首选",per:"4.9",imgs:"约90张配图"},{name:"创作者",price:99,sets:25,regen:15,desc:"高频创作者",per:"4.0",imgs:"约225张配图"},{name:"工作室",price:199,sets:60,regen:30,desc:"团队批量使用",per:"3.3",imgs:"约540张配图"},];
const PRICING_EC=[{name:"入门",price:19,sets:5,regen:5,desc:"偶尔出图的卖家",per:"3.8",imgs:"约5~20张商品图"},{name:"进阶",price:49,sets:15,regen:8,pop:true,desc:"电商卖家首选",per:"3.3",imgs:"约15~60张商品图"},{name:"专业",price:99,sets:40,regen:15,desc:"高频出图",per:"2.5",imgs:"约40~160张商品图"},{name:"工作室",price:199,sets:100,regen:30,desc:"批量作业",per:"2.0",imgs:"约100~400张商品图"},];
const TIPS=["标题带数字的笔记，点击率平均高出47%","发布时间建议：周四/周五晚上8-9点","正文前3行决定80%用户是否继续阅读","每篇笔记建议5-7个精准标签","封面图配色统一度直接影响账号调性","评论区互动率高的笔记更容易被推荐","带价格的种草笔记收藏率高出60%","干货笔记的生命周期比日常分享长3倍","小红书流量池推荐机制最多有8层","视频笔记平均互动率比图文高23%","首图加文字标签的笔记收藏率高35%","互动数据好的笔记会被推荐到更大流量池","真诚的标题比夸张的标题更受平台推荐","9张配图比单张图片完播率高2倍","笔记发布后1小时内是流量关键期","合适的发布时间能让曝光翻倍","正文前3行一定要吸引人否则用户直接划走","带定位的探店笔记曝光率高出50%","有对比的干货笔记更容易被收藏","用提问式结尾能提升评论区互动率"];
const CHAR_CYCLE=["ready","wave","walk","stand","jump","sit","meditate","cook","success","curator","analyze","surf","superhero","paint","dance","welcome","lift","inspect","upgrade"];
const STAGES=[{img:"s1",label:"研读素材",desc:"小薯包正在认真分析你的内容..."},{img:"s2",label:"撰写文案",desc:"灵感爆发！正在打磨爆款文案"},{img:"s3",label:"生成配图",desc:"正在精心绘制第 {n}/9 张图片"},{img:"s4",label:"品质优化",desc:"正在精修图片细节，确保每一张都精致出彩"},{img:"s5",label:"打包完成",desc:"搞定！你的爆款图文来啦"},];
const FEATURES=[{icon:Target,title:"智能识别14大赛道",desc:"自动判断旅游、美食、好物、穿搭、美妆等14大内容赛道，无需手动选择"},{icon:Zap,title:"爆款公式驱动",desc:"内置数字结果式、反差痛点式等经过验证的爆款标题和正文公式"},{icon:Layers,title:"9张完整配图",desc:"1张封面+8张内容页，带拼图排版和文字标注，下载即可发布"},{icon:RotateCcw,title:"单张可重新生成",desc:"对某张图不满意？单独刷新这一张，不浪费整套额度"},{icon:MousePointerClick,title:"一键复制文案",desc:"标题、正文、标签分别复制或一键全部复制，打开小红书直接粘贴发布"},{icon:ShieldCheck,title:"按套计费不套路",desc:"用多少买多少，不自动续费，套餐不过期"},];
/* ═══════ API ═══════ */
async function genAPI(t,onImg,onProg,images){const r=await fetch(API+"/api/generate",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({text:t,images:images||[]})});if(!r.ok){const e=await r.text().catch(()=>r.statusText);throw new Error(e.slice(0,200));}const reader=r.body.getReader();const dec=new TextDecoder();let buf="";let gotComplete=false;const result={cover_url:"",image_urls:[]};while(true){const{done,value}=await reader.read();if(done)break;buf+=dec.decode(value,{stream:true});const lines=buf.split(String.fromCharCode(10));buf=lines.pop()||"";for(const line of lines){if(!line.startsWith("data: "))continue;try{const d=JSON.parse(line.slice(6));if(d.type==="progress"&&onProg)onProg(d);else if(d.type==="image"){if(d.id==="cover")result.cover_url=d.url;else if(d.url)result.image_urls.push(d.url);if(onImg)onImg(d);}else if(d.type==="complete"){gotComplete=true;Object.assign(result,d);result.image_count=d.image_urls?.length||0;}else if(d.type==="error")throw new Error(d.error||"生成失败");}catch(e){}}}if(!gotComplete)throw new Error("生成未完成，请重试");return result;}

/* ═══════ STORAGE ═══════ */
async function saveWork(w){try{var local=JSON.parse(localStorage.getItem("sb-works")||"[]");// 如果 _saveKey 已存在，就地更新不重复添加
var saveKey=w._saveKey;if(saveKey!=null){var existIdx=local.findIndex(function(x){return String(x._saveKey)===String(saveKey);});if(existIdx>=0){local[existIdx]={...local[existIdx],...w};localStorage.setItem("sb-works",JSON.stringify(local.slice(0,50)));}else{local.unshift({...w,id:Date.now(),at:new Date().toLocaleDateString("zh-CN")});localStorage.setItem("sb-works",JSON.stringify(local.slice(0,50)));}}else{local.unshift({...w,id:Date.now(),at:new Date().toLocaleDateString("zh-CN")});localStorage.setItem("sb-works",JSON.stringify(local.slice(0,50)));}}catch(e){}try{var r=await fetch(API+"/api/save-work",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({work:w})});if(!r.ok)console.warn("saveWork server:",r.status);else{var j=await r.json();console.log("saveWork: server saved",j.count,"works");}}catch(e){console.warn("saveWork:",e.message);try{await new Promise(function(r){return setTimeout(r,500);});var r2=await fetch(API+"/api/save-work",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({work:w})});if(r2.ok)console.log("saveWork: retry ok");else console.warn("saveWork retry:",r2.status);}catch(e2){console.warn("saveWork retry:",e2.message);}}}
async function loadWorks(){try{const r=await fetch(API+"/api/works");if(r.ok){var d=await r.json();try{var local=JSON.parse(localStorage.getItem("sb-works")||"[]");var localMap=new Map();local.forEach(function(x){if(x._saveKey!=null)localMap.set(String(x._saveKey),x);});d=d.map(function(sv){return localMap.get(String(sv._saveKey))||sv;});var seenKeys=new Set(d.map(function(x){return String(x._saveKey);}));var missing=local.filter(function(x){return x._saveKey!=null&&!seenKeys.has(String(x._saveKey))&&(x.title&&!x.title.includes("�"));});if(missing.length>0){d=[...missing,...d].slice(0,50);}}catch(e){}try{localStorage.setItem("sb-works",JSON.stringify(d));}catch(e){}d.sort(function(a,b){return(b.id||0)-(a.id||0)||String(b._saveKey||'').localeCompare(String(a._saveKey||''))});return d;}}catch(e){console.warn("loadWorks:",e.message);}try{return JSON.parse(localStorage.getItem("sb-works")||"[]");}catch(e){}return[];}
async function getPts(){try{return parseInt(localStorage.getItem("sb-p")||"0");}catch{return 0;}}
async function setPts(n){try{localStorage.setItem("sb-p",String(n));}catch{}}

/* ═══════ UI ATOMS ═══════ */
const s={card:{background:"#fff",borderRadius:16,border:"1px solid #f0f0f0",overflow:"hidden"},cardP:{background:"#fff",borderRadius:16,border:"1px solid #f0f0f0",padding:"20px 22px"},section:{maxWidth:1060,margin:"0 auto",padding:"48px 28px"},sectionTitle:{fontSize:24,fontWeight:800,textAlign:"center",margin:"0 0 6px",fontFamily:"'Microsoft YaHei','PingFang SC','Noto Sans SC',sans-serif",letterSpacing:"1px",color:"#1a1a1a"},sectionSub:{fontSize:13,color:"#999",textAlign:"center",margin:"0 0 32px"}};

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
    link.download=(title||"薯包AI").slice(0,20).replace(/[\\/:*?"<>|]/g,'')+".zip";
    link.click();
    URL.revokeObjectURL(link.href);
  }catch(e){alert("下载失败，请重试");}
}

/* ═══════ 电商生图 API ═══════ */
const EC_CATS = ["美妆护肤","数码3C","食品饮料","服饰穿搭","家居生活","母婴用品","宠物用品","其他"];
const EC_ALL_STYLES = ["白底主图","场景图","详情图","组合图"];
const EC_PLATS = ["淘宝","京东","拼多多","小红书电商","抖音电商","亚马逊"];
const EC_PLAT_DESC = {淘宝:"淘宝/天猫",京东:"京东",拼多多:"拼多多",小红书电商:"小红书商城",抖音电商:"抖音小店",亚马逊:"Amazon跨境"};

async function genECommerce({productName,category,refImgs,styles,platform,points}){
  const r=await fetch(API+"/api/generate-ecommerce",{
    method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({
      product_name:productName,
      category:category,
      reference_images:refImgs,
      styles:styles,
      platform:platform,
      selling_points:points,
    }),
  });
  if(!r.ok){const e=await r.text().catch(()=>r.statusText);throw new Error(e.slice(0,200));}
  return await r.json();
}

/* ═══════ RESULT MODAL (left image + right text) ═══════ */
function ResultDisplay({result,logged,onLogin,onPrice,loginModal,priceModal,textRegen,text,setResult,setGen}){
  const [imgIdx,setImgIdx]=useState(0);
  const [zoom,setZoom]=useState(null);
  const [rgIdx,setRgIdx]=useState(null); // which image is regenerating
  const allImages=useMemo(()=>{const a=[];if(result?.cover_url)a.push(result.cover_url.includes('/api/gallery-image')?result.cover_url:proxyImg(result.cover_url));if(result?.image_urls)a.push(...result.image_urls.map(u=>u.includes('/api/gallery-image')?u:proxyImg(u)));return a;},[result]);
  const pages=result?.pages||[];
  // 🔑 按 page_id 找当前图片对应的内容页（不是 pages[imgIdx]）
  const curPage=(()=>{
    if(imgIdx===0)return{};
    var pageId=result?.image_prompts?.[imgIdx-1]?.page_id;
    if(pageId!=null){var found=pages.find(function(p){return p.page_id===pageId;});if(found)return found;}
    return pages[imgIdx-1]||{};
  })();
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
        // 🔑 image_prompts[i-1] 对应 image_urls[i-1]（封面后第一张）
        const pi=result?.image_prompts?.[i-1];
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
        <Btn small onClick={()=>{if(result._galleryItem){alert('这是薯包出品的展示内容，请先自己生成作品后再使用此功能');return;}downloadZip(result.cover_url,result.image_urls,result.title,result.body_text,result.hashtags);}} sx={{background:"#f8f8f8",color:"#555",border:"none"}}><Download size={12}/> 下载图片</Btn>
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
            {result._galleryItem
              ? <button onClick={(e)=>{e.stopPropagation();alert('这是薯包出品的展示内容，请先自己生成作品后再使用此功能');}} disabled={rgIdx===imgIdx} style={{position:"absolute",left:8,bottom:8,background:"rgba(0,0,0,0.55)",backdropFilter:"blur(4px)",border:"none",borderRadius:8,padding:"5px 10px",color:"#fff",fontSize:11,cursor:"pointer",display:"flex",alignItems:"center",gap:4,transition:"background .2s",zIndex:5}} onMouseEnter={e=>e.currentTarget.style.background="rgba(0,0,0,0.7)"} onMouseLeave={e=>e.currentTarget.style.background="rgba(0,0,0,0.55)"}><RefreshCw size={11}/> 重生成</button>
              : <button onClick={(e)=>{e.stopPropagation();regenSingle(imgIdx);}} disabled={rgIdx===imgIdx} style={{position:"absolute",left:8,bottom:8,background:"rgba(0,0,0,0.55)",backdropFilter:"blur(4px)",border:"none",borderRadius:8,padding:"5px 10px",color:"#fff",fontSize:11,cursor:"pointer",display:"flex",alignItems:"center",gap:4,transition:"background .2s",zIndex:5}} onMouseEnter={e=>e.currentTarget.style.background="rgba(0,0,0,0.7)"} onMouseLeave={e=>e.currentTarget.style.background="rgba(0,0,0,0.55)"}>
                {rgIdx===imgIdx?<><Loader2 size={11} className="spin"/> 刷新中...</>:<><RefreshCw size={11}/> 重生成</>}
              </button>}

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
            {result._galleryItem
              ? <Btn small onClick={()=>{alert('这是薯包出品的展示内容，请先自己生成作品后再使用此功能');}} sx={{background:"#fff",color:R,border:"1.5px solid "+R,fontSize:12}}><RefreshCw size={12}/> 重新生成文案</Btn>
              : <><Btn small onClick={textRegen} sx={{background:"#fff",color:R,border:"1.5px solid "+R,fontSize:12}}><RefreshCw size={12}/> 重新生成文案</Btn></>}
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
function GCard({item,onClick,onSameStyle}){const[h,setH]=useState(false);const[imgErr,setImgErr]=useState(false);return <Card hover onClick={onClick} sx={{overflow:"hidden",position:"relative",aspectRatio:"3/4",cursor:"pointer",background:item.grad||'#f5f5f5',borderRadius:12,border:"none",boxShadow:"0 2px 12px rgba(0,0,0,0.06)"}}>
  <div style={{position:"absolute",inset:0}} onMouseEnter={()=>setH(true)} onMouseLeave={()=>setH(false)}>
    {/* 封面图 */}
    {item.cover_url&&!imgErr?<img src={item.cover_url} alt="" style={{width:"100%",height:"100%",objectFit:"cover",display:"block"}} onError={()=>setImgErr(true)}/>:null}
    {/* 底部轻微渐隐（方便白字标题阅读） */}
    <div style={{position:"absolute",bottom:0,left:0,right:0,height:"40%",background:"linear-gradient(transparent,rgba(0,0,0,0.5))",pointerEvents:"none"}}/>
    {/* 分类标签 */}
    <span style={{position:"absolute",top:10,left:10,zIndex:2,fontSize:10,background:"rgba(0,0,0,0.45)",color:"#fff",padding:"3px 10px",borderRadius:8,backdropFilter:"blur(4px)",fontWeight:600}}>{item.cat}</span>
    {/* 标题 */}
    <div style={{position:"absolute",bottom:12,left:12,right:12,zIndex:2}}>
      <div style={{fontSize:13,fontWeight:700,color:"#fff",lineHeight:1.5,textShadow:"0 1px 4px rgba(0,0,0,0.4)",display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical",overflow:"hidden"}}>{item.title}</div>
    </div>
    {/* HOVER 覆盖层 */}
    {h&&<div style={{position:"absolute",inset:0,background:"rgba(0,0,0,0.4)",zIndex:3,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:10,animation:"fadeIn 0.15s"}}>
      <span style={{background:"rgba(255,255,255,0.95)",color:R,fontSize:12,fontWeight:600,padding:"8px 18px",borderRadius:10,display:"flex",alignItems:"center",gap:5,boxShadow:"0 4px 12px rgba(0,0,0,0.15)",cursor:"pointer",whiteSpace:"nowrap"}} onClick={function(e){e.stopPropagation();onClick();}}><Eye size={13}/>查看全套内容</span>
      <span style={{background:R,color:"#fff",fontSize:12,fontWeight:600,padding:"8px 18px",borderRadius:10,display:"flex",alignItems:"center",gap:5,boxShadow:"0 4px 12px rgba(0,0,0,0.15)",cursor:"pointer",whiteSpace:"nowrap"}} onClick={function(e){e.stopPropagation();if(onSameStyle){onSameStyle();}}}><Sparkles size={13}/>一键同款</span>
    </div>}
  </div>
</Card>;}

/* ═══════ MAIN APP ═══════ */
export default function App(){
  const[pg,setPg]=useState("home");
  const[logged,setLogged]=useState(false);
  const[showLogin,setShowLogin]=useState(false);
  const[showPrice,setShowPrice]=useState(false);
  const[text,setText]=useState("");
  const[refImages,setRefImages]=useState([]); // 参考图（base64 data URLs）
  const fileInputRef=useRef(null);
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
  const[priceTab,setPriceTab]=useState("content");
  const[mode,setMode]=useState("content");
  const[demoIdx,setDemoIdx]=useState(0);
  const demoItems=useMemo(()=>GALLERY.slice(0,8),[]);
  const tm=useRef([]);
  const scrollPos=useRef(0);

  /* ═══════ E-COMMERCE STATE ═══════ */
  const[ecName,setEcName]=useState("");
  const[ecCat,setEcCat]=useState("美妆护肤");
  const[ecRefImgs,setEcRefImgs]=useState([]);
  const ecFileRef=useRef(null);
  const[ecStyles,setEcStyles]=useState(["白底主图","场景图","详情图","组合图"]);
  const[ecPlat,setEcPlat]=useState("淘宝");
  const[ecPoints,setEcPoints]=useState("");
  const[ecGen,setEcGen]=useState("idle");
  const[ecResult,setEcResult]=useState(null);
  const[ecErr,setEcErr]=useState("");

  const toggleStyle=(s)=>{setEcStyles(function(p){return p.includes(s)?p.filter(x=>x!==s):[...p,s];});};
  const doECGen=async()=>{
    if(!ecName.trim())return setEcErr("请输入商品名称");
    if(ecStyles.length===0)return setEcErr("请至少选择一种图片风格");
    setEcGen("loading");setEcErr("");setEcResult(null);
    try{const r=await genECommerce({productName:ecName,category:ecCat,refImgs:ecRefImgs,styles:ecStyles,platform:ecPlat,points:ecPoints,});setEcResult(r);setEcGen("result");}
    catch(e){setEcErr(e.message);setEcGen("idle");}
  };

  useEffect(()=>{loadWorks().then(setWorks);getPts().then(setPtsS);},[]);
  useEffect(()=>{if(gen==="loading"){const t=setInterval(()=>setTipIdx(i=>(i+1)%TIPS.length),4000);return()=>clearInterval(t);}},[gen]);
  useEffect(()=>{if(gen!=="loading"){const t=setInterval(()=>setCarouselIdx(i=>(i+1)%QUICK_HINTS.length),3000);return()=>clearInterval(t);}},[gen]);
  // 切换到"我的作品"页时自动加载最新数据
  useEffect(()=>{if(pg==="works")loadWorks().then(setWorks);},[pg]);
  // 首页演示自动轮播
  useEffect(()=>{if(pg!=="home")return;const t=setInterval(()=>setDemoIdx(i=>(i+1)%demoItems.length),3500);return()=>clearInterval(t);},[pg,demoItems.length]);

  const doGen=async()=>{if(!text.trim())return;
    if(!logged){setShowLogin(true);return;}
    if(pts<=0){setShowPrice(true);return;}
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
      },undefined,refImages);
      tm.current.forEach(clearTimeout);setStage(4);
      // 先保存，再展示弹窗（防止保存失败）
      try{if(!r.title)throw new Error("生成内容为空");const np=pts-1;setPtsS(np);await setPts(np);var wd={title:r.title,category:r.category,body_text:r.body_text,hashtags:r.hashtags,pages:r.pages,_inputText:text,cover_url:r.cover_url||'',image_urls:r.image_urls||[],cover_prompt:r.cover_prompt||'',image_prompts:r.image_prompts||[],_saveKey:Date.now()};
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
      var newResult={...result,title:d2.title,body_text:d2.body_text,hashtags:d2.hashtags,category:d2.category,pages:d2.pages,_inputText:inp};
      setResult(newResult);
      setGen("result");
      // 保存新文案到 localStorage 和服务端
      (function(){
        try{var _w=JSON.parse(localStorage.getItem("sb-works")||"[]");var si=_w.findIndex(function(x){return x._saveKey===result._saveKey});if(si>=0){_w[si].title=d2.title;_w[si].body_text=d2.body_text;_w[si].hashtags=d2.hashtags;_w[si].category=d2.category;_w[si].pages=d2.pages;_w[si]._inputText=inp;localStorage.setItem("sb-works",JSON.stringify(_w.slice(0,50)));}}catch(_){}
      })();
      // 同步更新 works 列表
      setWorks(function(prev){
        var idx=prev.findIndex(function(x){return x._saveKey===result._saveKey});
        if(idx>=0){var cp=[...prev];cp[idx]={...cp[idx],title:d2.title,body_text:d2.body_text,hashtags:d2.hashtags,category:d2.category,pages:d2.pages,_inputText:inp};return cp;}
        return prev;
      });
      // 同步到服务端 works.json（直接用 fetch 调 API，不走 saveWork 避免 localStorage 重复）
      try{await fetch(API+"/api/save-work",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({work:newResult})});}catch(e){console.warn('textRegen saveWork:',e);}
    }catch(e){alert("重新生成失败");}
    ov.remove();
  };

  /* ═══════ NAV ═══════ */
  const nav=<nav style={{display:"flex",alignItems:"center",justifyContent:"center",padding:"10px 28px",background:"rgba(255,255,255,0.92)",borderBottom:"1px solid #f0f0f0",position:"sticky",top:0,zIndex:100,backdropFilter:"blur(14px)"}}>
    <div style={{maxWidth:1100,width:"100%",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
    <div style={{display:"flex",alignItems:"center",gap:20}}>
      <div style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer"}} onClick={()=>{setPg("home");setMode("content");setGen("idle");setResult(null);setGItem(null);setEcGen("idle");setEcResult(null);}}>
        <img src={I.appicon} alt="薯包AI" style={{width:30,height:30,borderRadius:8}}/>
        <span style={{fontSize:16,fontWeight:800,color:R,fontFamily:"'Microsoft YaHei','PingFang SC','Noto Sans SC',sans-serif",letterSpacing:"1px"}}>薯包AI</span>
      </div>
      <div style={{display:"flex",gap:4}}>
        <button key="content" onClick={()=>{if(pg!=="home")setPg("home");setMode("content");setTimeout(()=>document.getElementById('func-area')?.scrollIntoView({behavior:'smooth'}),100);}} style={{fontSize:13,fontFamily:"'PingFang SC','Microsoft YaHei','Noto Sans SC',sans-serif",color:pg==="home"&&mode==="content"?R:"#777",fontWeight:pg==="home"&&mode==="content"?600:400,background:"none",border:"none",padding:"6px 12px",cursor:"pointer",borderRadius:8,transition:"all 0.15s"}}>小红书图文</button>
        <button key="ecommerce" onClick={()=>{if(pg!=="home")setPg("home");setMode("ecommerce");setTimeout(()=>document.getElementById('func-area')?.scrollIntoView({behavior:'smooth'}),100);}} style={{fontSize:13,fontFamily:"'PingFang SC','Microsoft YaHei','Noto Sans SC',sans-serif",color:pg==="home"&&mode==="ecommerce"?R:"#777",fontWeight:pg==="home"&&mode==="ecommerce"?600:400,background:"none",border:"none",padding:"6px 12px",cursor:"pointer",borderRadius:8,transition:"all 0.15s"}}>电商图生成</button>
        {[["pricing","定价"],["works","我的作品"]].map(([k,v])=><button key={k} onClick={()=>{setPg(k);if(k==="works")loadWorks().then(setWorks);}} style={{fontSize:13,fontFamily:"'PingFang SC','Microsoft YaHei','Noto Sans SC',sans-serif",color:pg===k?R:"#777",fontWeight:pg===k?600:400,background:"none",border:"none",padding:"6px 12px",cursor:"pointer",borderRadius:8,transition:"all 0.15s"}}>{v}</button>)}</div>
    </div>
    <div style={{display:"flex",alignItems:"center",gap:8}}>{logged&&<span style={{fontSize:11,color:R,background:"#FFF1F3",padding:"4px 12px",borderRadius:20,fontWeight:600,display:"flex",alignItems:"center",gap:4}}><Sparkles size={11}/>{pts}套</span>}<Btn small onClick={()=>logged?setLogged(false):setShowLogin(true)} sx={{background:logged?"#F0FFF4":"#f5f5f5",color:logged?G:"#777",border:"none"}}>{logged?<><Check size={12}/>已登录</>:<><LogIn size={12}/>登录</>}</Btn></div>
    </div>
  </nav>;

  const loginModal=showLogin&&<Modal onClose={()=>setShowLogin(false)}><div style={{textAlign:"center",marginBottom:24}}><CharImg src={I.wave} alt="" style={{height:64}}/><div style={{fontSize:20,fontWeight:700,marginTop:8}}>登录薯包AI</div><div style={{fontSize:13,color:"#999"}}>AI 电商商品图 + 小红书内容创作</div></div>
    <input placeholder="手机号" style={{width:"100%",padding:"12px 16px",border:"1.5px solid #eee",borderRadius:12,fontSize:14,marginBottom:10,boxSizing:"border-box",outline:"none"}}/><input placeholder="验证码" style={{width:"100%",padding:"12px 16px",border:"1.5px solid #eee",borderRadius:12,fontSize:14,marginBottom:20,boxSizing:"border-box",outline:"none"}}/><Btn primary full onClick={()=>{setLogged(true);setShowLogin(false);}}><LogIn size={15}/>登录 / 注册</Btn><div style={{textAlign:"center",marginTop:10,fontSize:10,color:"#ddd"}}>登录后可把作品保存到个人作品集</div></Modal>;
  const priceModal=showPrice&&<Modal onClose={()=>setShowPrice(false)}><div style={{textAlign:"center",marginBottom:16}}><CharImg src={I.upgrade} alt="" style={{height:64}} filter="drop-shadow(0 6px 16px rgba(255,71,87,0.15))"/><div style={{fontSize:18,fontWeight:700,marginTop:6}}>选择套餐</div><div style={{fontSize:11,color:"#999"}}>按套购买，不自动续费，两种套餐可选</div></div>
    <div style={{display:"flex",gap:0,marginBottom:14,border:"1px solid #f0f0f0",borderRadius:40,overflow:"hidden",width:"fit-content",margin:"0 auto 14px"}}>
      {["📝 小红书图文","🛍️ 电商图生成"].map((l,i)=><button key={i} onClick={()=>setPriceTab(["content","ecommerce"][i])} style={{padding:"6px 18px",fontSize:12,fontWeight:priceTab===["content","ecommerce"][i]?600:400,color:priceTab===["content","ecommerce"][i]?"#fff":"#666",fontFamily:"inherit",background:priceTab===["content","ecommerce"][i]?R:"#fff",border:"none",cursor:"pointer",transition:"all .15s"}}>{l}</button>)}
    </div>
    <div style={{display:"flex",flexDirection:"column",gap:6}}>{(priceTab==="content"?PRICING_XHS:PRICING_EC).map((p,i)=><div key={i} onClick={()=>{setPtsS(pts+p.sets);setPts(pts+p.sets);setShowPrice(false);}} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 16px",borderRadius:12,border:p.pop?"2px solid "+R:"1px solid #f0f0f0",cursor:"pointer",background:p.pop?"#FFF8F9":"#fff",transition:"all 0.2s"}}>
      <div><div style={{fontSize:13,fontWeight:700}}>{p.name}{p.pop&&<span style={{fontSize:9,color:"#fff",background:R,padding:"2px 6px",borderRadius:4,marginLeft:6}}>推荐</span>}</div>
      <div style={{fontSize:10,color:"#999"}}>{p.sets}套 · 约{p.imgs||"9张/套"} · 单张重生成{p.regen}次/套</div></div>
      <div style={{fontSize:20,fontWeight:800,color:R}}>¥{p.price}</div>
    </div>)}</div></Modal>;

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
    return <NoteModal item={result} onClose={()=>{setGen("idle");setResult(null);scrollPos.current&&setTimeout(()=>window.scrollTo(0,scrollPos.current),50);}} textRegen={textRegen}
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
    <div style={{maxWidth:1060,margin:"0 auto",padding:"48px 28px"}}>
      <h1 style={{fontSize:24,fontWeight:800,textAlign:"center",margin:"0 0 4px",fontFamily:"'Microsoft YaHei','PingFang SC','Noto Sans SC',sans-serif",letterSpacing:"1px",color:"#1a1a1a"}}>薯包出品</h1>
      <p style={{fontSize:13,color:"#999",textAlign:"center",margin:"0 0 32px"}}>以下内容全部由薯包AI一键生成，点击任意作品查看完整图文</p>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:24}}>{GALLERY.map(g=><GCard key={g.id} item={g} onClick={function(){if(g.cover_url){scrollPos.current=window.scrollY;setResult({...g,body_text:g.body,hashtags:g.tags,category:g.cat,_inputText:g.hint,_galleryItem:true});setGen("result");}else{setGItem(g);}}} onSameStyle={function(){setText(g.hint||g.title);setPg("home");window.scrollTo(0,0);}}/>)}</div>
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
  if(pg==="pricing"){const a=[PRICING_XHS,PRICING_EC];const t=["content","ecommerce"];
    return <div style={{minHeight:"100vh",background:BG}}>{nav}
    <div style={{...s.section}}>
      <h1 style={{...s.sectionTitle}}>定价</h1>
      <p style={{...s.sectionSub}}>按套购买，不自动续费。两种套餐按你的需求选</p>
      {/* Tab切换 */}
      <div style={{display:"flex",justifyContent:"center",gap:0,marginBottom:32,border:"1px solid #f0f0f0",borderRadius:60,width:"fit-content",margin:"0 auto 32px",overflow:"hidden"}}>
        {["📝 小红书图文","🛍️ 电商图生成"].map((label,i)=><button key={i} onClick={()=>{setPriceTab(["content","ecommerce"][i]);}} style={{padding:"10px 28px",fontSize:14,fontWeight:priceTab===["content","ecommerce"][i]?600:400,color:priceTab===["content","ecommerce"][i]?"#fff":"#666",fontFamily:"inherit",background:priceTab===["content","ecommerce"][i]?R:"#fff",border:"none",cursor:"pointer",transition:"all .15s"}}>{label}</button>)}
      </div>
      {/* 定价卡 */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12}}>{a[priceTab==="content"?0:1].map((p,i)=><Card key={i} sx={{padding:20,textAlign:"center",border:p.pop?"2px solid "+R:"1px solid #f0f0f0",position:"relative"}}>
        {p.pop&&<div style={{position:"absolute",top:-11,left:"50%",transform:"translateX(-50%)",background:R,color:"#fff",fontSize:10,padding:"3px 14px",borderRadius:10,fontWeight:600}}>推荐</div>}
        <div style={{fontSize:15,fontWeight:700,marginBottom:4}}>{p.name}</div>
        <div style={{fontSize:11,color:"#999",marginBottom:12}}>{p.desc}</div>
        <div style={{fontSize:32,fontWeight:800,color:R,marginBottom:2}}>¥{p.price}</div>
        <div style={{fontSize:12,color:"#bbb",marginBottom:4}}>{p.sets}套</div>
        <div style={{fontSize:11,color:"#ccc",marginBottom:4}}>每套约{p.imgs||"9张配图"} · 约 ¥{p.per}/套</div>
        <div style={{fontSize:11,color:"#ccc",marginBottom:14}}>单张可重生成 {p.regen}次/套</div>
        <Btn primary={p.pop} full small onClick={()=>{if(!logged)setShowLogin(true);else{setPtsS(pts+p.sets);setPts(pts+p.sets);}}}>{p.pop?<><Sparkles size={12}/>立即购买</>:"选择"}</Btn>
      </Card>)}</div>
      <div style={{textAlign:"center",marginTop:20,fontSize:11,color:"#bbb",lineHeight:2}}>
        所有套餐一次性购买，不清零，不限时间<br/>
        {priceTab==="content"?"🌟 小红书图文：输入主题 → AI 生成1篇完整文案 + 9张配图":"🌟 电商图生成：上传商品 → 自动生成白底/场景/详情/组合图"}
      </div>
      {/* FAQ */}
      <div style={{maxWidth:640,margin:"40px auto 0",textAlign:"left"}}>
        <div style={{fontSize:15,fontWeight:700,marginBottom:16,textAlign:"center"}}>❓ 常见问题</div>
        {[
          {q:"每套套餐中的「套」是什么意思？",a:priceTab==="content"?"每次输入一个创作主题，AI 生成完整的 1 篇文案 + 9 张配图，算消耗 1 套。":"每次输入一个商品，AI 按你选的风格生成对应的商品图片，算消耗 1 套。"},
          {q:"AI生成的电商商品图可以直接用吗？",a:"可以。生成的白底主图符合淘宝/京东/亚马逊主图规范，场景图和详情图可直接用于商品详情页和小红书/抖音商品展示。"},
          {q:"生成的图片可以商用吗？",a:"可以。通过薯包AI生成的所有图片，用户拥有完整的商用使用权。"},
          {q:"支持哪些平台？",a:"电商生图支持淘宝、京东、拼多多、小红书电商、抖音电商、亚马逊。内容创作覆盖小红书14大赛道。"},
          {q:"可以退款吗？",a:"未使用的套餐额度可随时申请退款，已消耗的部分按比例扣除。"},
        ].map((faq,i)=><details key={i} style={{borderBottom:"1px solid #f0f0f0",padding:"12px 0",fontSize:13}}>
          <summary style={{fontWeight:600,cursor:"pointer",color:"#555",fontFamily:"inherit"}}>{faq.q}</summary>
          <p style={{margin:"6px 0 0",color:"#999",lineHeight:1.7,fontSize:12}}>{faq.a}</p>
        </details>)}
      </div>
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
      :<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>{works.map((w,i)=><Card key={w.id||i} hover onClick={()=>{scrollPos.current=window.scrollY;setResult(w);setGen("result");}} sx={{padding:16,display:"flex",gap:12,alignItems:"center"}}>
        {w.cover_url?<img src={proxyImg(w.cover_url)} alt="" style={{width:56,height:75,borderRadius:8,objectFit:"cover",flex:"0 0 auto"}}/>:<div style={{width:56,height:75,borderRadius:8,background:"#f5f5f5",flex:"0 0 auto",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20}}>📄</div>}
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:14,fontWeight:600,lineHeight:1.5,marginBottom:4,display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical",overflow:"hidden"}}>{w.title}</div>
          <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:"#ccc"}}><span>{w.category}</span><span>{w.at}</span></div>
          {w.cover_url&&<div style={{fontSize:10,color:"#ddd",marginTop:2}}>{w.image_urls?.length||0}张配图</div>}
        </div>
      </Card>)}</div>}
    </div>{css()}{loginModal}{priceModal}</div>;}

  /* ═══════ HOME PAGE — 展示+功能一体 ═══════ */
  return <div style={{minHeight:"100vh",background:BG}}>{nav}

    {/* ===== 展示区：Hero + 交互Demo ===== */}
    <section style={{maxWidth:1060,margin:"0 auto",padding:"50px 28px 20px",minHeight:"calc(100vh - 64px)",display:"flex",alignItems:"center"}}>
      <div style={{display:"flex",gap:32,alignItems:"center",flexWrap:"wrap",width:"100%"}}>
        {/* 左侧：一键生成演示 */}
        <div style={{flex:"1 1 340px",background:"#fff",borderRadius:20,border:"1px solid #f0f0f0",overflow:"hidden",boxShadow:"0 8px 32px rgba(0,0,0,0.06)"}}>
          <div style={{display:"flex",alignItems:"center",gap:6,padding:"14px 18px",borderBottom:"1px solid #f0f0f0",background:"#fafafa"}}>
            <span style={{width:8,height:8,borderRadius:"50%",background:R,boxShadow:"0 0 6px "+R,animation:"pulse 1.5s infinite"}}/>
            <span style={{fontSize:13,fontWeight:600,color:"#444"}}>⚡ 一键生成演示</span>
            <span style={{fontSize:10,color:"#bbb",marginLeft:"auto"}}>自动轮播中</span>
          </div>
          <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:6,padding:"12px 14px",background:"#f9f9f9",borderBottom:"1px solid #f0f0f0",fontSize:12}}>
            {[{label:"输入一句话",icon:"📝",color:"#555"},{label:"AI 自动生成",icon:"⚡",color:"#555"},{label:"全套输出",icon:"🎉",color:R}].map((s,i)=><div key={i} style={{display:"flex",alignItems:"center",gap:4}}>
              <span style={{fontWeight:600,color:s.color}}>{s.icon} {s.label}</span>
              {i<2&&<span style={{color:"#ddd",margin:"0 4px"}}>→</span>}
            </div>)}
          </div>
          <div style={{padding:16}}>
            <div style={{position:"relative",borderRadius:12,overflow:"hidden",aspectRatio:"3/4",boxShadow:"0 4px 16px rgba(0,0,0,0.08)"}}>
              <img src={proxyImg(demoItems[demoIdx].cover_url)} alt="" style={{width:"100%",height:"100%",objectFit:"cover",display:"block",animation:"fadeIn .4s"}}/>
              <div style={{position:"absolute",bottom:0,left:0,right:0,background:"linear-gradient(transparent 20%,rgba(0,0,0,0.85))",padding:"50px 16px 16px",animation:"fadeIn .5s"}} key={demoIdx}>
                <div style={{fontSize:10,color:"rgba(255,255,255,0.5)",marginBottom:2,textTransform:"uppercase",letterSpacing:"1px"}}>{demoItems[demoIdx].cat}</div>
                <div style={{fontSize:14,fontWeight:700,color:"#fff",lineHeight:1.4}}>{demoItems[demoIdx].title}</div>
              </div>
            </div>
            <div style={{marginTop:12,display:"flex",flexDirection:"column",gap:3,fontSize:11,color:"#999"}}>
              <div>📝 <span style={{color:"#bbb"}}>输入：</span>"<span style={{color:"#666",fontWeight:500}}>{demoItems[demoIdx].hint}</span>"</div>
              <div>🎉 <span style={{color:"#bbb"}}>输出：</span>{demoItems[demoIdx].cat} · 完整文案+9张配图 · 含标题/正文/标签</div>
            </div>
            <div style={{display:"flex",justifyContent:"center",gap:4,marginTop:12}}>
              {demoItems.map((_,i)=><div key={i} onClick={()=>setDemoIdx(i)} style={{width:i===demoIdx?20:6,height:6,borderRadius:3,background:i===demoIdx?R:"#ddd",cursor:"pointer",transition:"all .3s"}}/>)}
            </div>
          </div>
        </div>
        {/* 右侧：文案 */}
        <div style={{flex:"1 1 340px",textAlign:"left"}}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}>
            <img src={I.appicon} style={{width:36,height:36,borderRadius:10,boxShadow:"0 2px 8px rgba(255,71,87,0.15)"}} alt=""/>
            <span style={{fontSize:16,fontWeight:700,color:R}}>薯包AI</span>
          </div>
          <h1 style={{fontSize:34,fontWeight:800,margin:"0 0 10px",lineHeight:1.3,color:"#1a1a1a",fontFamily:"'Microsoft YaHei','PingFang SC','Noto Sans SC',sans-serif",letterSpacing:"1px"}}>
            <span style={{color:R}}>一句话</span>，AI生成全套<br/>
            <b style={{color:R}}>小红书爆款图文</b> ｜ <b style={{color:"#667EEA"}}>电商商品图</b>
          </h1>
          <p style={{fontSize:14,color:"#888",lineHeight:1.9,margin:"0 0 20px"}}>
            输入一句话主题，AI自动识别赛道，生成完整小红书文案+9张精美配图。<br/>
            上传商品照片，AI自动生成白底主图、场景图、详情图、组合图。
          </p>
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            <button onClick={()=>{setMode("content");setTimeout(()=>document.getElementById('func-area')?.scrollIntoView({behavior:'smooth'}),50);}} style={{padding:"13px 28px",border:"none",borderRadius:60,fontSize:15,fontWeight:600,cursor:"pointer",fontFamily:"inherit",background:"linear-gradient(135deg,#FF4757,#FF6B81)",color:"#fff",boxShadow:"0 4px 20px rgba(255,71,87,0.25)",textAlign:"center",width:"fit-content"}}>✍️ 一句话生成小红书 →</button>
            <button onClick={()=>{setMode("ecommerce");setTimeout(()=>document.getElementById('func-area')?.scrollIntoView({behavior:'smooth'}),50);}} style={{padding:"13px 28px",border:"1.5px solid #667EEA",borderRadius:60,fontSize:15,fontWeight:600,cursor:"pointer",fontFamily:"inherit",background:"transparent",color:"#667EEA",textAlign:"center",width:"fit-content"}}>🛒 一句话生成商品图 →</button>
          </div>
          <div style={{display:"flex",gap:20,marginTop:18,fontSize:12,color:"#bbb"}}>
            <span>📝 自动写文案+9张图</span>
            <span>🛍️ 白底/场景/详情/组合</span>
            <span>⚡ 15秒出图</span>
            <span>🎯 适配6大平台</span>
          </div>
        </div>
      </div>
    </section>

    {/* ===== 功能区：Tab + 表单 ===== */}
    <div id="func-area" style={{background:"#fff",borderTop:"1px solid #f0f0f0",marginTop:20,boxShadow:"0 -4px 20px rgba(0,0,0,0.03)"}}>
      {/* Tab 栏 */}
      <div style={{display:"flex",justifyContent:"center",background:BG}}>
        <div style={{display:"flex",maxWidth:820,width:"100%",borderBottom:"2px solid #f0f0f0"}}>
          {[{key:"content",label:"📝 小红书图文",sub:"一句话生成全套图文"},{key:"ecommerce",label:"🛍️ 电商图生成",sub:"一句话生成商品主图+详情"}].map(t=>
            <button key={t.key} onClick={()=>setMode(t.key)} style={{flex:1,padding:"16px 0",fontSize:15,fontWeight:mode===t.key?600:400,color:mode===t.key?"#333":"#999",fontFamily:"inherit",background:"none",border:"none",borderBottom:mode===t.key?"2px solid "+R:"2px solid transparent",cursor:"pointer",transition:"all .15s",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
              <span>{t.label}</span>
              <span style={{fontSize:10,color:mode===t.key?"#bbb":"#ddd"}}>{t.sub}</span>
            </button>
          )}
        </div>
      </div>
    {mode==="content"?<div style={{background:BG}}>
      <section style={{maxWidth:820,margin:"0 auto",padding:"30px 28px 10px",textAlign:"left"}}>
        <p style={{fontSize:12,color:"#999",margin:"0 0 14px",padding:"0 2px"}}>📝 输入一句话主题 → AI 自动生成完整文案 + 9张精美配图，覆盖14大赛道</p>
        <div style={{borderRadius:16,background:"#fff",padding:22,border:"1px solid #f0f0f0"}}>
          <textarea value={text} onChange={e=>setText(e.target.value)} placeholder={"输入你想创作的主题，一句话就够了\n📍厦门3天2夜旅游攻略、🎧百元蓝牙耳机测评..."} style={{width:"100%",minHeight:110,padding:14,border:"2px solid #f0f0f0",borderRadius:12,fontSize:14,lineHeight:1.8,fontFamily:"inherit",resize:"vertical",boxSizing:"border-box",outline:"none",transition:"border-color 0.2s"}} onFocus={e=>e.target.style.borderColor=R2} onBlur={e=>e.target.style.borderColor="#f0f0f0"}/>
          <div style={{display:"flex",gap:10,alignItems:"center",marginTop:10,flexWrap:"wrap"}}>
            {refImages.map(function(src,i){return <div key={i} style={{position:"relative",width:56,height:56,borderRadius:10,overflow:"hidden",border:"2px solid #eee",flex:"0 0 auto"}}>
              <img src={src} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>
              <div onClick={function(){setRefImages(function(p){var c=[...p];c.splice(i,1);return c;});}} style={{position:"absolute",top:-6,right:-6,width:18,height:18,borderRadius:"50%",background:"#ff4757",color:"#fff",fontSize:11,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",border:"2px solid #fff",lineHeight:1,fontWeight:700}}>×</div>
            </div>;})}
            {refImages.length<3?<div onClick={function(){fileInputRef.current?.click();}} style={{width:56,height:56,borderRadius:10,border:"1.5px dashed #ddd",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,color:"#ccc",cursor:"pointer",flex:"0 0 auto",transition:"border-color 0.2s"}} onMouseEnter={function(e){e.currentTarget.style.borderColor=R2;}} onMouseLeave={function(e){e.currentTarget.style.borderColor="#ddd";}}>+</div>:null}
            <input ref={fileInputRef} type="file" accept="image/*" multiple style={{display:"none"}} onChange={function(e){var files=e.target.files;if(!files||!files.length)return;Array.from(files).slice(0,3-refImages.length).forEach(function(f){var reader=new FileReader();reader.onload=function(ev){setRefImages(function(p){if(p.length>=3)return p;return[...p,ev.target.result];});};reader.readAsDataURL(f);});e.target.value='';}}/>
            <span style={{fontSize:10,color:"#ccc"}}>参考图 (最多3张{refImages.length>0?' · '+refImages.length+'/3':''})</span>
          </div>
          <div style={{margin:"12px 0 14px"}}>
            <div style={{fontSize:11,color:"#999",marginBottom:6}}>热门主题</div>
            <div style={{display:"flex",alignItems:"center",gap:4}}>
              <button onClick={()=>setCarouselIdx(i=>(i-1+QUICK_HINTS.length)%QUICK_HINTS.length)} style={{flex:"0 0 auto",background:"none",border:"none",fontSize:18,color:"#aaa",cursor:"pointer",padding:"4px 2px"}}>{String.fromCharCode(8249)}</button>
              <div style={{flex:1,overflow:"hidden",borderRadius:10,background:"#f5f5f5",border:"1px solid #eee"}}>
                <div style={{textAlign:"center",padding:"8px 0"}}>
                  <button onClick={()=>setText(QUICK_HINTS[carouselIdx])} style={{fontSize:14,color:"#555",background:"none",border:"none",cursor:"pointer",fontFamily:"inherit"}}>{QUICK_HINTS[carouselIdx]}</button>
                </div>
              </div>
              <button onClick={()=>setCarouselIdx(i=>(i+1)%QUICK_HINTS.length)} style={{flex:"0 0 auto",background:"none",border:"none",fontSize:18,color:"#aaa",cursor:"pointer",padding:"4px 2px"}}>{String.fromCharCode(8250)}</button>
            </div>
            <div style={{display:"flex",justifyContent:"center",gap:3,marginTop:6}}>{QUICK_HINTS.map(function(_,i){return <div key={i} style={{width:i===carouselIdx?16:4,height:3,borderRadius:2,background:i===carouselIdx?"#888":"#ddd",transition:"all .3s"}}/>})}</div>
          </div>
          {err&&<div style={{background:"#FFF5F5",border:"1px solid #FED7D7",borderRadius:10,padding:"10px 14px",marginBottom:12,fontSize:12,color:"#C53030"}}>{err}</div>}
          <button onClick={doGen} disabled={!text.trim()} style={{width:"100%",padding:"13px 0",border:"none",borderRadius:14,fontSize:15,fontWeight:600,cursor:!text.trim()?"not-allowed":"pointer",fontFamily:"inherit",background:!text.trim()?"#f0f0f0":R,color:"#fff",transition:"all .2s",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}><Sparkles size={16}/> 一键生成爆款图文</button>
          <div style={{textAlign:"center",fontSize:11,color:"#bbb",marginTop:8}}>{logged?`剩余 ${pts} 套额度`:"登录后可购买套餐开始创作"}</div>
        </div>
      </section>
      <section style={{maxWidth:1060,margin:"0 auto",padding:"36px 28px 20px"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",marginBottom:16}}>
          <div><h2 style={{fontSize:21,fontWeight:800,margin:"0 0 2px",display:"flex",alignItems:"center",gap:8,fontFamily:"'Microsoft YaHei','PingFang SC','Noto Sans SC',sans-serif",color:"#1a1a1a"}}><img src={I.appicon} style={{width:22,height:22,borderRadius:6}} alt=""/>薯包出品</h2><p style={{fontSize:11,color:"#999",margin:0}}>点击查看完整图文</p></div>
          <button onClick={()=>setPg("gallery")} style={{fontSize:12,color:R,fontFamily:"inherit",background:"none",border:"1px solid "+R,borderRadius:8,padding:"6px 14px",cursor:"pointer"}}>更多作品 <ChevronRight size={12}/></button>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:20}}>{GALLERY.slice(0,8).map(g=><div key={g.id} onClick={function(){if(g.cover_url){window.scrollY;setResult({...g,body_text:g.body,hashtags:g.tags,category:g.cat,_inputText:g.hint,_galleryItem:true});setGen("result");}}} style={{borderRadius:12,overflow:"hidden",cursor:"pointer",background:"#fff",boxShadow:"0 2px 10px rgba(0,0,0,.04)",border:"1px solid #f0f0f0",transition:"all .2s"}} onMouseEnter={e=>{e.currentTarget.style.boxShadow='0 4px 16px rgba(0,0,0,.08)';e.currentTarget.style.transform='translateY(-2px)';}} onMouseLeave={e=>{e.currentTarget.style.boxShadow='0 2px 10px rgba(0,0,0,.04)';e.currentTarget.style.transform='none';}}>
          {g.cover_url?<img src={proxyImg(g.cover_url)} alt="" style={{width:"100%",aspectRatio:"3/4",objectFit:"cover",display:"block"}} loading="lazy"/>:<div style={{height:130,background:g.grad||"#f5f5f5"}}/>}
          <div style={{padding:"8px 12px 10px"}}>
            <div style={{fontSize:10,color:"#999",marginBottom:2}}>{g.cat}</div>
            <div style={{fontSize:12.5,fontWeight:600,lineHeight:1.4,display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical",overflow:"hidden",color:"#333"}}>{g.title}</div>
          </div>
        </div>)}</div>
      </section>
      <section style={{maxWidth:1060,margin:"0 auto",padding:"20px 28px 40px"}}>
        <h2 style={{fontSize:21,fontWeight:800,textAlign:"center",margin:"0 0 4px",fontFamily:"'Microsoft YaHei','PingFang SC','Noto Sans SC',sans-serif"}}>为什么用薯包AI</h2>
        <p style={{fontSize:12,color:"#999",textAlign:"center",margin:"0 0 20px"}}>一句话生成全套小红书图文，3分钟搞定可直接发布的完整内容</p>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12}}>{FEATURES.map((f,i)=>{const Icon=f.icon;return<div key={i} style={{borderRadius:14,background:"#fff",padding:18,border:"1px solid #f0f0f0"}}>
          <div style={{width:34,height:34,borderRadius:10,background:"#FFF1F3",display:"flex",alignItems:"center",justifyContent:"center",marginBottom:10}}><Icon size={17} color={R}/></div>
          <div style={{fontSize:13.5,fontWeight:700,marginBottom:4}}>{f.title}</div>
          <div style={{fontSize:11,color:"#999",lineHeight:1.6}}>{f.desc}</div>
        </div>;})}</div>
      </section>
      <section style={{textAlign:"center",padding:"16px 20px 30px"}}>
        <CharImg src={I.excited} alt="" style={{height:50}} filter="drop-shadow(0 4px 12px rgba(255,71,87,0.12))" margin="0 0 10px"/>
        <h2 style={{fontSize:20,fontWeight:700,margin:"0 0 4px"}}>准备好了吗？一句话试试</h2>
        <p style={{fontSize:12,color:"#999",margin:"0 0 14px"}}>{logged?"还有更多次数，继续创作":"登录后购买套餐即可开始创作"}</p>
        <button onClick={()=>{if(!logged)setShowLogin(true);else window.scrollTo({top:0,behavior:"smooth"});}} style={{padding:"12px 30px",border:"none",borderRadius:60,fontSize:14,fontWeight:600,cursor:"pointer",fontFamily:"inherit",background:"linear-gradient(135deg,#FF4757,#FF6B81)",color:"#fff",boxShadow:"0 4px 16px rgba(255,71,87,.2)"}}><Sparkles size={15}/> {logged?"立即创作":"登录开始创作"}</button>
      </section>
      <footer style={{padding:"24px 20px",background:"#f9f9f9",borderTop:"1px solid #f0f0f0"}}>
        <div style={{maxWidth:800,margin:"0 auto",textAlign:"center"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:6,marginBottom:6}}><img src={I.appicon} style={{width:18,height:18,borderRadius:4}} alt=""/><span style={{fontSize:12,fontWeight:700}}>薯包AI</span></div>
          <p style={{fontSize:10,color:"#999",margin:"0 0 6px"}}>小红书爆款图文 + AI 电商商品图生成</p>
          <div style={{fontSize:9,color:"#ddd",display:"flex",gap:14,justifyContent:"center"}}><span style={{cursor:"pointer"}} onClick={()=>setMode("content")}>小红书图文</span><span style={{cursor:"pointer"}} onClick={()=>setMode("ecommerce")}>电商图生成</span><span style={{cursor:"pointer"}} onClick={()=>setPg("pricing")}>定价</span><span style={{cursor:"pointer"}} onClick={()=>setPg("works")}>我的作品</span></div>
          <div style={{fontSize:8,color:"#e0e0e0",marginTop:8}}>© 2026 薯包AI</div>
        </div>
      </footer>
    </div>
    :<div style={{minHeight:"calc(100vh - 108px)",background:BG,padding:"30px 28px"}}>
      <div style={{maxWidth:820,margin:"0 auto"}}>
        <div style={{textAlign:"center",marginBottom:24}}>
          <h1 style={{fontSize:26,fontWeight:800,margin:"0 0 6px",fontFamily:"'Microsoft YaHei','PingFang SC','Noto Sans SC',sans-serif",letterSpacing:"1px",color:"#333"}}>🛍️ 电商图生成</h1>
          <p style={{fontSize:13,color:"#888",margin:0}}>上传商品图 → AI自动生成白底主图 · 场景图 · 详情页 · 组合图</p>
        </div>
        {ecGen==="loading"?<div style={{textAlign:"center",padding:"60px 0"}}>
          <div style={{width:44,height:44,border:"4px solid #f0f0f0",borderTopColor:R,borderRadius:"50%",animation:"spin .8s linear infinite",margin:"0 auto 18px"}}/>
          <div style={{fontSize:15,fontWeight:600,marginBottom:4}}>正在生成...</div>
          <div style={{fontSize:12,color:"#888"}}>电商图片生成中（约15-30秒/张）</div>
          <div style={{marginTop:14,display:"flex",justifyContent:"center",gap:8}}>{ecStyles.map(s=><span key={s} style={{fontSize:11,padding:"4px 12px",background:"#f5f5f5",borderRadius:8}}>{s}</span>)}</div>
        </div>
        : ecGen==="result"&&ecResult?<div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
            <div><span style={{fontSize:12,color:"#888"}}>商品：</span><span style={{fontSize:14,fontWeight:600}}>{ecResult.product_name}</span><span style={{fontSize:11,color:"#999",marginLeft:8}}>{ecResult.platform} · {ecResult.category}</span></div>
            <button onClick={()=>{setEcGen("idle");setEcResult(null);}} style={{background:"#f5f5f5",border:"none",borderRadius:10,padding:"7px 14px",fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>重新生成</button>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:14}}>
            {Object.entries(ecResult.images||{}).map(([style,url])=>(
              <div key={style} style={{background:"#fff",borderRadius:14,overflow:"hidden",boxShadow:"0 2px 10px rgba(0,0,0,0.06)"}}>
                <div style={{background:"#f9f9f9",padding:"8px 14px",borderBottom:"1px solid #f0f0f0",fontSize:13,fontWeight:600,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                  <span>{style==="白底主图"?"⬜":style==="场景图"?"🌄":style==="详情图"?"📋":"🖼️"} {style}</span>
                  <a href={proxyImg(url)} onClick={function(e){e.preventDefault();fetch(proxyImg(url)).then(function(r){return r.blob();}).then(function(blob){var a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=ecName+"-"+style+".png";a.click();});}} style={{fontSize:11,color:R,textDecoration:"none",cursor:"pointer"}}>⬇ 下载</a>
                </div>
                <img src={proxyImg(url)} alt={style} style={{width:"100%",display:"block",aspectRatio:"1/1",objectFit:"cover"}} loading="lazy"/>
              </div>
            ))}
          </div>
          {ecResult.errors&&ecResult.errors.length>0&&<div style={{marginTop:14,background:"#FFF5F5",borderRadius:10,padding:"10px 14px",fontSize:11,color:"#C53030"}}>{ecResult.errors.map(function(e,i){return <div key={i}>⚠️ {e.style} 失败: {e.error}</div>})}</div>}
        </div>
        :<div style={{borderRadius:18,background:"#fff",padding:24,boxShadow:"0 2px 16px rgba(0,0,0,.04)"}}>
          {ecErr&&<div style={{background:"#FFF5F5",border:"1px solid #FED7D7",borderRadius:10,padding:"10px 14px",marginBottom:14,fontSize:11,color:"#C53030"}}>{ecErr}</div>}
          <div style={{marginBottom:16}}><label style={{fontSize:11,fontWeight:600,color:"#555",marginBottom:4,display:"block"}}>商品名称 *</label>
            <input value={ecName} onChange={e=>setEcName(e.target.value)} placeholder="例如：高保湿精华液、无线蓝牙耳机、纯棉T恤..." style={{width:"100%",padding:"11px 14px",border:"2px solid #f0f0f0",borderRadius:11,fontSize:13,fontFamily:"inherit",outline:"none",boxSizing:"border-box"}} onFocus={e=>e.target.style.borderColor=R2} onBlur={e=>e.target.style.borderColor="#f0f0f0"}/>
          </div>
          <div style={{marginBottom:16}}><label style={{fontSize:11,fontWeight:600,color:"#555",marginBottom:4,display:"block"}}>品类</label>
            <div style={{display:"flex",flexWrap:"wrap",gap:5}}>{EC_CATS.map(c=><button key={c} onClick={()=>setEcCat(c)} style={{padding:"6px 14px",borderRadius:9,border:"none",fontSize:12,cursor:"pointer",fontFamily:"inherit",background:ecCat===c?R:"#f5f5f5",color:ecCat===c?"#fff":"#555",fontWeight:ecCat===c?600:400,transition:"all .15s"}}>{c}</button>)}</div>
          </div>
          <div style={{marginBottom:16}}><label style={{fontSize:11,fontWeight:600,color:"#555",marginBottom:4,display:"block"}}>商品参考图（可选，最多5张）</label>
            <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
              {ecRefImgs.map(function(src,i){return <div key={i} style={{position:"relative",width:60,height:60,borderRadius:9,overflow:"hidden",border:"2px solid #eee",flex:"0 0 auto"}}>
                <img src={src} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>
                <div onClick={function(){setEcRefImgs(function(p){var c=[...p];c.splice(i,1);return c;});}} style={{position:"absolute",top:-5,right:-5,width:16,height:16,borderRadius:"50%",background:"#ff4757",color:"#fff",fontSize:10,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",border:"2px solid #fff",lineHeight:1,fontWeight:700}}>×</div>
              </div>;})}
              {ecRefImgs.length<5?<div onClick={function(){ecFileRef.current?.click();}} style={{width:60,height:60,borderRadius:9,border:"2px dashed #ddd",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,color:"#ccc",cursor:"pointer",flex:"0 0 auto"}} onMouseEnter={function(e){e.currentTarget.style.borderColor=R2;}} onMouseLeave={function(e){e.currentTarget.style.borderColor="#ddd";}}>+</div>:null}
              <input ref={ecFileRef} type="file" accept="image/*" multiple style={{display:"none"}} onChange={function(e){var files=e.target.files;if(!files||!files.length)return;Array.from(files).slice(0,5-ecRefImgs.length).forEach(function(f){var reader=new FileReader();reader.onload=function(ev){setEcRefImgs(function(p){if(p.length>=5)return p;return[...p,ev.target.result];});};reader.readAsDataURL(f);});e.target.value='';}}/>
            </div>
          </div>
          <div style={{marginBottom:16}}><label style={{fontSize:11,fontWeight:600,color:"#555",marginBottom:4,display:"block"}}>生成风格（可多选）</label>
            <div style={{display:"flex",flexWrap:"wrap",gap:5}}>{EC_ALL_STYLES.map(s=><button key={s} onClick={()=>{setEcStyles(function(p){return p.includes(s)?p.filter(x=>x!==s):[...p,s];});}} style={{padding:"6px 14px",borderRadius:9,border:ecStyles.includes(s)?"2px solid "+R:"1px solid #e0e0e0",fontSize:12,cursor:"pointer",fontFamily:"inherit",background:ecStyles.includes(s)?"#FFF8F9":"#fff",color:ecStyles.includes(s)?R:"#555",fontWeight:ecStyles.includes(s)?600:400,transition:"all .15s"}}>{s}{ecStyles.includes(s)?" ✓":""}</button>)}</div>
          </div>
          <div style={{marginBottom:16}}><label style={{fontSize:11,fontWeight:600,color:"#555",marginBottom:4,display:"block"}}>目标平台</label>
            <div style={{display:"flex",flexWrap:"wrap",gap:5}}>{EC_PLATS.map(p=><button key={p} onClick={()=>setEcPlat(p)} style={{padding:"6px 14px",borderRadius:9,border:"none",fontSize:12,cursor:"pointer",fontFamily:"inherit",background:ecPlat===p?R:"#f5f5f5",color:ecPlat===p?"#fff":"#555",fontWeight:ecPlat===p?600:400,transition:"all .15s"}}>{p}</button>)}</div>
            <div style={{fontSize:10,color:"#bbb",marginTop:3}}>{EC_PLAT_DESC[ecPlat]||ecPlat} · 按平台规范适配图片尺寸</div>
          </div>
          <div style={{marginBottom:18}}><label style={{fontSize:11,fontWeight:600,color:"#555",marginBottom:4,display:"block"}}>卖点文案（可选）</label>
            <textarea value={ecPoints} onChange={e=>setEcPoints(e.target.value)} placeholder="例如：高保湿、24小时持久、敏感肌适用、99%纯度烟酰胺..." style={{width:"100%",minHeight:50,padding:11,border:"2px solid #f0f0f0",borderRadius:11,fontSize:12,fontFamily:"inherit",resize:"vertical",boxSizing:"border-box",outline:"none"}} onFocus={e=>e.target.style.borderColor=R2} onBlur={e=>e.target.style.borderColor="#f0f0f0"}/>
          </div>
          <button onClick={doECGen} disabled={!ecName.trim()} style={{width:"100%",padding:"12px 0",border:"none",borderRadius:13,fontSize:14,fontWeight:600,cursor:!ecName.trim()?"not-allowed":"pointer",fontFamily:"inherit",background:!ecName.trim()?"#f0f0f0":R,color:"#fff",transition:"all .2s"}}>🛍️ 生成电商图片</button>
          <div style={{marginTop:14,background:"#FFF8F6",borderRadius:10,padding:"12px 16px",fontSize:10,color:"#999",lineHeight:1.7}}>
            · GPT Image 2 生成，支持多参考图高保真合成<br/>
            · 不同平台自动适配对应尺寸<br/>
            · 上传商品图效果更好，建议3-5张不同角度实拍
          </div>
        </div>
      }
      </div>
    </div>
    }
    </div>

  {css()}{loginModal}{priceModal}</div>;
}
