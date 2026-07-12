/**
 * 薯包AI · 精修工坊 — Premium redesign
 * Professional EC image generation studio
 */
import React, { useState, useRef, useEffect } from 'react';
import { Upload, X, Eye, Sparkle, Package, Camera, Image, Palette, Gear, Download } from '@phosphor-icons/react';
import { useApp } from '../../store/AppContext';
import { proxyImg, generateEcommerce, generateEcommercePreview, saveWork } from '../../services/api';
import { EC_CATS, EC_PLATFORM_DIMS, EC_IMG_RATIOS, EC_MAIN_TYPES, EC_ADV_TYPES, EC_STYLE_PACKS } from '../../constants/data';
import { IMAGES } from '../../constants/images';
import { CharImg } from '../../components/ui/index';
import Footer from '../../components/layout/Footer';

// ── Platform dimension map (共享常量) ──
const DIMS = Object.fromEntries(
  Object.entries(EC_PLATFORM_DIMS).map(([p, v]) => [p, { 1: v['1:1'], 3: v['3:4'] }])
);
const RATIOS = Object.fromEntries(
  Object.entries(EC_IMG_RATIOS).map(([k, v]) => [k, v.split(':')[0]])
);
const dim=(p,k)=>{const r=DIMS[p]?.[RATIOS[k]||'1']||[800,800];return{w:r[0],h:r[1]};};

const TYPES={
  main: EC_MAIN_TYPES.map(t => ({ k:t.key, l:t.label, e:t.emoji, m:t.maxCount, d:t.mandatory, desc:t.desc })),
  adv: EC_ADV_TYPES.map(t => ({ k:t.key, l:t.label, e:t.emoji, m:t.maxCount })),
};
const allT=[...TYPES.main,...TYPES.adv];
const tLbl=(k)=>allT.find(t=>t.k===k)?.l||k;
const bk=(k)=>k.replace(/_\d+$/,'');

const STYLES=EC_STYLE_PACKS.map(s=>({k:s.key,l:s.label,s:s.subtitle,des:s.desc,img:s.img,ar:s.ar}));

const parsePts=(s)=>s.split(/[,;，；\n]+/).map(t=>t.trim()).filter(Boolean);

// ── Design tokens for consistency ──
const SX = {
  card: { background:'#fff', borderRadius:12, border:'1px solid #E0E0E6', padding:'28px 32px' },
  label: { fontSize:14, fontWeight:600, color:'#2D2D3A', marginBottom:8, display:'block' },
  input: { width:'100%', padding:'11px 14px', border:'1.5px solid #D0D0D8', borderRadius:8, fontSize:14, fontFamily:'inherit', outline:'none', boxSizing:'border-box', background:'#fff', transition:'border-color .15s', color:'#2D2D3A' },
  h3: { fontSize:16, fontWeight:600, color:'#2D2D3A', marginBottom:4, display:'flex', alignItems:'center', gap:8 },
  hint: { fontSize:13, color:'#666', lineHeight:1.7 },
};

