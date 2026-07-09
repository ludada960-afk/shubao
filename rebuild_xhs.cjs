const fs = require('fs');
let c = fs.readFileSync('D:/AI网站/shubao/shubao-final.jsx', 'utf8');

// Get exact strings from the file for marker matching
var zoomStartText = 'const C=css();\n  return <div style={{minHeight:"100vh",background:BG}}>\n    {C}\n    {/* ZOOM OVERLAY */}';
var resultCloseText = '  {loginModal}{priceModal}</div>;\n}';

var zoomIdx = c.indexOf(zoomStartText);
var closeIdx = c.indexOf(resultCloseText);

if (zoomIdx < 0 || closeIdx < 0) {
  console.log('Markers not found, showing partial matches:');
  console.log('  zoomStartText found:', c.includes('const C=css()'));
  console.log('  resultCloseText found:', c.includes('{loginModal}{priceModal}'));
  process.exit(1);
}

var before = c.substring(0, zoomIdx);
var after = c.substring(closeIdx);

console.log('Found markers at', zoomIdx, 'and', closeIdx);

// The new inner content
var newContent = `const C=css();
  return <div style={{display:'flex',flexDirection:'column',height:'100%',background:BG,fontFamily:'-apple-system,PingFang SC,Noto Sans SC,sans-serif'}}>
    {C}
    {/* ZOOM */}
    {zoom&&<div style={{position:'fixed',inset:0,zIndex:9999,background:'rgba(0,0,0,0.92)',display:'flex',alignItems:'center',justifyContent:'center',animation:'fadeIn .15s'}} onClick={()=>setZoom(null)}>
      <button onClick={(e)=>{e.stopPropagation();setImgIdx(i=>{var n=Math.max(0,i-1);setZoom(allImages[n]);return n;});}} style={{position:'absolute',left:12,top:'50%',transform:'translateY(-50%)',width:40,height:40,borderRadius:'50%',background:'rgba(255,255,255,0.15)',border:'none',color:'#fff',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontSize:20,zIndex:10}}>{String.fromCharCode(8249)}</button>
      <img src={zoom} alt="" style={{maxWidth:'92%',maxHeight:'92%',objectFit:'contain',borderRadius:12,boxShadow:'0 20px 60px rgba(0,0,0,0.5)'}} onClick={(e)=>{e.stopPropagation();setZoom(null);}}/>
      <button onClick={(e)=>{e.stopPropagation();setImgIdx(i=>{var n=Math.min(maxI-1,i+1);setZoom(allImages[n]);return n;});}} style={{position:'absolute',right:12,top:'50%',transform:'translateY(-50%)',width:40,height:40,borderRadius:'50%',background:'rgba(255,255,255,0.15)',border:'none',color:'#fff',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontSize:20,zIndex:10}}>{String.fromCharCode(8250)}</button>
    </div>}

    {/* XHS LAYOUT */}
    <div style={{display:'flex',gap:0,flex:1,overflow:'hidden'}}>
      <div style={{flex:'0 0 60%',background:'#f5f5f5',display:'flex',flexDirection:'column'}}>
        <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',position:'relative',overflow:'hidden'}}
          onMouseEnter={e=>e.currentTarget.querySelectorAll('.xhs-btn').forEach(function(b){b.style.opacity='1'})}
          onMouseLeave={e=>e.currentTarget.querySelectorAll('.xhs-btn').forEach(function(b){b.style.opacity='0'})}
          onWheel={function(e){if(e.deltaY>0&&imgIdx<maxI-1)setImgIdx(function(i){return i+1});if(e.deltaY<0&&imgIdx>0)setImgIdx(function(i){return i-1});}}>
          {allImages[imgIdx]?<img src={allImages[imgIdx]} alt="" style={{maxWidth:'100%',maxHeight:'100%',objectFit:'contain',cursor:'pointer',display:'block'}} onClick={function(){setZoom(allImages[imgIdx])}}/>:<div style={{color:'#ccc',fontSize:13}}>暂无图片</div>}
          {imgIdx>0&&<button className='xhs-btn' onClick={function(){setImgIdx(function(i){return i-1})}} style={{position:'absolute',left:6,top:'50%',transform:'translateY(-50%)',width:30,height:30,borderRadius:'50%',background:'rgba(255,255,255,.85)',border:'none',boxShadow:'0 2px 8px rgba(0,0,0,.12)',cursor:'pointer',fontSize:16,color:'#555',display:'flex',alignItems:'center',justifyContent:'center',opacity:0,transition:'opacity .15s'}}>{String.fromCharCode(8249)}</button>}
          {imgIdx<maxI-1&&<button className='xhs-btn' onClick={function(){setImgIdx(function(i){return i+1})}} style={{position:'absolute',right:6,top:'50%',transform:'translateY(-50%)',width:30,height:30,borderRadius:'50%',background:'rgba(255,255,255,.85)',border:'none',boxShadow:'0 2px 8px rgba(0,0,0,.12)',cursor:'pointer',fontSize:16,color:'#555',display:'flex',alignItems:'center',justifyContent:'center',opacity:0,transition:'opacity .15s'}}>{String.fromCharCode(8250)}</button>}
          <div style={{position:'absolute',right:8,bottom:8,background:'rgba(0,0,0,.4)',backdropFilter:'blur(4px)',borderRadius:4,padding:'2px 8px',color:'#fff',fontSize:10,zIndex:5}}>{imgIdx+1}/{maxI||1}</div>
          <button className='xhs-btn' onClick={function(){regenSingle(imgIdx)}} style={{position:'absolute',left:8,bottom:8,background:'rgba(0,0,0,.55)',backdropFilter:'blur(4px)',border:'none',borderRadius:6,padding:'4px 8px',color:'#fff',fontSize:10,cursor:'pointer',display:'flex',alignItems:'center',gap:3,zIndex:5,opacity:0,transition:'opacity .15s',fontFamily:'inherit'}}>{rgIdx===imgIdx?'⟳ 刷新中...':'↻ 重生成'}</button>
        </div>
        {maxI>1&&<div style={{display:'flex',gap:4,padding:'8px 12px',borderTop:'1px solid #eee',justifyContent:'center',overflowX:'auto'}}>
          {allImages.map(function(url,i){return <div key={i} onClick={function(){setImgIdx(function(){return i})}} style={{flex:'0 0 auto',width:36,height:48,borderRadius:4,overflow:'hidden',border:i===imgIdx?'2px solid #333':'2px solid transparent',cursor:'pointer',opacity:i===imgIdx?1:.35,transition:'all .12s'}}><img src={url} alt="" style={{width:'100%',height:'100%',objectFit:'cover',display:'block'}}/></div>})}
        </div>}
      </div>
      <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
        <div style={{flex:1,overflowY:'auto',padding:'16px 20px 0'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
            <div style={{display:'flex',alignItems:'center',gap:8}}>
              <img src={I.appicon} alt="" style={{width:32,height:32,borderRadius:'50%',objectFit:'cover',flex:'0 0 auto'}}/>
              <div><div style={{fontSize:13,fontWeight:600,color:'#222'}}>薯包AI</div><div style={{fontSize:11,color:'#999'}}>AI创作 · 一键生成</div></div>
            </div>
            <button onClick={function(){setGen('idle');setResult(null);}} style={{background:'none',border:'none',color:'#999',cursor:'pointer',padding:4}}>
              <svg width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'><path d='M18 6L6 18'/><path d='M6 6l12 12'/></svg>
            </button>
          </div>
          <h1 style={{fontSize:18,fontWeight:700,lineHeight:1.5,color:'#222',margin:'0 0 12px'}}>{result.title||''}</h1>
          <div style={{fontSize:14,lineHeight:1.85,color:'#444',whiteSpace:'pre-wrap',marginBottom:14}}>{result.body_text||''}</div>
          {(result.hashtags||[]).length>0&&<div style={{display:'flex',flexWrap:'wrap',gap:4,marginBottom:12}}>
            {(result.hashtags||[]).map(function(t,i){return <span key={i} style={{fontSize:12,color:'#888',background:'#f5f5f5',padding:'4px 11px',borderRadius:20}}>{t}</span>})}
          </div>}
        </div>
        <div style={{padding:'12px 20px',borderTop:'1px solid #f0f0f0',background:'#fff'}}>
          <div style={{display:'flex',gap:8}}>
            <button onClick={function(){var tx=(result.title||'')+'\\n\\n'+(result.body_text||'')+'\\n\\n'+((result.hashtags||[]).join(' '));navigator.clipboard?.writeText(tx).catch(function(){})}} style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',gap:4,background:'#f5f5f5',border:'none',borderRadius:10,fontSize:13,fontWeight:500,color:'#333',padding:'11px 0',cursor:'pointer',fontFamily:'inherit'}}>📋 复制全文</button>
            <button onClick={function(){downloadZip(result.cover_url,result.image_urls,result.title)}} style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',gap:4,background:'#f5f5f5',border:'none',borderRadius:10,fontSize:13,fontWeight:500,color:'#333',padding:'11px 0',cursor:'pointer',fontFamily:'inherit'}}>⬇ 导出</button>
          </div>
        </div>
      </div>
    </div>`;

c = before + newContent + after;

// Remove info_blocks rendering (crash fix)
c = c.replace(
  '{curPage.info_blocks.map((b,i)=><div key={i}>{b}</div>)}',
  '{curPage.info_blocks.map((b,i)=><div key={i}>{b.label}: {b.value}</div>)}'
);
c = c.replace(
  '\n            {curPage.info_blocks?.length>0&&<div style={{marginTop:8,padding:10,background:"#FAFAFA",borderRadius:10,fontSize:12,lineHeight:1.7,color:"#888"}}>{curPage.info_blocks.map((b,i)=><div key={i}>{b.label}: {b.value}</div>)}</div>}',
  ''
);

// Remove layout_hint
c = c.replace(
  '\n            <div style={{marginTop:8,fontSize:12,color:"#999",lineHeight:1.6}}><strong>排版提示：</strong>{curPage.layout_hint||curPage.story||\'\\u2014\'}</div>',
  ''
);

// Rename button
c = c.replace('重新生成文章', '重新生成文案');

// Step 1: Add modal wrapper in App
c = c.replace(
  'if(gen==="result"&&result){\n    return <ResultDisplay result={result} logged={logged} onLogin={()=>setShowLogin(true)} onPrice={()=>setShowPrice(true)} loginModal={loginModal} priceModal={priceModal} textRegen={textRegen} text={text} setResult={setResult} setGen={setGen}/>;\n  }',
  `if(gen==="result"&&result){
    return <div style={{position:'fixed',inset:0,zIndex:900,background:'rgba(0,0,0,.45)',backdropFilter:'blur(6px)',display:'flex',alignItems:'center',justifyContent:'center'}} onClick={function(){setGen('idle');setResult(null);}}>
      <div onClick={function(e){e.stopPropagation()}} style={{background:'#fff',borderRadius:12,width:'94vw',maxWidth:1100,height:'90vh',display:'flex',flexDirection:'column',overflow:'hidden',boxShadow:'0 20px 60px rgba(0,0,0,.25)',animation:'slideUp .25s ease'}}>
        <ResultDisplay result={result} logged={logged} onLogin={function(){setShowLogin(true)}} onPrice={function(){setShowPrice(true)}} loginModal={loginModal} priceModal={priceModal} textRegen={textRegen} text={text} setResult={setResult} setGen={setGen}/>
      </div>
    </div>;
  }`
);

fs.writeFileSync('D:/AI网站/shubao/shubao-final.jsx', c, 'utf8');
console.log('XHS modal rewrite complete!');