export default function EcStudioPage() {
  const {state,dispatch}=useApp();
  const [name,setName]=useState('');
  const [cat,setCat]=useState('');
  const [plat,setPlat]=useState('淘宝');
  const [pts,setPts]=useState('');
  const [mat,setMat]=useState('');
  const [tgt,setTgt]=useState('');
  const [restr,setRestr]=useState('');
  const [refs,setRefs]=useState([]);
  const [pack,setPack]=useState('');
  const [sel,setSel]=useState([
    {k:'white_bg',c:2,w:800,h:800},{k:'detail',c:1,w:750,h:1000},
    {k:'scene',c:1,w:750,h:1000},{k:'composite',c:1,w:750,h:1000},
  ]);
  const [showPlugin,setShowPlugin]=useState(false);
  const [showRef,setShowRef]=useState(false);
  const fRef=useRef(null);
  const [phase,setPhase]=useState('config');
  const [ol,setOl]=useState([]);
  const [olLoad,setOlLoad]=useState(false);
  const [res,setRes]=useState(null);
  const [err,setErr]=useState('');
  const [lb,setLb]=useState(null);
  const [regKey,setRegKey]=useState('');
  const [regEdit,setRegEdit]=useState({l:null,p:'',v:false});
  const [plb,setPlb]=useState(null);
  const total=sel.reduce((s,i)=>s+(i.c||0),0);

  const prevPack=useRef(pack);
  useEffect(()=>{
    const ps=parsePts(pts),pc=ps.length,r=[],d=(k)=>{const g=dim(plat,k);return{w:g.w,h:g.h}};
    switch(pack){
      case'scene_selling':r.push({k:'scene',c:2,...d('scene')},{k:'white_bg',c:1,...d('white_bg')},{k:'detail',c:Math.max(pc||1,1),...d('detail')},{k:'composite',c:1,...d('composite')});break;
      case'detail_selling':r.push({k:'white_bg',c:1,...d('white_bg')},{k:'detail',c:Math.max(pc||2,2),...d('detail')},{k:'scene',c:1,...d('scene')},{k:'composite',c:1,...d('composite')});break;
      case'ugc_trust':r.push({k:'scene',c:2,...d('scene')},{k:'white_bg',c:1,...d('white_bg')},{k:'detail',c:Math.max(pc||1,1),...d('detail')},{k:'composite',c:1,...d('composite')});break;
      case'brand_unified':r.push({k:'white_bg',c:1,...d('white_bg')},{k:'scene',c:1,...d('scene')},{k:'composite',c:1,...d('composite')},{k:'detail',c:Math.max(pc||1,1),...d('detail')},{k:'main_text',c:1,...d('main_text')});break;
      case'promo_sale':r.push({k:'main_text',c:1,...d('main_text')},{k:'white_bg',c:1,...d('white_bg')},{k:'detail',c:Math.max(pc||2,2),...d('detail')},{k:'scene',c:1,...d('scene')});break;
      default:r.push({k:'white_bg',c:2,...d('white_bg')},{k:'detail',c:Math.max(pc||1,1),...d('detail')},{k:'scene',c:1,...d('scene')},{k:'composite',c:1,...d('composite')});break;
    }
    if(prevPack.current!==pack){prevPack.current=pack;setSel([...r]);}
  },[pts,pack,plat]);

  const addImg=(files,s,cur,max)=>{Array.from(files).slice(0,max-cur.length).forEach(f=>{const r=new FileReader();r.onload=e=>s(p=>p.length>=max?p:[...p,e.target.result]);r.readAsDataURL(f);});};
  const upd=(k,delta)=>{const t=allT.find(x=>x.k===k);if(!t)return;setSel(p=>{const ex=p.find(x=>x.k===k);const nc=(ex?.c||0)+delta;if(ex&&nc<=0&&!t.d)return p.filter(x=>x.k!==k);const c=Math.max(t.d?1:0,Math.min(nc,t.m));if(ex)return p.map(x=>x.k===k?{...x,c:c}:x);const d=dim(plat,k);return[...p,{k,c:c,w:d.w,h:d.h}];});};
  const updDim=(k,dimK,v)=>{const n=Math.max(100,Math.min(9999,parseInt(v)||0));setSel(p=>p.map(s=>s.k===k?{...s,[dimK]:n}:s));};
  const goPreview=async()=>{if(!name.trim())return;setOlLoad(true);setErr('');try{const d=await generateEcommercePreview({productName:name.trim(),category:cat,points:pts.trim(),refCount:refs.length,hasMaterial:!!mat,stylePack:pack||null,imageSelections:sel});const o=(d.outline||[]).map((i,idx)=>({...i,userPrompt:i.outlineText||'',refImageIndex:refs.length>0?(idx%refs.length):-1}));setOl(o);setPhase('preview');}catch(e){setErr('预览失败: '+(e.message||''));}setOlLoad(false);};
  const goGen=async()=>{if(!name.trim())return;setErr('');dispatch({ type: 'START_GEN' });dispatch({ type: 'SET_STAGE', stage: 1 });setPhase('result');try{
    dispatch({ type: 'SET_STAGE', stage: 2 });const d=await generateEcommerce({productName:name,category:cat,refImgs:refs,imageSelections:sel,platform:plat,points:pts,beautyReport:!!sel.find(s=>s.k==='beauty_report'),stylePack:pack||null,material:mat,restrictions:restr,imageSize:null});dispatch({ type: 'CLOSE_RESULT' });setRes(d);saveWork({...d,_ecResult:true,_saveKey:'ec-'+Date.now(),product_name:name,category:cat,platform:plat,at:new Date().toLocaleDateString('zh-CN'),images:d.images||{}});}catch(e){dispatch({ type: 'CLOSE_RESULT' });setErr(e.message||'生成失败');setPhase('config');}};
  const goRegen=async(l,p)=>{if(regKey)return;setRegKey(l);try{const{regenerateImage}=await import('../../services/api');const pp=p||ol.find(o=>o.key===bk(l)||o.label===l)?.userPrompt||'';const url=await regenerateImage(pp,cat);if(url)setRes(prev=>prev?{...prev,images:{...prev.images,[l]:url}}:prev);}catch(e){alert('重生成失败: '+(e.message||''));}setRegKey('');setRegEdit({l:null,p:'',v:false});};

  return (
    <div style={{minHeight:'100vh',background:'#F6F7F9'}}>
      <div style={{maxWidth:'var(--max-width-narrow)',margin:'0 auto',padding:'32px 24px 80px'}}>
        {/* ── Header ── */}
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:32}}>
          <div style={{display:'flex',alignItems:'center',gap:10,cursor:'pointer'}} onClick={()=>dispatch({type:'NAVIGATE',page:'home'})}>
            <CharImg src={IMAGES.appicon} size={32} float />
            <span style={{fontSize:18,fontWeight:650,color:'#E53E3E'}}>薯包AI</span>
            <span style={{fontSize:12,color:'#6366F1',background:'#EEF2FF',padding:'3px 10px',borderRadius:6,fontWeight:500}}>精修工坊</span>
          </div>
          <button onClick={()=>{dispatch({type:'NAVIGATE',page:'home'});dispatch({type:'SET_MODE',mode:'ecommerce'});}}
            style={{fontSize:13,color:'#6366F1',background:'#EEF2FF',border:'1px solid #C7D2FE',borderRadius:8,padding:'8px 16px',cursor:'pointer',fontFamily:'inherit',display:'flex',alignItems:'center',gap:6,whiteSpace:'nowrap',fontWeight:500,transition:'background .15s'}}
            onMouseEnter={e=>e.currentTarget.style.background='#C7D2FE'} onMouseLeave={e=>e.currentTarget.style.background='#EEF2FF'}>
            <Sparkle weight="fill" size={14}/> 一键出图
          </button>
        </div>

        {err&&<div style={{background:'#FFF5F5',border:'1px solid #FED7D7',borderRadius:8,padding:'12px 16px',marginBottom:20,fontSize:14,color:'#C53030',lineHeight:1.5}}>{err}</div>}

        {/* ═══════ CONFIG ═══════ */}
        {phase==='config'&&<div style={{display:'flex',flexDirection:'column',gap:16}}>
          {/* ── ① Plugin Import ── */}
          <div style={SX.card}>
            <div style={{display:'flex',gap:16,alignItems:'flex-start'}}>
              <div style={{width:52,height:52,borderRadius:12,background:'linear-gradient(135deg,#EEF2FF,#E0E7FF)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,color:'#4338CA'}}><Package weight="fill" size={26}/></div>
              <div style={{flex:1}}>
                <h3 style={SX.h3}>🔄 一键复刻爆款商品图</h3>
                <p style={{...SX.hint,marginBottom:16}}>看到别人的商品图好看又卖得好？装插件 → 去爆款商品页点一下 → 自动抓取商品名称、多张商品图、卖点文案。<strong>然后直接用薯包AI生成你自己商品的同款风格图片</strong>。不用自己找参考图、不用想文案，照着爆款复刻。</p>
                <div style={{display:'flex',alignItems:'center',gap:12,flexWrap:'wrap'}}>
                  <button onClick={()=>setShowPlugin(true)} style={{padding:'9px 20px',borderRadius:8,background:'#4338CA',color:'#fff',border:'none',fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'inherit',display:'inline-flex',alignItems:'center',gap:6,boxShadow:'0 2px 8px rgba(67,56,202,.2)'}}>
                    📥 下载插件
                  </button>
                  <span style={{fontSize:12,color:'#aaa'}}>470KB · Chrome/Edge · 装一次永久用</span>
                </div>
              </div>
            </div>
            <div style={{display:'flex',gap:8,marginTop:16,flexWrap:'wrap'}}>
              {['抓取爆款商品名称','抓取多张商品图','提取卖点与价格','复刻同款视觉风格'].map(t=>(
                <span key={t} style={{fontSize:12,color:'#166534',background:'#F0FDF4',padding:'4px 10px',borderRadius:6,fontWeight:500}}>✅ {t}</span>
              ))}
            </div>
          </div>

          {/* ── Plugin Modal ── */}
          {showPlugin&&<div style={{position:'fixed',inset:0,zIndex:1000,background:'rgba(0,0,0,.45)',display:'flex',alignItems:'center',justifyContent:'center',padding:24}} onClick={()=>setShowPlugin(false)}>
            <div style={{background:'#fff',borderRadius:16,maxWidth:460,width:'100%',padding:24}} onClick={e=>e.stopPropagation()}>
              {/* 头部 */}
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:18}}>
                <div style={{display:'flex',alignItems:'center',gap:10}}>
                  <img src={IMAGES.appicon} alt="" style={{width:36,height:36,borderRadius:8}} />
                  <div>
                    <div style={{fontSize:16,fontWeight:600,color:'#1a1a2e'}}>安装薯包AI提取插件</div>
                    <div style={{fontSize:11,color:'#999'}}>470KB · Chrome / Edge 浏览器</div>
                  </div>
                </div>
                <div onClick={()=>setShowPlugin(false)} style={{width:26,height:26,borderRadius:'50%',background:'#f0f0f0',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',color:'#888',fontSize:14,lineHeight:1,flexShrink:0}}>✕</div>
              </div>

              {/* 下载 */}
              <a href="/extensions/shubao-extractor.zip" download style={{display:'flex',alignItems:'center',gap:10,padding:'12px 16px',background:'#F5F3FF',borderRadius:10,textDecoration:'none',marginBottom:18}}>
                <div style={{width:40,height:40,borderRadius:8,background:'#4338CA',display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontSize:18}}>⬇</div>
                <div style={{flex:1}}>
                  <div style={{fontSize:13,fontWeight:600,color:'#333'}}>下载插件 ZIP 包</div>
                  <div style={{fontSize:11,color:'#888',marginTop:1}}>470KB · 解压后加载到浏览器即可使用</div>
                </div>
                <span style={{fontSize:12,fontWeight:600,color:'#4338CA',background:'#fff',padding:'6px 14px',borderRadius:6,border:'1px solid #C7D2FE'}}>下载</span>
              </a>

              {/* 安装步骤 */}
              <div style={{fontSize:13,fontWeight:600,color:'#333',marginBottom:10}}>安装步骤</div>
              <div style={{display:'flex',flexDirection:'column',gap:8}}>
                <div style={{display:'flex',gap:10,alignItems:'flex-start',padding:'8px 12px',background:'#FAFBFC',borderRadius:8,border:'1px solid #EEEFF2'}}>
                  <div style={{width:22,height:22,borderRadius:'50%',background:'#4338CA',color:'#fff',fontSize:11,fontWeight:700,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,marginTop:1}}>1</div>
                  <div style={{fontSize:12,color:'#555',lineHeight:1.6}}>下载 ZIP 包并解压到电脑上的任意文件夹</div>
                </div>
                <div style={{display:'flex',gap:10,alignItems:'flex-start',padding:'8px 12px',background:'#FAFBFC',borderRadius:8,border:'1px solid #EEEFF2'}}>
                  <div style={{width:22,height:22,borderRadius:'50%',background:'#4338CA',color:'#fff',fontSize:11,fontWeight:700,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,marginTop:1}}>2</div>
                  <div style={{fontSize:12,color:'#555',lineHeight:1.6}}>
                    地址栏输入 <span style={{color:'#1D4ED8',fontWeight:600,fontFamily:'monospace',background:'#DBEAFE',padding:'1px 5px',borderRadius:3}}>chrome://extensions</span>
                    <span style={{color:'#ccc',margin:'0 3px'}}>或</span>
                    <span style={{color:'#047857',fontWeight:600,fontFamily:'monospace',background:'#D1FAE5',padding:'1px 5px',borderRadius:3}}>edge://extensions</span>
                  </div>
                </div>
                <div style={{display:'flex',gap:10,alignItems:'flex-start',padding:'8px 12px',background:'#FAFBFC',borderRadius:8,border:'1px solid #EEEFF2'}}>
                  <div style={{width:22,height:22,borderRadius:'50%',background:'#4338CA',color:'#fff',fontSize:11,fontWeight:700,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,marginTop:1}}>3</div>
                  <div style={{fontSize:12,color:'#555',lineHeight:1.6}}>开启右上角「开发者模式」</div>
                </div>
                <div style={{display:'flex',gap:10,alignItems:'flex-start',padding:'8px 12px',background:'#FAFBFC',borderRadius:8,border:'1px solid #EEEFF2'}}>
                  <div style={{width:22,height:22,borderRadius:'50%',background:'#4338CA',color:'#fff',fontSize:11,fontWeight:700,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,marginTop:1}}>4</div>
                  <div style={{fontSize:12,color:'#555',lineHeight:1.6}}>点击「加载已解压的扩展程序」→ 选中解压好的文件夹</div>
                </div>
                <div style={{display:'flex',gap:10,alignItems:'flex-start',padding:'8px 12px',background:'linear-gradient(135deg,#F5F3FF,#EDE9FE)',borderRadius:8,border:'1px solid #C7D2FE'}}>
                  <div style={{width:22,height:22,borderRadius:'50%',background:'#7C3AED',color:'#fff',fontSize:11,fontWeight:700,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,marginTop:1}}>5</div>
                  <div style={{fontSize:12,color:'#555',lineHeight:1.6}}>打开任意商品页 → 点浏览器右上角的薯包图标 → 自动提取商品信息，一键发送到精修工坊 🎉</div>
                </div>
              </div>

              {/* 提示 */}
              <div style={{background:'#FEF3C7',borderRadius:8,padding:'10px 14px',marginTop:14,fontSize:11,color:'#8D6E00',lineHeight:1.6}}>
                💡 安装后打开任意商品页 → 点浏览器右上角的 <strong>薯包图标</strong> → 自动提取商品名称、图片、卖点，一键发送到精修工坊
              </div>

              <button onClick={()=>setShowPlugin(false)} style={{width:'100%',padding:'12px 0',border:'none',borderRadius:8,background:'#4338CA',color:'#fff',fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'inherit',marginTop:16}}>安装好了，开始使用</button>
            </div>
          </div>}          {/* ── ② Reference Images ── */}
          <div style={SX.card}>
            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:4}}>
              <Camera weight="fill" size={20} style={{color:'#666'}}/>
              <h3 style={{...SX.h3,marginBottom:0}}>商品参考图</h3>
              <span style={{fontSize:12,color:'#bbb',fontWeight:400}}>选填 · 正面照最有用</span>
            </div>
            <p style={{...SX.hint,marginBottom:16}}>上传你的商品实拍图。参考图越多越清晰，AI生成效果越精准。只要1张也能出图。</p>
            {refs.length>0&&(
              <div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:16}}>
                {refs.map((s,i)=>(
                  <div key={i} style={{position:'relative',width:80,height:80,borderRadius:8,overflow:'hidden',border:'1px solid #E8E8EC',cursor:'pointer'}} onClick={()=>setPlb(s)}>
                    <img src={s} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
                    <div onClick={e=>{e.stopPropagation();setRefs(p=>p.filter((_,j)=>j!==i));}} style={{position:'absolute',top:2,right:2,width:20,height:20,borderRadius:'50%',background:'#FF4757',color:'#fff',fontSize:11,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',border:'none',fontWeight:700,lineHeight:1,boxShadow:'0 1px 3px rgba(0,0,0,.3)'}}>×</div>
                  </div>
                ))}
              </div>
            )}
            <div onClick={()=>setShowRef(true)} style={{border:'2px dashed #DDDDE3',borderRadius:10,padding:'28px 24px',textAlign:'center',cursor:'pointer',background:'#FAFBFC',transition:'all .15s',color:'#bbb'}}
              onMouseEnter={e=>{e.currentTarget.style.borderColor='#6366F1';e.currentTarget.style.background='#F5F3FF';e.currentTarget.style.color='#6366F1';}}
              onMouseLeave={e=>{e.currentTarget.style.borderColor='#DDDDE3';e.currentTarget.style.background='#FAFBFC';e.currentTarget.style.color='#bbb';}}>
              <Upload weight="fill" size={24} style={{display:'block',margin:'0 auto 8px',color:'inherit'}}/>
              <div style={{fontSize:14,fontWeight:500,color:'inherit'}}>点击上传商品参考图</div>
              <div style={{fontSize:12,marginTop:4,color:'inherit'}}>JPG/PNG/WebP · 最多10张 · 每张不超过5MB</div>
            </div>
          </div>

          {/* ── Ref Modal ── */}
          {showRef&&<div style={{position:'fixed',inset:0,zIndex:1000,background:'rgba(0,0,0,.45)',display:'flex',alignItems:'center',justifyContent:'center',padding:24}} onClick={()=>setShowRef(false)}>
            <div style={{background:'#fff',borderRadius:16,maxWidth:540,width:'100%',maxHeight:'80vh',overflow:'auto',padding:28}} onClick={e=>e.stopPropagation()}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
                <h3 style={{fontSize:17,fontWeight:600,color:'#333'}}>📸 上传商品参考图</h3>
                <div onClick={()=>setShowRef(false)} style={{width:28,height:28,borderRadius:'50%',background:'#f5f5f5',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',color:'#999',fontSize:15,lineHeight:1}}>✕</div>
              </div>
              <div onClick={()=>fRef.current?.click()} style={{border:'2px dashed #DDDDE3',borderRadius:10,padding:'32px 24px',textAlign:'center',cursor:'pointer',marginBottom:16,background:'#FAFBFC',transition:'all .15s'}}
                onMouseEnter={e=>{e.currentTarget.style.borderColor='#6366F1';e.currentTarget.style.background='#F5F3FF';}}
                onMouseLeave={e=>{e.currentTarget.style.borderColor='#DDDDE3';e.currentTarget.style.background='#FAFBFC';}}>
                <Upload weight="fill" size={26} style={{color:'#bbb',marginBottom:8}}/>
                <div style={{fontSize:15,fontWeight:600,color:'#555'}}>点击上传商品参考图</div>
                <div style={{fontSize:13,color:'#bbb',marginTop:4}}>JPG/PNG/WebP · 最多10张 · 每张不超过5MB</div>
              </div>
              <input ref={fRef} type="file" accept="image/*" multiple hidden onChange={e=>{addImg(e.target.files,setRefs,refs,10);e.target.value='';}}/>
              {refs.length>0&&<div style={{marginBottom:16}}>
                <div style={{fontSize:13,fontWeight:500,color:'#555',marginBottom:8}}>已上传 {refs.length}/10 张</div>
                <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10}}>
                  {refs.map((s,i)=>(
                    <div key={i} style={{position:'relative',aspectRatio:'1/1',borderRadius:10,overflow:'hidden',border:'1px solid #E8E8EC',cursor:'pointer'}} onClick={()=>setPlb(s)}>
                      <img src={s} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
                      <div onClick={e=>{e.stopPropagation();setRefs(p=>p.filter((_,j)=>j!==i));}} style={{position:'absolute',top:4,right:4,width:22,height:22,borderRadius:'50%',background:'#FF4757',color:'#fff',fontSize:11,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',border:'none',fontWeight:700,lineHeight:1,boxShadow:'0 1px 3px rgba(0,0,0,.3)'}}>×</div>
                    </div>
                  ))}
                </div>
              </div>}
              <div style={{background:'#EEF2FF',borderRadius:10,padding:16,marginBottom:20}}>
                <div style={{fontSize:14,fontWeight:600,color:'#4338CA',marginBottom:8}}>🎯 哪些角度最有用？</div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px 16px',fontSize:13,color:'#555',lineHeight:1.8}}>
                  <span>• <b>正面照</b> — 产品整体外观</span>
                  <span>• <b>侧面45°</b> — 展示立体感</span>
                  <span>• <b>细节特写</b> — 材质/工艺放大</span>
                  <span>• <b>包装图</b> — 外包装+配件</span>
                  <span>• <b>使用场景</b> — 模拟真实环境</span>
                  <span>• <b>多角度</b> — 背面/顶部/底部</span>
                </div>
              </div>
              <button onClick={()=>setShowRef(false)} style={{width:'100%',padding:'13px 0',border:'none',borderRadius:10,background:'#4338CA',color:'#fff',fontSize:14,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>完成（{refs.length} 张）</button>
            </div>
          </div>}

          {/* ── ③ Product Info ── */}
          <div style={SX.card}>
            <h3 style={{...SX.h3,marginBottom:20}}>✏️ 商品信息</h3>
            <div style={{marginBottom:18}}>
              <label style={SX.label}>商品名称 <span style={{color:'#E53E3E'}}>*</span></label>
              <input value={name} onChange={e=>setName(e.target.value)} placeholder="高保湿精华液、无线蓝牙耳机、智能手表..." style={SX.input} onFocus={e=>e.target.style.borderColor='#6366F1'} onBlur={e=>e.target.style.borderColor='#DDDDE3'}/>
            </div>
            <div style={{marginBottom:18}}>
              <label style={SX.label}>品类</label>
              <div style={{display:'flex',flexWrap:'wrap',gap:8}}>
                {EC_CATS.map(c=>(
                  <span key={c} onClick={()=>setCat(c)} style={{padding:'7px 18px',borderRadius:24,fontSize:13,cursor:'pointer',fontFamily:'inherit',border:'1.5px solid',background:cat===c?'#EEF2FF':'#fff',borderColor:cat===c?'#6366F1':'#DDDDE3',color:cat===c?'#4338CA':'#888',fontWeight:cat===c?600:400,transition:'all .12s'}}>{c}</span>
                ))}
              </div>
            </div>
            <div style={{marginBottom:18}}>
              <label style={SX.label}>卖点文案 <span style={{fontWeight:400,color:'#bbb',fontSize:12}}>（逗号分隔，每个卖点生成一张解说图）</span></label>
              <input value={pts} onChange={e=>setPts(e.target.value)} placeholder="高保湿锁水, 24小时持久, 敏感肌适用" style={SX.input} onFocus={e=>e.target.style.borderColor='#6366F1'} onBlur={e=>e.target.style.borderColor='#DDDDE3'}/>
              {parsePts(pts).length>0&&<div style={{display:'flex',gap:6,flexWrap:'wrap',marginTop:8}}>{parsePts(pts).map((p,i)=>(<span key={i} style={{fontSize:12,padding:'3px 10px',borderRadius:6,background:'#EEF2FF',color:'#4338CA'}}>{p}</span>))}</div>}
            </div>
            <details>
              <summary style={{fontSize:13,color:'#bbb',cursor:'pointer',userSelect:'none',padding:'4px 0'}}>材质/规格 · 目标人群 · 限制条件（选填）</summary>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12,marginTop:16}}>
                <div><label style={{fontSize:12,fontWeight:500,color:'#999',marginBottom:6,display:'block'}}>材质/规格</label><input value={mat} onChange={e=>setMat(e.target.value)} placeholder="玻尿酸、304不锈钢..." style={{...SX.input,padding:'9px 12px',fontSize:13}} onFocus={e=>e.target.style.borderColor='#6366F1'} onBlur={e=>e.target.style.borderColor='#DDDDE3'}/></div>
                <div><label style={{fontSize:12,fontWeight:500,color:'#999',marginBottom:6,display:'block'}}>目标人群</label><input value={tgt} onChange={e=>setTgt(e.target.value)} placeholder="25-35岁女性..." style={{...SX.input,padding:'9px 12px',fontSize:13}} onFocus={e=>e.target.style.borderColor='#6366F1'} onBlur={e=>e.target.style.borderColor='#DDDDE3'}/></div>
                <div><label style={{fontSize:12,fontWeight:500,color:'#999',marginBottom:6,display:'block'}}>限制条件</label><input value={restr} onChange={e=>setRestr(e.target.value)} placeholder="不要出现人物..." style={{...SX.input,padding:'9px 12px',fontSize:13}} onFocus={e=>e.target.style.borderColor='#6366F1'} onBlur={e=>e.target.style.borderColor='#DDDDE3'}/></div>
              </div>
            </details>
          </div>

          {/* ── ④ Visual Style ── */}
          <div style={SX.card}>
            <h3 style={{...SX.h3,marginBottom:16}}><Palette weight="fill" size={20} style={{color:'#666'}}/> 视觉风格</h3>
            <p style={{...SX.hint,marginBottom:16}}>选择一种风格，所有图片视觉统一。切换风格后图片配置会自动推荐对应方案。</p>
            <div className="ec-style-grid">
              {STYLES.map(s=>(
                <div key={s.k} className={`ec-style-card ${pack===s.k?'on':''}`} onClick={()=>setPack(s.k)}>
                  <div className="ec-style-img" style={{backgroundImage:`url(${s.img})`,aspectRatio:s.ar}}/>
                  <div className="ec-style-body" style={{textAlign:'center',padding:'10px 12px 14px'}}>
                    <div className="ec-style-name" style={{fontSize:14}}>{s.l}</div>
                    <span className="ec-style-subtag">{s.s}</span>
                    <div className="ec-style-desc" style={{fontSize:11,color:'#888',lineHeight:1.4,marginTop:8,textAlign:'left',padding:'0 4px'}}>{s.des}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── ⑤ Image Config ── */}
          <div style={SX.card}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
              <h3 style={SX.h3}><Gear weight="fill" size={20} style={{color:'#666'}}/> 图片配置</h3>
              <span style={{fontSize:14,color:'#999'}}>共 {total} 张</span>
            </div>
            <div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:16}}>
              {['淘宝','京东','拼多多','小红书电商','抖音电商','亚马逊'].map(p=>(
                <span key={p} onClick={()=>setPlat(p)} style={{padding:'6px 16px',borderRadius:24,fontSize:12,cursor:'pointer',fontFamily:'inherit',border:'1.5px solid',background:plat===p?'#EEF2FF':'#fff',borderColor:plat===p?'#6366F1':'#DDDDE3',color:plat===p?'#4338CA':'#888',fontWeight:plat===p?600:400,transition:'all .12s'}}>{p}</span>
              ))}
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:6}}>
              {TYPES.main.map(t=>{
                const s=sel.find(x=>x.k===t.k);const c=s?.c||0;const w=s?.w||dim(plat,t.k).w;const h=s?.h||dim(plat,t.k).h;
                const editing=s?.editing;
                return(
                  <div key={t.k} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'8px 12px',borderRadius:8,background:c>0?'#EEF2FF':'#FAFBFC',border:'1px solid',borderColor:c>0?'#C7D2FE':'#EEEEF2',transition:'all .12s'}}>
                    <div style={{display:'flex',alignItems:'center',gap:8,flex:1}}>
                      <span style={{fontSize:18}}>{t.e}</span>
                      <div>
                        <span style={{fontSize:13,fontWeight:c>0?600:400,color:c>0?'#4338CA':'#999'}}>{t.l}</span>
                        <span style={{fontSize:11,color:'#bbb',marginLeft:6}}>{t.desc}</span>
                      </div>
                      {t.d&&<span style={{fontSize:11,color:'#E53E3E',background:'#FFF5F5',padding:'2px 8px',borderRadius:4}}>必选</span>}
                    </div>
                    <div style={{display:'flex',alignItems:'center',gap:6}}>
                      {/* Dimension display/editing */}
                      {editing ? (
                        <div style={{display:'flex',alignItems:'center',gap:2,background:'#fff',border:'1px solid #DDDDE3',borderRadius:6,padding:'2px 6px'}}>
                          <input type="number" value={w} min={100} max={9999} onChange={e=>updDim(t.k,'w',e.target.value)}
                            style={{width:44,padding:'2px 4px',border:'none',fontSize:11,fontFamily:'inherit',outline:'none',textAlign:'center',background:'transparent'}}/>
                          <span style={{fontSize:11,color:'#aaa'}}>×</span>
                          <input type="number" value={h} min={100} max={9999} onChange={e=>updDim(t.k,'h',e.target.value)}
                            style={{width:44,padding:'2px 4px',border:'none',fontSize:11,fontFamily:'inherit',outline:'none',textAlign:'center',background:'transparent'}}/>
                          <button onClick={()=>setSel(p=>p.map(s=>s.k===t.k?{...s,editing:false}:s))} style={{width:18,height:18,borderRadius:4,border:'none',background:'#4338CA',color:'#fff',fontSize:9,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',padding:0,lineHeight:1}}>✓</button>
                        </div>
                      ) : (
                        <div onClick={()=>setSel(p=>p.map(s=>s.k===t.k?{...s,editing:true}:s))} style={{fontSize:10,color:'#999',background:'#f5f5f5',padding:'3px 6px',borderRadius:4,cursor:'pointer',whiteSpace:'nowrap',transition:'all .12s'}}
                          onMouseEnter={e=>{e.currentTarget.style.background='#E0E7FF';e.currentTarget.style.color='#4338CA';}}
                          onMouseLeave={e=>{e.currentTarget.style.background='#f5f5f5';e.currentTarget.style.color='#999';}}>
                          {w}×{h}
                        </div>
                      )}
                      <button onClick={()=>upd(t.k,-1)} disabled={c<=0||(t.d&&c<=1)} style={{width:28,height:28,borderRadius:6,background:c>0?'#fff':'#f5f5f5',border:'1px solid',borderColor:'#DDDDE3',cursor:c>0?'pointer':'not-allowed',display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,color:'#666',padding:0,lineHeight:1,opacity:c>0?1:.35,transition:'all .12s'}}
                        onMouseEnter={e=>{if(c>0){e.currentTarget.style.background='#4338CA';e.currentTarget.style.color='#fff';e.currentTarget.style.borderColor='#4338CA';}}}
                        onMouseLeave={e=>{if(c>0){e.currentTarget.style.background='#fff';e.currentTarget.style.color='#666';e.currentTarget.style.borderColor='#DDDDE3';}}}>−</button>
                      <span style={{fontSize:16,fontWeight:700,color:'#4338CA',minWidth:24,textAlign:'center'}}>{c}</span>
                      <button onClick={()=>upd(t.k,1)} disabled={c>=t.m} style={{width:28,height:28,borderRadius:6,background:c<t.m?'#fff':'#f5f5f5',border:'1px solid',borderColor:'#DDDDE3',cursor:c<t.m?'pointer':'not-allowed',display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,color:'#666',padding:0,lineHeight:1,opacity:c<t.m?1:.35,transition:'all .12s'}}
                        onMouseEnter={e=>{if(c<t.m){e.currentTarget.style.background='#4338CA';e.currentTarget.style.color='#fff';e.currentTarget.style.borderColor='#4338CA';}}}
                        onMouseLeave={e=>{if(c<t.m){e.currentTarget.style.background='#fff';e.currentTarget.style.color='#666';e.currentTarget.style.borderColor='#DDDDE3';}}}>+</button>
                    </div>
                  </div>
                );
              })}
              <details style={{marginTop:4}}>
                <summary style={{fontSize:13,color:'#888',cursor:'pointer',userSelect:'none',padding:'6px 0',fontWeight:500}}>高级类型</summary>
                <div style={{display:'flex',flexDirection:'column',gap:4,marginTop:10}}>
                  {TYPES.adv.map(t=>{
                    const s=sel.find(x=>x.k===t.k);const c=s?.c||0;const w=s?.w||dim(plat,t.k).w;const h=s?.h||dim(plat,t.k).h;
                    const editing=s?.editing;
                    return(
                      <div key={t.k} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'6px 10px',borderRadius:6,background:c>0?'#EEF2FF':'#FAFBFC',border:'1px solid',borderColor:c>0?'#C7D2FE':'#EEEEF2'}}>
                        <span style={{fontSize:12,fontWeight:c>0?600:400,color:c>0?'#4338CA':'#888'}}>{t.e} {t.l}</span>
                        <div style={{display:'flex',alignItems:'center',gap:4}}>
                          {editing ? (
                            <div style={{display:'flex',alignItems:'center',gap:2,background:'#fff',border:'1px solid #D0D0D8',borderRadius:4,padding:'1px 4px'}}>
                              <input type="number" value={w} min={100} max={9999} onChange={e=>updDim(t.k,'w',e.target.value)}
                                style={{width:38,padding:'1px 3px',border:'none',fontSize:10,fontFamily:'inherit',outline:'none',textAlign:'center',background:'transparent',color:'#333'}}/>
                              <span style={{fontSize:10,color:'#999'}}>×</span>
                              <input type="number" value={h} min={100} max={9999} onChange={e=>updDim(t.k,'h',e.target.value)}
                                style={{width:38,padding:'1px 3px',border:'none',fontSize:10,fontFamily:'inherit',outline:'none',textAlign:'center',background:'transparent',color:'#333'}}/>
                              <button onClick={()=>setSel(p=>p.map(s=>s.k===t.k?{...s,editing:false}:s))} style={{width:16,height:16,borderRadius:3,border:'none',background:'#4338CA',color:'#fff',fontSize:8,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',padding:0,lineHeight:1}}>✓</button>
                            </div>
                          ) : (
                            <div onClick={()=>setSel(p=>p.map(s=>s.k===t.k?{...s,editing:true}:s))} style={{fontSize:10,color:'#999',background:'#f5f5f5',padding:'2px 5px',borderRadius:4,cursor:'pointer',whiteSpace:'nowrap'}}
                              onMouseEnter={e=>{e.currentTarget.style.background='#E0E7FF';e.currentTarget.style.color='#4338CA';}}
                              onMouseLeave={e=>{e.currentTarget.style.background='#f5f5f5';e.currentTarget.style.color='#999';}}>
                              {w}×{h}
                            </div>
                          )}
                          <button onClick={()=>upd(t.k,-1)} disabled={c<=0} style={{width:22,height:22,borderRadius:4,border:'1px solid #D0D0D8',background:'#fff',cursor:c>0?'pointer':'not-allowed',display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,color:'#666',padding:0,lineHeight:1,opacity:c>0?1:.35}}>−</button>
                          <span style={{fontSize:14,fontWeight:600,color:'#4338CA',minWidth:20,textAlign:'center'}}>{c}</span>
                          <button onClick={()=>upd(t.k,1)} disabled={c>=t.m} style={{width:22,height:22,borderRadius:4,border:'1px solid #D0D0D8',background:'#fff',cursor:c<t.m?'pointer':'not-allowed',display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,color:'#666',padding:0,lineHeight:1,opacity:c<t.m?1:.35}}>+</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </details>
            </div>
          </div>

          {/* ── Generate ── */}
          <button onClick={goPreview} disabled={!name.trim()||olLoad} style={{width:'100%',padding:'16px 0',border:'none',borderRadius:12,fontSize:16,fontWeight:700,fontFamily:'inherit',cursor:!name.trim()||olLoad?'not-allowed':'pointer',background:!name.trim()||olLoad?'#E0E0E0':'#4338CA',color:'#fff',transition:'background .15s',boxShadow:!name.trim()||olLoad?'none':'0 4px 16px rgba(67,56,202,.3)'}}>
            {olLoad?'生成大纲中...':`预览并生成（${total} 张）`}
          </button>
        </div>}

        {/* ═══════ PREVIEW ═══════ */}
        {phase==='preview'&&<div style={SX.card}>
          <h3 style={{...SX.h3,marginBottom:4}}>📋 生成大纲 — 共 {ol.length} 张图</h3>
          <p style={{...SX.hint,marginBottom:20}}>每张图可以自定义生成逻辑，确认后开始生成</p>
          {refs.length>0&&<div style={{marginBottom:16}}>
            <div style={{fontSize:12,color:'#999',marginBottom:8}}>参考图（{refs.length} 张）</div>
            <div style={{display:'flex',gap:8}}>{refs.map((s,i)=><div key={i} style={{width:44,height:44,borderRadius:6,overflow:'hidden',border:'1px solid #E8E8EC',cursor:'pointer'}} onClick={()=>setPlb(s)}><img src={s} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/></div>)}</div>
          </div>}
          {ol.map((item,idx)=>(
            <div key={idx} style={{marginBottom:10,padding:'12px 16px',borderRadius:8,background:'#F8F9FA',border:'1px solid #EEEEF2'}}>
              <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:6}}>
                <span style={{width:24,height:24,borderRadius:6,background:'#4338CA',color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:700,flexShrink:0}}>{idx+1}</span>
                <span style={{fontSize:13,fontWeight:600,color:'#333'}}>{item.emoji||''} {item.label}</span>
                {item.sellingPoint&&<span style={{fontSize:11,color:'#4338CA',background:'#EEF2FF',padding:'2px 8px',borderRadius:4}}>{item.sellingPoint}</span>}
              </div>
              <textarea value={item.userPrompt} onChange={e=>{const v=e.target.value;setOl(p=>p.map((o,i)=>i===idx?{...o,userPrompt:v}:o));}} style={{width:'100%',padding:'8px 12px',border:'1px solid #DDDDE3',borderRadius:6,fontSize:12,fontFamily:'inherit',outline:'none',resize:'vertical',minHeight:40,boxSizing:'border-box',background:'#fff'}} rows={2}/>
            </div>
          ))}
          <div style={{display:'flex',gap:12,marginTop:16}}>
            <button onClick={()=>setPhase('config')} style={{flex:1,padding:'13px 0',borderRadius:8,border:'1.5px solid #DDDDE3',background:'#fff',cursor:'pointer',fontSize:14,fontFamily:'inherit',color:'#666',fontWeight:500}}>← 返回修改</button>
            <button onClick={goGen} style={{flex:2,padding:'13px 0',borderRadius:8,border:'none',background:'#059669',color:'#fff',cursor:'pointer',fontSize:14,fontWeight:600,fontFamily:'inherit',boxShadow:'0 2px 8px rgba(5,150,105,.2)'}}>✅ 确认生成 {ol.length} 张</button>
          </div>
        </div>}

        {/* ═══════ RESULT ═══════ */}
        {phase==='result'&&res&&<div style={SX.card}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
            <div><span style={{fontSize:16,fontWeight:600,color:'#059669'}}>✅ 生成完成</span><span style={{fontSize:13,color:'#999',marginLeft:8}}>{Object.keys(res.images||{}).length} 张图</span></div>
            <button onClick={()=>{setPhase('config');setRes(null);}} style={{padding:'8px 16px',borderRadius:8,border:'1px solid #DDDDE3',background:'#fff',cursor:'pointer',fontSize:13,fontFamily:'inherit',color:'#888'}}>继续生成</button>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:12}}>
            {Object.entries(res.images||{}).map(([l,u])=>(
              <div key={l} style={{borderRadius:8,overflow:'hidden',border:'1px solid #EEEEF2'}}>
                <div style={{cursor:'zoom-in'}} onClick={()=>setLb(u)}><img src={proxyImg(u)} alt={l} style={{width:'100%',display:'block',aspectRatio:'1/1',objectFit:'contain',background:'#f8f8f8'}} loading="lazy"/></div>
                <div style={{padding:'10px 12px',display:'flex',justifyContent:'space-between',alignItems:'center',borderTop:'1px solid #EEEEF2'}}>
                  <span style={{fontSize:12,fontWeight:600,color:'#888'}}>{tLbl(bk(l))}</span>
                  {regEdit.v&&regEdit.l===l?<div style={{display:'flex',gap:6}}>
                    <button onClick={()=>setRegEdit({l:null,p:'',v:false})} style={{fontSize:11,padding:'4px 10px',borderRadius:6,border:'1px solid #DDDDE3',background:'#fff',cursor:'pointer',fontFamily:'inherit'}}>取消</button>
                    <button onClick={()=>goRegen(l,regEdit.p)} disabled={!!regKey} style={{fontSize:11,padding:'4px 10px',borderRadius:6,border:'none',background:'#4338CA',color:'#fff',cursor:'pointer',fontFamily:'inherit',opacity:regKey?.5:1}}>{regKey?'...':'重新生成'}</button>
                  </div>:<button onClick={()=>{const p=ol.find(o=>o.key===bk(l)||o.label===l)?.userPrompt||'';setRegEdit({l,p,v:true});}} style={{fontSize:11,color:'#4338CA',cursor:'pointer',padding:'4px 10px',borderRadius:6,background:'#EEF2FF',border:'none',fontFamily:'inherit'}}>重新生成</button>}
                </div>
              </div>
            ))}
          </div>
        </div>}

        {/* ── Lightboxes ── */}
        {lb&&<div style={{position:'fixed',inset:0,zIndex:1001,background:'rgba(0,0,0,.92)',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer'}} onClick={()=>setLb(null)}>
          <img src={proxyImg(lb)} style={{maxWidth:'90vw',maxHeight:'90vh',objectFit:'contain',borderRadius:12}} alt=""/>
        </div>}
        {plb&&<div style={{position:'fixed',inset:0,zIndex:1001,background:'rgba(0,0,0,.92)',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer'}} onClick={()=>setPlb(null)}>
          <img src={plb} style={{maxWidth:'90vw',maxHeight:'90vh',objectFit:'contain',borderRadius:12}} alt=""/>
        </div>}

        <div style={{marginTop:48}}><Footer/></div>
      </div>
    </div>
  );
}
